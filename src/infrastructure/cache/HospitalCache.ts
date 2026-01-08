import { Hospital } from '../../domain/entities/Hospital';
import { Coordinates } from '../../domain/valueObjects/Coordinates';

/**
 * 캐싱된 병원 데이터 인터페이스
 */
interface CachedHospitalData {
  hospitals: Hospital[];
  location: {
    latitude: number;
    longitude: number;
  };
  timestamp: number;
  region: string;
}

/**
 * HospitalCache
 * 병원 데이터 로컬 스토리지 캐싱 (API 장애 시 Fallback용)
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
   */
  static save(
    hospitals: Hospital[],
    location: Coordinates,
    region: string
  ): void {
    try {
      // Hospital 객체를 직렬화 가능한 형태로 변환
      const serializedHospitals = hospitals.map((h) => ({
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
      }));

      const cacheData: CachedHospitalData = {
        hospitals: serializedHospitals as any,
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
        },
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

      // 30분 이상 지난 캐시는 무효
      if (age > this.MAX_CACHE_AGE_MS) {
        console.log(`Cache expired (${ageMinutes} minutes old), removing...`);
        this.clear();
        return null;
      }

      // 위치가 너무 다르면 캐시 무효 (100km 이상 차이)
      const cachedLocation = new Coordinates(
        cacheData.location.latitude,
        cacheData.location.longitude
      );
      const distance = userLocation.distanceTo(cachedLocation);
      if (distance > 100000) {
        // 100km
        console.log(`Cache location too far (${(distance / 1000).toFixed(1)}km), ignoring cache`);
        return null;
      }

      // 역직렬화: 평문 객체 → Hospital 인스턴스
      const hospitals = (cacheData.hospitals as any[]).map((data) =>
        this.deserializeHospital(data)
      );

      const isFresh = age < 5 * 60 * 1000; // 5분 이내는 fresh로 간주

      console.log(`✅ Loaded ${hospitals.length} hospitals from cache (${ageMinutes} minutes old, ${isFresh ? 'FRESH' : 'STALE'})`);

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
  private static deserializeHospital(data: any): Hospital {
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
      data.routeDistance
    );
  }
}
