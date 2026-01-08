#!/usr/bin/env node

/**
 * Environment Variables Validation Script
 * 프로덕션 배포 전 환경 변수 검증
 *
 * Usage: node scripts/validate-env.js [--env=production|development]
 */

const fs = require('fs');
const path = require('path');

// ANSI 색상 코드
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
 * 필수 환경 변수 정의
 */
const REQUIRED_ENV_VARS = {
  development: [
    'VITE_KAKAO_MAP_APP_KEY',
    'VITE_KAKAO_REST_API_KEY',
  ],
  production: [
    'VITE_EGEN_SERVICE_KEY',
    'VITE_KAKAO_MAP_APP_KEY',
    'VITE_KAKAO_REST_API_KEY',
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'VITE_ENCRYPTION_KEY',
    'VITE_SENTRY_DSN',
  ],
};

/**
 * 선택적 환경 변수
 */
const OPTIONAL_ENV_VARS = [
  'VITE_APP_VERSION',
  'SENTRY_AUTH_TOKEN',
  'SENTRY_ORG',
  'SENTRY_PROJECT',
];

/**
 * 환경 변수 기본값 (개발 환경용)
 */
const DEFAULT_VALUES = {
  'VITE_ENCRYPTION_KEY': 'dev_fallback_key_not_secure_replace_in_production',
  'your_kakao_rest_api_key_here': true,
  'your_kakao_map_app_key_here': true,
  'your_supabase_project_url_here': true,
  'your_supabase_anon_key_here': true,
  'your_32_byte_hex_encryption_key_here': true,
  'your_egen_service_key_here': true,
  'your_sentry_dsn_here': true,
};

/**
 * .env 파일 로드
 */
function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) {
    log(`⚠️  .env 파일이 없습니다: ${envPath}`, 'yellow');
    log(`   .env.example 파일을 복사하여 .env 파일을 생성하세요.`, 'yellow');
    return {};
  }

  const envContent = fs.readFileSync(envPath, 'utf-8');
  const env = {};

  envContent.split('\n').forEach((line) => {
    line = line.trim();

    // 주석 또는 빈 줄 건너뛰기
    if (line.startsWith('#') || !line) return;

    // KEY=VALUE 파싱
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      env[key] = value;
    }
  });

  return env;
}

/**
 * 환경 변수 검증
 */
function validateEnv(env, mode) {
  const errors = [];
  const warnings = [];

  log(`\n🔍 환경 변수 검증 중... (${mode} mode)`, 'cyan');
  log('━'.repeat(60), 'cyan');

  const requiredVars = REQUIRED_ENV_VARS[mode] || REQUIRED_ENV_VARS.development;

  // 필수 변수 검증
  requiredVars.forEach((varName) => {
    const value = env[varName];

    // 1. 변수가 정의되지 않음
    if (!value) {
      errors.push(`❌ ${varName}: 정의되지 않음`);
      return;
    }

    // 2. 기본값(placeholder) 사용 중
    if (DEFAULT_VALUES[value]) {
      if (mode === 'production') {
        errors.push(`❌ ${varName}: 기본값(placeholder)을 사용 중입니다. 실제 값으로 교체하세요.`);
      } else {
        warnings.push(`⚠️  ${varName}: 기본값 사용 중 (개발 환경에서는 허용)`);
      }
      return;
    }

    // 3. 값이 비어있음
    if (value.length === 0) {
      errors.push(`❌ ${varName}: 빈 값`);
      return;
    }

    // 4. URL 형식 검증 (Supabase URL)
    if (varName.includes('URL') && !value.startsWith('http')) {
      errors.push(`❌ ${varName}: 올바른 URL 형식이 아닙니다.`);
      return;
    }

    // 5. 암호화 키 길이 검증 (최소 32자)
    if (varName.includes('ENCRYPTION_KEY') && value.length < 32) {
      errors.push(`❌ ${varName}: 최소 32자 이상이어야 합니다. (현재: ${value.length}자)`);
      return;
    }

    log(`✅ ${varName}`, 'green');
  });

  // 선택적 변수 확인
  log('\n📋 선택적 환경 변수:', 'blue');
  OPTIONAL_ENV_VARS.forEach((varName) => {
    const value = env[varName];
    if (value && value.length > 0 && !DEFAULT_VALUES[value]) {
      log(`✅ ${varName}: 설정됨`, 'green');
    } else {
      log(`⚪ ${varName}: 미설정 (선택사항)`, 'yellow');
    }
  });

  // 결과 출력
  log('\n━'.repeat(60), 'cyan');
  if (errors.length > 0) {
    log('\n❌ 검증 실패:', 'red');
    errors.forEach((error) => log(`   ${error}`, 'red'));
  }

  if (warnings.length > 0) {
    log('\n⚠️  경고:', 'yellow');
    warnings.forEach((warning) => log(`   ${warning}`, 'yellow'));
  }

  if (errors.length === 0 && warnings.length === 0) {
    log('\n✅ 모든 환경 변수가 올바르게 설정되었습니다!', 'green');
    return true;
  }

  if (errors.length === 0) {
    log('\n⚠️  경고가 있지만 실행 가능합니다.', 'yellow');
    return true;
  }

  log('\n❌ 환경 변수 설정이 올바르지 않습니다.', 'red');
  log('   .env.example 파일을 참고하여 수정하세요.', 'red');
  return false;
}

