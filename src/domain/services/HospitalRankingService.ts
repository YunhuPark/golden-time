import { Hospital, AvailabilityStatus } from '../entities/Hospital';
import { HospitalSpecialtyService } from './HospitalSpecialtyService';
import { MediMatrixParams, MediMatrixCapability } from '../types/MediMatrixParams';

/**
 * Hospital Ranking Service
 * 응급 상황에서 최적의 병원을 선택하기 위한 점수 기반 랭킹 알고리즘
 *
 * 점수 계산 기준:
 * 1. 경로 소요시간 (40점) - 가장 중요
 * 2. 병상 가용률 (30점)
 * 3. 질환 적합도 (30점) - 기존 disease 문자열 기반 (하위 호환)
 * 4. 외상센터 등급 (20점)
 * 5. 응급실 운영 여부 (10점)
 *
 * MediMatrix 파라미터가 있는 경우 추가 점수:
 * 6. 신경외과/신경과 적합도 (25점) - condition 기반
 * 7. 치료 역량 점수 (20점) - capabilities 기반 (emergency_surgery, brain_imaging)
 * 8. ICU proxy 점수 (15점) - traumaLevel 1~2 기반 (E-Gen ICU 필드 없음)
 */

/** 병원 점수 근거 (카드 배지 표시용) */
export interface HospitalScoreBreakdown {
  totalScore: number;
  timeScore: number;
  bedScore: number;
  traumaScore: number;
  operatingScore: number;
  specialtyScore: number;         // condition 기반 진료과 적합도
  capabilityScore: number;        // capabilities 기반 치료 역량
  icuProxyScore: number;          // ICU proxy (traumaLevel 기반)
  specialtyMatchDetails: string[]; // 매칭된 진료과 키워드
  capabilityDetails: {            // 역량별 확인 결과
    emergency_surgery: 'confirmed' | 'not_confirmed';
    brain_imaging: 'confirmed' | 'not_confirmed';
    icu: 'proxy_confirmed' | 'not_confirmed';
  };
}

/** 랭킹 결과 */
export interface RankingResult {
  hospitals: Hospital[];
  hasSpecializedMatch: boolean;    // 특화 조건을 충족하는 병원이 1개 이상 있는지
  noMatchWarning?: string;         // 조건 불일치 시 표시할 안내 문구
  scoreMap: Map<string, HospitalScoreBreakdown>; // hospital.id → 점수 근거
}

export class HospitalRankingService {
  /**
   * 병원 목록을 응급 상황 최적 순으로 정렬
   *
   * @param hospitals 병원 목록
   * @param targetDisease (선택) 기존 disease 문자열 (하위 호환)
   * @param mediMatrixParams (선택) Medi-Matrix 구조화 파라미터
   * @returns 점수 기반으로 정렬된 랭킹 결과
   */
  static rankHospitals(
    hospitals: Hospital[],
    targetDisease?: string | null,
    mediMatrixParams?: MediMatrixParams | null
  ): RankingResult {
    if (hospitals.length === 0) {
      return { hospitals: [], hasSpecializedMatch: false, scoreMap: new Map() };
    }
    if (hospitals.length === 1) {
      const scoreMap = new Map<string, HospitalScoreBreakdown>();
      const hospital = hospitals[0]!;
      const bd = this.calculateBreakdown(hospital, hospitals, targetDisease, mediMatrixParams);
      scoreMap.set(hospital.id, bd);
      return {
        hospitals,
        hasSpecializedMatch: bd.specialtyScore > 0 || bd.capabilityScore > 0,
        scoreMap,
      };
    }

    const scoreMap = new Map<string, HospitalScoreBreakdown>();

    // 각 병원에 점수 부여
    const hospitalsWithScore = hospitals.map((hospital) => {
      const breakdown = this.calculateBreakdown(hospital, hospitals, targetDisease, mediMatrixParams);
      scoreMap.set(hospital.id, breakdown);
      return { hospital, score: breakdown.totalScore, breakdown };
    });

    // 점수 내림차순 정렬
    hospitalsWithScore.sort((a, b) => b.score - a.score);

    const hasSpecializedMatch = hospitalsWithScore.some(
      ({ breakdown }) => breakdown.specialtyScore > 0 || breakdown.capabilityScore > 0
    );

    // 디버그 로그
    console.log(
      `🏆 Hospital Ranking Results (Condition: ${mediMatrixParams?.condition ?? targetDisease ?? 'None'}):`
    );
    hospitalsWithScore.slice(0, 5).forEach(({ hospital, score, breakdown }, index) => {
      console.log(
        `${index + 1}. ${hospital.name}: ${score.toFixed(1)}점 ` +
          `(이송: ${hospital.getRouteDurationMinutes() ?? '?'}분, ` +
          `병상: ${hospital.availableBeds}/${hospital.totalBeds}, ` +
          `진료과: +${breakdown.specialtyScore}, 역량: +${breakdown.capabilityScore}, ICU: +${breakdown.icuProxyScore})`
      );
    });

    const sortedHospitals = hospitalsWithScore.map(({ hospital }) => hospital);

    let noMatchWarning: string | undefined;
    if (mediMatrixParams && !hasSpecializedMatch) {
      noMatchWarning =
        '요청한 전문 대응 역량을 모두 확인할 수 있는 병원이 없습니다. 확인 가능한 조건을 기준으로 표시합니다.';
    }

    return { hospitals: sortedHospitals, hasSpecializedMatch, noMatchWarning, scoreMap };
  }

