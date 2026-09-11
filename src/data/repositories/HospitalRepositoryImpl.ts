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

      const MAX_DISTANCE_KM = 100;
      const currentRegion = inferRegionFromCoordinates(coords);
      if (!currentRegion) {
        throw new Error(
          `Unsupported GPS coordinates for nationwide emergency search: ${coords.latitude}, ${coords.longitude}`
        );
      }

      // Use the official coordinate-based location endpoint once to discover the
      // actual nearby ER candidates. This avoids fanning out across every region
      // whose coarse bounding box happens to intersect the 100km circle.
      const nearbyLocations = await this.apiClient.getNearbyEmergencyLocations(
        coords.latitude,
        coords.longitude,
        100
      );

      const candidateHpids = new Set<string>();
      const candidateRegions = new Set<string>();

      for (const location of nearbyLocations) {
        if (!location.hpid) continue;

        const latitude = Number(location.latitude ?? location.wgs84Lat);
        const longitude = Number(location.longitude ?? location.wgs84Lon);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

        let locationCoordinates: Coordinates;
        try {
          locationCoordinates = new Coordinates(latitude, longitude);
        } catch {
          continue;
        }

        const distanceKm = locationCoordinates.distanceTo(coords) / 1000;
        if (distanceKm > MAX_DISTANCE_KM) continue;

        candidateHpids.add(location.hpid);
        const region = inferRegionFromCoordinates(locationCoordinates);
        if (region) candidateRegions.add(region);
      }

      if (candidateHpids.size === 0) {
        console.log('✅ Coordinate-based E-Gen lookup returned no hospitals within 100km');
        return [];
      }

      // A candidate can occasionally sit on imperfect administrative bounds.
      // Always include the user's current region as a safe, bounded fallback,
      // while still limiting regional realtime calls to regions evidenced by
      // the coordinate result instead of a nationwide bounding-box fan-out.
      candidateRegions.add(currentRegion);
      const regions = Array.from(candidateRegions);
      console.log(
        `🏥 Coordinate candidates: ${candidateHpids.size}; realtime regions (${regions.length}): ${regions.join(', ')}`
      );

      const regionResults = await Promise.allSettled(
        regions.map((region) => this.apiClient.getCombinedHospitalData(region))
      );

      const successfulRegionCount = regionResults.filter((result) => result.status === 'fulfilled').length;
      if (successfulRegionCount === 0) {
        const firstFailure = regionResults.find((result) => result.status === 'rejected');
        if (firstFailure?.status === 'rejected') throw firstFailure.reason;
        throw new Error('All candidate regional E-Gen requests failed');
      }

      const combinedByHpid = new Map<
        string,
        Awaited<ReturnType<EGenApiClient['getCombinedHospitalData']>>[number]
      >();

      regionResults.forEach((result, index) => {
        const region = regions[index];
        if (result.status === 'rejected') {
          console.warn(
            `⚠️ Regional E-Gen search failed for ${region}; continuing with remaining candidate regions`,
            result.reason
          );
          return;
        }

        for (const item of result.value) {
          const hpid = item.basicInfo.hpid || item.bedInfo?.hpid;
          if (!hpid || !candidateHpids.has(hpid)) continue;

          const existing = combinedByHpid.get(hpid);
          if (!existing) {
            combinedByHpid.set(hpid, item);
            continue;
          }

          const existingBeds = Number(existing.bedInfo?.hvec ?? 0);
          const incomingBeds = Number(item.bedInfo?.hvec ?? 0);
          const existingHasCoords =
            Number(existing.basicInfo.wgs84Lat) !== 0 && Number(existing.basicInfo.wgs84Lon) !== 0;
          const incomingHasCoords =
            Number(item.basicInfo.wgs84Lat) !== 0 && Number(item.basicInfo.wgs84Lon) !== 0;
          if ((!existingHasCoords && incomingHasCoords) || incomingBeds > existingBeds) {
            combinedByHpid.set(hpid, item);
          }
        }
      });

      const hospitals = HospitalMapper.toDomainList(Array.from(combinedByHpid.values()));
      const validHospitals = hospitals.filter((hospital) => {
        const distanceKm = hospital.distanceFrom(coords) / 1000;
        return distanceKm <= MAX_DISTANCE_KM;
      });

      validHospitals.sort((a, b) => a.distanceFrom(coords) - b.distanceFrom(coords));
      console.log(
        `✅ Coordinate-first candidate pool: ${validHospitals.length} hospitals within ${MAX_DISTANCE_KM}km from ${successfulRegionCount}/${regions.length} realtime region searches`
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
