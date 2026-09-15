import { test, expect } from '@playwright/test';
import {
  mockEmergencyApis,
  DEFAULT_HOSPITALS,
  CT_ONLY_HOSPITAL,
  MRI_ONLY_HOSPITAL,
  GWANGJU_COORDS,
} from './helpers/egen-mocks';

/**
 * E2E Tests for Exception Cases
 * EXCEPTION_HANDLING_GUIDE.md의 케이스들을 자동으로 테스트한다.
 *
 * 모든 외부 응답은 helpers/egen-mocks.ts에서 고정한다. 실제 E-Gen/Kakao를
 * 호출하면 로컬(/api 프록시 없음)과 CI 양쪽에서 결과가 달라지기 때문이다.
 */

const ORIGIN = 'http://localhost:3000';

test.describe('예외 케이스 처리', () => {
  test.describe('위치 정보', () => {
    test('위치 권한 거부 시 LocationPermissionPrompt와 119 안내가 보인다', async ({ page, context }) => {
      await context.grantPermissions([], { origin: ORIGIN });
      await mockEmergencyApis(page);

      await page.goto('/');

      await expect(page.getByText('위치 권한이 필요합니다')).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(/기본 위치 사용 중/)).toBeVisible();
      // PERMISSION_DENIED의 액션 문구. '다시 시도'는 타임아웃 등 다른 오류용이다.
      await expect(page.getByRole('button', { name: /권한 설정 방법 보기/ })).toBeVisible();
      await expect(page.getByRole('button', { name: /119/ })).toBeVisible();
    });

    test('위치 권한 허용 시 좌표와 병원 목록이 표시된다', async ({ page, context }) => {
      await context.grantPermissions(['geolocation'], { origin: ORIGIN });
      await context.setGeolocation(GWANGJU_COORDS);
      await mockEmergencyApis(page);

      await page.goto('/');

      await expect(page.getByText(/현재 위치: 35\.1595, 126\.8526/)).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(CT_ONLY_HOSPITAL.name).first()).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(MRI_ONLY_HOSPITAL.name).first()).toBeVisible();
    });
  });

  test.describe('네트워크', () => {
    test('오프라인 전환 시 NetworkStatusBanner가 보인다', async ({ page, context }) => {
      await context.grantPermissions(['geolocation'], { origin: ORIGIN });
      await context.setGeolocation(GWANGJU_COORDS);
      await mockEmergencyApis(page);

      await page.goto('/');
      await expect(page.getByText(CT_ONLY_HOSPITAL.name).first()).toBeVisible({ timeout: 10_000 });

      // 페이지 로드 후에 끊는다. 먼저 끊으면 문서 자체를 받지 못한다.
      await context.setOffline(true);

      await expect(page.getByText(/네트워크 연결 없음/)).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(/캐시된 데이터를 사용 중/)).toBeVisible();
    });

    test('네트워크 복구 시 재연결 배너와 새로고침 버튼이 보인다', async ({ page, context }) => {
      await context.grantPermissions(['geolocation'], { origin: ORIGIN });
      await context.setGeolocation(GWANGJU_COORDS);
      await mockEmergencyApis(page);

      await page.goto('/');
      await expect(page.getByText(CT_ONLY_HOSPITAL.name).first()).toBeVisible({ timeout: 10_000 });

      await context.setOffline(true);
      await expect(page.getByText(/네트워크 연결 없음/)).toBeVisible({ timeout: 10_000 });

      await context.setOffline(false);

      // 재연결 배너는 5초 뒤 사라지므로 그 안에 확인해야 한다.
      await expect(page.getByText(/네트워크 연결 복구됨/)).toBeVisible({ timeout: 4_000 });
      await expect(page.getByRole('button', { name: /최신 데이터 불러오기/ })).toBeVisible();
    });
  });

  test.describe('검색 결과', () => {
    test('결과 0건이면 EmptyHospitalList와 119 안내가 보인다', async ({ page, context }) => {
      await context.grantPermissions(['geolocation'], { origin: ORIGIN });
      await context.setGeolocation(GWANGJU_COORDS);
      await mockEmergencyApis(page);

      await page.goto('/');
      await expect(page.getByText(CT_ONLY_HOSPITAL.name).first()).toBeVisible({ timeout: 10_000 });

      // 어느 병원도 CT와 MRI를 동시에 갖지 않으므로 결과는 0건이 된다.
      await page.getByRole('button', { name: /필터/ }).first().click();
      await page.getByRole('button', { name: /CT 촬영 가능/ }).click();
      await page.getByRole('button', { name: /MRI 촬영 가능/ }).click();
      await page.getByRole('button', { name: /필터 적용/ }).click();

      await expect(page.getByText('조건에 맞는 병원이 없습니다')).toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole('button', { name: /필터 초기화/ })).toBeVisible();
      await expect(page.getByText(/긴급 상황이신가요/)).toBeVisible();
    });

    test('필터 초기화 시 병원 목록이 복구된다', async ({ page, context }) => {
      await context.grantPermissions(['geolocation'], { origin: ORIGIN });
      await context.setGeolocation(GWANGJU_COORDS);
      await mockEmergencyApis(page);

      await page.goto('/');
      await expect(page.getByText(CT_ONLY_HOSPITAL.name).first()).toBeVisible({ timeout: 10_000 });

      await page.getByRole('button', { name: /필터/ }).first().click();
      await page.getByRole('button', { name: /CT 촬영 가능/ }).click();
      await page.getByRole('button', { name: /MRI 촬영 가능/ }).click();
      await page.getByRole('button', { name: /필터 적용/ }).click();
      await expect(page.getByText('조건에 맞는 병원이 없습니다')).toBeVisible({ timeout: 10_000 });

      await page.getByRole('button', { name: /필터 초기화/ }).click();

      await expect(page.getByText(CT_ONLY_HOSPITAL.name).first()).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(MRI_ONLY_HOSPITAL.name).first()).toBeVisible();
    });

    test('CT 필터만 적용하면 해당 병원만 남는다', async ({ page, context }) => {
      await context.grantPermissions(['geolocation'], { origin: ORIGIN });
      await context.setGeolocation(GWANGJU_COORDS);
      await mockEmergencyApis(page);

      await page.goto('/');
      await expect(page.getByText(MRI_ONLY_HOSPITAL.name).first()).toBeVisible({ timeout: 10_000 });

      await page.getByRole('button', { name: /필터/ }).first().click();
      await page.getByRole('button', { name: /CT 촬영 가능/ }).click();
      await page.getByRole('button', { name: /필터 적용/ }).click();

      await expect(page.getByText(CT_ONLY_HOSPITAL.name).first()).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(MRI_ONLY_HOSPITAL.name)).toHaveCount(0);
      await expect(page.getByRole('button', { name: /필터 \(1\)/ })).toBeVisible();
    });
  });

  test.describe('UI 인터랙션', () => {
    test('119 호출 버튼은 확인 대화상자를 거친다', async ({ page, context }) => {
      await context.grantPermissions(['geolocation'], { origin: ORIGIN });
      await context.setGeolocation(GWANGJU_COORDS);
      await mockEmergencyApis(page);

      await page.goto('/');

      const emergencyButton = page.getByRole('button', { name: /119/ }).first();
      await expect(emergencyButton).toBeVisible({ timeout: 10_000 });

      let dialogMessage = '';
      page.on('dialog', async (dialog) => {
        dialogMessage = dialog.message();
        // 실제로 전화가 걸리지 않도록 반드시 취소한다.
        await dialog.dismiss();
      });

      await emergencyButton.click();

      await expect.poll(() => dialogMessage).toContain('119');
    });

    test('지도 보기로 전환하면 목록이 숨겨지고 다시 전환하면 돌아온다', async ({ page, context }) => {
      await context.grantPermissions(['geolocation'], { origin: ORIGIN });
      await context.setGeolocation(GWANGJU_COORDS);
      await mockEmergencyApis(page);

      await page.goto('/');
      const hospitalName = page.getByText(CT_ONLY_HOSPITAL.name).first();
      await expect(hospitalName).toBeVisible({ timeout: 10_000 });

      const mapToggle = page.getByRole('button', { name: /지도 보기/ });
      await mapToggle.click();
      await expect(page.getByText(CT_ONLY_HOSPITAL.name)).toHaveCount(0);

      await mapToggle.click();
      await expect(page.getByText(CT_ONLY_HOSPITAL.name).first()).toBeVisible();
    });
  });

  test.describe('로딩', () => {
    test('병원 목록이 15초 안에 렌더링된다', async ({ page, context }) => {
      await context.grantPermissions(['geolocation'], { origin: ORIGIN });
      await context.setGeolocation(GWANGJU_COORDS);
      await mockEmergencyApis(page);

      const startedAt = Date.now();
      await page.goto('/');
      await expect(page.getByText(CT_ONLY_HOSPITAL.name).first()).toBeVisible({ timeout: 15_000 });

      expect(Date.now() - startedAt).toBeLessThan(15_000);
    });

    test('스크롤 후에도 페이지가 응답한다', async ({ page, context }) => {
      await context.grantPermissions(['geolocation'], { origin: ORIGIN });
      await context.setGeolocation(GWANGJU_COORDS);
      await mockEmergencyApis(page);

      await page.goto('/');
      await expect(page.getByText(CT_ONLY_HOSPITAL.name).first()).toBeVisible({ timeout: 10_000 });

      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

      await expect(page.getByRole('button', { name: /119/ }).first()).toBeVisible();
    });
  });

  test.describe('모바일 UX', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('필터 바텀시트를 열고 닫을 수 있다', async ({ page, context }) => {
      await context.grantPermissions(['geolocation'], { origin: ORIGIN });
      await context.setGeolocation(GWANGJU_COORDS);
      await mockEmergencyApis(page);

      await page.goto('/');
      await expect(page.getByText(CT_ONLY_HOSPITAL.name).first()).toBeVisible({ timeout: 10_000 });

      await page.getByRole('button', { name: /필터/ }).first().click();
      const sheetDescription = page.getByText(/원하는 조건의 병원/);
      await expect(sheetDescription).toBeVisible();

      await page.getByRole('button', { name: '×' }).click();
      await expect(sheetDescription).toBeHidden();
    });

    test('119 버튼은 터치하기 충분한 크기다', async ({ page, context }) => {
      await context.grantPermissions(['geolocation'], { origin: ORIGIN });
      await context.setGeolocation(GWANGJU_COORDS);
      await mockEmergencyApis(page);

      await page.goto('/');

      const emergencyButton = page.getByRole('button', { name: /119/ }).first();
      await expect(emergencyButton).toBeVisible({ timeout: 10_000 });

      const box = await emergencyButton.boundingBox();
      // Apple HIG 최소 터치 타깃
      expect(box!.height).toBeGreaterThanOrEqual(44);
    });
  });
});

test.describe('데이터 없음', () => {
  test('주변 병원이 없으면 빈 목록 안내가 보인다', async ({ page, context }) => {
    await context.grantPermissions(['geolocation'], { origin: ORIGIN });
    await context.setGeolocation(GWANGJU_COORDS);
    await mockEmergencyApis(page, []);

    await page.goto('/');

    await expect(page.getByText(/병원이 없습니다/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /119/ }).first()).toBeVisible();
  });
});

// DEFAULT_HOSPITALS의 구성이 필터 시나리오의 전제다. 어긋나면 위 테스트들이
// 조용히 무의미해지므로 여기서 고정한다.
test('픽스처 전제: CT와 MRI를 동시에 갖춘 병원이 없다', () => {
  expect(DEFAULT_HOSPITALS.some((h) => h.ct && h.mri)).toBe(false);
  expect(DEFAULT_HOSPITALS.some((h) => h.ct)).toBe(true);
  expect(DEFAULT_HOSPITALS.some((h) => h.mri)).toBe(true);
});
