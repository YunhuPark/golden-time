import {
  Hospital,
  Specialization,
  TraumaLevel,
} from '../../domain/entities/Hospital';
import { Coordinates } from '../../domain/valueObjects/Coordinates';
import { inferRegionFromCoordinates } from '../../domain/services/RegionResolver';

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

/**
 * 캐싱된 병원 데이터 인터페이스
 */
interface CachedHospitalData {
  hospitals: SerializedHospital[];
  timestamp: number;
  region: string;
  /**
   * Legacy field from older cache versions. New writes never persist precise
   * user coordinates. It is kept only so existing localStorage entries can be
   * migrated in place when they are read.
   */
  location?: {
    latitude: number;
    longitude: number;
  };
}

/**
 * HospitalCache
 * 병원 데이터 로컬 스토리지 캐싱 (API 장애 시 Fallback용)
 *
 * Privacy rule:
 * - 정확한 사용자 위치는 localStorage에 저장하지 않습니다.
 * - 캐시 적합성은 좌표에서 계산한 행정지역(region)만으로 확인합니다.
 *
 * Edge Cases:
 * - API 서버 다운 시 최근 캐시 데이터 제공
 * - 타임아웃 발생 시 캐시 우선 로드 후 백그라운드 업데이트
 * - 네트워크 끊김 감지 시 즉시 캐시 사용
 */
export class HospitalCache {
  private static readonly CACHE_KEY = 'golden-time-hospital-cache';
  private static readonly MAX_CACHE_AGE_MS = 30 * 60 * 1000; // 30분

  /**
   * 병원 데이터 캐시에 저장
   *
   * 저장 지역은 반드시 현재 좌표에서 계산해 잘못된 호출자 입력으로
   * 캐시가 오염되지 않도록 합니다.
   */
  static save(hospitals: Hospital[], location: Coordinates): void {
    try {
      const region = inferRegionFromCoordinates(location);
      if (!region) {
        console.warn('Skipping hospital cache because the current region could not be inferred safely');
        return;
      }

      // Hospital 객체를 직렬화 가능한 형태로 변환합니다. 병원 좌표는 공개
      // 데이터이므로 보존하되 사용자의 현재 좌표는 저장하지 않습니다.
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
        hospitals: serializedHospitals,
        timestamp: Date.now(),
        region,
      };

      localStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheData));
      console.log(`✅ Cached ${hospitals.length} hospitals for region: ${region}`);
    } catch (error) {
      console.warn('Failed to cache hospital data:', error);
      // localStorage quota 초과 시 기존 캐시 삭제
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        this.clear();
      }
    }
  }

  /**
   * 캐시에서 병원 데이터 로드
   */
  static load(userLocation: Coordinates): {
    hospitals: Hospital[];
    isFresh: boolean;
    ageMinutes: number;
  } | null {
    try {
      const cached = localStorage.getItem(this.CACHE_KEY);
      if (!cached) {
        console.log('No cached hospital data found');
        return null;
      }

      const cacheData: CachedHospitalData = JSON.parse(cached);
      const age = Date.now() - cacheData.timestamp;
      const ageMinutes = Math.round(age / 60000);

      // 이전 버전 캐시에 저장된 정확한 사용자 위치가 있으면 즉시 제거합니다.
      if (cacheData.location) {
        delete cacheData.location;
        localStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheData));
      }

      // 30분 이상 지난 캐시는 무효
      if (age > this.MAX_CACHE_AGE_MS) {
        console.log(`Cache expired (${ageMinutes} minutes old), removing...`);
        this.clear();
        return null;
      }

      // 현재 위치의 행정지역과 저장된 캐시 지역이 다르면 사용하지 않습니다.
      // 이전 버전에서 광주 검색 결과를 서울 지역으로 잘못 저장한 캐시도 여기서 차단됩니다.
      const currentRegion = inferRegionFromCoordinates(userLocation);
      if (!currentRegion) {
        console.log('Current region could not be inferred safely; ignoring hospital cache');
        return null;
      }
      if (!cacheData.region || cacheData.region !== currentRegion) {
        console.log(
          `Cache region mismatch (${cacheData.region || 'unknown'} != ${currentRegion}), ignoring cache`
        );
        return null;
      }

      // 역직렬화: 평문 객체 → Hospital 인스턴스
      const hospitals = cacheData.hospitals.map((data) =>
        this.deserializeHospital(data)
      );

      const isFresh = age < 5 * 60 * 1000; // 5분 이내는 fresh로 간주

      console.log(`✅ Loaded ${hospitals.length} hospitals from cache (${currentRegion}, ${ageMinutes} minutes old, ${isFresh ? 'FRESH' : 'STALE'})`);

      return {
        hospitals,
        isFresh,
        ageMinutes,
      };
    } catch (error) {
      console.warn('Failed to load cached hospital data:', error);
      this.clear();
      return null;
    }
  }

  /**
   * 캐시 삭제
   */
  static clear(): void {
    localStorage.removeItem(this.CACHE_KEY);
    console.log('Hospital cache cleared');
  }

  /**
   * 캐시 상태 확인
   */
  static getStatus(): {
    exists: boolean;
    ageMinutes: number | null;
    hospitalCount: number | null;
  } {
    try {
      const cached = localStorage.getItem(this.CACHE_KEY);
      if (!cached) {
        return { exists: false, ageMinutes: null, hospitalCount: null };
      }

      const cacheData: CachedHospitalData = JSON.parse(cached);
      const age = Date.now() - cacheData.timestamp;
      const ageMinutes = Math.round(age / 60000);

      return {
        exists: true,
        ageMinutes,
        hospitalCount: cacheData.hospitals.length,
      };
    } catch {
      return { exists: false, ageMinutes: null, hospitalCount: null };
    }
  }

  /**
   * 역직렬화: 평문 객체 → Hospital 인스턴스
   */
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
