import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hospital } from '../entities/Hospital';
import { Coordinates } from '../valueObjects/Coordinates';

const selectMock = vi.fn();

vi.mock('../../infrastructure/supabase/supabaseClient', () => ({
  supabase: { from: () => ({ select: selectMock }) },
  supabaseOptionalFeaturesEnabled: true,
}));

const { HospitalSpecialtyService } = await import('./HospitalSpecialtyService');

const hospital = (id: string, name: string, traumaLevel: 1 | 2 | 3 | null = null): Hospital =>
  new Hospital(
    id,
    name,
    new Coordinates(35.1524229, 126.8539184),
    '광주광역시 서구',
    '062-000-0000',
    null,
    5,
    0,
    [],
    traumaLevel,
    true,
    new Date('2026-09-11T14:45:00+09:00'),
    false,
    false,
    false,
  );

const rows = (data: unknown[]) => {
  selectMock.mockResolvedValue({ data, error: null });
};

describe('HospitalSpecialtyService', () => {
  beforeEach(() => {
    HospitalSpecialtyService.reset();
    selectMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hpid로 특화 분야를 찾는다', async () => {
    rows([
      { hpid: 'A1500022', specialties: ['심혈관', '심근경색'], confidence_score: 90, inferred_from: 'ai_crawler' },
    ]);
    await HospitalSpecialtyService.load();

    const info = HospitalSpecialtyService.getSpecialtyInfo(hospital('A1500022', '상무병원'));

    expect(info).toEqual({
      specialties: ['심혈관', '심근경색'],
      confidenceScore: 90,
      inferredFrom: 'ai_crawler',
    });
  });

  // 예전에는 병원명 부분일치로 DB를 뒤져서, 이름이 겹치는 다른 병원의 정보를
  // 가져올 수 있었다.
  it('이름이 비슷해도 hpid가 다르면 가져오지 않는다', async () => {
    rows([
      { hpid: 'A1500022', specialties: ['심혈관'], confidence_score: 90, inferred_from: 'ai_crawler' },
    ]);
    await HospitalSpecialtyService.load();

    expect(HospitalSpecialtyService.getSpecialties(hospital('A9999999', '상무병원부속의원'))).toEqual([]);
  });

  // 회귀 방지: 이름에 '뇌'나 '대학'이 들어간다고 임상 역량을 주장하면 안 된다.
  it.each([
    ['뇌신경외과병원'],
    ['서울대학교병원'],
    ['심장전문병원'],
  ])('%s 이름만으로 특화 분야를 만들어내지 않는다', async (name) => {
    rows([]);
    await HospitalSpecialtyService.load();

    expect(HospitalSpecialtyService.getSpecialties(hospital('A1500022', name))).toEqual([]);
  });

  it('외상센터 등급으로도 특화 분야를 만들어내지 않는다', async () => {
    rows([]);
    await HospitalSpecialtyService.load();

    expect(HospitalSpecialtyService.getSpecialties(hospital('A1500022', '상무병원', 1))).toEqual([]);
  });

  it('수집 실패로 빈 값이 기록된 병원은 담지 않는다', async () => {
    rows([
      { hpid: 'A1500022', specialties: [], confidence_score: 0, inferred_from: 'no_data' },
    ]);
    await HospitalSpecialtyService.load();

    expect(HospitalSpecialtyService.getSpecialtyInfo(hospital('A1500022', '상무병원'))).toBeNull();
  });

  it('신뢰도가 없으면 null로 둔다', async () => {
    rows([
      { hpid: 'A1500022', specialties: ['중증외상'], confidence_score: null, inferred_from: null },
    ]);
    await HospitalSpecialtyService.load();

    expect(HospitalSpecialtyService.getSpecialtyInfo(hospital('A1500022', '상무병원'))).toEqual({
      specialties: ['중증외상'],
      confidenceScore: null,
      inferredFrom: 'unknown',
    });
  });

  it('두 번 불러도 한 번만 조회한다', async () => {
    rows([{ hpid: 'A1500022', specialties: ['심혈관'], confidence_score: 90, inferred_from: 'ai_crawler' }]);

    await HospitalSpecialtyService.load();
    await HospitalSpecialtyService.load();

    expect(selectMock).toHaveBeenCalledTimes(1);
  });

  it('조회에 실패해도 예외를 던지지 않고 비워둔다', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    selectMock.mockResolvedValue({ data: null, error: { message: 'boom' } });

    await expect(HospitalSpecialtyService.load()).resolves.toBeUndefined();
    expect(HospitalSpecialtyService.getSpecialties(hospital('A1500022', '상무병원'))).toEqual([]);
  });

  describe('hasSpecialtyMatch', () => {
    beforeEach(async () => {
      rows([
        { hpid: 'A1500022', specialties: ['중증외상'], confidence_score: 90, inferred_from: 'ai_crawler' },
      ]);
      await HospitalSpecialtyService.load();
    });

    it('표기 차이는 흡수한다', () => {
      expect(HospitalSpecialtyService.hasSpecialtyMatch(hospital('A1500022', '상무병원'), ' 중증외상 ')).toBe(true);
    });

    // 예전에는 양방향 부분일치라 '외상'만 스쳐도 참이 됐다.
    it('부분적으로 겹치는 질환명은 일치로 보지 않는다', () => {
      expect(HospitalSpecialtyService.hasSpecialtyMatch(hospital('A1500022', '상무병원'), '외상')).toBe(false);
      expect(HospitalSpecialtyService.hasSpecialtyMatch(hospital('A1500022', '상무병원'), '중증외상 후유증')).toBe(false);
    });

    it('빈 질환명은 일치로 보지 않는다', () => {
      expect(HospitalSpecialtyService.hasSpecialtyMatch(hospital('A1500022', '상무병원'), '')).toBe(false);
    });
  });
});
