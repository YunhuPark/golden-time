import React, { useState, useEffect } from 'react';
import { Hospital, AvailabilityStatus } from '../../../domain/entities/Hospital';
import { Coordinates } from '../../../domain/valueObjects/Coordinates';
import { useAppStore } from '../../../infrastructure/state/store';
import { supabase } from '../../../infrastructure/supabase/supabaseClient';
import { VisitHistoryService } from '../../../domain/services/VisitHistoryService';
import { GeofencingService } from '../../../domain/services/GeofencingService';
import { ReviewService } from '../../../domain/services/ReviewService';
import { HospitalSpecialtyService } from '../../../domain/services/HospitalSpecialtyService';
import { cn } from '../../../lib/utils';
import { Button } from '../ui/button';
import { useAuthSession } from '../../hooks/useAuthSession';
import { SessionExpiredModal } from '../common/SessionExpiredModal';
import { logError } from '../../../infrastructure/monitoring/sentry';

interface HospitalCardProps {
  hospital: Hospital;
  userLocation: Coordinates | null;
  targetDisease?: string | null;
  onClick?: () => void;
}

/**
 * HospitalCard Component - shadcn/ui + Tailwind CSS
 * Emergency Control Center 디자인 with Glassmorphism
 *
 * UX 원칙 (응급 상황 최적화):
 * - 색상 코딩: 녹색(가능) / 노랑(제한) / 빨강(만실)
 * - 대형 폰트: 병상 수는 24px bold (가장 중요한 정보)
 * - 대형 터치 영역: 최소 48px 높이
 */
