#!/usr/bin/env node

/**
 * Golden Time environment validation.
 *
 * Usage:
 *   node scripts/validate-env.cjs --env=development
 *   node scripts/validate-env.cjs --env=production
 */

const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Variables required regardless of build mode belong in common.
 * Supabase is intentionally NOT here because it is an opt-in capability.
 */
const REQUIRED_ENV_VARS = {
  common: ['VITE_KAKAO_MAP_APP_KEY'],
  development: [],
  production: ['VITE_ENCRYPTION_KEY'],
};

const SUPABASE_REQUIRED_ENV_VARS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
];

const OPTIONAL_ENV_VARS = [
  'VITE_APP_VERSION',
  'VITE_SENTRY_DSN',
  'SENTRY_AUTH_TOKEN',
  'SENTRY_ORG',
  'SENTRY_PROJECT',
];

const DEFAULT_VALUES = {
  dev_fallback_key_not_secure_replace_in_production: true,
  your_kakao_map_app_key_here: true,
  'https://your-project.supabase.co': true,
  your_supabase_project_url_here: true,
  your_supabase_anon_key_here: true,
  your_encryption_key_here: true,
  your_32_byte_hex_encryption_key_here: true,
  your_sentry_dsn_here: true,
};

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) {
    return {};
  }

  const envContent = fs.readFileSync(envPath, 'utf-8');
  const env = {};

  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (!match) return;

    const key = match[1].trim();
    let value = match[2].trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  });

  return env;
}

function isSupabaseEnabled(env) {
  return env.VITE_SUPABASE_ENABLED === 'true';
}

function getRequiredVars(env, mode) {
  const modeRequired = REQUIRED_ENV_VARS[mode] || [];
  const required = [...REQUIRED_ENV_VARS.common, ...modeRequired];

  if (isSupabaseEnabled(env)) {
    required.push(...SUPABASE_REQUIRED_ENV_VARS);
  }

  return [...new Set(required)];
}

function validateSupabaseUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && /^[a-z0-9-]+\.supabase\.co$/i.test(url.hostname);
  } catch {
    return false;
  }
}

function collectValidationIssues(env, mode) {
  const errors = [];
  const warnings = [];

  const supabaseFlag = env.VITE_SUPABASE_ENABLED;
  if (
    supabaseFlag !== undefined &&
    supabaseFlag !== '' &&
    supabaseFlag !== 'true' &&
    supabaseFlag !== 'false'
  ) {
    errors.push('❌ VITE_SUPABASE_ENABLED: true 또는 false만 사용할 수 있습니다.');
  }

  const requiredVars = getRequiredVars(env, mode);

  for (const varName of requiredVars) {
    const value = env[varName];

    if (!value || value.length === 0) {
      errors.push(`❌ ${varName}: 정의되지 않음`);
      continue;
    }

    if (DEFAULT_VALUES[value]) {
      if (mode === 'production') {
        errors.push(`❌ ${varName}: 기본값(placeholder)을 사용 중입니다. 실제 값으로 교체하세요.`);
      } else {
        warnings.push(`⚠️ ${varName}: 기본값 사용 중 (개발 환경에서는 허용)`);
      }
      continue;
    }

    if (varName === 'VITE_SUPABASE_URL' && !validateSupabaseUrl(value)) {
      errors.push(`❌ ${varName}: https://<project-ref>.supabase.co 형식이어야 합니다.`);
      continue;
    }

    if (varName === 'VITE_ENCRYPTION_KEY' && value.length < 32) {
      errors.push(`❌ ${varName}: 최소 32자 이상이어야 합니다. (현재: ${value.length}자)`);
    }
  }

  if (!isSupabaseEnabled(env)) {
    const configuredWhileDisabled = SUPABASE_REQUIRED_ENV_VARS.filter(
      (name) => env[name] && env[name].length > 0
    );
    if (configuredWhileDisabled.length > 0) {
      warnings.push(
        '⚠️ Supabase URL/key가 설정되어 있지만 VITE_SUPABASE_ENABLED=true가 아니므로 계정 기능은 비활성화됩니다.'
      );
    }
  }

  return { errors, warnings, requiredVars };
}

