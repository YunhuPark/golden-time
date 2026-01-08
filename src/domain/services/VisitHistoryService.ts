/**
 * VisitHistoryService
 * 병원 방문 기록 관리 서비스
 *
 * 사용자의 병원 방문 이력을 추적하여:
 * - 자주 가는 병원 파악
 * - 방문 이력 조회
 * - 통계 및 분석
 */

import { supabase } from '../../infrastructure/supabase/supabaseClient';

/**
 * 병원 방문 기록
 */
export interface VisitHistory {
  id: string;
  userId: string;
  hospitalId: string;
  hospitalName: string;
  hospitalAddress: string;
  visitDate: Date;
  visitReason?: string; // 방문 사유 (선택)
  notes?: string; // 메모 (선택)
  createdAt: Date;
}

/**
 * DB Row 타입 (Supabase)
 */
interface VisitHistoryRow {
  id: string;
  user_id: string;
  hospital_id: string;
  hospital_name: string;
  hospital_address: string;
  visit_date: string; // ISO 8601 timestamp
  visit_reason?: string;
  notes?: string;
  created_at: string;
}

/**
 * 방문 통계
 */
export interface VisitStatistics {
  totalVisits: number;
  uniqueHospitals: number;
  mostVisitedHospital: {
    hospitalId: string;
    hospitalName: string;
    visitCount: number;
  } | null;
  recentVisits: VisitHistory[]; // 최근 5개
}

/**
 * VisitHistoryService 클래스
 */
