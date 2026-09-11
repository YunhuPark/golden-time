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

const ADDRESS_REGION_MARKERS: Array<[string, string]> = [
  ['서울특별시', '서울특별시'],
  ['인천광역시', '인천광역시'],
  ['부산광역시', '부산광역시'],
  ['대구광역시', '대구광역시'],
  ['광주광역시', '광주광역시'],
  ['대전광역시', '대전광역시'],
  ['울산광역시', '울산광역시'],
  ['세종특별자치시', '세종특별자치시'],
  ['경기도', '경기도'],
  ['경상남도', '경상남도'],
  ['경상북도', '경상북도'],
  ['전라남도', '전라남도'],
  ['전북특별자치도', '전북특별자치도'],
  ['전라북도', '전북특별자치도'],
  ['충청남도', '충청남도'],
  ['충청북도', '충청북도'],
  ['강원특별자치도', '강원특별자치도'],
  ['강원도', '강원특별자치도'],
  ['제주특별자치도', '제주특별자치도'],
  ['제주도', '제주특별자치도'],
];

function inferRegionFromHospitalLocation(
  address: string | undefined,
  coords: Coordinates
): string | null {
  const firstToken = address?.trim().split(/\s+/)[0] ?? '';
  for (const [marker, region] of ADDRESS_REGION_MARKERS) {
    if (firstToken.includes(marker)) return region;
  }

  if (firstToken.includes('광주')) return '광주광역시';
  return inferRegionFromCoordinates(coords);
}

export class HospitalRepositoryImpl implements IHospitalRepository {
  private readonly directionsClient: KakaoDirectionsClient;
  private performanceSearchId: number | null = null;

  constructor(
    private readonly apiClient: EGenApiClient,
    directionsClient?: KakaoDirectionsClient
  ) {
    this.directionsClient = directionsClient || new KakaoDirectionsClient();
  }

