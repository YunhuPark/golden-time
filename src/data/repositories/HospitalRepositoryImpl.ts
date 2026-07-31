import { Hospital } from '../../domain/entities/Hospital';
import { Coordinates } from '../../domain/valueObjects/Coordinates';
import { IHospitalRepository } from '../../domain/repositories/IHospitalRepository';
import { EGenApiClient } from '../datasources/remote/EGenApiClient';
import { HospitalMapper } from '../models/mappers/HospitalMapper';
import { KakaoDirectionsClient } from '../datasources/remote/KakaoDirectionsClient';
import { HospitalRankingService } from '../../domain/services/HospitalRankingService';
import { AIAnalysisContext } from '../../domain/types/AIContext';

/**
 * Hospital Repository Implementation
 * Domain Layer의 IHospitalRepository 인터페이스 구현
 *
 * 역할:
 * - EGenApiClient를 사용한 데이터 페칭
 * - DTO → Domain Entity 변환
 * - 거리 기반 필터링
 * - 캐싱 전략 (향후 추가 예정)
 */
export class HospitalRepositoryImpl implements IHospitalRepository {
  private readonly directionsClient: KakaoDirectionsClient;

  constructor(
    private readonly apiClient: EGenApiClient,
    directionsClient?: KakaoDirectionsClient
  ) {
    this.directionsClient = directionsClient || new KakaoDirectionsClient();
  }

  /**
   * 특정 좌표 주변의 병원 검색
   */
  async findNearby(coords: Coordinates, aiContext?: AIAnalysisContext | null): Promise<Hospital[]> {
    try {
      // 좌표를 기반으로 시도/시군구 추론 (간단히 서울 가정, 향후 역지오코딩 API 사용)
      // TODO: Kakao Local API로 좌표 → 행정구역 변환
      const stage1 = this.inferStage1FromCoords(coords);

      // API에서 해당 지역 병원 데이터 가져오기
      const combinedData = await this.apiClient.getCombinedHospitalData(stage1);

      // DTO → Domain Entity 변환
      const hospitals = HospitalMapper.toDomainList(combinedData);

      // 좌표가 있는 병원만 필터링 + 사용자 위치에서 너무 먼 병원 제외
      const MAX_DISTANCE_KM = 100; // 100km 이상 떨어진 병원은 잘못된 geocoding으로 간주
      const validHospitals = hospitals.filter((hospital) => {
        if (!hospital.coordinates) {
          return false;
        }

        // 거리 검증: 너무 먼 병원은 제외 (geocoding 오류 필터링)
        const distanceKm = hospital.distanceFrom(coords) / 1000;
        if (distanceKm > MAX_DISTANCE_KM) {
          console.warn(
            `⚠️ Filtering out hospital "${hospital.name}" - too far from user (${distanceKm.toFixed(1)}km > ${MAX_DISTANCE_KM}km)`
          );
          return false;
        }

        return true;
      });

      // 거리순 정렬 (가까운 순)
      validHospitals.sort((a, b) => {
        const distA = a.distanceFrom(coords);
        const distB = b.distanceFrom(coords);
        return distA - distB;
      });

      console.log(`✅ Found ${validHospitals.length} hospitals with coordinates (filtered by distance < ${MAX_DISTANCE_KM}km)`);

      // 1. 경로 정보 없이 초기 점수 기반 정렬 (빠른 렌더링을 위함)
      // 초기에는 직선 거리를 fallback으로 사용하거나 점수 계산에서 경로가 없는 것으로 간주됨
      const rankedHospitals = HospitalRankingService.rankHospitals(validHospitals, aiContext);

      console.log(`✅ Returning ${rankedHospitals.length} hospitals (initially ranked without route info)`);

      return rankedHospitals;

    } catch (error) {
      console.error('Failed to find nearby hospitals:', error);
      // 에러 발생 시 빈 배열 반환 (UI에서 처리)
      return [];
    }
  }

  /**
   * 특정 지역(시도, 시군구)의 병원 검색
   */
  async findByRegion(stage1: string, stage2?: string): Promise<Hospital[]> {
    try {
      const combinedData = await this.apiClient.getCombinedHospitalData(stage1, stage2);
      return HospitalMapper.toDomainList(combinedData);
    } catch (error) {
      console.error('Failed to find hospitals by region:', error);
      return [];
    }
  }

  /**
   * 특정 ID의 병원 조회
   */
  async findById(id: string): Promise<Hospital | null> {
    try {
      // 전체 병원 목록에서 검색 (비효율적이지만 API 제약상 불가피)
      // TODO: 캐싱 레이어 추가하여 성능 개선
      const allRegions = ['서울특별시', '경기도', '인천광역시']; // 확장 가능

      for (const region of allRegions) {
        const combinedData = await this.apiClient.getCombinedHospitalData(region);
        const hospitals = HospitalMapper.toDomainList(combinedData);
        const found = hospitals.find((h) => h.id === id);
        if (found) return found;
      }

      return null;
    } catch (error) {
      console.error(`Failed to find hospital by ID: ${id}`, error);
      return null;
    }
  }

