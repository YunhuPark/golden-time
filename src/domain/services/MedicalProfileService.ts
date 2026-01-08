/**
 * MedicalProfileService
 * 사용자의 의료 정보를 암호화하여 Supabase에 안전하게 저장/조회
 *
 * CRITICAL: 모든 의료 정보는 암호화 후 저장 (Ironclad Law #3: Security)
 */

import { supabase } from '../../infrastructure/supabase/supabaseClient';
import { encryptObject, decryptObject } from '../../infrastructure/utils/encryption';

/**
 * 의료 프로필 데이터 (평문)
 */
export interface MedicalProfile extends Record<string, unknown> {
  // 기본 정보
  bloodType?: string; // 혈액형 (A+, B-, O+, AB- 등)
  height?: number; // 키 (cm)
  weight?: number; // 몸무게 (kg)

  // 알레르기 정보
  allergies?: string[]; // 알레르기 목록 (예: ['페니실린', '땅콩', '새우'])

  // 기저 질환
  chronicDiseases?: string[]; // 만성 질환 (예: ['고혈압', '당뇨병'])

  // 복용 중인 약물
  medications?: string[]; // 현재 복용 약물 (예: ['아스피린 100mg'])

  // 과거 수술 이력
  surgeries?: string[]; // 수술 이력 (예: ['2022-03-15 맹장 절제술'])

  // 응급 연락처
  emergencyContacts?: Array<{
    name: string;
    relationship: string; // 관계 (예: '부모', '배우자')
    phone: string;
  }>;

  // 추가 메모
  notes?: string; // 의료진에게 전달할 특이사항
}

/**
 * DB에 저장된 암호화된 프로필 (Supabase Row)
 */
export interface EncryptedMedicalProfileRow {
  id: string;
  user_id: string;
  encrypted_data: string;
  encryption_version: number;
  created_at: string;
  updated_at: string;
}

/**
 * MedicalProfileService 클래스
 */
export class MedicalProfileService {
  /**
   * 의료 프로필 저장 (Upsert: 없으면 생성, 있으면 업데이트)
   */
  static async saveMedicalProfile(
    userId: string,
    profile: MedicalProfile
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // 1. 의료 정보 암호화
      const encryptedData = await encryptObject(profile);

      // 2. Supabase에 저장 (Upsert)
      const { error } = await supabase
        .from('medical_profiles')
        .upsert(
          {
            user_id: userId,
            encrypted_data: encryptedData,
            encryption_version: 1,
          },
          {
            onConflict: 'user_id', // user_id가 중복되면 업데이트
          }
        );

      if (error) {
        console.error('Failed to save medical profile:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Medical profile saved successfully');
      return { success: true };

    } catch (error) {
      console.error('Encryption or save failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 의료 프로필 조회
   */
  static async getMedicalProfile(
    userId: string
  ): Promise<{ profile: MedicalProfile | null; error?: string }> {
    try {
      // 1. Supabase에서 암호화된 데이터 조회
      const { data, error } = await supabase
        .from('medical_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        // 데이터가 없는 경우 (아직 프로필 생성 안함)
        if (error.code === 'PGRST116') {
          return { profile: null };
        }
        console.error('Failed to fetch medical profile:', error);
        return { profile: null, error: error.message };
      }

      if (!data) {
        return { profile: null };
      }

      // 2. 복호화
      const row = data as EncryptedMedicalProfileRow;
      const profile = await decryptObject<MedicalProfile>(row.encrypted_data);

      return { profile };

    } catch (error) {
      console.error('Decryption or fetch failed:', error);
      return {
        profile: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 의료 프로필 삭제
   */
  static async deleteMedicalProfile(
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('medical_profiles')
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.error('Failed to delete medical profile:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Medical profile deleted successfully');
      return { success: true };

    } catch (error) {
      console.error('Delete failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 의료 프로필 존재 여부 확인
   */
  static async hasMedicalProfile(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('medical_profiles')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Failed to check medical profile:', error);
        return false;
      }

      return !!data;

    } catch (error) {
      console.error('Check failed:', error);
      return false;
    }
  }

  /**
   * 응급 상황용: 의료 정보 요약 (평문)
   * 응급 의료진에게 즉시 제공할 수 있는 핵심 정보만 추출
   */
  static async getEmergencySummary(
    userId: string
  ): Promise<{ summary: string | null; error?: string }> {
    try {
      const { profile, error } = await this.getMedicalProfile(userId);

      if (error || !profile) {
        return { summary: null, error };
      }

      // 응급 상황에서 중요한 정보만 추출
      const criticalInfo: string[] = [];

      if (profile.bloodType) {
        criticalInfo.push(`🩸 혈액형: ${profile.bloodType}`);
      }

      if (profile.allergies && profile.allergies.length > 0) {
        criticalInfo.push(`⚠️ 알레르기: ${profile.allergies.join(', ')}`);
      }

      if (profile.chronicDiseases && profile.chronicDiseases.length > 0) {
        criticalInfo.push(`💊 기저질환: ${profile.chronicDiseases.join(', ')}`);
      }

      if (profile.medications && profile.medications.length > 0) {
        criticalInfo.push(`💉 복용약: ${profile.medications.join(', ')}`);
      }

      if (profile.emergencyContacts && profile.emergencyContacts.length > 0) {
        const contacts = profile.emergencyContacts
          .map((c) => `${c.name} (${c.relationship}): ${c.phone}`)
          .join(' / ');
        criticalInfo.push(`📞 응급연락처: ${contacts}`);
      }

      if (profile.notes) {
        criticalInfo.push(`📝 특이사항: ${profile.notes}`);
      }

      const summary = criticalInfo.length > 0
        ? criticalInfo.join('\n')
        : '등록된 의료 정보가 없습니다.';

      return { summary };

    } catch (error) {
      console.error('Failed to generate emergency summary:', error);
      return {
        summary: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * getProfile 메서드 (getMedicalProfile의 별칭)
   * EmergencyShareService에서 사용
   */
  static async getProfile(
    userId: string
  ): Promise<{ profile: MedicalProfile | null; error?: string }> {
    return this.getMedicalProfile(userId);
  }
}
