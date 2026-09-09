const test = require('node:test');
const assert = require('node:assert/strict');

const {
  collectValidationIssues,
  getRequiredVars,
} = require('./validate-env.cjs');

test('production includes common and production requirements', () => {
  const required = getRequiredVars(
    {
      VITE_SUPABASE_ENABLED: 'false',
    },
    'production'
  );

  assert.deepEqual(
    required.sort(),
    ['VITE_ENCRYPTION_KEY', 'VITE_KAKAO_MAP_APP_KEY'].sort()
  );
});

test('Supabase credentials are optional when capability is disabled', () => {
  const { errors } = collectValidationIssues(
    {
      VITE_KAKAO_MAP_APP_KEY: 'real-kakao-js-key',
      VITE_ENCRYPTION_KEY: '12345678901234567890123456789012',
      VITE_SUPABASE_ENABLED: 'false',
    },
    'production'
  );

  assert.deepEqual(errors, []);
});

test('Supabase credentials become required when capability is enabled', () => {
  const { errors, requiredVars } = collectValidationIssues(
    {
      VITE_KAKAO_MAP_APP_KEY: 'real-kakao-js-key',
      VITE_ENCRYPTION_KEY: '12345678901234567890123456789012',
      VITE_SUPABASE_ENABLED: 'true',
    },
    'production'
  );

  assert.ok(requiredVars.includes('VITE_SUPABASE_URL'));
  assert.ok(requiredVars.includes('VITE_SUPABASE_ANON_KEY'));
  assert.ok(errors.some((error) => error.includes('VITE_SUPABASE_URL')));
  assert.ok(errors.some((error) => error.includes('VITE_SUPABASE_ANON_KEY')));
});

test('invalid Supabase enable flag fails validation', () => {
  const { errors } = collectValidationIssues(
    {
      VITE_KAKAO_MAP_APP_KEY: 'real-kakao-js-key',
      VITE_ENCRYPTION_KEY: '12345678901234567890123456789012',
      VITE_SUPABASE_ENABLED: 'yes',
    },
    'production'
  );

  assert.ok(errors.some((error) => error.includes('VITE_SUPABASE_ENABLED')));
});

test('enabled Supabase requires a canonical project URL shape', () => {
  const { errors } = collectValidationIssues(
    {
      VITE_KAKAO_MAP_APP_KEY: 'real-kakao-js-key',
      VITE_ENCRYPTION_KEY: '12345678901234567890123456789012',
      VITE_SUPABASE_ENABLED: 'true',
      VITE_SUPABASE_URL: 'https://example.com',
      VITE_SUPABASE_ANON_KEY: 'sb_publishable_example',
    },
    'production'
  );

  assert.ok(errors.some((error) => error.includes('VITE_SUPABASE_URL')));
});
