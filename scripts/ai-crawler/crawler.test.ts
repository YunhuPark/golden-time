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
    assert.ok(error.stderr.includes('Missing EGEN_SERVICE_KEY'), '명확한 설정 오류 메시지가 출력되어야 합니다.');
  }
});

test('환경변수 키가 요청에 사용되고 401/403 오류가 안전하게 처리되는 테스트', async () => {
  const { exec } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execAsync = promisify(exec);

  try {
    await execAsync('npx tsx scripts/ai-crawler/index.ts', {
      env: {
        ...process.env,
        EGEN_SERVICE_KEY: 'invalid_test_key',
        VITE_SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test_key',
        NODE_ENV: 'production'
      }
    });
    assert.fail('잘못된 키로 실행했는데도 성공했습니다.');
  } catch (error: any) {
    const output = error.stdout + error.stderr;
    assert.ok(
      output.includes('상태 코드: 401') || output.includes('상태 코드: 403') || output.includes('E-Gen API 병원 목록 조회 실패'),
      '401/403 오류 또는 안전한 실패 메시지가 처리되어야 합니다.'
    );
    assert.ok(!output.includes('invalid_test_key'), '로그에 키 값이 노출되면 안 됩니다.');
  }
});
