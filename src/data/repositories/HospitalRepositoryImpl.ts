import { Hospital } from '../../domain/entities/Hospital';
import { Coordinates } from '../../domain/valueObjects/Coordinates';
import {
  IHospitalRepository,
  NearbyHospitalProgressCallback,
} from '../../domain/repositories/IHospitalRepository';
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
    onInitialResults?: NearbyHospitalProgressCallback
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

      // Start coordinate discovery immediately, but do not let it block the first
      // useful screen. Current-region realtime data is requested in parallel and
      // emitted as soon as it is available.
      const discoveryPromise = this.apiClient
        .getNearbyEmergencyLocations(coords.latitude, coords.longitude, 100)
        .catch((error) => {
          console.warn(
            '⚠️ Coordinate-based E-Gen discovery unavailable; falling back to the current region only',
            error
          );
          return [];
        });

      let currentRegionData: Awaited<ReturnType<EGenApiClient['getCombinedHospitalData']>> = [];
      let currentRegionError: unknown = null;
      try {
        currentRegionData = await this.apiClient.getCombinedHospitalData(currentRegion);

        const initialHospitals = this.rankAndFilter(
          HospitalMapper.toDomainList(currentRegionData),
          coords,
          aiContext,
          MAX_DISTANCE_KM
        );

        if (initialHospitals.length > 0 && onInitialResults) {
          await onInitialResults(initialHospitals);
          console.log(`⚡ Emitted ${initialHospitals.length} current-region hospitals before nationwide merge`);
        }
      } catch (error) {
        currentRegionError = error;
        console.warn(`⚠️ Current-region E-Gen search failed for ${currentRegion}; continuing with discovered neighbors`, error);
      }

      const discoveredRegions = new Set<string>([currentRegion]);
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

      const regions = Array.from(discoveredRegions);
      const neighboringRegions = regions.filter((region) => region !== currentRegion);
      console.log(`🏥 GPS scoped search regions (${regions.length}): ${regions.join(', ')}`);

      const neighboringResults = await Promise.allSettled(
        neighboringRegions.map((region) => this.apiClient.getCombinedHospitalData(region))
      );

      const combinedByHpid = new Map<string, Awaited<ReturnType<EGenApiClient['getCombinedHospitalData']>>[number]>();
      const mergeItem = (
        item: Awaited<ReturnType<EGenApiClient['getCombinedHospitalData']>>[number]
      ) => {
        const hpid = item.basicInfo.hpid || item.bedInfo?.hpid;
        if (!hpid) return;

        const existing = combinedByHpid.get(hpid);
        if (!existing) {
          combinedByHpid.set(hpid, item);
          return;
        }

        const existingBeds = Number(existing.bedInfo?.hvec ?? 0);
        const incomingBeds = Number(item.bedInfo?.hvec ?? 0);
        const existingHasCoords = Number(existing.basicInfo.wgs84Lat) !== 0 && Number(existing.basicInfo.wgs84Lon) !== 0;
        const incomingHasCoords = Number(item.basicInfo.wgs84Lat) !== 0 && Number(item.basicInfo.wgs84Lon) !== 0;
        if ((!existingHasCoords && incomingHasCoords) || incomingBeds > existingBeds) {
          combinedByHpid.set(hpid, item);
        }
      };

      currentRegionData.forEach(mergeItem);

      let successfulRegionCount = currentRegionError ? 0 : 1;
      neighboringResults.forEach((result, index) => {
        const region = neighboringRegions[index];
        if (result.status === 'rejected') {
          console.warn(`⚠️ Regional E-Gen search failed for ${region}; continuing with remaining regions`, result.reason);
          return;
        }

        successfulRegionCount += 1;
        result.value.forEach(mergeItem);
      });

      if (successfulRegionCount === 0) {
        if (currentRegionError) throw currentRegionError;
        const firstFailure = neighboringResults.find((result) => result.status === 'rejected');
        if (firstFailure?.status === 'rejected') throw firstFailure.reason;
        throw new Error('All regional E-Gen requests failed');
      }

      const rankedHospitals = this.rankAndFilter(
        HospitalMapper.toDomainList(Array.from(combinedByHpid.values())),
        coords,
        aiContext,
        MAX_DISTANCE_KM
      );

      console.log(
        `✅ Nationwide GPS candidate pool: ${rankedHospitals.length} hospitals within ${MAX_DISTANCE_KM}km from ${successfulRegionCount}/${regions.length} scoped E-Gen searches`
      );
      console.log(`✅ Returning ${rankedHospitals.length} hospitals after progressive nationwide merge`);
      return rankedHospitals;
    } catch (error) {
      console.error('Failed to find nearby hospitals:', error);
      throw error;
    }
  }

  private rankAndFilter(
    hospitals: Hospital[],
    coords: Coordinates,
    aiContext: AIAnalysisContext | null | undefined,
    maxDistanceKm: number
  ): Hospital[] {
    const validHospitals = hospitals.filter((hospital) => {
      if (!hospital.coordinates) return false;
      return hospital.distanceFrom(coords) / 1000 <= maxDistanceKm;
    });

    validHospitals.sort((a, b) => a.distanceFrom(coords) - b.distanceFrom(coords));
    const rankingStartedAt = performance.now();
    const rankedHospitals = HospitalRankingService.rankHospitals(validHospitals, aiContext);
    if (this.performanceSearchId !== null) {
      recordRankingPerformance(
        this.performanceSearchId,
        performance.now() - rankingStartedAt
      );
    }
    return rankedHospitals;
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
