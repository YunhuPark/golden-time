import { Hospital, Specialization, TraumaLevel } from '../../../domain/entities/Hospital';
import { Coordinates } from '../../../domain/valueObjects/Coordinates';
import { CombinedHospitalDTO } from '../HospitalDTO';

/**
 * HospitalMapper
 * DTO (Data Transfer Object) → Domain Entity 변환
 *
 * Ironclad Law #2: Anti-Hallucination
 * - 실제 API 응답 필드만 사용 (존재하지 않는 필드 사용 금지)
 *
 * Ironclad Law #3: Edge Case Obsession
 * - 누락된 필드, 잘못된 형식, null 값 모두 처리
 */
export class HospitalMapper {
  /**
   * DTO → Domain Entity 변환
   */
  static toDomain(dto: CombinedHospitalDTO): Hospital | null {
    try {
      const { basicInfo, bedInfo } = dto;

      // 필수 필드 검증
      if (!basicInfo.hpid || !basicInfo.dutyName) {
        console.warn('Missing required fields (hpid or dutyName):', basicInfo);
        return null;
      }

      // 좌표 파싱 (없으면 null)
      // 참고: Geocoding으로 좌표를 보정할 예정이므로 일단 허용
      const coordinates = this.parseCoordinates(
        basicInfo.wgs84Lat,
        basicInfo.wgs84Lon
      );
      if (!coordinates) {
        console.warn(`⚠️ No valid coordinates for hospital: ${basicInfo.dutyName} (will attempt geocoding)`, {
          lat: basicInfo.wgs84Lat,
          lon: basicInfo.wgs84Lon,
        });
        // 좌표 없어도 일단 병원 객체는 생성 (Geocoding에서 보정 시도)
        // 단, 기본 좌표로 서울시청 사용
        const fallbackCoords = new Coordinates(37.5663, 126.9779);
        const fallbackHasCT = bedInfo?.hvctayn === 'Y';
        const fallbackHasMRI = bedInfo?.hvmriayn === 'Y';
        const fallbackHasSurgery = bedInfo?.hvoc ? parseInt(bedInfo.hvoc, 10) > 0 : false;
        return new Hospital(
          basicInfo.hpid,
          basicInfo.dutyName,
          fallbackCoords, // 임시 좌표
          basicInfo.dutyAddr || '주소 정보 없음',
          this.sanitizePhoneNumber(basicInfo.dutyTel1) || '전화번호 없음',
          this.sanitizePhoneNumber(basicInfo.dutyTel3),
          0, // availableBeds
          0, // totalBeds
          this.parseSpecializations(basicInfo),
          this.parseTraumaLevel(basicInfo.dutyEmcls),
          basicInfo.dutyEryn === '1',
          new Date(),
          fallbackHasCT,
          fallbackHasMRI,
          fallbackHasSurgery,
          undefined, // estimatedWaitTime
          undefined, // routeDuration
          undefined  // routeDistance
        );
      }

      // 병상 정보 파싱
      const { availableBeds, totalBeds } = this.parseBedInfo(bedInfo);

      // CT/MRI/수술 가용 여부 파싱
      const hasCT = bedInfo?.hvctayn === 'Y';
      const hasMRI = bedInfo?.hvmriayn === 'Y';
      const hasSurgery = bedInfo?.hvoc ? parseInt(bedInfo.hvoc, 10) > 0 : false;

      // 전화번호 정리 (공백, 하이픈 제거)
      const phoneNumber = this.sanitizePhoneNumber(basicInfo.dutyTel1) || this.sanitizePhoneNumber(basicInfo.dutyTel3);
      const emergencyPhoneNumber = this.sanitizePhoneNumber(basicInfo.dutyTel3);

      // 디버깅: 전화번호 확인 (처음 3개 병원만)
      if (Math.random() < 0.01) { // 1% 확률로 로그 출력 (너무 많은 로그 방지)
        console.log(`📞 [${basicInfo.dutyName}] 전화번호 파싱:`, {
          원본_대표전화: basicInfo.dutyTel1,
          원본_응급실전화: basicInfo.dutyTel3,
          정리된_대표전화: phoneNumber,
          정리된_응급실전화: emergencyPhoneNumber,
        });
      }

      // 응급실 운영 여부 (1=운영, 2=미운영, 기타=불명)
      const isOperating = basicInfo.dutyEryn === '1';

      // 전문 진료과 파싱 (MKioskTy 필드들)
      const specializations = this.parseSpecializations(basicInfo);

      // 외상센터 등급 (응급의료기관코드로 추론)
      const traumaLevel = this.parseTraumaLevel(basicInfo.dutyEmcls);

      // 마지막 갱신 시각 (병상 정보 입력일시)
      const lastUpdated = bedInfo?.hvidate
        ? new Date(bedInfo.hvidate)
        : new Date();

      return new Hospital(
        basicInfo.hpid,
        basicInfo.dutyName,
        coordinates,
        basicInfo.dutyAddr || '주소 정보 없음',
        phoneNumber || '전화번호 없음',
        emergencyPhoneNumber,
        availableBeds,
        totalBeds,
        specializations,
        traumaLevel,
        isOperating,
        lastUpdated,
        hasCT,
        hasMRI,
        hasSurgery,
        undefined, // estimatedWaitTime
        undefined, // routeDuration (will be calculated later)
        undefined  // routeDistance (will be calculated later)
      );

    } catch (error) {
      console.error('Failed to map DTO to Hospital entity:', error, dto);
      return null;
    }
  }

