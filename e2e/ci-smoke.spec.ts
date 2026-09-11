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

const egenResponse = (item: unknown, totalCount = 1) => ({
  response: {
    header: {
      resultCode: '00',
      resultMsg: 'NORMAL SERVICE.',
    },
    body: {
      items: item ? { item } : undefined,
      numOfRows: totalCount,
      pageNo: 1,
      totalCount,
    },
  },
});

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

test('GPS search discovers nearby E-Gen hospitals and renders realtime beds deterministically', async ({ page, context }) => {
  const origin = 'http://localhost:3000';
  await context.grantPermissions(['geolocation'], { origin });
  await context.setGeolocation({ latitude: 35.1595, longitude: 126.8526 });

  await page.route('**/api/egen?**', async (route) => {
    const url = new URL(route.request().url());
    const endpoint = url.searchParams.get('_endpoint');

    if (endpoint?.endsWith('/getEgytLcinfoInqire')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(egenResponse({
          hpid: 'A1500022',
          dutyName: '상무병원',
          dutyAddr: '광주광역시 서구 상무자유로 181-7',
          latitude: 35.1524229,
          longitude: 126.8539184,
          distance: 0.8,
          dutyDiv: 'A',
          dutyDivName: '종합병원',
        })),
      });
      return;
    }

    if (endpoint?.endsWith('/getEgytListInfoInqire')) {
      const qz = url.searchParams.get('QZ');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(qz === 'A'
          ? egenResponse({
              hpid: 'A1500022',
              dutyName: '상무병원',
              dutyAddr: '광주광역시 서구 상무자유로 181-7',
              dutyTel1: '0626007000',
              dutyTel3: '0626007119',
              wgs84Lat: '35.1524229',
              wgs84Lon: '126.8539184',
              dutyEmcls: 'A',
              dutyEryn: '1',
            })
          : EMPTY_EGEN_RESPONSE),
      });
      return;
    }

    if (endpoint?.endsWith('/getEmrrmRltmUsefulSckbdInfoInqire')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(egenResponse({
          hpid: 'A1500022',
          dutyName: '상무병원',
          hvec: '5',
          hvicc: '2',
          hvcc: '1',
          hvoc: '3',
          hvctayn: 'Y',
          hvmriayn: 'Y',
          hvidate: '2026-09-11T14:45:00+09:00',
        })),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(EMPTY_EGEN_RESPONSE),
    });
  });

  await page.route('**/api/kakao/directions?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        trans_id: 'ci-smoke',
        routes: [{
          result_code: 0,
          result_msg: 'success',
          summary: {
            origin: { name: '', x: 126.8526, y: 35.1595 },
            destination: { name: '', x: 126.8539184, y: 35.1524229 },
            waypoints: [],
            priority: 'RECOMMEND',
            bound: { min_x: 126.8526, min_y: 35.1524, max_x: 126.8539, max_y: 35.1595 },
            fare: { taxi: 4500, toll: 0 },
            distance: 950,
            duration: 180,
          },
          sections: [],
        }],
      }),
    });
  });

  await page.goto('/');

  await expect(page.getByText(/현재 위치: 35\.1595, 126\.8526/)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('상무병원').first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/총\s*1개\s*병원 검색됨/)).toBeVisible();
  await expect(page.getByRole('button', { name: /119/ })).toBeVisible();
});
