/**
 * Hospital Filter Types
 * 병원 검색 필터 옵션
 */

export interface HospitalFilters {
  hasCT: boolean;           // CT 촬영 가능
  hasMRI: boolean;          // MRI 촬영 가능
  hasSurgery: boolean;      // 수술 가능
  is24Hours: boolean;       // 24시간 운영
  hasAvailableBeds: boolean; // 병상 여유 있음
  within10km: boolean;      // 10km 이내
}

export const DEFAULT_FILTERS: HospitalFilters = {
  hasCT: false,
  hasMRI: false,
  hasSurgery: false,
  is24Hours: false,
  hasAvailableBeds: false,
  within10km: false,
};

/**
 * 필터 적용 함수
 * 병원 목록을 필터링하여 조건에 맞는 병원만 반환
 */
export function applyFilters(
  hospitals: import('../entities/Hospital').Hospital[],
  filters: HospitalFilters,
  userLocation?: import('../valueObjects/Coordinates').Coordinates | null
): import('../entities/Hospital').Hospital[] {
  // 모든 필터가 false면 필터링하지 않음
  const hasActiveFilters = Object.values(filters).some((value) => value);
  if (!hasActiveFilters) {
    return hospitals;
  }

  return hospitals.filter((hospital) => {
    // CT 필터
    if (filters.hasCT && !hospital.hasCT) {
      return false;
    }

    // MRI 필터
    if (filters.hasMRI && !hospital.hasMRI) {
      return false;
    }

    // 수술 필터
    if (filters.hasSurgery && !hospital.hasSurgery) {
      return false;
    }

    // 24시간 운영 필터
    if (filters.is24Hours && !hospital.isOperating) {
      return false;
    }

    // 병상 여유 필터
    if (filters.hasAvailableBeds && hospital.availableBeds <= 0) {
      return false;
    }

    // 10km 이내 필터
    if (filters.within10km && userLocation) {
      const distance = userLocation.distanceTo(hospital.coordinates);
      if (distance > 10000) { // 10km = 10000m
        return false;
      }
    }

    return true;
  });
}
