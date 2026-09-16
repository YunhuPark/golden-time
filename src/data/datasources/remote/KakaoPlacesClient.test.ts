import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildGeocodeCacheKey, KakaoPlacesClient } from './KakaoPlacesClient';

describe('buildGeocodeCacheKey', () => {
  it('normalizes whitespace and case', () => {
    expect(buildGeocodeCacheKey('  Test   Hospital  ', ' 광주광역시 ')).toBe(
      '광주광역시::test hospital'
    );
  });

  it('keeps identical hospital names in different regions isolated', () => {
    expect(buildGeocodeCacheKey('한국병원', '광주광역시')).not.toBe(
      buildGeocodeCacheKey('한국병원', '서울특별시')
    );
  });

  it('uses an explicit bucket when region is unavailable', () => {
    expect(buildGeocodeCacheKey('한국병원')).toBe('any-region::한국병원');
  });
});

describe('KakaoPlacesClient.keywordToCoordinates', () => {
  // 모듈 수준 캐시를 공유하므로 테스트마다 다른 병원명을 쓴다.
  let counter = 0;
  const uniqueName = () => `테스트병원${++counter}`;

  const GWANGJU_DOC = {
    y: '35.1524229',
    x: '126.8539184',
    road_address_name: '광주광역시 서구 상무자유로 181-7',
    category_group_code: 'HP8',
    category_name: '의료,건강 > 병원 > 종합병원',
  };

  const stubFetch = (documents: unknown[], ok = true) => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok,
      json: async () => ({ documents }),
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  };

  beforeEach(() => {
    // SDK 없음을 명시한다. 그러지 않으면 프록시가 결과를 못 줄 때마다
    // 클라이언트가 SDK 로딩을 5초 동안 폴링한다.
    window.kakaoSDKReady = Promise.resolve(false);
  });

  afterEach(() => {
    delete window.kakaoSDKReady;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('프록시 결과의 좌표와 도로명 주소를 반환한다', async () => {
    stubFetch([GWANGJU_DOC]);

    const result = await new KakaoPlacesClient().keywordToCoordinates(uniqueName());

    expect(result).toEqual({
      latitude: 35.1524229,
      longitude: 126.8539184,
      address: '광주광역시 서구 상무자유로 181-7',
    });
  });

  it.each([
    ['빈 문자열', ''],
    ['공백만', '   '],
    ['정보 없음', '정보 없음'],
    ['미제공', '미제공 병원'],
    ['병원명 없음', '병원명 없음'],
  ])('%s은 조회하지 않는다', async (_label, keyword) => {
    const fetchMock = stubFetch([GWANGJU_DOC]);

    expect(await new KakaoPlacesClient().keywordToCoordinates(keyword)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('같은 키워드는 캐시를 써서 다시 조회하지 않는다', async () => {
    const name = uniqueName();
    const fetchMock = stubFetch([GWANGJU_DOC]);
    const client = new KakaoPlacesClient();

    await client.keywordToCoordinates(name);
    const callsAfterFirst = fetchMock.mock.calls.length;
    await client.keywordToCoordinates(name);

    expect(fetchMock.mock.calls.length).toBe(callsAfterFirst);
  });

  it('동시 요청은 하나로 합친다', async () => {
    const name = uniqueName();
    const fetchMock = stubFetch([GWANGJU_DOC]);
    const client = new KakaoPlacesClient();

    const [a, b] = await Promise.all([
      client.keywordToCoordinates(name),
      client.keywordToCoordinates(name),
    ]);

    expect(a).toEqual(b);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('병원 분류 결과를 다른 결과보다 우선한다', async () => {
    stubFetch([
      { y: '35.1600000', x: '126.8500000', address_name: '약국', category_group_code: 'PM9' },
      GWANGJU_DOC,
    ]);

    const result = await new KakaoPlacesClient().keywordToCoordinates(uniqueName());

    expect(result?.latitude).toBeCloseTo(35.1524229, 6);
  });

  it.each([
    ['한국 범위 밖', { y: '48.8566', x: '2.3522', address_name: '파리' }],
    ['좌표가 숫자가 아님', { y: 'N/A', x: 'N/A', address_name: '알 수 없음' }],
  ])('%s이면 결과로 쓰지 않는다', async (_label, doc) => {
    stubFetch([doc]);

    expect(await new KakaoPlacesClient().keywordToCoordinates(uniqueName())).toBeNull();
  });

  // 이름이 비슷한 다른 도시의 병원을 잘못 집어오는 것을 막는다.
  it('사용자 위치에서 100km를 넘으면 버린다', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    stubFetch([GWANGJU_DOC]);

    const result = await new KakaoPlacesClient().keywordToCoordinates(
      uniqueName(),
      undefined,
      { latitude: 37.5663, longitude: 126.9779 } // 서울시청, 광주까지 약 269km
    );

    expect(result).toBeNull();
  });

  it('사용자 위치 근처면 그대로 쓴다', async () => {
    stubFetch([GWANGJU_DOC]);

    const result = await new KakaoPlacesClient().keywordToCoordinates(
      uniqueName(),
      undefined,
      { latitude: 35.1595, longitude: 126.8526 }
    );

    expect(result?.latitude).toBeCloseTo(35.1524229, 6);
  });

  it('도로명 주소가 없으면 지번 주소를 쓴다', async () => {
    stubFetch([{ y: '35.1524229', x: '126.8539184', address_name: '광주 서구 치평동 1194-3', category_group_code: 'HP8' }]);

    const result = await new KakaoPlacesClient().keywordToCoordinates(uniqueName());

    expect(result?.address).toBe('광주 서구 치평동 1194-3');
  });

  it('프록시가 실패하면 null을 돌려준다', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    stubFetch([], false);

    expect(await new KakaoPlacesClient().keywordToCoordinates(uniqueName())).toBeNull();
  });

  it('결과가 없으면 지역을 덧붙여 한 번 더 시도한다', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const name = uniqueName();
    const fetchMock = stubFetch([]);

    await new KakaoPlacesClient().keywordToCoordinates(name, '광주광역시');

    const queries = fetchMock.mock.calls.map((call) =>
      new URL(String(call[0]), 'https://golden-time.test').searchParams.get('query')
    );
    expect(queries).toEqual([name, `${name} 광주광역시`]);
  });
});

describe('KakaoPlacesClient SDK 대기', () => {
  const doc = {
    y: '35.1524229',
    x: '126.8539184',
    road_address_name: '광주광역시 서구 상무자유로 181-7',
    category_group_code: 'HP8',
  };

  afterEach(() => {
    delete window.kakaoSDKReady;
    delete (window as { kakao?: unknown }).kakao;
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // 예전에는 SDK 로딩을 100ms 간격으로 5초간 폴링했다. 가짜 타이머를 쓰면
  // 폴링이 남아 있을 경우 타이머를 진행시키지 않는 한 끝나지 않는다.
  it('SDK 로더가 시작되지 않았으면 기다리지 않는다', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ documents: [] }) }));
    vi.useFakeTimers();

    const result = await new KakaoPlacesClient().keywordToCoordinates('SDK없음병원');

    expect(result).toBeNull();
  });

  it('SDK 로딩이 실패로 끝나면 기다리지 않는다', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ documents: [] }) }));
    window.kakaoSDKReady = Promise.resolve(false);
    vi.useFakeTimers();

    const result = await new KakaoPlacesClient().keywordToCoordinates('SDK실패병원');

    expect(result).toBeNull();
  });

  it('프록시가 비면 SDK 검색으로 넘어간다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ documents: [] }) }));

    const keywordSearch = vi.fn((_query: string, callback: (r: unknown[], s: string) => void) => {
      callback([doc], 'OK');
    });
    (window as unknown as { kakao: unknown }).kakao = {
      maps: { services: { Places: function () { return { keywordSearch }; }, Status: { OK: 'OK' } } },
    };
    window.kakaoSDKReady = Promise.resolve(true);

    const result = await new KakaoPlacesClient().keywordToCoordinates('SDK사용병원');

    expect(keywordSearch).toHaveBeenCalled();
    expect(result?.latitude).toBeCloseTo(35.1524229, 6);
  });
});
