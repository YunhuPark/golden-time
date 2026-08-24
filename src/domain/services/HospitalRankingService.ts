import { Hospital } from '../entities/Hospital';
import { AIAnalysisContext } from '../types/AIContext';
import { HospitalAICardService } from './HospitalAICardService';

/**
 * 응급 상황에서 최적의 병원을 선택하기 위한 점수 기반 랭킹 알고리즘.
 *
 * RED: 복합 대응 자원 적합도를 가장 강하게 반영합니다.
 * YELLOW/기타: 이동시간과 응급실 가용병상을 상대적으로 크게 반영합니다.
 * 병상 점수는 E-Gen이 제공하는 실시간 응급실 가용 수(hvec)를 그대로 사용합니다.
 */
export class HospitalRankingService {
  static rankHospitals(hospitals: Hospital[], aiContext?: AIAnalysisContext | null): Hospital[] {
    if (hospitals.length <= 1) return hospitals;

    const hospitalsWithScore = hospitals.map((hospital) => ({
      hospital,
      score: this.calculateScore(hospital, hospitals, aiContext),
    }));

    hospitalsWithScore.sort((a, b) => {
      if (Math.abs(a.score - b.score) > 0.001) return b.score - a.score;

      const hasRouteA = a.hospital.routeDuration != null;
      const hasRouteB = b.hospital.routeDuration != null;
      if (hasRouteA && !hasRouteB) return -1;
      if (!hasRouteA && hasRouteB) return 1;
      if (hasRouteA && hasRouteB) return a.hospital.routeDuration! - b.hospital.routeDuration!;
      return b.hospital.availableBeds - a.hospital.availableBeds;
    });

    console.log(`🏆 Hospital Ranking Results (Target: ${aiContext?.primaryCondition || 'None'}):`);
    hospitalsWithScore.slice(0, 5).forEach((item, index) => {
      const aiMatch = HospitalAICardService.evaluateMatch(item.hospital, aiContext || null);
      const isMatch = aiMatch && aiMatch.maxScore > 0 && aiMatch.score / aiMatch.maxScore >= 0.5;
      console.log(
        `${index + 1}. ${item.hospital.name}: ${item.score.toFixed(1)}점 ` +
          `(소요: ${item.hospital.getRouteDurationMinutes() || '?'}분, ` +
          `응급실 가용: ${item.hospital.availableBeds}, ICU: ${item.hospital.icuAvailableBeds})` +
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
    const timeWeight = isRed ? 0.75 : 1.0;
    const bedWeight = isRed ? 0.67 : 1.0;
    const traumaWeight = 0.5;
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

  private static calculateTimeScore(hospital: Hospital, allHospitals: Hospital[]): number {
    const MAX_SCORE = 40;
    if (!hospital.routeDuration) return 0;

    const hospitalsWithRoute = allHospitals.filter((h) => h.routeDuration);
    if (hospitalsWithRoute.length <= 1) return MAX_SCORE;

    const minDuration = Math.min(...hospitalsWithRoute.map((h) => h.routeDuration!));
    const maxDuration = Math.max(...hospitalsWithRoute.map((h) => h.routeDuration!));
    if (minDuration === maxDuration) return MAX_SCORE;

    const normalizedScore = 1 - (hospital.routeDuration - minDuration) / (maxDuration - minDuration);
    return normalizedScore * MAX_SCORE;
  }

  /**
   * 실시간 응급실 가용병상 수를 직접 점수화합니다.
   * 0=만실, 1~4=제한, 5~9=양호, 10+=충분으로 단순화해
   * 잘못된 '총병상 대비 비율' 추정을 사용하지 않습니다.
   */
  private static calculateBedAvailabilityScore(hospital: Hospital): number {
    const beds = hospital.availableBeds;
    if (beds <= 0) return 0;
    if (beds <= 4) return 15;
    if (beds <= 9) return 24 + (beds - 5) * 1.25;
    return 30;
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

  static analyzeHospitalScore(hospital: Hospital, allHospitals: Hospital[]): {
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
