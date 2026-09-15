import { describe, expect, it, vi } from 'vitest';
import { HospitalMapper } from './HospitalMapper';
import type { CombinedHospitalDTO } from '../HospitalDTO';

const GWANGJU = { lat: '35.1524229', lon: '126.8539184' };

const dto = (overrides: {
  basicInfo?: Partial<CombinedHospitalDTO['basicInfo']>;
  bedInfo?: Partial<NonNullable<CombinedHospitalDTO['bedInfo']>> | null;
} = {}): CombinedHospitalDTO => ({
  basicInfo: {
    hpid: 'A1500022',
    dutyName: '상무병원',
    dutyAddr: '광주광역시 서구 상무자유로 181-7',
    dutyTel1: '0626007000',
    dutyTel3: '0626007119',
    wgs84Lat: GWANGJU.lat,
    wgs84Lon: GWANGJU.lon,
    dutyEmcls: 'A',
    dutyEryn: '1',
    ...overrides.basicInfo,
  } as CombinedHospitalDTO['basicInfo'],
  bedInfo: overrides.bedInfo === null
    ? undefined
    : ({
        hpid: 'A1500022',
        dutyName: '상무병원',
        hvec: '5',
        hvicc: '2',
        hvcc: '1',
        hvoc: '3',
        hvctayn: 'Y',
        hvmriayn: 'N',
        hvidate: '2026-09-11T14:45:00+09:00',
        ...overrides.bedInfo,
      } as NonNullable<CombinedHospitalDTO['bedInfo']>),
});

describe('HospitalMapper.toDomain — 좌표', () => {
  it('유효한 좌표를 그대로 사용한다', () => {
    const hospital = HospitalMapper.toDomain(dto());

    expect(hospital?.coordinates.latitude).toBeCloseTo(35.1524229, 6);
    expect(hospital?.coordinates.longitude).toBeCloseTo(126.8539184, 6);
  });

  // 회귀 방지: 예전에는 좌표가 없으면 서울시청(37.5663, 126.9779)으로 대체했다.
  // 그 결과 실제로는 먼 병원이 서울 사용자에게 0km로 보이고 상단에 노출됐다.
  it.each([
    ['좌표가 비어 있으면', { wgs84Lat: undefined, wgs84Lon: undefined }],
    ['좌표가 0이면', { wgs84Lat: '0', wgs84Lon: '0' }],
    ['숫자가 아니면', { wgs84Lat: 'N/A', wgs84Lon: 'N/A' }],
    ['한국 범위를 벗어나면', { wgs84Lat: '48.85', wgs84Lon: '2.35' }],
  ])('%s 기본 좌표로 대체하지 않고 병원을 제외한다', (_label, basicInfo) => {
    expect(HospitalMapper.toDomain(dto({ basicInfo }))).toBeNull();
  });

  it('위도와 경도가 바뀌어 들어오면 제외한다', () => {
    const swapped = dto({ basicInfo: { wgs84Lat: GWANGJU.lon, wgs84Lon: GWANGJU.lat } });

    expect(HospitalMapper.toDomain(swapped)).toBeNull();
  });
});

describe('HospitalMapper.toDomain — 식별자와 자원', () => {
  it.each([
    ['hpid가 없으면', { hpid: '' }],
    ['병원명이 없으면', { dutyName: '' }],
  ])('%s 제외한다', (_label, basicInfo) => {
    expect(HospitalMapper.toDomain(dto({ basicInfo }))).toBeNull();
  });

  it('실시간 병상 수치를 그대로 옮긴다', () => {
    const hospital = HospitalMapper.toDomain(dto());

    expect(hospital?.availableBeds).toBe(5);
    expect(hospital?.icuAvailableBeds).toBe(2);
    expect(hospital?.neuroIcuAvailableBeds).toBe(1);
  });

  it('음수 병상은 0으로 보정한다', () => {
    const hospital = HospitalMapper.toDomain(dto({ bedInfo: { hvec: '-3' } }));

    expect(hospital?.availableBeds).toBe(0);
  });

  it('CT/MRI는 Y일 때만 보유로 본다', () => {
    const hospital = HospitalMapper.toDomain(dto());

    expect(hospital?.hasCT).toBe(true);
    expect(hospital?.hasMRI).toBe(false);
  });

  it('수술실이 0이면 수술 불가로 본다', () => {
    expect(HospitalMapper.toDomain(dto({ bedInfo: { hvoc: '0' } }))?.hasSurgery).toBe(false);
    expect(HospitalMapper.toDomain(dto({ bedInfo: { hvoc: '3' } }))?.hasSurgery).toBe(true);
  });

  it('병상 정보가 아예 없어도 병원을 유지하되 자원은 0으로 둔다', () => {
    const hospital = HospitalMapper.toDomain(dto({ bedInfo: null }));

    expect(hospital).not.toBeNull();
    expect(hospital?.availableBeds).toBe(0);
    expect(hospital?.hasCT).toBe(false);
  });

  it('dutyEryn이 1일 때만 운영 중으로 본다', () => {
    expect(HospitalMapper.toDomain(dto())?.isOperating).toBe(true);
    expect(HospitalMapper.toDomain(dto({ basicInfo: { dutyEryn: '2' } }))?.isOperating).toBe(false);
  });

  it.each([
    ['A', 1],
    ['B', 2],
    ['C', 3],
  ])('응급의료기관 등급 %s를 외상 레벨 %i로 옮긴다', (dutyEmcls, expected) => {
    expect(HospitalMapper.toDomain(dto({ basicInfo: { dutyEmcls } }))?.traumaLevel).toBe(expected);
  });

  it('알 수 없는 등급은 외상 레벨을 비운다', () => {
    expect(HospitalMapper.toDomain(dto({ basicInfo: { dutyEmcls: 'Z' } }))?.traumaLevel).toBeNull();
  });
});

describe('HospitalMapper.toDomain — 전화번호', () => {
  it('대표번호를 우선 사용한다', () => {
    expect(HospitalMapper.toDomain(dto())?.phoneNumber).toBe('062-600-7000');
  });

  it('대표번호가 없으면 응급실 번호로 대체한다', () => {
    const hospital = HospitalMapper.toDomain(dto({ basicInfo: { dutyTel1: undefined } }));

    expect(hospital?.phoneNumber).toBe('062-600-7119');
  });

  it('쓸 수 있는 번호가 없으면 없음으로 표시한다', () => {
    const hospital = HospitalMapper.toDomain(
      dto({ basicInfo: { dutyTel1: '-', dutyTel3: undefined } })
    );

    expect(hospital?.phoneNumber).toBe('전화번호 없음');
  });
});

describe('HospitalMapper.toDomainList', () => {
  it('제외된 병원 수를 경고로 남긴다', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const hospitals = HospitalMapper.toDomainList([
      dto(),
      dto({ basicInfo: { hpid: 'A1500023', wgs84Lat: undefined, wgs84Lon: undefined } }),
    ]);

    expect(hospitals).toHaveLength(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('1건'));

    // 경고에 병원명이나 좌표가 섞여 나가면 안 된다.
    const message = warn.mock.calls[0]![0] as string;
    expect(message).not.toContain('상무병원');

    warn.mockRestore();
  });

  it('제외된 병원이 없으면 경고하지 않는다', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(HospitalMapper.toDomainList([dto()])).toHaveLength(1);
    expect(warn).not.toHaveBeenCalled();

    warn.mockRestore();
  });
});
