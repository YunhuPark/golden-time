import React from 'react';
import { useAppStore } from '../../../infrastructure/state/store';
import { cn } from '../../../lib/utils';

interface EmptyHospitalListProps {
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onExpandRadius?: () => void;
}

/**
 * EmptyHospitalList Component
 * 검색 결과가 없을 때 표시되는 안내 UI
 */
export const EmptyHospitalList: React.FC<EmptyHospitalListProps> = ({
  hasActiveFilters,
  onClearFilters,
  onExpandRadius,
}) => {
  const { themeMode } = useAppStore();
  const isDark = themeMode === 'dark';

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      {/* 아이콘 */}
      <div
        className={cn(
          'w-24 h-24 rounded-full flex items-center justify-center mb-4',
          isDark ? 'bg-secondary' : 'bg-gray-100'
        )}
      >
        <span className="text-5xl">🏥</span>
      </div>

      {/* 메시지 */}
      <h3
        className={cn(
          'text-xl font-bold mb-2',
          isDark ? 'text-foreground' : 'text-gray-900'
        )}
      >
        {hasActiveFilters ? '조건에 맞는 병원이 없습니다' : '주변에 병원이 없습니다'}
      </h3>

      <p
        className={cn(
          'text-sm text-center mb-6 max-w-md',
          isDark ? 'text-muted-foreground' : 'text-gray-600'
        )}
      >
        {hasActiveFilters
          ? '필터 조건을 조정하거나 초기화하여 다시 검색해보세요.'
          : '현재 위치 주변에서 병원을 찾을 수 없습니다. 검색 범위를 넓혀보세요.'}
      </p>

      {/* 액션 버튼들 */}
      <div className="flex flex-col gap-3 w-full max-w-sm">
        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className={cn(
              'w-full py-3 px-4 rounded-lg font-semibold text-base transition-colors',
              isDark
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-[#1E88E5] text-white hover:bg-[#1976D2]'
            )}
          >
            🔄 필터 초기화
          </button>
        )}

        {onExpandRadius && (
          <button
            onClick={onExpandRadius}
            className={cn(
              'w-full py-3 px-4 rounded-lg font-semibold text-base transition-colors border-2',
              isDark
                ? 'bg-secondary text-foreground border-border hover:bg-secondary/80'
                : 'bg-white text-gray-900 border-gray-300 hover:bg-gray-50'
            )}
          >
            📍 검색 범위 확대 (반경 20km)
          </button>
        )}

        {!hasActiveFilters && !onExpandRadius && (
          <div
            className={cn(
              'w-full p-4 rounded-lg text-sm',
              isDark ? 'bg-secondary border border-border' : 'bg-gray-50 border border-gray-200'
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">💡</span>
              <span
                className={cn(
                  'font-semibold',
                  isDark ? 'text-foreground' : 'text-gray-900'
                )}
              >
                도움말
              </span>
            </div>
            <ul className="space-y-1">
              <li
                className={cn(
                  'text-xs',
                  isDark ? 'text-muted-foreground' : 'text-gray-600'
                )}
              >
                • 위치 정보가 정확한지 확인해주세요
              </li>
              <li
                className={cn(
                  'text-xs',
                  isDark ? 'text-muted-foreground' : 'text-gray-600'
                )}
              >
                • 필터를 사용 중이라면 조건을 완화해보세요
              </li>
              <li
                className={cn(
                  'text-xs',
                  isDark ? 'text-muted-foreground' : 'text-gray-600'
                )}
              >
                • 페이지를 새로고침하여 다시 시도해보세요
              </li>
            </ul>
          </div>
        )}
      </div>

      {/* 긴급 연락처 안내 */}
      <div
        className={cn(
          'mt-8 p-4 rounded-lg border-2 w-full max-w-sm',
          isDark
            ? 'bg-destructive/10 border-destructive/30'
            : 'bg-red-50 border-red-200'
        )}
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">🚨</span>
          <span
            className={cn(
              'font-bold text-base',
              isDark ? 'text-destructive' : 'text-red-700'
            )}
          >
            긴급 상황이신가요?
          </span>
        </div>
        <p
          className={cn(
            'text-sm mb-3',
            isDark ? 'text-muted-foreground' : 'text-red-600'
          )}
        >
          생명이 위급한 상황이라면 즉시 119에 연락하세요.
        </p>
        <a
          href="tel:119"
          className={cn(
            'w-full py-2 px-4 rounded-md font-bold text-base flex items-center justify-center gap-2 transition-colors',
            isDark
              ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
              : 'bg-red-600 text-white hover:bg-red-700'
          )}
        >
          📞 119 전화하기
        </a>
      </div>
    </div>
  );
};
