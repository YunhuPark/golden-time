import { Hospital } from '../entities/Hospital';
import { supabase } from '../../infrastructure/supabase/supabaseClient';
import { normalizeDisease } from '../types/DiseaseTaxonomy';

export interface SpecialtyData {
  hpid: string;
  hospital_name: string;
  specialties: string[];
  confidence_score: number;
  inferred_from: string;
  last_updated_at: string;
}

/**
 * ?�국??병원 ?�문/강점 분야�?매핑?�는 DB ?�비?? */
export class HospitalSpecialtyService {
  private static dbSpecialtiesByHpid: Record<string, SpecialtyData> = {};
  private static dbSpecialtiesByName: Record<string, SpecialtyData[]> = {};
  private static isLoaded = false;

  /**
   * ?�체 병원 ?�는 주어�?병원 목록???�???�화 ?�보�?로드?�여 메모리에 캐싱?�니??
   * (N+1 방�?: ?�체�???번에 조회?�거??in 쿼리 ?�용)
   */
  static async loadSpecialtiesForHospitals(hpids: string[]): Promise<void> {
    if (this.isLoaded) return;

    // Chunk ?�위 처리�??�구받았?�나, ?�체 ?�이?��? ?�다�??�번??로드.
    // ?�용?��? '�?�� ?�위 in 쿼리'�??�구?�으므�?�?�� ?�위�?조회?�니??
    try {
      const CHUNK_SIZE = 100;
      for (let i = 0; i < hpids.length; i += CHUNK_SIZE) {
        const chunk = hpids.slice(i, i + CHUNK_SIZE);
        const { data, error } = await supabase
          .from('hospital_specialties')
          .select('hpid, hospital_name, specialties, confidence_score, inferred_from, last_updated_at')
          .in('hpid', chunk);

        if (error) {
          console.error('Failed to load hospital specialties from Supabase:', error);
          continue;
        }

        if (data) {
          data.forEach((row: SpecialtyData) => {
            if (row.hpid) {
              this.dbSpecialtiesByHpid[row.hpid] = row;
            }

            // hpid 매칭 ?�패 ?��??�름 기반 보조 매핑 (Fallback)
            // ?�름?� ?�전 ?�규?�하???�??
            if (row.hospital_name) {
              const normName = this.normalizeHospitalName(row.hospital_name);
              if (!this.dbSpecialtiesByName[normName]) {
                this.dbSpecialtiesByName[normName] = [];
              }
              this.dbSpecialtiesByName[normName].push(row);
            }
          });
        }
      }

      this.isLoaded = true;
      console.log(`??Loaded hospital specialties from DB in chunks`);
    } catch (err) {
      console.error('Exception loading hospital specialties:', err);
    }
  }

  /**
   * 병원�??�전 ?�규??(모든 공백 ?�거, ?�문?�화)
   */
  private static normalizeHospitalName(name: string): string {
    return name.replace(/\s+/g, '').toLowerCase();
  }

  /**
   * 주어�?Hospital ?�스?�스???�??DB SpecialtyData�?찾습?�다.
   * 1. hpid 최우??매칭
   * 2. fallback: 병원�?Exact Match (?? ?�확??1개만 ?�을 ?�만 ?�용. ambiguous??null 반환)
   */
  private static getSpecialtyData(hospital: Hospital): SpecialtyData | null {
    if (hospital.id && this.dbSpecialtiesByHpid[hospital.id]) {
      return this.dbSpecialtiesByHpid[hospital.id] || null;
    }

    // Fallback: 병원�?매칭
    const normName = this.normalizeHospitalName(hospital.name);
    const candidates = this.dbSpecialtiesByName[normName];

    if (candidates && candidates.length === 1) {
      return candidates[0] || null; // ?�확??1개일 ?�만 ?�결
    }

    // 2�??�상??경우 ambiguous 처리�?매칭 ?�패(null) 반환
    if (candidates && candidates.length > 1) {
      console.warn(`[HospitalSpecialtyService] Ambiguous fallback match for ${hospital.name}`);
    }

    return null;
  }

  /**
   * ?�정 병원???�규?�된 질병 ?�수(0~30??�?계산?�니??
   * - targetDisease 문자???�는 condition)??받아 ?�규??   * - DB??specialties ?�소?� Exact Match ??(confidence_score * 0.3) 반환
   */
  static getDiseaseSpecialtyScore(hospital: Hospital, targetDisease?: string | null): number {
    if (!targetDisease) return 0;

    const canonicalTarget = normalizeDisease(targetDisease);
    if (!canonicalTarget) return 0; // 지?�하지 ?�는 질병, Unknown ??
    const data = this.getSpecialtyData(hospital);
    if (!data) return 0; // DB 매칭 ?�이???�음

    // stale 체크: ?�싱?�러, 미래?�점, 30??초과, no_data ??
    if (!this.isValidData(data)) return 0;

    // confidence_score 검�?(0~100, Number.isFinite)
    if (!this.isValidConfidenceScore(data.confidence_score)) return 0;

    // Exact Match 검??
    const isMatched = data.specialties.some(s => {
      const canonicalSpecialty = normalizeDisease(s);
      return canonicalSpecialty === canonicalTarget;
    });

    if (isMatched) {
      return Math.min(30, data.confidence_score * 0.3); // 0 ~ 30 ?��???
    }

    return 0;
  }

  private static isValidData(data: SpecialtyData): boolean {
    if (data.inferred_from === 'no_data' || data.inferred_from === 'ai_empty') {
      return false;
    }
    if (!data.last_updated_at) return false;

    const updatedDate = new Date(data.last_updated_at);
    if (isNaN(updatedDate.getTime())) return false; // ?�싱 ?�패

    const now = new Date();
    if (updatedDate > now) return false; // 미래 ?�간

    // 30??초과(stale) 검??
    const msPerDay = 24 * 60 * 60 * 1000;
    const diffDays = (now.getTime() - updatedDate.getTime()) / msPerDay;
    if (diffDays > 30) return false;

    return true;
  }

  private static isValidConfidenceScore(score: any): boolean {
    if (typeof score !== 'number' || !Number.isFinite(score)) return false;
    if (score < 0 || score > 100) return false;
    return true;
  }
}