export const HospitalCard: React.FC<HospitalCardProps> = ({
  hospital,
  userLocation,
  targetDisease,
  onClick,
}) => {
  const { user, openLoginModal, themeMode } = useAppStore();
  const { handleSessionError } = useAuthSession();
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [showSessionModal, setShowSessionModal] = useState(false);

  const isDark = themeMode === 'dark';

  // Geofencing 작동 여부 추적 (useRef로 변경 - 함수 종료 후에도 유지)
  const geofenceActivatedRef = React.useRef(false);

  // 즐겨찾기 상태 초기 로드 (비동기, 논블로킹 - LCP 최적화)
  useEffect(() => {
    const checkFavorite = async () => {
      if (!user) {
        setIsFavorite(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('favorites')
          .select('*')
          .eq('user_id', user.id)
          .eq('hospital_id', hospital.id)
          .maybeSingle();

        if (error) {
          console.error('Failed to check favorite status:', error);
          return;
        }

        setIsFavorite(!!data);
      } catch (err) {
        console.error('Check favorite error:', err);
      }
    };

    // requestIdleCallback으로 유휴 시간에 로드 (Critical Path 차단 방지)
    const idleCallback = window.requestIdleCallback
      ? window.requestIdleCallback(() => checkFavorite())
      : setTimeout(() => checkFavorite(), 100);

    return () => {
      if ('cancelIdleCallback' in window && typeof idleCallback === 'number') {
        window.cancelIdleCallback(idleCallback);
      } else if (typeof idleCallback === 'number') {
        clearTimeout(idleCallback);
      }
    };
  }, [user, hospital.id]);

  // 평균 별점 로드 (비동기, 논블로킹 - LCP 최적화)
  useEffect(() => {
    const loadRating = async () => {
      try {
        const result = await ReviewService.getHospitalRatingStats(hospital.id);
        if (result.success) {
          setAverageRating(result.stats.averageRating);
          setTotalReviews(result.stats.totalReviews);
        }
      } catch (err) {
        console.error('Failed to load rating:', err);
      }
    };

    // requestIdleCallback으로 유휴 시간에 로드 (Critical Path 차단 방지)
    const idleCallback = window.requestIdleCallback
      ? window.requestIdleCallback(() => loadRating())
      : setTimeout(() => loadRating(), 100);

    return () => {
      if ('cancelIdleCallback' in window && typeof idleCallback === 'number') {
        window.cancelIdleCallback(idleCallback);
      } else if (typeof idleCallback === 'number') {
        clearTimeout(idleCallback);
      }
    };
  }, [hospital.id]);

  const status = hospital.getAvailabilityStatus();
  const distance = userLocation
    ? (hospital.distanceFrom(userLocation) / 1000).toFixed(1) // km
    : null;

  // 경로 소요시간 (분 단위)
  const routeDurationMinutes = hospital.getRouteDurationMinutes();

  // 예상 도착 시간
  const estimatedArrivalTime = hospital.getEstimatedArrivalTime();

  // 색상 스타일 결정
  const getStatusStyles = () => {
    switch (status) {
      case AvailabilityStatus.AVAILABLE:
        return {
          borderClass: 'border-safe',
          bgClass: isDark ? 'bg-safe/10' : 'bg-green-50',
          textClass: isDark ? 'text-safe' : 'text-green-900',
          label: '병상 가능',
          badgeBg: 'bg-safe',
        };
      case AvailabilityStatus.LIMITED:
        return {
          borderClass: 'border-warning',
          bgClass: isDark ? 'bg-warning/10' : 'bg-amber-50',
          textClass: isDark ? 'text-warning' : 'text-amber-900',
          label: '병상 제한',
          badgeBg: 'bg-warning',
        };
      case AvailabilityStatus.FULL:
        return {
          borderClass: 'border-critical',
          bgClass: isDark ? 'bg-critical/10' : 'bg-red-50',
          textClass: isDark ? 'text-critical' : 'text-red-900',
          label: '만실',
          badgeBg: 'bg-critical',
        };
      case AvailabilityStatus.UNKNOWN:
      default:
        return {
          borderClass: 'border-border',
          bgClass: isDark ? 'bg-muted-foreground/10' : 'bg-muted',
          textClass: 'text-muted-foreground',
          label: '정보 없음',
          badgeBg: 'bg-muted-foreground',
        };
    }
  };

  const styles = getStatusStyles();

  // 별점 렌더링 (작은 사이즈)
  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            className={cn(
              'text-sm',
              star <= Math.round(rating) ? 'text-warning' : (isDark ? 'text-muted-foreground/30' : 'text-gray-300')
            )}
          >
            ★
          </span>
        ))}
      </div>
    );
  };

  // 방문 기록 추가 (내부 함수)
  const recordVisit = async () => {
    if (!user) return;

    try {
      const { success, error } = await VisitHistoryService.addVisit({
        userId: user.id,
        hospitalId: hospital.id,
        hospitalName: hospital.name,
        hospitalAddress: hospital.address,
      });

      if (success) {
        alert('✅ 방문 기록이 추가되었습니다.');
      } else {
        throw new Error(error);
      }
    } catch (error) {
      console.error('Failed to record visit:', error);
      alert('방문 기록 추가 중 오류가 발생했습니다.');
    }
  };

  // 전화 걸기
  const handleCall = (e: React.MouseEvent) => {
    e.stopPropagation();
    const phoneNumber = hospital.getCallablePhoneNumber();
    if (phoneNumber) {
      window.location.href = `tel:${phoneNumber}`;
    }
  };

  // 즐겨찾기 토글 핸들러
  const handleFavoriteToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!user) {
      openLoginModal('즐겨찾기');
      return;
    }

    setFavoriteLoading(true);

    try {
      if (isFavorite) {
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('hospital_id', hospital.id);

        if (error) throw error;
        setIsFavorite(false);
        alert('☆ 즐겨찾기에서 제거되었습니다.');
      } else {
        const { error } = await supabase.from('favorites').insert({
          user_id: user.id,
          hospital_id: hospital.id,
          hospital_name: hospital.name,
          hospital_address: hospital.address,
        });

        if (error) throw error;
        setIsFavorite(true);
        alert('⭐ 즐겨찾기에 추가되었습니다!');
      }
    } catch (error: any) {
      console.error('Failed to toggle favorite:', error);

      // 세션 만료 감지
      if (handleSessionError(error)) {
        setShowSessionModal(true);
        logError(error, {
          area: 'auth',
          severity: 'medium',
          extra: {
            operation: 'toggleFavorite',
            context: 'session_expired',
            hospital: hospital.name,
          },
        });
      } else {
        alert('즐겨찾기 처리 중 오류가 발생했습니다.');
        logError(error, {
          area: 'api',
          severity: 'low',
          extra: {
            operation: 'toggleFavorite',
            hospital: hospital.name,
          },
        });
      }
    } finally {
      setFavoriteLoading(false);
    }
  };

  // 세션 만료 모달 - 재로그인 핸들러
  const handleRelogin = () => {
    setShowSessionModal(false);
    openLoginModal('즐겨찾기');
  };

  // 경로 안내 (Kakao Navi + Geofencing)
  const handleNavigate = (e: React.MouseEvent) => {
    e.stopPropagation();
    const { latitude, longitude } = hospital.coordinates;

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (user) {
      const geofencing = GeofencingService.getInstance();
      geofenceActivatedRef.current = false;

      if (!geofencing.isMonitoring(hospital.id)) {
        const result = geofencing.addGeofence(
          hospital.id,
          hospital.name,
          hospital.coordinates,
          {
            onEnter: (hospitalId, hospitalName) => {
              geofenceActivatedRef.current = true;

              const shouldRecord = window.confirm(
                `📍 ${hospitalName}에 도착하셨습니다!\n\n방문 기록을 남기시겠습니까?`
              );

              if (shouldRecord) {
                recordVisit();
              }

              geofencing.removeGeofence(hospitalId);
            },
          },
          100
        );

        if (result.success) {
          console.log(`📍 Geofencing activated for ${hospital.name}`);
        }
      }
    }

    if (isMobile) {
      const kakaoNaviUrl = `kakaonavi://navigate?ep=${latitude},${longitude}&title=${encodeURIComponent(hospital.name)}`;
      const kakaoMapUrl = `https://map.kakao.com/link/to/${encodeURIComponent(hospital.name)},${latitude},${longitude}`;

      const appOpenTimer = setTimeout(() => {
        window.location.href = kakaoMapUrl;
      }, 1500);

      window.location.href = kakaoNaviUrl;
      window.addEventListener('blur', () => clearTimeout(appOpenTimer), { once: true });
    } else {
      const kakaoMapUrl = `https://map.kakao.com/link/to/${encodeURIComponent(hospital.name)},${latitude},${longitude}`;
      window.open(kakaoMapUrl, '_blank');
    }
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-lg sm:rounded-xl p-3 sm:p-4 mb-2 sm:mb-3 transition-all duration-300',
        'border-2 sm:border-4',
        styles.borderClass,
        styles.bgClass,
        onClick && 'cursor-pointer hover:shadow-lg',
        status === AvailabilityStatus.FULL && 'opacity-70',
        isDark && 'glass' // glassmorphism effect in dark mode
      )}
      role="article"
      aria-label={`${hospital.name} 병원 정보`}
    >
      {/* 헤더: 병원명 + 소요시간/거리 */}
      <div className="flex flex-col mb-2 gap-1">
        {targetDisease && HospitalSpecialtyService.hasSpecialtyMatch(hospital, targetDisease) && (
          <div className="inline-flex items-center self-start px-2 py-1 bg-yellow-100 text-yellow-800 text-[11px] sm:text-xs font-bold rounded-md border border-yellow-300 shadow-sm mb-1">
            ✨ AI 추천: {targetDisease} 치료 적합 (거리·병상 종합 고려)
          </div>
        )}
        <div className="flex justify-between items-start gap-2">
          <h3 className="text-lg sm:text-xl font-bold text-foreground m-0 flex-1 min-w-0 break-words">
            {hospital.name}
          </h3>
          <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
            {routeDurationMinutes && (
              <span className={cn(
                'text-base sm:text-lg font-bold whitespace-nowrap',
                isDark ? 'text-info' : 'text-[#1E88E5]'
              )}>
                🚗 {routeDurationMinutes}분
              </span>
            )}
            {distance && (
              <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                {distance}km
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 평균 별점 표시 */}
      {totalReviews > 0 && (
        <div className="flex items-center gap-1.5 mb-2">
          {renderStars(averageRating)}
          <span className="text-sm font-semibold text-foreground">
            {averageRating.toFixed(1)}
          </span>
          <span className="text-[13px] text-muted-foreground">
            ({totalReviews}개의 리뷰)
          </span>
        </div>
      )}

      {/* 병상 정보 (가장 중요) */}
      <div className="flex items-center gap-2 sm:gap-3 mb-3">
        <div className="flex items-baseline gap-1">
          <span className={cn('text-xl sm:text-2xl font-bold', styles.textClass)}>
            {hospital.availableBeds}
          </span>
          <span className="text-sm sm:text-base text-muted-foreground">
            / {hospital.totalBeds} 병상
          </span>
        </div>
        <span
          className={cn(
            'text-xs sm:text-sm font-semibold px-2 py-1 rounded text-white',
            styles.badgeBg
          )}
        >
          {styles.label}
        </span>
      </div>

      {/* 주소 */}
      <p className="text-xs sm:text-sm text-muted-foreground my-2 break-words">
        📍 {hospital.address}
      </p>

      {/* 전문 진료과 */}
      {hospital.specializations.length > 0 && (
        <div className="text-xs sm:text-[13px] text-muted-foreground mb-3 break-words">
          🏥 {hospital.specializations.slice(0, 3).join(', ')}
          {hospital.specializations.length > 3 && ' 외'}
        </div>
      )}

      {/* 외상센터 등급 */}
      {hospital.traumaLevel && (
        <div className="text-xs sm:text-[13px] text-muted-foreground mb-3">
          🚑 {hospital.traumaLevel === 1 ? '권역외상센터' : hospital.traumaLevel === 2 ? '지역외상센터' : '지역응급의료센터'}
        </div>
      )}

      {/* 예상 도착 시간 */}
      {estimatedArrivalTime && (
        <div className={cn(
          'text-xs sm:text-sm font-semibold mb-3 p-2 rounded-md',
          isDark ? 'text-info bg-info/10' : 'text-[#1E88E5] bg-blue-50'
        )}>
          ⏱️ 예상 도착: {estimatedArrivalTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="flex gap-1.5 sm:gap-2 mt-3">
        <Button
          onClick={handleFavoriteToggle}
          disabled={favoriteLoading}
          variant={isFavorite ? 'destructive' : 'outline'}
          size="lg"
          className={cn(
            'w-12 sm:w-14 h-10 sm:h-12 text-lg sm:text-xl',
            !isFavorite && isDark && 'bg-secondary'
          )}
          aria-label={isFavorite ? '즐겨찾기 제거' : '즐겨찾기 추가'}
        >
          {isFavorite ? '⭐' : '☆'}
        </Button>
        <Button
          onClick={handleCall}
          variant="info"
          size="lg"
          className="flex-1 h-10 sm:h-12 text-sm sm:text-base font-semibold"
          aria-label={`${hospital.name} 전화 걸기`}
        >
          📞 전화
        </Button>
        <Button
          onClick={handleNavigate}
          variant="warning"
          size="lg"
          className="flex-1 h-10 sm:h-12 text-sm sm:text-base font-semibold"
          aria-label={`${hospital.name} 경로 안내`}
        >
          🗺️ 길안내
        </Button>
      </div>

      {/* 데이터 신선도 경고 */}
      {hospital.isDataStale(5) && (
        <div className={cn(
          'text-xs text-center mt-2',
          isDark ? 'text-warning' : 'text-orange-500'
        )}>
          ⚠️ 정보가 5분 이상 지났습니다
        </div>
      )}

      {/* 세션 만료 모달 */}
      <SessionExpiredModal
        isOpen={showSessionModal}
        onClose={() => setShowSessionModal(false)}
        intendedAction="즐겨찾기"
        onRelogin={handleRelogin}
      />
    </div>
  );
};
