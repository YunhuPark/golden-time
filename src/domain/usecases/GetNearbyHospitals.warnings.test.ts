import { afterEach, describe, expect, it, vi } from 'vitest';
import { Coordinates } from '../valueObjects/Coordinates';
import { Hospital } from '../entities/Hospital';
import { IHospitalRepository } from '../repositories/IHospitalRepository';
import { GetNearbyHospitals } from './GetNearbyHospitals';

const USER = new Coordinates(37.5665, 126.978);

interface HospitalOverrides {
  id?: string;
  availableBeds?: number;
  isOperating?: boolean;
  lastUpdated?: Date;
}

const hospital = (overrides: HospitalOverrides = {}): Hospital =>
  new Hospital(
    overrides.id ?? 'H1',
    `응급실 ${overrides.id ?? 'H1'}`,
    new Coordinates(37.5, 127),
    '서울특별시 테스트로 1',
    '02-0000-0000',
    null,
    overrides.availableBeds ?? 3,
    0,
    ['응급의학과'],
    null,
    overrides.isOperating ?? true,
    overrides.lastUpdated ?? new Date(),
    false,
    false,
    false,
  );

/** 저장소를 흉내낸다. coverage가 주어지면 부분 커버리지 경고를 발생시킨다. */
const repositoryReturning = (
  hospitals: Hospital[],
  coverage?: { failedRegions: string[]; discoveryFailed: boolean }
): IHospitalRepository => ({
  findNearby: vi.fn(async (_coords, _ctx, onInitial, onCoverageWarning) => {
    onInitial?.(hospitals);
    if (coverage) onCoverageWarning?.(coverage.failedRegions, coverage.discoveryFailed);
    return hospitals;
  }),
  findByRegion: vi.fn(),
  findById: vi.fn(),
});

const execute = (repository: IHospitalRepository) =>
  new GetNearbyHospitals(repository).execute(USER);

describe('GetNearbyHospitals 경고 선택', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('정상이면 경고가 없다', async () => {
    const result = await execute(repositoryReturning([hospital()]));

    expect(result.warning).toBeNull();
    expect(result.hospitals).toHaveLength(1);
  });

  it('운영 중인 응급실이 없으면 119 안내를 띄우고 목록은 그대로 돌려준다', async () => {
    const closed = [hospital({ id: 'C1', isOperating: false })];

    const result = await execute(repositoryReturning(closed));

    expect(result.warning?.type).toBe('NO_HOSPITALS_FOUND');
    expect(result.warning?.action?.type).toBe('CALL_119');
    expect(result.hospitals).toHaveLength(1);
  });

  it('운영 중이지만 전부 만실이면 만실 경고를 띄운다', async () => {
    const full = [hospital({ id: 'F1', availableBeds: 0 })];

    const result = await execute(repositoryReturning(full));

    expect(result.warning?.type).toBe('NO_BEDS_AVAILABLE');
    expect(result.warning?.action?.type).toBe('CALL_119');
  });

  // 미운영 병원이 병상을 보고해도 갈 수 있는 응급실은 아니다.
  it('병상이 남은 곳이 미운영뿐이면 만실로 본다', async () => {
    const hospitals = [
      hospital({ id: 'OPEN', availableBeds: 0, isOperating: true }),
      hospital({ id: 'CLOSED', availableBeds: 9, isOperating: false }),
    ];

    const result = await execute(repositoryReturning(hospitals));

    expect(result.warning?.type).toBe('NO_BEDS_AVAILABLE');
  });

  it('오래된 정보가 섞여 있으면 새로고침을 안내한다', async () => {
    const stale = [hospital({ lastUpdated: new Date(Date.now() - 10 * 60 * 1000) })];

    const result = await execute(repositoryReturning(stale));

    expect(result.warning?.type).toBe('DATA_STALE');
    expect(result.warning?.action?.type).toBe('REFRESH_DATA');
  });

  it('부분 커버리지 경고가 오래된 정보 경고보다 우선한다', async () => {
    const stale = [hospital({ lastUpdated: new Date(Date.now() - 10 * 60 * 1000) })];

    const result = await execute(
      repositoryReturning(stale, { failedRegions: ['경기도'], discoveryFailed: false })
    );

    expect(result.warning?.type).toBe('PARTIAL_COVERAGE');
  });

  // 검색 범위를 일부 못 불러온 상태에서 "없다"고 단정하면, 사용자는 확인되지
  // 않은 응급실이 있다는 사실을 모른 채 판단하게 된다.
  describe('부분 커버리지가 단정적 경고와 겹칠 때', () => {
    it('운영 중인 곳이 없다고 단정하지 않는다', async () => {
      const closed = [hospital({ id: 'C1', isOperating: false })];

      const result = await execute(
        repositoryReturning(closed, { failedRegions: ['경기도'], discoveryFailed: false })
      );

      expect(result.warning?.type).toBe('NO_HOSPITALS_FOUND');
      expect(result.warning?.message).toMatch(/확인되지 않은 응급실/);
      expect(result.warning?.action?.type).toBe('CALL_119');
    });

    it('모두 만실이라고 단정하지 않는다', async () => {
      const full = [hospital({ id: 'F1', availableBeds: 0 })];

      const result = await execute(
        repositoryReturning(full, { failedRegions: [], discoveryFailed: true })
      );

      expect(result.warning?.type).toBe('NO_BEDS_AVAILABLE');
      expect(result.warning?.message).toMatch(/확인되지 않은 응급실/);
    });

    it('커버리지가 온전하면 단서를 붙이지 않는다', async () => {
      const full = [hospital({ id: 'F1', availableBeds: 0 })];

      const result = await execute(repositoryReturning(full));

      expect(result.warning?.message).not.toMatch(/확인되지 않은 응급실/);
    });
  });

  it('초기 결과 콜백에는 운영 중인 병원만 넘긴다', async () => {
    const hospitals = [
      hospital({ id: 'OPEN', isOperating: true }),
      hospital({ id: 'CLOSED', isOperating: false }),
    ];
    const onInitial = vi.fn();

    await new GetNearbyHospitals(repositoryReturning(hospitals)).execute(USER, null, onInitial);

    expect(onInitial).toHaveBeenCalledWith([expect.objectContaining({ id: 'OPEN' })]);
  });

  it('저장소가 실패하면 그대로 전파한다', async () => {
    const repository: IHospitalRepository = {
      findNearby: vi.fn(async () => {
        throw new Error('E-Gen 조회 실패');
      }),
      findByRegion: vi.fn(),
      findById: vi.fn(),
    };

    await expect(execute(repository)).rejects.toThrow('E-Gen 조회 실패');
  });
});