  /**
   * 여러 DTO를 Domain Entity 목록으로 변환 (null 제거)
   */
  static toDomainList(dtos: CombinedHospitalDTO[]): Hospital[] {
    return dtos
      .map((dto) => this.toDomain(dto))
      .filter((hospital): hospital is Hospital => hospital !== null);
  }

  /**
   * 좌표 파싱
   */
  private static parseCoordinates(
    lat?: string | number,
    lon?: string | number
  ): Coordinates | null {
    if (!lat || !lon) return null;

    const latitude = typeof lat === 'string' ? parseFloat(lat) : lat;
    const longitude = typeof lon === 'string' ? parseFloat(lon) : lon;

    if (isNaN(latitude) || isNaN(longitude)) {
      return null;
    }

    // 0 좌표 필터링 (유효하지 않은 데이터)
    if (latitude === 0 || longitude === 0) {
      return null;
    }

    // 유효 범위 체크 (한국 내 좌표)
    if (latitude < 33 || latitude > 39 || longitude < 124 || longitude > 132) {
      console.warn(`Coordinates out of Korea bounds: (${latitude}, ${longitude})`);
      return null;
    }

    try {
      return new Coordinates(latitude, longitude);
    } catch (error) {
      console.error('Invalid coordinates:', error);
      return null;
    }
  }

  /**
   * 병상 정보 파싱
   */
  private static parseBedInfo(bedInfo?: {
    hvec?: string; // 응급실병상수
    hvoc?: string; // 수술실병상수
    hvicc?: string; // 일반중환자병상수
  }): { availableBeds: number; totalBeds: number } {
    if (!bedInfo) {
      return { availableBeds: 0, totalBeds: 0 };
    }

    // 응급실 병상수 (문자열 → 숫자, 음수는 0으로 처리)
    const emergencyBeds = Math.max(0, parseInt(bedInfo.hvec || '0', 10) || 0);

    // 총 병상수 (응급실 + 중환자실, 음수는 0으로 처리)
    const icuBeds = Math.max(0, parseInt(bedInfo.hvicc || '0', 10) || 0);
    const totalBeds = emergencyBeds + icuBeds;

    // 가용 병상은 API에서 직접 제공하지 않으므로
    // 실제로는 별도 API 호출이 필요할 수 있음
    // 여기서는 전체의 30%를 가용으로 가정 (임시)
    // TODO: 실제 가용 병상 API 연동 필요
    // Math.max로 음수 방지 (API가 음수를 반환하는 경우 대비)
    const availableBeds = Math.max(0, Math.floor(totalBeds * 0.3));

    return { availableBeds, totalBeds };
  }

