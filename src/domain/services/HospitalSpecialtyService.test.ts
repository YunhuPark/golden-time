import { describe, it, expect, beforeEach } from 'vitest';
import { HospitalSpecialtyService, SpecialtyData } from './HospitalSpecialtyService';
import { Hospital } from '../entities/Hospital';
import { Coordinates } from '../valueObjects/Coordinates';

describe('HospitalSpecialtyService - Fallback collision prevention', () => {
  beforeEach(() => {
    // Reset internal state
    (HospitalSpecialtyService as any).dbSpecialtiesByHpid = {};
    (HospitalSpecialtyService as any).dbSpecialtiesByName = {};
  });

  const createMockHospital = (id: string, name: string) => {
    return new Hospital(
      id,
      name,
      new Coordinates(37, 127),
      '주소',
      '전화',
      '응급전화',
      10,
      100,
      ['내과'],
      null,
      true,
      new Date(),
      true,
      true,
      true
    );
  };

  const createMockSpecialtyData = (hpid: string, hospital_name: string, specialties: string[], confidence_score: number = 90): SpecialtyData => {
    return {
      hpid,
      hospital_name,
      specialties,
      confidence_score,
      inferred_from: 'test',
      last_updated_at: new Date().toISOString()
    };
  };

  it('should match by hpid perfectly', () => {
    const hospital = createMockHospital('HP123', '세브란스병원');
    const data = createMockSpecialtyData('HP123', '세브란스병원', ['패혈증']);
    
    (HospitalSpecialtyService as any).dbSpecialtiesByHpid['HP123'] = data;

    const score = HospitalSpecialtyService.getDiseaseSpecialtyScore(hospital, '패혈증');
    expect(score).toBeGreaterThan(0);
  });

  it('should use name fallback if hpid is not found but exact match exists', () => {
    const hospital = createMockHospital('NO_MATCH', '세브란스 병원');
    const data = createMockSpecialtyData('HP_REAL', '세브란스병원', ['패혈증']);
    
    // normName will be '세브란스병원'
    (HospitalSpecialtyService as any).dbSpecialtiesByName['세브란스병원'] = [data];

    const score = HospitalSpecialtyService.getDiseaseSpecialtyScore(hospital, '패혈증');
    expect(score).toBeGreaterThan(0);
  });

  it('should return 0 score when name fallback is ambiguous (2 or more candidates)', () => {
    const hospital = createMockHospital('NO_MATCH', '고대병원');
    
    const data1 = createMockSpecialtyData('HP_1', '고대병원', ['패혈증']);
    const data2 = createMockSpecialtyData('HP_2', '고대병원', ['패혈증']);
    
    // normName will be '고대병원'
    (HospitalSpecialtyService as any).dbSpecialtiesByName['고대병원'] = [data1, data2];

    const score = HospitalSpecialtyService.getDiseaseSpecialtyScore(hospital, '패혈증');
    expect(score).toBe(0); // Should be 0 due to ambiguous match
  });

  it('should return 0 score for invalid confidence_score (NaN, <0, >100)', () => {
    const hospital = createMockHospital('HP_TEST', '테스트병원');
    
    const invalidScores = [NaN, -10, 110];
    for (const score of invalidScores) {
      (HospitalSpecialtyService as any).dbSpecialtiesByHpid['HP_TEST'] = createMockSpecialtyData('HP_TEST', '테스트병원', ['패혈증'], score);
      expect(HospitalSpecialtyService.getDiseaseSpecialtyScore(hospital, '패혈증')).toBe(0);
    }
  });

  it('should return 0 score for stale or empty data (no_data, ai_empty, older than 30 days)', () => {
    const hospital = createMockHospital('HP_TEST', '테스트병원');
    
    const staleData = createMockSpecialtyData('HP_TEST', '테스트병원', ['패혈증']);
    staleData.inferred_from = 'no_data';
    (HospitalSpecialtyService as any).dbSpecialtiesByHpid['HP_TEST'] = staleData;
    expect(HospitalSpecialtyService.getDiseaseSpecialtyScore(hospital, '패혈증')).toBe(0);

    const emptyData = createMockSpecialtyData('HP_TEST', '테스트병원', ['패혈증']);
    emptyData.inferred_from = 'ai_empty';
    (HospitalSpecialtyService as any).dbSpecialtiesByHpid['HP_TEST'] = emptyData;
    expect(HospitalSpecialtyService.getDiseaseSpecialtyScore(hospital, '패혈증')).toBe(0);

    const oldDateData = createMockSpecialtyData('HP_TEST', '테스트병원', ['패혈증']);
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 31);
    oldDateData.last_updated_at = pastDate.toISOString();
    (HospitalSpecialtyService as any).dbSpecialtiesByHpid['HP_TEST'] = oldDateData;
    expect(HospitalSpecialtyService.getDiseaseSpecialtyScore(hospital, '패혈증')).toBe(0);
  });
});
