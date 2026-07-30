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
 * ?„êµ­??ë³‘ì› ?„ë¬¸/ê°•ì  ë¶„ì•¼ë¥?ë§¤í•‘?˜ëŠ” DB ?œë¹„?? */
export class HospitalSpecialtyService {
  private static dbSpecialtiesByHpid: Record<string, SpecialtyData> = {};
  private static dbSpecialtiesByName: Record<string, SpecialtyData[]> = {};
  private static isLoaded = false;

  /**
   * ?„ì²´ ë³‘ì› ?ëŠ” ì£¼ì–´ì§?ë³‘ì› ëª©ë¡???€???¹í™” ?•ë³´ë¥?ë¡œë“œ?˜ì—¬ ë©”ëª¨ë¦¬ì— ìºì‹±?©ë‹ˆ??
   * (N+1 ë°©ì?: ?„ì²´ë¥???ë²ˆì— ì¡°íšŒ?˜ê±°??in ì¿¼ë¦¬ ?¬ìš©)
   */
  static async loadSpecialtiesForHospitals(hpids: string[]): Promise<void> {
    if (this.isLoaded) return;

    // Chunk ?¨ìœ„ ì²˜ë¦¬ë¥??”êµ¬ë°›ì•˜?¼ë‚˜, ?„ì²´ ?°ì´?°ê? ?ë‹¤ë©??œë²ˆ??ë¡œë“œ.
    // ?¬ìš©?ê? 'ì²?¬ ?¨ìœ„ in ì¿¼ë¦¬'ë¥??”êµ¬?ˆìœ¼ë¯€ë¡?ì²?¬ ?¨ìœ„ë¡?ì¡°íšŒ?©ë‹ˆ??
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

            // hpid ë§¤ì¹­ ?¤íŒ¨ ?€ë¹??´ë¦„ ê¸°ë°˜ ë³´ì¡° ë§¤í•‘ (Fallback)
            // ?´ë¦„?€ ?„ì „ ?•ê·œ?”í•˜???€??            if (row.hospital_name) {
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
   * ë³‘ì›ëª??„ì „ ?•ê·œ??(ëª¨ë“  ê³µë°± ?œê±°, ?Œë¬¸?í™”)
   */
  private static normalizeHospitalName(name: string): string {
    return name.replace(/\s+/g, '').toLowerCase();
  }

  /**
   * ì£¼ì–´ì§?Hospital ?¸ìŠ¤?´ìŠ¤???€??DB SpecialtyDataë¥?ì°¾ìŠµ?ˆë‹¤.
   * 1. hpid ìµœìš°??ë§¤ì¹­
   * 2. fallback: ë³‘ì›ëª?Exact Match (?? ?•í™•??1ê°œë§Œ ?ˆì„ ?Œë§Œ ?ˆìš©. ambiguous??null ë°˜í™˜)
   */
  private static getSpecialtyData(hospital: Hospital): SpecialtyData | null {
    if (hospital.id && this.dbSpecialtiesByHpid[hospital.id]) {
      return this.dbSpecialtiesByHpid[hospital.id] || null;
    }

    // Fallback: ë³‘ì›ëª?ë§¤ì¹­
    const normName = this.normalizeHospitalName(hospital.name);
    const candidates = this.dbSpecialtiesByName[normName];

    if (candidates && candidates.length === 1) {
      return candidates[0] || null; // ?•í™•??1ê°œì¼ ?Œë§Œ ?°ê²°
    }

    // 2ê°??´ìƒ??ê²½ìš° ambiguous ì²˜ë¦¬ë¡?ë§¤ì¹­ ?¤íŒ¨(null) ë°˜í™˜
    if (candidates && candidates.length > 1) {
      console.warn(`[HospitalSpecialtyService] Ambiguous fallback match for ${hospital.name}`);
    }

    return null;
  }

  /**
   * ?¹ì • ë³‘ì›???•ê·œ?”ëœ ì§ˆë³‘ ?ìˆ˜(0~30??ë¥?ê³„ì‚°?©ë‹ˆ??
   * - targetDisease ë¬¸ì???ëŠ” condition)??ë°›ì•„ ?•ê·œ??   * - DB??specialties ?”ì†Œ?€ Exact Match ??(confidence_score * 0.3) ë°˜í™˜
   */
  static getDiseaseSpecialtyScore(hospital: Hospital, targetDisease?: string | null): number {
    if (!targetDisease) return 0;

    const canonicalTarget = normalizeDisease(targetDisease);
    if (!canonicalTarget) return 0; // ì§€?í•˜ì§€ ?ŠëŠ” ì§ˆë³‘, Unknown ??
    const data = this.getSpecialtyData(hospital);
    if (!data) return 0; // DB ë§¤ì¹­ ?°ì´???†ìŒ

    // stale ì²´í¬: ?Œì‹±?ëŸ¬, ë¯¸ë˜?œì , 30??ì´ˆê³¼, no_data ??    if (!this.isValidData(data)) return 0;

    // confidence_score ê²€ì¦?(0~100, Number.isFinite)
    if (!this.isValidConfidenceScore(data.confidence_score)) return 0;

    // Exact Match ê²€??    const isMatched = data.specialties.some(s => {
      const canonicalSpecialty = normalizeDisease(s);
      return canonicalSpecialty === canonicalTarget;
    });

    if (isMatched) {
      return Math.min(30, data.confidence_score * 0.3); // 0 ~ 30 ?¤ì???    }

    return 0;
  }

  private static isValidData(data: SpecialtyData): boolean {
    if (data.inferred_from === 'no_data' || data.inferred_from === 'ai_empty') {
      return false;
    }
    if (!data.last_updated_at) return false;

    const updatedDate = new Date(data.last_updated_at);
    if (isNaN(updatedDate.getTime())) return false; // ?Œì‹± ?¤íŒ¨

    const now = new Date();
    if (updatedDate > now) return false; // ë¯¸ë˜ ?œê°„

    // 30??ì´ˆê³¼(stale) ê²€??    const msPerDay = 24 * 60 * 60 * 1000;
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
