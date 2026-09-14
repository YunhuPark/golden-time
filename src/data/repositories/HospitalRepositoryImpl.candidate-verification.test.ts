import { describe, expect, it, vi } from 'vitest';
import { Coordinates } from '../../domain/valueObjects/Coordinates';
import { EGenApiClient } from '../datasources/remote/EGenApiClient';
import { KakaoDirectionsClient } from '../datasources/remote/KakaoDirectionsClient';
import { HospitalRepositoryImpl } from './HospitalRepositoryImpl';

const basicHospital = (hpid: string, name: string, lat: number, lon: number) => ({
  hpid,
  dutyName: name,
  dutyAddr: `${name} 주소`,
  wgs84Lat: String(lat),
  wgs84Lon: String(lon),
  dutyEryn: '1',
  dutyEmcls: 'A',
});

describe('HospitalRepositoryImpl geometric candidate verification', () => {
  it('skips realtime fanout when a regional list has no hospital within 100km and reuses verified list data', async () => {
    const incheonList = [basicHospital('IC-1', '인천 병원', 37.50, 126.70)];
    const apiClient = {
      setPerformanceSearchId: vi.fn(),
      getNearbyEmergencyLocations: vi.fn().mockResolvedValue([]),
      getHospitalBasicInfo: vi.fn(async (region: string) => {
        if (region === '경기도') return [basicHospital('GG-FAR', '경기 먼 병원', 36.0, 128.5)];
        if (region === '인천광역시') return incheonList;
        return [];
      }),
      getCombinedHospitalData: vi.fn(async (region: string) => {
        if (region === '서울특별시') return [];
        return [];
      }),
    };
    const repository = new HospitalRepositoryImpl(
      apiClient as unknown as EGenApiClient,
      { getBatchRouteInfoConcurrent: vi.fn() } as unknown as KakaoDirectionsClient
    );

    await repository.findNearby(new Coordinates(37.5665, 126.9780));

    expect(apiClient.getHospitalBasicInfo).toHaveBeenCalledWith('경기도');
    expect(apiClient.getHospitalBasicInfo).toHaveBeenCalledWith('인천광역시');

    const calls = apiClient.getCombinedHospitalData.mock.calls;
    expect(calls.some(([region]) => region === '경기도')).toBe(false);
    expect(calls).toContainEqual(['인천광역시', undefined, incheonList]);
  });

  it('surfaces regional candidate verification failures through the existing coverage warning', async () => {
    const onCoverageWarning = vi.fn();
    const apiClient = {
      setPerformanceSearchId: vi.fn(),
      getNearbyEmergencyLocations: vi.fn().mockResolvedValue([]),
      getHospitalBasicInfo: vi.fn(async (region: string) => {
        if (region === '경기도') throw new Error('regional list unavailable');
        return [];
      }),
      getCombinedHospitalData: vi.fn(async () => []),
    };
    const repository = new HospitalRepositoryImpl(
      apiClient as unknown as EGenApiClient,
      { getBatchRouteInfoConcurrent: vi.fn() } as unknown as KakaoDirectionsClient
    );

    await repository.findNearby(
      new Coordinates(37.5665, 126.9780),
      null,
      undefined,
      onCoverageWarning
    );

    expect(onCoverageWarning).toHaveBeenCalled();
    const [failedRegions, discoveryFailed] = onCoverageWarning.mock.calls[0];
    expect(failedRegions).toContain('경기도');
    expect(discoveryFailed).toBe(false);
  });
});
