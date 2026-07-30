import { Hospital } from '../entities/Hospital';
import { Coordinates } from '../valueObjects/Coordinates';
import { IHospitalRepository } from '../repositories/IHospitalRepository';
import { HospitalSpecialtyService } from '../services/HospitalSpecialtyService';
import { HospitalRankingService } from '../services/HospitalRankingService';

export interface HospitalSearchResult {
  hospitals: Hospital[];
  warning: HospitalSearchWarning | null;
  top3DiseaseRecommendedIds: string[];
}

export interface HospitalSearchWarning {
  type: 'NO_HOSPITALS_FOUND' | 'NO_BEDS_AVAILABLE' | 'DATA_STALE' | 'LOW_ACCURACY';
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
    targetDisease?: string
  ): Promise<HospitalSearchResult> {
    const allHospitals = await this.hospitalRepository.findNearby(userLocation);
    const availableHospitals = allHospitals.filter((h) => h.isOperating);

    if (availableHospitals.length === 0) {
      return {
        hospitals: allHospitals,
        top3DiseaseRecommendedIds: [],
        warning: {
          type: 'NO_HOSPITALS_FOUND',
          message: `운영중인 응급실이 없습니다. 아래 병원들은 현재 미운영 상태입니다.`,
          action: { type: 'CALL_119', label: '119 구급대 호출' }
        }
      };
    }

    const hasAvailableBeds = allHospitals.some((h) => h.availableBeds > 0);
    let warning: HospitalSearchWarning | null = null;
    if (!hasAvailableBeds) {
      warning = {
        type: 'NO_BEDS_AVAILABLE',
        message: '주변의 모든 응급실이 만실 상태입니다. 위급 상황 시 119에 연락하세요.',
        action: { type: 'CALL_119', label: '119 전화하기' }
      };
    }

    // 1. Load specialties for all hospitals (chunked inside HospitalSpecialtyService)
    const hpids = availableHospitals.map(h => h.id).filter(Boolean);
    await HospitalSpecialtyService.loadSpecialtiesForHospitals(hpids);

    // Candidates are those with diseaseSpecialtyScore > 0
    // And their possible max score (base + 40) is >= the 3rd place's current base score.
    // Actually, to guarantee no bias, we can just calculate routes for ALL disease candidates in Phase 1.
    // Since disease candidates are usually few, this is safe and strictly accurate.
    const diseaseCandidates = availableHospitals.filter(
      h => HospitalSpecialtyService.getDiseaseSpecialtyScore(h, targetDisease) > 0
    );

    const first15 = availableHospitals.slice(0, 15);
    const phase1Targets = new Set([...first15, ...diseaseCandidates]);

    // Compute route info for Phase 1 targets
    await this.hospitalRepository.enrichWithRouteInfo(userLocation, Array.from(phase1Targets));

    // 3. Re-rank with time scores to freeze TOP 3
    const finalRanking = HospitalRankingService.rankHospitals(availableHospitals, targetDisease);

    return {
      hospitals: finalRanking.hospitals,
      top3DiseaseRecommendedIds: finalRanking.top3DiseaseRecommendedIds,
      warning,
    };
  }
}
