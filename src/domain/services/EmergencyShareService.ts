import { supabase } from '../../infrastructure/supabase/supabaseClient';
import { MedicalProfile } from './MedicalProfileService';

// EmergencyShareData는 MedicalProfile을 사용
export type EmergencyShareData = MedicalProfile;

export interface EmergencyShare {
  id: string;
  shareToken: string;
  medicalData: EmergencyShareData;
  expiresAt: string;
  viewCount: number;
  createdAt: string;
}

/**
 * EmergencyShareService
 * 응급 의료 정보 공유 서비스
 */
export class EmergencyShareService {
  /**
   * 응급 공유 토큰 생성
   */
  static async createShare(
    userId: string,
    medicalData: EmergencyShareData
  ): Promise<{ success: boolean; shareToken?: string; error?: string }> {
    try {
      // 토큰 생성 (UUID v4)
      const shareToken = crypto.randomUUID();

      // 만료 시간 (24시간 후)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const { error } = await supabase
        .from('emergency_shares')
        .insert({
          user_id: userId,
          share_token: shareToken,
          medical_data: medicalData,
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to create emergency share:', error);
        return { success: false, error: error.message };
      }

      return { success: true, shareToken };
    } catch (err) {
      console.error('Error creating emergency share:', err);
      return { success: false, error: String(err) };
    }
  }

  /**
   * 토큰으로 의료 정보 조회
   */
  static async getShareByToken(
    shareToken: string
  ): Promise<{ success: boolean; data?: EmergencyShare; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('emergency_shares')
        .select('*')
        .eq('share_token', shareToken)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error) {
        console.error('Failed to get emergency share:', error);
        return { success: false, error: error.message };
      }

      if (!data) {
        return { success: false, error: 'Share not found or expired' };
      }

      // 조회 횟수 증가
      await supabase
        .from('emergency_shares')
        .update({ view_count: (data.view_count || 0) + 1 })
        .eq('id', data.id);

      return {
        success: true,
        data: {
          id: data.id,
          shareToken: data.share_token,
          medicalData: data.medical_data,
          expiresAt: data.expires_at,
          viewCount: data.view_count || 0,
          createdAt: data.created_at,
        },
      };
    } catch (err) {
      console.error('Error getting emergency share:', err);
      return { success: false, error: String(err) };
    }
  }

  /**
   * 사용자의 활성 공유 목록 조회
   */
  static async getActiveShares(
    userId: string
  ): Promise<{ success: boolean; shares?: EmergencyShare[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('emergency_shares')
        .select('*')
        .eq('user_id', userId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to get active shares:', error);
        return { success: false, error: error.message };
      }

      const shares = (data || []).map((item) => ({
        id: item.id,
        shareToken: item.share_token,
        medicalData: item.medical_data,
        expiresAt: item.expires_at,
        viewCount: item.view_count || 0,
        createdAt: item.created_at,
      }));

      return { success: true, shares };
    } catch (err) {
      console.error('Error getting active shares:', err);
      return { success: false, error: String(err) };
    }
  }

  /**
   * 공유 삭제
   */
  static async deleteShare(
    shareId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('emergency_shares')
        .delete()
        .eq('id', shareId);

      if (error) {
        console.error('Failed to delete emergency share:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      console.error('Error deleting emergency share:', err);
      return { success: false, error: String(err) };
    }
  }

  /**
   * 만료된 공유 정리
   */
  static async cleanupExpiredShares(
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('emergency_shares')
        .delete()
        .eq('user_id', userId)
        .lt('expires_at', new Date().toISOString());

      if (error) {
        console.error('Failed to cleanup expired shares:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      console.error('Error cleaning up expired shares:', err);
      return { success: false, error: String(err) };
    }
  }
}
