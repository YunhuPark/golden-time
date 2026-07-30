import { NetworkError } from '../../../infrastructure/errors/AppError';

/**
 * Kakao Mobility Directions API - 길찾기 및 소요시간 계산
 * 두 좌표 간 경로 정보 및 예상 소요시간 제공
 *
 * API Docs: https://developers.kakaomobility.com/docs/navi-api/directions/
 *
 * Ironclad Law #2: Anti-Hallucination
 * - Kakao Mobility REST API 실제 응답 구조만 사용
 *
 * Ironclad Law #3: Edge Case Obsession
 * - 경로 없음, 네트워크 실패, 타임아웃 모두 처리
 */

/**
 * Kakao Mobility Directions API 응답
 * Reference: https://developers.kakaomobility.com/docs/navi-api/directions/
 */
export interface KakaoDirectionsResponse {
  trans_id: string;
  routes: Array<{
    result_code: number;
    result_msg: string;
    summary: {
      origin: {
        name: string;
        x: number;
        y: number;
      };
      destination: {
        name: string;
        x: number;
        y: number;
      };
      waypoints: Array<{
        name: string;
        x: number;
        y: number;
      }>;
      priority: string;
      bound: {
        min_x: number;
        min_y: number;
        max_x: number;
        max_y: number;
      };
      fare: {
        taxi: number;
        toll: number;
      };
      distance: number; // 전체 거리 (미터)
      duration: number; // 전체 소요시간 (초)
    };
    sections: Array<{
      distance: number;
      duration: number;
      bound: {
        min_x: number;
        min_y: number;
        max_x: number;
        max_y: number;
      };
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

/**
 * 경로 우선순위 옵션
 */
export type RoutePriority = 'RECOMMEND' | 'TIME' | 'DISTANCE';

/**
 * 경로 요약 정보 (간소화된 응답)
 */
export interface RouteInfo {
  distance: number; // 거리 (미터)
  duration: number; // 소요시간 (초)
  taxiFare: number; // 택시 요금 (원)
  tollFare: number; // 통행료 (원)
}

/**
 * HTTP 상태 코드 분류 — 재시도 가능 여부 판정
 * - 재시도 가능: 429, 504, 502, 503, AbortError(timeout)
 * - 재시도 불가: 400, 401, 403, 404, 기타 4xx
 */
function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

/**
 * Kakao Mobility Directions API 클라이언트
 * 자동차 경로 탐색 및 소요시간 계산 전용
 *
 * 동시성 정책:
 * - 동시 호출은 enrichWithConcurrencyLimit()를 통해 최대 3개로 제한
 * - 개별 요청 타임아웃: 8초 (Vercel Functions 제한 고려)
 * - 재시도: 429/5xx/timeout에 한해 최대 1회 (지연 1초)
 * - 400/401/403: 재시도 없이 즉시 null 반환
 */
export class KakaoDirectionsClient {
  private readonly timeout: number;
  /** 재시도 최대 횟수 (첫 시도 제외) */
  private readonly maxRetryCount: number;

  constructor(
    timeout = 8000, // 8초 (Vercel serverless 제한 고려)
    maxRetryCount = 1 // 재시도 1회 (첫 시도 실패 후 1회만)
  ) {
    this.timeout = timeout;
    this.maxRetryCount = maxRetryCount;
  }

  /**
   * 두 좌표 간 경로 정보 및 소요시간 계산
   *
   * @param origin 출발지 좌표 { latitude, longitude }
   * @param destination 목적지 좌표 { latitude, longitude }
   * @param priority 경로 우선순위 (기본: RECOMMEND)
   * @returns RouteInfo 또는 null (경로 탐색 실패 시)
   *
   * Edge Cases:
   * - 출발지/목적지가 동일한 경우
   * - 경로를 찾을 수 없는 경우 (섬, 해외 등)
   * - 네트워크 에러
   * - API 요금제 한도 초과 (429)
   */
  async getRouteInfo(
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number },
    priority: RoutePriority = 'RECOMMEND'
  ): Promise<RouteInfo | null> {
    // Edge Case 1: 출발지와 목적지가 동일한 경우
    if (
      origin.latitude === destination.latitude &&
      origin.longitude === destination.longitude
    ) {
      return {
        distance: 0,
        duration: 0,
        taxiFare: 0,
        tollFare: 0,
      };
    }

    // Edge Case 2: 좌표 유효성 검증
    if (!this.isValidCoordinate(origin) || !this.isValidCoordinate(destination)) {
      // 키·좌표 원문을 로그에 출력하지 않음
      console.warn('getRouteInfo: Invalid coordinates provided');
      return null;
    }

    const url = new URL('/api/kakao/directions', window.location.origin);

    // 쿼리 파라미터 설정
    // origin/destination 형식: "경도,위도" (주의: x=경도, y=위도)
    url.searchParams.set('origin', `${origin.longitude},${origin.latitude}`);
    url.searchParams.set(
      'destination',
      `${destination.longitude},${destination.latitude}`
    );
    url.searchParams.set('priority', priority);

    try {
      const response = await this.fetchWithRetry<KakaoDirectionsResponse>(
        url.toString()
      );

      // Edge Case 3: 경로가 없는 경우
      if (!response.routes || response.routes.length === 0) {
        return null;
      }

      const firstRoute = response.routes[0];

      // Edge Case 4: firstRoute가 없는 경우
      if (!firstRoute) {
        return null;
      }

      // Edge Case 5: 경로 탐색 실패 (Kakao result_code 비영)
      if (firstRoute.result_code !== 0) {
        // result_msg를 로그에 출력하되 full URL/키는 미출력
        console.warn(
          `getRouteInfo: Route search failed (code: ${firstRoute.result_code})`
        );
        return null;
      }

      const { summary } = firstRoute;

      // Edge Case 6: summary가 없는 경우
      if (!summary) {
        return null;
      }

      // 응답 데이터 검증
      if (
        typeof summary.distance !== 'number' ||
        typeof summary.duration !== 'number'
      ) {
        return null;
      }

      return {
        distance: summary.distance,
        duration: summary.duration,
        taxiFare: summary.fare?.taxi || 0,
        tollFare: summary.fare?.toll || 0,
      };
    } catch (error) {
      // 에러 유형만 로깅, URL query/키는 출력 안 함
      if (error instanceof NetworkError) {
        console.warn(`getRouteInfo: NetworkError [${error.statusCode ?? 'unknown'}]`);
      } else if (error instanceof Error) {
        console.warn(`getRouteInfo: ${error.name}`);
      }
      return null;
    }
  }

  /**
   * 여러 목적지에 대해 동시성 제한을 두고 병렬 경로 계산
   * - 최대 concurrency개씩 동시 처리
   * - 개별 실패가 전체 중단을 유발하지 않음
   * - 결과는 병원의 id(안정적 식별자) → RouteInfo 로 매핑
   *
   * @param origin 출발지 좌표
   * @param targets 목적지 목록 (id + 좌표)
   * @param concurrency 최대 동시 요청 수 (기본 3)
   * @returns Map<id, RouteInfo>
   */
  async getRouteInfoBatch(
    origin: { latitude: number; longitude: number },
    targets: Array<{ id: string; latitude: number; longitude: number }>,
    concurrency = 3
  ): Promise<Map<string, RouteInfo>> {
    const results = new Map<string, RouteInfo>();
    let index = 0;

    const worker = async (): Promise<void> => {
      while (index < targets.length) {
        const currentIndex = index++;
        const target = targets[currentIndex];
        if (!target) continue;

        const routeInfo = await this.getRouteInfo(
          origin,
          { latitude: target.latitude, longitude: target.longitude }
        );

        if (routeInfo) {
          results.set(target.id, routeInfo);
        }
      }
    };

    // concurrency개 worker를 동시에 실행
    const workers = Array.from({ length: Math.min(concurrency, targets.length) }, worker);
    await Promise.allSettled(workers);

    return results;
  }

  /**
   * 좌표 유효성 검증
   */
  isValidCoordinate(coord: {
    latitude: number;
    longitude: number;
  }): boolean {
    const { latitude, longitude } = coord;

    if (isNaN(latitude) || isNaN(longitude)) return false;
    if (latitude < -90 || latitude > 90) return false;
    if (longitude < -180 || longitude > 180) return false;

    return true;
  }

  /**
   * 재시도 로직이 포함된 Fetch 래퍼
   *
   * 재시도 정책:
   * - 429 / 502 / 503 / 504 / AbortError(timeout): 1초 대기 후 최대 maxRetryCount회
   * - 400 / 401 / 403 / 기타 4xx: 즉시 실패 (재시도 없음)
   *
   * Bug fixed: 기존 코드는 maxRetries=1이면 루프가 1번만 돌고
   *   attempt < retries-1 = 0 이 절대 true가 안 돼 재시도 불가능했음.
   *   수정: 총 시도 횟수 = 1(최초) + maxRetryCount, 루프 분리.
   */
  private async fetchWithRetry<T>(url: string): Promise<T> {
    const maxAttempts = 1 + this.maxRetryCount; // 최초 1 + 재시도 N

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
          },
        });
        clearTimeout(timeoutId);

