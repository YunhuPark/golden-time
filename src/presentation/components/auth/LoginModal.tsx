import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useAppStore } from '../../../infrastructure/state/store';
import { lightTheme, darkTheme } from '../../styles/theme';

/**
 * LoginModal Component
 * 선택적 로그인 모달 - 부가 기능 사용 시에만 표시
 */
export const LoginModal: React.FC = () => {
  const { isLoginModalOpen, loginRequiredFeature, closeLoginModal, themeMode } =
    useAppStore();
  const { signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 모달 열릴 때 body 스크롤 막기
  React.useEffect(() => {
    if (isLoginModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isLoginModalOpen]);

  const theme = themeMode === 'light' ? lightTheme : darkTheme;
  const isDark = themeMode === 'dark';

  if (!isLoginModalOpen) return null;

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: authError } =
        mode === 'signin'
          ? await signInWithEmail(email, password)
          : await signUpWithEmail(email, password);

      if (authError) {
        setError(authError.message);
      } else {
        // 성공 시 모달 닫기
        if (mode === 'signin') {
          alert('✅ 로그인이 완료되었습니다!');
          closeLoginModal();
        } else {
          // 회원가입 성공 시 안내 메시지
          alert('✅ 회원가입이 완료되었습니다!');
          setMode('signin');
        }
      }
    } catch {
      setError('로그인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await signInWithGoogle();

      // result가 없거나 error가 없으면 성공
      if (!result || !result.error) {
        // Google 로그인은 리다이렉트되므로 모달은 바로 닫지 않음
        // 페이지가 새로고침되면서 자동으로 닫힘
        return;
      }

      // error가 있는 경우
      const authError = result.error;
      if (authError) {
        // authError.message가 null, undefined, 빈 문자열인 경우를 모두 방지
        const errorMsg = authError.message?.trim() || 'Google 로그인 중 오류가 발생했습니다.';
        setError(errorMsg);
        console.error('Google OAuth error:', authError);
      }
    } catch (err: unknown) {
      // 예외 발생 시 안전한 에러 메시지 표시
      const errorMessage =
        err instanceof Error && err.message.trim()
          ? err.message.trim()
          : 'Google 로그인 중 오류가 발생했습니다.';
      setError(errorMessage);
      console.error('Google sign-in exception:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    closeLoginModal();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: theme.background.overlay,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
      }}
      onClick={handleSkip}
    >
      <div
        style={{
          backgroundColor: theme.background.primary,
          borderRadius: '16px',
          maxWidth: '400px',
          width: '100%',
          padding: '20px',
          boxShadow: theme.card.shadow,
          transition: 'all 0.3s ease',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div style={{ marginBottom: '20px', textAlign: 'center' }}>
          <h2
            style={{
              fontSize: '24px',
              fontWeight: '700',
              color: theme.status.critical,
              margin: '0 0 8px',
              transition: 'color 0.3s ease',
            }}
          >
            🔐 로그인
          </h2>
          {loginRequiredFeature && (
            <p style={{ fontSize: '14px', color: theme.text.secondary, margin: 0, transition: 'color 0.3s ease' }}>
              <strong>{loginRequiredFeature}</strong> 기능을 사용하려면 로그인이
              필요합니다
            </p>
          )}
          {!loginRequiredFeature && (
            <p style={{ fontSize: '14px', color: theme.text.secondary, margin: 0, transition: 'color 0.3s ease' }}>
              부가 기능을 사용하려면 로그인해주세요
            </p>
          )}
        </div>

        {/* 탭 */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '20px',
            borderBottom: `2px solid ${isDark ? theme.border.primary : '#F3F4F6'}`,
            transition: 'border-color 0.3s ease',
          }}
        >
          <button
            onClick={() => setMode('signin')}
            style={{
              flex: 1,
              padding: '8px 4px',
              fontSize: '13px',
              fontWeight: mode === 'signin' ? '700' : '400',
              color: mode === 'signin' ? theme.status.critical : theme.text.secondary,
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom:
                mode === 'signin' ? `2px solid ${theme.status.critical}` : '2px solid transparent',
              cursor: 'pointer',
              marginBottom: '-2px',
              transition: 'all 0.3s ease',
            }}
          >
            로그인
          </button>
          <button
            onClick={() => setMode('signup')}
            style={{
              flex: 1,
              padding: '8px 4px',
              fontSize: '13px',
              fontWeight: mode === 'signup' ? '700' : '400',
              color: mode === 'signup' ? theme.status.critical : theme.text.secondary,
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom:
                mode === 'signup' ? `2px solid ${theme.status.critical}` : '2px solid transparent',
              cursor: 'pointer',
              marginBottom: '-2px',
              transition: 'all 0.3s ease',
            }}
          >
            회원가입
          </button>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div
            style={{
              backgroundColor: isDark ? 'rgba(255, 0, 61, 0.2)' : '#FEE2E2',
              color: isDark ? theme.status.critical : '#991B1B',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '14px',
              marginBottom: '16px',
              transition: 'all 0.3s ease',
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* 이메일/비밀번호 폼 */}
        <form onSubmit={handleEmailAuth} style={{ marginBottom: '16px' }}>
          <input
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '14px',
              fontSize: '15px',
              border: `2px solid ${theme.border.primary}`,
              backgroundColor: isDark ? theme.background.secondary : '#fff',
              color: theme.text.primary,
              borderRadius: '8px',
              marginBottom: '12px',
              boxSizing: 'border-box',
              transition: 'all 0.3s ease',
            }}
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            style={{
              width: '100%',
              padding: '14px',
              fontSize: '15px',
              border: `2px solid ${theme.border.primary}`,
              backgroundColor: isDark ? theme.background.secondary : '#fff',
              color: theme.text.primary,
              borderRadius: '8px',
              marginBottom: '16px',
              boxSizing: 'border-box',
              transition: 'all 0.3s ease',
            }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '14px',
              fontWeight: '700',
              color: '#fff',
              backgroundColor: loading ? (isDark ? theme.border.primary : '#D1D5DB') : theme.status.critical,
              border: 'none',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
            }}
          >
            {loading
              ? '처리 중...'
              : mode === 'signin'
              ? '로그인'
              : '회원가입'}
          </button>
        </form>

        {/* 구분선 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            margin: '16px 0',
            gap: '12px',
          }}
        >
          <div style={{ flex: 1, height: '1px', backgroundColor: theme.border.primary, transition: 'background-color 0.3s ease' }} />
          <span style={{ fontSize: '14px', color: theme.text.secondary, transition: 'color 0.3s ease' }}>또는</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: theme.border.primary, transition: 'background-color 0.3s ease' }} />
        </div>

        {/* Google 로그인 */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '14px',
            fontWeight: '600',
            color: theme.text.primary,
            backgroundColor: isDark ? theme.background.secondary : '#fff',
            border: `2px solid ${theme.border.primary}`,
            borderRadius: '8px',
            cursor: loading ? 'not-allowed' : 'pointer',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.3s ease',
          }}
        >
          <span style={{ fontSize: '20px' }}>🔍</span>
          Google로 계속하기
        </button>

        {/* 나중에 하기 버튼 */}
        <button
          onClick={handleSkip}
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '14px',
            fontWeight: '500',
            color: theme.text.secondary,
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            transition: 'color 0.3s ease',
          }}
        >
          나중에 하기
        </button>

        {/* 안내 문구 */}
        <p
          style={{
            fontSize: '12px',
            color: theme.text.dim,
            textAlign: 'center',
            marginTop: '16px',
            marginBottom: 0,
            transition: 'color 0.3s ease',
          }}
        >
          💡 로그인 없이도 모든 응급실 검색 기능을 사용할 수 있습니다
        </p>
      </div>
    </div>
  );
};
