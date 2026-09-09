import { Hospital } from '../../domain/entities/Hospital';
import { Coordinates } from '../../domain/valueObjects/Coordinates';
import { IHospitalRepository } from '../../domain/repositories/IHospitalRepository';
import { EGenApiClient } from '../datasources/remote/EGenApiClient';
import { HospitalMapper } from '../models/mappers/HospitalMapper';
import { KakaoDirectionsClient } from '../datasources/remote/KakaoDirectionsClient';
import { HospitalRankingService } from '../../domain/services/HospitalRankingService';
import { AIAnalysisContext } from '../../domain/types/AIContext';
import { recordRankingPerformance } from '../../infrastructure/monitoring/searchPerformance';

export class HospitalRepositoryImpl implements IHospitalRepository {
  private readonly directionsClient: KakaoDirectionsClient;

  constructor(
    private readonly apiClient: EGenApiClient,
    directionsClient?: KakaoDirectionsClient,
    private readonly performanceSearchId?: number
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
          console.debug(
            `Filtering out hospital "${hospital.name}" - too far from user (${distanceKm.toFixed(1)}km > ${MAX_DISTANCE_KM}km)`
          );
          return false;
        }
        return true;
      });

      validHospitals.sort((a, b) => a.distanceFrom(coords) - b.distanceFrom(coords));

      console.log(`✅ Found ${validHospitals.length} hospitals with coordinates (filtered by distance < ${MAX_DISTANCE_KM}km)`);

      const rankingStartedAt = performance.now();
      const rankedHospitals = HospitalRankingService.rankHospitals(validHospitals, aiContext);
      if (this.performanceSearchId !== undefined) {
        recordRankingPerformance(
          this.performanceSearchId,
          performance.now() - rankingStartedAt
        );
      }
      console.log(`✅ Returning ${rankedHospitals.length} hospitals (initially ranked without route info)`);
      return rankedHospitals;
    } catch (error) {
      console.error('Failed to find nearby hospitals:', error);
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
      5
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
    } else if (latitude >= 37.3 && latitude <= 37.6 && longitude >= 126.5 && longitude <= 126.8) {
      return '인천광역시';
    } else if (latitude >= 35.0 && latitude <= 35.3 && longitude >= 128.9 && longitude <= 129.2) {
      return '부산광역시';
    } else if (latitude >= 35.75 && latitude <= 36.05 && longitude >= 128.45 && longitude <= 128.75) {
      return '대구광역시';
    } else if (latitude >= 35.05 && latitude <= 35.30 && longitude >= 126.70 && longitude <= 127.05) {
      return '광주광역시';
    } else if (latitude >= 36.20 && latitude <= 36.50 && longitude >= 127.20 && longitude <= 127.60) {
      return '대전광역시';
    } else if (latitude >= 35.35 && latitude <= 35.75 && longitude >= 129.00 && longitude <= 129.50) {
      return '울산광역시';
    } else if (latitude >= 36.45 && latitude <= 36.75 && longitude >= 127.10 && longitude <= 127.45) {
      return '세종특별자치시';
    }

    if (latitude >= 37.0 && latitude <= 38.3 && longitude >= 126.3 && longitude <= 127.9) {
      return '경기도';
    } else if (latitude >= 34.6 && latitude <= 35.7 && longitude >= 127.5 && longitude <= 129.6) {
      return '경상남도';
    } else if (latitude >= 35.5 && latitude <= 37.2 && longitude >= 128.0 && longitude <= 130.0) {
      return '경상북도';
    } else if (latitude >= 34.0 && latitude <= 35.6 && longitude >= 125.8 && longitude <= 127.8) {
      return '전라남도';
    } else if (latitude >= 35.3 && latitude <= 36.2 && longitude >= 126.3 && longitude <= 127.9) {
      return '전북특별자치도';
    } else if (latitude >= 35.9 && latitude <= 37.1 && longitude >= 126.1 && longitude <= 127.7) {
      return '충청남도';
    } else if (latitude >= 36.0 && latitude <= 37.3 && longitude >= 127.3 && longitude <= 129.0) {
      return '충청북도';
    } else if (latitude >= 37.0 && latitude <= 38.7 && longitude >= 127.0 && longitude <= 129.6) {
      return '강원특별자치도';
    } else if (latitude >= 33.1 && latitude <= 33.7 && longitude >= 126.0 && longitude <= 127.0) {
      return '제주특별자치도';
    }

    console.warn(`⚠️ 좌표 (${latitude}, ${longitude})에 대한 지역 매칭 실패. 서울로 기본 설정.`);
    return '서울특별시';
  }
}