  /**
   * 병원 목록에 경로 정보 추가
   *
   * @param origin 출발지 좌표
   * @param hospitals 병원 목록
   * @returns 경로 정보가 추가된 병원 목록
   */
  private async enrichWithRouteInfo(
    origin: Coordinates,
    hospitals: Hospital[]
  ): Promise<Hospital[]> {
    console.log(`🚗 Calculating route info for ${hospitals.length} hospitals (concurrent batch)...`);

    const destinations = hospitals.map(h => ({
      id: h.id,
      latitude: h.coordinates.latitude,
      longitude: h.coordinates.longitude,
    }));

    // getBatchRouteInfoConcurrent 호출 (최대 3개 동시)
    const routeMap = await this.directionsClient.getBatchRouteInfoConcurrent(
      { latitude: origin.latitude, longitude: origin.longitude },
      destinations,
      3
    );

    // 결과 매핑 (ID 기반)
    const enrichedHospitals = hospitals.map((hospital) => {
      const routeInfo = routeMap.get(hospital.id);
      if (routeInfo) {
        console.log(
          `✅ Route to ${hospital.name}: ${Math.ceil(routeInfo.duration / 60)}분 (${(routeInfo.distance / 1000).toFixed(1)}km)`
        );
        return hospital.withRouteInfo(routeInfo.duration, routeInfo.distance);
      } else {
        console.warn(`⚠️ Failed to get route info for ${hospital.name}`);
        // UI에서 실패를 알 수 있도록 실패 상태만 반환 (현재 Hospital 객체 그대로 유지하되, UI 상태는 컴포넌트나 상위에서 관리)
        return hospital;
      }
    });

    return enrichedHospitals;
  }

  /**
   * 추가 병원들의 경로 정보 계산
   *
   * @param userLocation 사용자 위치
   * @param hospitals 전체 병원 목록
   * @param fromIndex 시작 인덱스 (이미 로드된 개수)
   * @param count 추가로 로드할 개수 (기본 10개)
   * @returns 경로 정보가 추가된 병원 목록
   */
  async loadMoreRouteInfo(
    userLocation: Coordinates,
    hospitals: Hospital[],
    fromIndex: number,
    count: number = 10
  ): Promise<Hospital[]> {
    const hospitalsToEnrich = hospitals.slice(fromIndex, fromIndex + count);

    if (hospitalsToEnrich.length === 0) {
      console.log('No more hospitals to load route info for');
      return [];
    }

    console.log(`🚗 Loading route info for hospitals ${fromIndex + 1}~${fromIndex + hospitalsToEnrich.length}...`);

    const enrichedHospitals = await this.enrichWithRouteInfo(
      userLocation,
      hospitalsToEnrich
    );

    return enrichedHospitals;
  }

  /**
   * 좌표로부터 시도 추론 (간단한 구현)
   * TODO: 실제로는 Kakao Local API의 역지오코딩 사용 권장
   */
  private inferStage1FromCoords(coords: Coordinates): string {
    const { latitude, longitude } = coords;

    // 간단한 바운딩 박스 기반 추론
    if (latitude >= 37.4 && latitude <= 37.7 && longitude >= 126.7 && longitude <= 127.2) {
      return '서울특별시';
    } else if (latitude >= 37.2 && latitude <= 37.9 && longitude >= 126.4 && longitude <= 127.9) {
      return '경기도';
    } else if (latitude >= 37.3 && latitude <= 37.6 && longitude >= 126.5 && longitude <= 126.8) {
      return '인천광역시';
    } else if (latitude >= 35.0 && latitude <= 35.3 && longitude >= 128.9 && longitude <= 129.2) {
      return '부산광역시';
    } else if (latitude >= 35.8 && latitude <= 36.0 && longitude >= 128.5 && longitude <= 128.7) {
      return '대구광역시';
    } else if (latitude >= 35.0 && latitude <= 35.4 && longitude >= 127.9 && longitude <= 129.0) {
      return '경상남도'; // 창원, 진주, 마산 등
    } else if (latitude >= 35.4 && latitude <= 36.6 && longitude >= 128.0 && longitude <= 129.4) {
      return '경상북도'; // 경주, 포항, 안동 등
    } else if (latitude >= 35.0 && latitude <= 35.5 && longitude >= 126.4 && longitude <= 127.6) {
      return '전라남도'; // 목포, 여수, 순천 등
    } else if (latitude >= 35.5 && latitude <= 36.0 && longitude >= 126.7 && longitude <= 127.6) {
      return '전라북도'; // 전주, 익산, 군산 등
    } else if (latitude >= 36.2 && latitude <= 36.6 && longitude >= 127.2 && longitude <= 127.6) {
      return '충청남도'; // 천안, 아산 등
    } else if (latitude >= 36.3 && latitude <= 37.2 && longitude >= 127.3 && longitude <= 128.5) {
      return '충청북도'; // 청주, 충주 등
    } else if (latitude >= 37.7 && latitude <= 38.6 && longitude >= 127.0 && longitude <= 128.5) {
      return '강원도'; // 춘천, 강릉, 원주 등
    } else if (latitude >= 33.1 && latitude <= 33.6 && longitude >= 126.1 && longitude <= 126.9) {
      return '제주특별자치도';
    }

    // 기본값: 가장 가까운 대도시
    console.warn(`⚠️ 좌표 (${latitude}, ${longitude})에 대한 지역 매칭 실패. 서울로 기본 설정.`);
    return '서울특별시';
  }
}
