import React, { useEffect, useState } from 'react';
import { Hospital, AvailabilityStatus } from '../../../domain/entities/Hospital';
import { Coordinates } from '../../../domain/valueObjects/Coordinates';
import { useAppStore } from '../../../infrastructure/state/store';
import { GeofencingService } from '../../../domain/services/GeofencingService';
import { HospitalAICardService } from '../../../domain/services/HospitalAICardService';
import { AIAnalysisContext } from '../../../domain/types/AIContext';
import { cn } from '../../../lib/utils';
import { Button } from '../ui/button';
import { SessionExpiredModal } from '../common/SessionExpiredModal';
import { logError } from '../../../infrastructure/monitoring/telemetry';

interface HospitalCardProps {
  hospital: Hospital;
  userLocation: Coordinates | null;
  aiContext?: AIAnalysisContext | null;
  routeStatus?: 'CALCULATING' | 'FAILED';
  onClick?: () => void;
}

export const HospitalCard: React.FC<HospitalCardProps> = ({
  hospital,
  userLocation,
  aiContext,
  routeStatus,
  onClick,
}) => {
  const { user, openLoginModal, themeMode } = useAppStore();
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const isDark = themeMode === 'dark';
  const geofenceActivatedRef = React.useRef(false);
  const supabaseEnabled = import.meta.env.VITE_SUPABASE_ENABLED === 'true';

  const isSessionExpiredError = (error: unknown): boolean => {
    if (!error || typeof error !== 'object') return false;
    const candidate = error as { message?: string; status?: number; code?: string };
    const message = candidate.message ?? String(error);
    return /jwt|token|expired|unauthorized|not authenticated/i.test(message) || candidate.status === 401 || candidate.code === 'PGRST301';
  };

  useEffect(() => {
    const checkFavorite = async () => {
      if (!user || !supabaseEnabled) {
        setIsFavorite(false);
        return;
      }
      try {
        const { supabase } = await import('../../../infrastructure/supabase/supabaseClient');
        const { data, error } = await supabase
          .from('favorites')
          .select('*')
          .eq('user_id', user.id)
          .eq('hospital_id', hospital.id)
          .maybeSingle();
        if (!error) setIsFavorite(!!data);
      } catch (err) {
        console.error('Check favorite error:', err);
      }
    };
    const idleCallback = window.requestIdleCallback
      ? window.requestIdleCallback(() => checkFavorite())
      : setTimeout(() => checkFavorite(), 100);
    return () => {
      if ('cancelIdleCallback' in window && typeof idleCallback === 'number') {
        (window as any).cancelIdleCallback(idleCallback);
      } else if (typeof idleCallback === 'number') {
        clearTimeout(idleCallback);
      }
    };
  }, [user, hospital.id, supabaseEnabled]);

  useEffect(() => {
    const loadRating = async () => {
      if (!supabaseEnabled) return;
      try {
        const { ReviewService } = await import('../../../domain/services/ReviewService');
        const result = await ReviewService.getHospitalRatingStats(hospital.id);
        if (result.success) {
          setAverageRating(result.stats.averageRating);
          setTotalReviews(result.stats.totalReviews);
        }
      } catch (err) {
        console.error('Failed to load rating:', err);
      }
    };
    const idleCallback = window.requestIdleCallback
      ? window.requestIdleCallback(() => loadRating())
      : setTimeout(() => loadRating(), 100);
    return () => {
      if ('cancelIdleCallback' in window && typeof idleCallback === 'number') {
        (window as any).cancelIdleCallback(idleCallback);
      } else if (typeof idleCallback === 'number') {
        clearTimeout(idleCallback);
      }
    };
  }, [hospital.id, supabaseEnabled]);

  const status = hospital.getAvailabilityStatus();
  const distance = userLocation ? (hospital.distanceFrom(userLocation) / 1000).toFixed(1) : null;
  const routeDurationMinutes = hospital.getRouteDurationMinutes();
  const estimatedArrivalTime = hospital.getEstimatedArrivalTime();

  const getStatusStyles = () => {
    switch (status) {
      case AvailabilityStatus.AVAILABLE:
        return { borderClass: 'border-safe', bgClass: isDark ? 'bg-safe/10' : 'bg-green-50', textClass: isDark ? 'text-safe' : 'text-green-900', label: '가용', badgeBg: 'bg-safe' };
      case AvailabilityStatus.LIMITED:
        return { borderClass: 'border-warning', bgClass: isDark ? 'bg-warning/10' : 'bg-amber-50', textClass: isDark ? 'text-warning' : 'text-amber-900', label: '제한', badgeBg: 'bg-warning' };
      case AvailabilityStatus.FULL:
        return { borderClass: 'border-critical', bgClass: isDark ? 'bg-critical/10' : 'bg-red-50', textClass: isDark ? 'text-critical' : 'text-red-900', label: '0병상', badgeBg: 'bg-critical' };
      default:
        return { borderClass: 'border-border', bgClass: isDark ? 'bg-muted-foreground/10' : 'bg-muted', textClass: 'text-muted-foreground', label: '확인 필요', badgeBg: 'bg-muted-foreground' };
    }
  };

  const styles = getStatusStyles();
  const aiMatch = HospitalAICardService.evaluateMatch(hospital, aiContext || null);
  const isAiRecommended = Boolean(aiMatch && aiMatch.maxScore > 0 && aiMatch.score / aiMatch.maxScore >= 0.66);

  const getRecommendationLabel = () => {
    if (aiContext?.triage === 'RED') return '🚨 RED 우선 이송 후보 · 뇌 병변 + 전신악화 대응';
    if (aiContext?.triage === 'YELLOW') return '⚠️ YELLOW 병원 후보 · 뇌 병변 대응';
    if (aiContext?.primaryCondition === 'brain_lesion_demo') return '💡 뇌 병변 대응 후보';
    if (aiContext?.primaryCondition === 'sepsis_demo') return '💡 전신악화 대응 후보';
    return '💡 요구 역량 매칭';
  };

  const renderStars = (rating: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={cn('text-sm', star <= Math.round(rating) ? 'text-warning' : (isDark ? 'text-muted-foreground/30' : 'text-gray-300'))}>★</span>
      ))}
    </div>
  );

  const recordVisit = async () => {
    if (!user || !supabaseEnabled) return;
    try {
      const { VisitHistoryService } = await import('../../../domain/services/VisitHistoryService');
      const { success, error } = await VisitHistoryService.addVisit({
        userId: user.id,
        hospitalId: hospital.id,
        hospitalName: hospital.name,
        hospitalAddress: hospital.address,
      });
      if (success) alert('✅ 방문 기록이 추가되었습니다.');
      else throw new Error(error);
    } catch (error) {
      console.error('Failed to record visit:', error);
      alert('방문 기록 추가 중 오류가 발생했습니다.');
    }
  };

  const handleCall = (e: React.MouseEvent) => {
    e.stopPropagation();
    const phoneNumber = hospital.getCallablePhoneNumber();
    if (phoneNumber) window.location.href = `tel:${phoneNumber}`;
  };

  const handleFavoriteToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      openLoginModal('즐겨찾기');
      return;
    }
    if (!supabaseEnabled) {
      openLoginModal('즐겨찾기');
      return;
    }
    setFavoriteLoading(true);
    try {
      const { supabase } = await import('../../../infrastructure/supabase/supabaseClient');
      if (isFavorite) {
        const { error } = await supabase.from('favorites').delete().eq('user_id', user.id).eq('hospital_id', hospital.id);
        if (error) throw error;
        setIsFavorite(false);
      } else {
        const { error } = await supabase.from('favorites').insert({
          user_id: user.id,
          hospital_id: hospital.id,
          hospital_name: hospital.name,
          hospital_address: hospital.address,
        });
        if (error) throw error;
        setIsFavorite(true);
      }
    } catch (error: any) {
      if (isSessionExpiredError(error)) {
        setShowSessionModal(true);
        logError(error, { area: 'auth', severity: 'medium', extra: { operation: 'toggleFavorite', hospital: hospital.name } });
      } else {
        alert('즐겨찾기 처리 중 오류가 발생했습니다.');
      }
    } finally {
      setFavoriteLoading(false);
    }
  };

  const handleRelogin = () => {
    setShowSessionModal(false);
    openLoginModal('즐겨찾기');
  };

  const handleNavigate = (e: React.MouseEvent) => {
    e.stopPropagation();
    const { latitude, longitude } = hospital.coordinates;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (user) {
      const geofencing = GeofencingService.getInstance();
      geofenceActivatedRef.current = false;
      if (!geofencing.isMonitoring(hospital.id)) {
        geofencing.addGeofence(
          hospital.id,
          hospital.name,
          hospital.coordinates,
          {
            onEnter: (hospitalId, hospitalName) => {
              geofenceActivatedRef.current = true;
              if (window.confirm(`📍 ${hospitalName}에 도착하셨습니다!\n\n방문 기록을 남기시겠습니까?`)) recordVisit();
              geofencing.removeGeofence(hospitalId);
            },
          },
          100
        );
      }
    }

    const kakaoMapUrl = `https://map.kakao.com/link/to/${encodeURIComponent(hospital.name)},${latitude},${longitude}`;
    if (isMobile) {
      const kakaoNaviUrl = `kakaonavi://navigate?ep=${latitude},${longitude}&title=${encodeURIComponent(hospital.name)}`;
      const appOpenTimer = setTimeout(() => { window.location.href = kakaoMapUrl; }, 1500);
      window.location.href = kakaoNaviUrl;
      window.addEventListener('blur', () => clearTimeout(appOpenTimer), { once: true });
    } else {
      window.open(kakaoMapUrl, '_blank');
    }
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-lg sm:rounded-xl p-3 sm:p-4 mb-2 sm:mb-3 transition-all duration-300',
        'border-2 sm:border-4', styles.borderClass, styles.bgClass,
        onClick && 'cursor-pointer hover:shadow-lg',
        status === AvailabilityStatus.FULL && 'opacity-70',
        isDark && 'glass'
      )}
      role="article"
      aria-label={`${hospital.name} 병원 정보`}
    >
      <div className="flex flex-col mb-2 gap-1">
        {isAiRecommended && aiMatch && aiContext && (
          <div className={cn(
            'inline-flex items-center self-start px-2 py-1 text-[11px] sm:text-xs font-bold rounded-md border shadow-sm mb-1',
            aiContext.triage === 'RED' ? 'bg-red-100 text-red-800 border-red-300' : aiContext.triage === 'YELLOW' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' : 'bg-blue-100 text-blue-800 border-blue-300'
          )}>
            {getRecommendationLabel()} · 확인 자원 {aiMatch.matchedReasons.length}개
          </div>
        )}

        <div className="flex justify-between items-start gap-2">
          <h3 className="text-lg sm:text-xl font-bold text-foreground m-0 flex-1 min-w-0 break-words">{hospital.name}</h3>
          <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
            {routeStatus === 'CALCULATING' ? (
              <span className={cn('text-sm sm:text-base font-bold whitespace-nowrap animate-pulse', isDark ? 'text-info/70' : 'text-[#1E88E5]/70')}>🚗 경로 계산 중</span>
            ) : routeStatus === 'FAILED' || routeDurationMinutes == null ? (
              <span className="text-sm sm:text-base font-medium text-muted-foreground whitespace-nowrap">🚗 경로 시간 확인 필요</span>
            ) : (
              <span className={cn('text-base sm:text-lg font-bold whitespace-nowrap', isDark ? 'text-info' : 'text-[#1E88E5]')}>🚗 {routeDurationMinutes}분</span>
            )}
            {distance && <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">{distance}km</span>}
          </div>
        </div>
      </div>

      {totalReviews > 0 && (
        <div className="flex items-center gap-1.5 mb-2">
          {renderStars(averageRating)}
          <span className="text-sm font-semibold text-foreground">{averageRating.toFixed(1)}</span>
          <span className="text-[13px] text-muted-foreground">({totalReviews}개의 리뷰)</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex items-baseline gap-1">
          <span className={cn('text-xl sm:text-2xl font-bold', styles.textClass)}>{hospital.availableBeds}</span>
          <span className="text-sm sm:text-base text-muted-foreground">응급실 가용병상</span>
        </div>
        <span className={cn('text-xs sm:text-sm font-semibold px-2 py-1 rounded text-white', styles.badgeBg)}>{styles.label}</span>
        {hospital.icuAvailableBeds > 0 && (
          <span className="text-[11px] sm:text-xs px-2 py-1 rounded border border-blue-500/50 text-blue-300">일반 ICU {hospital.icuAvailableBeds}</span>
        )}
        {hospital.neuroIcuAvailableBeds > 0 && (
          <span className="text-[11px] sm:text-xs px-2 py-1 rounded border border-violet-500/50 text-violet-300">신경 ICU {hospital.neuroIcuAvailableBeds}</span>
        )}
      </div>

      <p className="text-xs sm:text-sm text-muted-foreground my-2 break-words">📍 {hospital.address}</p>

      {isAiRecommended && aiMatch && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {aiMatch.matchedReasons.map((reason, idx) => (
            <span key={`match-${idx}`} className={cn('text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-medium border', isDark ? 'bg-blue-900/30 text-blue-300 border-blue-800' : 'bg-blue-50 text-blue-700 border-blue-200')}>✓ {reason}</span>
          ))}
          {aiMatch.unconfirmedReasons.map((reason, idx) => (
            <span key={`unconf-${idx}`} className={cn('text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-medium border', isDark ? 'bg-gray-800 text-gray-400 border-gray-700' : 'bg-gray-100 text-gray-500 border-gray-200')}>? {reason}</span>
          ))}
        </div>
      )}

      {hospital.specializations.length > 0 && (
        <div className="text-xs sm:text-[13px] text-muted-foreground mb-3 break-words">🏥 {hospital.specializations.slice(0, 3).join(', ')}{hospital.specializations.length > 3 && ' 외'}</div>
      )}
      {hospital.traumaLevel && (
        <div className="text-xs sm:text-[13px] text-muted-foreground mb-3">🚑 {hospital.traumaLevel === 1 ? '권역외상센터' : hospital.traumaLevel === 2 ? '지역외상센터' : '지역응급의료센터'}</div>
      )}
      {estimatedArrivalTime && (
        <div className={cn('text-xs sm:text-sm font-semibold mb-3 p-2 rounded-md', isDark ? 'text-info bg-info/10' : 'text-[#1E88E5] bg-blue-50')}>
          ⏱️ 예상 도착: {estimatedArrivalTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}

      <div className="flex gap-1.5 sm:gap-2 mt-3">
        <Button onClick={handleFavoriteToggle} disabled={favoriteLoading} variant={isFavorite ? 'destructive' : 'outline'} size="lg" className={cn('w-12 sm:w-14 h-10 sm:h-12 text-lg sm:text-xl', !isFavorite && isDark && 'bg-secondary')} aria-label={isFavorite ? '즐겨찾기 제거' : '즐겨찾기 추가'}>{isFavorite ? '⭐' : '☆'}</Button>
        <Button onClick={handleCall} variant="info" size="lg" className="flex-1 h-10 sm:h-12 text-sm sm:text-base font-semibold" aria-label={`${hospital.name} 전화 걸기`}>📞 전화</Button>
        <Button onClick={handleNavigate} variant="warning" size="lg" className="flex-1 h-10 sm:h-12 text-sm sm:text-base font-semibold" aria-label={`${hospital.name} 경로 안내`}>🗺️ 길안내</Button>
      </div>

      <div className="text-[10px] sm:text-xs text-muted-foreground text-center mt-2">
        E-Gen 실시간 응급의료 가용자원 · 갱신 {hospital.lastUpdated.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
      </div>
      {hospital.isDataStale(5) && (
        <div className={cn('text-xs text-center mt-1', isDark ? 'text-warning' : 'text-orange-500')}>⚠️ 정보가 5분 이상 지났습니다</div>
      )}

      <SessionExpiredModal isOpen={showSessionModal} onClose={() => setShowSessionModal(false)} intendedAction="즐겨찾기" onRelogin={handleRelogin} />
    </div>
  );
};
