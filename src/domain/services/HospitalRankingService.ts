import { Hospital, AvailabilityStatus } from '../entities/Hospital';

/**
 * Hospital Ranking Service
 * 응급 상황에서 최적의 병원을 선택하기 위한 점수 기반 랭킹 알고리즘
 *
 * 점수 계산 기준:
 * 1. 경로 소요시간 (40점) - 가장 중요
 * 2. 병상 가용률 (30점)
 * 3. 외상센터 등급 (20점)
 * 4. 응급실 운영 여부 (10점)
 *
 * Ironclad Law #3: Edge Case Obsession
 * - 경로 정보 없음, 병상 정보 없음, 모든 병원 만실 등 처리
 */
export class HospitalRankingService {
  /**
   * 병원 목록을 응급 상황 최적 순으로 정렬
   *
   * @param hospitals 병원 목록
   * @returns 점수 기반으로 정렬된 병원 목록
   */
  static rankHospitals(hospitals: Hospital[]): Hospital[] {
    // Edge Case 1: 빈 배열
    if (hospitals.length === 0) {
      return [];
    }

    // Edge Case 2: 1개 병원만 있는 경우
    if (hospitals.length === 1) {
      return hospitals;
    }

    // 각 병원에 점수 부여
    const hospitalsWithScore = hospitals.map((hospital) => ({
      hospital,
      score: this.calculateScore(hospital, hospitals),
    }));

    // 점수 내림차순 정렬 (높은 점수 = 더 적합한 병원)
    hospitalsWithScore.sort((a, b) => b.score - a.score);

    // 디버그 로그
    console.log('🏆 Hospital Ranking Results:');
    hospitalsWithScore.slice(0, 5).forEach((item, index) => {
      console.log(
        `${index + 1}. ${item.hospital.name}: ${item.score.toFixed(1)}점 ` +
          `(소요: ${item.hospital.getRouteDurationMinutes() || '?'}분, ` +
          `병상: ${item.hospital.availableBeds}/${item.hospital.totalBeds})`
      );
    });

    return hospitalsWithScore.map((item) => item.hospital);
  }

  /**
   * 개별 병원의 종합 점수 계산 (0~100점)
   *
   * @param hospital 평가 대상 병원
   * @param allHospitals 전체 병원 목록 (상대 평가용)
   * @returns 종합 점수 (0~100)
   */
  private static calculateScore(
    hospital: Hospital,
    allHospitals: Hospital[]
  ): number {
    let score = 0;

    // 1. 경로 소요시간 점수 (40점)
    score += this.calculateTimeScore(hospital, allHospitals);

    // 2. 병상 가용률 점수 (30점)
    score += this.calculateBedAvailabilityScore(hospital);

    // 3. 외상센터 등급 점수 (20점)
    score += this.calculateTraumaLevelScore(hospital);

    // 4. 응급실 운영 여부 점수 (10점)
    score += this.calculateOperatingScore(hospital);

    return score;
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

    // Edge Case: 경로 정보 없음
    if (!hospital.routeDuration) {
      return MAX_SCORE * 0.5; // 중간 점수 (20점)
    }

    // 전체 병원 중 경로 정보가 있는 병원들만 추출
    const hospitalsWithRoute = allHospitals.filter((h) => h.routeDuration);

    // Edge Case: 경로 정보 있는 병원이 1개뿐
    if (hospitalsWithRoute.length === 1) {
      return MAX_SCORE;
    }

    // 최소/최대 소요시간 찾기
    const minDuration = Math.min(...hospitalsWithRoute.map((h) => h.routeDuration!));
    const maxDuration = Math.max(...hospitalsWithRoute.map((h) => h.routeDuration!));

    // Edge Case: 모든 병원 소요시간 동일
    if (minDuration === maxDuration) {
      return MAX_SCORE;
    }

    // 선형 보간: 빠를수록 높은 점수
    const normalizedScore =
      1 - (hospital.routeDuration - minDuration) / (maxDuration - minDuration);
    return normalizedScore * MAX_SCORE;
  }

  /**
   * 병상 가용률 점수 계산 (0~30점)
   * - AVAILABLE (병상 충분): 30점
   * - LIMITED (병상 제한적): 15점
   * - FULL (만실): 0점
   * - UNKNOWN (정보 없음): 10점
   */
  private static calculateBedAvailabilityScore(hospital: Hospital): number {
    const MAX_SCORE = 30;
    const status = hospital.getAvailabilityStatus();

    switch (status) {
      case AvailabilityStatus.AVAILABLE:
        // 가용률 기반 세밀한 점수 (20~30점)
        const availabilityRate = hospital.getAvailabilityRate();
        return 20 + availabilityRate * 10;

      case AvailabilityStatus.LIMITED:
        return MAX_SCORE * 0.5; // 15점

      case AvailabilityStatus.FULL:
        return 0; // 0점 (만실인 병원은 최하위)

      case AvailabilityStatus.UNKNOWN:
      default:
        return MAX_SCORE * 0.33; // 10점 (정보 없으면 낮은 점수)
    }
  }

  /**
   * 외상센터 등급 점수 계산 (0~20점)
   * - Level 1 (권역외상센터): 20점
   * - Level 2 (지역외상센터): 15점
   * - Level 3 (지역응급의료센터): 10점
   * - 없음: 5점
   */
  private static calculateTraumaLevelScore(hospital: Hospital): number {
    const MAX_SCORE = 20;

    if (hospital.traumaLevel === 1) {
      return MAX_SCORE; // 20점
    } else if (hospital.traumaLevel === 2) {
      return MAX_SCORE * 0.75; // 15점
    } else if (hospital.traumaLevel === 3) {
      return MAX_SCORE * 0.5; // 10점
    } else {
      return MAX_SCORE * 0.25; // 5점 (외상센터 아니어도 기본 점수)
    }
  }

  /**
   * 응급실 운영 여부 점수 계산 (0~10점)
   * - 운영 중: 10점
   * - 미운영: 0점
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
    return {
      totalScore: this.calculateScore(hospital, allHospitals),
      timeScore: this.calculateTimeScore(hospital, allHospitals),
      bedScore: this.calculateBedAvailabilityScore(hospital),
      traumaScore: this.calculateTraumaLevelScore(hospital),
      operatingScore: this.calculateOperatingScore(hospital),
    };
  }
}
