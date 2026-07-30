import { Hospital, AvailabilityStatus } from '../entities/Hospital';
import { HospitalSpecialtyService } from './HospitalSpecialtyService';
import { MediMatrixParams, MediMatrixCapability } from '../types/MediMatrixParams';

export interface HospitalScoreBreakdown {
  totalScore: number;
  timeScore: number;
  bedScore: number;
  traumaScore: number;
  operatingScore: number;
  specialtyScore: number;         // condition 기반 진료�??�합??(?�거??
  capabilityScore: number;        // capabilities 기반 치료 ??��
  icuProxyScore: number;          // ICU proxy (traumaLevel 기반)
  specialtyMatchDetails: string[]; // 매칭??진료�??�워??(?�거??
  capabilityDetails: {            // ??���??�인 결과
    emergency_surgery: 'confirmed' | 'not_confirmed';
    brain_imaging: 'confirmed' | 'not_confirmed';
    icu: 'proxy_confirmed' | 'not_confirmed';
  };
}

export interface RankingResult {
  hospitals: Hospital[];
  scoreMap: Map<string, HospitalScoreBreakdown>;
  top3DiseaseRecommendedIds: string[];
}

export class HospitalRankingService {
  /**
   * 병원 목록???�급 ?�황 최적 ?�으�??�렬
   */
  static rankHospitals(
    hospitals: Hospital[],
    targetDisease?: string | null,
    mediMatrixParams?: MediMatrixParams | null,
    freezeTop3Ids?: string[]
  ): RankingResult {
    if (hospitals.length === 0) {
      return { hospitals: [], scoreMap: new Map(), top3DiseaseRecommendedIds: [] };
    }

    const scoreMap = new Map<string, HospitalScoreBreakdown>();

    // �?병원???�수 부??
    const hospitalsWithScore = hospitals.map((hospital) => {
      const breakdown = this.calculateBreakdown(hospital, hospitals, targetDisease, mediMatrixParams);
      scoreMap.set(hospital.id, breakdown);

      return {
        hospital,
        score: breakdown.totalScore,
        breakdown,
        diseaseSpecialtyScore: breakdown.specialtyScore
      };
    });

    // ?�체 목록?� 추천??overallScore ?�림차순, ?�동?�간 ?�름차순) ?�렬
    hospitalsWithScore.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      const timeA = a.hospital.routeDuration && a.hospital.routeDuration > 0 ? a.hospital.routeDuration : Infinity;
      const timeB = b.hospital.routeDuration && b.hospital.routeDuration > 0 ? b.hospital.routeDuration : Infinity;
      if (timeA !== timeB) {
        return timeA - timeB;
      }
      return a.hospital.id.localeCompare(b.hospital.id);
    });

    // TOP 3 AI ?�화 추천 계산
    let top3DiseaseRecommendedIds = freezeTop3Ids;

    if (!top3DiseaseRecommendedIds) {
      const diseaseCandidates = hospitalsWithScore.filter(h => h.diseaseSpecialtyScore > 0);

      diseaseCandidates.sort((a, b) => {
        // 1. diseaseSpecialtyScore ?�림차순
        if (b.diseaseSpecialtyScore !== a.diseaseSpecialtyScore) {
          return b.diseaseSpecialtyScore - a.diseaseSpecialtyScore;
        }
        // 2. ?�체 추천 ?�수 ?�림차순
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        // 3. ?�동?�간 ?�름차순 (Infinity 처리)
        const timeA = a.hospital.routeDuration && a.hospital.routeDuration > 0 ? a.hospital.routeDuration : Infinity;
        const timeB = b.hospital.routeDuration && b.hospital.routeDuration > 0 ? b.hospital.routeDuration : Infinity;
        if (timeA !== timeB) {
          return timeA - timeB;
        }
        // 4. id ?�름차순
        const idA = a.hospital.id;
        const idB = b.hospital.id;
        return idA.localeCompare(idB);
      });

      top3DiseaseRecommendedIds = diseaseCandidates.slice(0, 3).map(c => c.hospital.id);
    }

    const sortedHospitals = hospitalsWithScore.map(({ hospital }) => hospital);

    return { hospitals: sortedHospitals, scoreMap, top3DiseaseRecommendedIds };
  }

  private static calculateBreakdown(
    hospital: Hospital,
    allHospitals: Hospital[],
    targetDisease?: string | null,
    mediMatrixParams?: MediMatrixParams | null
  ): HospitalScoreBreakdown {
    const timeScore = this.calculateTimeScore(hospital, allHospitals);
    const bedScore = this.calculateBedAvailabilityScore(hospital);
    const traumaScore = this.calculateTraumaLevelScore(hospital);
    const operatingScore = this.calculateOperatingScore(hospital);

    const diseaseSpecialtyScore = HospitalSpecialtyService.getDiseaseSpecialtyScore(
      hospital,
      mediMatrixParams?.condition || targetDisease
    );

    let capabilityScore = 0;
    let icuProxyScore = 0;
    const capabilityDetails: HospitalScoreBreakdown['capabilityDetails'] = {
      emergency_surgery: 'not_confirmed',
      brain_imaging: 'not_confirmed',
      icu: 'not_confirmed',
    };

    if (mediMatrixParams && mediMatrixParams.condition !== 'unsupported_modality') {
      const capabilityScorePerItem = mediMatrixParams.capabilities.length > 0
        ? 20 / mediMatrixParams.capabilities.length
        : 0;

      mediMatrixParams.capabilities.forEach((cap: MediMatrixCapability) => {
        if (cap === 'emergency_surgery' && hospital.hasSurgery) {
          capabilityScore += capabilityScorePerItem;
          capabilityDetails.emergency_surgery = 'confirmed';
        }
        if (cap === 'brain_imaging' && (hospital.hasMRI || hospital.hasCT)) {
          capabilityScore += capabilityScorePerItem;
          capabilityDetails.brain_imaging = 'confirmed';
        }
        if (cap === 'icu' && (hospital.traumaLevel === 1 || hospital.traumaLevel === 2)) {
          icuProxyScore = 15;
          capabilityDetails.icu = 'proxy_confirmed';
        }
      });
    }

    const rawAmbulanceScore = capabilityScore + icuProxyScore;
    let ambulanceScore = (rawAmbulanceScore / 35) * 10;
    if (isNaN(ambulanceScore) || !isFinite(ambulanceScore)) {
      ambulanceScore = 0;
    }
    ambulanceScore = Math.max(0, Math.min(10, ambulanceScore));

    const totalScore =
      timeScore +
      bedScore +
      traumaScore +
      operatingScore +
      diseaseSpecialtyScore +
      ambulanceScore;

    return {
      totalScore,
      timeScore,
      bedScore,
      traumaScore,
      operatingScore,
      specialtyScore: diseaseSpecialtyScore,
      capabilityScore,
      icuProxyScore,
      specialtyMatchDetails: [],
      capabilityDetails,
    };
  }

  private static calculateTimeScore(
    hospital: Hospital,
    allHospitals: Hospital[]
  ): number {
    const MAX_SCORE = 40;

    if (!hospital.routeDuration || hospital.routeDuration === -1) {
      return 0; // 경로 계산 ?�패 ??0�?최고?????�닌 0??부??
    }

    const hospitalsWithRoute = allHospitals.filter(
      (h) => h.routeDuration && h.routeDuration !== -1
    );
    if (hospitalsWithRoute.length <= 1) return MAX_SCORE;

    const minDuration = Math.min(...hospitalsWithRoute.map((h) => h.routeDuration!));
    const maxDuration = Math.max(...hospitalsWithRoute.map((h) => h.routeDuration!));
    if (minDuration === maxDuration) return MAX_SCORE;

    const normalizedScore =
      1 - (hospital.routeDuration - minDuration) / (maxDuration - minDuration);
    return normalizedScore * MAX_SCORE;
  }

  private static calculateBedAvailabilityScore(hospital: Hospital): number {
    const MAX_SCORE = 30;
    const status = hospital.getAvailabilityStatus();

    switch (status) {
      case AvailabilityStatus.AVAILABLE:
        return 20 + hospital.getAvailabilityRate() * 10;
      case AvailabilityStatus.LIMITED:
        return MAX_SCORE * 0.5;
      case AvailabilityStatus.FULL:
        return 0;
      case AvailabilityStatus.UNKNOWN:
      default:
        return MAX_SCORE * 0.33;
    }
  }

  private static calculateTraumaLevelScore(hospital: Hospital): number {
    const MAX_SCORE = 20;
    if (hospital.traumaLevel === 1) return MAX_SCORE;
    if (hospital.traumaLevel === 2) return MAX_SCORE * 0.75;
    if (hospital.traumaLevel === 3) return MAX_SCORE * 0.5;
    return MAX_SCORE * 0.25;
  }

  private static calculateOperatingScore(hospital: Hospital): number {
    return hospital.isOperating ? 10 : 0;
  }
}
