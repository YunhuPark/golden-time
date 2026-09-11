import { Hospital } from '../../domain/entities/Hospital';
import { Coordinates } from '../../domain/valueObjects/Coordinates';
import { IHospitalRepository } from '../../domain/repositories/IHospitalRepository';
import { EGenApiClient } from '../datasources/remote/EGenApiClient';
import { HospitalMapper } from '../models/mappers/HospitalMapper';
import { KakaoDirectionsClient } from '../datasources/remote/KakaoDirectionsClient';
import { HospitalRankingService } from '../../domain/services/HospitalRankingService';
import { getRegionsWithinRadius, inferRegionFromCoordinates } from '../../domain/services/RegionResolver';
import { AIAnalysisContext } from '../../domain/types/AIContext';
import {
  getActiveHospitalSearchPerformanceId,
  recordRankingPerformance,
  recordRouteEnrichmentPerformance,
  startRouteEnrichmentPerformance,
} from '../../infrastructure/monitoring/searchPerformance';

const MAX_DISTANCE_KM = 100;

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

      const regions = getRegionsWithinRadius(coords, MAX_DISTANCE_KM);
      if (regions.length === 0) {
        throw new Error(
          `No supported E-Gen region intersects ${MAX_DISTANCE_KM}km around (${coords.latitude}, ${coords.longitude})`
        );
      }

      console.log(`🗺️ Searching E-Gen regions within ${MAX_DISTANCE_KM}km: ${regions.join(', ')}`);

      // Administrative borders must not hide a closer emergency room. Query every
      // first-level region that can intersect the radius, while tolerating a partial
      // regional outage as long as at least one E-Gen region succeeds.
      const regionalResults = await Promise.allSettled(
        regions.map(async (region) => ({
          region,
          data: await this.apiClient.getCombinedHospitalData(region),
        }))
      );

      const fulfilled = regionalResults.filter(
        (result): result is PromiseFulfilledResult<{ region: string; data: Awaited<ReturnType<EGenApiClient['getCombinedHospitalData']>> }> =>
          result.status === 'fulfilled'
      );

      for (const result of regionalResults) {
        if (result.status === 'rejected') {
          console.warn('⚠️ One regional E-Gen lookup failed during nationwide radius search', result.reason);
        }
      }

      if (fulfilled.length === 0) {
        const firstFailure = regionalResults.find(
          (result): result is PromiseRejectedResult => result.status === 'rejected'
        );
        throw firstFailure?.reason ?? new Error('All regional E-Gen lookups failed');
      }

      // A hospital can appear in more than one regional response near a boundary.
      // Keep one canonical HPID record before mapping/ranking.
      const combinedByHpid = new Map<
        string,
        Awaited<ReturnType<EGenApiClient['getCombinedHospitalData']>>[number]
      >();

      for (const { data } of fulfilled.map((result) => result.value)) {
        for (const item of data) {
          const hpid = item.basicInfo.hpid || item.bedInfo?.hpid;
          if (!hpid) continue;
          if (!combinedByHpid.has(hpid)) {
            combinedByHpid.set(hpid, item);
          }
        }
      }

      const hospitals = HospitalMapper.toDomainList(Array.from(combinedByHpid.values()));

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
      console.log(
        `✅ Found ${validHospitals.length} unique hospitals across ${fulfilled.length}/${regions.length} E-Gen regions within ${MAX_DISTANCE_KM}km`
      );

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
      const basicInfo = await this.apiClient.getHospitalBasicInfoById(id);
      if (!basicInfo || basicInfo.hpid !== id) return null;

      let bedInfo;
      const latitude = Number(basicInfo.wgs84Lat);
      const longitude = Number(basicInfo.wgs84Lon);

      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        try {
          const region = inferRegionFromCoordinates(new Coordinates(latitude, longitude));
          if (region) {
            const beds = await this.apiClient.getEmergencyRoomBeds(region, undefined, 100);
            bedInfo = beds.find((bed) => bed.hpid === id);
          }
        } catch (error) {
          console.warn(`Could not enrich hospital ${id} with realtime beds`, error);
        }
      }

      return HospitalMapper.toDomain({ basicInfo, bedInfo });
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
