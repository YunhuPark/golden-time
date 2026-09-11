import {
  Hospital,
  Specialization,
  TraumaLevel,
} from '../../domain/entities/Hospital';
import { Coordinates } from '../../domain/valueObjects/Coordinates';
import {
  getRegionsWithinRadius,
  inferRegionFromCoordinates,
} from '../../domain/services/RegionResolver';

interface SerializedHospital {
  id: string;
  name: string;
  coordinates: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  address: string;
  phoneNumber: string;
  emergencyPhoneNumber: string | null;
  availableBeds: number;
  totalBeds: number;
  specializations: Specialization[];
  traumaLevel: TraumaLevel;
  isOperating: boolean;
  lastUpdated: string;
  hasCT: boolean;
  hasMRI: boolean;
  hasSurgery: boolean;
  estimatedWaitTime?: number;
  routeDuration?: number;
  routeDistance?: number;
  icuAvailableBeds: number;
  neuroIcuAvailableBeds: number;
}

interface CachedHospitalData {
  schemaVersion: 2;
  hospitals: SerializedHospital[];
  timestamp: number;
  region: string;
  searchScope: string;
  location?: {
    latitude: number;
    longitude: number;
  };
}

export class HospitalCache {
  private static readonly CACHE_KEY = 'golden-time-hospital-cache';
  private static readonly MAX_CACHE_AGE_MS = 10 * 60 * 1000;
  private static readonly FRESH_CACHE_AGE_MS = 2 * 60 * 1000;
  private static readonly SEARCH_RADIUS_KM = 100;

  private static createSearchScope(location: Coordinates): {
    region: string;
    searchScope: string;
  } | null {
    const region = inferRegionFromCoordinates(location);
    if (!region) return null;

    const regions = getRegionsWithinRadius(location, this.SEARCH_RADIUS_KM);
    if (regions.length === 0) return null;

    return {
      region,
      searchScope: `${region}::${regions.join('|')}`,
    };
  }

  static save(hospitals: Hospital[], location: Coordinates): void {
    try {
      const scope = this.createSearchScope(location);
      if (!scope) return;

      const serializedHospitals: SerializedHospital[] = hospitals.map((h) => ({
        id: h.id,
        name: h.name,
        coordinates: {
          latitude: h.coordinates.latitude,
          longitude: h.coordinates.longitude,
          accuracy: h.coordinates.accuracy,
        },
        address: h.address,
        phoneNumber: h.phoneNumber,
        emergencyPhoneNumber: h.emergencyPhoneNumber,
        availableBeds: h.availableBeds,
        totalBeds: h.totalBeds,
        specializations: h.specializations,
        traumaLevel: h.traumaLevel,
        isOperating: h.isOperating,
        lastUpdated: h.lastUpdated.toISOString(),
        hasCT: h.hasCT,
        hasMRI: h.hasMRI,
        hasSurgery: h.hasSurgery,
        estimatedWaitTime: h.estimatedWaitTime,
        routeDuration: h.routeDuration,
        routeDistance: h.routeDistance,
        icuAvailableBeds: h.icuAvailableBeds,
        neuroIcuAvailableBeds: h.neuroIcuAvailableBeds,
      }));

      const cacheData: CachedHospitalData = {
        schemaVersion: 2,
        hospitals: serializedHospitals,
        timestamp: Date.now(),
        region: scope.region,
        searchScope: scope.searchScope,
      };

      localStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to cache hospital data:', error);
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        this.clear();
      }
    }
  }

  static load(userLocation: Coordinates): {
    hospitals: Hospital[];
    isFresh: boolean;
    ageMinutes: number;
  } | null {
    try {
      const cached = localStorage.getItem(this.CACHE_KEY);
      if (!cached) return null;

      const cacheData = JSON.parse(cached) as Partial<CachedHospitalData>;

      if (cacheData.location) {
        delete cacheData.location;
        localStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheData));
      }

      if (
        cacheData.schemaVersion !== 2 ||
        !cacheData.searchScope ||
        !cacheData.region ||
        !cacheData.timestamp ||
        !Array.isArray(cacheData.hospitals)
      ) {
        this.clear();
        return null;
      }

      const age = Date.now() - cacheData.timestamp;
      const ageMinutes = Math.round(age / 60000);
      if (age > this.MAX_CACHE_AGE_MS) {
        this.clear();
        return null;
      }

      const currentScope = this.createSearchScope(userLocation);
      if (!currentScope || currentScope.searchScope !== cacheData.searchScope) {
        return null;
      }

      const hospitals = cacheData.hospitals
        .map((data) => this.deserializeHospital(data))
        .filter((hospital) => hospital.distanceFrom(userLocation) / 1000 <= this.SEARCH_RADIUS_KM)
        .sort((a, b) => a.distanceFrom(userLocation) - b.distanceFrom(userLocation));

      if (hospitals.length === 0) return null;

      return {
        hospitals,
        isFresh: age < this.FRESH_CACHE_AGE_MS,
        ageMinutes,
      };
    } catch (error) {
      console.warn('Failed to load cached hospital data:', error);
      this.clear();
      return null;
    }
  }

  static clear(): void {
    localStorage.removeItem(this.CACHE_KEY);
  }

  static getStatus(): {
    exists: boolean;
    ageMinutes: number | null;
    hospitalCount: number | null;
  } {
    try {
      const cached = localStorage.getItem(this.CACHE_KEY);
      if (!cached) return { exists: false, ageMinutes: null, hospitalCount: null };

      const cacheData = JSON.parse(cached) as Partial<CachedHospitalData>;
      if (
        cacheData.schemaVersion !== 2 ||
        !cacheData.timestamp ||
        !Array.isArray(cacheData.hospitals)
      ) {
        return { exists: false, ageMinutes: null, hospitalCount: null };
      }

      return {
        exists: true,
        ageMinutes: Math.round((Date.now() - cacheData.timestamp) / 60000),
        hospitalCount: cacheData.hospitals.length,
      };
    } catch {
      return { exists: false, ageMinutes: null, hospitalCount: null };
    }
  }

  private static deserializeHospital(data: SerializedHospital): Hospital {
    return new Hospital(
      data.id,
      data.name,
      new Coordinates(
        data.coordinates.latitude,
        data.coordinates.longitude,
        data.coordinates.accuracy
      ),
      data.address,
      data.phoneNumber,
      data.emergencyPhoneNumber,
      data.availableBeds,
      data.totalBeds,
      data.specializations,
      data.traumaLevel,
      data.isOperating,
      new Date(data.lastUpdated),
      data.hasCT,
      data.hasMRI,
      data.hasSurgery,
      data.estimatedWaitTime,
      data.routeDuration,
      data.routeDistance,
      data.icuAvailableBeds ?? 0,
      data.neuroIcuAvailableBeds ?? 0
    );
  }
}
