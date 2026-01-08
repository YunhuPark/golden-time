import { useEffect, useState } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '../../infrastructure/supabase/supabaseClient';

/**
 * useAuth Hook
 * Supabase 인증 상태 관리
 */
export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 즉시 로딩 완료로 설정하여 메인 렌더링이 차단되지 않도록 함
    // (긴급 상황 대응을 위한 LCP 최적화)
    setLoading(false);

    // 초기 세션 확인 (비동기, 논블로킹)
    // requestIdleCallback을 사용하여 메인 스레드가 여유로울 때 실행
    const idleCallback = window.requestIdleCallback
      ? window.requestIdleCallback(() => {
          supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
          });
        })
      : setTimeout(() => {
          supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
          });
        }, 0);

    // 인증 상태 변경 감지
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
      if (window.requestIdleCallback && typeof idleCallback === 'number') {
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
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  /**
   * 비밀번호 재설정 이메일 전송
   */
  const resetPassword = async (
    email: string
  ): Promise<{ error: AuthError | null }> => {
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
