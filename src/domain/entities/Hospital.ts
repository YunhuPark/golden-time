import { Coordinates } from '../valueObjects/Coordinates';

/**
 * 병원 전문 진료과 타입
 */
export type Specialization =
  | '내과'
  | '외과'
  | '정형외과'
  | '신경외과'
  | '심장내과'
  | '소아과'
  | '산부인과'
  | '응급의학과'
  | '흉부외과'
  | '신경과'
  | '비뇨기과'
  | '안과'
  | '이비인후과'
  | '피부과'
  | '정신건강의학과'
  | '재활의학과'
  | '마취통증의학과'
  | '영상의학과'
  | '병리과'
  | '진단검사의학과'
  | '기타';

/**
 * 외상센터 등급
 * - 1: 권역외상센터 (최고 수준)
 * - 2: 지역외상센터
 * - 3: 지역응급의료센터
 * - null: 외상센터 아님
 */
export type TraumaLevel = 1 | 2 | 3 | null;

/**
 * 응급실 가용 상태
 */
export enum AvailabilityStatus {
  AVAILABLE = 'AVAILABLE',       // 병상 가능 (녹색)
  LIMITED = 'LIMITED',             // 병상 제한적 (노랑)
  FULL = 'FULL',                   // 만실 (빨강)
  UNKNOWN = 'UNKNOWN',             // 정보 불확실 (회색)
}

/**
 * Hospital Entity (Domain Model)
 * 응급실을 운영하는 병원의 핵심 도메인 엔티티
 */
export class Hospital {
  constructor(
    public readonly id: string,                      // 응급의료포털 기관 ID
    public readonly name: string,                     // 병원명
    public readonly coordinates: Coordinates,         // 위치 좌표
    public readonly address: string,                  // 주소
    public readonly phoneNumber: string,              // 대표 전화번호
    public readonly emergencyPhoneNumber: string | null, // 응급실 직통 전화
    public readonly availableBeds: number,            // 가용 병상 수
    public readonly totalBeds: number,                // 총 병상 수
    public readonly specializations: Specialization[], // 전문 진료과 목록
    public readonly traumaLevel: TraumaLevel,         // 외상센터 등급
    public readonly isOperating: boolean,             // 응급실 운영 여부
    public readonly lastUpdated: Date,                // 데이터 마지막 갱신 시각
    public readonly hasCT: boolean,                   // CT 장비 가용 여부
    public readonly hasMRI: boolean,                  // MRI 장비 가용 여부
    public readonly hasSurgery: boolean,              // 수술 가능 여부
    public readonly estimatedWaitTime?: number,       // 예상 대기 시간 (분, 옵셔널)
    public readonly routeDuration?: number,           // 경로 소요시간 (초, 옵셔널)
    public readonly routeDistance?: number            // 경로 거리 (미터, 옵셔널)
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.id || this.id.trim() === '') {
      throw new Error('Hospital ID cannot be empty');
    }
    if (!this.name || this.name.trim() === '') {
      throw new Error('Hospital name cannot be empty');
    }
    if (this.availableBeds < 0) {
      throw new Error(`Available beds cannot be negative: ${this.availableBeds}`);
    }
    if (this.totalBeds < 0) {
      throw new Error(`Total beds cannot be negative: ${this.totalBeds}`);
    }
    if (this.availableBeds > this.totalBeds) {
      throw new Error(
        `Available beds (${this.availableBeds}) cannot exceed total beds (${this.totalBeds})`
      );
    }
  }

  /**
   * 병상 가용 상태 계산
   */
  getAvailabilityStatus(): AvailabilityStatus {
    if (!this.isOperating) {
      return AvailabilityStatus.UNKNOWN;
    }

    if (this.totalBeds === 0) {
      return AvailabilityStatus.UNKNOWN;
    }

    const occupancyRate = 1 - this.availableBeds / this.totalBeds;

    if (this.availableBeds === 0) {
      return AvailabilityStatus.FULL;
    } else if (occupancyRate >= 0.8 || this.availableBeds <= 4) {
      // 80% 이상 차있거나 4병상 이하 남음 → 노란색
      return AvailabilityStatus.LIMITED;
    } else {
      return AvailabilityStatus.AVAILABLE;
    }
  }

  /**
   * 특정 좌표로부터의 직선 거리 계산
   */
  distanceFrom(location: Coordinates): number {
    return location.distanceTo(this.coordinates);
  }

  /**
   * 사용자의 의료 조건과 병원 전문과가 매칭되는지 확인
   */
  hasSpecialization(specialization: Specialization): boolean {
    return this.specializations.includes(specialization);
  }

  /**
   * 데이터가 오래되었는지 확인 (5분 이상 경과)
   */
  isDataStale(thresholdMinutes = 5): boolean {
    const now = new Date();
    const diff = now.getTime() - this.lastUpdated.getTime();
    return diff > thresholdMinutes * 60 * 1000;
  }

  /**
   * 긴급 호출이 가능한 전화번호 반환
   */
  getCallablePhoneNumber(): string {
    return this.emergencyPhoneNumber ?? this.phoneNumber;
  }

  /**
   * 병상 가용률 (0.0 ~ 1.0)
   */
  getAvailabilityRate(): number {
    if (this.totalBeds === 0) return 0;
    return this.availableBeds / this.totalBeds;
  }

  /**
   * 디버깅용 문자열 표현
   */
  toString(): string {
    return `Hospital(${this.name}, beds: ${this.availableBeds}/${this.totalBeds}, status: ${this.getAvailabilityStatus()})`;
  }

  /**
   * 불변성을 유지하면서 특정 필드만 업데이트한 새 인스턴스 반환
   */
  updateAvailability(availableBeds: number, lastUpdated: Date): Hospital {
    return new Hospital(
      this.id,
      this.name,
      this.coordinates,
      this.address,
      this.phoneNumber,
      this.emergencyPhoneNumber,
      availableBeds,
      this.totalBeds,
      this.specializations,
      this.traumaLevel,
      this.isOperating,
      lastUpdated,
      this.hasCT,
      this.hasMRI,
      this.hasSurgery,
      this.estimatedWaitTime,
      this.routeDuration,
      this.routeDistance
    );
  }

  /**
   * 경로 정보를 업데이트한 새 인스턴스 반환
   */
  withRouteInfo(routeDuration: number, routeDistance: number): Hospital {
    return new Hospital(
      this.id,
      this.name,
      this.coordinates,
      this.address,
      this.phoneNumber,
      this.emergencyPhoneNumber,
      this.availableBeds,
      this.totalBeds,
      this.specializations,
      this.traumaLevel,
      this.isOperating,
      this.lastUpdated,
      this.hasCT,
      this.hasMRI,
      this.hasSurgery,
      this.estimatedWaitTime,
      routeDuration,
      routeDistance
    );
  }

  /**
   * 예상 도착 시간 계산 (현재 시각 + 경로 소요시간)
   */
  getEstimatedArrivalTime(): Date | null {
    if (!this.routeDuration) return null;
    const now = new Date();
    return new Date(now.getTime() + this.routeDuration * 1000);
  }

  /**
   * 경로 소요시간을 "분" 단위로 반환
   */
  getRouteDurationMinutes(): number | null {
    if (!this.routeDuration) return null;
    return Math.ceil(this.routeDuration / 60);
  }

  /**
   * 경로 거리를 "킬로미터" 단위로 반환
   */
  getRouteDistanceKm(): number | null {
    if (!this.routeDistance) return null;
    return this.routeDistance / 1000;
  }
}
