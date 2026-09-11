import {
  EGenApiResponse,
  HospitalBasicInfoDTO,
  EmergencyRoomBedDTO,
  EmergencyLocationDTO,
  CombinedHospitalDTO,
} from '../../models/HospitalDTO';
import { NetworkError, RateLimitError } from '../../../infrastructure/errors/AppError';
import { recordEGenPerformance } from '../../../infrastructure/monitoring/searchPerformance';
import { KakaoPlacesClient } from './KakaoPlacesClient';

export class EGenApiClient {
  private readonly timeout: number;
  private readonly maxRetries: number;
  private performanceSearchId?: number;
  private readonly geocodingClient: KakaoPlacesClient;

  constructor(timeout = 16000, maxRetries = 2, performanceSearchId?: number) {
    this.timeout = timeout;
    this.maxRetries = maxRetries;
    this.performanceSearchId = performanceSearchId;
    this.geocodingClient = new KakaoPlacesClient();
  }

  setPerformanceSearchId(searchId: number | null): void {
    this.performanceSearchId = searchId ?? undefined;
  }

  async getNearbyEmergencyLocations(
    latitude: number,
    longitude: number,
    numOfRows = 100
  ): Promise<EmergencyLocationDTO[]> {
    const endpoint = '/ErmctInfoInqireService/getEgytLcinfoInqire';
    const params = new URLSearchParams({
      _endpoint: endpoint,
      WGS84_LAT: latitude.toString(),
      WGS84_LON: longitude.toString(),
      numOfRows: numOfRows.toString(),
      pageNo: '1',
      _type: 'json',
    });

    const response = await this.fetchWithRetry<EGenApiResponse<EmergencyLocationDTO>>(
      `/api/egen?${params.toString()}`,
      1,
      5000
    );
    return this.extractItems(response);
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

  private async getHospitalList(
    Q0: string | undefined,
    Q1: string | undefined,
    numOfRows = 300
  ): Promise<HospitalBasicInfoDTO[]> {
    const endpoint = '/ErmctInfoInqireService/getEgytListInfoInqire';
    const params = new URLSearchParams({
      _endpoint: endpoint,
      numOfRows: numOfRows.toString(),
      pageNo: '1',
      _type: 'json',
      ORD: 'ADDR',
    });
    if (Q0) params.append('Q0', Q0);
    if (Q1) params.append('Q1', Q1);

    const response = await this.fetchWithRetry<EGenApiResponse<HospitalBasicInfoDTO>>(
      `/api/egen?${params.toString()}`,
      1,
      3500
    );
    return this.extractItems(response);
  }

  async getHospitalBasicInfoById(hpid: string): Promise<HospitalBasicInfoDTO | null> {
    const endpoint = '/ErmctInfoInqireService/getEgytBassInfoInqire';
    const params = new URLSearchParams({
      _endpoint: endpoint,
      HPID: hpid,
      numOfRows: '1',
      pageNo: '1',
      _type: 'json',
    });

    const response = await this.fetchWithRetry<EGenApiResponse<HospitalBasicInfoDTO>>(
      `/api/egen?${params.toString()}`,
      1,
      3500
    );
    return this.extractItems(response)[0] ?? null;
  }

  async getHospitalBasicInfo(
    Q0?: string,
    Q1?: string
  ): Promise<HospitalBasicInfoDTO[]> {
    const normalizedQ0 = this.normalizeHospitalListRegion(Q0);

    // QZ is optional. Omitting it returns the full regional emergency-institution
    // list in one request instead of issuing separate A/B/C queries. This keeps
    // additional valid classes such as emergency-declared specialty hospitals.
    const items = await this.getHospitalList(normalizedQ0, Q1);
    const deduplicated = new Map<string, HospitalBasicInfoDTO>();
    for (const item of items) {
      if (item.hpid && !deduplicated.has(item.hpid)) {
        deduplicated.set(item.hpid, item);
      }
    }
    return Array.from(deduplicated.values());
  }

  async getCombinedHospitalData(
    stage1?: string,
    stage2?: string,
    preloadedBasicInfo?: HospitalBasicInfoDTO[]
  ): Promise<CombinedHospitalDTO[]> {
    console.log('🏥 병원 정보 조회 시작:', { stage1, stage2 });

    const fetchStartedAt = performance.now();
    const basicInfoPromise = preloadedBasicInfo
      ? Promise.resolve(preloadedBasicInfo)
      : this.getHospitalBasicInfo(stage1, stage2).catch((error) => {
          console.warn('⚠️ E-Gen regional hospital list unavailable; using Kakao fallback', error);
          return [] as HospitalBasicInfoDTO[];
        });
    const bedsPromise = this.getEmergencyRoomBeds(stage1, stage2, 100);

    const [beds, basicInfo] = await Promise.all([bedsPromise, basicInfoPromise]);
    const eGenFetchMs = performance.now() - fetchStartedAt;
    console.log(`✅ 병상 정보: ${beds.length}개 수신 / 지역목록: ${basicInfo.length}개 수신`);

    const basicInfoByHpid = new Map(
      basicInfo
        .filter((item) => Boolean(item.hpid))
        .map((item) => [item.hpid, item] as const)
    );

    let basicInfoCoordinateHits = 0;
    const combinedList: CombinedHospitalDTO[] = beds.map((bed) => {
      const basic = basicInfoByHpid.get(bed.hpid);
      if (basic && this.hasValidCoordinates(basic.wgs84Lat, basic.wgs84Lon)) {
        basicInfoCoordinateHits++;
      }

      return {
        basicInfo: basic
          ? this.mergeBasicInfoWithBed(basic, bed)
          : this.createBasicInfoFromBedInfo(bed),
        bedInfo: bed,
      };
    });

    if (basicInfo.length > 0) {
      console.log(`✅ E-Gen coordinate match: ${basicInfoCoordinateHits}/${beds.length}`);
    }

    const geocodingStartedAt = performance.now();
    const geocodingStats = await this.enrichCoordinatesWithGeocoding(combinedList, stage1);
    const geocodingMs = performance.now() - geocodingStartedAt;

    if (this.performanceSearchId !== undefined) {
      recordEGenPerformance(this.performanceSearchId, {
        eGenFetchMs,
        geocodingMs,
        geocodingRequested: geocodingStats.requested,
        geocodingSucceeded: geocodingStats.succeeded,
      });
    }

    return combinedList;
  }

  private async enrichCoordinatesWithGeocoding(
    combinedList: CombinedHospitalDTO[],
    region?: string
  ): Promise<{ requested: number; succeeded: number }> {
    const hospitalsNeedingGeocoding = combinedList.filter((item) => {
      const { wgs84Lat, wgs84Lon, dutyName } = item.basicInfo;
      const hasNoCoords = !this.hasValidCoordinates(wgs84Lat, wgs84Lon);
      const hasValidName = Boolean(
        dutyName &&
        !dutyName.includes('정보 없음') &&
        !dutyName.includes('테스트 데이터') &&
        !dutyName.includes('병원명 없음')
      );
      return hasNoCoords && hasValidName;
    });

    if (hospitalsNeedingGeocoding.length === 0) {
      return { requested: 0, succeeded: 0 };
    }

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
          await this.sleep(25);
        } catch (error) {
          console.error(`❌ Failed to geocode "${item.basicInfo.dutyName}":`, error);
        }
      }
    };

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    console.log(`✅ Kakao geocoding fallback: ${successCount}/${hospitalsNeedingGeocoding.length}`);
    return {
      requested: hospitalsNeedingGeocoding.length,
      succeeded: successCount,
    };
  }

  private mergeBasicInfoWithBed(
    basic: HospitalBasicInfoDTO,
    bed: EmergencyRoomBedDTO
  ): HospitalBasicInfoDTO {
    return {
      ...basic,
      hpid: bed.hpid,
      dutyName: basic.dutyName || bed.dutyName || '정보 없음',
      dutyAddr: basic.dutyAddr || bed.dutyAddr || '주소 정보 없음',
      dutyTel1: basic.dutyTel1 || bed.dutyTel1 || undefined,
      dutyTel3: basic.dutyTel3 || bed.dutyTel3 || undefined,
      wgs84Lat: basic.wgs84Lat?.toString() || bed.wgs84Lat?.toString() || '0',
      wgs84Lon: basic.wgs84Lon?.toString() || bed.wgs84Lon?.toString() || '0',
      dutyEmcls: basic.dutyEmcls || '',
      dutyEmclsName: basic.dutyEmclsName || '',
      dutyEryn: basic.dutyEryn || '1',
    };
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

  private hasValidCoordinates(latValue?: string, lonValue?: string): boolean {
    const lat = Number(latValue);
    const lon = Number(lonValue);
    return (
      Number.isFinite(lat) &&
      Number.isFinite(lon) &&
      lat >= 33 &&
      lat <= 39 &&
      lon >= 124 &&
      lon <= 132
    );
  }

  private normalizeEmergencyBedStage1(stage1?: string): string | undefined {
    if (stage1 === '광주광역시') return '광주';
    return stage1;
  }

  private normalizeHospitalListRegion(region?: string): string | undefined {
    if (region === '광주광역시') return '광주';
    return region;
  }

  private async fetchWithRetry<T>(
    url: string,
    retries = this.maxRetries,
    timeoutMs = this.timeout
  ): Promise<T> {
    for (let attempt = 0; attempt < retries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

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
