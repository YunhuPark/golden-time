import { Hospital } from '../entities/Hospital';
import { AIAnalysisContext, AIContextMatchResult } from '../types/AIContext';

/**
 * AI 분석 요구사항과 E-Gen에서 확인 가능한 실제 자원을 비교합니다.
 * '특화병원'을 추정하지 않고 응급실/중환자실/영상/수술 자원만 근거로 사용합니다.
 */
export class HospitalAICardService {
  private static scoreSystemicEmergency(
    hospital: Hospital,
    matchedReasons: string[],
    unconfirmedReasons: string[]
  ): { score: number; maxScore: number } {
    let score = 0;
    let maxScore = 0;

    maxScore += 8;
    if (hospital.availableBeds > 0) {
      matchedReasons.push(`응급실 가용 ${hospital.availableBeds}병상`);
      score += 8;
    } else {
      unconfirmedReasons.push('응급실 가용병상 없음');
    }

    maxScore += 8;
    if (hospital.icuAvailableBeds > 0) {
      matchedReasons.push(`일반 ICU 가용 ${hospital.icuAvailableBeds}병상`);
      score += 8;
    } else {
      unconfirmedReasons.push('일반 ICU 가용 확인필요');
    }

    maxScore += 4;
    if (hospital.isOperating) {
      matchedReasons.push('응급실 운영');
      score += 4;
    }

    return { score, maxScore };
  }

  private static scoreCondition(
    hospital: Hospital,
    condition: string,
    matchedReasons: string[],
    unconfirmedReasons: string[]
  ): { score: number; maxScore: number } {
    let score = 0;
    let maxScore = 0;

    // sepsis_demo는 기존 링크와의 하위 호환성용이고,
    // systemic_deterioration_demo는 특정 질환을 확정하지 않는 RED 전신악화 컨텍스트입니다.
    if (condition === 'sepsis_demo' || condition === 'systemic_deterioration_demo') {
      return this.scoreSystemicEmergency(hospital, matchedReasons, unconfirmedReasons);
    }

    if (condition === 'brain_lesion_demo') {
      maxScore += 10;
      if (hospital.hasCT || hospital.hasMRI) {
        matchedReasons.push('영상 장비(CT/MRI) 가용');
        score += 10;
      } else {
        unconfirmedReasons.push('CT/MRI 가용 확인필요');
      }

      maxScore += 8;
      if (hospital.hasSurgery) {
        matchedReasons.push('수술실 가용');
        score += 8;
      } else {
        unconfirmedReasons.push('수술실 가용 확인필요');
      }

      maxScore += 7;
      if (hospital.neuroIcuAvailableBeds > 0) {
        matchedReasons.push(`신경 ICU 가용 ${hospital.neuroIcuAvailableBeds}병상`);
        score += 7;
      } else {
        unconfirmedReasons.push('신경 ICU 가용 확인필요');
      }

      return { score, maxScore };
    }

    maxScore += 10;
    if (hospital.availableBeds > 0) {
      matchedReasons.push(`응급실 가용 ${hospital.availableBeds}병상`);
      score += 10;
    }
    return { score, maxScore };
  }

  static evaluateMatch(
    hospital: Hospital,
    aiContext: AIAnalysisContext | null
  ): AIContextMatchResult | null {
    if (!aiContext || (!aiContext.primaryCondition && !aiContext.analysisMode)) return null;

    const matchedReasons: string[] = [];
    const unconfirmedReasons: string[] = [];
    let score = 0;
    let maxScore = 0;

    const conditions: string[] = [];
    if (aiContext.primaryCondition) conditions.push(aiContext.primaryCondition);

    // RED에서만 secondary condition까지 동시에 반영해 복합 대응 역량을 요구합니다.
    if (aiContext.triage === 'RED') {
      for (const condition of aiContext.secondaryConditions || []) {
        if (condition && !conditions.includes(condition)) conditions.push(condition);
      }
    }

    if (conditions.length === 0) conditions.push('general_emergency');

    for (const condition of conditions) {
      const result = this.scoreCondition(hospital, condition, matchedReasons, unconfirmedReasons);
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
