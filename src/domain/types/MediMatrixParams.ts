/**
 * MediMatrixParams
 * Medi-Matrix → Golden-Time 연동 파라미터 타입 정의 및 파서
 *
 * 보안 원칙:
 * - 허용 목록(allowlist) 기반 검증만 통과
 * - 최대 길이 초과 쿼리는 거부
 * - 민감정보(JWT, patient_id 등)는 이 파라미터에 포함될 수 없음
 * - console.warn에 원문 파라미터 값을 출력하지 않음
 * - vitalsCondition은 화면 표시용으로만 사용하고 점수 계산에 미사용
 * - clinicalValidation이 정확히 'false'인 경우만 특화 모드로 인정
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

/** 허용된 triage 값 */
const ALLOWED_TRIAGE = ['RED', 'ORANGE', 'YELLOW', 'GREEN'] as const;
export type TriageLevel = (typeof ALLOWED_TRIAGE)[number];

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
  /**
   * 임상 검증 여부 — 반드시 false여야 합성 데이터 연동으로 인정됩니다.
   * 'false'가 아닌 경우 파서가 null을 반환합니다.
   */
  clinicalValidation: false;
  /**
   * Vitals에서 확인된 추가 합병증 조건 (화면 표시용, 점수 계산에 미사용)
   * 값은 최대 120자로 제한됩니다.
   */
  vitalsCondition?: string;
  /** 검증된 triage 레벨 */
  triage: TriageLevel;
}

/** 파라미터 최대 길이 제한 (보안, DoS 방지) */
const MAX_PARAM_LENGTH = 200;
const MAX_VITALS_CONDITION_LENGTH = 120;
const MAX_LIST_ITEMS = 10;
const MAX_VOLUME = 10_000_000;

/** 거부 사유를 값 노출 없이 로깅 */
function rejectLog(field: string, reason: string): null {
  // 원문 값을 출력하지 않음 — 필드명과 사유만 로깅
  console.warn(`[MediMatrix] Rejected param '${field}': ${reason}`);
  return null;
}

/**
 * URL SearchParams에서 MediMatrixParams를 파싱하고 검증합니다.
 *
 * 특화 모드로 인정되려면:
 * 1. analysisMode=synthetic_demo (allowlist)
 * 2. condition이 allowlist에 포함
 * 3. clinicalValidation이 정확히 'false'
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

  // 길이 제한 검사 (DoS 방지) — 원문 미출력
  if (rawAnalysisMode.length > MAX_PARAM_LENGTH) {
    return rejectLog('analysisMode', 'exceeds max length');
  }
  if (rawCondition.length > MAX_PARAM_LENGTH) {
    return rejectLog('condition', 'exceeds max length');
  }

  // analysisMode 허용 목록 검사
  if (!ALLOWED_ANALYSIS_MODES.includes(rawAnalysisMode as AnalysisMode)) {
    return rejectLog('analysisMode', 'not in allowlist');
  }

  // condition 허용 목록 검사
  if (!ALLOWED_CONDITIONS.includes(rawCondition as MediMatrixCondition)) {
    return rejectLog('condition', 'not in allowlist');
  }

  // clinicalValidation 검사: 정확히 'false'여야 특화 모드로 인정
  const rawClinicalValidation = searchParams.get('clinicalValidation');
  if (rawClinicalValidation !== 'false') {
    return rejectLog('clinicalValidation', 'must be exactly "false"');
  }

  // specialties 파싱 및 검증 (길이 제한 + allowlist)
  const rawSpecialties = searchParams.get('specialties') ?? '';
  if (rawSpecialties.length > MAX_PARAM_LENGTH) {
    return rejectLog('specialties', 'exceeds max length');
  }
  const specialties = rawSpecialties
    .split(',')
    .slice(0, MAX_LIST_ITEMS)                         // 항목 수 제한
    .map((s) => s.trim().toLowerCase().slice(0, 50)) // 항목별 길이 제한
    .filter((s): s is MediMatrixSpecialty =>
      ALLOWED_SPECIALTIES.includes(s as MediMatrixSpecialty)
    );

  // capabilities 파싱 및 검증 (길이 제한 + allowlist)
  const rawCapabilities = searchParams.get('capabilities') ?? '';
  if (rawCapabilities.length > MAX_PARAM_LENGTH) {
    return rejectLog('capabilities', 'exceeds max length');
  }
  const capabilities = rawCapabilities
    .split(',')
    .slice(0, MAX_LIST_ITEMS)
    .map((s) => s.trim().toLowerCase().slice(0, 50))
    .filter((s): s is MediMatrixCapability =>
      ALLOWED_CAPABILITIES.includes(s as MediMatrixCapability)
    );

  // volume 파싱 및 범위 검사 — 원문 미출력
  const rawVolume = searchParams.get('volume');
  const volume = rawVolume ? Number(rawVolume) : 0;
  if (!Number.isFinite(volume) || volume < 0 || volume > MAX_VOLUME) {
    return rejectLog('volume', 'out of valid range');
  }

  // triage 파싱 및 검증
  const rawTriage = searchParams.get('triage');
  const triage: TriageLevel = ALLOWED_TRIAGE.includes(rawTriage as TriageLevel)
    ? (rawTriage as TriageLevel)
    : 'RED';

  // vitalsCondition: 화면 표시 전용, 점수 계산 미사용
  // URLSearchParams.get()은 이미 URL 디코딩된 값을 반환하므로 추가 decodeURIComponent 불필요
  const rawVitalsCondition = searchParams.get('vitalsCondition');
  let vitalsCondition: string | undefined;
  if (rawVitalsCondition) {
    if (rawVitalsCondition.length > MAX_PARAM_LENGTH) {
      // 길이 초과 시 거부가 아닌 잘라내기 (표시 전용)
      vitalsCondition = rawVitalsCondition.slice(0, MAX_VITALS_CONDITION_LENGTH);
    } else {
      vitalsCondition = rawVitalsCondition; // 이미 디코딩됨
    }
  }

  return {
    analysisMode: rawAnalysisMode as AnalysisMode,
    condition: rawCondition as MediMatrixCondition,
    specialties,
    capabilities,
    volume,
    clinicalValidation: false,
    triage,
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
