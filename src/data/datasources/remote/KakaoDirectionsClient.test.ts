import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { KakaoDirectionsClient } from './KakaoDirectionsClient';

const originalFetch = global.fetch;
const originalConsoleWarn = console.warn;

function mockFetch(responses: Array<{ status: number; body?: any; error?: Error }>) {
  let callCount = 0;
  global.fetch = vi.fn().mockImplementation(async () => {
    const res = responses[callCount++];
    if (!res) throw new Error('Unexpected fetch call');
    
    if (res.error) throw res.error;
    
    return {
      ok: res.status >= 200 && res.status < 300,
      status: res.status,
      json: async () => res.body,
    } as Response;
  });
}

describe('KakaoDirectionsClient', () => {
  const origin = { latitude: 37.0, longitude: 127.0 };
  const destination = { latitude: 37.1, longitude: 127.1 };

  beforeEach(() => {
    console.warn = vi.fn();
    (global as any).window = { location: { origin: 'http://localhost' } };
  });

  afterEach(() => {
    global.fetch = originalFetch;
    console.warn = originalConsoleWarn;
    delete (global as any).window;
    vi.restoreAllMocks();
  });

  it('첫 요청 성공', async () => {
    mockFetch([{
      status: 200,
      body: {
        routes: [{
          result_code: 0,
          summary: { distance: 1000, duration: 600, fare: { taxi: 0, toll: 0 } }
        }]
      }
    }]);

    const client = new KakaoDirectionsClient(1000, 1);
    const result = await client.getRouteInfo(origin, destination);
    
    expect(result).toBeTruthy();
    expect(result?.duration).toBe(600);
    expect(result?.distance).toBe(1000);
  });

  it('429 후 1초 대기 및 1회 재시도 성공', async () => {
    mockFetch([
      { status: 429 },
      {
        status: 200,
        body: {
          routes: [{
            result_code: 0,
            summary: { distance: 2000, duration: 1200, fare: { taxi: 0, toll: 0 } }
          }]
        }
      }
    ]);

    const client = new KakaoDirectionsClient(1000, 1);
    const start = Date.now();
    const result = await client.getRouteInfo(origin, destination);
    const elapsed = Date.now() - start;

    expect(result).toBeTruthy();
    expect(result?.duration).toBe(1200);
    expect(elapsed).toBeGreaterThanOrEqual(1000);
  });

  it('503 후 재시도 실패', async () => {
    mockFetch([
      { status: 503 },
      { status: 503 }
    ]);

    const client = new KakaoDirectionsClient(1000, 1);
    const result = await client.getRouteInfo(origin, destination);
    
    expect(result).toBeNull();
  });

  it('timeout 후 재시도 성공', async () => {
    const abortError = new Error('AbortError');
    abortError.name = 'AbortError';

    mockFetch([
      { status: 0, error: abortError },
      {
        status: 200,
        body: {
          routes: [{
            result_code: 0,
            summary: { distance: 3000, duration: 1800, fare: { taxi: 0, toll: 0 } }
          }]
        }
      }
    ]);

    const client = new KakaoDirectionsClient(1000, 1);
    const start = Date.now();
    const result = await client.getRouteInfo(origin, destination);
    const elapsed = Date.now() - start;

    expect(result).toBeTruthy();
    expect(result?.duration).toBe(1800);
    expect(elapsed).toBeGreaterThanOrEqual(1000);
  });

  it('400/401/403은 재시도 없음', async () => {
    mockFetch([
      { status: 400 },
      { status: 200, body: {} }
    ]);

    const client = new KakaoDirectionsClient(1000, 1);
    const start = Date.now();
    const result = await client.getRouteInfo(origin, destination);
    const elapsed = Date.now() - start;

    expect(result).toBeNull();
    expect(elapsed).toBeLessThan(500);
  });

  it('batch 동시 실행 및 개별 실패 시 결과 유지', async () => {
    mockFetch([
      { status: 200, body: { routes: [{ result_code: 0, summary: { distance: 1, duration: 1, fare: {} } }] } },
      { status: 400 },
      { status: 200, body: { routes: [{ result_code: 0, summary: { distance: 3, duration: 3, fare: {} } }] } },
    ]);

    const client = new KakaoDirectionsClient(1000, 1);
    const targets = [
      { id: 'h1', latitude: 37.1, longitude: 127.1 },
      { id: 'h2', latitude: 37.2, longitude: 127.2 },
      { id: 'h3', latitude: 37.3, longitude: 127.3 },
    ];

    const results = await client.getRouteInfoBatch(origin, targets, 3);
    
    expect(results.size).toBe(2);
    expect(results.has('h1')).toBe(true);
    expect(results.has('h2')).toBe(false);
    expect(results.has('h3')).toBe(true);
  });
});
