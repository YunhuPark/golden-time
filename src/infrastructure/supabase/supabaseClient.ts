import { createClient } from '@supabase/supabase-js';
import { resolveSupabasePublicConfig } from './supabaseConfig';

/**
 * Supabase Client
 * 인증 및 데이터베이스 연동을 위한 클라이언트
 */

const configuredUrl = import.meta.env.VITE_SUPABASE_URL || '';
const configuredAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const explicitlyEnabled = import.meta.env.VITE_SUPABASE_ENABLED === 'true';
const supabaseConfig = resolveSupabasePublicConfig(
  configuredUrl,
  configuredAnonKey,
  explicitlyEnabled
);

/**
 * Supabase-backed features are opt-in. If disabled, every Supabase fetch is
 * handled locally by a synthetic 503 response so no request can leave the
 * browser, even if a component still calls supabase.from(...) or auth methods.
 */
export const supabaseOptionalFeaturesEnabled = supabaseConfig.source === 'environment';
export const SUPABASE_UNAVAILABLE_MESSAGE =
  '계정 기반 선택 기능을 현재 사용할 수 없습니다. 병원 검색과 응급실 정보는 정상 이용 가능합니다.';

const disabledSupabaseFetch: typeof fetch = async () =>
  new Response(
    JSON.stringify({
      message: SUPABASE_UNAVAILABLE_MESSAGE,
      code: 'SUPABASE_CAPABILITY_DISABLED',
    }),
    {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'application/json' },
    }
  );

if (!supabaseOptionalFeaturesEnabled) {
  console.info(
    `ℹ️ Supabase optional features disabled (${supabaseConfig.reason}). ` +
      'Hospital search and E-Gen realtime data remain available.'
  );
}

export const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey, {
  global: {
    fetch: supabaseOptionalFeaturesEnabled ? fetch : disabledSupabaseFetch,
  },
  auth: {
    autoRefreshToken: supabaseOptionalFeaturesEnabled,
    persistSession: supabaseOptionalFeaturesEnabled,
    detectSessionInUrl: supabaseOptionalFeaturesEnabled,
  },
});

/**
 * Database Types
 * Supabase 데이터베이스 스키마 타입 정의
 */
export interface Database {
  public: {
    Tables: {
      favorites: {
        Row: {
          id: string;
          user_id: string;
          hospital_id: string;
          hospital_name: string;
          hospital_address: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          hospital_id: string;
          hospital_name: string;
          hospital_address: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          hospital_id?: string;
          hospital_name?: string;
          hospital_address?: string;
          created_at?: string;
        };
      };
      reviews: {
        Row: {
          id: string;
          user_id: string;
          hospital_id: string;
          rating: number;
          comment: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          hospital_id: string;
          rating: number;
          comment: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          hospital_id?: string;
          rating?: number;
          comment?: string;
          created_at?: string;
        };
      };
    };
  };
}
