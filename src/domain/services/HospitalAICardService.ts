import { Hospital } from '../entities/Hospital';
import { AIAnalysisContext, AIContextMatchResult } from '../types/AIContext';

/**
 * AI 분석 요구사항과 실제 병원 데이터를 비교하여
 * 매칭 결과, 추천 근거, 점수를 산출하는 서비스
 */
export class HospitalAICardService {
  /**
   * 병원의 실제 역량과 AI 요구 컨텍스트를 비교하여 매칭 결과를 반환
   */
  static evaluateMatch(hospital: Hospital, aiContext: AIAnalysisContext | null): AIContextMatchResult | null {
    if (!aiContext || (!aiContext.primaryCondition && !aiContext.analysisMode)) {
      return null;
    }

    const matchedReasons: string[] = [];
    const unconfirmedReasons: string[] = [];
    let score = 0;
    let maxScore = 0;

    const condition = aiContext.primaryCondition;

    // sepsis_demo (패혈증)
    if (condition === 'sepsis_demo') {
      // 1. 응급실 운영
      maxScore += 10;
      if (hospital.isOperating) {
        matchedReasons.push('응급실 운영');
        score += 10;
      } else {
        unconfirmedReasons.push('응급실 미운영/확인필요');
      }

      // 2. 가용 병상
      maxScore += 10;
      if (hospital.availableBeds > 0) {
        matchedReasons.push(`가용 병상 ${hospital.availableBeds}개`);
        score += 10;
      } else {
        unconfirmedReasons.push('병상 가용성 확인필요');
      }

      // 3. 내과 전문의 / 중환자실 (현재 데이터에 중환자실 여부가 없으면 병상으로 대체하거나 specializations 확인)
      if (aiContext.specialties.includes('internal_medicine') || aiContext.capabilities.includes('icu')) {
        maxScore += 10;
        if (hospital.hasSpecialization('내과') || hospital.hasSpecialization('응급의학과')) {
          matchedReasons.push('관련 전문의');
          score += 10;
        } else {
          unconfirmedReasons.push('관련 전문의 확인필요');
        }
      }
    } 
    // brain_lesion_demo (뇌 병변)
    else if (condition === 'brain_lesion_demo') {
      // 1. 신경외과/신경과
      maxScore += 10;
      if (hospital.hasSpecialization('신경외과') || hospital.hasSpecialization('신경과')) {
        matchedReasons.push('신경외과/신경과');
        score += 10;
      } else {
        unconfirmedReasons.push('신경외과 확인필요');
      }

      // 2. 응급수술 가능 여부
      if (aiContext.capabilities.includes('emergency_surgery')) {
        maxScore += 10;
        if (hospital.hasSurgery) {
          matchedReasons.push('응급수술 가능');
          score += 10;
        } else {
          unconfirmedReasons.push('응급수술 확인필요');
        }
      }

      // 3. 뇌 영상 (CT/MRI)
      if (aiContext.capabilities.includes('brain_imaging')) {
        maxScore += 10;
        if (hospital.hasCT || hospital.hasMRI) {
          matchedReasons.push('영상 장비(CT/MRI)');
          score += 10;
        } else {
          unconfirmedReasons.push('영상 장비 확인필요');
        }
      }
    }
    // 기타 / 알 수 없는 질환
    else {
      maxScore += 10;
      if (hospital.isOperating) {
        matchedReasons.push('응급실 운영');
        score += 10;
      }
      maxScore += 10;
      if (hospital.availableBeds > 0) {
        matchedReasons.push(`가용 병상 ${hospital.availableBeds}개`);
        score += 10;
      }
    }

    return {
      score,
      maxScore,
      matchedReasons,
      unconfirmedReasons
    };
  }
}
