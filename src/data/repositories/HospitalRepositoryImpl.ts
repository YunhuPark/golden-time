import { Hospital } from '../../domain/entities/Hospital';
import { Coordinates } from '../../domain/valueObjects/Coordinates';
import { IHospitalRepository } from '../../domain/repositories/IHospitalRepository';
import { EGenApiClient } from '../datasources/remote/EGenApiClient';
import { HospitalMapper } from '../models/mappers/HospitalMapper';
import { KakaoDirectionsClient } from '../datasources/remote/KakaoDirectionsClient';
import { HospitalRankingService } from '../../domain/services/HospitalRankingService';
import { inferRegionFromCoordinates } from '../../domain/services/RegionResolver';
import { AIAnalysisContext } from '../../domain/types/AIContext';
import {
  getActiveHospitalSearchPerformanceId,
  recordRankingPerformance,
  recordRouteEnrichmentPerformance,
  startRouteEnrichmentPerformance,
} from '../../infrastructure/monitoring/searchPerformance';

export class HospitalRepositoryImpl implements IHospitalRepository {
  private readonly directionsClient: KakaoDirectionsClient;
  private performanceSearchId: number | null = null;

  constructor(
    private readonly apiClient: EGenApiClient,
    directionsClient?: KakaoDirectionsClient
  ) {
    this.directionsClient = directionsClient || new KakaoDirectionsClient();
  }

  async findNearby(coords: Coordinates, aiContext?: AIAnalysisContext | null): Promise<Hospital[]> {
    try {
      this.performanceSearchId = getActiveHospitalSearchPerformanceId();
      this.apiClient.setPerformanceSearchId(this.performanceSearchId);

      const inferredRegion = inferRegionFromCoordinates(coords);
      const stage1 = inferredRegion ?? '서울특별시';
      if (!inferredRegion) {
        console.warn(`⚠️ 좌표 (${coords.latitude}, ${coords.longitude})에 대한 지역 매칭 실패. 서울로 기본 설정.`);
      }

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
      if (this.performanceSearchId !== null) {
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
    startRouteEnrichmentPerformance(this.performanceSearchId);
    const enriched = await this.enrichWithRouteInfo(userLocation, hospitalsToEnrich);
    recordRouteEnrichmentPerformance(
      this.performanceSearchId,
      enriched.filter((hospital) => hospital.routeDuration !== undefined).length
    );
    return enriched;
  }
}
