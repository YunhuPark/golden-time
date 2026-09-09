import { NetworkError } from '../../../infrastructure/errors/AppError';

export interface KakaoDirectionsResponse {
  trans_id: string;
  routes: Array<{
    result_code: number;
    result_msg: string;
    summary: {
      origin: { name: string; x: number; y: number };
      destination: { name: string; x: number; y: number };
      waypoints: Array<{ name: string; x: number; y: number }>;
      priority: string;
      bound: { min_x: number; min_y: number; max_x: number; max_y: number };
      fare: { taxi: number; toll: number };
      distance: number;
      duration: number;
    };
    sections: Array<{
      distance: number;
      duration: number;
      bound: { min_x: number; min_y: number; max_x: number; max_y: number };
      roads: Array<{
        name: string;
        distance: number;
        duration: number;
        traffic_speed: number;
        traffic_state: number;
        vertexes: number[];
      }>;
      guides: Array<{
        name: string;
        x: number;
        y: number;
        distance: number;
        duration: number;
        type: number;
        guidance: string;
        road_index: number;
      }>;
    }>;
  }>;
}

export type RoutePriority = 'RECOMMEND' | 'TIME' | 'DISTANCE';

export interface RouteInfo {
  distance: number;
  duration: number;
  taxiFare: number;
  tollFare: number;
}

type RouteCacheEntry = {
  routeInfo: RouteInfo;
  expiresAt: number;
};

const ROUTE_CACHE_TTL_MS = 60_000;
const ROUTE_CACHE_MAX_ENTRIES = 100;
const routeCache = new Map<string, RouteCacheEntry>();
const routeRequestsInFlight = new Map<string, Promise<RouteInfo | null>>();

const buildRouteCacheKey = (
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
  priority: RoutePriority
): string => {
  const originKey = `${origin.latitude.toFixed(4)},${origin.longitude.toFixed(4)}`;
  const destinationKey = `${destination.latitude.toFixed(5)},${destination.longitude.toFixed(5)}`;
  return `${priority}:${originKey}>${destinationKey}`;
};

export class KakaoDirectionsClient {
  private readonly timeout: number;
  private readonly maxRetries: number;

  constructor(timeout = 3500, maxRetries = 2) {
    this.timeout = timeout;
    this.maxRetries = maxRetries;
  }

