import { describe, it, expect, vi } from 'vitest';
import { HospitalRankingService } from './HospitalRankingService';
import { Hospital } from '../entities/Hospital';
import { Coordinates } from '../valueObjects/Coordinates';

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
      10, // availableBeds
      20, // totalBeds
      ['내과'],
      null, // traumaLevel
      true, // isOperating
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
      // 4 hospitals with identical conditions but different route info
      const h1 = createHospital('1', 600, 5000); // Route time 10 min
      const h2 = createHospital('2', undefined, undefined); // No route time (initially sorted distance: closer)
      const h3 = createHospital('3', 300, 3000); // Route time 5 min
      const h4 = createHospital('4', undefined, undefined); // No route time (initially sorted distance: further)
      
      const hospitals = [h1, h2, h3, h4];
      
      // Override calculateScore temporarily for the test to return identical scores
      const originalCalculateScore = (HospitalRankingService as any).calculateScore;
      (HospitalRankingService as any).calculateScore = vi.fn(() => 50); // all get 50 points

      try {
        const ranked = HospitalRankingService.rankHospitals(hospitals, null);
        
        expect(ranked[0]?.id).toBe('3');
        expect(ranked[1]?.id).toBe('1');
        expect(ranked[2]?.id).toBe('2');
        expect(ranked[3]?.id).toBe('4');
      } finally {
        // Restore
        (HospitalRankingService as any).calculateScore = originalCalculateScore;
      }
    });
  });
});
