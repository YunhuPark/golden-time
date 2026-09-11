import { test, expect } from '@playwright/test';

const EMPTY_EGEN_RESPONSE = {
  response: {
    header: {
      resultCode: '00',
      resultMsg: 'NORMAL SERVICE.',
    },
    body: {
      numOfRows: 1,
      pageNo: 1,
      totalCount: 0,
    },
  },
};

test('location-denied fallback renders without live API dependencies', async ({ page, context }) => {
  await context.grantPermissions([], { origin: 'http://localhost:3000' });

  await page.route('**/api/egen?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(EMPTY_EGEN_RESPONSE),
    });
  });

  await page.goto('/');

  await expect(page).toHaveTitle(/Golden Time/);
  await expect(page.getByText('위치 권한이 필요합니다')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('현재 기본 위치 사용 중')).toBeVisible();
  await expect(page.getByRole('button', { name: /119/ })).toBeVisible();
});
