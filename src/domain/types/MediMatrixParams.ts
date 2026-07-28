/**
 * MediMatrixParams
 * Medi-Matrix → Golden-Time 연동 파라미터 타입 정의 및 파서
 *
 * 보안 원칙:
 * - 허용 목록(allowlist) 기반 검증만 통과
 * - 최대 길이 초과 쿼리는 거부
 * - 민감정보(JWT, patient_id 등)는 이 파라미터에 포함될 수 없음
 */

/** 허용된 분석 모드 */
const ALLOWED_ANALYSIS_MODES = ['synthetic_demo'] as const;
export type AnalysisMode = (typeof ALLOWED_ANALYSIS_MODES)[number];

/** 허용된 condition 값 */
const ALLOWED_CONDITIONS = ['brain_lesion_demo', 'unsupported_modality'] as const;
export type MediMatrixCondition = (typeof ALLOWED_CONDITIONS)[number];

/** 허용된 specialty 값 (소문자 영어, E-Gen specializations과 매핑) */
const ALLOWED_SPECIALTIES = ['neurosurgery', 'neurology'] as const;
export type MediMatrixSpecialty = (typeof ALLOWED_SPECIALTIES)[number];

/** 허용된 capability 값 */
const ALLOWED_CAPABILITIES = ['emergency_surgery', 'icu', 'brain_imaging'] as const;
export type MediMatrixCapability = (typeof ALLOWED_CAPABILITIES)[number];

/**
 * Medi-Matrix에서 Golden-Time으로 전달되는 연동 파라미터
 */
export interface MediMatrixParams {
  /** 분석 모드 */
  analysisMode: AnalysisMode;
  /** 병변 조건 식별자 */
  condition: MediMatrixCondition;
  /** 요청 진료과 목록 */
  specialties: MediMatrixSpecialty[];
  /** 요청 치료 역량 목록 */
  capabilities: MediMatrixCapability[];
  /** 병변 체적 (voxels) */
  volume: number;
  /** 임상 검증 여부 (항상 false - 합성 데이터) */
  clinicalValidation: false;
  /** Vitals에서 확인된 추가 합병증 조건 (선택) */
  vitalsCondition?: string;
}

/** 파라미터 최대 길이 제한 (보안) */
const MAX_PARAM_LENGTH = 200;
const MAX_VOLUME = 10_000_000;

/**
 * URL SearchParams에서 MediMatrixParams를 파싱하고 검증합니다.
 *
 * @returns 검증된 파라미터 또는 null (파라미터 없거나 유효하지 않은 경우)
 */
export function parseMediMatrixParams(
  searchParams: URLSearchParams
): MediMatrixParams | null {
  const rawAnalysisMode = searchParams.get('analysisMode');
  const rawCondition = searchParams.get('condition');

  // 핵심 파라미터가 없으면 Medi-Matrix 연동이 아닌 일반 접속
  if (!rawAnalysisMode || !rawCondition) {
    return null;
  }

  // 길이 제한 검사 (DoS 방지)
  if (rawAnalysisMode.length > MAX_PARAM_LENGTH || rawCondition.length > MAX_PARAM_LENGTH) {
    console.warn('[MediMatrix] Query parameter too long, rejecting.');
    return null;
  }

  // analysisMode 허용 목록 검사
  if (!ALLOWED_ANALYSIS_MODES.includes(rawAnalysisMode as AnalysisMode)) {
    console.warn(`[MediMatrix] Invalid analysisMode: ${rawAnalysisMode}`);
    return null;
  }

  // condition 허용 목록 검사
  if (!ALLOWED_CONDITIONS.includes(rawCondition as MediMatrixCondition)) {
    console.warn(`[MediMatrix] Invalid condition: ${rawCondition}`);
    return null;
  }

  // specialties 파싱 및 검증
  const rawSpecialties = searchParams.get('specialties') ?? '';
  const specialties = rawSpecialties
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is MediMatrixSpecialty =>
      ALLOWED_SPECIALTIES.includes(s as MediMatrixSpecialty)
    );

  // capabilities 파싱 및 검증
  const rawCapabilities = searchParams.get('capabilities') ?? '';
  const capabilities = rawCapabilities
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is MediMatrixCapability =>
      ALLOWED_CAPABILITIES.includes(s as MediMatrixCapability)
    );

  // volume 파싱 및 범위 검사
  const rawVolume = searchParams.get('volume');
  const volume = rawVolume ? Number(rawVolume) : 0;
  if (!Number.isFinite(volume) || volume < 0 || volume > MAX_VOLUME) {
    console.warn(`[MediMatrix] Invalid volume: ${rawVolume}`);
    return null;
  }

  // vitalsCondition (선택, 길이 제한 적용)
  const rawVitalsCondition = searchParams.get('vitalsCondition');
  let vitalsCondition: string | undefined;
  if (rawVitalsCondition && rawVitalsCondition.length <= MAX_PARAM_LENGTH) {
    try {
      // URL 인코딩 해제
      vitalsCondition = decodeURIComponent(rawVitalsCondition);
    } catch {
      vitalsCondition = undefined;
    }
  }

  return {
    analysisMode: rawAnalysisMode as AnalysisMode,
    condition: rawCondition as MediMatrixCondition,
    specialties,
    capabilities,
    volume,
    clinicalValidation: false,
    ...(vitalsCondition !== undefined && { vitalsCondition }),
  };
}

/**
 * Brain 병변 조건에서 검색할 한국어 진료과 키워드 목록을 반환합니다.
 * HospitalSpecialtyService의 specializations 매핑에 사용됩니다.
 */
export function getKoreanSpecialtiesForCondition(condition: MediMatrixCondition): string[] {
  switch (condition) {
    case 'brain_lesion_demo':
      return ['신경외과', '신경과', '뇌졸중', '뇌종양'];
    case 'unsupported_modality':
      return [];
    default:
      return [];
  }
}
