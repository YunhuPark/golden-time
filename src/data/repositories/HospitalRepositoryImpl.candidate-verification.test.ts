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
  it('skips realtime fanout only when a complete regional list proves all hospitals are outside 100km and reuses verified list data', async () => {
    const incheonList = [basicHospital('IC-1', '인천 병원', 37.50, 126.70)];
    const apiClient = {
      setPerformanceSearchId: vi.fn(),
      getNearbyEmergencyLocations: vi.fn().mockResolvedValue([]),
      getHospitalBasicInfo: vi.fn(async (region: string) => {
        if (region === '경기도') return [basicHospital('GG-FAR', '경기 먼 병원', 36.0, 128.5)];
        if (region === '인천광역시') return incheonList;
        return [];
      }),
      getCombinedHospitalData: vi.fn(async () => []),
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

  it('fails open when a regional verification list is empty or has incomplete coordinates', async () => {
    const incompleteList = [{
      ...basicHospital('IC-UNKNOWN', '좌표 미확인 병원', 37.50, 126.70),
      wgs84Lat: undefined,
      wgs84Lon: undefined,
    }];
    const apiClient = {
      setPerformanceSearchId: vi.fn(),
      getNearbyEmergencyLocations: vi.fn().mockResolvedValue([]),
      getHospitalBasicInfo: vi.fn(async (region: string) => {
        if (region === '인천광역시') return incompleteList;
        return [];
      }),
      getCombinedHospitalData: vi.fn(async () => []),
    };
    const repository = new HospitalRepositoryImpl(
      apiClient as unknown as EGenApiClient,
      { getBatchRouteInfoConcurrent: vi.fn() } as unknown as KakaoDirectionsClient
    );

    await repository.findNearby(new Coordinates(37.5665, 126.9780));

    expect(apiClient.getCombinedHospitalData).toHaveBeenCalledWith(
      '인천광역시',
      undefined,
      incompleteList
    );
    expect(apiClient.getCombinedHospitalData).toHaveBeenCalledWith(
      '충청북도',
      undefined,
      []
    );
  });

  it('trusts coordinate discovery evidence and does not make regional-list verification a new prerequisite', async () => {
    const apiClient = {
      setPerformanceSearchId: vi.fn(),
      getNearbyEmergencyLocations: vi.fn().mockResolvedValue([
        {
          hpid: 'IC-LOC',
          dutyName: '인천 경계 병원',
          dutyAddr: '인천광역시 계양구',
          latitude: 37.55,
          longitude: 126.73,
        },
      ]),
      getHospitalBasicInfo: vi.fn(async () => {
        throw new Error('verification should not run for coordinate-discovered region');
      }),
      getCombinedHospitalData: vi.fn(async () => []),
    };
    const repository = new HospitalRepositoryImpl(
      apiClient as unknown as EGenApiClient,
      { getBatchRouteInfoConcurrent: vi.fn() } as unknown as KakaoDirectionsClient
    );

    await repository.findNearby(new Coordinates(37.5665, 126.9780));

    expect(apiClient.getCombinedHospitalData).toHaveBeenCalledWith('인천광역시');
    expect(apiClient.getHospitalBasicInfo).not.toHaveBeenCalledWith('인천광역시');
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
    const warningCall = onCoverageWarning.mock.calls[0];
    if (!warningCall) throw new Error('expected coverage warning call');
    const failedRegions = warningCall[0] as string[];
    const discoveryFailed = warningCall[1] as boolean;
    expect(failedRegions).toContain('경기도');
    expect(discoveryFailed).toBe(false);
  });
});
