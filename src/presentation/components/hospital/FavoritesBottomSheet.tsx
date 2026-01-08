import React from 'react';
import { Hospital } from '../../../domain/entities/Hospital';
import { Coordinates } from '../../../domain/valueObjects/Coordinates';
import { useAppStore } from '../../../infrastructure/state/store';
import { cn } from '../../../lib/utils';
import { BottomSheet } from '../common/BottomSheet';
import { HospitalList } from './HospitalList';

interface FavoritesBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  favoriteHospitals: Hospital[];
  userLocation: Coordinates | null;
  isLoading: boolean;
  onHospitalClick: (hospital: Hospital) => void;
}

/**
 * FavoritesBottomSheet
 * 즐겨찾기한 병원 목록을 표시하는 BottomSheet
 */
export const FavoritesBottomSheet: React.FC<FavoritesBottomSheetProps> = ({
  isOpen,
  onClose,
  favoriteHospitals,
  userLocation,
  isLoading,
  onHospitalClick,
}) => {
  const { themeMode, sortOption, setSortOption } = useAppStore();
  const isDark = themeMode === 'dark';

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} maxHeight="80vh">
      <div className="px-4 py-3">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⭐</span>
            <h2 className={cn('text-xl font-bold', isDark ? 'text-foreground' : 'text-gray-900')}>
              즐겨찾기 병원
            </h2>
            <span className={cn('text-sm', isDark ? 'text-muted-foreground' : 'text-gray-500')}>
              ({favoriteHospitals.length}개)
            </span>
          </div>
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

        {/* 설명 */}
        <p className={cn('text-sm mb-4', isDark ? 'text-muted-foreground' : 'text-gray-600')}>
          자주 가는 병원을 즐겨찾기에 추가하여 빠르게 확인하세요
        </p>

        {/* 즐겨찾기 목록 */}
        {isLoading ? (
          <div className="text-center py-8">
            <p className={cn('text-sm', isDark ? 'text-muted-foreground' : 'text-gray-500')}>
              즐겨찾기 로딩 중...
            </p>
          </div>
        ) : favoriteHospitals.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">⭐</div>
            <p className={cn('text-base font-semibold mb-2', isDark ? 'text-foreground' : 'text-gray-900')}>
              즐겨찾기한 병원이 없습니다
            </p>
            <p className={cn('text-sm', isDark ? 'text-muted-foreground' : 'text-gray-500')}>
              병원 상세 페이지에서 ⭐ 버튼을 눌러 즐겨찾기에 추가하세요
            </p>
          </div>
        ) : (
          <div className={cn(
            'rounded-lg border overflow-hidden',
            isDark ? 'bg-card border-border' : 'bg-white border-gray-200'
          )}>
            <HospitalList
              hospitals={favoriteHospitals}
              userLocation={userLocation}
              warning={null}
              isLoading={false}
              sortOption={sortOption}
              onSortChange={setSortOption}
              onHospitalClick={onHospitalClick}
            />
          </div>
        )}
      </div>
    </BottomSheet>
  );
};
