/**
 * 질병 정규화(Disease Normalization) 딕셔너리
 * 다양한 동의어, 영문/국문 혼용, 오타 등을 Canonical Disease Code로 변환합니다.
 */

export type CanonicalDiseaseCode = 'sepsis' | 'ards' | 'stroke' | 'trauma' | 'cardiac_arrest' | 'brain_lesion' | 'unsupported';

const TAXONOMY_MAP: Record<string, CanonicalDiseaseCode> = {
  // Sepsis
  'sepsis': 'sepsis',
  '패혈증': 'sepsis',
  '패혈증 (sepsis)': 'sepsis',
  '패혈증(sepsis)': 'sepsis',
  
  // ARDS
  'ards': 'ards',
  '급성호흡곤란증후군': 'ards',
  '호흡곤란증후군': 'ards',
  
  // Stroke / Brain Lesion
  'stroke': 'stroke',
  '뇌졸중': 'stroke',
  '뇌경색': 'stroke',
  '뇌종양': 'brain_lesion',
  '신경과': 'brain_lesion',
  '신경외과': 'brain_lesion',
  'brain_lesion_demo': 'brain_lesion',

  // Trauma
  'trauma': 'trauma',
  '중증외상': 'trauma',
  '외상': 'trauma',
  '저혈량성 쇼크': 'trauma',
  '출혈성 쇼크': 'trauma',

  // Cardiac
  '심혈관': 'cardiac_arrest',
  '심근경색': 'cardiac_arrest',
  '심장': 'cardiac_arrest',
};

/**
 * 임의의 문자열 키워드를 입력받아 정규화된 Canonical Disease Code를 반환합니다.
 * 매칭되지 않는(지원하지 않는) 질병이거나 N/A 등은 null을 반환합니다.
 */
export function normalizeDisease(keyword: string | null | undefined): CanonicalDiseaseCode | null {
  if (!keyword) return null;
  const lower = keyword.trim().toLowerCase();
  
  if (lower === 'n/a' || lower === 'unknown' || lower === '') return null;

  if (TAXONOMY_MAP[lower]) {
    return TAXONOMY_MAP[lower];
  }

  return null;
}
