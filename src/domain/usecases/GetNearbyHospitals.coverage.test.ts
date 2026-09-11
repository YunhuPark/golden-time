import { describe, expect, it, vi } from 'vitest';
import { Coordinates } from '../valueObjects/Coordinates';
import { Hospital } from '../entities/Hospital';
import { IHospitalRepository } from '../repositories/IHospitalRepository';
import { GetNearbyHospitals } from './GetNearbyHospitals';

function hospital(): Hospital {
  return new Hospital(
    'H1',
    '테스트 응급실',
    new Coordinates(37.5, 127),
    '서울특별시 테스트로 1',
    '02-0000-0000',
    null,
    2,
    10,
    ['응급의학과'],
    3,
    true,
    new Date(),
    true,
    true,
    true,
    5,
    undefined,
    undefined,
    1,
    0
  );
}

describe('GetNearbyHospitals partial coverage warning', () => {
  it('returns a non-blocking warning when one regional query fails', async () => {
    const repository: IHospitalRepository = {
      findNearby: vi.fn(async (_coords, _ctx, onInitial, onCoverageWarning) => {
        const hospitals = [hospital()];
        onInitial?.(hospitals);
        onCoverageWarning?.(['경기도'], false);
        return hospitals;
      }),
      findByRegion: vi.fn(),
      findById: vi.fn(),
    };

    const result = await new GetNearbyHospitals(repository).execute(
      new Coordinates(37.5665, 126.978)
    );

    expect(result.hospitals).toHaveLength(1);
    expect(result.warning?.type).toBe('PARTIAL_COVERAGE');
    expect(result.warning?.message).toContain('경기도');
  });

  it('warns when coordinate discovery fails even if the current region succeeds', async () => {
    const repository: IHospitalRepository = {
      findNearby: vi.fn(async (_coords, _ctx, _onInitial, onCoverageWarning) => {
        onCoverageWarning?.([], true);
        return [hospital()];
      }),
      findByRegion: vi.fn(),
      findById: vi.fn(),
    };

    const result = await new GetNearbyHospitals(repository).execute(
      new Coordinates(37.5665, 126.978)
    );

    expect(result.warning?.type).toBe('PARTIAL_COVERAGE');
    expect(result.warning?.message).toContain('인접 지역 탐색');
  });
});
