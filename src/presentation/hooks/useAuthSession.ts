import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../infrastructure/supabase/supabaseClient';
import { logError, logEvent } from '../../infrastructure/monitoring/sentry';

/**
 * useAuthSession Hook
 * Supabase 세션 만료 자동 감지 및 갱신
 *
 * Features:
 * - JWT 토큰 만료 감지
 * - 자동 토큰 갱신 시도
 * - 세션 만료 이벤트 발생
 * - 에러 핸들링 with Sentry
 *
 * Edge Cases:
 * - 토큰 갱신 실패 시 로그아웃 처리
 * - 네트워크 오프라인 시 갱신 재시도
 * - 수동 로그아웃 vs 자동 만료 구분
 */

export interface AuthSessionState {
  isAuthenticated: boolean;
  isExpired: boolean;
  isRefreshing: boolean;
  expiresAt: Date | null;
  userId: string | null;
}

export interface UseAuthSessionReturn extends AuthSessionState {
  refreshSession: () => Promise<boolean>;
  forceLogout: () => Promise<void>;
  handleSessionError: (error: any) => boolean; // Returns true if session expired
}

export function useAuthSession(): UseAuthSessionReturn {
  const [state, setState] = useState<AuthSessionState>({
    isAuthenticated: false,
    isExpired: false,
    isRefreshing: false,
    expiresAt: null,
    userId: null,
  });

  /**
   * 현재 세션 상태 확인 및 업데이트
   */
  const checkSession = useCallback(async () => {
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error('Failed to get session:', error);
        logError(error, {
          area: 'auth',
          severity: 'medium',
          extra: { operation: 'getSession' },
        });
        return;
      }

      if (!session) {
        setState({
          isAuthenticated: false,
          isExpired: false,
          isRefreshing: false,
          expiresAt: null,
          userId: null,
        });
        return;
      }

      // JWT 만료 시간 계산
      const expiresAt = new Date(session.expires_at! * 1000);
      const now = new Date();
      const isExpired = expiresAt <= now;

      setState({
        isAuthenticated: !isExpired,
        isExpired,
        isRefreshing: false,
        expiresAt,
        userId: session.user?.id || null,
      });

      // 만료된 경우 로그
      if (isExpired) {
        console.warn('⚠️ Session expired at:', expiresAt.toLocaleString());
        logEvent('session_expired', {
          expired_at: expiresAt.toISOString(),
          user_id: session.user?.id,
        });
      }
    } catch (err) {
      console.error('Check session error:', err);
      logError(err as Error, {
        area: 'auth',
        severity: 'medium',
        extra: { operation: 'checkSession' },
      });
    }
  }, []);

  /**
   * 세션 갱신 시도
   */
  const refreshSession = useCallback(async (): Promise<boolean> => {
    setState((prev) => ({ ...prev, isRefreshing: true }));

    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.refreshSession();

      if (error) {
        console.error('Failed to refresh session:', error);
        logError(error, {
          area: 'auth',
          severity: 'high',
          extra: { operation: 'refreshSession' },
        });

        // 갱신 실패 시 만료 상태로 전환
        setState((prev) => ({
          ...prev,
          isRefreshing: false,
          isExpired: true,
          isAuthenticated: false,
        }));

        return false;
      }

      if (!session) {
        console.warn('Session refresh returned null session');
        setState((prev) => ({
          ...prev,
          isRefreshing: false,
          isExpired: true,
          isAuthenticated: false,
        }));
        return false;
      }

      // 갱신 성공
      const expiresAt = new Date(session.expires_at! * 1000);
      setState({
        isAuthenticated: true,
        isExpired: false,
        isRefreshing: false,
        expiresAt,
        userId: session.user?.id || null,
      });

      console.log('✅ Session refreshed successfully, expires at:', expiresAt.toLocaleString());
      logEvent('session_refreshed', {
        expires_at: expiresAt.toISOString(),
        user_id: session.user?.id,
      });

      return true;
    } catch (err) {
      console.error('Refresh session error:', err);
      logError(err as Error, {
        area: 'auth',
        severity: 'high',
        extra: { operation: 'refreshSession' },
      });

      setState((prev) => ({
        ...prev,
        isRefreshing: false,
        isExpired: true,
        isAuthenticated: false,
      }));

      return false;
    }
  }, []);

  /**
   * 강제 로그아웃
   */
  const forceLogout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      setState({
        isAuthenticated: false,
        isExpired: false,
        isRefreshing: false,
        expiresAt: null,
        userId: null,
      });
      console.log('✅ User logged out');
      logEvent('user_logged_out', { reason: 'force_logout' });
    } catch (err) {
      console.error('Logout error:', err);
      logError(err as Error, {
        area: 'auth',
        severity: 'low',
        extra: { operation: 'forceLogout' },
      });
    }
  }, []);

  /**
   * Supabase 에러 분석 및 세션 만료 감지
   * @returns true if session expired, false otherwise
   */
  const handleSessionError = useCallback(
    (error: any): boolean => {
      if (!error) return false;

      const errorMessage = error.message || String(error);
      const isJWTError =
        errorMessage.includes('JWT') ||
        errorMessage.includes('jwt') ||
        errorMessage.includes('token') ||
        errorMessage.includes('expired') ||
        errorMessage.includes('unauthorized') ||
        errorMessage.includes('not authenticated') ||
        error.status === 401 ||
        error.code === 'PGRST301'; // PostgREST JWT expired

      if (isJWTError) {
        console.warn('🚨 Session expiry detected in error:', errorMessage);
        setState((prev) => ({
          ...prev,
          isExpired: true,
          isAuthenticated: false,
        }));

        logEvent('session_error_detected', {
          error_message: errorMessage,
          error_code: error.code,
          error_status: error.status,
        });

        return true;
      }

      return false;
    },
    []
  );

  /**
   * 초기 세션 확인 및 자동 갱신 리스너 등록
   */
  useEffect(() => {
    // 초기 세션 확인
    checkSession();

    // Supabase Auth 상태 변화 리스너
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔄 Auth state changed:', event);

      if (event === 'SIGNED_OUT') {
        setState({
          isAuthenticated: false,
          isExpired: false,
          isRefreshing: false,
          expiresAt: null,
          userId: null,
        });
        logEvent('auth_state_changed', { event: 'SIGNED_OUT' });
      } else if (event === 'TOKEN_REFRESHED') {
        if (session) {
          const expiresAt = new Date(session.expires_at! * 1000);
          setState({
            isAuthenticated: true,
            isExpired: false,
            isRefreshing: false,
            expiresAt,
            userId: session.user?.id || null,
          });
          console.log('✅ Token auto-refreshed, expires at:', expiresAt.toLocaleString());
          logEvent('auth_state_changed', { event: 'TOKEN_REFRESHED' });
        }
      } else if (event === 'SIGNED_IN') {
        if (session) {
          const expiresAt = new Date(session.expires_at! * 1000);
          setState({
            isAuthenticated: true,
            isExpired: false,
            isRefreshing: false,
            expiresAt,
            userId: session.user?.id || null,
          });
          logEvent('auth_state_changed', { event: 'SIGNED_IN' });
        }
      }
    });

    // 10분마다 세션 상태 확인 (자동 갱신 실패 케이스 대비)
    const intervalId = setInterval(() => {
      checkSession();
    }, 10 * 60 * 1000);

    return () => {
      subscription.unsubscribe();
      clearInterval(intervalId);
    };
  }, [checkSession]);

  return {
    ...state,
    refreshSession,
    forceLogout,
    handleSessionError,
  };
}
