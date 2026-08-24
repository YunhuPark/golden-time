import { Hospital, Specialization, TraumaLevel } from '../../../domain/entities/Hospital';
import { Coordinates } from '../../../domain/valueObjects/Coordinates';
import { CombinedHospitalDTO } from '../HospitalDTO';

export class HospitalMapper {
  static toDomain(dto: CombinedHospitalDTO): Hospital | null {
    try {
      const { basicInfo, bedInfo } = dto;
      if (!basicInfo.hpid || !basicInfo.dutyName) return null;

      const coordinates = this.parseCoordinates(basicInfo.wgs84Lat, basicInfo.wgs84Lon)
        ?? new Coordinates(37.5663, 126.9779);

      const resources = this.parseBedInfo(bedInfo);
      const hasCT = bedInfo?.hvctayn === 'Y';
      const hasMRI = bedInfo?.hvmriayn === 'Y';
      const hasSurgery = this.toCount(bedInfo?.hvoc) > 0;
      const phoneNumber = this.sanitizePhoneNumber(basicInfo.dutyTel1)
        || this.sanitizePhoneNumber(basicInfo.dutyTel3)
        || '전화번호 없음';
      const emergencyPhoneNumber = this.sanitizePhoneNumber(basicInfo.dutyTel3);
      const isOperating = basicInfo.dutyEryn === '1';
      const specializations = this.parseSpecializations(basicInfo);
      const traumaLevel = this.parseTraumaLevel(basicInfo.dutyEmcls);
      const lastUpdated = bedInfo?.hvidate ? new Date(bedInfo.hvidate) : new Date();

      return new Hospital(
        basicInfo.hpid,
        basicInfo.dutyName,
        coordinates,
        basicInfo.dutyAddr || '주소 정보 없음',
        phoneNumber,
        emergencyPhoneNumber,
        resources.emergencyAvailableBeds,
        resources.emergencyAvailableBeds, // legacy compatibility only
        specializations,
        traumaLevel,
        isOperating,
        lastUpdated,
        hasCT,
        hasMRI,
        hasSurgery,
        undefined,
        undefined,
        undefined,
        resources.icuAvailableBeds,
        resources.neuroIcuAvailableBeds
      );
    } catch (error) {
      console.error('Failed to map DTO to Hospital entity:', error, dto);
      return null;
    }
  }

  static toDomainList(dtos: CombinedHospitalDTO[]): Hospital[] {
    return dtos.map(dto => this.toDomain(dto)).filter((h): h is Hospital => h !== null);
  }

  private static parseCoordinates(lat?: string | number, lon?: string | number): Coordinates | null {
    if (!lat || !lon) return null;
    const latitude = typeof lat === 'string' ? parseFloat(lat) : lat;
    const longitude = typeof lon === 'string' ? parseFloat(lon) : lon;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    if (latitude === 0 || longitude === 0) return null;
    if (latitude < 33 || latitude > 39 || longitude < 124 || longitude > 132) return null;
    try {
      return new Coordinates(latitude, longitude);
    } catch {
      return null;
    }
  }

  private static toCount(value?: string): number {
    const parsed = parseInt(value || '0', 10);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }

  /**
   * getEmrrmRltmUsefulSckbdInfoInqire 응답의 hvec/hvicc/hvcc는
   * 실시간 가용 자원 수치이므로 임의 비율로 다시 추정하지 않습니다.
   */
  private static parseBedInfo(bedInfo?: {
    hvec?: string;
    hvicc?: string;
    hvcc?: string;
  }): {
    emergencyAvailableBeds: number;
    icuAvailableBeds: number;
    neuroIcuAvailableBeds: number;
  } {
    return {
      emergencyAvailableBeds: this.toCount(bedInfo?.hvec),
      icuAvailableBeds: this.toCount(bedInfo?.hvicc),
      neuroIcuAvailableBeds: this.toCount(bedInfo?.hvcc),
    };
  }

  private static sanitizePhoneNumber(phone?: string): string | null {
    if (!phone || typeof phone !== 'string') return null;
    const cleaned = phone.replace(/[\s\-()]/g, '');
    if (!cleaned || cleaned === '0' || cleaned === '-') return null;
    if (/^\d{7,}$/.test(cleaned)) return this.formatPhoneNumber(cleaned);
    return null;
  }

  private static formatPhoneNumber(phone: string): string {
    if (phone.startsWith('02')) {
      if (phone.length === 9) return phone.replace(/^(\d{2})(\d{3})(\d{4})$/, '$1-$2-$3');
      if (phone.length === 10) return phone.replace(/^(\d{2})(\d{4})(\d{4})$/, '$1-$2-$3');
    } else if (phone.startsWith('0')) {
      if (phone.length === 10) return phone.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1-$2-$3');
      if (phone.length === 11) return phone.replace(/^(\d{3})(\d{4})(\d{4})$/, '$1-$2-$3');
    } else if (phone.startsWith('1') && phone.length === 8) {
      return phone.replace(/^(\d{4})(\d{4})$/, '$1-$2');
    }
    return phone;
  }

  private static parseSpecializations(dto: {
    MKioskTy1?: string; MKioskTy2?: string; MKioskTy3?: string; MKioskTy4?: string;
    MKioskTy5?: string; MKioskTy6?: string; MKioskTy7?: string; MKioskTy8?: string;
    MKioskTy9?: string; MKioskTy10?: string; MKioskTy11?: string;
  }): Specialization[] {
    const mapping: Record<string, Specialization> = {
      '내과': '내과', '외과': '외과', '정형외과': '정형외과', '신경외과': '신경외과',
      '신경과': '신경과', '소아과': '소아과', '산부인과': '산부인과', '응급의학과': '응급의학과',
    };
    const values = Object.values(dto).filter((v): v is string => typeof v === 'string');
    return Array.from(new Set(values.filter(v => v in mapping).map(v => mapping[v]!)));
  }

  private static parseTraumaLevel(dutyEmcls?: string): TraumaLevel {
    if (!dutyEmcls) return null;
    if (dutyEmcls.startsWith('A')) return 1;
    if (dutyEmcls.startsWith('B')) return 2;
    if (dutyEmcls.startsWith('C')) return 3;
    return null;
  }
}
