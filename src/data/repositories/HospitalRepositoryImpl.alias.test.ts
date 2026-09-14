import { describe, expect, it, vi } from 'vitest';
import { Coordinates } from '../../domain/valueObjects/Coordinates';
import { EGenApiClient } from '../datasources/remote/EGenApiClient';
import { KakaoDirectionsClient } from '../datasources/remote/KakaoDirectionsClient';
import { HospitalRepositoryImpl } from './HospitalRepositoryImpl';

describe('HospitalRepositoryImpl integrated E-Gen regions', () => {
  it('does not query Jeonnam separately when Gwangju already covers the integrated upstream region', async () => {
    const apiClient = {
      setPerformanceSearchId: vi.fn(),
      getNearbyEmergencyLocations: vi.fn().mockResolvedValue([]),
      getCombinedHospitalData: vi.fn().mockResolvedValue([]),
    };
    const directionsClient = { getBatchRouteInfoConcurrent: vi.fn() };
    const repository = new HospitalRepositoryImpl(
      apiClient as unknown as EGenApiClient,
      directionsClient as unknown as KakaoDirectionsClient
    );

    await repository.findNearby(new Coordinates(35.1595, 126.8526));

    const queriedRegions = apiClient.getCombinedHospitalData.mock.calls.map(([region]) => region);
    expect(queriedRegions.filter((region) => region === '광주광역시')).toHaveLength(1);
    expect(queriedRegions).not.toContain('전라남도');
  });
});
