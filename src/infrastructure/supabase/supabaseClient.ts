import { createClient } from '@supabase/supabase-js';

/**
 * Supabase Client
 * 인증 및 데이터베이스 연동을 위한 클라이언트
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '⚠️ WARNING: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not found. Auth features will not work.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
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
