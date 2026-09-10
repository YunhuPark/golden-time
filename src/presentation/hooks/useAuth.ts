import { useEffect, useState } from 'react';
import type { User, Session, AuthError } from '@supabase/supabase-js';

/**
 * useAuth Hook
 * Supabase 인증 상태 관리
 */
const SUPABASE_ENABLED = import.meta.env.VITE_SUPABASE_ENABLED === 'true';

async function getSupabase() {
  if (!SUPABASE_ENABLED) return null;
  const { supabase } = await import('../../infrastructure/supabase/supabaseClient');
  return supabase;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 즉시 로딩 완료로 설정하여 메인 렌더링이 차단되지 않도록 함
    // (긴급 상황 대응을 위한 LCP 최적화)
    setLoading(false);

    if (!SUPABASE_ENABLED) return;

    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    const loadSession = async () => {
      const supabase = await getSupabase();
      if (!supabase || disposed) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!disposed) {
        setSession(session);
        setUser(session?.user ?? null);
      }
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        if (disposed) return;
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
      });
      unsubscribe = () => subscription.unsubscribe();
    };

    const idleCallback = window.requestIdleCallback
      ? window.requestIdleCallback(() => { void loadSession(); })
      : setTimeout(() => { void loadSession(); }, 0);

    return () => {
      disposed = true;
      unsubscribe?.();
      if ('cancelIdleCallback' in window && typeof idleCallback === 'number') {
        window.cancelIdleCallback(idleCallback);
      } else if (typeof idleCallback === 'number') {
        clearTimeout(idleCallback);
      }
    };
  }, []);

  /**
   * 이메일/비밀번호 로그인
   */
  const signInWithEmail = async (
    email: string,
    password: string
  ): Promise<{ error: AuthError | null }> => {
    const supabase = await getSupabase();
    if (!supabase) return { error: new Error('Supabase disabled') as AuthError };
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  /**
   * 이메일/비밀번호 회원가입
   */
  const signUpWithEmail = async (
    email: string,
    password: string
  ): Promise<{ error: AuthError | null }> => {
    const supabase = await getSupabase();
    if (!supabase) return { error: new Error('Supabase disabled') as AuthError };
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    return { error };
  };

  /**
   * Google 소셜 로그인
   */
  const signInWithGoogle = async (): Promise<{ error: AuthError | null }> => {
    const supabase = await getSupabase();
    if (!supabase) return { error: new Error('Supabase disabled') as AuthError };
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    return { error };
  };

  /**
   * 로그아웃
   */
  const signOut = async (): Promise<{ error: AuthError | null }> => {
    const supabase = await getSupabase();
    if (!supabase) return { error: null };
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  /**
   * 비밀번호 재설정 이메일 전송
   */
  const resetPassword = async (
    email: string
  ): Promise<{ error: AuthError | null }> => {
    const supabase = await getSupabase();
    if (!supabase) return { error: new Error('Supabase disabled') as AuthError };
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error };
  };

  return {
    user,
    session,
    loading,
    isAuthenticated: !!user,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signOut,
    resetPassword,
  };
};
