import { describe, expect, it, vi } from 'vitest';
import { Coordinates } from '../../domain/valueObjects/Coordinates';
import { EGenApiClient } from '../datasources/remote/EGenApiClient';
import { KakaoDirectionsClient } from '../datasources/remote/KakaoDirectionsClient';
import { HospitalRepositoryImpl } from './HospitalRepositoryImpl';

describe('HospitalRepositoryImpl.findNearby', () => {
  it('queries neighboring E-Gen regions so an administrative border cannot hide a nearby ER', async () => {
    const getCombinedHospitalData = vi.fn(async (region: string) => {
      if (region === '경기도') {
        return [{
          basicInfo: {
            hpid: 'GG-001',
            dutyName: '경기경계병원',
            dutyAddr: '경기도 평택시',
            wgs84Lat: '36.97',
            wgs84Lon: '127.02',
            dutyEryn: '1',
            dutyEmcls: 'B',
          },
          bedInfo: {
            hpid: 'GG-001',
            dutyName: '경기경계병원',
            hvec: '3',
          },
        }];
      }

      if (region === '충청남도') {
        return [{
          basicInfo: {
            hpid: 'CN-001',
            dutyName: '충남경계병원',
            dutyAddr: '충청남도 천안시',
            wgs84Lat: '36.93',
            wgs84Lon: '127.01',
            dutyEryn: '1',
            dutyEmcls: 'B',
          },
          bedInfo: {
            hpid: 'CN-001',
            dutyName: '충남경계병원',
            hvec: '4',
          },
        }];
      }

      return [];
    });

    const apiClient = {
      setPerformanceSearchId: vi.fn(),
      getCombinedHospitalData,
    };
    const directionsClient = { getBatchRouteInfoConcurrent: vi.fn() };
    const repository = new HospitalRepositoryImpl(
      apiClient as unknown as EGenApiClient,
      directionsClient as unknown as KakaoDirectionsClient
    );

    const hospitals = await repository.findNearby(new Coordinates(36.95, 127.0));
    const calledRegions = getCombinedHospitalData.mock.calls.map(([region]) => region);

    expect(calledRegions).toContain('경기도');
    expect(calledRegions).toContain('충청남도');
    expect(hospitals.map((hospital) => hospital.id)).toEqual(
      expect.arrayContaining(['GG-001', 'CN-001'])
    );
  });

  it('deduplicates the same HPID returned by overlapping regional lookups', async () => {
    const duplicate = {
      basicInfo: {
        hpid: 'DUP-001',
        dutyName: '중복경계병원',
        dutyAddr: '경계 지역',
        wgs84Lat: '37.0',
        wgs84Lon: '127.0',
        dutyEryn: '1',
        dutyEmcls: 'B',
      },
      bedInfo: {
        hpid: 'DUP-001',
        dutyName: '중복경계병원',
        hvec: '2',
      },
    };

    const apiClient = {
      setPerformanceSearchId: vi.fn(),
      getCombinedHospitalData: vi.fn(async (region: string) =>
        region === '경기도' || region === '충청남도' ? [duplicate] : []
      ),
    };
    const directionsClient = { getBatchRouteInfoConcurrent: vi.fn() };
    const repository = new HospitalRepositoryImpl(
      apiClient as unknown as EGenApiClient,
      directionsClient as unknown as KakaoDirectionsClient
    );

    const hospitals = await repository.findNearby(new Coordinates(36.95, 127.0));

    expect(hospitals.filter((hospital) => hospital.id === 'DUP-001')).toHaveLength(1);
  });

  it('keeps partial results when one neighboring regional lookup fails', async () => {
    const apiClient = {
      setPerformanceSearchId: vi.fn(),
      getCombinedHospitalData: vi.fn(async (region: string) => {
        if (region === '경기도') throw new Error('temporary regional outage');
        if (region === '충청남도') {
          return [{
            basicInfo: {
              hpid: 'CN-OK',
              dutyName: '충남가용병원',
              dutyAddr: '충청남도 천안시',
              wgs84Lat: '36.94',
              wgs84Lon: '127.01',
              dutyEryn: '1',
              dutyEmcls: 'B',
            },
            bedInfo: {
              hpid: 'CN-OK',
              dutyName: '충남가용병원',
              hvec: '1',
            },
          }];
        }
        return [];
      }),
    };
    const directionsClient = { getBatchRouteInfoConcurrent: vi.fn() };
    const repository = new HospitalRepositoryImpl(
      apiClient as unknown as EGenApiClient,
      directionsClient as unknown as KakaoDirectionsClient
    );

    const hospitals = await repository.findNearby(new Coordinates(36.95, 127.0));

    expect(hospitals.some((hospital) => hospital.id === 'CN-OK')).toBe(true);
  });
});

describe('HospitalRepositoryImpl.findById', () => {
  it('looks up a Gwangju hospital directly by HPID and enriches realtime beds from its inferred region', async () => {
    const apiClient = {
      getHospitalBasicInfoById: vi.fn().mockResolvedValue({
        hpid: 'A1500002',
        dutyName: '전남대학교병원',
        dutyAddr: '광주광역시 동구 제봉로 42',
        dutyTel1: '0622205114',
        dutyTel3: '0622206801',
        wgs84Lat: '35.142',
        wgs84Lon: '126.921',
        dutyEryn: '1',
        dutyEmcls: 'A',
      }),
      getEmergencyRoomBeds: vi.fn().mockResolvedValue([{
        hpid: 'A1500002',
        dutyName: '전남대학교병원',
        hvec: '7',
        hvicc: '3',
        hvcc: '1',
      }]),
    };
    const directionsClient = { getBatchRouteInfoConcurrent: vi.fn() };
    const repository = new HospitalRepositoryImpl(
      apiClient as unknown as EGenApiClient,
      directionsClient as unknown as KakaoDirectionsClient
    );

    const hospital = await repository.findById('A1500002');

    expect(apiClient.getHospitalBasicInfoById).toHaveBeenCalledWith('A1500002');
    expect(apiClient.getEmergencyRoomBeds).toHaveBeenCalledWith('광주광역시', undefined, 100);
    expect(hospital?.id).toBe('A1500002');
    expect(hospital?.name).toBe('전남대학교병원');
    expect(hospital?.availableBeds).toBe(7);
    expect(hospital?.icuAvailableBeds).toBe(3);
    expect(hospital?.neuroIcuAvailableBeds).toBe(1);
  });

  it('returns null when HPID basic info is not found', async () => {
    const apiClient = {
      getHospitalBasicInfoById: vi.fn().mockResolvedValue(null),
      getEmergencyRoomBeds: vi.fn(),
    };
    const directionsClient = { getBatchRouteInfoConcurrent: vi.fn() };
    const repository = new HospitalRepositoryImpl(
      apiClient as unknown as EGenApiClient,
      directionsClient as unknown as KakaoDirectionsClient
    );

    await expect(repository.findById('UNKNOWN')).resolves.toBeNull();
    expect(apiClient.getEmergencyRoomBeds).not.toHaveBeenCalled();
  });
});
