import { NetworkError } from '../../../infrastructure/errors/AppError';

/**
 * Kakao Local API - Address Search (주소 검색)
 * 주소 문자열을 WGS84 좌표로 변환
 *
 * API Docs: https://developers.kakao.com/docs/latest/ko/local/dev-guide#address-coord
 *
 * Ironclad Law #2: Anti-Hallucination
 * - Kakao REST API 실제 응답 구조만 사용
 *
 * Ironclad Law #3: Edge Case Obsession
 * - 주소 없음, 다중 결과, 네트워크 실패 모두 처리
 */

/**
 * Kakao Geocoding API 응답 (Address Search)
 */
export interface KakaoAddressSearchResponse {
  meta: {
    total_count: number;
    pageable_count: number;
    is_end: boolean;
  };
  documents: Array<{
    address_name: string;
    address_type: 'REGION' | 'ROAD' | 'REGION_ADDR' | 'ROAD_ADDR';
    x: string; // 경도 (longitude)
    y: string; // 위도 (latitude)
    address: {
      address_name: string;
      region_1depth_name: string;
      region_2depth_name: string;
      region_3depth_name: string;
      mountain_yn: 'Y' | 'N';
      main_address_no: string;
      sub_address_no: string;
      zip_code?: string;
    } | null;
    road_address: {
      address_name: string;
      region_1depth_name: string;
      region_2depth_name: string;
      region_3depth_name: string;
      road_name: string;
      underground_yn: 'Y' | 'N';
      main_building_no: string;
      sub_building_no: string;
      building_name: string;
      zone_no: string;
    } | null;
  }>;
}

/**
 * Kakao Local API 응답 (Keyword Search)
 */
export interface KakaoKeywordSearchResponse {
  meta: {
    total_count: number;
    pageable_count: number;
    is_end: boolean;
    same_name?: {
      region: string[];
      keyword: string;
      selected_region: string;
    };
  };
  documents: Array<{
    id: string;
    place_name: string; // 장소명 (병원 이름)
    category_name: string; // 카테고리 (예: "의료,병원 > 병원 > 종합병원")
    category_group_code: string; // 카테고리 그룹 코드
    category_group_name: string; // 카테고리 그룹명
    phone: string; // 전화번호
    address_name: string; // 지번 주소
    road_address_name: string; // 도로명 주소
    x: string; // 경도 (longitude)
    y: string; // 위도 (latitude)
    place_url: string; // Kakao Map 장소 URL
    distance?: string; // 중심 좌표로부터의 거리 (meter)
  }>;
}

/**
 * Kakao Geocoding API 클라이언트
 * 주소 → 좌표 변환 전용
 */
export class KakaoGeocodingClient {
  private readonly baseUrl = 'https://dapi.kakao.com/v2/local';
  private readonly restApiKey: string;
  private readonly timeout: number;
  private readonly maxRetries: number;

  constructor(
    restApiKey = import.meta.env['VITE_KAKAO_REST_API_KEY'] || '',
    timeout = 5000,
    maxRetries = 2
  ) {
    this.restApiKey = restApiKey;
    this.timeout = timeout;
    this.maxRetries = maxRetries;

    if (!this.restApiKey) {
      console.warn(
        '⚠️ WARNING: VITE_KAKAO_REST_API_KEY not found. Geocoding will fail.'
      );
    } else {
      console.log('✅ Kakao REST API Key loaded successfully');
    }
  }

  /**
   * 주소 문자열 → WGS84 좌표 변환
   *
   * @param address 주소 (예: "서울특별시 강남구 테헤란로 212")
   * @returns { latitude, longitude } 또는 null (변환 실패 시)
   *
   * Edge Cases:
   * - 주소가 비어있거나 null인 경우
   * - 검색 결과가 없는 경우 (API meta.total_count === 0)
   * - 여러 결과가 있는 경우 (첫 번째 결과 선택)
   * - 네트워크 에러
   */
  async addressToCoordinates(
    address: string
  ): Promise<{ latitude: number; longitude: number } | null> {
    // 주소 검증
    if (!address || address.trim().length === 0) {
      console.warn('addressToCoordinates: Empty address');
      return null;
    }

    // "정보 없음", "미제공" 등 유효하지 않은 주소 필터링
    if (
      address.includes('정보 없음') ||
      address.includes('미제공') ||
      address.includes('상세 주소 없음')
    ) {
      console.warn(`addressToCoordinates: Invalid address pattern: ${address}`);
      return null;
    }

    const endpoint = '/search/address.json';
    const url = new URL(this.baseUrl + endpoint);
    url.searchParams.set('query', address);

    try {
      const response = await this.fetchWithRetry<KakaoAddressSearchResponse>(
        url.toString()
      );

      // 검색 결과 없음
      if (!response.documents || response.documents.length === 0) {
        console.warn(`addressToCoordinates: No results for "${address}"`);
        return null;
      }

      // 첫 번째 결과 사용 (가장 정확도 높은 결과)
      const firstResult = response.documents[0];
      if (!firstResult) {
        console.warn(`addressToCoordinates: First result is undefined for "${address}"`);
        return null;
      }

      const latitude = parseFloat(firstResult.y);
      const longitude = parseFloat(firstResult.x);

      // 유효성 검증
      if (isNaN(latitude) || isNaN(longitude)) {
        console.error(
          `addressToCoordinates: Invalid coordinates in response:`,
          firstResult
        );
        return null;
      }

      // 한국 내 좌표 범위 체크
      if (
        latitude < 33 ||
        latitude > 39 ||
        longitude < 124 ||
        longitude > 132
      ) {
        console.warn(
          `addressToCoordinates: Coordinates out of bounds for "${address}": (${latitude}, ${longitude})`
        );
        return null;
      }

      return { latitude, longitude };
    } catch (error) {
      console.error(`addressToCoordinates failed for "${address}":`, error);
      return null;
    }
  }

