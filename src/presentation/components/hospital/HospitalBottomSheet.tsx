import React from 'react';
import { Hospital } from '../../../domain/entities/Hospital';
import { BottomSheet } from '../common/BottomSheet';
import { Button } from '../ui/button';
import { cn } from '../../../lib/utils';
import { useAppStore } from '../../../infrastructure/state/store';

interface HospitalBottomSheetProps {
  hospital: Hospital | null;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * HospitalBottomSheet Component
 * 마커 클릭 시 표시되는 병원 상세 정보 Bottom Sheet
 */
export const HospitalBottomSheet: React.FC<HospitalBottomSheetProps> = ({
  hospital,
  isOpen,
  onClose,
}) => {
  const { themeMode } = useAppStore();
  const isDark = themeMode === 'dark';

  if (!hospital) return null;

  // 전화 걸기
  const handleCall = () => {
    const phoneNumber = hospital.getCallablePhoneNumber();
    if (phoneNumber) {
      window.location.href = `tel:${phoneNumber}`;
    }
  };

  // 길찾기 (카카오맵)
  const handleNavigate = () => {
    const { latitude, longitude } = hospital.coordinates;
    const kakaoMapUrl = `https://map.kakao.com/link/to/${encodeURIComponent(hospital.name)},${latitude},${longitude}`;
    window.open(kakaoMapUrl, '_blank');
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      {/* 병원명 */}
      <h2
        className={cn(
          'text-2xl font-bold mb-3',
          isDark ? 'text-foreground' : 'text-gray-900'
        )}
      >
        {hospital.name}
      </h2>

      {/* 주소 */}
      <div className="mb-4">
        <p className={cn('text-sm', isDark ? 'text-muted-foreground' : 'text-gray-600')}>
          📍 {hospital.address}
        </p>
      </div>

      {/* 병상 정보 */}
      <div
        className={cn(
          'p-4 rounded-lg mb-4',
          isDark ? 'bg-secondary border border-border' : 'bg-gray-50 border border-gray-200'
        )}
      >
        <div className="flex items-center justify-between mb-2">
          <span className={cn('text-sm font-semibold', isDark ? 'text-foreground' : 'text-gray-700')}>
            가용 병상
          </span>
          <span className={cn('text-2xl font-bold', isDark ? 'text-safe' : 'text-green-600')}>
            {hospital.availableBeds} / {hospital.totalBeds}
          </span>
        </div>
      </div>

      {/* CT/MRI/수술 가용 여부 */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {/* CT 가용 여부 */}
        <div
          className={cn(
            'p-3 rounded-lg text-center',
            isDark ? 'bg-secondary border border-border' : 'bg-gray-50 border border-gray-200'
          )}
        >
          <div className="text-lg mb-1">
            {hospital.hasCT ? '✅' : '❌'}
          </div>
          <div className={cn('text-sm font-semibold', isDark ? 'text-foreground' : 'text-gray-700')}>
            CT
          </div>
          <div className={cn('text-xs', isDark ? 'text-muted-foreground' : 'text-gray-500')}>
            {hospital.hasCT ? '가능' : '불가'}
          </div>
        </div>

        {/* MRI 가용 여부 */}
        <div
          className={cn(
            'p-3 rounded-lg text-center',
            isDark ? 'bg-secondary border border-border' : 'bg-gray-50 border border-gray-200'
          )}
        >
          <div className="text-lg mb-1">
            {hospital.hasMRI ? '✅' : '❌'}
          </div>
          <div className={cn('text-sm font-semibold', isDark ? 'text-foreground' : 'text-gray-700')}>
            MRI
          </div>
          <div className={cn('text-xs', isDark ? 'text-muted-foreground' : 'text-gray-500')}>
            {hospital.hasMRI ? '가능' : '불가'}
          </div>
        </div>

        {/* 수술 가능 여부 */}
        <div
          className={cn(
            'p-3 rounded-lg text-center',
            isDark ? 'bg-secondary border border-border' : 'bg-gray-50 border border-gray-200'
          )}
        >
          <div className="text-lg mb-1">
            {hospital.hasSurgery ? '✅' : '❌'}
          </div>
          <div className={cn('text-sm font-semibold', isDark ? 'text-foreground' : 'text-gray-700')}>
            수술
          </div>
          <div className={cn('text-xs', isDark ? 'text-muted-foreground' : 'text-gray-500')}>
            {hospital.hasSurgery ? '가능' : '불가'}
          </div>
        </div>
      </div>

      {/* 전문 진료과 */}
      {hospital.specializations.length > 0 && (
        <div className="mb-4">
          <h3 className={cn('text-sm font-semibold mb-2', isDark ? 'text-foreground' : 'text-gray-700')}>
            🏥 전문 진료과
          </h3>
          <div className="flex flex-wrap gap-2">
            {hospital.specializations.slice(0, 5).map((spec, index) => (
              <span
                key={index}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium',
                  isDark
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                )}
              >
                {spec}
              </span>
            ))}
            {hospital.specializations.length > 5 && (
              <span
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium',
                  isDark ? 'text-muted-foreground' : 'text-gray-500'
                )}
              >
                +{hospital.specializations.length - 5}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 전화번호 */}
      <div className="mb-4">
        <div className={cn('text-sm font-semibold mb-1', isDark ? 'text-foreground' : 'text-gray-700')}>
          📞 전화번호
        </div>
        {hospital.phoneNumber && hospital.phoneNumber !== '전화번호 없음' ? (
          <div className="space-y-1">
            <p className={cn('text-sm', isDark ? 'text-muted-foreground' : 'text-gray-600')}>
              대표: {hospital.phoneNumber}
            </p>
            {hospital.emergencyPhoneNumber && hospital.emergencyPhoneNumber !== hospital.phoneNumber && (
              <p className={cn('text-sm font-semibold', isDark ? 'text-info' : 'text-[#1E88E5]')}>
                응급실: {hospital.emergencyPhoneNumber}
              </p>
            )}
          </div>
        ) : (
          <p className={cn('text-sm', isDark ? 'text-muted-foreground' : 'text-gray-500')}>
            전화번호 정보 없음
          </p>
        )}
      </div>

      {/* 액션 버튼 */}
      <div className="grid grid-cols-2 gap-3 mt-6">
        <Button
          onClick={handleCall}
          variant="info"
          size="lg"
          className="w-full h-14 text-base font-semibold"
        >
          📞 전화하기
        </Button>
        <Button
          onClick={handleNavigate}
          variant="warning"
          size="lg"
          className="w-full h-14 text-base font-semibold"
        >
          🗺️ 길찾기
        </Button>
      </div>
    </BottomSheet>
  );
};
