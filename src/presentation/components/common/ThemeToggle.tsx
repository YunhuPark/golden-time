/**
 * Theme Toggle Button
 * 라이트/다크 모드 전환 버튼
 */

import { useAppStore } from '../../../infrastructure/state/store';
import { lightTheme, darkTheme } from '../../styles/theme';

export function ThemeToggle() {
  const { themeMode, toggleTheme } = useAppStore();
  const theme = themeMode === 'light' ? lightTheme : darkTheme;
  const isDark = themeMode === 'dark';

  return (
    <button
      onClick={toggleTheme}
      style={{
        position: 'relative',
        width: '60px',
        height: '32px',
        borderRadius: '16px',
        border: `2px solid ${theme.border.primary}`,
        background: theme.background.secondary,
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        overflow: 'hidden',
      }}
      title={isDark ? '라이트 모드로 전환 (주간)' : '다크 모드로 전환 (야간)'}
    >
      {/* 슬라이더 */}
      <div
        style={{
          position: 'absolute',
          top: '2px',
          left: isDark ? 'calc(100% - 26px)' : '2px',
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          background: isDark ? darkTheme.status.safe : lightTheme.status.warning,
          boxShadow: isDark ? darkTheme.glow?.safe : '0 2px 4px rgba(0, 0, 0, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '14px',
          transition: 'all 0.3s ease',
        }}
      >
        {isDark ? '🌙' : '☀️'}
      </div>

      {/* 배경 아이콘 */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          right: isDark ? 'auto' : '6px',
          left: isDark ? '6px' : 'auto',
          transform: 'translateY(-50%)',
          fontSize: '12px',
          opacity: 0.4,
        }}
      >
        {isDark ? '☀️' : '🌙'}
      </div>
    </button>
  );
}
