import { describe, expect, it } from 'vitest';
import { applyFilters, DEFAULT_FILTERS, type HospitalFilters } from './HospitalFilter';
import { Hospital } from '../entities/Hospital';
import { Coordinates } from '../valueObjects/Coordinates';

const SEOUL_CITY_HALL = new Coordinates(37.5663, 126.9779);
// 서울시청에서 약 268km
const GWANGJU = new Coordinates(35.1524229, 126.8539184);

interface HospitalOverrides {
  coordinates?: Coordinates;
  availableBeds?: number;
  isOperating?: boolean;
  hasCT?: boolean;
  hasMRI?: boolean;
  hasSurgery?: boolean;
}

const hospital = (name: string, overrides: HospitalOverrides = {}): Hospital =>
  new Hospital(
    `hpid-${name}`,
    name,
    overrides.coordinates ?? SEOUL_CITY_HALL,
    '서울특별시 중구',
    '02-000-0000',
    null,
    overrides.availableBeds ?? 5,
    0,
    [],
    null,
    overrides.isOperating ?? true,
    new Date('2026-09-11T14:45:00+09:00'),
    overrides.hasCT ?? false,
    overrides.hasMRI ?? false,
    overrides.hasSurgery ?? false,
  );

const filters = (overrides: Partial<HospitalFilters> = {}): HospitalFilters => ({
  ...DEFAULT_FILTERS,
  ...overrides,
});

const names = (hospitals: Hospital[]) => hospitals.map((h) => h.name);

describe('applyFilters', () => {
  it('활성화된 필터가 없으면 전부 통과시킨다', () => {
    const hospitals = [hospital('가'), hospital('나', { hasCT: true })];

    expect(applyFilters(hospitals, DEFAULT_FILTERS, SEOUL_CITY_HALL)).toHaveLength(2);
  });

  it.each([
    ['hasCT', 'hasCT'],
    ['hasMRI', 'hasMRI'],
    ['hasSurgery', 'hasSurgery'],
  ] as const)('%s 필터는 해당 장비가 있는 병원만 남긴다', (_label, key) => {
    const hospitals = [hospital('보유', { [key]: true }), hospital('미보유')];

    const result = applyFilters(hospitals, filters({ [key]: true }), SEOUL_CITY_HALL);

    expect(names(result)).toEqual(['보유']);
  });

  it('24시간 필터는 운영 중인 병원만 남긴다', () => {
    const hospitals = [hospital('운영중'), hospital('중단', { isOperating: false })];

    const result = applyFilters(hospitals, filters({ is24Hours: true }), SEOUL_CITY_HALL);

    expect(names(result)).toEqual(['운영중']);
  });

  it('병상 여유 필터는 0병상 병원을 제외한다', () => {
    const hospitals = [hospital('여유', { availableBeds: 3 }), hospital('만실', { availableBeds: 0 })];

    const result = applyFilters(hospitals, filters({ hasAvailableBeds: true }), SEOUL_CITY_HALL);

    expect(names(result)).toEqual(['여유']);
  });

  it('여러 필터는 모두 만족하는 병원만 남긴다', () => {
    const hospitals = [
      hospital('둘다', { hasCT: true, hasMRI: true }),
      hospital('CT만', { hasCT: true }),
      hospital('MRI만', { hasMRI: true }),
    ];

    const result = applyFilters(hospitals, filters({ hasCT: true, hasMRI: true }), SEOUL_CITY_HALL);

    expect(names(result)).toEqual(['둘다']);
  });

  describe('10km 이내', () => {
    it('반경 밖 병원을 제외한다', () => {
      const hospitals = [hospital('가까움'), hospital('광주', { coordinates: GWANGJU })];

      const result = applyFilters(hospitals, filters({ within10km: true }), SEOUL_CITY_HALL);

      expect(names(result)).toEqual(['가까움']);
    });

    // 위치를 모르면 이 필터는 조용히 무시된다. 사용자에게는 필터가 켜진 것으로
    // 보이므로, 지금 동작을 고정해두고 바꿀 때 의식적으로 바꾸게 한다.
    it('사용자 위치가 없으면 거리 조건을 적용하지 못한다', () => {
      const hospitals = [hospital('가까움'), hospital('광주', { coordinates: GWANGJU })];

      const result = applyFilters(hospitals, filters({ within10km: true }), null);

      expect(names(result)).toEqual(['가까움', '광주']);
    });
  });
});
