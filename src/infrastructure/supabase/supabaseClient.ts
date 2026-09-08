import { createClient } from '@supabase/supabase-js';
import { resolveSupabasePublicConfig } from './supabaseConfig';

/**
 * Supabase Client
 * 인증 및 데이터베이스 연동을 위한 클라이언트
 */

const configuredUrl = import.meta.env.VITE_SUPABASE_URL || '';
const configuredAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabaseConfig = resolveSupabasePublicConfig(configuredUrl, configuredAnonKey);

if (supabaseConfig.source === 'canonical-fallback') {
  console.warn(
    `⚠️ Supabase deployment configuration fallback activated (${supabaseConfig.reason}). ` +
      'Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel.'
  );
}

export const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
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
