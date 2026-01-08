/**
 * 병원 목록 정렬 옵션
 */
export type SortOption =
  | 'RECOMMENDED'  // 추천순 (AI 점수 기반)
  | 'DISTANCE'     // 거리순 (가까운 순)
  | 'TIME'         // 시간순 (빠른 도착 순)
  | 'BEDS';        // 병상순 (많은 순)

/**
 * 정렬 옵션 메타데이터
 */
export interface SortOptionMeta {
  value: SortOption;
  label: string;
  icon: string;
  description: string;
}

/**
 * 사용 가능한 정렬 옵션 목록
 */
export const SORT_OPTIONS: SortOptionMeta[] = [
  {
    value: 'RECOMMENDED',
    label: '추천순',
    icon: '⭐',
    description: 'AI 기반 종합 점수',
  },
  {
    value: 'TIME',
    label: '시간순',
    icon: '🚗',
    description: '빠른 도착 순',
  },
  {
    value: 'DISTANCE',
    label: '거리순',
    icon: '📍',
    description: '가까운 순',
  },
  {
    value: 'BEDS',
    label: '병상순',
    icon: '🛏️',
    description: '가용 병상 많은 순',
  },
];