  /**
   * 전화번호 정리 (공백, 하이픈, 괄호 제거)
   */
  private static sanitizePhoneNumber(phone?: string): string | null {
    if (!phone || typeof phone !== 'string') return null;

    // 공백, 하이픈, 괄호 제거
    const cleaned = phone.replace(/[\s\-()]/g, '');

    // 빈 문자열 체크
    if (cleaned === '' || cleaned === '0' || cleaned === '-') return null;

    // 한국 전화번호 형식 검증 (더 관대하게)
    // - 0으로 시작하는 7~11자리 숫자 (지역번호 포함)
    // - 1588, 1577 등 대표번호
    // - 02, 031, 051 등 지역번호
    if (/^(0\d{6,10}|1[5-9]\d{2}\d{4})$/.test(cleaned)) {
      // 가독성을 위해 하이픈 추가
      return this.formatPhoneNumber(cleaned);
    }

    // 숫자만 포함하고 있고 7자리 이상이면 일단 유효한 것으로 간주
    if (/^\d{7,}$/.test(cleaned)) {
      return this.formatPhoneNumber(cleaned);
    }

    return null;
  }

  /**
   * 전화번호 포맷팅 (가독성 향상)
   */
  private static formatPhoneNumber(phone: string): string {
    // 02 지역번호 (서울)
    if (phone.startsWith('02')) {
      if (phone.length === 9) {
        return phone.replace(/^(\d{2})(\d{3})(\d{4})$/, '$1-$2-$3');
      } else if (phone.length === 10) {
        return phone.replace(/^(\d{2})(\d{4})(\d{4})$/, '$1-$2-$3');
      }
    }
    // 다른 지역번호 (031, 032, 051 등)
    else if (phone.startsWith('0')) {
      if (phone.length === 10) {
        return phone.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1-$2-$3');
      } else if (phone.length === 11) {
        return phone.replace(/^(\d{3})(\d{4})(\d{4})$/, '$1-$2-$3');
      }
    }
    // 1588, 1577 등 대표번호
    else if (phone.startsWith('1')) {
      if (phone.length === 8) {
        return phone.replace(/^(\d{4})(\d{4})$/, '$1-$2');
      }
    }

    // 포맷팅 실패시 원본 반환
    return phone;
  }

  /**
   * 전문 진료과 파싱
   * MKioskTy1~11 필드는 진료과 정보를 담고 있음
   */
  private static parseSpecializations(dto: {
    MKioskTy1?: string;
    MKioskTy2?: string;
    MKioskTy3?: string;
    MKioskTy4?: string;
    MKioskTy5?: string;
    MKioskTy6?: string;
    MKioskTy7?: string;
    MKioskTy8?: string;
    MKioskTy9?: string;
    MKioskTy10?: string;
    MKioskTy11?: string;
  }): Specialization[] {
    const specializations: Specialization[] = [];

    // MKioskTy 필드 매핑 (실제 API 문서 확인 필요)
    // 여기서는 예시로 일부만 매핑
    const mapping: Record<string, Specialization> = {
      '내과': '내과',
      '외과': '외과',
      '정형외과': '정형외과',
      '신경외과': '신경외과',
      '소아과': '소아과',
      '산부인과': '산부인과',
      '응급의학과': '응급의학과',
    };

    // 모든 MKioskTy 필드 검사
    Object.values(dto).forEach((value) => {
      if (typeof value === 'string' && value in mapping) {
        specializations.push(mapping[value]!);
      }
    });

    // 기본값: 응급의학과는 항상 포함
    if (!specializations.includes('응급의학과')) {
      specializations.push('응급의학과');
    }

    return specializations;
  }

  /**
   * 외상센터 등급 파싱
   * 응급의료기관코드 (dutyEmcls) 기반 추론
   */
  private static parseTraumaLevel(dutyEmcls?: string): TraumaLevel {
    if (!dutyEmcls) return null;

    // 응급의료기관코드 매핑 (실제 코드 확인 필요)
    // A: 권역응급의료센터 (Level 1)
    // B: 지역응급의료센터 (Level 2)
    // C: 지역응급의료기관 (Level 3)
    if (dutyEmcls.startsWith('A')) return 1;
    if (dutyEmcls.startsWith('B')) return 2;
    if (dutyEmcls.startsWith('C')) return 3;

    return null;
  }
}
