import { afterEach, describe, expect, it, vi } from 'vitest';
import { AvailabilityStatus, Hospital } from './Hospital';
import { Coordinates } from '../valueObjects/Coordinates';

const SEOUL_CITY_HALL = new Coordinates(37.5663, 126.9779);

interface HospitalOverrides {
  id?: string;
  name?: string;
  emergencyPhoneNumber?: string | null;
  availableBeds?: number;
  isOperating?: boolean;
  lastUpdated?: Date;
  routeDuration?: number;
  routeDistance?: number;
}

const hospital = (overrides: HospitalOverrides = {}): Hospital =>
  new Hospital(
    overrides.id ?? 'A1500022',
    overrides.name ?? '상무병원',
    SEOUL_CITY_HALL,
    '서울특별시 중구',
    '02-000-0000',
    overrides.emergencyPhoneNumber === undefined ? null : overrides.emergencyPhoneNumber,
    overrides.availableBeds ?? 5,
    0,
    ['응급의학과'],
    null,
    overrides.isOperating ?? true,
    overrides.lastUpdated ?? new Date(),
    false,
    false,
    false,
    undefined,
    overrides.routeDuration,
    overrides.routeDistance,
  );

describe('Hospital 생성 검증', () => {
  it.each([
    ['id가 비어 있으면', { id: '' }],
    ['이름이 비어 있으면', { name: '   ' }],
    ['가용 병상이 음수면', { availableBeds: -1 }],
  ])('%s 만들 수 없다', (_label, overrides) => {
    expect(() => hospital(overrides)).toThrow();
  });
});

// 카드와 지도의 가용/제한/0병상 배지가 이 판정에서 나온다.
describe('getAvailabilityStatus', () => {
  it.each([
    [0, AvailabilityStatus.FULL],
    [1, AvailabilityStatus.LIMITED],
    [4, AvailabilityStatus.LIMITED],
    [5, AvailabilityStatus.AVAILABLE],
    [30, AvailabilityStatus.AVAILABLE],
  ])('가용 병상 %i개는 %s이다', (availableBeds, expected) => {
    expect(hospital({ availableBeds }).getAvailabilityStatus()).toBe(expected);
  });

  it('운영 중이 아니면 병상 수와 무관하게 확인 필요로 본다', () => {
    expect(hospital({ isOperating: false, availableBeds: 30 }).getAvailabilityStatus())
      .toBe(AvailabilityStatus.UNKNOWN);
  });
});

describe('getAvailabilityRate', () => {
  it.each([
    [0, 0],
    [5, 0.5],
    [10, 1],
    [40, 1],
  ])('가용 병상 %i개는 비율 %d이다', (availableBeds, expected) => {
    expect(hospital({ availableBeds }).getAvailabilityRate()).toBe(expected);
  });
});

describe('isDataStale', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('기본 기준은 5분이다', () => {
    vi.useFakeTimers();
    const subject = hospital({ lastUpdated: new Date() });

    vi.advanceTimersByTime(4 * 60 * 1000);
    expect(subject.isDataStale()).toBe(false);

    vi.advanceTimersByTime(2 * 60 * 1000);
    expect(subject.isDataStale()).toBe(true);
  });

  it('기준을 직접 줄 수 있다', () => {
    vi.useFakeTimers();
    const subject = hospital({ lastUpdated: new Date() });

    vi.advanceTimersByTime(10 * 60 * 1000);

    expect(subject.isDataStale(30)).toBe(false);
    expect(subject.isDataStale(5)).toBe(true);
  });
});

describe('getCallablePhoneNumber', () => {
  it('응급실 번호가 있으면 우선한다', () => {
    expect(hospital({ emergencyPhoneNumber: '02-111-1111' }).getCallablePhoneNumber())
      .toBe('02-111-1111');
  });

  it('없으면 대표번호를 쓴다', () => {
    expect(hospital({ emergencyPhoneNumber: null }).getCallablePhoneNumber()).toBe('02-000-0000');
  });
});

describe('경로 정보', () => {
  it('경로가 없으면 소요시간과 거리를 비워 둔다', () => {
    const subject = hospital();

    expect(subject.getRouteDurationMinutes()).toBeNull();
    expect(subject.getRouteDistanceKm()).toBeNull();
    expect(subject.getEstimatedArrivalTime()).toBeNull();
  });

  it('초를 올림해 분으로 바꾼다', () => {
    expect(hospital({ routeDuration: 61 }).getRouteDurationMinutes()).toBe(2);
    expect(hospital({ routeDuration: 120 }).getRouteDurationMinutes()).toBe(2);
  });

  it('미터를 킬로미터로 바꾼다', () => {
    expect(hospital({ routeDistance: 2500 }).getRouteDistanceKm()).toBe(2.5);
  });

  // 회귀 방지: falsy로 판단하면 바로 앞 병원만 도착 정보가 비어 보인다.
  it('0초와 0미터는 값이 없는 것이 아니다', () => {
    const adjacent = hospital({ routeDuration: 0, routeDistance: 0 });

    expect(adjacent.getRouteDurationMinutes()).toBe(0);
    expect(adjacent.getRouteDistanceKm()).toBe(0);
    expect(adjacent.getEstimatedArrivalTime()).not.toBeNull();
  });

  it('도착 예정 시각은 현재 시각에 소요시간을 더한 값이다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-16T09:00:00Z'));

    const arrival = hospital({ routeDuration: 600 }).getEstimatedArrivalTime();

    expect(arrival?.toISOString()).toBe('2026-09-16T09:10:00.000Z');
    vi.useRealTimers();
  });
});

describe('불변 갱신', () => {
  it('withRouteInfo는 원본을 바꾸지 않고 경로만 채운다', () => {
    const original = hospital({ availableBeds: 7 });

    const enriched = original.withRouteInfo(300, 5000);

    expect(original.routeDuration).toBeUndefined();
    expect(enriched.routeDuration).toBe(300);
    expect(enriched.routeDistance).toBe(5000);
    expect(enriched.availableBeds).toBe(7);
    expect(enriched.id).toBe(original.id);
  });

  it('updateAvailability는 병상과 갱신시각만 바꾼다', () => {
    const original = hospital({ availableBeds: 1 }).withRouteInfo(300, 5000);
    const updatedAt = new Date('2026-09-16T09:00:00Z');

    const updated = original.updateAvailability(9, updatedAt);

    expect(original.availableBeds).toBe(1);
    expect(updated.availableBeds).toBe(9);
    expect(updated.lastUpdated).toBe(updatedAt);
    expect(updated.routeDuration).toBe(300);
  });
});

describe('distanceFrom', () => {
  it('사용자 위치에서의 거리를 미터로 돌려준다', () => {
    const gwangju = new Coordinates(35.1524229, 126.8539184);
    const subject = new Hospital(
      'A1500022', '상무병원', gwangju, '광주', '062-000-0000', null,
      5, 0, [], null, true, new Date(), false, false, false,
    );

    expect(subject.distanceFrom(SEOUL_CITY_HALL)).toBeCloseTo(268_640, -2);
  });
});
