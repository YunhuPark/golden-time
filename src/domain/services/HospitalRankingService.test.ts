import { describe, it, expect, vi } from 'vitest';
import { HospitalRankingService } from './HospitalRankingService';
import { Hospital } from '../entities/Hospital';
import { Coordinates } from '../valueObjects/Coordinates';

type RankingServiceTestAccess = {
  calculateScore: (hospital: Hospital, allHospitals: Hospital[]) => number;
};

describe('HospitalRankingService', () => {
  const createHospital = (
    id: string,
    routeDuration: number | undefined,
    routeDistance: number | undefined
  ): Hospital => {
    return new Hospital(
      id,
      `Hospital ${id}`,
      new Coordinates(37.5665, 126.978),
      'Seoul',
      '02-1234-5678',
      '02-1234-5678',
      10,
      20,
      ['내과'],
      null,
      true,
      new Date(),
      true,
      true,
      true,
      undefined,
      routeDuration,
      routeDistance
    );
  };

  describe('Secondary Sorting (Tie Breaker)', () => {
    it('should correctly sort hospitals with identical scores using route time and direct distance fallbacks', () => {
      const h1 = createHospital('1', 600, 5000);
      const h2 = createHospital('2', undefined, undefined);
      const h3 = createHospital('3', 300, 3000);
      const h4 = createHospital('4', undefined, undefined);
      const hospitals = [h1, h2, h3, h4];

      const service = HospitalRankingService as unknown as RankingServiceTestAccess;
      const originalCalculateScore = service.calculateScore;
      service.calculateScore = vi.fn(() => 50);

      try {
        const ranked = HospitalRankingService.rankHospitals(hospitals, null);

        expect(ranked[0]?.id).toBe('3');
        expect(ranked[1]?.id).toBe('1');
        expect(ranked[2]?.id).toBe('2');
        expect(ranked[3]?.id).toBe('4');
      } finally {
        service.calculateScore = originalCalculateScore;
      }
    });
  });
});

describe('HospitalRankingService 점수 구성', () => {
  const hospital = (
    id: string,
    options: {
      routeDuration?: number;
      availableBeds?: number;
      traumaLevel?: 1 | 2 | 3 | null;
      isOperating?: boolean;
    } = {}
  ): Hospital =>
    new Hospital(
      id,
      `병원 ${id}`,
      new Coordinates(37.5665, 126.978),
      '서울특별시 중구',
      '02-000-0000',
      null,
      options.availableBeds ?? 0,
      0,
      [],
      options.traumaLevel ?? null,
      options.isOperating ?? true,
      new Date('2026-09-11T14:45:00+09:00'),
      false,
      false,
      false,
      undefined,
      options.routeDuration,
    );

  const analyze = (target: Hospital, all: Hospital[] = [target]) =>
    HospitalRankingService.analyzeHospitalScore(target, all);

  describe('이동시간 점수', () => {
    it('가장 빠른 병원이 만점, 가장 느린 병원이 0점을 받는다', () => {
      const fast = hospital('fast', { routeDuration: 100 });
      const slow = hospital('slow', { routeDuration: 900 });
      const all = [fast, slow];

      expect(analyze(fast, all).timeScore).toBe(40);
      expect(analyze(slow, all).timeScore).toBe(0);
    });

    it('경로 정보가 없으면 0점이다', () => {
      const noRoute = hospital('none');
      const withRoute = hospital('some', { routeDuration: 300 });

      expect(analyze(noRoute, [noRoute, withRoute]).timeScore).toBe(0);
    });

    // 회귀 방지: falsy 검사를 쓰면 0초(바로 옆)가 "경로 없음"으로 취급되어
    // 기본 정렬인 추천순에서 최하점을 받는다.
    it('0초 경로는 경로 없음이 아니라 최고점이다', () => {
      const adjacent = hospital('adjacent', { routeDuration: 0 });
      const far = hospital('far', { routeDuration: 900 });
      const all = [adjacent, far];

      expect(analyze(adjacent, all).timeScore).toBe(40);
      expect(analyze(far, all).timeScore).toBe(0);
    });

    it('소요시간이 모두 같으면 전부 만점이다', () => {
      const a = hospital('a', { routeDuration: 300 });
      const b = hospital('b', { routeDuration: 300 });

      expect(analyze(a, [a, b]).timeScore).toBe(40);
    });
  });

  describe('병상 점수', () => {
    it.each([
      [0, 0],
      [1, 15],
      [4, 15],
      [5, 24],
      [10, 30],
      [50, 30],
    ])('가용 병상 %i개는 %i점이다', (beds, expected) => {
      expect(analyze(hospital('h', { availableBeds: beds })).bedScore).toBe(expected);
    });

    it('병상이 많을수록 점수가 줄지 않는다', () => {
      const scores = [0, 1, 4, 5, 7, 9, 10, 20].map(
        (beds) => analyze(hospital('h', { availableBeds: beds })).bedScore
      );

      expect(scores).toEqual([...scores].sort((a, b) => a - b));
    });
  });

  describe('외상센터 점수', () => {
    it.each([
      [1, 20],
      [2, 15],
      [3, 10],
    ] as const)('등급 %i은 %i점이다', (level, expected) => {
      expect(analyze(hospital('h', { traumaLevel: level })).traumaScore).toBe(expected);
    });

    it('등급이 없으면 최저 점수를 받되 0은 아니다', () => {
      expect(analyze(hospital('h', { traumaLevel: null })).traumaScore).toBe(5);
    });
  });

  describe('운영 점수', () => {
    it('운영 중이면 10점, 아니면 0점이다', () => {
      expect(analyze(hospital('h', { isOperating: true })).operatingScore).toBe(10);
      expect(analyze(hospital('h', { isOperating: false })).operatingScore).toBe(0);
    });
  });

  describe('rankHospitals', () => {
    it('총점이 높은 병원을 앞에 둔다', () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});
      const better = hospital('better', { routeDuration: 100, availableBeds: 10, traumaLevel: 1 });
      const worse = hospital('worse', { routeDuration: 900, availableBeds: 0, traumaLevel: null });

      const ranked = HospitalRankingService.rankHospitals([worse, better]);

      expect(ranked.map((h) => h.id)).toEqual(['better', 'worse']);
      vi.restoreAllMocks();
    });

    it('병원이 하나뿐이면 그대로 돌려준다', () => {
      const only = [hospital('only', { routeDuration: 100 })];

      expect(HospitalRankingService.rankHospitals(only)).toBe(only);
    });
  });
});