  /**
   * 키워드 검색 → WGS84 좌표 변환 (병원 이름 검색용)
   *
   * @param keyword 검색 키워드 (예: "강릉아산병원")
   * @param region 지역명 (선택, 예: "강원도") - 검색 정확도 향상
   * @returns { latitude, longitude, address } 또는 null (검색 실패 시)
   *
   * Edge Cases:
   * - 키워드가 비어있거나 null인 경우
   * - 검색 결과가 없는 경우
   * - 여러 결과가 있는 경우 (첫 번째 결과 선택)
   * - 네트워크 에러
   */
  async keywordToCoordinates(
    keyword: string,
    region?: string
  ): Promise<{ latitude: number; longitude: number; address: string } | null> {
    // 키워드 검증
    if (!keyword || keyword.trim().length === 0) {
      console.warn('keywordToCoordinates: Empty keyword');
      return null;
    }

    // "정보 없음", "미제공" 등 유효하지 않은 키워드 필터링
    if (
      keyword.includes('정보 없음') ||
      keyword.includes('미제공') ||
      keyword.includes('병원명 없음')
    ) {
      console.warn(`keywordToCoordinates: Invalid keyword pattern: ${keyword}`);
      return null;
    }

    const endpoint = '/search/keyword.json';
    const url = new URL(this.baseUrl + endpoint);

    // 검색 정확도 향상: "키워드 + 지역" 조합
    const searchQuery = region ? `${keyword} ${region}` : keyword;
    url.searchParams.set('query', searchQuery);
    url.searchParams.set('category_group_code', 'HP8'); // HP8 = 병원 카테고리

    try {
      const response = await this.fetchWithRetry<KakaoKeywordSearchResponse>(
        url.toString()
      );

      // 검색 결과 없음
      if (!response.documents || response.documents.length === 0) {
        console.warn(`keywordToCoordinates: No results for "${searchQuery}"`);
        return null;
      }

      // 첫 번째 결과 사용 (가장 관련도 높은 결과)
      const firstResult = response.documents[0];
      if (!firstResult) {
        console.warn(`keywordToCoordinates: First result is undefined for "${searchQuery}"`);
        return null;
      }

      const latitude = parseFloat(firstResult.y);
      const longitude = parseFloat(firstResult.x);

      // 유효성 검증
      if (isNaN(latitude) || isNaN(longitude)) {
        console.error(
          `keywordToCoordinates: Invalid coordinates in response:`,
          firstResult
        );
        return null;
      }

      // 한국 내 좌표 범위 체크
      if (
        latitude < 33 ||
        latitude > 39 ||
        longitude < 124 ||
        longitude > 132
      ) {
        console.warn(
          `keywordToCoordinates: Coordinates out of bounds for "${searchQuery}": (${latitude}, ${longitude})`
        );
        return null;
      }

      console.log(`✅ Geocoded "${keyword}" → (${latitude}, ${longitude})`);

      return {
        latitude,
        longitude,
        address: firstResult?.road_address_name || firstResult?.address_name || '',
      };
    } catch (error) {
      console.error(`keywordToCoordinates failed for "${searchQuery}":`, error);
      return null;
    }
  }

  /**
   * 여러 주소를 배치로 좌표 변환 (순차 처리, Rate Limit 고려)
   *
   * @param addresses 주소 배열
   * @param delayMs 각 요청 사이 대기 시간 (기본 100ms)
   * @returns Map<주소, 좌표>
   *
   * Edge Cases:
   * - 일부 주소만 성공하는 경우 (부분 성공)
   * - Rate Limit 초과 방지 (요청 간 지연)
   */
  async batchAddressToCoordinates(
    addresses: string[],
    delayMs = 100
  ): Promise<Map<string, { latitude: number; longitude: number }>> {
    const results = new Map<
      string,
      { latitude: number; longitude: number }
    >();

    for (const address of addresses) {
      const coords = await this.addressToCoordinates(address);
      if (coords) {
        results.set(address, coords);
      }

      // Rate Limit 방지를 위한 지연
      if (delayMs > 0) {
        await this.sleep(delayMs);
      }
    }

    return results;
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
            'Kakao API Rate Limit 초과. 잠시 후 다시 시도해주세요.',
            undefined,
            429
          );
        }

        if (response.status === 401 || response.status === 403) {
          throw new NetworkError(
            'Kakao API 인증 실패. API 키를 확인해주세요.',
            undefined,
            response.status
          );
        }

        if (!response.ok) {
          throw new NetworkError(
            `Kakao API Error: ${response.status} ${response.statusText}`,
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
              `Kakao API timeout. Retrying in ${delay}ms... (attempt ${attempt + 1}/${retries})`
            );
            await this.sleep(delay);
            continue;
          }
          throw new NetworkError('Kakao API 요청 시간 초과', error);
        }

        // 네트워크 에러 - 재시도
        if (error instanceof NetworkError) {
          if (attempt < retries - 1) {
            const delay = Math.pow(2, attempt) * 500;
            console.warn(
              `Kakao API network error. Retrying in ${delay}ms... (attempt ${attempt + 1}/${retries})`
            );
            await this.sleep(delay);
            continue;
          }
          throw error;
        }

        // 기타 에러
        if (error instanceof Error) {
          throw new NetworkError('Kakao API 호출 실패', error);
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
