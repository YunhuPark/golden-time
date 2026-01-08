import React from 'react';
import { useAppStore } from '../../../infrastructure/state/store';
import { cn } from '../../../lib/utils';
import { HospitalFilters } from '../../../domain/types/HospitalFilter';
import { BottomSheet } from '../common/BottomSheet';

interface FilterOption {
  key: keyof HospitalFilters;
  label: string;
  icon: string;
  description: string;
}

const FILTER_OPTIONS: FilterOption[] = [
  { key: 'hasCT', label: 'CT 촬영 가능', icon: '🔬', description: 'CT 장비가 있는 병원만 표시' },
  { key: 'hasMRI', label: 'MRI 촬영 가능', icon: '🧲', description: 'MRI 장비가 있는 병원만 표시' },
  { key: 'hasSurgery', label: '수술 가능', icon: '🔪', description: '수술실이 있는 병원만 표시' },
  { key: 'is24Hours', label: '24시간 운영', icon: '🕐', description: '현재 운영 중인 병원만 표시' },
  { key: 'hasAvailableBeds', label: '병상 여유 있음', icon: '🛏️', description: '가용 병상이 있는 병원만 표시' },
  { key: 'within10km', label: '10km 이내', icon: '📍', description: '현재 위치에서 10km 이내 병원만 표시' },
];

interface HospitalFilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HospitalFilterPanel: React.FC<HospitalFilterPanelProps> = ({ isOpen, onClose }) => {
  const { filters, toggleFilter, clearFilters, themeMode } = useAppStore();
  const isDark = themeMode === 'dark';

  // 활성화된 필터 개수 계산
  const activeFilterCount = Object.values(filters).filter((v) => v).length;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} maxHeight="75vh">
      <div className="px-4 py-3">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔍</span>
            <h2 className={cn('text-xl font-bold', isDark ? 'text-foreground' : 'text-gray-900')}>
              필터
            </h2>
            {activeFilterCount > 0 && (
              <span className={cn(
                'px-2 py-0.5 rounded-full text-xs font-bold',
                isDark ? 'bg-primary/20 text-primary' : 'bg-[#1E88E5]/10 text-[#1E88E5]'
              )}>
                {activeFilterCount}개 적용
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className={cn(
                  'text-sm font-medium px-3 py-1.5 rounded-md transition-colors',
                  isDark
                    ? 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                )}
              >
                초기화
              </button>
            )}
            <button
              onClick={onClose}
              className={cn(
                'text-2xl w-8 h-8 flex items-center justify-center rounded-full transition-colors',
                isDark ? 'hover:bg-secondary' : 'hover:bg-gray-100'
              )}
            >
              ×
            </button>
          </div>
        </div>

        {/* 설명 */}
        <p className={cn('text-sm mb-4', isDark ? 'text-muted-foreground' : 'text-gray-600')}>
          원하는 조건의 병원만 검색하세요
        </p>

        {/* 필터 옵션 리스트 */}
        <div className="space-y-2">
          {FILTER_OPTIONS.map((option) => {
            const isActive = filters[option.key];
            return (
              <button
                key={option.key}
                onClick={() => toggleFilter(option.key)}
                className={cn(
                  'w-full flex items-start gap-3 p-4 rounded-xl border transition-all',
                  'hover:scale-[1.01] active:scale-[0.99]',
                  isActive
                    ? isDark
                      ? 'bg-primary/20 border-primary'
                      : 'bg-[#1E88E5]/10 border-[#1E88E5]'
                    : isDark
                    ? 'bg-card border-border hover:bg-secondary'
                    : 'bg-white border-gray-200 hover:bg-gray-50'
                )}
              >
                <span className="text-2xl mt-0.5">{option.icon}</span>
                <div className="flex-1 text-left">
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn(
                      'text-base font-semibold',
                      isActive
                        ? isDark ? 'text-primary-foreground' : 'text-[#1E88E5]'
                        : isDark ? 'text-foreground' : 'text-gray-900'
                    )}>
                      {option.label}
                    </span>
                    {isActive && (
                      <span className={cn(
                        'text-lg',
                        isDark ? 'text-primary' : 'text-[#1E88E5]'
                      )}>
                        ✓
                      </span>
                    )}
                  </div>
                  <p className={cn(
                    'text-sm',
                    isActive
                      ? isDark ? 'text-muted-foreground' : 'text-[#1E88E5]/70'
                      : isDark ? 'text-muted-foreground' : 'text-gray-500'
                  )}>
                    {option.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* 푸터 적용 버튼 */}
        <div className="mt-6 pt-4 border-t border-border">
          <button
            onClick={onClose}
            className={cn(
              'w-full py-3 rounded-xl font-semibold text-base transition-colors',
              isDark
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-[#1E88E5] text-white hover:bg-[#1976D2]'
            )}
          >
            {activeFilterCount > 0 ? `필터 적용 (${activeFilterCount}개)` : '닫기'}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
};
