import { describe, expect, it } from 'vitest';
import { Coordinates } from './Coordinates';

const SEOUL_CITY_HALL = new Coordinates(37.5663, 126.9779);
const GWANGJU_HOSPITAL = new Coordinates(35.1524229, 126.8539184);

describe('Coordinates.distanceTo', () => {
  it('서울시청과 광주 병원 사이 거리를 미터로 계산한다', () => {
    // 실제 직선거리 약 268.6km
    expect(SEOUL_CITY_HALL.distanceTo(GWANGJU_HOSPITAL)).toBeCloseTo(268_640, -2);
  });

  it('같은 지점은 0이다', () => {
    expect(SEOUL_CITY_HALL.distanceTo(new Coordinates(37.5663, 126.9779))).toBe(0);
  });

  it('방향이 바뀌어도 거리는 같다', () => {
    expect(SEOUL_CITY_HALL.distanceTo(GWANGJU_HOSPITAL))
      .toBeCloseTo(GWANGJU_HOSPITAL.distanceTo(SEOUL_CITY_HALL), 6);
  });

  it('짧은 거리도 미터 단위로 맞춘다', () => {
    // 위도 0.009도는 약 1km
    const oneKmNorth = new Coordinates(37.5753, 126.9779);

    expect(SEOUL_CITY_HALL.distanceTo(oneKmNorth)).toBeCloseTo(1_001, -1);
  });

  // 10km 필터와 반경 검색이 이 단위에 의존한다. 킬로미터를 반환하면
  // 100km 검색이 100m 검색이 된다.
  it('킬로미터가 아니라 미터를 반환한다', () => {
    expect(SEOUL_CITY_HALL.distanceTo(GWANGJU_HOSPITAL)).toBeGreaterThan(200_000);
  });
});

describe('Coordinates 유효성 검사', () => {
  it.each([
    ['위도가 범위를 넘으면', 91, 126.9779],
    ['위도가 범위보다 작으면', -91, 126.9779],
    ['경도가 범위를 넘으면', 37.5663, 181],
    ['경도가 범위보다 작으면', 37.5663, -181],
  ])('%s 생성에 실패한다', (_label, lat, lon) => {
    expect(() => new Coordinates(lat, lon)).toThrow();
  });

  it('음수 정확도는 거부한다', () => {
    expect(() => new Coordinates(37.5663, 126.9779, -1)).toThrow();
  });

  it('경계값은 허용한다', () => {
    expect(() => new Coordinates(90, 180)).not.toThrow();
    expect(() => new Coordinates(-90, -180)).not.toThrow();
  });
});

describe('Coordinates.hasGoodAccuracy', () => {
  it('정확도를 모르면 신뢰하지 않는다', () => {
    expect(new Coordinates(37.5663, 126.9779).hasGoodAccuracy()).toBe(false);
  });

  it('기준 이내면 신뢰한다', () => {
    expect(new Coordinates(37.5663, 126.9779, 50).hasGoodAccuracy()).toBe(true);
    expect(new Coordinates(37.5663, 126.9779, 150).hasGoodAccuracy()).toBe(false);
  });
});
