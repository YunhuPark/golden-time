import test, { mock } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('하드코딩 키가 소스에 존재하지 않는 테스트', () => {
  const content = fs.readFileSync(path.join(__dirname, 'index.ts'), 'utf-8');
  assert.ok(!content.includes('HARDCODED_KEY'), 'HARDCODED_KEY 변수명이 존재합니다.');
  assert.ok(!content.includes('24e573c3571a5e29f58333bd1b0ae2d7af7a69b89cacbbdc578e56961b469b4c'), '실제 하드코딩 키 문자열이 존재합니다.');
});

test('EGEN_SERVICE_KEY 누락 시 외부 요청 없이 실패하는 테스트', async () => {
  const { exec } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execAsync = promisify(exec);

  try {
    await execAsync('npx tsx scripts/ai-crawler/index.ts', {
      env: {
        ...process.env,
        EGEN_SERVICE_KEY: '',
        VITE_SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test_key'
      }
    });
    assert.fail('EGEN_SERVICE_KEY가 없는데도 스크립트가 성공했습니다.');
  } catch (error: any) {
    const output = String(error.stdout || '') + String(error.stderr || '');
    assert.ok(output.includes('Missing EGEN_SERVICE_KEY'), '명확한 설정 오류 메시지가 출력되어야 합니다.');
  }
});

test('환경변수 키가 요청에 사용되고 401/403 오류가 안전하게 처리되는 테스트', async () => {
  const { exec } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execAsync = promisify(exec);
  const http = await import('node:http');

  const server = http.createServer((req, res) => {
    if (req.url?.includes('hospital_specialties')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('[]');
    } else if (req.url?.includes('getEmrrmRltmUsefulSckbdInfoInqire')) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end('{}');
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise(r => server.listen(0, () => r(null)));
  const port = (server.address() as any).port;
  const localUrl = 'http://localhost:' + port;

  try {
    await execAsync('npx tsx scripts/ai-crawler/index.ts', {
      env: {
        ...process.env,
        EGEN_SERVICE_KEY: 'invalid_test_key',
        VITE_SUPABASE_URL: localUrl,
        EGEN_BASE_URL: localUrl,
        SUPABASE_SERVICE_ROLE_KEY: 'test_key',
        NODE_ENV: 'production'
      }
    });
    assert.fail('잘못된 키로 실행했는데도 성공했습니다.');
  } catch (error: any) {
    const output = String(error.stdout || '') + String(error.stderr || '');
    assert.ok(
      output.includes('상태 코드: 401') || output.includes('상태 코드: 403') || output.includes('E-Gen API 병원 목록 조회 실패') || output.includes('E-Gen API 인증 실패'),
      '401/403 오류 또는 안전한 실패 메시지가 처리되어야 합니다.'
    );
    assert.ok(!output.includes('invalid_test_key'), '로그에 키 값이 노출되면 안 됩니다.');
  } finally {
    server.close();
  }
});



import { withRetry, RetryOptions } from './utils';
import axios from 'axios';

test('withRetry: 성공 시 즉시 반환', async () => {
  let count = 0;
  const fn = async () => { count++; return 'success'; };
  const result = await withRetry(fn);
  assert.strictEqual(result, 'success');
  assert.strictEqual(count, 1);
});

test('withRetry: fetch failed 후 재시도 성공', async () => {
  let count = 0;
  const fn = async () => {
    count++;
    if (count === 1) throw new TypeError('fetch failed');
    return 'success';
  };
  const sleepFn = mock.fn(async () => {});
  const result = await withRetry(fn, { maxRetries: 3, sleepFn });
  
  assert.strictEqual(result, 'success');
  assert.strictEqual(count, 2);
  assert.strictEqual(sleepFn.mock.calls.length, 1);
});

test('withRetry: 총 3회 시도 후 실패', async () => {
  let count = 0;
  const fn = async () => {
    count++;
    throw new TypeError('fetch failed');
  };
  const sleepFn = mock.fn(async () => {});
  
  try {
    await withRetry(fn, { maxRetries: 3, sleepFn });
    assert.fail('Should have thrown');
  } catch (e: any) {
    assert.strictEqual(e.message, 'fetch failed');
  }
  assert.strictEqual(count, 3);
  assert.strictEqual(sleepFn.mock.calls.length, 2);
});

test('withRetry: 401/403은 1회만 시도', async () => {
  let count = 0;
  const fn = async () => {
    count++;
    const err: any = new Error('Unauthorized');
    err.isAxiosError = true;
    err.response = { status: 401 };
    throw err;
  };
  const sleepFn = mock.fn(async () => {});
  
  try {
    await withRetry(fn, { maxRetries: 3, sleepFn });
    assert.fail('Should have thrown');
  } catch (e: any) {
    assert.strictEqual(e.message, 'Unauthorized');
  }
  assert.strictEqual(count, 1);
  assert.strictEqual(sleepFn.mock.calls.length, 0);
});

test('withRetry: Retry-After 우선 적용', async () => {
  let count = 0;
  const fn = async () => {
    count++;
    if (count === 1) {
      const err: any = new Error('Too Many Requests');
      err.isAxiosError = true;
      err.response = { status: 429, headers: { 'retry-after': '2' } };
      throw err;
    }
    return 'success';
  };
  
  let sleptFor = 0;
  const sleepFn = mock.fn(async (ms: number) => { sleptFor = ms; });
  
  await withRetry(fn, { maxRetries: 3, sleepFn });
  assert.strictEqual(count, 2);
  // Retry-After 2초 -> 2000ms
  assert.strictEqual(sleptFor, 2000);
});

test('withRetry: Timeout 발생 후 실패 전파', async () => {
  const fn = async () => {
    const err = new Error('Supabase request timed out');
    err.name = 'AbortError';
    throw err;
  };
  
  try {
    await withRetry(fn, { maxRetries: 3 });
    assert.fail('Should have thrown');
  } catch (e: any) {
    assert.strictEqual(e.name, 'AbortError');
  }
});

import http from 'node:http';

test('Integration: 사전 검증 실패 시 조기 종료', async () => {
  const { exec } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execAsync = promisify(exec);

  const server = http.createServer((req, res) => {
    res.writeHead(500);
    res.end();
  });
  await new Promise(r => server.listen(0, () => r(null)));
  const port = (server.address() as any).port;
  const localUrl = 'http://localhost:' + port;

  try {
    await execAsync('npx tsx scripts/ai-crawler/index.ts', {
      env: {
        ...process.env,
        EGEN_SERVICE_KEY: 'test',
        VITE_SUPABASE_URL: 'https://test' + port + '.supabase.co', // Fake URL that fails to resolve
        SUPABASE_SERVICE_ROLE_KEY: 'test',
      }
    });
    assert.fail('Should fail on pre-flight');
  } catch (error: any) {
    const output = String(error.stdout || '') + String(error.stderr || '');
    assert.ok(output.includes('사전 검증 실패'), '사전 검증 실패 메시지가 출력되어야 합니다.');
    assert.ok(!output.includes('전국 병원 목록을 가져옵니다'), '병원 목록 조회가 시작되면 안 됩니다.');
  } finally {
    server.close();
  }
});