  async getRouteInfo(
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number },
    priority: RoutePriority = 'RECOMMEND'
  ): Promise<RouteInfo | null> {
    if (
      origin.latitude === destination.latitude &&
      origin.longitude === destination.longitude
    ) {
      return { distance: 0, duration: 0, taxiFare: 0, tollFare: 0 };
    }

    if (!this.isValidCoordinate(origin) || !this.isValidCoordinate(destination)) {
      console.error('getRouteInfo: Invalid coordinates', { origin, destination });
      return null;
    }

    const cacheKey = buildRouteCacheKey(origin, destination, priority);
    const cached = routeCache.get(cacheKey);
    if (cached) {
      if (cached.expiresAt > Date.now()) {
        return cached.routeInfo;
      }
      routeCache.delete(cacheKey);
    }

    const inFlight = routeRequestsInFlight.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }

    const request = this.fetchRouteInfoUncached(origin, destination, priority)
      .then((routeInfo) => {
        if (routeInfo) {
          this.cacheRoute(cacheKey, routeInfo);
        }
        return routeInfo;
      })
      .finally(() => {
        routeRequestsInFlight.delete(cacheKey);
      });

    routeRequestsInFlight.set(cacheKey, request);
    return request;
  }

  private async fetchRouteInfoUncached(
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number },
    priority: RoutePriority
  ): Promise<RouteInfo | null> {
    const url = new URL('/api/kakao/directions', window.location.origin);
    url.searchParams.set('origin', `${origin.longitude},${origin.latitude}`);
    url.searchParams.set('destination', `${destination.longitude},${destination.latitude}`);
    url.searchParams.set('priority', priority);

    try {
      const response = await this.fetchWithRetry<KakaoDirectionsResponse>(url.toString());
      const firstRoute = response.routes?.[0];

      if (!firstRoute) {
        console.warn('getRouteInfo: No routes found in response');
        return null;
      }

      if (firstRoute.result_code !== 0) {
        console.warn(
          `getRouteInfo: Route search failed - ${firstRoute.result_msg} (code: ${firstRoute.result_code})`
        );
        return null;
      }

      const { summary } = firstRoute;
      if (!summary || typeof summary.distance !== 'number' || typeof summary.duration !== 'number') {
        console.error('getRouteInfo: Invalid summary data', summary);
        return null;
      }

      return {
        distance: summary.distance,
        duration: summary.duration,
        taxiFare: summary.fare?.taxi || 0,
        tollFare: summary.fare?.toll || 0,
      };
    } catch (error) {
      console.error('getRouteInfo failed:', error);
      return null;
    }
  }

  private cacheRoute(cacheKey: string, routeInfo: RouteInfo): void {
    const now = Date.now();

    for (const [key, entry] of routeCache) {
      if (entry.expiresAt <= now) {
        routeCache.delete(key);
      }
    }

    if (routeCache.size >= ROUTE_CACHE_MAX_ENTRIES) {
      const oldestKey = routeCache.keys().next().value as string | undefined;
      if (oldestKey) {
        routeCache.delete(oldestKey);
      }
    }

    routeCache.set(cacheKey, {
      routeInfo,
      expiresAt: now + ROUTE_CACHE_TTL_MS,
    });
  }

  async getBatchRouteInfoConcurrent(
    origin: { latitude: number; longitude: number },
    destinations: Array<{ id: string; latitude: number; longitude: number }>,
    concurrency = 3
  ): Promise<Map<string, RouteInfo>> {
    const results = new Map<string, RouteInfo>();

    for (let i = 0; i < destinations.length; i += concurrency) {
      const chunk = destinations.slice(i, i + concurrency);
      const promises = chunk.map(async (destination) => {
        const routeInfo = await this.getRouteInfo(origin, destination);
        return { id: destination.id, routeInfo };
      });

      const settledResults = await Promise.allSettled(promises);
      settledResults.forEach((result) => {
        if (result.status === 'fulfilled' && result.value.routeInfo) {
          results.set(result.value.id, result.value.routeInfo);
        } else if (result.status === 'rejected') {
          console.warn('getBatchRouteInfoConcurrent: Request failed', result.reason);
        }
      });

      if (i + concurrency < destinations.length) {
        await this.sleep(100);
      }
    }

    return results;
  }

  private isValidCoordinate(coord: { latitude: number; longitude: number }): boolean {
    const { latitude, longitude } = coord;
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) return false;
    if (latitude < -90 || latitude > 90) return false;
    if (longitude < -180 || longitude > 180) return false;
    return true;
  }

  private isRetryableStatus(statusCode?: number): boolean {
    return statusCode === 502 || statusCode === 503 || statusCode === 504;
  }

  private async fetchWithRetry<T>(url: string, retries = this.maxRetries): Promise<T> {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        let response: Response;
        try {
          response = await fetch(url, {
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json' },
          });
        } finally {
          clearTimeout(timeoutId);
        }

        if (response.status === 429) {
          throw new NetworkError(
            'Kakao Mobility API Rate Limit 초과. 잠시 후 다시 시도해주세요.',
            undefined,
            429
          );
        }

        if (response.status === 401 || response.status === 403) {
          throw new NetworkError(
            'Kakao Mobility API 인증 실패. API 키를 확인해주세요.',
            undefined,
            response.status
          );
        }

        if (response.status >= 400 && response.status < 500) {
          throw new NetworkError(
            `Kakao Mobility API 요청 오류: ${response.status}`,
            undefined,
            response.status
          );
        }

        if (!response.ok) {
          throw new NetworkError(
            `Kakao Mobility API Error: ${response.status} ${response.statusText}`,
            undefined,
            response.status
          );
        }

        return (await response.json()) as T;
      } catch (error) {
        const hasRetryLeft = attempt < retries - 1;

        if (error instanceof Error && error.name === 'AbortError') {
          if (hasRetryLeft) {
            await this.sleep(250);
            continue;
          }
          throw new NetworkError('Kakao Mobility API 요청 시간 초과', error, 504);
        }

        if (error instanceof NetworkError) {
          if (hasRetryLeft && this.isRetryableStatus(error.statusCode)) {
            await this.sleep(250);
            continue;
          }
          throw error;
        }

        if (error instanceof TypeError) {
          if (hasRetryLeft) {
            await this.sleep(250);
            continue;
          }
          throw new NetworkError('Kakao Mobility API 네트워크 오류', error);
        }

        if (error instanceof Error) {
          throw new NetworkError('Kakao Mobility API 호출 실패', error);
        }

        throw new NetworkError('알 수 없는 오류 발생');
      }
    }

    throw new NetworkError('최대 재시도 횟수 초과');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
