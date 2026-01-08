import React from 'react';
import { useAppStore } from '../../../infrastructure/state/store';
import { cn } from '../../../lib/utils';

interface NetworkStatusBannerProps {
  isOffline: boolean;
  justReconnected: boolean;
  onRefresh?: () => void;
}

/**
 * NetworkStatusBanner Component
 * 네트워크 연결 상태를 표시하는 배너
 */
export const NetworkStatusBanner: React.FC<NetworkStatusBannerProps> = ({
  isOffline,
  justReconnected,
  onRefresh,
}) => {
  const { themeMode } = useAppStore();
  const isDark = themeMode === 'dark';

  // 오프라인 상태
  if (isOffline) {
    return (
      <div
        className={cn(
          'fixed top-0 left-0 right-0 z-50 p-3 text-center font-semibold text-sm shadow-lg',
          isDark
            ? 'bg-destructive text-destructive-foreground'
            : 'bg-red-600 text-white'
        )}
      >
        <div className="flex items-center justify-center gap-2">
          <span className="text-lg">📡</span>
          <span>네트워크 연결 없음 - 캐시된 데이터를 사용 중입니다</span>
        </div>
        <div
          className={cn(
            'text-xs mt-1',
            isDark ? 'text-destructive-foreground/80' : 'text-red-100'
          )}
        >
          데이터가 최신이 아닐 수 있습니다
        </div>
      </div>
    );
  }

  // 재연결됨 (일시적으로 표시)
  if (justReconnected && onRefresh) {
    return (
      <div
        className={cn(
          'fixed top-0 left-0 right-0 z-50 p-3 text-center shadow-lg',
          isDark
            ? 'bg-success/20 text-success border-b border-success'
            : 'bg-green-50 text-green-800 border-b border-green-200'
        )}
      >
        <div className="flex items-center justify-center gap-3">
          <span className="text-lg">✅</span>
          <span className="font-semibold text-sm">
            네트워크 연결 복구됨
          </span>
          <button
            onClick={onRefresh}
            className={cn(
              'px-3 py-1 rounded-md text-xs font-bold transition-colors',
              isDark
                ? 'bg-success text-success-foreground hover:bg-success/90'
                : 'bg-green-600 text-white hover:bg-green-700'
            )}
          >
            최신 데이터 불러오기
          </button>
        </div>
      </div>
    );
  }

  return null;
};
