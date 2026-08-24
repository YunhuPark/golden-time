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
 */
export class HospitalRepositoryImpl implements IHospitalRepository {
  private readonly directionsClient: KakaoDirectionsClient;

  constructor(
    private readonly apiClient: EGenApiClient,
    directionsClient?: KakaoDirectionsClient
  ) {
    this.directionsClient = directionsClient || new KakaoDirectionsClient();
  }

  async findNearby(coords: Coordinates, aiContext?: AIAnalysisContext | null): Promise<Hospital[]> {
    try {
      const stage1 = this.inferStage1FromCoords(coords);
      const combinedData = await this.apiClient.getCombinedHospitalData(stage1);
      const hospitals = HospitalMapper.toDomainList(combinedData);

      const MAX_DISTANCE_KM = 100;
      const validHospitals = hospitals.filter((hospital) => {
        if (!hospital.coordinates) return false;

        const distanceKm = hospital.distanceFrom(coords) / 1000;
        if (distanceKm > MAX_DISTANCE_KM) {
          console.warn(
            `⚠️ Filtering out hospital "${hospital.name}" - too far from user (${distanceKm.toFixed(1)}km > ${MAX_DISTANCE_KM}km)`
          );
          return false;
        }
        return true;
      });

      validHospitals.sort((a, b) => a.distanceFrom(coords) - b.distanceFrom(coords));

      console.log(`✅ Found ${validHospitals.length} hospitals with coordinates (filtered by distance < ${MAX_DISTANCE_KM}km)`);

      const rankedHospitals = HospitalRankingService.rankHospitals(validHospitals, aiContext);
      console.log(`✅ Returning ${rankedHospitals.length} hospitals (initially ranked without route info)`);
      return rankedHospitals;
    } catch (error) {
      console.error('Failed to find nearby hospitals:', error);
      // 중요: 빈 배열로 삼키지 않고 상위 계층에 전달해야 HomePage의
      // 최근 성공 병원 캐시 fallback이 실제 API 장애/504 때 동작한다.
      throw error;
    }
  }

  async findByRegion(stage1: string, stage2?: string): Promise<Hospital[]> {
    try {
      const combinedData = await this.apiClient.getCombinedHospitalData(stage1, stage2);
      return HospitalMapper.toDomainList(combinedData);
    } catch (error) {
      console.error('Failed to find hospitals by region:', error);
      return [];
    }
  }

  async findById(id: string): Promise<Hospital | null> {
    try {
      const allRegions = ['서울특별시', '경기도', '인천광역시'];
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

    const routeMap = await this.directionsClient.getBatchRouteInfoConcurrent(
      { latitude: origin.latitude, longitude: origin.longitude },
      destinations,
      3
    );

    return hospitals.map((hospital) => {
      const routeInfo = routeMap.get(hospital.id);
      if (routeInfo) {
        console.log(
          `✅ Route to ${hospital.name}: ${Math.ceil(routeInfo.duration / 60)}분 (${(routeInfo.distance / 1000).toFixed(1)}km)`
        );
        return hospital.withRouteInfo(routeInfo.duration, routeInfo.distance);
      }
      console.warn(`⚠️ Failed to get route info for ${hospital.name}`);
      return hospital;
    });
  }

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
    return this.enrichWithRouteInfo(userLocation, hospitalsToEnrich);
  }

  private inferStage1FromCoords(coords: Coordinates): string {
    const { latitude, longitude } = coords;

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
      return '경상남도';
    } else if (latitude >= 35.4 && latitude <= 36.6 && longitude >= 128.0 && longitude <= 129.4) {
      return '경상북도';
    } else if (latitude >= 35.0 && latitude <= 35.5 && longitude >= 126.4 && longitude <= 127.6) {
      return '전라남도';
    } else if (latitude >= 35.5 && latitude <= 36.0 && longitude >= 126.7 && longitude <= 127.6) {
      return '전라북도';
    } else if (latitude >= 36.2 && latitude <= 36.6 && longitude >= 127.2 && longitude <= 127.6) {
      return '충청남도';
    } else if (latitude >= 36.3 && latitude <= 37.2 && longitude >= 127.3 && longitude <= 128.5) {
      return '충청북도';
    } else if (latitude >= 37.7 && latitude <= 38.6 && longitude >= 127.0 && longitude <= 128.5) {
      return '강원도';
    } else if (latitude >= 33.1 && latitude <= 33.6 && longitude >= 126.1 && longitude <= 126.9) {
      return '제주특별자치도';
    }

    console.warn(`⚠️ 좌표 (${latitude}, ${longitude})에 대한 지역 매칭 실패. 서울로 기본 설정.`);
    return '서울특별시';
  }
}
