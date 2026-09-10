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
