import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration
 *
 * 예외 케이스 자동화 테스트 설정
 */
export default defineConfig({
  testDir: './e2e',

  // 테스트 타임아웃 (긴급 상황 시나리오 감안)
  timeout: 30 * 1000, // 30초

  // 각 테스트 간 완전 격리
  fullyParallel: true,

  // CI 환경에서 실패 시 재시도 금지
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,

  // 병렬 실행 워커 수
  workers: process.env.CI ? 1 : undefined,

  // Reporter 설정
  reporter: [
    ['html'],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
  ],

  // 공통 설정
  use: {
    // Base URL
    baseURL: 'http://localhost:3000',

    // 스크린샷 & 비디오 (실패 시에만)
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // Trace (디버깅용)
    trace: 'on-first-retry',

    // 긴급 상황 시뮬레이션을 위한 느린 네트워크
    // (특정 테스트에서만 사용)
  },

  // 테스트 전 개발 서버 자동 시작
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000, // 2분
  },

  // 프로젝트 (브라우저별 테스트)
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // 모바일 테스트 (응급실 앱 특성상 중요)
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },

    // 추가 브라우저 (선택사항 - CI에서만)
    ...(process.env.CI ? [
      {
        name: 'firefox',
        use: { ...devices['Desktop Firefox'] },
      },
      {
        name: 'webkit',
        use: { ...devices['Desktop Safari'] },
      },
    ] : []),
  ],
});
