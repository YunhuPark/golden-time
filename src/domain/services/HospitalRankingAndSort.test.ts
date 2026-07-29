import { describe, it, expect } from 'vitest';

// Mock Vite's import.meta.env before importing anything that depends on it
(global as any).import = { meta: { env: { VITE_SUPABASE_URL: 'mock', VITE_SUPABASE_ANON_KEY: 'mock' } } };

import { Hospital } from '../entities/Hospital';
import { Coordinates } from '../valueObjects/Coordinates';
import { HospitalRankingService } from './HospitalRankingService';
import { HospitalSortService } from './HospitalSortService';


function createDummyHospital(id: string, name: string, routeDuration: number | undefined | -1 = undefined): Hospital {
  const h = new Hospital(
    id, name, new Coordinates(37, 127), 'Address', '010', '010',
    10, 20, [], 1, true, new Date(), true, true, true
  );
  if (routeDuration === undefined) return h;
  if (routeDuration === -1) return h.withRouteInfo(-1, -1);
  return h.withRouteInfo(routeDuration, 1000);
}

describe('Ranking/Sort Service', () => {
  it('undefined 상태는 최고점/최저점이 아님 (기본 timeScore = 0)', () => {
    const h1 = createDummyHospital('h1', 'H1', 600);
    const h2 = createDummyHospital('h2', 'H2', undefined);
    
    const result = HospitalRankingService.rankHospitals([h1, h2], undefined, {
      triageLevel: 'RED',
      triggeringCondition: '패혈증',
      vitalsVolume: 1,
      capabilities: []
    });

    const h1Score = result.scoreMap.get('h1')!;
    const h2Score = result.scoreMap.get('h2')!;

    expect(h2Score.timeScore).toBe(0);
    expect(h1Score.timeScore).toBe(40);
  });

  it('-1 실패 상태는 시간 점수 0점', () => {
    const h1 = createDummyHospital('h1', 'H1', 600);
    const h3 = createDummyHospital('h3', 'H3', -1);

    const result = HospitalRankingService.rankHospitals([h1, h3], undefined, {
      triageLevel: 'RED',
      triggeringCondition: '심근경색',
      vitalsVolume: 1,
      capabilities: []
    });

    const h3Score = result.scoreMap.get('h3')!;
    expect(h3Score.timeScore).toBe(0);
  });

  it('일반 모드 최대 130점, 특화 모드 최대 145점', () => {
    const h1 = createDummyHospital('h1', 'H1', 600);
    
    const normalResult = HospitalRankingService.rankHospitals([h1]);
    const normalScore = normalResult.scoreMap.get('h1')!;
    expect(normalScore.totalScore).toBeLessThanOrEqual(130);
    
    const specializedResult = HospitalRankingService.rankHospitals([h1], undefined, {
      triageLevel: 'RED',
      triggeringCondition: 'Trauma',
      vitalsVolume: 1,
      capabilities: []
    });
    const specializedScore = specializedResult.scoreMap.get('h1')!;
    expect(specializedScore.totalScore).toBeLessThanOrEqual(145);
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

    expect(sorted[0].id).toBe('h4');
    expect(sorted[1].id).toBe('h1');
    expect(['h2', 'h3']).toContain(sorted[2].id);
    expect(['h2', 'h3']).toContain(sorted[3].id);
  });

  it('거리순 및 병상순은 -1로 인해 왜곡되지 않음', () => {
    const loc = new Coordinates(37.0, 127.0);
    const h1 = new Hospital('h1', 'H1', new Coordinates(37.1, 127.1), '', '', '', 5, 10, [], 1, true, new Date(), true, true, true).withRouteInfo(-1, -1);
    const h2 = new Hospital('h2', 'H2', new Coordinates(37.2, 127.2), '', '', '', 15, 20, [], 1, true, new Date(), true, true, true).withRouteInfo(600, 1000);

    const distSorted = HospitalSortService.sortHospitals([h2, h1], 'DISTANCE', loc);
    expect(distSorted[0].id).toBe('h1');

    const bedSorted = HospitalSortService.sortHospitals([h2, h1], 'BEDS', loc);
    expect(bedSorted[0].id).toBe('h2');
    const bedSorted2 = HospitalSortService.sortHospitals([h1, h2], 'BEDS', loc);
    expect(bedSorted2[0].id).toBe('h2');
  });
});

