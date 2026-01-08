/**
 * Coordinates Value Object
 * 위도/경도 좌표를 나타내는 불변 값 객체
 */
export class Coordinates {
  constructor(
    public readonly latitude: number,
    public readonly longitude: number,
    public readonly accuracy?: number
  ) {
    this.validate();
  }

  private validate(): void {
    if (this.latitude < -90 || this.latitude > 90) {
      throw new Error(`Invalid latitude: ${this.latitude}. Must be between -90 and 90.`);
    }
    if (this.longitude < -180 || this.longitude > 180) {
      throw new Error(`Invalid longitude: ${this.longitude}. Must be between -180 and 180.`);
    }
    if (this.accuracy !== undefined && this.accuracy < 0) {
      throw new Error(`Invalid accuracy: ${this.accuracy}. Must be non-negative.`);
    }
  }

  /**
   * 두 좌표 간의 거리 계산 (Haversine 공식)
   * @returns 거리 (미터 단위)
   */
  distanceTo(other: Coordinates): number {
    const R = 6371e3; // 지구 반지름 (미터)
    const φ1 = (this.latitude * Math.PI) / 180;
    const φ2 = (other.latitude * Math.PI) / 180;
    const Δφ = ((other.latitude - this.latitude) * Math.PI) / 180;
    const Δλ = ((other.longitude - this.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // 미터
  }

  /**
   * 좌표가 유효한 정확도를 가지는지 확인
   */
  hasGoodAccuracy(threshold = 100): boolean {
    return this.accuracy !== undefined && this.accuracy <= threshold;
  }

  equals(other: Coordinates): boolean {
    return (
      this.latitude === other.latitude &&
      this.longitude === other.longitude &&
      this.accuracy === other.accuracy
    );
  }

  toString(): string {
    return `Coordinates(${this.latitude}, ${this.longitude}, accuracy: ${this.accuracy ?? 'unknown'}m)`;
  }
}
