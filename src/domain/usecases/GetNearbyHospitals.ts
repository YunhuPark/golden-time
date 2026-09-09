import { Hospital } from '../entities/Hospital';
import { Coordinates } from '../valueObjects/Coordinates';
import { IHospitalRepository } from '../repositories/IHospitalRepository';
import { AIAnalysisContext } from '../types/AIContext';
import {
  recordFirstHospitalResults,
  recordHospitalSearchFailure,
  startHospitalSearchPerformance,
} from '../../infrastructure/monitoring/searchPerformance';

export interface HospitalSearchResult {
  hospitals: Hospital[];
  warning: HospitalSearchWarning | null;
}

export interface HospitalSearchWarning {
  type: 'NO_HOSPITALS_FOUND' | 'NO_BEDS_AVAILABLE' | 'DATA_STALE' | 'LOW_ACCURACY' | 'NETWORK_ERROR';
  message: string;
  action?: {
    type: 'CALL_119' | 'EXPAND_SEARCH' | 'REFRESH_DATA';
    label: string;
    onClick?: () => void;
  };
}

export class GetNearbyHospitals {
  constructor(
    private readonly hospitalRepository: IHospitalRepository
  ) {}

  async execute(
    userLocation: Coordinates,
    aiContext?: AIAnalysisContext | null
  ): Promise<HospitalSearchResult> {
    const performanceSearchId = startHospitalSearchPerformance();

    try {
      const allHospitals = await this.hospitalRepository.findNearby(userLocation, aiContext);

      const availableHospitals = allHospitals.filter(
        (h) => h.isOperating
      );

      if (availableHospitals.length === 0) {
        recordFirstHospitalResults(performanceSearchId, allHospitals.length);
        return {
          hospitals: allHospitals,
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

      const hasAvailableBeds = allHospitals.some((h) => h.availableBeds > 0);
      if (!hasAvailableBeds) {
        console.warn('⚠️ 반경 내 가용 병상이 있는 응급실이 없습니다.');
        recordFirstHospitalResults(performanceSearchId, allHospitals.length);
        return {
          hospitals: allHospitals,
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

      const topHospitals = availableHospitals;
      console.log(`✅ Returning ${topHospitals.length} hospitals (already ranked by HospitalRankingService)`);
      recordFirstHospitalResults(performanceSearchId, topHospitals.length);

      return {
        hospitals: topHospitals,
        warning,
      };
    } catch (error) {
      recordHospitalSearchFailure(performanceSearchId, 'initial-search');
      throw error;
    }
  }
}
