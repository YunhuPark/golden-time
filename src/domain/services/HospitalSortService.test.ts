import { describe, expect, it, vi } from 'vitest';
import { HospitalSortService } from './HospitalSortService';
import { Hospital } from '../entities/Hospital';
import { Coordinates } from '../valueObjects/Coordinates';

const SEOUL_CITY_HALL = new Coordinates(37.5663, 126.9779);

interface HospitalOverrides {
  coordinates?: Coordinates;
  availableBeds?: number;
  isOperating?: boolean;
  routeDuration?: number;
}

const hospital = (name: string, overrides: HospitalOverrides = {}): Hospital =>
  new Hospital(
    `hpid-${name}`,
    name,
    overrides.coordinates ?? SEOUL_CITY_HALL,
    '서울특별시 중구',
    '02-000-0000',
    null,
    overrides.availableBeds ?? 0,
    0,
    [],
    null,
    overrides.isOperating ?? true,
    new Date('2026-09-11T14:45:00+09:00'),
    false,
    false,
    false,
    undefined,
    overrides.routeDuration,
  );

const names = (hospitals: Hospital[]) => hospitals.map((h) => h.name);

describe('HospitalSortService — 공통', () => {
  it('원본 배열을 바꾸지 않는다', () => {
    const original = [hospital('가', { availableBeds: 1 }), hospital('나', { availableBeds: 9 })];
    const snapshot = names(original);

    HospitalSortService.sortHospitals(original, 'BEDS', SEOUL_CITY_HALL);

    expect(names(original)).toEqual(snapshot);
  });

  it('비어 있거나 1개인 목록도 그대로 돌려준다', () => {
    expect(HospitalSortService.sortHospitals([], 'TIME', SEOUL_CITY_HALL)).toEqual([]);

    const single = [hospital('혼자')];
    expect(names(HospitalSortService.sortHospitals(single, 'TIME', SEOUL_CITY_HALL))).toEqual(['혼자']);
  });
});

describe('HospitalSortService — TIME', () => {
  it('소요시간이 짧은 순으로 정렬한다', () => {
    const hospitals = [
      hospital('느림', { routeDuration: 900 }),
      hospital('빠름', { routeDuration: 120 }),
      hospital('보통', { routeDuration: 400 }),
    ];

    const sorted = HospitalSortService.sortHospitals(hospitals, 'TIME', SEOUL_CITY_HALL);

    expect(names(sorted)).toEqual(['빠름', '보통', '느림']);
  });

  it('경로 정보가 없는 병원은 뒤로 보낸다', () => {
    const hospitals = [
      hospital('경로없음'),
      hospital('경로있음', { routeDuration: 300 }),
    ];

    const sorted = HospitalSortService.sortHospitals(hospitals, 'TIME', SEOUL_CITY_HALL);

    expect(names(sorted)).toEqual(['경로있음', '경로없음']);
  });

  // 회귀 방지: falsy 검사(!timeA)를 쓰면 0초가 "경로 정보 없음"으로 취급되어
  // 바로 옆 병원이 목록 맨 아래로 밀린다.
  it('소요시간 0초를 경로 없음으로 보지 않는다', () => {
    const hospitals = [
      hospital('먼곳', { routeDuration: 600 }),
      hospital('바로옆', { routeDuration: 0 }),
      hospital('경로없음'),
    ];

    const sorted = HospitalSortService.sortHospitals(hospitals, 'TIME', SEOUL_CITY_HALL);

    expect(names(sorted)).toEqual(['바로옆', '먼곳', '경로없음']);
  });
});

describe('HospitalSortService — DISTANCE', () => {
  it('가까운 순으로 정렬한다', () => {
    const hospitals = [
      hospital('광주', { coordinates: new Coordinates(35.1524229, 126.8539184) }),
      hospital('서울', { coordinates: SEOUL_CITY_HALL }),
      hospital('수원', { coordinates: new Coordinates(37.2636, 127.0286) }),
    ];

    const sorted = HospitalSortService.sortHospitals(hospitals, 'DISTANCE', SEOUL_CITY_HALL);

    expect(names(sorted)).toEqual(['서울', '수원', '광주']);
  });

  it('사용자 위치가 없으면 순서를 바꾸지 않고 경고한다', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const hospitals = [
      hospital('광주', { coordinates: new Coordinates(35.1524229, 126.8539184) }),
      hospital('서울', { coordinates: SEOUL_CITY_HALL }),
    ];

    const sorted = HospitalSortService.sortHospitals(hospitals, 'DISTANCE', null);

    expect(names(sorted)).toEqual(['광주', '서울']);
    expect(warn).toHaveBeenCalled();

    warn.mockRestore();
  });
});

describe('HospitalSortService — BEDS', () => {
  it('가용 병상이 많은 순으로 정렬한다', () => {
    const hospitals = [
      hospital('적음', { availableBeds: 1 }),
      hospital('많음', { availableBeds: 12 }),
      hospital('보통', { availableBeds: 5 }),
    ];

    const sorted = HospitalSortService.sortHospitals(hospitals, 'BEDS', SEOUL_CITY_HALL);

    expect(names(sorted)).toEqual(['많음', '보통', '적음']);
  });

  it('운영 중인 병원을 병상 수보다 먼저 본다', () => {
    const hospitals = [
      hospital('운영중단', { availableBeds: 20, isOperating: false }),
      hospital('운영중', { availableBeds: 1, isOperating: true }),
    ];

    const sorted = HospitalSortService.sortHospitals(hospitals, 'BEDS', SEOUL_CITY_HALL);

    expect(names(sorted)).toEqual(['운영중', '운영중단']);
  });
});