/**
 * 보안 검증
 */
function validateSecurity(env, mode) {
  if (mode !== 'production') return true;

  log('\n🔒 보안 검증 중...', 'magenta');
  log('━'.repeat(60), 'magenta');

  const securityIssues = [];

  // 1. 암호화 키 강도 검증
  const encKey = env.VITE_ENCRYPTION_KEY;
  if (encKey === 'dev_fallback_key_not_secure_replace_in_production') {
    securityIssues.push('암호화 키가 개발용 기본값입니다. 프로덕션에서 절대 사용 금지!');
  }

  // 2. Sentry DSN 검증
  const sentryDSN = env.VITE_SENTRY_DSN;
  if (!sentryDSN || sentryDSN.length === 0) {
    log('⚠️  Sentry DSN이 설정되지 않았습니다. 에러 모니터링이 비활성화됩니다.', 'yellow');
  }

  // 3. 환경 모드 확인
  const viteEnv = env.VITE_ENV;
  if (viteEnv !== 'production') {
    securityIssues.push(`VITE_ENV가 'production'이 아닙니다. (현재: ${viteEnv})`);
  }

  if (securityIssues.length > 0) {
    log('\n❌ 보안 문제 발견:', 'red');
    securityIssues.forEach((issue) => log(`   ${issue}`, 'red'));
    return false;
  }

  log('✅ 보안 검증 통과', 'green');
  return true;
}

/**
 * Main 실행
 */
function main() {
  // CLI 인자 파싱
  const args = process.argv.slice(2);
  const envArg = args.find((arg) => arg.startsWith('--env='));
  const mode = envArg ? envArg.split('=')[1] : 'development';

  if (!['development', 'production'].includes(mode)) {
    log('❌ 올바르지 않은 환경 모드입니다. (development | production)', 'red');
    process.exit(1);
  }

  log('🚀 Golden Time - 환경 변수 검증', 'cyan');
  log(`   모드: ${mode}`, 'cyan');

  // .env 파일 로드 (로컬 환경)
  const envPath = path.resolve(process.cwd(), '.env');
  let env = loadEnvFile(envPath);

  // Vercel 등 CI/CD 환경에서는 process.env 사용
  const isCI = process.env.CI === 'true' || process.env.VERCEL === '1';

  if (Object.keys(env).length === 0) {
    if (isCI) {
      // CI/CD 환경: process.env에서 환경 변수 읽기
      log('ℹ️  CI/CD 환경 감지: process.env에서 환경 변수 로드', 'blue');
      env = process.env;
    } else {
      // 로컬 환경: .env 파일 필요
      log('\n❌ .env 파일이 비어있거나 존재하지 않습니다.', 'red');
      log('   다음 명령어를 실행하여 .env 파일을 생성하세요:', 'yellow');
      log('   cp .env.example .env', 'yellow');
      process.exit(1);
    }
  }

  // 환경 변수 검증
  const envValid = validateEnv(env, mode);

  // 보안 검증 (프로덕션만)
  let securityValid = true;
  if (mode === 'production') {
    securityValid = validateSecurity(env, mode);
  }

  // 최종 결과
  if (!envValid || !securityValid) {
    process.exit(1);
  }

  log('\n✅ 모든 검증 통과!', 'green');
  process.exit(0);
}

// 실행
main();
