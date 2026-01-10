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
 * Kakao Mobility Directions API 클라이언트
 * 자동차 경로 탐색 및 소요시간 계산 전용
 */
export class KakaoDirectionsClient {
  private readonly baseUrl = 'https://apis-navi.kakaomobility.com';
  private readonly restApiKey: string;
  private readonly timeout: number;
  private readonly maxRetries: number;

  constructor(
    restApiKey = import.meta.env['VITE_KAKAO_REST_API_KEY'] || '',
    timeout = 3000, // 3초로 단축 (성능 최적화)
    maxRetries = 1 // 재시도 1회로 단축 (빠른 실패)
  ) {
    this.restApiKey = restApiKey;
    this.timeout = timeout;
    this.maxRetries = maxRetries;

    if (!this.restApiKey) {
      console.warn(
        '⚠️ WARNING: VITE_KAKAO_REST_API_KEY not found. Directions API will fail.'
      );
    } else {
      console.log('✅ Kakao Mobility Directions API Key loaded successfully');
    }
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
      console.warn('getRouteInfo: Origin and destination are the same');
      return {
        distance: 0,
        duration: 0,
        taxiFare: 0,
        tollFare: 0,
      };
    }

    // Edge Case 2: 좌표 유효성 검증
    if (!this.isValidCoordinate(origin) || !this.isValidCoordinate(destination)) {
      console.error('getRouteInfo: Invalid coordinates', { origin, destination });
      return null;
    }

    const endpoint = '/v1/directions';
    const url = new URL(this.baseUrl + endpoint);

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
        console.warn('getRouteInfo: No routes found in response');
        return null;
      }

      const firstRoute = response.routes[0];

      // Edge Case 4: firstRoute가 없는 경우
      if (!firstRoute) {
        console.warn('getRouteInfo: First route is undefined');
        return null;
      }

      // Edge Case 5: 경로 탐색 실패
      if (firstRoute.result_code !== 0) {
        console.warn(
          `getRouteInfo: Route search failed - ${firstRoute.result_msg} (code: ${firstRoute.result_code})`
        );
        return null;
      }

      const { summary } = firstRoute;

      // Edge Case 6: summary가 없는 경우
      if (!summary) {
        console.error('getRouteInfo: Summary is undefined');
        return null;
      }

      // 응답 데이터 검증
      if (
        typeof summary.distance !== 'number' ||
        typeof summary.duration !== 'number'
      ) {
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
      console.error(
        `getRouteInfo failed from (${origin.latitude}, ${origin.longitude}) to (${destination.latitude}, ${destination.longitude}):`,
        error
      );
      return null;
    }
  }

  /**
   * 여러 목적지까지의 경로 정보를 배치로 계산
   *
   * @param origin 출발지 좌표
   * @param destinations 목적지 좌표 배열
   * @param delayMs 각 요청 사이 대기 시간 (기본 100ms, Rate Limit 방지)
   * @returns Map<목적지인덱스, RouteInfo>
   *
   * Edge Cases:
   * - 일부 경로만 성공하는 경우 (부분 성공)
   * - Rate Limit 초과 방지 (요청 간 지연)
   */
  async getBatchRouteInfo(
    origin: { latitude: number; longitude: number },
    destinations: Array<{ latitude: number; longitude: number }>,
    delayMs = 100
  ): Promise<Map<number, RouteInfo>> {
    const results = new Map<number, RouteInfo>();

    for (let i = 0; i < destinations.length; i++) {
      const destination = destinations[i];
      if (!destination) continue; // undefined 체크

      const routeInfo = await this.getRouteInfo(origin, destination);

      if (routeInfo) {
        results.set(i, routeInfo);
      }

      // Rate Limit 방지를 위한 지연
      if (delayMs > 0 && i < destinations.length - 1) {
        await this.sleep(delayMs);
      }
    }

    return results;
  }

  /**
   * 좌표 유효성 검증
   */
  private isValidCoordinate(coord: {
    latitude: number;
    longitude: number;
  }): boolean {
    const { latitude, longitude } = coord;

    // NaN 체크
    if (isNaN(latitude) || isNaN(longitude)) {
      return false;
    }

    // 위도 범위: -90 ~ 90
    if (latitude < -90 || latitude > 90) {
      return false;
    }

    // 경도 범위: -180 ~ 180
    if (longitude < -180 || longitude > 180) {
      return false;
    }

    return true;
  }

  /**
   * 재시도 로직이 포함된 Fetch 래퍼
   */
  private async fetchWithRetry<T>(
    url: string,
    retries = this.maxRetries
  ): Promise<T> {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            Authorization: `KakaoAK ${this.restApiKey}`,
            'Content-Type': 'application/json',
          },
        });

        clearTimeout(timeoutId);

        // HTTP 상태 코드 체크
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

        if (!response.ok) {
          throw new NetworkError(
            `Kakao Mobility API Error: ${response.status} ${response.statusText}`,
            undefined,
            response.status
          );
        }

        const data: T = await response.json();
        return data;
      } catch (error) {
        // AbortError (타임아웃)
        if (error instanceof Error && error.name === 'AbortError') {
          if (attempt < retries - 1) {
            const delay = Math.pow(2, attempt) * 500; // 500ms, 1000ms
            console.warn(
              `Kakao Mobility API timeout. Retrying in ${delay}ms... (attempt ${attempt + 1}/${retries})`
            );
            await this.sleep(delay);
            continue;
          }
          throw new NetworkError('Kakao Mobility API 요청 시간 초과', error);
        }

        // 네트워크 에러 - 재시도
        if (error instanceof NetworkError) {
          if (attempt < retries - 1) {
            const delay = Math.pow(2, attempt) * 500;
            console.warn(
              `Kakao Mobility API network error. Retrying in ${delay}ms... (attempt ${attempt + 1}/${retries})`
            );
            await this.sleep(delay);
            continue;
          }
          throw error;
        }

        // 기타 에러
        if (error instanceof Error) {
          throw new NetworkError('Kakao Mobility API 호출 실패', error);
        }

        throw new NetworkError('알 수 없는 오류 발생');
      }
    }

    throw new NetworkError('최대 재시도 횟수 초과');
  }

  /**
   * Sleep 유틸리티 (재시도 대기용)
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
