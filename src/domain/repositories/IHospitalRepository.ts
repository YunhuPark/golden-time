import { Hospital } from '../entities/Hospital';
import { Coordinates } from '../valueObjects/Coordinates';
import { AIAnalysisContext } from '../types/AIContext';

export type NearbyHospitalProgressCallback = (
  hospitals: Hospital[]
) => void | Promise<void>;

/**
 * Hospital Repository Interface
 * Domain Layer에서 정의, Data Layer에서 구현 (Dependency Inversion)
 */
export interface IHospitalRepository {
  /**
   * 특정 좌표 주변의 병원 검색
   * @param coords 중심 좌표
   * @param aiContext 검색할 AI 컨텍스트 (선택사항)
   * @param onInitialResults 현재 행정지역 결과가 준비됐을 때 호출되는 선택 콜백
   * @returns 전국 GPS 검색 범위의 최종 병원 목록
   */
  findNearby(
    coords: Coordinates,
    aiContext?: AIAnalysisContext | null,
    onInitialResults?: NearbyHospitalProgressCallback
  ): Promise<Hospital[]>;

  /**
   * 특정 지역(시도, 시군구)의 병원 검색
   * @param stage1 시도 (예: "서울특별시")
   * @param stage2 시군구 (선택)
   * @returns 병원 목록
   */
  findByRegion(stage1: string, stage2?: string): Promise<Hospital[]>;

  /**
   * 특정 ID의 병원 조회
   * @param id 병원 ID
   * @returns 병원 정보 또는 null
   */
  findById(id: string): Promise<Hospital | null>;
}
