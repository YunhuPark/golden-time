import test from 'node:test';
import assert from 'node:assert';
import handler from './egen';
import { VercelRequest, VercelResponse } from '@vercel/node';

function createMockReqRes(method: string, query: Record<string, any>) {
  const req = { method, query } as unknown as VercelRequest;
  const res: any = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.body = data;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
      return this;
    }
  };
  return { req, res: res as VercelResponse & { statusCode: number; headers: any; body: any } };
}

test('EGen API', async (t) => {
  const originalFetch = global.fetch;
  const originalEnv = process.env;

  t.beforeEach(() => {
    process.env = { ...originalEnv, EGEN_SERVICE_KEY: 'dummy_server_key' };
    global.fetch = async () => {
      return {
        ok: true,
        json: async () => ({ mock: 'data' })
      } as Response;
    };
  });

  t.afterEach(() => {
    global.fetch = originalFetch;
    process.env = originalEnv;
  });

  await t.test('1. POST 요청은 405와 Allow: GET 반환', async () => {
    const { req, res } = createMockReqRes('POST', {});
    await handler(req, res);
    assert.strictEqual(res.statusCode, 405);
    assert.strictEqual(res.headers['Allow'], 'GET');
  });

  await t.test('2. _endpoint 누락은 400', async () => {
    const { req, res } = createMockReqRes('GET', {});
    await handler(req, res);
    assert.strictEqual(res.statusCode, 400);
  });

  await t.test('3. 허용되지 않은 endpoint는 403', async () => {
    const { req, res } = createMockReqRes('GET', { _endpoint: '/getSomeOtherData' });
    await handler(req, res);
    assert.strictEqual(res.statusCode, 403);
  });

  await t.test('4. 경로 우회 문자열은 거부', async () => {
    const { req, res } = createMockReqRes('GET', { _endpoint: '../getSomeData' });
    await handler(req, res);
    assert.strictEqual(res.statusCode, 403);
  });

  await t.test('5. 잘못된 numOfRows는 400', async () => {
    const { req, res } = createMockReqRes('GET', { _endpoint: '/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire', numOfRows: 'abc' });
    await handler(req, res);
    assert.strictEqual(res.statusCode, 400);

    const { req: req2, res: res2 } = createMockReqRes('GET', { _endpoint: '/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire', numOfRows: '301' });
    await handler(req2, res2);
    assert.strictEqual(res2.statusCode, 400);

    const { req: req3, res: res3 } = createMockReqRes('GET', { _endpoint: '/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire', numOfRows: '1.5' });
    await handler(req3, res3);
    assert.strictEqual(res3.statusCode, 400);
  });

  await t.test('5-1. 잘못된 _type은 400', async () => {
    const { req, res } = createMockReqRes('GET', { _endpoint: '/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire', _type: 'xml' });
    await handler(req, res);
    assert.strictEqual(res.statusCode, 400);
  });

  await t.test('6. 클라이언트 serviceKey가 upstream에 전달되지 않음 / 7. 허용된 endpoint 요청에는 서버 환경변수 키만 주입', async () => {
    let requestedUrl = '';
    global.fetch = async (url: any) => {
      requestedUrl = url.toString();
      return {
        ok: true,
        json: async () => ({ mock: 'data' })
      } as Response;
    };
    
    const { req, res } = createMockReqRes('GET', { _endpoint: '/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire', serviceKey: 'client_key_attack' });
    await handler(req, res);
    assert.strictEqual(res.statusCode, 200);
    const urlObj = new URL(requestedUrl);
    assert.strictEqual(urlObj.searchParams.get('serviceKey'), 'dummy_server_key');
    assert.strictEqual(urlObj.protocol, 'https:');
  });

  await t.test('8. upstream AbortError는 504', async () => {
    global.fetch = async () => {
      const error = new Error('AbortError');
      error.name = 'AbortError';
      throw error;
    };
    const { req, res } = createMockReqRes('GET', { _endpoint: '/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire' });
    await handler(req, res);
    assert.strictEqual(res.statusCode, 504);
  });

  await t.test('9. upstream 일반 오류는 안전한 502', async () => {
    global.fetch = async () => {
      throw new Error('Some random network error');
    };
    const { req, res } = createMockReqRes('GET', { _endpoint: '/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire' });
    await handler(req, res);
    assert.strictEqual(res.statusCode, 502);
  });
});
