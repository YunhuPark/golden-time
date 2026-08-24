import { Hospital, AvailabilityStatus } from '../entities/Hospital';
import { AIAnalysisContext } from '../types/AIContext';
import { HospitalAICardService } from './HospitalAICardService';

/**
 * 응급 상황에서 최적의 병원을 선택하기 위한 점수 기반 랭킹 알고리즘.
 *
 * RED: 질환/역량 적합도를 가장 강하게 반영하고, 이동시간과 병상은 그 다음으로 본다.
 * YELLOW/기타: 이동시간과 병상 가용성을 더 크게 반영한다.
 */
export class HospitalRankingService {
  static rankHospitals(hospitals: Hospital[], aiContext?: AIAnalysisContext | null): Hospital[] {
    if (hospitals.length <= 1) {
      return hospitals;
    }

    const hospitalsWithScore = hospitals.map((hospital) => ({
      hospital,
      score: this.calculateScore(hospital, hospitals, aiContext),
    }));

    hospitalsWithScore.sort((a, b) => {
      if (Math.abs(a.score - b.score) > 0.001) {
        return b.score - a.score;
      }

      const hasRouteA = a.hospital.routeDuration != null;
      const hasRouteB = b.hospital.routeDuration != null;
      if (hasRouteA && !hasRouteB) return -1;
      if (!hasRouteA && hasRouteB) return 1;

      if (hasRouteA && hasRouteB) {
        return a.hospital.routeDuration! - b.hospital.routeDuration!;
      }

      return 0;
    });

    console.log(`🏆 Hospital Ranking Results (Target Disease: ${aiContext?.primaryCondition || 'None'}):`);
    hospitalsWithScore.slice(0, 5).forEach((item, index) => {
      const aiMatch = HospitalAICardService.evaluateMatch(item.hospital, aiContext || null);
      const isMatch = aiMatch && aiMatch.maxScore > 0 && aiMatch.score / aiMatch.maxScore >= 0.5;
      console.log(
        `${index + 1}. ${item.hospital.name}: ${item.score.toFixed(1)}점 ` +
          `(소요: ${item.hospital.getRouteDurationMinutes() || '?'}분, ` +
          `병상: ${item.hospital.availableBeds}/${item.hospital.totalBeds})` +
          (isMatch ? ` ✨ [Capability Match: ${aiMatch.score}/${aiMatch.maxScore}]` : '')
      );
    });

    return hospitalsWithScore.map((item) => item.hospital);
  }

  private static calculateScore(
    hospital: Hospital,
    allHospitals: Hospital[],
    aiContext?: AIAnalysisContext | null
  ): number {
    const isRed = aiContext?.triage === 'RED';

    // RED는 역량 적합도 중심, YELLOW/기타는 이동시간·병상 중심.
    const timeWeight = isRed ? 0.75 : 1.0;   // 최대 30 / 40
    const bedWeight = isRed ? 0.67 : 1.0;    // 최대 약 20 / 30
    const traumaWeight = 0.5;                 // 최대 10
    const conditionMax = isRed ? 50 : 25;

    let score = 0;
    score += this.calculateTimeScore(hospital, allHospitals) * timeWeight;
    score += this.calculateBedAvailabilityScore(hospital) * bedWeight;
    score += this.calculateTraumaLevelScore(hospital) * traumaWeight;
    score += this.calculateOperatingScore(hospital);

    if (aiContext) {
      const matchResult = HospitalAICardService.evaluateMatch(hospital, aiContext);
      if (matchResult && matchResult.maxScore > 0) {
        score += (matchResult.score / matchResult.maxScore) * conditionMax;
      }
    }

    return score;
  }

  private static calculateTimeScore(
    hospital: Hospital,
    allHospitals: Hospital[]
  ): number {
    const MAX_SCORE = 40;

    if (!hospital.routeDuration) {
      return 0;
    }

    const hospitalsWithRoute = allHospitals.filter((h) => h.routeDuration);
    if (hospitalsWithRoute.length <= 1) {
      return MAX_SCORE;
    }

    const minDuration = Math.min(...hospitalsWithRoute.map((h) => h.routeDuration!));
    const maxDuration = Math.max(...hospitalsWithRoute.map((h) => h.routeDuration!));

    if (minDuration === maxDuration) {
      return MAX_SCORE;
    }

    const normalizedScore =
      1 - (hospital.routeDuration - minDuration) / (maxDuration - minDuration);
    return normalizedScore * MAX_SCORE;
  }

  private static calculateBedAvailabilityScore(hospital: Hospital): number {
    const MAX_SCORE = 30;
    const status = hospital.getAvailabilityStatus();

    switch (status) {
      case AvailabilityStatus.AVAILABLE: {
        const availabilityRate = hospital.getAvailabilityRate();
        return 20 + availabilityRate * 10;
      }
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

  static analyzeHospitalScore(
    hospital: Hospital,
    allHospitals: Hospital[]
  ): {
    totalScore: number;
    timeScore: number;
    bedScore: number;
    traumaScore: number;
    operatingScore: number;
  } {
    return {
      totalScore: this.calculateScore(hospital, allHospitals, null),
      timeScore: this.calculateTimeScore(hospital, allHospitals),
      bedScore: this.calculateBedAvailabilityScore(hospital),
      traumaScore: this.calculateTraumaLevelScore(hospital),
      operatingScore: this.calculateOperatingScore(hospital),
    };
  }
}
