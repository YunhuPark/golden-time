import { Hospital } from '../entities/Hospital';
import { AIAnalysisContext, AIContextMatchResult } from '../types/AIContext';

/**
 * AI 분석 요구사항과 실제 병원 데이터를 비교하여
 * 매칭 결과, 추천 근거, 점수를 산출하는 서비스.
 *
 * 중요:
 * - "특화 병원"을 추정하지 않는다.
 * - 현재 Hospital 엔티티에서 확인 가능한 운영/병상/진료과/장비/수술 가능 여부만 사용한다.
 * - RED에서는 secondaryConditions까지 함께 반영해 복합 요구역량을 더 엄격하게 본다.
 */
export class HospitalAICardService {
  private static scoreCondition(
    hospital: Hospital,
    condition: string,
    matchedReasons: string[],
    unconfirmedReasons: string[]
  ): { score: number; maxScore: number } {
    let score = 0;
    let maxScore = 0;

    if (condition === 'sepsis_demo') {
      maxScore += 5;
      if (hospital.isOperating) {
        matchedReasons.push('응급실 운영');
        score += 5;
      } else {
        unconfirmedReasons.push('응급실 운영 확인필요');
      }

      maxScore += 5;
      if (hospital.availableBeds > 0) {
        matchedReasons.push(`추정 가용 병상 ${hospital.availableBeds}개`);
        score += 5;
      } else {
        unconfirmedReasons.push('병상 가용성 확인필요');
      }

      maxScore += 10;
      if (hospital.hasSpecialization('내과')) {
        matchedReasons.push('내과 진료과');
        score += 10;
      } else {
        unconfirmedReasons.push('내과 진료과 확인필요');
      }

      return { score, maxScore };
    }

    if (condition === 'brain_lesion_demo') {
      maxScore += 10;
      if (hospital.hasSpecialization('신경외과') || hospital.hasSpecialization('신경과')) {
        matchedReasons.push('신경외과/신경과');
        score += 10;
      } else {
        unconfirmedReasons.push('신경외과/신경과 확인필요');
      }

      maxScore += 10;
      if (hospital.hasSurgery) {
        matchedReasons.push('응급수술 가능');
        score += 10;
      } else {
        unconfirmedReasons.push('응급수술 가능 여부 확인필요');
      }

      maxScore += 10;
      if (hospital.hasCT || hospital.hasMRI) {
        matchedReasons.push('영상 장비(CT/MRI)');
        score += 10;
      } else {
        unconfirmedReasons.push('CT/MRI 장비 확인필요');
      }

      return { score, maxScore };
    }

    maxScore += 5;
    if (hospital.isOperating) {
      matchedReasons.push('응급실 운영');
      score += 5;
    }

    maxScore += 5;
    if (hospital.availableBeds > 0) {
      matchedReasons.push(`추정 가용 병상 ${hospital.availableBeds}개`);
      score += 5;
    }

    return { score, maxScore };
  }

  static evaluateMatch(
    hospital: Hospital,
    aiContext: AIAnalysisContext | null
  ): AIContextMatchResult | null {
    if (!aiContext || (!aiContext.primaryCondition && !aiContext.analysisMode)) {
      return null;
    }

    const matchedReasons: string[] = [];
    const unconfirmedReasons: string[] = [];
    let score = 0;
    let maxScore = 0;

    const conditions: string[] = [];
    if (aiContext.primaryCondition) {
      conditions.push(aiContext.primaryCondition);
    }

    if (aiContext.triage === 'RED') {
      for (const condition of aiContext.secondaryConditions || []) {
        if (condition && !conditions.includes(condition)) {
          conditions.push(condition);
        }
      }
    }

    if (conditions.length === 0) {
      conditions.push('general_emergency');
    }

    for (const condition of conditions) {
      const result = this.scoreCondition(
        hospital,
        condition,
        matchedReasons,
        unconfirmedReasons
      );
      score += result.score;
      maxScore += result.maxScore;
    }

    return {
      score,
      maxScore,
      matchedReasons: Array.from(new Set(matchedReasons)),
      unconfirmedReasons: Array.from(new Set(unconfirmedReasons)),
    };
  }
}
