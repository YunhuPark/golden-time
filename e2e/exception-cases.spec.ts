import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Exception Cases
 * EXCEPTION_HANDLING_GUIDE.md의 케이스들을 자동으로 테스트
 */

test.describe('예외 케이스 처리 테스트', () => {

  test.describe('위치 정보 관련', () => {
    test('위치 권한 거부 시 LocationPermissionPrompt 표시', async ({ page, context }) => {
      // 위치 권한 거부
      await context.grantPermissions([], { origin: 'http://localhost:3000' });

      await page.goto('/');

      // LocationPermissionPrompt가 표시되는지 확인
      await expect(page.getByText(/위치 권한이 필요합니다/i)).toBeVisible({ timeout: 10000 });

      // 기본 위치 안내 확인
      await expect(page.getByText(/기본 위치 사용 중/i)).toBeVisible();

      // 재시도 버튼 존재 확인
      await expect(page.getByRole('button', { name: /다시 시도/i })).toBeVisible();
    });

    test('위치 권한 허용 시 정상 작동', async ({ page, context }) => {
      // 위치 권한 허용 및 서울시청 좌표 설정
      await context.setGeolocation({ latitude: 37.5663, longitude: 126.9779 });
      await context.grantPermissions(['geolocation']);

      await page.goto('/');

      // 병원 목록이 로드되는지 확인
      await expect(page.getByText(/병원/i)).toBeVisible({ timeout: 15000 });

      // 위치 정보 표시 확인
      await expect(page.getByText(/현재 위치:/i)).toBeVisible();
    });
  });

  test.describe('네트워크 관련', () => {
    test('오프라인 시 NetworkStatusBanner 표시', async ({ page, context }) => {
      await page.goto('/');

      // 오프라인 모드로 전환
      await context.setOffline(true);

      // 새로고침 트리거
      await page.reload();

      // 오프라인 배너 확인
      await expect(page.getByText(/네트워크 연결 없음/i)).toBeVisible({ timeout: 5000 });
      await expect(page.getByText(/캐시된 데이터를 사용 중/i)).toBeVisible();
    });

    test('네트워크 복구 시 재연결 배너 표시', async ({ page, context }) => {
      // 먼저 오프라인
      await context.setOffline(true);
      await page.goto('/');

      // 다시 온라인
      await context.setOffline(false);

      // 재연결 배너 확인
      await expect(page.getByText(/네트워크 연결 복구됨/i)).toBeVisible({ timeout: 5000 });

      // "최신 데이터 불러오기" 버튼 확인
      await expect(page.getByRole('button', { name: /최신 데이터 불러오기/i })).toBeVisible();
    });
  });

  test.describe('검색 결과 관련', () => {
    test('필터 활성화로 결과 0건 시 EmptyHospitalList 표시', async ({ page }) => {
      await page.goto('/');

      // 병원 목록 로드 대기
      await page.waitForSelector('text=/병원/i', { timeout: 15000 });

      // 필터 버튼 클릭
      await page.click('button:has-text("필터")');

      // 모든 필터 활성화 (결과 0개로 만들기)
      await page.click('text=CT 촬영 가능');
      await page.click('text=MRI 촬영 가능');
      await page.click('text=수술 가능');
      await page.click('text=24시간 운영');
      await page.click('text=병상 여유 있음');

      // 필터 적용
      await page.click('button:has-text("필터 적용")');

      // EmptyHospitalList 확인
      await expect(page.getByText(/조건에 맞는 병원이 없습니다/i)).toBeVisible({ timeout: 5000 });

      // 필터 초기화 버튼 확인
      await expect(page.getByRole('button', { name: /필터 초기화/i })).toBeVisible();

      // 119 긴급 전화 안내 확인
      await expect(page.getByText(/긴급 상황이신가요/i)).toBeVisible();
    });

    test('필터 초기화 시 병원 목록 복구', async ({ page }) => {
      await page.goto('/');

      // 필터 활성화 후 초기화
      await page.click('button:has-text("필터")');
      await page.click('text=CT 촬영 가능');
      await page.click('text=MRI 촬영 가능');
      await page.click('button:has-text("필터 적용")');

      // 결과 없음 확인
      await expect(page.getByText(/조건에 맞는 병원이 없습니다/i)).toBeVisible({ timeout: 5000 });

      // 필터 초기화
      await page.click('button:has-text("필터 초기화")');

      // 병원 목록 복구 확인
      await expect(page.getByText(/병원/i)).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('UI 인터랙션', () => {
    test('119 긴급 호출 버튼 항상 접근 가능', async ({ page }) => {
      await page.goto('/');

      // 119 버튼 확인
      const emergencyButton = page.getByRole('button', { name: /119/i });
      await expect(emergencyButton).toBeVisible();

      // 클릭 시 confirm 다이얼로그 표시 (실제 전화는 안 걸림)
      page.on('dialog', dialog => {
        expect(dialog.message()).toContain('119');
        dialog.dismiss();
      });

      await emergencyButton.click();
    });

    test('지도/리스트 뷰 전환', async ({ page }) => {
      await page.goto('/');

      // 병원 목록 로드 대기
      await page.waitForSelector('text=/병원/i', { timeout: 15000 });

      // 지도 보기 버튼 클릭
      await page.click('button:has-text("지도 보기")');

      // 지도가 표시되는지 확인 (Kakao Map)
      await expect(page.locator('#kakao-map')).toBeVisible({ timeout: 5000 });

      // 리스트 보기로 다시 전환
      await page.click('button:has-text("리스트 보기")');

      // 병원 목록 확인
      await expect(page.getByText(/병원/i)).toBeVisible();
    });

    test('필터 적용 시 카운트 표시', async ({ page }) => {
      await page.goto('/');

      // 필터 버튼 클릭
      await page.click('button:has-text("필터")');

      // CT 필터 활성화
      await page.click('text=CT 촬영 가능');

      // 필터 적용
      await page.click('button:has-text("필터 적용")');

      // 필터 카운트 확인
      await expect(page.getByText(/필터.*1/i)).toBeVisible();
    });
  });

  test.describe('성능 및 로딩', () => {
    test('초기 로딩 시간 15초 이내', async ({ page }) => {
      const startTime = Date.now();

      await page.goto('/');

      // 병원 목록 로드 완료까지 대기
      await page.waitForSelector('text=/병원/i', { timeout: 15000 });

      const loadTime = Date.now() - startTime;

      // 15초 이내 로딩 확인
      expect(loadTime).toBeLessThan(15000);
      console.log(`Initial load time: ${loadTime}ms`);
    });

    test('병원 목록 스크롤 성능', async ({ page }) => {
      await page.goto('/');

      // 병원 목록 로드 대기
      await page.waitForSelector('text=/병원/i', { timeout: 15000 });

      // 스크롤 테스트
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });

      // 렌더링 안정성 확인 (에러 없이 스크롤 완료)
      await page.waitForTimeout(1000);

      // 페이지가 여전히 응답하는지 확인
      await expect(page.getByText(/Golden Time/i)).toBeVisible();
    });
  });

  test.describe('모바일 UX', () => {
    test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

    test('모바일에서 터치 인터랙션', async ({ page }) => {
      await page.goto('/');

      // 병원 목록 로드 대기
      await page.waitForSelector('text=/병원/i', { timeout: 15000 });

      // 필터 버튼 터치
      await page.tap('button:has-text("필터")');

      // BottomSheet 표시 확인
      await expect(page.getByText(/원하는 조건의 병원/i)).toBeVisible();

      // 닫기 버튼 터치
      await page.tap('button:has-text("×")');

      // BottomSheet 닫힘 확인
      await expect(page.getByText(/원하는 조건의 병원/i)).not.toBeVisible();
    });

    test('모바일에서 119 긴급 호출 버튼 접근성', async ({ page }) => {
      await page.goto('/');

      // 119 버튼이 상단에 고정되어 있고 접근 가능한지 확인
      const emergencyButton = page.getByRole('button', { name: /119/i });
      await expect(emergencyButton).toBeVisible();

      // 버튼 크기 확인 (터치하기 충분히 큰지)
      const box = await emergencyButton.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44); // 최소 44px (Apple HIG)
    });
  });
});
