import type { Page } from '@playwright/test';

/**
 * E-Gen / Kakao 응답을 고정해 E2E를 결정론적으로 만든다.
 *
 * 앱은 브라우저에서 외부 API를 직접 호출하지 않고 /api/egen, /api/kakao/*
 * 서버리스 프록시를 거친다. 이 프록시는 `npm run dev`에서 동작하지 않으므로
 * 여기서 응답을 가로채야 로컬과 CI 양쪽에서 같은 결과가 나온다.
 */

export interface MockHospital {
  hpid: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
  tel: string;
  emergencyTel: string;
  /** dutyEmcls — 권역/지역 응급의료센터 등급 */
  traumaClass: string;
  /** dutyEryn === '1' → isOperating */
  operating: boolean;
  /** hvec → availableBeds */
  emergencyBeds: number;
  /** hvoc > 0 → hasSurgery */
  operatingRooms: number;
  /** hvctayn === 'Y' → hasCT */
  ct: boolean;
  /** hvmriayn === 'Y' → hasMRI */
  mri: boolean;
}

/** CT는 있고 MRI는 없다. 수술실과 응급병상이 있어 나머지 필터를 통과한다. */
export const CT_ONLY_HOSPITAL: MockHospital = {
  hpid: 'A1500022',
  name: '상무병원',
  address: '광주광역시 서구 상무자유로 181-7',
  lat: 35.1524229,
  lon: 126.8539184,
  tel: '0626007000',
  emergencyTel: '0626007119',
  traumaClass: 'A',
  operating: true,
  emergencyBeds: 5,
  operatingRooms: 3,
  ct: true,
  mri: false,
};

/** MRI는 있고 CT는 없다. 수술실과 응급병상이 없다. */
export const MRI_ONLY_HOSPITAL: MockHospital = {
  hpid: 'A1500023',
  name: '무등병원',
  address: '광주광역시 남구 서문대로 1',
  lat: 35.1401,
  lon: 126.9021,
  tel: '0626007100',
  emergencyTel: '0626007119',
  traumaClass: 'B',
  operating: true,
  emergencyBeds: 0,
  operatingRooms: 0,
  ct: false,
  mri: true,
};

/**
 * 어느 병원도 CT와 MRI를 동시에 갖지 않는다. 덕분에 두 필터를 함께 켜면
 * 결과가 반드시 0건이 되어 EmptyHospitalList 경로를 확정적으로 검증할 수 있다.
 */
export const DEFAULT_HOSPITALS: MockHospital[] = [CT_ONLY_HOSPITAL, MRI_ONLY_HOSPITAL];

export const GWANGJU_COORDS = { latitude: 35.1595, longitude: 126.8526 };

const envelope = (items: unknown[]) => ({
  response: {
    header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' },
    body: {
      items: items.length > 0 ? { item: items } : undefined,
      numOfRows: items.length,
      pageNo: 1,
      totalCount: items.length,
    },
  },
});

const toLocationItem = (h: MockHospital) => ({
  hpid: h.hpid,
  dutyName: h.name,
  dutyAddr: h.address,
  latitude: h.lat,
  longitude: h.lon,
  distance: 0.8,
  dutyDiv: 'A',
  dutyDivName: '종합병원',
});

const toBasicInfoItem = (h: MockHospital) => ({
  hpid: h.hpid,
  dutyName: h.name,
  dutyAddr: h.address,
  dutyTel1: h.tel,
  dutyTel3: h.emergencyTel,
  wgs84Lat: String(h.lat),
  wgs84Lon: String(h.lon),
  dutyEmcls: h.traumaClass,
  dutyEryn: h.operating ? '1' : '0',
});

const toBedItem = (h: MockHospital) => ({
  hpid: h.hpid,
  dutyName: h.name,
  hvec: String(h.emergencyBeds),
  hvicc: '2',
  hvcc: '1',
  hvoc: String(h.operatingRooms),
  hvctayn: h.ct ? 'Y' : 'N',
  hvmriayn: h.mri ? 'Y' : 'N',
  hvidate: '2026-09-11T14:45:00+09:00',
});

const json = (body: unknown) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

/**
 * 모든 외부 의존성을 고정한다. 병원 목록을 비우면 "주변에 병원이 없음" 경로를
 * 재현할 수 있다.
 */
export async function mockEmergencyApis(
  page: Page,
  hospitals: MockHospital[] = DEFAULT_HOSPITALS
): Promise<void> {
  await page.route('**/api/egen?**', async (route) => {
    const endpoint = new URL(route.request().url()).searchParams.get('_endpoint') ?? '';

    if (endpoint.endsWith('/getEgytLcinfoInqire')) {
      await route.fulfill(json(envelope(hospitals.map(toLocationItem))));
      return;
    }
    if (endpoint.endsWith('/getEgytListInfoInqire')) {
      await route.fulfill(json(envelope(hospitals.map(toBasicInfoItem))));
      return;
    }
    if (endpoint.endsWith('/getEmrrmRltmUsefulSckbdInfoInqire')) {
      await route.fulfill(json(envelope(hospitals.map(toBedItem))));
      return;
    }

    await route.fulfill(json(envelope([])));
  });

  await page.route('**/api/kakao/directions?**', async (route) => {
    await route.fulfill(json({
      trans_id: 'e2e-exception-cases',
      routes: [{
        result_code: 0,
        result_msg: 'success',
        summary: { distance: 950, duration: 180, fare: { taxi: 4500, toll: 0 } },
        sections: [],
      }],
    }));
  });

  // 좌표가 이미 채워져 있어 호출될 일이 없지만, 실제 네트워크로 새어나가지
  // 않도록 막아둔다.
  await page.route('**/api/kakao/geocoding?**', async (route) => {
    await route.fulfill(json({ documents: [] }));
  });

  // Kakao Maps SDK는 외부 스크립트이므로 차단해 지도 뷰를 확정적으로 만든다.
  // 지도 렌더링 자체가 아니라 뷰 전환 동작을 검증한다.
  await page.route('**/dapi.kakao.com/**', (route) => route.abort());
}
