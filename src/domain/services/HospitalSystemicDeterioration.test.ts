import { describe, expect, it } from 'vitest';
import { Hospital } from '../entities/Hospital';
import { Coordinates } from '../valueObjects/Coordinates';
import { HospitalAICardService } from './HospitalAICardService';
import { AIAnalysisContext } from '../types/AIContext';

describe('HospitalAICardService RED systemic deterioration', () => {
  it('matches the explicit Medi-Matrix resource requirements without inferring extra resources', () => {
    const hospital = new Hospital(
      'H001',
      'Demo Hospital',
      new Coordinates(35.2, 128.7),
      'Demo address',
      '055-000-0000',
      null,
      10,
      0,
      [],
      null,
      true,
      new Date(),
      true,
      true,
      true,
      undefined,
      600,
      2400,
      5,
      0
    );

    const context: AIAnalysisContext = {
      triage: 'RED',
      primaryCondition: 'systemic_deterioration_demo',
      secondaryConditions: ['brain_lesion_demo'],
      analysisMode: 'synthetic_demo',
      analysisSources: ['mri', 'vitals'],
      capabilities: ['emergency_room', 'icu', 'brain_imaging'],
      specialties: [],
      clinicalValidation: false,
    };

    const result = HospitalAICardService.evaluateMatch(hospital, context);
    expect(result).not.toBeNull();
    expect(result!.matchedReasons).toContain('응급실 가용 10병상');
    expect(result!.matchedReasons).toContain('ICU 가용 5병상');
    expect(result!.matchedReasons).toContain('영상 장비(CT/MRI) 가용');
    expect(result!.matchedReasons).not.toContain('응급실 운영');
    expect(result!.matchedReasons).not.toContain('수술실 가용');
    expect(result!.score).toBe(result!.maxScore);
  });
});
