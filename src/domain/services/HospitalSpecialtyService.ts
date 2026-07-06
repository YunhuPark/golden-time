import { Hospital } from '../entities/Hospital';

import { supabase } from '../../infrastructure/supabase/supabaseClient';

/**
 * 전국의 병원 전문/강점 분야를 매핑하는 DB 및 추론 엔진
 */
export class HospitalSpecialtyService {
  // Supabase에서 불러온 병원별 특화 분야 캐시
  private static dbSpecialties: Record<string, string[]> = {};
  private static isLoaded = false;

  /**
   * Supabase에서 전체 병원 특화 정보를 한 번 로드하여 메모리에 캐싱합니다.
   */
  static async loadSpecialtiesFromDB(): Promise<void> {
    if (this.isLoaded) return;

    try {
      const { data, error } = await supabase
        .from('hospital_specialties')
        .select('hospital_name, specialties');

      if (error) {
        console.error('Failed to load hospital specialties from Supabase:', error);
        return;
      }

      if (data) {
        data.forEach((row) => {
          this.dbSpecialties[row.hospital_name] = row.specialties;
        });
      }
      
      this.isLoaded = true;
      console.log(`✅ Loaded ${data?.length || 0} hospital specialties from DB`);
    } catch (err) {
      console.error('Exception loading hospital specialties:', err);
    }
  }

  /**
   * 특정 병원의 전문/강점 분야를 반환합니다.
   * 1. DB에 매칭되는 병원이 있으면 해당 강점을 반환
   * 2. 없으면 병원 이름과 메타데이터를 분석하여 Heuristic하게 추론(Fallback)
   */
  static getSpecialties(hospital: Hospital): string[] {
    // 1. DB 매칭 (정확한 이름 또는 포함하는 이름)
    for (const [dbName, specialties] of Object.entries(this.dbSpecialties)) {
      if (hospital.name.includes(dbName)) {
        return specialties;
      }
    }

    // 2. Heuristic 추론 엔진 (DB에 없는 타 지역 병원일 경우)
    const inferredSpecialties: string[] = [];
    const name = hospital.name;

    // 대형 대학병원급은 중증 질환 전반에 강점이 있다고 추론
    if (name.includes('대학교') || name.includes('국립')) {
      inferredSpecialties.push('패혈증', '호흡곤란증후군', '중환자의학');
    }

    // 이름에 특정 키워드가 포함된 전문 병원 추론
    if (name.includes('심혈관') || name.includes('심장')) {
      inferredSpecialties.push('심근경색', '심혈관');
    }
    if (name.includes('뇌') || name.includes('신경')) {
      inferredSpecialties.push('뇌졸중', '뇌종양');
    }

    // 권역외상센터나 권역응급의료센터인 경우 (traumaLevel이 1 또는 2)
    if (hospital.traumaLevel === 1) {
      inferredSpecialties.push('중증외상', '저혈량성 쇼크', '출혈성 쇼크');
    }

    // 아무것도 매칭되지 않으면 빈 배열 반환
    return inferredSpecialties;
  }

  /**
   * 환자의 질환(targetDisease)이 해당 병원의 강점(Specialty)과 일치하는지 확인합니다.
   */
  static hasSpecialtyMatch(hospital: Hospital, targetDisease: string): boolean {
    if (!targetDisease) return false;
    
    const specialties = this.getSpecialties(hospital);
    
    // 타겟 질환에 특화 분야 키워드가 포함되어 있는지 검사 (예: targetDisease="패혈증 (Sepsis)")
    return specialties.some(specialty => 
      targetDisease.toLowerCase().includes(specialty.toLowerCase()) || 
      specialty.toLowerCase().includes(targetDisease.toLowerCase())
    );
  }
}
