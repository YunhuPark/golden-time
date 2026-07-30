import { describe, it, expect } from 'vitest';
import { HospitalAICardService } from './HospitalAICardService';
import { Hospital } from '../entities/Hospital';
import { Coordinates } from '../valueObjects/Coordinates';
import { AIAnalysisContext } from '../types/AIContext';

const mockCoords = new Coordinates(37.0, 127.0);

const createHospital = (overrides: Partial<Hospital>): Hospital => {
  return new Hospital(
    'A001',
    overrides.name || 'Test Hospital',
    mockCoords,
    'Address',
    '010',
    null,
    overrides.availableBeds ?? 10,
    overrides.totalBeds ?? 20,
    overrides.specializations ?? [],
    null,
    overrides.isOperating ?? true,
    new Date(),
    overrides.hasCT ?? false,
    overrides.hasMRI ?? false,
    overrides.hasSurgery ?? false
  );
};

describe('HospitalAICardService', () => {
  it('should return null for normal access (aiContext is null)', () => {
    const hospital = createHospital({});
    const result = HospitalAICardService.evaluateMatch(hospital, null);
    expect(result).toBeNull();
  });

  it('should match capabilities correctly', () => {
    const hospital = createHospital({
      hasCT: true,
      hasMRI: false,
      hasSurgery: true,
      availableBeds: 5,
    });

    const context: AIAnalysisContext = {
      primaryCondition: 'sepsis_demo',
      triage: 'RED',
      capabilities: ['응급실 운영', 'CT', 'MRI', '수술'],
      specialties: [],
      analysisMode: 'synthetic_demo',
      analysisSources: [],
      clinicalValidation: false
    };

    const result = HospitalAICardService.evaluateMatch(hospital, context);
    expect(result).not.toBeNull();
    // sepsis_demo expects: 1) isOperating(10), 2) availableBeds(10), 3) internal_medicine/icu(10)
    // Here we did not provide icu or internal medicine, so maxScore is 20 and score is 20
    expect(result!.score).toBe(20);
    expect(result!.maxScore).toBe(20);
    
    expect(result!.matchedReasons).toContain('응급실 운영');
    expect(result!.matchedReasons).toContain('가용 병상 5개');
  });

  it('should not do automatic text matching like "대학" unless specified in capabilities', () => {
    const hospital = createHospital({ name: '서울대학교병원', availableBeds: 0, isOperating: false });
    const context: AIAnalysisContext = {
      primaryCondition: 'unknown_demo',
      triage: 'YELLOW',
      capabilities: [],
      specialties: [],
      analysisMode: 'synthetic_demo',
      analysisSources: [],
      clinicalValidation: false
    };
    
    const result = HospitalAICardService.evaluateMatch(hospital, context);
    expect(result).not.toBeNull();
    expect(result!.score).toBe(0); // 대학병원이라고 점수 주지 않음 (isOperating false, availableBeds 0)
  });
});
