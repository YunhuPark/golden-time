import { describe, expect, it, vi } from 'vitest';
import { Coordinates } from '../../domain/valueObjects/Coordinates';
import { EGenApiClient } from '../datasources/remote/EGenApiClient';
import { KakaoDirectionsClient } from '../datasources/remote/KakaoDirectionsClient';
import { HospitalRepositoryImpl } from './HospitalRepositoryImpl';

function combinedHospital({
  hpid,
  name,
  lat,
  lon,
  beds = 1,
}: {
  hpid: string;
  name: string;
  lat: number;
  lon: number;
  beds?: number;
}) {
  return {
    basicInfo: {
      hpid,
      dutyName: name,
      dutyAddr: `${name} 주소`,
      wgs84Lat: String(lat),
      wgs84Lon: String(lon),
      dutyEryn: '1',
      dutyEmcls: 'A',
    },
    bedInfo: {
      hpid,
      dutyName: name,
      hvec: String(beds),
    },
  };
}

function locationCandidate({
  hpid,
  name,
  lat,
  lon,
}: {
  hpid: string;
  name: string;
  lat: number;
  lon: number;
}) {
  return {
    hpid,
    dutyName: name,
    dutyAddr: `${name} 주소`,
    latitude: lat,
    longitude: lon,
  };
}

describe('HospitalRepositoryImpl.findNearby', () => {
  it('uses one coordinate lookup and only queries realtime data for evidenced candidate regions', async () => {
    const apiClient = {
      setPerformanceSearchId: vi.fn(),
      getNearbyEmergencyLocations: vi.fn().mockResolvedValue([
        locationCandidate({
          hpid: 'CN-FAR',
          name: '충남 병원',
          lat: 36.90,
          lon: 127.00,
        }),
        locationCandidate({
          hpid: 'CB-CLOSE',
          name: '충북 경계 병원',
          lat: 36.82,
          lon: 127.14,
        }),
      ]),
      getCombinedHospitalData: vi.fn(async (region: string) => {
        if (region === '충청남도') {
          return [combinedHospital({
            hpid: 'CN-FAR',
            name: '충남 병원',
            lat: 36.90,
            lon: 127.00,
          })];
        }
        if (region === '충청북도') {
          return [combinedHospital({
            hpid: 'CB-CLOSE',
            name: '충북 경계 병원',
            lat: 36.82,
            lon: 127.14,
          })];
        }
        return [];
      }),
    };
    const directionsClient = { getBatchRouteInfoConcurrent: vi.fn() };
    const repository = new HospitalRepositoryImpl(
      apiClient as unknown as EGenApiClient,
      directionsClient as unknown as KakaoDirectionsClient
    );

    const hospitals = await repository.findNearby(new Coordinates(36.8151, 127.1139));

    expect(apiClient.getNearbyEmergencyLocations).toHaveBeenCalledTimes(1);
    expect(apiClient.getNearbyEmergencyLocations).toHaveBeenCalledWith(36.8151, 127.1139, 100);

    const queriedRegions = apiClient.getCombinedHospitalData.mock.calls.map(([region]) => region);
    expect(queriedRegions).toContain('충청남도');
    expect(queriedRegions).toContain('충청북도');
    expect(queriedRegions).not.toContain('서울특별시');
    expect(queriedRegions).not.toContain('강원특별자치도');
    expect(hospitals.map((hospital) => hospital.id)).toContain('CB-CLOSE');
  });

  it('drops coordinate candidates outside the configured 100km radius before regional fan-out', async () => {
    const apiClient = {
      setPerformanceSearchId: vi.fn(),
      getNearbyEmergencyLocations: vi.fn().mockResolvedValue([
        locationCandidate({
          hpid: 'TOO-FAR',
          name: '멀리 있는 병원',
          lat: 38.50,
          lon: 129.00,
        }),
      ]),
      getCombinedHospitalData: vi.fn(),
    };
    const directionsClient = { getBatchRouteInfoConcurrent: vi.fn() };
    const repository = new HospitalRepositoryImpl(
      apiClient as unknown as EGenApiClient,
      directionsClient as unknown as KakaoDirectionsClient
    );

    const hospitals = await repository.findNearby(new Coordinates(37.5665, 126.9780));

    expect(hospitals).toEqual([]);
    expect(apiClient.getCombinedHospitalData).not.toHaveBeenCalled();
  });

  it('deduplicates the same HPID returned by overlapping candidate regional searches', async () => {
    const duplicated = combinedHospital({
      hpid: 'DUP-1',
      name: '중복 병원',
      lat: 37.50,
      lon: 127.00,
      beds: 3,
    });
    const apiClient = {
      setPerformanceSearchId: vi.fn(),
      getNearbyEmergencyLocations: vi.fn().mockResolvedValue([
        locationCandidate({ hpid: 'DUP-1', name: '중복 병원', lat: 37.50, lon: 127.00 }),
      ]),
      getCombinedHospitalData: vi.fn(async () => [duplicated]),
    };
    const directionsClient = { getBatchRouteInfoConcurrent: vi.fn() };
    const repository = new HospitalRepositoryImpl(
      apiClient as unknown as EGenApiClient,
      directionsClient as unknown as KakaoDirectionsClient
    );

    const hospitals = await repository.findNearby(new Coordinates(37.5665, 126.9780));

    expect(hospitals.filter((hospital) => hospital.id === 'DUP-1')).toHaveLength(1);
  });

  it('keeps searching when one evidenced candidate regional E-Gen request fails', async () => {
    const apiClient = {
      setPerformanceSearchId: vi.fn(),
      getNearbyEmergencyLocations: vi.fn().mockResolvedValue([
        locationCandidate({ hpid: 'SEOUL-1', name: '서울 병원', lat: 37.56, lon: 126.98 }),
        locationCandidate({ hpid: 'GG-1', name: '경기 병원', lat: 37.55, lon: 127.05 }),
      ]),
      getCombinedHospitalData: vi.fn(async (region: string) => {
        if (region === '서울특별시') throw new Error('temporary failure');
        if (region === '경기도') {
          return [combinedHospital({
            hpid: 'GG-1',
            name: '경기 병원',
            lat: 37.55,
            lon: 127.05,
          })];
        }
        return [];
      }),
    };
    const directionsClient = { getBatchRouteInfoConcurrent: vi.fn() };
    const repository = new HospitalRepositoryImpl(
      apiClient as unknown as EGenApiClient,
      directionsClient as unknown as KakaoDirectionsClient
    );

    const hospitals = await repository.findNearby(new Coordinates(37.5665, 126.9780));
    expect(hospitals.map((hospital) => hospital.id)).toContain('GG-1');
  });

  it('does not silently fall back to Seoul for unsupported coordinates', async () => {
    const apiClient = {
      setPerformanceSearchId: vi.fn(),
      getNearbyEmergencyLocations: vi.fn(),
      getCombinedHospitalData: vi.fn(),
    };
    const directionsClient = { getBatchRouteInfoConcurrent: vi.fn() };
    const repository = new HospitalRepositoryImpl(
      apiClient as unknown as EGenApiClient,
      directionsClient as unknown as KakaoDirectionsClient
    );

    await expect(
      repository.findNearby(new Coordinates(25.0, 121.5))
    ).rejects.toThrow('Unsupported GPS coordinates');
    expect(apiClient.getNearbyEmergencyLocations).not.toHaveBeenCalled();
    expect(apiClient.getCombinedHospitalData).not.toHaveBeenCalled();
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
