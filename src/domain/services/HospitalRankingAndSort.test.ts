import { describe, it, expect, vi } from 'vitest';

// Mock Vite's import.meta.env before importing anything that depends on it
(global as any).import = { meta: { env: { VITE_SUPABASE_URL: 'mock', VITE_SUPABASE_ANON_KEY: 'mock' } } };

import { Hospital } from '../entities/Hospital';
import { Coordinates } from '../valueObjects/Coordinates';
import { HospitalRankingService } from './HospitalRankingService';
import { HospitalSortService } from './HospitalSortService';
import { HospitalSpecialtyService } from './HospitalSpecialtyService';
import { MediMatrixParams } from '../types/MediMatrixParams';

function createDummyHospital(id: string, name: string, routeDuration: number | undefined | -1 = undefined): Hospital {
  const h = new Hospital(
    id, name, new Coordinates(37, 127), 'Address', '010', '010',
    10, 20, [], 1, true, new Date(), true, true, true
  );
  if (routeDuration === undefined) return h;
  if (routeDuration === -1) return h.withRouteInfo(-1, -1);
  return h.withRouteInfo(routeDuration, 1000);
}

const mockParams = {
  analysisMode: 'synthetic_demo',
  condition: 'brain_lesion_demo',
  specialties: [],
  capabilities: [],
  volume: 1,
  clinicalValidation: false,
  triage: 'RED'
} satisfies MediMatrixParams;

