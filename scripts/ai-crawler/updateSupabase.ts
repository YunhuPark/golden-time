import { SupabaseClient } from '@supabase/supabase-js';
import { withRetry, TIMEOUTS } from './utils';

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
  await withRetry(async () => {
    // Supabase JS 클라이언트는 자체적으로 fetch를 사용합니다. AbortController를 이용한 타임아웃 구현
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUTS.SUPABASE);

    try {
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
        )
        .abortSignal(controller.signal);

      if (error) {
        if (error.message.includes('relation "hospital_specialties" does not exist')) {
          console.warn(`⚠️ [DB Warning] 'hospital_specialties' 테이블이 아직 생성되지 않았습니다. 데이터를 저장하지 않고 건너뜁니다.`);
          return; // 이 경우는 재시도하지 않음
        }
        // 에러를 throw하여 withRetry 로직이나 상위 함수에서 처리하도록 함
        throw error;
      }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        throw new Error('Supabase request timed out');
      }
      throw e;
    } finally {
      clearTimeout(timeoutId);
    }
  });
}
