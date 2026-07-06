import { SupabaseClient } from '@supabase/supabase-js';

export interface HospitalSpecialtyData {
  hpid: string;
  hospital_name: string;
  specialties: string[];
  confidence_score: number;
  inferred_from: string;
}

/**
 * 분석된 전문 분야 데이터를 Supabase 데이터베이스에 업서트(삽입 또는 업데이트)합니다.
 */
export async function updateHospitalSpecialties(
  supabase: SupabaseClient, 
  data: HospitalSpecialtyData
): Promise<void> {
  const { error } = await supabase
    .from('hospital_specialties')
    .upsert(
      {
        hpid: data.hpid,
        hospital_name: data.hospital_name,
        specialties: data.specialties,
        confidence_score: data.confidence_score,
        inferred_from: data.inferred_from,
        last_updated_at: new Date().toISOString()
      },
      { onConflict: 'hpid' }
    );

  if (error) {
    if (error.message.includes('relation "hospital_specialties" does not exist')) {
      console.warn(`⚠️ [DB Warning] 'hospital_specialties' 테이블이 아직 생성되지 않았습니다. 데이터를 저장하지 않고 건너뜁니다.`);
    } else {
      console.error(`❌ Supabase Upsert 실패: ${error.message}`);
    }
  }
}