describe('Ranking/Sort Service', () => {
  it('undefined 상태는 최고점/최저점이 아님 (기본 timeScore = 0)', () => {
    const h1 = createDummyHospital('h1', 'H1', 600);
    const h2 = createDummyHospital('h2', 'H2', undefined);
    
    const result = HospitalRankingService.rankHospitals([h1, h2], undefined, mockParams);

    const h1Score = result.scoreMap.get('h1');
    const h2Score = result.scoreMap.get('h2');

    expect(h2Score?.timeScore).toBe(0);
    expect(h1Score?.timeScore).toBe(40);
  });

  it('-1 실패 상태는 시간 점수 0점', () => {
    const h1 = createDummyHospital('h1', 'H1', 600);
    const h3 = createDummyHospital('h3', 'H3', -1);

    const result = HospitalRankingService.rankHospitals([h1, h3], undefined, mockParams);

    const h3Score = result.scoreMap.get('h3');
    expect(h3Score?.timeScore).toBe(0);
  });

  it('모든 조건을 최대치로 만족할 때 총점이 140점에 가깝게 정규화됨', () => {
    // 1. HospitalSpecialtyService 모킹하여 30점 반환
    vi.spyOn(HospitalSpecialtyService, 'getDiseaseSpecialtyScore').mockReturnValue(30);

    const hBest = new Hospital(
      'hBest', 'Best Hospital', new Coordinates(37, 127), 'Address', '010', '010',
      20, 20, [], 1, true, new Date(), true, true, true
    ).withRouteInfo(600, 1000);

    const bestParams = {
      ...mockParams,
      condition: 'brain_lesion_demo',
      capabilities: ['emergency_surgery', 'brain_imaging', 'icu']
    } satisfies MediMatrixParams;
    
    const result = HospitalRankingService.rankHospitals([hBest], 'brain_lesion_demo', bestParams);
    const score = result.scoreMap.get('hBest');
    
    expect(score?.timeScore).toBe(40);
    expect(score?.bedScore).toBe(30);
    expect(score?.traumaScore).toBe(20);
    expect(score?.operatingScore).toBe(10);
    expect(score?.specialtyScore).toBe(30);
    const rawAmbulance = (score?.capabilityScore || 0) + (score?.icuProxyScore || 0);
    
    // ambulanceScore must be normalized relative to 35
    const expectedAmbulance = (rawAmbulance / 35) * 10;
    
    expect(score?.totalScore).toBe(40 + 30 + 20 + 10 + 30 + expectedAmbulance);
    
    vi.restoreAllMocks();
  });

  it('구급차 가용 역량이 정규화됨', () => {
    const h = new Hospital(
      'h1', 'H1', new Coordinates(37, 127), 'Address', '010', '010',
      10, 20, [], 1, true, new Date(), true, true, true
    ); // Route info is -1/undefined effectively, bed = 50% => 25
    
    const params = {
      ...mockParams,
      capabilities: ['emergency_surgery', 'brain_imaging', 'icu']
    } satisfies MediMatrixParams;

    const result = HospitalRankingService.rankHospitals([h], undefined, params);
    const score = result.scoreMap.get('h1');
    
    // traumaLevel = 1, hasSurgery = true, hasCT = true -> max capabilities
    // capabilityScore (20) + icuProxyScore (15) = 35 -> normalized to 10
    const rawSum = (score?.capabilityScore || 0) + (score?.icuProxyScore || 0);
    
    const expectedAmbulance = (rawSum / 35) * 10;
    
    // bed availability 10/20 = 50% -> 20 + 0.5*10 = 25
    // time:0, bed:25, trauma:20, operating:10, specialty: 0
    // total = 55 + ambulanceScore
    expect(score?.totalScore).toBe(55 + expectedAmbulance);
  });

  it('비정상 값이 주어질 때 구급차 가용 점수가 0점으로 방어됨', () => {
    const h = new Hospital(
      'h1', 'H1', new Coordinates(37, 127), 'Address', '010', '010',
      10, 20, [], 1, true, new Date(), false, false, false
    );
    
    const params = {
      ...mockParams,
      capabilities: []
    } satisfies MediMatrixParams;

    const result = HospitalRankingService.rankHospitals([h], undefined, params);
    const score = result.scoreMap.get('h1');
    
    // trauma = 1 => icuProxyScore = 15, capability = 0 => sum 15 => 15/35 * 10 = 4.285...
    const rawSum = (score?.capabilityScore || 0) + (score?.icuProxyScore || 0);
    expect(rawSum).toBe(0);
    
    expect(score?.totalScore).toBe(0 + 25 + 20 + 10 + 0 + 0);
  });

  it('시간순 정렬에서 -1과 undefined는 마지막', () => {
    const h1 = createDummyHospital('h1', 'H1', 1200);
    const h2 = createDummyHospital('h2', 'H2', -1);
    const h3 = createDummyHospital('h3', 'H3', undefined);
    const h4 = createDummyHospital('h4', 'H4', 600);

    const sorted = HospitalSortService.sortHospitals(
      [h1, h2, h3, h4],
      'TIME',
      new Coordinates(37, 127)
    );

    const ids = sorted.map((h) => h.id);
    expect(ids.length).toBe(4);
    expect(ids.slice(0, 2)).toEqual(['h4', 'h1']);
    expect(ids.slice(2)).toEqual(expect.arrayContaining(['h2', 'h3']));
  });

  it('거리순 및 병상순은 -1로 인해 왜곡되지 않음', () => {
    const loc = new Coordinates(37.0, 127.0);
    const h1 = new Hospital('h1', 'H1', new Coordinates(37.1, 127.1), '', '', '', 5, 10, [], 1, true, new Date(), true, true, true).withRouteInfo(-1, -1);
    const h2 = new Hospital('h2', 'H2', new Coordinates(37.2, 127.2), '', '', '', 15, 20, [], 1, true, new Date(), true, true, true).withRouteInfo(600, 1000);

    const distSorted = HospitalSortService.sortHospitals([h2, h1], 'DISTANCE', loc);
    expect(distSorted.length).toBeGreaterThan(0);
    expect(distSorted.map(h => h.id)[0]).toBe('h1');

    const bedSorted = HospitalSortService.sortHospitals([h2, h1], 'BEDS', loc);
    expect(bedSorted.length).toBeGreaterThan(0);
    expect(bedSorted.map(h => h.id)[0]).toBe('h2');

    const bedSorted2 = HospitalSortService.sortHospitals([h1, h2], 'BEDS', loc);
    expect(bedSorted2.length).toBeGreaterThan(0);
    expect(bedSorted2.map(h => h.id)[0]).toBe('h2');
  });

  describe('3-State Capabilities and RED Triage', () => {
    it('Available만 가점을 받고 Unavailable과 Unknown은 0점', () => {
      // hAvail: 모두 true, hUnavail: 모두 false, hUnknown: 모두 null
      const hAvail = new Hospital('hA', 'H_A', new Coordinates(37, 127), '', '', '', 10, 20, [], 1, true, new Date(), true, true, true, true, true);
      const hUnavail = new Hospital('hU', 'H_U', new Coordinates(37, 127), '', '', '', 10, 20, [], 1, true, new Date(), false, false, false, false, false);
      const hUnknown = new Hospital('hX', 'H_X', new Coordinates(37, 127), '', '', '', 10, 20, [], 1, true, new Date(), null, null, null, null, null);

      const params = {
        ...mockParams,
        capabilities: ['emergency_surgery', 'brain_imaging', 'icu']
      } satisfies MediMatrixParams;

      const result = HospitalRankingService.rankHospitals([hAvail, hUnavail, hUnknown], 'brain_lesion_demo', params);
      
      const sAvail = result.scoreMap.get('hA')!;
      const sUnavail = result.scoreMap.get('hU')!;
      const sUnknown = result.scoreMap.get('hX')!;

      expect(sAvail.capabilityScore).toBeGreaterThan(0);
      expect(sAvail.icuProxyScore).toBeGreaterThan(0);

      expect(sUnavail.capabilityScore).toBe(0);
      expect(sUnavail.icuProxyScore).toBe(0);

      expect(sUnknown.capabilityScore).toBe(0);
      expect(sUnknown.icuProxyScore).toBe(0);
    });

    it('RED 필수 역량 Unknown 병원의 후순위 정렬 (hasCriticalUnknowns)', () => {
      // hKnown: capability가 false이더라도 known 상태
      const hKnown = new Hospital('hKnown', 'Known', new Coordinates(37, 127), '', '', '', 10, 20, [], 1, true, new Date(), false, false, false, false, false).withRouteInfo(600, 1000);
      // hUnknown: capability가 null (unknown) 상태
      const hUnknown = new Hospital('hUnknown', 'Unknown', new Coordinates(37, 127), '', '', '', 20, 20, [], 1, true, new Date(), null, null, null, null, null).withRouteInfo(300, 500); // 훨씬 조건이 좋음

      const params = {
        ...mockParams,
        triage: 'RED', // RED 에서는 Unknown이 페널티(후순위)
        capabilities: ['emergency_surgery']
      } satisfies MediMatrixParams;

      const result = HospitalRankingService.rankHospitals([hUnknown, hKnown], 'brain_lesion_demo', params);
      
      // RED이므로 Unknown 병원은 아무리 점수가 높거나 시간이 짧아도 뒤로 밀려야 함
      expect(result.hospitals[0]?.id).toBe('hKnown');
      expect(result.hospitals[1]?.id).toBe('hUnknown');
    });

    it('동일 조건에서 정렬 Comparator가 안정적으로 동작하는지 (ID Fallback)', () => {
      // 점수, 시간, unknown 여부가 모두 동일한 병원 2개
      const h1 = new Hospital('C_Hosp', 'HospC', new Coordinates(37, 127), '', '', '', 10, 20, [], 1, true, new Date(), true, true, true, true, true).withRouteInfo(600, 1000);
      const h2 = new Hospital('A_Hosp', 'HospA', new Coordinates(37, 127), '', '', '', 10, 20, [], 1, true, new Date(), true, true, true, true, true).withRouteInfo(600, 1000);

      const params = {
        ...mockParams,
        capabilities: ['emergency_surgery']
      } satisfies MediMatrixParams;

      const result = HospitalRankingService.rankHospitals([h1, h2], 'brain_lesion_demo', params);
      
      // 완벽히 동일 조건이면 id 문자열 오름차순 (A_Hosp -> C_Hosp)
      expect(result.hospitals[0]?.id).toBe('A_Hosp');
      expect(result.hospitals[1]?.id).toBe('C_Hosp');
    });
  });
});