        // 400 / 401 / 403: 재시도 없이 즉시 실패
        if (response.status === 400 || response.status === 401 || response.status === 403) {
          throw new NetworkError(
            `Kakao Directions: non-retryable error`,
            undefined,
            response.status
          );
        }

        // 429 / 5xx: 재시도 가능
        if (isRetryableStatus(response.status)) {
          if (attempt < maxAttempts) {
            const delay = 1000; // 1초 고정 지연
            console.warn(
              `Kakao Directions: status ${response.status}, retrying in ${delay}ms (attempt ${attempt}/${maxAttempts})`
            );
            await this.sleep(delay);
            continue;
          }
          throw new NetworkError(
            `Kakao Directions: retryable error after ${maxAttempts} attempts`,
            undefined,
            response.status
          );
        }

        if (!response.ok) {
          throw new NetworkError(
            `Kakao Directions: HTTP ${response.status}`,
            undefined,
            response.status
          );
        }

        const data: T = await response.json();
        return data;

      } catch (error) {
        clearTimeout(timeoutId);

        // 400/401/403은 즉시 재throw (재시도 없음)
        if (error instanceof NetworkError &&
            error.statusCode !== undefined &&
            !isRetryableStatus(error.statusCode)) {
          throw error;
        }

        // AbortError(timeout): 재시도 가능
        if (error instanceof Error && error.name === 'AbortError') {
          if (attempt < maxAttempts) {
            console.warn(
              `Kakao Directions: timeout, retrying (attempt ${attempt}/${maxAttempts})`
            );
            await this.sleep(1000);
            continue;
          }
          throw new NetworkError('Kakao Directions: timeout after retries');
        }

        // NetworkError (retryable): 재시도
        if (error instanceof NetworkError) {
          if (error.statusCode !== undefined && !isRetryableStatus(error.statusCode)) {
            throw error;
          }
          if (attempt < maxAttempts) {
            console.warn(
              `Kakao Directions: network error, retrying (attempt ${attempt}/${maxAttempts})`
            );
            await this.sleep(1000);
            continue;
          }
          throw error;
        }

        // 기타 에러
        throw new NetworkError('Kakao Directions: unexpected error');
      }
    }

    throw new NetworkError('Kakao Directions: all attempts exhausted');
  }

  /**
   * Sleep 유틸리티 (재시도 대기용)
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
