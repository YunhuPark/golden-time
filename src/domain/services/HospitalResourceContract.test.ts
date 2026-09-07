import { describe, expect, it } from 'vitest';
import { Hospital } from '../entities/Hospital';
import { Coordinates } from '../valueObjects/Coordinates';
import { AIAnalysisContext } from '../types/AIContext';
import { HospitalAICardService } from './HospitalAICardService';

const createHospital = (options: {
  availableBeds?: number;
  icuAvailableBeds?: number;
  neuroIcuAvailableBeds?: number;
  hasCT?: boolean;
  hasMRI?: boolean;
  specializations?: ConstructorParameters<typeof Hospital>[8];
} = {}) => new Hospital(
  'H-resource',
  'Resource Contract Hospital',
  new Coordinates(37.5, 127.0),
  'Demo address',
  '02-0000-0000',
  null,
  options.availableBeds ?? 4,
  0,
  options.specializations ?? ['응급의학과', '내과', '신경외과', '신경과'],
  null,
  true,
  new Date(),
  options.hasCT ?? true,
  options.hasMRI ?? false,
  false,
  undefined,
  600,
  2000,
  options.icuAvailableBeds ?? 2,
  options.neuroIcuAvailableBeds ?? 1,
);

const explicitContext = (overrides: Partial<AIAnalysisContext> = {}): AIAnalysisContext => ({
  triage: 'RED',
  primaryCondition: 'systemic_deterioration_demo',
  secondaryConditions: ['brain_lesion_demo'],
  analysisMode: 'synthetic_demo',
  analysisSources: ['mri', 'vitals'],
  capabilities: ['emergency_room', 'icu', 'brain_imaging'],
  specialties: ['emergency_medicine', 'internal_medicine', 'neurosurgery', 'neurology'],
  clinicalValidation: false,
  ...overrides,
});

describe('HospitalAICardService explicit resource contract', () => {
  it('scores the resources explicitly handed off by Medi-Matrix', () => {
    const result = HospitalAICardService.evaluateMatch(createHospital(), explicitContext())!;

    expect(result.score).toBe(result.maxScore);
    expect(result.matchedReasons).toEqual(expect.arrayContaining([
      '응급실 가용 4병상',
      'ICU 가용 3병상',
      '영상 장비(CT/MRI) 가용',
      '응급의학과 진료과 확인',
      '내과 진료과 확인',
      '신경외과 진료과 확인',
      '신경과 진료과 확인',
    ]));
  });

  it('marks missing requested resources as unconfirmed instead of inferring them', () => {
    const hospital = createHospital({
      availableBeds: 0,
      icuAvailableBeds: 0,
      neuroIcuAvailableBeds: 0,
      hasCT: false,
      hasMRI: false,
      specializations: ['응급의학과'],
    });
    const result = HospitalAICardService.evaluateMatch(hospital, explicitContext())!;

    expect(result.unconfirmedReasons).toEqual(expect.arrayContaining([
      '응급실 가용병상 없음',
      'ICU 가용 확인필요',
      'CT/MRI 가용 확인필요',
      '내과 진료과 확인필요',
      '신경외과 진료과 확인필요',
      '신경과 진료과 확인필요',
    ]));
    expect(result.matchedReasons).toContain('응급의학과 진료과 확인');
  });

  it('ignores unrecognized capability and specialty identifiers', () => {
    const result = HospitalAICardService.evaluateMatch(
      createHospital(),
      explicitContext({
        capabilities: ['emergency_room', 'admin_override'],
        specialties: ['neurology', 'root_access'],
      }),
    )!;

    expect(result.maxScore).toBe(18);
    expect(result.matchedReasons).toEqual(expect.arrayContaining([
      '응급실 가용 4병상',
      '신경과 진료과 확인',
    ]));
    expect(result.matchedReasons.join(' ')).not.toMatch(/override|root/i);
    expect(result.unconfirmedReasons.join(' ')).not.toMatch(/override|root/i);
  });
});