  /**
   * 개별 병원의 종합 점수 및 근거 계산
   */
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

    // 기존 disease 문자열 기반 점수 (하위 호환)
    let legacyDiseaseScore = 0;
    if (targetDisease && HospitalSpecialtyService.hasSpecialtyMatch(hospital, targetDisease)) {
      legacyDiseaseScore = 30;
    }

    // MediMatrix 구조화 파라미터 기반 점수
    let specialtyScore = 0;
    let specialtyMatchDetails: string[] = [];
    let capabilityScore = 0;
    let icuProxyScore = 0;
    const capabilityDetails: HospitalScoreBreakdown['capabilityDetails'] = {
      emergency_surgery: 'not_confirmed',
      brain_imaging: 'not_confirmed',
      icu: 'not_confirmed',
    };

    if (mediMatrixParams && mediMatrixParams.condition !== 'unsupported_modality') {
      // 6. 진료과 적합도 점수 (25점)
      const conditionMatch = HospitalSpecialtyService.hasConditionMatch(
        hospital,
        mediMatrixParams.condition
      );
      if (conditionMatch.matched) {
        specialtyScore = 25;
        specialtyMatchDetails = conditionMatch.matchedKeywords;
      }

      // 7. 치료 역량 점수 (20점 max - 역량별 분배)
      //    E-Gen 데이터 기반 실제 필드 사용 (없으면 "정보 없음"으로 처리, 적합으로 오판 금지)
      const capabilityScorePerItem = mediMatrixParams.capabilities.length > 0
        ? 20 / mediMatrixParams.capabilities.length
        : 0;

      mediMatrixParams.capabilities.forEach((cap: MediMatrixCapability) => {
        if (cap === 'emergency_surgery') {
          if (hospital.hasSurgery) {
            capabilityScore += capabilityScorePerItem;
            capabilityDetails.emergency_surgery = 'confirmed';
          }
          // hasSurgery=false: 점수 미부여, 정보 없음 표기
        }
        if (cap === 'brain_imaging') {
          if (hospital.hasMRI || hospital.hasCT) {
            capabilityScore += capabilityScorePerItem;
            capabilityDetails.brain_imaging = 'confirmed';
          }
        }
        if (cap === 'icu') {
          // E-Gen에 ICU 직접 필드 없음 → traumaLevel 1~2를 proxy로 사용
          if (hospital.traumaLevel === 1 || hospital.traumaLevel === 2) {
            icuProxyScore = 15;
            capabilityDetails.icu = 'proxy_confirmed';
          }
          // traumaLevel 없거나 3: 점수 미부여, "정보 미확인"으로 표기
        }
      });
    }

    // 최종 점수 (MediMatrix 파라미터 있으면 구조화 점수 우선, 없으면 레거시 사용)
    const effectiveDiseaseScore = mediMatrixParams ? 0 : legacyDiseaseScore;

    const totalScore =
      timeScore +
      bedScore +
      traumaScore +
      operatingScore +
      effectiveDiseaseScore +
      specialtyScore +
      capabilityScore +
      icuProxyScore;

    return {
      totalScore,
      timeScore,
      bedScore,
      traumaScore,
      operatingScore,
      specialtyScore,
      capabilityScore,
      icuProxyScore,
      specialtyMatchDetails,
      capabilityDetails,
    };
  }

  /**
   * 경로 소요시간 점수 계산 (0~40점)
   * - 가장 빠른 병원: 40점
   * - 가장 느린 병원: 0점
   * - 선형 보간
   * - 경로 정보 없으면 중간값 (20점)
   */
  private static calculateTimeScore(
    hospital: Hospital,
    allHospitals: Hospital[]
  ): number {
    const MAX_SCORE = 40;

    if (!hospital.routeDuration) {
      return MAX_SCORE * 0.5;
    }

    const hospitalsWithRoute = allHospitals.filter((h) => h.routeDuration);
    if (hospitalsWithRoute.length === 1) return MAX_SCORE;

    const minDuration = Math.min(...hospitalsWithRoute.map((h) => h.routeDuration!));
    const maxDuration = Math.max(...hospitalsWithRoute.map((h) => h.routeDuration!));
    if (minDuration === maxDuration) return MAX_SCORE;

    const normalizedScore =
      1 - (hospital.routeDuration - minDuration) / (maxDuration - minDuration);
    return normalizedScore * MAX_SCORE;
  }

  /**
   * 병상 가용률 점수 계산 (0~30점)
   */
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

  /**
   * 외상센터 등급 점수 계산 (0~20점)
   */
  private static calculateTraumaLevelScore(hospital: Hospital): number {
    const MAX_SCORE = 20;
    if (hospital.traumaLevel === 1) return MAX_SCORE;
    if (hospital.traumaLevel === 2) return MAX_SCORE * 0.75;
    if (hospital.traumaLevel === 3) return MAX_SCORE * 0.5;
    return MAX_SCORE * 0.25;
  }

  /**
   * 응급실 운영 여부 점수 계산 (0~10점)
   */
  private static calculateOperatingScore(hospital: Hospital): number {
    return hospital.isOperating ? 10 : 0;
  }

  /**
   * 특정 병원의 점수 상세 분석 (디버깅용)
   */
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
    const bd = this.calculateBreakdown(hospital, allHospitals);
    return {
      totalScore: bd.totalScore,
      timeScore: bd.timeScore,
      bedScore: bd.bedScore,
      traumaScore: bd.traumaScore,
      operatingScore: bd.operatingScore,
    };
  }
}
