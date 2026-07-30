import test from 'node:test';
import assert from 'node:assert';
import handler from './geocoding';
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

test('Kakao Geocoding API', async (t) => {
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

  await t.test('2. 빈 query 400', async () => {
    const { req, res } = createMockReqRes('GET', { type: 'address', query: '   ' });
    await handler(req, res);
    assert.strictEqual(res.statusCode, 400);
  });

  await t.test('3. 과도하게 긴 query 400', async () => {
    const { req, res } = createMockReqRes('GET', { type: 'address', query: 'a'.repeat(101) });
    await handler(req, res);
    assert.strictEqual(res.statusCode, 400);
  });

  await t.test('4. 잘못된 page 또는 size 400', async () => {
    const { req, res } = createMockReqRes('GET', { type: 'address', query: 'Seoul', page: '46' });
    await handler(req, res);
    assert.strictEqual(res.statusCode, 400);
  });

  await t.test('5. 서버 REST 키만 Authorization 헤더에 사용', async () => {
    let authHeader = '';
    global.fetch = async (url: any, options: any) => {
      authHeader = options?.headers?.Authorization || '';
      return {
        ok: true,
        json: async () => ({ mock: 'data' })
      } as Response;
    };
    
    const { req, res } = createMockReqRes('GET', { type: 'address', query: 'Seoul' });
    await handler(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(authHeader, 'KakaoAK dummy_kakao_key');
  });
});
