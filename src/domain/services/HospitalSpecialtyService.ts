import { Hospital } from '../entities/Hospital';
import { supabase, supabaseOptionalFeaturesEnabled } from '../../infrastructure/supabase/supabaseClient';

/**
 * AI 크롤러(scripts/ai-crawler)가 수집해 둔 병원별 특화 분야를 읽는다.
 *
 * 여기서 다루는 값은 공개 자료에서 추출한 참고 정보이지 진료 역량의 증명이
 * 아니다. 따라서 병원 순위나 추천에는 쓰지 않고, 출처와 신뢰도를 함께 노출해
 * 표시 용도로만 사용한다.
 */

export interface HospitalSpecialtyInfo {
  specialties: string[];
  /** 0~100. 크롤러가 기록하지 않았으면 null */
  confidenceScore: number | null;
  /** 'ai_crawler' | 'no_data' | 'ai_empty' 등 크롤러가 남긴 출처 */
  inferredFrom: string;
}

interface SpecialtyRow {
  hpid: string;
  specialties: string[] | null;
  confidence_score: number | null;
  inferred_from: string | null;
}

export class HospitalSpecialtyService {
  private static byHpid = new Map<string, HospitalSpecialtyInfo>();
  private static loaded = false;

  /**
   * 특화 분야를 한 번 불러와 메모리에 캐싱한다.
   * Supabase 선택 기능이 꺼져 있으면 아무것도 하지 않는다.
   */
  static async load(): Promise<void> {
    if (this.loaded || !supabaseOptionalFeaturesEnabled) return;

    const { data, error } = await supabase
      .from('hospital_specialties')
      .select('hpid, specialties, confidence_score, inferred_from');

    if (error) {
      console.warn('병원 특화 분야를 불러오지 못했습니다:', error.message);
      return;
    }

    for (const row of (data ?? []) as SpecialtyRow[]) {
      if (!row.hpid) continue;

      const specialties = (row.specialties ?? []).filter((s) => typeof s === 'string' && s.trim() !== '');
      // 크롤러는 수집 실패도 빈 값으로 기록한다(negative cache). 표시할 게 없으므로 담지 않는다.
      if (specialties.length === 0) continue;

      this.byHpid.set(row.hpid, {
        specialties,
        confidenceScore: typeof row.confidence_score === 'number' ? row.confidence_score : null,
        inferredFrom: row.inferred_from ?? 'unknown',
      });
    }

    this.loaded = true;
  }

  /**
   * 수집된 특화 분야를 반환한다. 병원 이름에서 추론하지 않는다.
   *
   * 이름에 '뇌'가 들어간다고 뇌졸중을 다룬다고 볼 수 없고, '대학'이 들어간다고
   * 중환자의학 역량을 보장할 수 없다. 응급 상황에서 근거 없는 임상적 주장은
   * 정보가 없는 것보다 나쁘다.
   */
  static getSpecialtyInfo(hospital: Hospital): HospitalSpecialtyInfo | null {
    return this.byHpid.get(hospital.id) ?? null;
  }

  static getSpecialties(hospital: Hospital): string[] {
    return this.getSpecialtyInfo(hospital)?.specialties ?? [];
  }

  /**
   * 수집된 특화 분야 중 해당 질환과 일치하는 것이 있는지 확인한다.
   * 표기 차이를 흡수하되, 양방향 부분일치처럼 느슨하게 보지는 않는다.
   */
  static hasSpecialtyMatch(hospital: Hospital, targetDisease: string): boolean {
    const normalized = this.normalize(targetDisease);
    if (!normalized) return false;

    return this.getSpecialties(hospital).some((specialty) => this.normalize(specialty) === normalized);
  }

  /** 테스트와 로그아웃 등으로 캐시를 비울 때 사용한다. */
  static reset(): void {
    this.byHpid.clear();
    this.loaded = false;
  }

  private static normalize(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, '');
  }
}
