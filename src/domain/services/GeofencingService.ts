import { Coordinates } from '../valueObjects/Coordinates';

/**
 * Geofencing 이벤트 타입
 */
export type GeofenceEvent = 'enter' | 'exit';

/**
 * Geofence 콜백
 */
export interface GeofenceCallback {
  onEnter: (hospitalId: string, hospitalName: string) => void;
  onExit?: (hospitalId: string, hospitalName: string) => void;
}

/**
 * 모니터링 중인 Geofence
 */
interface MonitoredGeofence {
  hospitalId: string;
  hospitalName: string;
  coordinates: Coordinates;
  radius: number; // 미터 단위
  callback: GeofenceCallback;
  isInside: boolean; // 현재 영역 내부에 있는지 여부
}

/**
 * GeofencingService
 * 병원 근처 도착 시 자동으로 방문 기록 제안
 *
 * 기능:
 * - 특정 병원 좌표를 중심으로 반경 N미터 감시
 * - 사용자가 영역 진입 시 콜백 실행
 * - 배터리 절약을 위한 최적화
 */
export class GeofencingService {
  private static instance: GeofencingService | null = null;
  private watchId: number | null = null;
  private geofences: Map<string, MonitoredGeofence> = new Map();
  private isWatching = false;

  private constructor() {
    // Singleton 패턴
  }

  /**
   * 싱글톤 인스턴스 가져오기
   */
  static getInstance(): GeofencingService {
    if (!GeofencingService.instance) {
      GeofencingService.instance = new GeofencingService();
    }
    return GeofencingService.instance;
  }

  /**
   * Geofence 추가 (병원 모니터링 시작)
   */
  addGeofence(
    hospitalId: string,
    hospitalName: string,
    coordinates: Coordinates,
    callback: GeofenceCallback,
    radius: number = 100 // 기본 100미터
  ): { success: boolean; error?: string } {
    // 위치 권한 확인
    if (!('geolocation' in navigator)) {
      return { success: false, error: 'Geolocation is not supported by this browser.' };
    }

    // Geofence 등록
    this.geofences.set(hospitalId, {
      hospitalId,
      hospitalName,
      coordinates,
      radius,
      callback,
      isInside: false,
    });

    console.log(`📍 Geofence added for ${hospitalName} (radius: ${radius}m)`);

    // 위치 모니터링 시작 (아직 시작 안했으면)
    if (!this.isWatching) {
      this.startWatching();
    }

    return { success: true };
  }

  /**
   * Geofence 제거
   */
  removeGeofence(hospitalId: string): void {
    this.geofences.delete(hospitalId);
    console.log(`📍 Geofence removed for hospital ${hospitalId}`);

    // 모든 Geofence가 제거되면 위치 모니터링 중지
    if (this.geofences.size === 0) {
      this.stopWatching();
    }
  }

  /**
   * 모든 Geofence 제거
   */
  clearAll(): void {
    this.geofences.clear();
    this.stopWatching();
    console.log('📍 All geofences cleared');
  }

  /**
   * 위치 모니터링 시작
   */
  private startWatching(): void {
    if (this.isWatching) return;

    this.watchId = navigator.geolocation.watchPosition(
      (position) => this.handlePositionUpdate(position),
      (error) => this.handleError(error),
      {
        enableHighAccuracy: false, // 배터리 절약을 위해 낮은 정확도 사용
        maximumAge: 30000, // 30초까지는 캐시된 위치 사용
        timeout: 27000, // 27초 타임아웃
      }
    );

    this.isWatching = true;
    console.log('📍 Geofencing started');
  }

  /**
   * 위치 모니터링 중지
   */
  private stopWatching(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.isWatching = false;
    console.log('📍 Geofencing stopped');
  }

  /**
   * 위치 업데이트 처리
   */
  private handlePositionUpdate(position: GeolocationPosition): void {
    const userLocation = new Coordinates(
      position.coords.latitude,
      position.coords.longitude,
      position.coords.accuracy
    );

    // 모든 Geofence 확인
    this.geofences.forEach((geofence) => {
      const distance = this.calculateDistance(userLocation, geofence.coordinates);
      const wasInside = geofence.isInside;
      const isInside = distance <= geofence.radius;

      // 진입 이벤트 (밖 → 안)
      if (!wasInside && isInside) {
        console.log(`✅ Entered geofence: ${geofence.hospitalName} (${distance.toFixed(0)}m)`);
        geofence.isInside = true;
        geofence.callback.onEnter(geofence.hospitalId, geofence.hospitalName);
      }

      // 이탈 이벤트 (안 → 밖)
      if (wasInside && !isInside) {
        console.log(`🚪 Exited geofence: ${geofence.hospitalName} (${distance.toFixed(0)}m)`);
        geofence.isInside = false;
        geofence.callback.onExit?.(geofence.hospitalId, geofence.hospitalName);
      }
    });
  }

  /**
   * 에러 처리
   */
  private handleError(error: GeolocationPositionError): void {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        console.error('❌ User denied the request for Geolocation.');
        break;
      case error.POSITION_UNAVAILABLE:
        console.error('❌ Location information is unavailable.');
        break;
      case error.TIMEOUT:
        console.error('❌ The request to get user location timed out.');
        break;
      default:
        console.error('❌ An unknown error occurred.');
        break;
    }
  }

  /**
   * 두 좌표 간 거리 계산 (Haversine formula)
   * @returns 거리 (미터)
   */
  private calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
    const R = 6371e3; // 지구 반지름 (미터)
    const φ1 = (coord1.latitude * Math.PI) / 180;
    const φ2 = (coord2.latitude * Math.PI) / 180;
    const Δφ = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
    const Δλ = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // 미터 단위
  }

  /**
   * 현재 모니터링 중인 Geofence 개수
   */
  getActiveGeofenceCount(): number {
    return this.geofences.size;
  }

  /**
   * 특정 병원이 모니터링 중인지 확인
   */
  isMonitoring(hospitalId: string): boolean {
    return this.geofences.has(hospitalId);
  }
}
