import {
  EGenApiResponse,
  HospitalBasicInfoDTO,
  EmergencyRoomBedDTO,
  CombinedHospitalDTO,
} from '../../models/HospitalDTO';
import {
  NetworkError,
  RateLimitError,
} from '../../../infrastructure/errors/AppError';
import { KakaoPlacesClient } from './KakaoPlacesClient';

export class EGenApiClient {
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly geocodingClient: KakaoPlacesClient;

  constructor(
    timeout = 10000,
    maxRetries = 3
  ) {
    this.timeout = timeout;
    this.maxRetries = maxRetries;
    this.geocodingClient = new KakaoPlacesClient();
  }

  /**
   * 실시간 응급실 병상 정보 조회
   */
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

    if (stage1) params.append('STAGE1', stage1);
    if (stage2) params.append('STAGE2', stage2);

    const url = `/api/egen?${params.toString()}`;
    
    const response = await this.fetchWithRetry<EGenApiResponse<EmergencyRoomBedDTO>>(url);
    return this.extractItems(response);
  }

  /**
   * 응급의료기관 기본 정보 조회
   */
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

    const url = `/api/egen?${params.toString()}`;
    
    const response = await this.fetchWithRetry<EGenApiResponse<HospitalBasicInfoDTO>>(url);
    return this.extractItems(response);
  }

  /**
   * 기본 정보 + 병상 정보 통합 조회
   *
   * 참고: 기본정보 API(getHsptlBassInfoInqire)가 404 오류를 반환하므로,
   * 병상 정보 API만 사용하고 Kakao Geocoding으로 추가 정보를 보정합니다.
   */
  async getCombinedHospitalData(
    stage1?: string,
    stage2?: string
  ): Promise<CombinedHospitalDTO[]> {
    try {
      console.log('🏥 병원 정보 조회 시작:', { stage1, stage2 });

      // Phase 1: 병상 정보 API만 호출 (기본정보 API는 404 오류)
      const beds = await this.getEmergencyRoomBeds(stage1, stage2, 300);

      console.log(`✅ 병상 정보: ${beds.length}개 수신`);

      // Phase 2: 병상 정보를 기본 정보로 변환
      const combinedList: CombinedHospitalDTO[] = beds.map((bed) => {
        return {
          basicInfo: this.createBasicInfoFromBedInfo(bed),
          bedInfo: bed,
        };
      });

      // 디버깅: 병합 결과 확인
      const debugInfo = combinedList.slice(0, 3).map(item => ({
        name: item.basicInfo.dutyName,
        lat: item.basicInfo.wgs84Lat,
        lon: item.basicInfo.wgs84Lon,
        tel1: item.basicInfo.dutyTel1,
        tel3: item.basicInfo.dutyTel3,
        hasCT: item.bedInfo?.hvctayn,
        hasMRI: item.bedInfo?.hvmriayn,
      }));
      console.log('📊 처음 3개 병원 병합 데이터:', debugInfo);

      // Phase 3: Kakao Geocoding으로 좌표 없는 병원 보정
      await this.enrichCoordinatesWithGeocoding(combinedList, stage1);

      return combinedList;

    } catch (error) {
      console.error('❌ getCombinedHospitalData failed:', error);
      throw error;
    }
  }

  /**
   * Kakao Geocoding으로 좌표 없는 병원들의 좌표 보정
   * Phase 2: 병원 이름 키워드 검색 → 좌표 변환
   *
   * 참고: 병상 정보 API는 주소/좌표 필드를 제공하지 않으므로,
   *       병원 이름으로 Kakao Local API 키워드 검색을 수행합니다.
   */
  private async enrichCoordinatesWithGeocoding(
    combinedList: CombinedHospitalDTO[],
    region?: string
  ): Promise<void> {
    console.log(`🔍 Geocoding 필터링 시작 (총 ${combinedList.length}개 병원)`);

    // 좌표가 없거나 유효하지 않은 병원들 찾기
    const hospitalsNeedingGeocoding = combinedList.filter((item) => {
      const { wgs84Lat, wgs84Lon, dutyName } = item.basicInfo;

      // 좌표가 없거나 0인 경우
      const lat = parseFloat(wgs84Lat || '0');
      const lon = parseFloat(wgs84Lon || '0');
      const hasNoCoords = !wgs84Lat || !wgs84Lon ||
                         wgs84Lat === '0' || wgs84Lon === '0' ||
                         lat === 0 || lon === 0 ||
                         isNaN(lat) || isNaN(lon);

      // 병원 이름이 있는 경우만 geocoding 시도
      const hasValidName = dutyName &&
                          !dutyName.includes('정보 없음') &&
                          !dutyName.includes('테스트 데이터') &&
                          !dutyName.includes('병원명 없음');

      const needsGeocoding = hasNoCoords && hasValidName;

      // 디버깅: 첫 3개 병원만 로그
      if (combinedList.indexOf(item) < 3) {
        console.log(`  - ${dutyName}:`, {
          lat: wgs84Lat,
          lon: wgs84Lon,
          hasNoCoords,
          hasValidName,
          needsGeocoding,
        });
      }

      return needsGeocoding;
    });

    if (hospitalsNeedingGeocoding.length === 0) {
      console.log('✅ All hospitals have valid coordinates. Skipping geocoding.');
      return;
    }

    console.log(`🗺️ Geocoding ${hospitalsNeedingGeocoding.length} hospitals without coordinates...`);

    try {
      // 병원 이름 키워드 검색으로 좌표 찾기 (순차 처리, Rate Limit 고려)
      let successCount = 0;

      for (const item of hospitalsNeedingGeocoding) {
        const hospitalName = item.basicInfo.dutyName;

        try {
          // Kakao Local API 키워드 검색 (병원 이름 + 지역명)
          const result = await this.geocodingClient.keywordToCoordinates(
            hospitalName,
            region // 지역명 전달 (예: "경상남도", "서울특별시")
          );

          if (result) {
            item.basicInfo.wgs84Lat = result.latitude.toString();
            item.basicInfo.wgs84Lon = result.longitude.toString();
            // 주소도 업데이트 (Kakao에서 받아온 정확한 주소)
            item.basicInfo.dutyAddr = result.address;
            successCount++;
          }

          // Rate Limit 방지 (150ms 지연)
          await this.sleep(150);

        } catch (error) {
          console.error(`❌ Failed to geocode "${hospitalName}":`, error);
          // 개별 실패는 무시하고 계속 진행
        }
      }

      console.log(`✅ Geocoding complete: ${successCount}/${hospitalsNeedingGeocoding.length} hospitals geocoded successfully.`);

      if (successCount < hospitalsNeedingGeocoding.length) {
        console.warn(`⚠️ ${hospitalsNeedingGeocoding.length - successCount} hospitals could not be geocoded.`);
      }

    } catch (error) {
      console.error('❌ Geocoding batch failed:', error);
      // 에러가 발생해도 기존 데이터는 유지 (부분 실패 허용)
    }
  }

  /**
   * 병상 정보로부터 기본 정보 생성 (Fallback)
   */
  private createBasicInfoFromBedInfo(bed: EmergencyRoomBedDTO): HospitalBasicInfoDTO {
    // 디버깅: 원본 bed 데이터에서 전화번호 확인
    if (Math.random() < 0.05) { // 5% 확률로 로그
      console.log(`🔍 [createBasicInfoFromBedInfo] ${bed.dutyName}:`, {
        dutyTel1_from_bed: bed.dutyTel1,
        dutyTel3_from_bed: bed.dutyTel3,
        typeof_tel1: typeof bed.dutyTel1,
        typeof_tel3: typeof bed.dutyTel3,
      });
    }

    return {
      hpid: bed.hpid,
      dutyName: bed.dutyName || '정보 없음',
      dutyAddr: bed.dutyAddr || '주소 정보 없음',
      dutyTel1: bed.dutyTel1 || undefined,
      dutyTel3: bed.dutyTel3 || undefined,
      // 좌표는 일단 null로 두고, enrichCoordinatesWithGeocoding에서 채워짐
      wgs84Lat: bed.wgs84Lat?.toString() || '0',
      wgs84Lon: bed.wgs84Lon?.toString() || '0',
      dutyEmcls: '',
      dutyEmclsName: '',
      dutyEryn: '1',
    };
  }

  private async fetchWithRetry<T>(url: string, retries = this.maxRetries): Promise<T> {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' },
        });

        clearTimeout(timeoutId);

        // 429 에러는 잠시 멈춤
        if (response.status === 429) {
             console.warn("🛑 API 호출 과다 (429). 잠시 대기 필요.");
             throw new RateLimitError('API 호출 제한 초과');
        }

        if (!response.ok) {
          throw new NetworkError(`HTTP Error: ${response.status}`, undefined, response.status);
        }

        return await response.json();

      } catch (error) {
        if (error instanceof RateLimitError) throw error;
        
        // 403 인증 실패는 재시도 금지
        if (error instanceof NetworkError && (error.statusCode === 401 || error.statusCode === 403)) {
             console.error(`🛑 인증 실패 (403). 키를 확인하세요.`);
             throw error;
        }

        if (attempt < retries - 1) {
          const delay = Math.pow(2, attempt) * 1000;
          await this.sleep(delay);
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