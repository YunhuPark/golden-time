/**
 * Kakao Maps JavaScript SDK - Places 서비스 클라이언트
 *
 * REST API 대신 Kakao Maps SDK의 services.Places를 사용하여
 * 브라우저에서 직접 병원 검색을 수행합니다.
 *
 * 장점:
 * - REST API 키 불필요 (JavaScript 키만 사용)
 * - 플랫폼 설정 불필요
 * - CORS 이슈 없음
 */

// Kakao Maps SDK 타입은 kakao.maps.d.ts에 정의되어 있음
// 이 파일에서는 서비스만 추가로 any로 정의

declare global {
  interface Window {
    kakaoSDKReady?: Promise<boolean>;
  }
}

export class KakaoPlacesClient {
  private placesService: any;
  private initPromise: Promise<void>;

  constructor() {
    // SDK 로딩을 기다리는 Promise 생성
    this.initPromise = this.waitForKakaoSDK();
  }

  /**
   * Kakao Maps SDK가 로드될 때까지 대기
   */
  private async waitForKakaoSDK(): Promise<void> {
    // 서버 사이드 렌더링 환경에서는 스킵
    if (typeof window === 'undefined') {
      console.warn('⚠️ Running in SSR environment, skipping Kakao SDK initialization');
      return;
    }

    // index.html에서 설정한 전역 SDK ready promise를 기다림
    if (window.kakaoSDKReady) {
      console.log('⏳ Waiting for global Kakao SDK ready promise...');
      const isReady = await window.kakaoSDKReady;

      if (!isReady) {
        console.error('❌ Kakao SDK failed to load (from global promise)');
        return;
      }
    }

    // SDK가 정상적으로 로드되었는지 확인
    if (window.kakao && window.kakao.maps && window.kakao.maps.services) {
      this.placesService = new window.kakao.maps.services.Places();
      console.log('✅ Kakao Places Service initialized successfully');
      return;
    }

    // Fallback: 전역 promise가 없는 경우 폴링 방식으로 대기
    console.warn('⚠️ Global kakaoSDKReady not found, falling back to polling...');
    const maxWaitTime = 5000;
    const checkInterval = 100;
    let waited = 0;

    return new Promise((resolve) => {
      const checkSDK = setInterval(() => {
        if (window.kakao && window.kakao.maps && window.kakao.maps.services) {
          clearInterval(checkSDK);
          this.placesService = new window.kakao.maps.services.Places();
          console.log('✅ Kakao Places Service initialized successfully (after polling)');
          resolve();
        } else if (waited >= maxWaitTime) {
          clearInterval(checkSDK);
          console.error('❌ Kakao Maps SDK failed to load within timeout (5 seconds)');
          console.error('   Please check:');
          console.error('   1. Network tab for failed script requests');
          console.error('   2. Console for CSP violations');
          console.error('   3. Kakao JavaScript key is correct');
          resolve(); // 실패해도 resolve (null 반환하도록)
        } else {
          waited += checkInterval;
        }
      }, checkInterval);
    });
  }

  /**
   * 키워드 검색 → 좌표 변환 (병원 이름 검색용)
   *
   * @param keyword 검색 키워드 (예: "강릉아산병원")
   * @param region 지역명 (선택, 예: "강원도")
   * @param userLocation 사용자 위치 (거리 검증용, 선택)
   * @returns Promise<{ latitude, longitude, address } | null>
   */
  async keywordToCoordinates(
    keyword: string,
    region?: string,
    userLocation?: { latitude: number; longitude: number }
  ): Promise<{ latitude: number; longitude: number; address: string } | null> {
    // SDK 로딩이 완료될 때까지 대기
    await this.initPromise;

    if (!this.placesService) {
      console.error('Kakao Places Service not initialized');
      return null;
    }

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

    // 병원명 정제: 특수문자 제거, 띄어쓰기 정리
    const cleanKeyword = keyword
      .replace(/\s+/g, ' ') // 연속된 공백을 하나로
      .trim();

    // 검색 전략 1: 정제된 병원명 + 지역
    const searchQuery1 = region ? `${cleanKeyword} ${region}` : cleanKeyword;

    // 검색 전략 2: 원본 병원명 + 지역
    const searchQuery2 = region ? `${keyword} ${region}` : keyword;

    // 검색 전략 3: 정제된 병원명만
    const searchQuery3 = cleanKeyword;

    // 1차 시도: 정제된 병원명 + 지역
    const result1 = await this.performSearch(searchQuery1, keyword, userLocation);
    if (result1) return result1;

    // 2차 시도: 원본 병원명 + 지역
    if (region) {
      const result2 = await this.performSearch(searchQuery2, keyword, userLocation);
      if (result2) return result2;
    }

    // 3차 시도: 정제된 병원명만
    const result3 = await this.performSearch(searchQuery3, keyword, userLocation);
    if (result3) return result3;

    console.warn(`❌ Failed to geocode "${keyword}" after 3 attempts`);
    return null;
  }

  /**
   * 실제 검색 수행 (내부 헬퍼)
   */
  private performSearch(
    searchQuery: string,
    originalKeyword: string,
    userLocation?: { latitude: number; longitude: number }
  ): Promise<{ latitude: number; longitude: number; address: string } | null> {
    return new Promise((resolve) => {
      // Kakao Places 키워드 검색
      this.placesService.keywordSearch(
        searchQuery,
        (result: any[], status: any) => {
          // 검색 실패
          if (status !== window.kakao.maps.services.Status.OK || !result || result.length === 0) {
            resolve(null);
            return;
          }

          // 병원 카테고리 필터링 (HP8: 병원)
          const hospitals = result.filter((place: any) =>
            place.category_group_code === 'HP8' ||
            place.category_name?.includes('병원') ||
            place.category_name?.includes('의료')
          );

          const firstResult = hospitals.length > 0 ? hospitals[0] : result[0];

          const latitude = parseFloat(firstResult.y);
          const longitude = parseFloat(firstResult.x);

          // 유효성 검증
          if (isNaN(latitude) || isNaN(longitude)) {
            console.error('keywordToCoordinates: Invalid coordinates in response:', firstResult);
            resolve(null);
            return;
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
            resolve(null);
            return;
          }

          // 사용자 위치 기반 거리 검증 (너무 먼 결과 필터링)
          if (userLocation) {
            const distance = this.calculateDistance(
              userLocation.latitude,
              userLocation.longitude,
              latitude,
              longitude
            );

            // 100km 이상 떨어진 결과는 무시 (잘못된 매칭으로 간주)
            const MAX_DISTANCE_KM = 100;
            if (distance > MAX_DISTANCE_KM) {
              console.warn(
                `⚠️ Geocoded result too far from user location for "${originalKeyword}": ${distance.toFixed(1)}km > ${MAX_DISTANCE_KM}km`
              );
              resolve(null);
              return;
            }
          }

          console.log(`✅ Geocoded "${originalKeyword}" → (${latitude}, ${longitude})`);

          resolve({
            latitude,
            longitude,
            address: firstResult.road_address_name || firstResult.address_name || '주소 정보 없음',
          });
        },
        {
          // 검색 옵션: 카테고리 필터 제거하여 검색 범위 확대
          size: 15, // 검색 결과 최대 15개로 증가
        }
      );
    });
  }

  /**
   * Haversine 공식을 사용한 두 좌표 간 거리 계산 (km)
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // 지구 반경 (km)
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
