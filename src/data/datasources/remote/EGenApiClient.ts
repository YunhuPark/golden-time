import {
  EGenApiResponse,
  HospitalBasicInfoDTO,
  EmergencyRoomBedDTO,
  CombinedHospitalDTO,
} from '../../models/HospitalDTO';
import { NetworkError, RateLimitError } from '../../../infrastructure/errors/AppError';
import { KakaoPlacesClient } from './KakaoPlacesClient';

export class EGenApiClient {
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly geocodingClient: KakaoPlacesClient;

  constructor(timeout = 16000, maxRetries = 2) {
    this.timeout = timeout;
    this.maxRetries = maxRetries;
    this.geocodingClient = new KakaoPlacesClient();
  }

  async getEmergencyRoomBeds(
    stage1?: string,
    stage2?: string,
    numOfRows = 100
  ): Promise<EmergencyRoomBedDTO[]> {
    const endpoint = '/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire';
    const params = new URLSearchParams({
      _endpoint: endpoint,
      numOfRows: numOfRows.toString(),
      pageNo: '1',
      _type: 'json',
    });

    const emergencyBedStage1 = this.normalizeEmergencyBedStage1(stage1);
    if (emergencyBedStage1) params.append('STAGE1', emergencyBedStage1);
    if (stage2) params.append('STAGE2', stage2);

    const response = await this.fetchWithRetry<EGenApiResponse<EmergencyRoomBedDTO>>(
      `/api/egen?${params.toString()}`
    );
    return this.extractItems(response);
  }

  async getHospitalBasicInfo(
    Q0?: string,
    Q1?: string,
    QZ = 'Y',
    numOfRows = 100
  ): Promise<HospitalBasicInfoDTO[]> {
    const endpoint = '/ErmctInfoInqireService/getHsptlBassInfoInqire';
    const params = new URLSearchParams({
      _endpoint: endpoint,
      numOfRows: numOfRows.toString(),
      pageNo: '1',
      QZ,
      _type: 'json',
    });
    if (Q0) params.append('Q0', Q0);
    if (Q1) params.append('Q1', Q1);

    const response = await this.fetchWithRetry<EGenApiResponse<HospitalBasicInfoDTO>>(
      `/api/egen?${params.toString()}`
    );
    return this.extractItems(response);
  }

  async getCombinedHospitalData(
    stage1?: string,
    stage2?: string
  ): Promise<CombinedHospitalDTO[]> {
    console.log('🏥 병원 정보 조회 시작:', { stage1, stage2 });

    const beds = await this.getEmergencyRoomBeds(stage1, stage2, 100);
    console.log(`✅ 병상 정보: ${beds.length}개 수신`);

    const combinedList: CombinedHospitalDTO[] = beds.map((bed) => ({
      basicInfo: this.createBasicInfoFromBedInfo(bed),
      bedInfo: bed,
    }));

    await this.enrichCoordinatesWithGeocoding(combinedList, stage1);
    return combinedList;
  }

  private async enrichCoordinatesWithGeocoding(
    combinedList: CombinedHospitalDTO[],
    region?: string
  ): Promise<void> {
    const hospitalsNeedingGeocoding = combinedList.filter((item) => {
      const { wgs84Lat, wgs84Lon, dutyName } = item.basicInfo;
      const lat = parseFloat(wgs84Lat || '0');
      const lon = parseFloat(wgs84Lon || '0');
      const hasNoCoords =
        !wgs84Lat || !wgs84Lon || lat === 0 || lon === 0 || Number.isNaN(lat) || Number.isNaN(lon);
      const hasValidName = Boolean(
        dutyName &&
        !dutyName.includes('정보 없음') &&
        !dutyName.includes('테스트 데이터') &&
        !dutyName.includes('병원명 없음')
      );
      return hasNoCoords && hasValidName;
    });

    if (hospitalsNeedingGeocoding.length === 0) return;

    // Keep Kakao traffic bounded, but use six workers so a 61-hospital feed
    // finishes in fewer waves. KakaoPlacesClient also deduplicates and caches
    // same-session lookups, so repeated searches avoid most network work.
    const concurrency = Math.min(6, hospitalsNeedingGeocoding.length);
    let nextIndex = 0;
    let successCount = 0;

    const worker = async () => {
      while (true) {
        const currentIndex = nextIndex++;
        if (currentIndex >= hospitalsNeedingGeocoding.length) return;

        const item = hospitalsNeedingGeocoding[currentIndex];
        if (!item) continue;

        try {
          const result = await this.geocodingClient.keywordToCoordinates(item.basicInfo.dutyName, region);
          if (result) {
            item.basicInfo.wgs84Lat = result.latitude.toString();
            item.basicInfo.wgs84Lon = result.longitude.toString();
            item.basicInfo.dutyAddr = result.address;
            successCount++;
          }
          // Small per-worker spacing avoids turning the faster pool into an
          // unbounded burst while adding little latency across the whole batch.
          await this.sleep(25);
        } catch (error) {
          console.error(`❌ Failed to geocode "${item.basicInfo.dutyName}":`, error);
        }
      }
    };

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    console.log(`✅ Geocoding complete: ${successCount}/${hospitalsNeedingGeocoding.length}`);
  }

  private createBasicInfoFromBedInfo(bed: EmergencyRoomBedDTO): HospitalBasicInfoDTO {
    return {
      hpid: bed.hpid,
      dutyName: bed.dutyName || '정보 없음',
      dutyAddr: bed.dutyAddr || '주소 정보 없음',
      dutyTel1: bed.dutyTel1 || undefined,
      dutyTel3: bed.dutyTel3 || undefined,
      wgs84Lat: bed.wgs84Lat?.toString() || '0',
      wgs84Lon: bed.wgs84Lon?.toString() || '0',
      dutyEmcls: '',
      dutyEmclsName: '',
      dutyEryn: '1',
    };
  }

  private normalizeEmergencyBedStage1(stage1?: string): string | undefined {
    if (stage1 === '광주광역시') return '광주';
    return stage1;
  }

  private async fetchWithRetry<T>(url: string, retries = this.maxRetries): Promise<T> {
    for (let attempt = 0; attempt < retries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
        clearTimeout(timeoutId);

        if (response.status === 429) {
          throw new RateLimitError('API 호출 제한 초과');
        }
        if (!response.ok) {
          throw new NetworkError(`HTTP Error: ${response.status}`, undefined, response.status);
        }
        return await response.json();
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof RateLimitError) throw error;
        if (
          error instanceof NetworkError &&
          (error.statusCode === 401 || error.statusCode === 403)
        ) {
          throw error;
        }

        if (attempt < retries - 1) {
          await this.sleep(Math.pow(2, attempt) * 1000);
          continue;
        }
        throw error;
      }
    }
    throw new NetworkError('Max retries exceeded');
  }

  private extractItems<T>(response: EGenApiResponse<T>): T[] {
    const { header, body } = response.response;
    if (header.resultCode !== '00') {
      throw new NetworkError(`API Error: ${header.resultMsg}`);
    }
    if (!body?.items?.item) return [];
    return Array.isArray(body.items.item) ? body.items.item : [body.items.item];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
