import { afterEach, describe, expect, it, vi } from 'vitest';
import { EGenApiClient } from './EGenApiClient';

describe('EGenApiClient regional hospital list', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches the complete regional list once without restricting QZ', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        response: {
          header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' },
          body: {
            items: {
              item: [
                {
                  hpid: 'A1500002',
                  dutyName: '전남대학교병원',
                  dutyAddr: '광주광역시 동구 제봉로 42',
                  wgs84Lat: '35.142',
                  wgs84Lon: '126.921',
                },
                {
                  hpid: 'A1509999',
                  dutyName: '추가 응급의료기관',
                  dutyAddr: '광주광역시 서구 테스트로 1',
                  wgs84Lat: '35.150',
                  wgs84Lon: '126.850',
                },
              ],
            },
            numOfRows: 300,
            pageNo: 1,
            totalCount: 2,
          },
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new EGenApiClient();
    const hospitals = await client.getHospitalBasicInfo('광주광역시');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestUrl = String(fetchMock.mock.calls[0]?.[0]);
    const parsed = new URL(requestUrl, 'https://golden-time.test');
    expect(parsed.searchParams.get('_endpoint')).toBe(
      '/ErmctInfoInqireService/getEgytListInfoInqire'
    );
    expect(parsed.searchParams.get('Q0')).toBe('광주');
    expect(parsed.searchParams.get('numOfRows')).toBe('300');
    expect(parsed.searchParams.has('QZ')).toBe(false);
    expect(hospitals.map((hospital) => hospital.hpid)).toEqual([
      'A1500002',
      'A1509999',
    ]);
  });

  it('uses the live E-Gen 전남 alias for the Jeollanam-do hospital list', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        response: {
          header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' },
          body: { items: {}, numOfRows: 300, pageNo: 1, totalCount: 0 },
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new EGenApiClient();
    await client.getHospitalBasicInfo('전라남도');

    const requestUrl = String(fetchMock.mock.calls[0]?.[0]);
    const parsed = new URL(requestUrl, 'https://golden-time.test');
    expect(parsed.searchParams.get('Q0')).toBe('전남');
  });

  it('uses the live E-Gen 전남 alias for Jeollanam-do realtime beds', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        response: {
          header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' },
          body: { items: {}, numOfRows: 100, pageNo: 1, totalCount: 0 },
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new EGenApiClient();
    await client.getEmergencyRoomBeds('전라남도');

    const requestUrl = String(fetchMock.mock.calls[0]?.[0]);
    const parsed = new URL(requestUrl, 'https://golden-time.test');
    expect(parsed.searchParams.get('STAGE1')).toBe('전남');
  });
});
