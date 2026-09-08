import { Hospital } from '../entities/Hospital';
import { Coordinates } from '../valueObjects/Coordinates';
import { IHospitalRepository } from '../repositories/IHospitalRepository';
import { AIAnalysisContext } from '../types/AIContext';

/**
 * 검색 결과 타입
 */
export interface HospitalSearchResult {
  hospitals: Hospital[];
  warning: HospitalSearchWarning | null;
}

/**
 * 경고 메시지 타입
 */
export interface HospitalSearchWarning {
  type: 'NO_HOSPITALS_FOUND' | 'NO_BEDS_AVAILABLE' | 'DATA_STALE' | 'LOW_ACCURACY' | 'NETWORK_ERROR';
  message: string;
  action?: {
    type: 'CALL_119' | 'EXPAND_SEARCH' | 'REFRESH_DATA';
    label: string;
    onClick?: () => void;
  };
}

/**
 * GetNearbyHospitals Use Case
 *
 * 사용자 위치 주변의 응급실을 검색하고 최적 병원을 추천
 */
export class GetNearbyHospitals {
  constructor(
    private readonly hospitalRepository: IHospitalRepository
  ) {}

  /**
   * 주변 병원 검색 실행
   */
  async execute(
    userLocation: Coordinates,
    aiContext?: AIAnalysisContext | null
  ): Promise<HospitalSearchResult> {
    // Hospital ranking no longer depends on the legacy hospital_specialties
    // table. The current AI matching contract is based on E-Gen-confirmable
    // resources (ER/ICU/CT/MRI/etc.), so do not block emergency search on an
    // unrelated Supabase query.
    const allHospitals = await this.hospitalRepository.findNearby(userLocation, aiContext);

    // 가용 병상이 있는 병원 필터링 (임시로 운영중인 병원만)
    const availableHospitals = allHospitals.filter(
      (h) => h.isOperating
    );

    // Edge Case 1: 병원을 전혀 찾지 못함
    if (availableHospitals.length === 0) {
      return {
        hospitals: allHospitals, // 운영중이 아닌 병원이라도 표시
        warning: {
          type: 'NO_HOSPITALS_FOUND',
          message: `운영중인 응급실이 없습니다. 아래 병원들은 현재 미운영 상태입니다.`,
          action: {
            type: 'CALL_119',
            label: '119 구급대 호출',
            onClick: () => {
              if (typeof window !== 'undefined') {
                window.location.href = 'tel:119';
              }
            },
          },
        },
      };
    }

    // Edge Case 2: 병원은 있지만 모두 만실
    const hasAvailableBeds = allHospitals.some((h) => h.availableBeds > 0);
    if (!hasAvailableBeds) {
      console.warn('⚠️ 반경 내 가용 병상이 있는 응급실이 없습니다.');
      return {
        hospitals: allHospitals, // 병원 리스트는 보여주되 경고 표시
        warning: {
          type: 'NO_BEDS_AVAILABLE',
          message: '주변의 모든 응급실이 만실 상태입니다. 위급 상황 시 119에 연락하세요.',
          action: {
            type: 'CALL_119',
            label: '119 전화하기',
            onClick: () => {
              if (typeof window !== 'undefined') {
                window.location.href = 'tel:119';
              }
            },
          },
        },
      };
    }

    // Edge Case 3: 데이터가 오래됨 (5분 이상)
    const hasStaleData = allHospitals.some((h) => h.isDataStale(5));
    const warning: HospitalSearchWarning | null = hasStaleData
      ? {
          type: 'DATA_STALE',
          message: '일부 병원 정보가 5분 이상 지난 데이터입니다. 실제 상황과 다를 수 있습니다.',
          action: {
            type: 'REFRESH_DATA',
            label: '새로고침',
          },
        }
      : null;

    // HospitalRankingService에서 이미 정렬 및 점수(Specialty 포함)가 계산되어 반환되었으므로,
    // 여기서 다시 정렬하지 않고 바로 반환합니다.
    const topHospitals = availableHospitals;

    console.log(`✅ Returning ${topHospitals.length} hospitals (already ranked by HospitalRankingService)`);

    return {
      hospitals: topHospitals,
      warning,
    };
  }
}
