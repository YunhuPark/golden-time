import { describe, expect, it, vi } from 'vitest';
import { HospitalRepositoryImpl } from './HospitalRepositoryImpl';

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
    const repository = new HospitalRepositoryImpl(apiClient as any, directionsClient as any);

    const hospital = await repository.findById('A1500002');

    expect(apiClient.getHospitalBasicInfoById).toHaveBeenCalledWith('A1500002');
    expect(apiClient.getEmergencyRoomBeds).toHaveBeenCalledWith('광주광역시', undefined, 100);
    expect(hospital?.id).toBe('A1500002');
    expect(hospital?.name).toBe('전남대학교병원');
    expect(hospital?.emergencyAvailableBeds).toBe(7);
  });

  it('returns null when HPID basic info is not found', async () => {
    const apiClient = {
      getHospitalBasicInfoById: vi.fn().mockResolvedValue(null),
      getEmergencyRoomBeds: vi.fn(),
    };
    const repository = new HospitalRepositoryImpl(apiClient as any, { getBatchRouteInfoConcurrent: vi.fn() } as any);

    await expect(repository.findById('UNKNOWN')).resolves.toBeNull();
    expect(apiClient.getEmergencyRoomBeds).not.toHaveBeenCalled();
  });
});