export class VisitHistoryService {
  /**
   * 방문 기록 추가
   */
  static async addVisit(params: {
    userId: string;
    hospitalId: string;
    hospitalName: string;
    hospitalAddress: string;
    visitDate?: Date; // 기본값: 현재 시각
    visitReason?: string;
    notes?: string;
  }): Promise<{ success: boolean; visitId?: string; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('visit_history')
        .insert({
          user_id: params.userId,
          hospital_id: params.hospitalId,
          hospital_name: params.hospitalName,
          hospital_address: params.hospitalAddress,
          visit_date: params.visitDate?.toISOString() || new Date().toISOString(),
          visit_reason: params.visitReason,
          notes: params.notes,
        })
        .select('id')
        .single();

      if (error) {
        console.error('Failed to add visit history:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Visit history added successfully');
      return { success: true, visitId: data.id };

    } catch (error) {
      console.error('Add visit failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 사용자의 모든 방문 기록 조회 (최신순)
   */
  static async getVisitHistory(
    userId: string,
    limit = 50
  ): Promise<{ visits: VisitHistory[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('visit_history')
        .select('*')
        .eq('user_id', userId)
        .order('visit_date', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Failed to fetch visit history:', error);
        return { visits: [], error: error.message };
      }

      const visits: VisitHistory[] = (data as VisitHistoryRow[]).map((row) => ({
        id: row.id,
        userId: row.user_id,
        hospitalId: row.hospital_id,
        hospitalName: row.hospital_name,
        hospitalAddress: row.hospital_address,
        visitDate: new Date(row.visit_date),
        visitReason: row.visit_reason,
        notes: row.notes,
        createdAt: new Date(row.created_at),
      }));

      return { visits };

    } catch (error) {
      console.error('Fetch visit history failed:', error);
      return {
        visits: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 특정 병원에 대한 방문 기록 조회
   */
  static async getVisitsByHospital(
    userId: string,
    hospitalId: string
  ): Promise<{ visits: VisitHistory[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('visit_history')
        .select('*')
        .eq('user_id', userId)
        .eq('hospital_id', hospitalId)
        .order('visit_date', { ascending: false });

      if (error) {
        console.error('Failed to fetch hospital visits:', error);
        return { visits: [], error: error.message };
      }

      const visits: VisitHistory[] = (data as VisitHistoryRow[]).map((row) => ({
        id: row.id,
        userId: row.user_id,
        hospitalId: row.hospital_id,
        hospitalName: row.hospital_name,
        hospitalAddress: row.hospital_address,
        visitDate: new Date(row.visit_date),
        visitReason: row.visit_reason,
        notes: row.notes,
        createdAt: new Date(row.created_at),
      }));

      return { visits };

    } catch (error) {
      console.error('Fetch hospital visits failed:', error);
      return {
        visits: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 방문 기록 수정
   */
  static async updateVisit(
    visitId: string,
    updates: {
      visitReason?: string;
      notes?: string;
      visitDate?: Date;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const updateData: Record<string, unknown> = {};
      if (updates.visitReason !== undefined) updateData['visit_reason'] = updates.visitReason;
      if (updates.notes !== undefined) updateData['notes'] = updates.notes;
      if (updates.visitDate) updateData['visit_date'] = updates.visitDate.toISOString();

      const { error } = await supabase
        .from('visit_history')
        .update(updateData)
        .eq('id', visitId);

      if (error) {
        console.error('Failed to update visit:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Visit updated successfully');
      return { success: true };

    } catch (error) {
      console.error('Update visit failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 방문 기록 삭제
   */
  static async deleteVisit(visitId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('visit_history')
        .delete()
        .eq('id', visitId);

      if (error) {
        console.error('Failed to delete visit:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Visit deleted successfully');
      return { success: true };

    } catch (error) {
      console.error('Delete visit failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 방문 통계 조회
   */
  static async getVisitStatistics(
    userId: string
  ): Promise<{ statistics: VisitStatistics | null; error?: string }> {
    try {
      // 1. 전체 방문 기록 조회
      const { visits, error } = await this.getVisitHistory(userId, 1000);

      if (error) {
        return { statistics: null, error };
      }

      if (visits.length === 0) {
        return {
          statistics: {
            totalVisits: 0,
            uniqueHospitals: 0,
            mostVisitedHospital: null,
            recentVisits: [],
          },
        };
      }

      // 2. 병원별 방문 횟수 계산
      const hospitalVisitCounts = new Map<string, { name: string; count: number }>();

      visits.forEach((visit) => {
        const current = hospitalVisitCounts.get(visit.hospitalId);
        if (current) {
          current.count += 1;
        } else {
          hospitalVisitCounts.set(visit.hospitalId, {
            name: visit.hospitalName,
            count: 1,
          });
        }
      });

      // 3. 가장 많이 방문한 병원 찾기
      let mostVisited: { hospitalId: string; hospitalName: string; visitCount: number } | null = null;
      let maxCount = 0;

      hospitalVisitCounts.forEach((value, hospitalId) => {
        if (value.count > maxCount) {
          maxCount = value.count;
          mostVisited = {
            hospitalId,
            hospitalName: value.name,
            visitCount: value.count,
          };
        }
      });

      // 4. 최근 5개 방문 기록
      const recentVisits = visits.slice(0, 5);

      // 5. 통계 반환
      const statistics: VisitStatistics = {
        totalVisits: visits.length,
        uniqueHospitals: hospitalVisitCounts.size,
        mostVisitedHospital: mostVisited,
        recentVisits,
      };

      return { statistics };

    } catch (error) {
      console.error('Get visit statistics failed:', error);
      return {
        statistics: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 해당 병원을 방문한 적이 있는지 확인
   */
  static async hasVisitedHospital(
    userId: string,
    hospitalId: string
  ): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('visit_history')
        .select('id')
        .eq('user_id', userId)
        .eq('hospital_id', hospitalId)
        .limit(1);

      if (error) {
        console.error('Failed to check hospital visit:', error);
        return false;
      }

      return data && data.length > 0;

    } catch (error) {
      console.error('Check hospital visit failed:', error);
      return false;
    }
  }

  /**
   * 마지막 방문 날짜 조회
   */
  static async getLastVisitDate(
    userId: string,
    hospitalId: string
  ): Promise<{ lastVisit: Date | null; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('visit_history')
        .select('visit_date')
        .eq('user_id', userId)
        .eq('hospital_id', hospitalId)
        .order('visit_date', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        // 방문 기록 없음
        if (error.code === 'PGRST116') {
          return { lastVisit: null };
        }
        console.error('Failed to get last visit date:', error);
        return { lastVisit: null, error: error.message };
      }

      const row = data as { visit_date: string };
      return { lastVisit: new Date(row.visit_date) };

    } catch (error) {
      console.error('Get last visit date failed:', error);
      return {
        lastVisit: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
