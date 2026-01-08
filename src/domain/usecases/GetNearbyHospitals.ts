import { Hospital } from '../entities/Hospital';
import { Coordinates } from '../valueObjects/Coordinates';
import { IHospitalRepository } from '../repositories/IHospitalRepository';

/**
 * 검색 결과 타입
 */
export interface HospitalSearchResult {
  hospitals: Hospital[];
  warning: HospitalSearchWarning | null;
}

/**
 * 경고 메시지 타입
 */
export interface HospitalSearchWarning {
  type: 'NO_HOSPITALS_FOUND' | 'NO_BEDS_AVAILABLE' | 'DATA_STALE' | 'LOW_ACCURACY';
  message: string;
  action?: {
    type: 'CALL_119' | 'EXPAND_SEARCH' | 'REFRESH_DATA';
    label: string;
    onClick?: () => void;
  };
}

/**
 * 병원 점수 (최적 병원 선정용)
 */
export interface HospitalScore {
  hospital: Hospital;
  score: number;
  distance: number;
  estimatedTravelTime?: number;
}

// 검색 전략은 현재 사용하지 않음 (모든 병원을 한 번에 가져옴)

/**
 * GetNearbyHospitals Use Case
 *
 * 사용자 위치 주변의 응급실을 검색하고 최적 병원을 추천
 *
 * 주요 기능:
 * - 점진적 검색 반경 확대 (5km → 10km → 20km → 50km)
 * - 가용 병상 필터링
 * - 다중 요소 점수 산출 (거리 + 병상 + 전문과 + 외상레벨)
 * - Edge Case 처리 (병원 없음, 모두 만실, 데이터 오래됨)
 */
export class GetNearbyHospitals {
  constructor(
    private readonly hospitalRepository: IHospitalRepository
  ) {}

  /**
   * 주변 병원 검색 실행
   */
  async execute(
    userLocation: Coordinates,
    userSpecializations?: string[]
  ): Promise<HospitalSearchResult> {
    // 점진적 확대 전략 제거: 모든 병원을 한 번에 가져옴 (거리 무제한)
    const allHospitals = await this.hospitalRepository.findNearby(userLocation);

    // 가용 병상이 있는 병원 필터링 (임시로 운영중인 병원만)
    const availableHospitals = allHospitals.filter(
      (h) => h.isOperating
    );

    // Edge Case 1: 병원을 전혀 찾지 못함
    if (availableHospitals.length === 0) {
      return {
        hospitals: allHospitals, // 운영중이 아닌 병원이라도 표시
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

    // Edge Case 2: 병원은 있지만 모두 만실
    // TODO: 실제 가용 병상 API 연동 후 활성화
    // const hasAvailableBeds = allHospitals.some((h) => h.availableBeds > 0);
    // if (!hasAvailableBeds) {
    //   return {
    //     hospitals: allHospitals,
    //     warning: {
    //       type: 'NO_BEDS_AVAILABLE',
    //       message: '주변 모든 응급실이 만실입니다. 119에 연락하여 병상 배정을 요청하세요.',
    //       action: {
    //         type: 'CALL_119',
    //         label: '119 구급대 호출',
    //         onClick: () => {
    //           if (typeof window !== 'undefined') {
    //             window.location.href = 'tel:119';
    //           }
    //         },
    //       },
    //     },
    //   };
    // }

    // Edge Case 3: 데이터가 오래됨 (5분 이상)
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

    // 병원 점수 계산 및 정렬
    const scoredHospitals = this.scoreHospitals(
      availableHospitals, // 운영중인 병원만 점수 계산
      userLocation,
      userSpecializations
    );

    // 모든 병원 반환 (제한 없음)
    const topHospitals = scoredHospitals
      .sort((a, b) => b.score - a.score)
      .map((scored) => scored.hospital);

    console.log(`✅ Returning ${topHospitals.length} hospitals (no limit)`);

    return {
      hospitals: topHospitals,
      warning,
    };
  }

  /**
   * 병원 점수 산출
   *
   * 점수 = (거리점수 × 0.50) + (병상점수 × 0.30) + (전문과점수 × 0.15) + (외상점수 × 0.05)
   */
  private scoreHospitals(
    hospitals: Hospital[],
    userLocation: Coordinates,
    userSpecializations?: string[]
  ): HospitalScore[] {
    return hospitals.map((hospital) => {
      const distance = hospital.distanceFrom(userLocation);

      // 1. 거리 점수 (가까울수록 높음, 30분 거리 = 20km 기준)
      const maxDistance = 20000; // 20km
      const distanceScore = Math.max(0, 100 - (distance / maxDistance) * 100);

      // 2. 병상 가용성 점수
      const bedScore = Math.min(100, hospital.availableBeds * 20); // 5병상 = 100점

      // 3. 전문과 매칭 점수
      let specializationScore = 50; // 기본값
      if (userSpecializations && userSpecializations.length > 0) {
        const hasMatch = userSpecializations.some((spec) =>
          hospital.hasSpecialization(spec as any)
        );
        specializationScore = hasMatch ? 100 : 30; // 매칭 시 보너스
      }

      // 4. 외상센터 등급 점수
      const traumaScore = hospital.traumaLevel
        ? (4 - hospital.traumaLevel) * 33.33
        : 25;

      // 가중 평균
      const finalScore =
        distanceScore * 0.5 +
        bedScore * 0.3 +
        specializationScore * 0.15 +
        traumaScore * 0.05;

      return {
        hospital,
        score: Math.round(finalScore),
        distance,
      };
    });
  }
}
