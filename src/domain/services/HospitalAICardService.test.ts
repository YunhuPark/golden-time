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
    overrides.totalBeds ?? 10,
    overrides.specializations ?? [],
    null,
    overrides.isOperating ?? true,
    new Date(),
    overrides.hasCT ?? false,
    overrides.hasMRI ?? false,
    overrides.hasSurgery ?? false,
    undefined,
    undefined,
    undefined,
    overrides.icuAvailableBeds ?? 0,
    overrides.neuroIcuAvailableBeds ?? 0
  );
};

const context = (primaryCondition: string, triage: string, secondaryConditions: string[] = []): AIAnalysisContext => ({
  primaryCondition,
  secondaryConditions,
  triage,
  capabilities: [],
  specialties: [],
  analysisMode: 'synthetic_demo',
  analysisSources: [],
  clinicalValidation: false,
});

describe('HospitalAICardService', () => {
  it('returns null for normal access', () => {
    expect(HospitalAICardService.evaluateMatch(createHospital({}), null)).toBeNull();
  });

  it('scores systemic deterioration using ER and ICU real-time resources', () => {
    const hospital = createHospital({ availableBeds: 5, icuAvailableBeds: 2, isOperating: true });
    const result = HospitalAICardService.evaluateMatch(hospital, context('sepsis_demo', 'RED'))!;

    expect(result.score).toBe(20);
    expect(result.maxScore).toBe(20);
    expect(result.matchedReasons).toContain('응급실 가용 5병상');
    expect(result.matchedReasons).toContain('일반 ICU 가용 2병상');
    expect(result.matchedReasons).toContain('응급실 운영');
  });

  it('scores brain response using imaging, surgery and neuro ICU resources', () => {
    const hospital = createHospital({ hasMRI: true, hasSurgery: true, neuroIcuAvailableBeds: 1 });
    const result = HospitalAICardService.evaluateMatch(hospital, context('brain_lesion_demo', 'YELLOW'))!;

    expect(result.score).toBe(25);
    expect(result.maxScore).toBe(25);
    expect(result.matchedReasons).toContain('영상 장비(CT/MRI) 가용');
    expect(result.matchedReasons).toContain('수술실 가용');
    expect(result.matchedReasons).toContain('신경 ICU 가용 1병상');
  });

  it('includes secondary brain condition only for RED composite triage', () => {
    const hospital = createHospital({
      availableBeds: 5,
      icuAvailableBeds: 2,
      hasCT: true,
      hasSurgery: true,
      neuroIcuAvailableBeds: 1,
    });

    const red = HospitalAICardService.evaluateMatch(
      hospital,
      context('sepsis_demo', 'RED', ['brain_lesion_demo'])
    )!;
    const yellow = HospitalAICardService.evaluateMatch(
      hospital,
      context('sepsis_demo', 'YELLOW', ['brain_lesion_demo'])
    )!;

    expect(red.maxScore).toBe(45);
    expect(yellow.maxScore).toBe(20);
  });

  it('does not infer capability from hospital name', () => {
    const hospital = createHospital({ name: '서울대학교병원', availableBeds: 0, isOperating: false });
    const result = HospitalAICardService.evaluateMatch(hospital, context('unknown_demo', 'YELLOW'))!;
    expect(result.score).toBe(0);
  });
});
