/**
 * Golden Time - Dual Theme System
 * 라이트 모드(낮): 밝고 친근한 UI
 * 다크 모드(야간): Emergency Control Center 컨셉
 */

export const lightTheme = {
  // 배경색 (밝은 계열)
  background: {
    primary: '#FFFFFF',
    secondary: '#F8F9FA',
    tertiary: '#E9ECEF',
    overlay: 'rgba(0, 0, 0, 0.5)',
  },

  // 텍스트 색상
  text: {
    primary: '#212529',
    secondary: '#6C757D',
    dim: '#ADB5BD',
    inverse: '#FFFFFF',
  },

  // 응급 상태 색상
  status: {
    critical: '#FF3B30',     // 빨강
    warning: '#FFD60A',      // 노랑
    safe: '#34C759',         // 초록
    info: '#007AFF',         // 파랑
  },

  // 경계선
  border: {
    primary: '#DEE2E6',
    highlight: '#34C759',
    critical: '#FF3B30',
  },

  // 카드/섹션
  card: {
    background: '#FFFFFF',
    border: '#E9ECEF',
    shadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
  },
} as const;

export const darkTheme = {
  // 배경색 (어두운 계열)
  background: {
    primary: '#0A0E14',
    secondary: '#1A1F29',
    tertiary: '#252B37',
    overlay: 'rgba(10, 14, 20, 0.95)',
  },

  // 텍스트 색상
  text: {
    primary: '#E8EAED',
    secondary: '#9AA0A6',
    dim: '#5F6368',
    inverse: '#0A0E14',
  },

  // 응급 상태 색상 (네온 효과)
  status: {
    critical: '#FF003D',     // 네온 빨강
    warning: '#FFD600',      // 네온 노랑
    safe: '#00FF66',         // 네온 초록
    info: '#00D9FF',         // 네온 청록
  },

  // 네온 글로우 효과
  glow: {
    critical: '0 0 10px #FF003D, 0 0 20px #FF003D',
    warning: '0 0 10px #FFD600, 0 0 20px #FFD600',
    safe: '0 0 10px #00FF66, 0 0 20px #00FF66',
    info: '0 0 10px #00D9FF, 0 0 20px #00D9FF',
  },

  // 경계선
  border: {
    primary: '#2A3140',
    highlight: '#00FF66',
    critical: '#FF003D',
  },

  // 카드/섹션
  card: {
    background: '#1A1F29',
    border: '#2A3140',
    shadow: '0 4px 16px rgba(0, 0, 0, 0.5)',
  },
} as const;

export type Theme = typeof lightTheme;
export type ThemeMode = 'light' | 'dark';
