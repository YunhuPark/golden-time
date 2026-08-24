import { Coordinates } from '../valueObjects/Coordinates';

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

export type TraumaLevel = 1 | 2 | 3 | null;

export enum AvailabilityStatus {
  AVAILABLE = 'AVAILABLE',
  LIMITED = 'LIMITED',
  FULL = 'FULL',
  UNKNOWN = 'UNKNOWN',
}

/**
 * E-Gen 실시간 가용 자원을 그대로 보존하는 병원 도메인 모델.
 * `availableBeds`는 응급실 실시간 가용병상(hvec)이며,
 * `icuAvailableBeds`/`neuroIcuAvailableBeds`는 각각 일반/신경 중환자실 가용 수치입니다.
 * totalBeds는 하위 호환성을 위해 유지하지만 신규 UI/랭킹에서는 사용하지 않습니다.
 */
export class Hospital {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly coordinates: Coordinates,
    public readonly address: string,
    public readonly phoneNumber: string,
    public readonly emergencyPhoneNumber: string | null,
    public readonly availableBeds: number,
    public readonly totalBeds: number,
    public readonly specializations: Specialization[],
    public readonly traumaLevel: TraumaLevel,
    public readonly isOperating: boolean,
    public readonly lastUpdated: Date,
    public readonly hasCT: boolean,
    public readonly hasMRI: boolean,
    public readonly hasSurgery: boolean,
    public readonly estimatedWaitTime?: number,
    public readonly routeDuration?: number,
    public readonly routeDistance?: number,
    public readonly icuAvailableBeds: number = 0,
    public readonly neuroIcuAvailableBeds: number = 0
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.id || this.id.trim() === '') throw new Error('Hospital ID cannot be empty');
    if (!this.name || this.name.trim() === '') throw new Error('Hospital name cannot be empty');
    if (this.availableBeds < 0) throw new Error(`Available beds cannot be negative: ${this.availableBeds}`);
    if (this.totalBeds < 0) throw new Error(`Total beds cannot be negative: ${this.totalBeds}`);
    if (this.icuAvailableBeds < 0) throw new Error(`ICU available beds cannot be negative: ${this.icuAvailableBeds}`);
    if (this.neuroIcuAvailableBeds < 0) throw new Error(`Neuro ICU available beds cannot be negative: ${this.neuroIcuAvailableBeds}`);
  }

  getAvailabilityStatus(): AvailabilityStatus {
    if (!this.isOperating) return AvailabilityStatus.UNKNOWN;
    if (this.availableBeds <= 0) return AvailabilityStatus.FULL;
    if (this.availableBeds <= 4) return AvailabilityStatus.LIMITED;
    return AvailabilityStatus.AVAILABLE;
  }

  distanceFrom(location: Coordinates): number {
    return location.distanceTo(this.coordinates);
  }

  hasSpecialization(specialization: Specialization): boolean {
    return this.specializations.includes(specialization);
  }

  isDataStale(thresholdMinutes = 5): boolean {
    const now = new Date();
    return now.getTime() - this.lastUpdated.getTime() > thresholdMinutes * 60 * 1000;
  }

  getCallablePhoneNumber(): string {
    return this.emergencyPhoneNumber ?? this.phoneNumber;
  }

  getAvailabilityRate(): number {
    if (this.availableBeds <= 0) return 0;
    return Math.min(this.availableBeds / 10, 1);
  }

  toString(): string {
    return `Hospital(${this.name}, ER available: ${this.availableBeds}, ICU: ${this.icuAvailableBeds}, status: ${this.getAvailabilityStatus()})`;
  }

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
      this.routeDistance,
      this.icuAvailableBeds,
      this.neuroIcuAvailableBeds
    );
  }

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
      routeDistance,
      this.icuAvailableBeds,
      this.neuroIcuAvailableBeds
    );
  }

  getEstimatedArrivalTime(): Date | null {
    if (!this.routeDuration) return null;
    return new Date(Date.now() + this.routeDuration * 1000);
  }

  getRouteDurationMinutes(): number | null {
    if (!this.routeDuration) return null;
    return Math.ceil(this.routeDuration / 60);
  }

  getRouteDistanceKm(): number | null {
    if (!this.routeDistance) return null;
    return this.routeDistance / 1000;
  }
}
