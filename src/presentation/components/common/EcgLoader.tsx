/**
 * ECG (심전도) 로딩 애니메이션 컴포넌트
 * shadcn/ui + Tailwind CSS로 완전히 재작성
 * Emergency Control Center 디자인
 */

import { useEffect, useState } from 'react';
import { ThemeMode } from '../../styles/theme';
import { cn } from '../../../lib/utils';

interface EcgLoaderProps {
  message?: string;
  fullScreen?: boolean;
}

export function EcgLoader({
  message = 'LOADING EMERGENCY DATA...',
  fullScreen = true
}: EcgLoaderProps) {
  const [themeMode, setThemeMode] = useState<ThemeMode>('light');

  // localStorage에서 저장된 테마 모드 읽기
  useEffect(() => {
    try {
      const stored = localStorage.getItem('golden-time-storage');
      if (stored) {
        const parsed = JSON.parse(stored);
        const savedTheme = parsed.state?.themeMode;
        if (savedTheme) {
          setThemeMode(savedTheme);
        }
      }
    } catch (error) {
      console.error('Failed to read theme from localStorage:', error);
    }
  }, []);

  const isDark = themeMode === 'dark';

  return (
    <div
      className={cn(
        fullScreen ? 'fixed' : 'absolute',
        'inset-0 z-[9999] overflow-hidden',
        'flex flex-col items-center justify-center',
        isDark ? 'bg-background' : 'bg-white'
      )}
    >
      {/* 스캔라인 효과 */}
      <div className={cn(
        'absolute w-full h-0.5 opacity-30 animate-scan-line bg-gradient-to-b from-transparent to-transparent',
        isDark ? 'via-safe' : 'via-critical'
      )} />

      {/* 상단 상태 바 */}
      <div
        className={cn(
          'absolute top-5 left-5 right-5',
          'flex justify-between',
          'text-[11px] font-mono uppercase tracking-[2px]',
          isDark ? 'text-safe' : 'text-critical'
        )}
      >
        <span className="animate-ecg-pulse">[SYSTEM ONLINE]</span>
        <span>ID: {new Date().getTime().toString(36).toUpperCase()}</span>
      </div>

      {/* 로고 + 타이틀 */}
      <div className="flex items-center mb-12">
        <span
          className={cn(
            'text-[56px] mr-4 animate-[heartbeat_1.5s_ease-in-out_infinite]',
            isDark
              ? 'drop-shadow-[0_0_10px_hsl(var(--critical))]'
              : 'drop-shadow-[0_2px_4px_rgba(255,59,48,0.3)]'
          )}
        >
          🚑
        </span>
        <h1
          className={cn(
            'text-[42px] font-black uppercase tracking-[3px] font-mono m-0',
            isDark
              ? 'text-neon-safe animate-[neon-glow-green_2s_ease-in-out_infinite]'
              : 'text-critical'
          )}
        >
          GOLDEN TIME
        </h1>
      </div>

      {/* ECG 심전도 그래프 */}
      <div
        className={cn(
          'relative w-[400px] h-[100px] overflow-hidden mb-10 rounded-lg p-2.5',
          isDark
            ? 'bg-card border-2 border-border'
            : 'bg-secondary border-2 border-input'
        )}
      >
        {/* 배경 그리드 */}
        <svg
          width="380"
          height="80"
          className="absolute top-2.5 left-2.5"
        >
          {/* 중앙 수평선 */}
          <line
            x1="0"
            y1="40"
            x2="380"
            y2="40"
            stroke={isDark ? 'hsl(var(--border))' : '#DEE2E6'}
            strokeWidth="1"
          />
          {/* 그리드 라인 */}
          {[...Array(10)].map((_, i) => (
            <line
              key={i}
              x1={i * 38}
              y1="0"
              x2={i * 38}
              y2="80"
              stroke={isDark ? 'hsl(var(--border))' : '#DEE2E6'}
              strokeWidth="0.5"
              opacity={isDark ? '0.3' : '0.5'}
            />
          ))}
        </svg>

        {/* ECG 라인 */}
        <svg
          width="380"
          height="80"
          className="absolute top-2.5 left-2.5"
        >
          <polyline
            points="0,40 30,40 35,40 37,15 39,65 41,25 43,40 48,40 80,40 85,40 87,15 89,65 91,25 93,40 98,40 130,40 135,40 137,15 139,65 141,25 143,40 148,40 180,40 185,40 187,15 189,65 191,25 193,40 198,40 230,40 235,40 237,15 239,65 241,25 243,40 248,40 280,40 300,40 305,40 307,15 309,65 311,25 313,40 318,40 350,40 380,40"
            fill="none"
            stroke={isDark ? 'hsl(var(--safe))' : '#FF3B30'}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn(
              'animate-[ecg-line_2s_linear_infinite]',
              isDark
                ? 'drop-shadow-[0_0_5px_hsl(var(--safe))]'
                : 'drop-shadow-[0_0_3px_rgba(255,59,48,0.5)]'
            )}
          />
        </svg>
      </div>

      {/* 로딩 메시지 */}
      <p
        className={cn(
          'text-[13px] font-mono uppercase tracking-[2px] m-0 mb-5',
          'animate-ecg-pulse',
          isDark ? 'text-safe' : 'text-critical'
        )}
      >
        {message}
      </p>

      {/* 하단 상태 표시 */}
      <div className="flex gap-7 text-[11px] font-mono text-muted-foreground uppercase">
        <div className="flex items-center gap-1.5">
          <span className="text-safe">●</span>
          <span>REALTIME</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-info">●</span>
          <span>SECURE</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-warning">●</span>
          <span>ACTIVE</span>
        </div>
      </div>

      {/* 하단 서브타이틀 */}
      <p className="absolute bottom-5 text-[10px] text-muted-foreground/60 m-0 font-mono tracking-wider">
        EMERGENCY MEDICAL INFORMATION SYSTEM v2.0
      </p>
    </div>
  );
}
