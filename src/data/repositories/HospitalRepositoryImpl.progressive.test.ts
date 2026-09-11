import { describe, expect, it, vi } from 'vitest';
import { Coordinates } from '../../domain/valueObjects/Coordinates';
import { EGenApiClient } from '../datasources/remote/EGenApiClient';
import { KakaoDirectionsClient } from '../datasources/remote/KakaoDirectionsClient';
import { HospitalRepositoryImpl } from './HospitalRepositoryImpl';

function item(hpid: string, name: string, lat: number, lon: number) {
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
    bedInfo: { hpid, dutyName: name, hvec: '2' },
  };
}

describe('HospitalRepositoryImpl progressive nationwide search', () => {
  it('publishes current-region hospitals before a delayed neighboring region completes', async () => {
    let resolveNeighbor!: (value: ReturnType<typeof item>[]) => void;
    const events: string[] = [];
    const apiClient = {
      setPerformanceSearchId: vi.fn(),
      getNearbyEmergencyLocations: vi.fn().mockResolvedValue([
        {
          hpid: 'GG-LOC',
          dutyName: '경기 병원',
          dutyAddr: '경기도 성남시',
          latitude: 37.45,
          longitude: 127.15,
        },
      ]),
      getCombinedHospitalData: vi.fn((region: string) => {
        if (region === '서울특별시') {
          return Promise.resolve([item('SEOUL-1', '서울 병원', 37.56, 126.98)]);
        }
        if (region === '경기도') {
          return new Promise<ReturnType<typeof item>[]>((resolve) => {
            resolveNeighbor = resolve;
          });
        }
        return Promise.resolve([]);
      }),
    };
    const repository = new HospitalRepositoryImpl(
      apiClient as unknown as EGenApiClient,
      { getBatchRouteInfoConcurrent: vi.fn() } as unknown as KakaoDirectionsClient
    );

    const finalPromise = repository.findNearby(
      new Coordinates(37.5665, 126.9780),
      null,
      (hospitals) => events.push(`initial:${hospitals.map((h) => h.id).join(',')}`)
    );

    await vi.waitFor(() => expect(events).toEqual(['initial:SEOUL-1']));
    resolveNeighbor([item('GG-1', '경기 병원', 37.55, 127.05)]);
    const finalHospitals = await finalPromise;
    events.push('final');

    expect(finalHospitals.map((hospital) => hospital.id)).toEqual(
      expect.arrayContaining(['SEOUL-1', 'GG-1'])
    );
    expect(events[0]).toBe('initial:SEOUL-1');
    expect(events[events.length - 1]).toBe('final');
  });

  it('still returns neighboring hospitals when the current-region request fails', async () => {
    const apiClient = {
      setPerformanceSearchId: vi.fn(),
      getNearbyEmergencyLocations: vi.fn().mockResolvedValue([
        {
          hpid: 'GG-LOC',
          dutyName: '경기 병원',
          dutyAddr: '경기도 성남시',
          latitude: 37.45,
          longitude: 127.15,
        },
      ]),
      getCombinedHospitalData: vi.fn(async (region: string) => {
        if (region === '서울특별시') throw new Error('current region unavailable');
        if (region === '경기도') return [item('GG-1', '경기 병원', 37.55, 127.05)];
        return [];
      }),
    };
    const repository = new HospitalRepositoryImpl(
      apiClient as unknown as EGenApiClient,
      { getBatchRouteInfoConcurrent: vi.fn() } as unknown as KakaoDirectionsClient
    );

    const hospitals = await repository.findNearby(new Coordinates(37.5665, 126.9780));
    expect(hospitals.map((hospital) => hospital.id)).toContain('GG-1');
  });
});