function validateEnv(env, mode) {
  log(`\n🔍 환경 변수 검증 중... (${mode} mode)`, 'cyan');
  log('━'.repeat(60), 'cyan');

  const { errors, warnings, requiredVars } = collectValidationIssues(env, mode);

  log('\n📌 필수 환경 변수:', 'blue');
  requiredVars.forEach((varName) => {
    if (env[varName] && !errors.some((error) => error.includes(varName))) {
      log(`✅ ${varName}`, 'green');
    }
  });

  log(
    `\n🗄️ Supabase 계정 기능: ${isSupabaseEnabled(env) ? '활성화' : '비활성화'}`,
    isSupabaseEnabled(env) ? 'green' : 'yellow'
  );

  log('\n📋 선택적 환경 변수:', 'blue');
  OPTIONAL_ENV_VARS.forEach((varName) => {
    const value = env[varName];
    if (value && value.length > 0 && !DEFAULT_VALUES[value]) {
      log(`✅ ${varName}: 설정됨`, 'green');
    } else {
      log(`⚪ ${varName}: 미설정 (선택사항)`, 'yellow');
    }
  });

  log('\n' + '━'.repeat(60), 'cyan');

  if (errors.length > 0) {
    log('\n❌ 검증 실패:', 'red');
    errors.forEach((error) => log(`   ${error}`, 'red'));
  }

  if (warnings.length > 0) {
    log('\n⚠️ 경고:', 'yellow');
    warnings.forEach((warning) => log(`   ${warning}`, 'yellow'));
  }

  if (errors.length === 0) {
    log('\n✅ 환경 변수 검증 통과', 'green');
    return true;
  }

  log('\n❌ 환경 변수 설정이 올바르지 않습니다.', 'red');
  log('   .env.example 파일을 참고하여 수정하세요.', 'red');
  return false;
}

function validateSecurity(env, mode) {
  if (mode !== 'production') return true;

  log('\n🔒 보안 검증 중...', 'magenta');
  log('━'.repeat(60), 'magenta');

  const securityIssues = [];
  const encKey = env.VITE_ENCRYPTION_KEY;

  if (encKey === 'dev_fallback_key_not_secure_replace_in_production') {
    securityIssues.push('암호화 키가 개발용 기본값입니다. 프로덕션에서 사용할 수 없습니다.');
  }

  if (!env.VITE_SENTRY_DSN) {
    log('⚠️ Sentry DSN이 설정되지 않아 에러 모니터링이 비활성화됩니다.', 'yellow');
  }

  if (securityIssues.length > 0) {
    log('\n❌ 보안 문제 발견:', 'red');
    securityIssues.forEach((issue) => log(`   ${issue}`, 'red'));
    return false;
  }

  log('✅ 보안 검증 통과', 'green');
  return true;
}

function main() {
  const args = process.argv.slice(2);
  const envArg = args.find((arg) => arg.startsWith('--env='));
  const mode = envArg ? envArg.split('=')[1] : 'development';

  if (!['development', 'production'].includes(mode)) {
    log('❌ 올바르지 않은 환경 모드입니다. (development | production)', 'red');
    process.exit(1);
  }

  log('🚀 Golden Time - 환경 변수 검증', 'cyan');
  log(`   모드: ${mode}`, 'cyan');

  const envPath = path.resolve(process.cwd(), '.env');
  const fileEnv = loadEnvFile(envPath);
  const isCI = process.env.CI === 'true' || process.env.VERCEL === '1';

  let env;
  if (isCI) {
    // Deployment-provided values take precedence over any checked/local file.
    env = { ...fileEnv, ...process.env };
    log('ℹ️ CI/CD 환경 감지: process.env를 우선하여 검증합니다.', 'blue');
  } else {
    env = fileEnv;
  }

  if (Object.keys(env).length === 0) {
    log(`\n❌ .env 파일이 없습니다: ${envPath}`, 'red');
    log('   .env.example 파일을 복사하여 .env 파일을 생성하세요.', 'yellow');
    process.exit(1);
  }

  const envValid = validateEnv(env, mode);
  const securityValid = validateSecurity(env, mode);

  if (!envValid || !securityValid) {
    process.exit(1);
  }

  log('\n✅ 모든 검증 통과!', 'green');
}

if (require.main === module) {
  main();
}

module.exports = {
  REQUIRED_ENV_VARS,
  SUPABASE_REQUIRED_ENV_VARS,
  collectValidationIssues,
  getRequiredVars,
  isSupabaseEnabled,
  loadEnvFile,
  validateSupabaseUrl,
};
