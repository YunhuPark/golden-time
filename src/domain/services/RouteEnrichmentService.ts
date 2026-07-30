import { Hospital } from '../entities/Hospital';
import { Coordinates } from '../valueObjects/Coordinates';
import { IHospitalRepository } from '../repositories/IHospitalRepository';
import { useAppStore } from '../../infrastructure/state/store';

/**
 * Phase 2 경로 계산을 백그라운드에서 점진적으로 수행하는 서비스
 */
export class RouteEnrichmentService {
  constructor(private readonly repository: IHospitalRepository) {}

  /**
   * 이동시간 정보가 아직 없는 병원들에 대해 청크 단위로 백그라운드 조회를 실행합니다.
   * 조회 완료 시마다 Zustand store를 업데이트하여 UI에 즉시 반영되도록 합니다.
   */
  async processBackgroundQueue(
    userLocation: Coordinates,
    hospitals: Hospital[]
  ): Promise<void> {
    // 아직 경로 계산이 안 된 병원만 필터링 (routeDuration이 undefined인 경우)
    const targets = hospitals.filter(h => h.routeDuration === undefined);

    if (targets.length === 0) return;

    console.log(`[RouteEnrichmentService] 🚀 Phase 2 시작: 남은 ${targets.length}개 병원 백그라운드 처리`);

    const CHUNK_SIZE = 5;
    const store = useAppStore.getState();

    for (let i = 0; i < targets.length; i += CHUNK_SIZE) {
      const chunk = targets.slice(i, i + CHUNK_SIZE);
      
      try {
        const enrichedChunk = await this.repository.enrichWithRouteInfo(userLocation, chunk);
        
        // zustand store에 업데이트 요청
        if (store.updateHospitalsWithRoutes) {
          store.updateHospitalsWithRoutes(enrichedChunk);
        } else {
          // fallback: 만약 updateHospitalsWithRoutes가 없다면 전체 갱신 (선택사항)
          console.warn('updateHospitalsWithRoutes 액션이 store에 존재하지 않습니다.');
        }

        // 과도한 API 호출 방지를 위한 딜레이 (Kakao API Rate limit 우회)
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`[RouteEnrichmentService] Chunk ${i} 처리 실패:`, error);
        // 실패해도 큐는 계속 진행
      }
    }

    console.log(`[RouteEnrichmentService] ✅ Phase 2 완료`);
  }
}