  async findNearby(
    coords: Coordinates,
    aiContext?: AIAnalysisContext | null,
    onInitialResults?: (hospitals: Hospital[]) => void,
    onCoverageWarning?: (failedRegions: string[], discoveryFailed: boolean) => void
  ): Promise<Hospital[]> {
    try {
      this.performanceSearchId = getActiveHospitalSearchPerformanceId();
      this.apiClient.setPerformanceSearchId(this.performanceSearchId);

      const MAX_DISTANCE_KM = 100;
      const currentRegion = inferRegionFromCoordinates(coords);
      if (!currentRegion) {
        throw new Error(
          `Unsupported GPS coordinates for nationwide emergency search: ${coords.latitude}, ${coords.longitude}`
        );
      }

      const currentRegionPromise = this.apiClient.getCombinedHospitalData(currentRegion);
      const discoveryPromise = this.apiClient.getNearbyEmergencyLocations(
        coords.latitude,
        coords.longitude,
        100
      );

      let currentRegionData: Awaited<ReturnType<EGenApiClient['getCombinedHospitalData']>> = [];
      let currentRegionError: unknown = null;
      try {
        currentRegionData = await currentRegionPromise;
      } catch (error) {
        currentRegionError = error;
        console.warn(`⚠️ Current-region E-Gen search failed for ${currentRegion}; continuing with discovery`, error);
      }

      if (currentRegionData.length > 0 && onInitialResults) {
        const initialHospitals = HospitalMapper.toDomainList(currentRegionData)
          .filter((hospital) => hospital.coordinates && hospital.distanceFrom(coords) / 1000 <= MAX_DISTANCE_KM)
          .sort((a, b) => a.distanceFrom(coords) - b.distanceFrom(coords));
        const initialRanked = HospitalRankingService.rankHospitals(initialHospitals, aiContext);
        if (initialRanked.length > 0) {
          console.log(`⚡ Publishing ${initialRanked.length} current-region hospitals before neighboring-region enrichment`);
          onInitialResults(initialRanked);
        }
      }

      const discoveredRegions = new Set<string>([currentRegion]);
      let discoveryFailed = false;
      try {
        const nearbyLocations = await discoveryPromise;
        for (const location of nearbyLocations) {
          const latitude = Number(location.latitude ?? location.wgs84Lat);
          const longitude = Number(location.longitude ?? location.wgs84Lon);
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

          const hospitalCoords = new Coordinates(latitude, longitude);
          if (hospitalCoords.distanceTo(coords) / 1000 > MAX_DISTANCE_KM) continue;

          const region = inferRegionFromHospitalLocation(location.dutyAddr, hospitalCoords);
          if (region) discoveredRegions.add(region);
        }
      } catch (error) {
        discoveryFailed = true;
        console.warn(
          '⚠️ Coordinate-based E-Gen discovery unavailable; using the current region only',
          error
        );
      }

      const neighboringRegions = Array.from(discoveredRegions).filter((region) => region !== currentRegion);
      console.log(
        `🏥 GPS scoped search regions (${1 + neighboringRegions.length}): ${[currentRegion, ...neighboringRegions].join(', ')}`
      );

      const neighborResults = await Promise.allSettled(
        neighboringRegions.map((region) => this.apiClient.getCombinedHospitalData(region))
      );

      const successfulNeighborCount = neighborResults.filter((result) => result.status === 'fulfilled').length;
      if (currentRegionError && neighboringRegions.length === 0) throw currentRegionError;
      if (currentRegionError && successfulNeighborCount === 0) {
        const firstFailure = neighborResults.find((result) => result.status === 'rejected');
        if (firstFailure?.status === 'rejected') throw firstFailure.reason;
        throw currentRegionError;
      }

      const combinedByHpid = new Map<string, Awaited<ReturnType<EGenApiClient['getCombinedHospitalData']>>[number]>();
      const addItems = (
        items: Awaited<ReturnType<EGenApiClient['getCombinedHospitalData']>>
      ) => {
        for (const item of items) {
          const hpid = item.basicInfo.hpid || item.bedInfo?.hpid;
          if (!hpid) continue;
          const existing = combinedByHpid.get(hpid);
          if (!existing) {
            combinedByHpid.set(hpid, item);
            continue;
          }
          const existingBeds = Number(existing.bedInfo?.hvec ?? 0);
          const incomingBeds = Number(item.bedInfo?.hvec ?? 0);
          const existingHasCoords = Number(existing.basicInfo.wgs84Lat) !== 0 && Number(existing.basicInfo.wgs84Lon) !== 0;
          const incomingHasCoords = Number(item.basicInfo.wgs84Lat) !== 0 && Number(item.basicInfo.wgs84Lon) !== 0;
          if ((!existingHasCoords && incomingHasCoords) || incomingBeds > existingBeds) {
            combinedByHpid.set(hpid, item);
          }
        }
      };

      addItems(currentRegionData);
      neighborResults.forEach((result, index) => {
        const region = neighboringRegions[index];
        if (result.status === 'rejected') {
          console.warn(`⚠️ Regional E-Gen search failed for ${region}; continuing with remaining regions`, result.reason);
          return;
        }
        addItems(result.value);
      });

      const hospitals = HospitalMapper.toDomainList(Array.from(combinedByHpid.values()));
      const validHospitals = hospitals.filter((hospital) =>
        hospital.coordinates && hospital.distanceFrom(coords) / 1000 <= MAX_DISTANCE_KM
      );
      validHospitals.sort((a, b) => a.distanceFrom(coords) - b.distanceFrom(coords));

      const failedRegions: string[] = [];
      if (currentRegionError) failedRegions.push(currentRegion);
      neighborResults.forEach((result, index) => {
        const region = neighboringRegions[index];
        if (result.status === 'rejected' && region) failedRegions.push(region);
      });
      if ((failedRegions.length > 0 || discoveryFailed) && onCoverageWarning) {
        onCoverageWarning(failedRegions, discoveryFailed);
      }

      const successfulRegionCount = (currentRegionError ? 0 : 1) + successfulNeighborCount;
      console.log(
        `✅ Nationwide GPS candidate pool: ${validHospitals.length} hospitals within ${MAX_DISTANCE_KM}km from ${successfulRegionCount}/${1 + neighboringRegions.length} scoped E-Gen searches`
      );

      const rankingStartedAt = performance.now();
      const rankedHospitals = HospitalRankingService.rankHospitals(validHospitals, aiContext);
      if (this.performanceSearchId !== null) {
        recordRankingPerformance(this.performanceSearchId, performance.now() - rankingStartedAt);
      }

      console.log(`✅ Returning ${rankedHospitals.length} hospitals after neighboring-region enrichment`);
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
      console.error(`Failed to find hospital by ID ${id}:`, error);
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
