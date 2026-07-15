import test from 'node:test';
import assert from 'node:assert';
import handler from './directions';
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

test('Kakao Directions API', async (t) => {
  const originalFetch = global.fetch;
  const originalEnv = process.env;

  t.beforeEach(() => {
    process.env = { ...originalEnv, KAKAO_REST_API_KEY: 'dummy_kakao_key' };
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

  await t.test('1. POST 요청 405', async () => {
    const { req, res } = createMockReqRes('POST', {});
    await handler(req, res);
    assert.strictEqual(res.statusCode, 405);
    assert.strictEqual(res.headers['Allow'], 'GET');
  });

  await t.test('2. origin 또는 destination 누락 400', async () => {
    const { req, res } = createMockReqRes('GET', { origin: '127.0,37.0' }); // destination missing
    await handler(req, res);
    assert.strictEqual(res.statusCode, 400);
  });

  await t.test('3. 좌표 형식 오류 400', async () => {
    const { req, res } = createMockReqRes('GET', { origin: '127.0,37.0', destination: 'abc,def' });
    await handler(req, res);
    assert.strictEqual(res.statusCode, 400);
  });

  await t.test('4. 위도·경도 범위 오류 400', async () => {
    const { req, res } = createMockReqRes('GET', { origin: '200.0,37.0', destination: '127.0,37.0' });
    await handler(req, res);
    assert.strictEqual(res.statusCode, 400);
  });

  await t.test('5. 허용되지 않은 priority 400', async () => {
    const { req, res } = createMockReqRes('GET', { origin: '127.0,37.0', destination: '127.0,37.0', priority: 'HACK' });
    await handler(req, res);
    assert.strictEqual(res.statusCode, 400);
  });

  await t.test('6. 정상 요청에서 서버 REST 키만 사용', async () => {
    let authHeader = '';
    global.fetch = async (url: any, options: any) => {
      authHeader = options?.headers?.Authorization || '';
      return {
        ok: true,
        json: async () => ({ mock: 'data' })
      } as Response;
    };
    
    const { req, res } = createMockReqRes('GET', { origin: '127.0,37.0', destination: '127.0,37.0' });
    await handler(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(authHeader, 'KakaoAK dummy_kakao_key');
  });
});
