import React from 'react';
import { useAppStore } from '../../../infrastructure/state/store';
import { cn } from '../../../lib/utils';

/**
 * SessionExpiredModal Component
 * 세션 만료 시 표시되는 모달
 *
 * UX Features:
 * - 사용자의 의도된 작업(즐겨찾기, 리뷰 등) 보존
 * - 명확한 에러 메시지와 해결 방법
 * - 재로그인 후 원래 작업으로 자동 복귀
 */

interface SessionExpiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  intendedAction?: string; // e.g., "즐겨찾기", "리뷰 작성", "방문 기록"
  onRelogin: () => void;
}

export const SessionExpiredModal: React.FC<SessionExpiredModalProps> = ({
  isOpen,
  onClose,
  intendedAction = '작업',
  onRelogin,
}) => {
  const { themeMode } = useAppStore();
  const isDark = themeMode === 'dark';

  if (!isOpen) return null;

  return (
    <>
      {/* 배경 오버레이 */}
      <div
        className={cn(
          'fixed inset-0 z-50 flex items-center justify-center p-4',
          'bg-black/50 backdrop-blur-sm',
          'animate-in fade-in duration-200'
        )}
        onClick={onClose}
      >
        {/* 모달 컨텐츠 */}
        <div
          className={cn(
            'relative w-full max-w-md rounded-2xl shadow-2xl',
            'animate-in zoom-in-95 duration-300',
            isDark ? 'bg-secondary border border-border' : 'bg-white'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 헤더 */}
          <div
            className={cn(
              'flex items-center gap-3 px-6 py-5 border-b',
              isDark ? 'border-border' : 'border-gray-200'
            )}
          >
            <span className="text-4xl">⏰</span>
            <div>
              <h2
                className={cn(
                  'text-xl font-bold',
                  isDark ? 'text-warning' : 'text-amber-600'
                )}
              >
                로그인이 만료되었습니다
              </h2>
              <p className={cn('text-sm mt-1', isDark ? 'text-muted-foreground' : 'text-gray-600')}>
                보안을 위해 일정 시간 후 자동 로그아웃됩니다
              </p>
            </div>
          </div>

          {/* 본문 */}
          <div className="px-6 py-5">
            {/* 상황 설명 */}
            <div
              className={cn(
                'rounded-lg p-4 mb-4',
                isDark ? 'bg-warning/10 border border-warning/20' : 'bg-amber-50 border border-amber-200'
              )}
            >
              <p className={cn('text-sm leading-relaxed', isDark ? 'text-foreground' : 'text-gray-800')}>
                <span className="font-semibold">"{intendedAction}"</span>을(를) 계속하려면 다시 로그인이
                필요합니다.
              </p>
            </div>

            {/* 해결 방법 */}
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="text-xl shrink-0">🔐</span>
                <div>
                  <h3
                    className={cn(
                      'font-semibold text-sm mb-1',
                      isDark ? 'text-foreground' : 'text-gray-900'
                    )}
                  >
                    로그인 후 자동으로 작업이 재개됩니다
                  </h3>
                  <p className={cn('text-xs', isDark ? 'text-muted-foreground' : 'text-gray-600')}>
                    다시 로그인하시면 "{intendedAction}" 작업을 이어서 진행할 수 있습니다.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="text-xl shrink-0">💡</span>
                <div>
                  <h3
                    className={cn(
                      'font-semibold text-sm mb-1',
                      isDark ? 'text-foreground' : 'text-gray-900'
                    )}
                  >
                    로그인 상태 유지 방법
                  </h3>
                  <p className={cn('text-xs', isDark ? 'text-muted-foreground' : 'text-gray-600')}>
                    브라우저를 닫지 않고 사용하시면 자동으로 로그인 상태가 유지됩니다.
                  </p>
                </div>
              </div>
            </div>

            {/* 버튼 그룹 */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={onClose}
                className={cn(
                  'flex-1 px-4 py-3 rounded-lg font-semibold text-sm',
                  'transition-all duration-200',
                  isDark
                    ? 'bg-secondary border border-border text-foreground hover:bg-secondary/80'
                    : 'bg-gray-100 border border-gray-300 text-gray-700 hover:bg-gray-200'
                )}
              >
                취소
              </button>
              <button
                onClick={onRelogin}
                className={cn(
                  'flex-1 px-4 py-3 rounded-lg font-bold text-sm text-white',
                  'bg-critical hover:bg-critical/90',
                  'transition-all duration-200',
                  'shadow-lg hover:shadow-xl'
                )}
              >
                다시 로그인
              </button>
            </div>

            {/* 안내 문구 */}
            <p
              className={cn(
                'text-xs text-center mt-4',
                isDark ? 'text-muted-foreground' : 'text-gray-500'
              )}
            >
              💡 로그인 없이도 병원 검색 기능은 계속 사용할 수 있습니다
            </p>
          </div>
        </div>
      </div>
    </>
  );
};
