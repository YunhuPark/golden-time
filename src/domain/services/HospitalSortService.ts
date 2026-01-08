import { Hospital } from '../entities/Hospital';
import { Coordinates } from '../valueObjects/Coordinates';
import { SortOption } from '../types/SortOption';
import { HospitalRankingService } from './HospitalRankingService';

/**
 * Hospital Sort Service
 * 다양한 기준으로 병원 목록 정렬
 */
export class HospitalSortService {
  /**
   * 선택된 정렬 옵션에 따라 병원 목록 정렬
   *
   * @param hospitals 병원 목록
   * @param sortOption 정렬 옵션
   * @param userLocation 사용자 위치 (거리순 정렬 시 필요)
   * @returns 정렬된 병원 목록
   */
  static sortHospitals(
    hospitals: Hospital[],
    sortOption: SortOption,
    userLocation: Coordinates | null
  ): Hospital[] {
    // Edge Case: 빈 배열
    if (hospitals.length === 0) {
      return [];
    }

    // Edge Case: 1개만 있는 경우
    if (hospitals.length === 1) {
      return hospitals;
    }

    // 복사본 생성 (원본 배열 보존)
    const sortedHospitals = [...hospitals];

    switch (sortOption) {
      case 'RECOMMENDED':
        return this.sortByRecommended(sortedHospitals);

      case 'TIME':
        return this.sortByTime(sortedHospitals);

      case 'DISTANCE':
        return this.sortByDistance(sortedHospitals, userLocation);

      case 'BEDS':
        return this.sortByBeds(sortedHospitals);

      default:
        return sortedHospitals;
    }
  }

  /**
   * 추천순 정렬 (AI 점수 기반)
   */
  private static sortByRecommended(hospitals: Hospital[]): Hospital[] {
    return HospitalRankingService.rankHospitals(hospitals);
  }

  /**
   * 시간순 정렬 (빠른 도착 순)
   * - 경로 정보가 있는 병원 우선
   * - 소요시간이 짧은 순
   * - 경로 정보 없으면 뒤로
   */
  private static sortByTime(hospitals: Hospital[]): Hospital[] {
    return hospitals.sort((a, b) => {
      const timeA = a.routeDuration;
      const timeB = b.routeDuration;

      // 둘 다 경로 정보 없음
      if (!timeA && !timeB) return 0;

      // A만 경로 정보 없음 → B가 우선
      if (!timeA) return 1;

      // B만 경로 정보 없음 → A가 우선
      if (!timeB) return -1;

      // 둘 다 있으면 소요시간 비교 (오름차순)
      return timeA - timeB;
    });
  }

  /**
   * 거리순 정렬 (가까운 순)
   * - 사용자 위치가 필요
   * - 직선 거리 기준
   */
  private static sortByDistance(
    hospitals: Hospital[],
    userLocation: Coordinates | null
  ): Hospital[] {
    // Edge Case: 사용자 위치 없음
    if (!userLocation) {
      console.warn('User location is required for distance sorting');
      return hospitals;
    }

    return hospitals.sort((a, b) => {
      const distA = a.distanceFrom(userLocation);
      const distB = b.distanceFrom(userLocation);
      return distA - distB;
    });
  }

  /**
   * 병상순 정렬 (가용 병상 많은 순)
   * - 병상 가용률 우선
   * - 운영 중인 병원 우선
   */
  private static sortByBeds(hospitals: Hospital[]): Hospital[] {
    return hospitals.sort((a, b) => {
      // 운영 여부 우선 체크
      if (a.isOperating !== b.isOperating) {
        return a.isOperating ? -1 : 1;
      }

      // 가용 병상 수 비교 (내림차순)
      if (a.availableBeds !== b.availableBeds) {
        return b.availableBeds - a.availableBeds;
      }

      // 가용 병상 같으면 가용률 비교
      const rateA = a.getAvailabilityRate();
      const rateB = b.getAvailabilityRate();
      return rateB - rateA;
    });
  }
}
