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
                  dutyAddr: '전남광주통합특별시 동구 제봉로 42',
                  wgs84Lat: '35.142',
                  wgs84Lon: '126.921',
                },
                {
                  hpid: 'A1509999',
                  dutyName: '추가 응급의료기관',
                  dutyAddr: '전남광주통합특별시 서구 테스트로 1',
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
    expect(parsed.searchParams.get('Q0')).toBe('전남광주통합특별시');
    expect(parsed.searchParams.get('numOfRows')).toBe('300');
    expect(parsed.searchParams.has('QZ')).toBe(false);
    expect(hospitals.map((hospital) => hospital.hpid)).toEqual([
      'A1500002',
      'A1509999',
    ]);
  });

  it.each(['광주광역시', '전라남도'])(
    'uses the integrated upstream alias for %s realtime beds',
    async (region) => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          response: {
            header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' },
            body: { items: '', numOfRows: 100, pageNo: 1, totalCount: 0 },
          },
        }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const client = new EGenApiClient();
      await client.getEmergencyRoomBeds(region);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const requestUrl = String(fetchMock.mock.calls[0]?.[0]);
      const parsed = new URL(requestUrl, 'https://golden-time.test');
      expect(parsed.searchParams.get('STAGE1')).toBe('전남광주통합특별시');
    }
  );

  it('uses the integrated upstream alias for Jeonnam regional lists', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        response: {
          header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' },
          body: { items: '', numOfRows: 300, pageNo: 1, totalCount: 0 },
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new EGenApiClient();
    await client.getHospitalBasicInfo('전라남도');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestUrl = String(fetchMock.mock.calls[0]?.[0]);
    const parsed = new URL(requestUrl, 'https://golden-time.test');
    expect(parsed.searchParams.get('Q0')).toBe('전남광주통합특별시');
  });
});

describe('EGenApiClient 응답 무결성', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const respond = (body: unknown) => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        response: {
          header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' },
          body,
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  };

  it('결과가 0건이면 빈 목록으로 처리한다', async () => {
    // E-Gen은 해당 지역에 병원이 없으면 totalCount 0과 함께 items를 생략한다.
    respond({ numOfRows: 100, pageNo: 1, totalCount: 0 });

    await expect(new EGenApiClient().getHospitalBasicInfo('강원도')).resolves.toEqual([]);
  });

  // 이 경우를 빈 지역으로 넘기면 해당 지역 병원이 통째로 사라진 채
  // 부분 커버리지 경고도 뜨지 않는다.
  it('totalCount가 0이 아닌데 items가 없으면 실패로 올린다', async () => {
    respond({ numOfRows: 100, pageNo: 1, totalCount: 42 });

    await expect(new EGenApiClient().getHospitalBasicInfo('서울특별시')).rejects.toThrow(/totalCount 42/);
  });

  it('totalCount를 알 수 없으면 빈 목록으로 둔다', async () => {
    respond({ numOfRows: 100, pageNo: 1 });

    await expect(new EGenApiClient().getHospitalBasicInfo('제주특별자치도')).resolves.toEqual([]);
  });
});
