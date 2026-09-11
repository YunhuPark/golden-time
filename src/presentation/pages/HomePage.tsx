import React, { useEffect, useState, useMemo } from 'react';
import { useGeolocation } from '../hooks/useGeolocation';
import { useAuth } from '../hooks/useAuth';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useAppStore } from '../../infrastructure/state/store';
import { HospitalList } from '../components/hospital/HospitalList';
const HospitalDetailModal = React.lazy(() => import('../components/hospital/HospitalDetailModal').then((m) => ({ default: m.HospitalDetailModal })));
import { HospitalBottomSheet } from '../components/hospital/HospitalBottomSheet';
import { HospitalFilterPanel } from '../components/hospital/HospitalFilterPanel';
import { FavoritesBottomSheet } from '../components/hospital/FavoritesBottomSheet';
import { EmptyHospitalList } from '../components/hospital/EmptyHospitalList';
import { KakaoMap } from '../components/map/KakaoMap';
import { LoginModal } from '../components/auth/LoginModal';
const ProfilePage = React.lazy(() => import('./ProfilePage').then((m) => ({ default: m.ProfilePage })));
import { EcgLoader } from '../components/common/EcgLoader';
import { ThemeToggle } from '../components/common/ThemeToggle';
import { LocationPermissionPrompt } from '../components/common/LocationPermissionPrompt';
import { NetworkStatusBanner } from '../components/common/NetworkStatusBanner';
import { lightTheme, darkTheme } from '../styles/theme';
import { GetNearbyHospitals } from '../../domain/usecases/GetNearbyHospitals';
import { HospitalRepositoryImpl } from '../../data/repositories/HospitalRepositoryImpl';
import { EGenApiClient } from '../../data/datasources/remote/EGenApiClient';
import { HospitalCache } from '../../infrastructure/cache/HospitalCache';
import { logError, logEvent } from '../../infrastructure/monitoring/telemetry';
import { Hospital } from '../../domain/entities/Hospital';
import { applyFilters } from '../../domain/types/HospitalFilter';
import { HospitalRankingService } from '../../domain/services/HospitalRankingService';

/**
 * HomePage Component
 * 메인 페이지: 사용자 위치 기반 주변 병원 검색
 */
export const HomePage: React.FC = () => {
  const {
    themeMode,
    userLocation,
    hospitals,
    searchWarning,
    isLoadingHospitals,
    selectedHospital,
    sortOption,
    filters,
    user,
    setUserLocation,
    setLocationError,
    setHospitals,
    setLoadingHospitals,
    setSelectedHospital,
    setSortOption,
    setUser,
    openLoginModal,
  } = useAppStore();

  const theme = themeMode === 'light' ? lightTheme : darkTheme;
  const { location, error, isLoading: isLoadingLocation } = useGeolocation();
  const { isOffline, justReconnected } = useNetworkStatus();
  const { user: authUser, signOut } = useAuth();
  const [triageLevel, setTriageLevel] = useState<string | null>(null);
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const conditionStr = params.get('primaryCondition') || params.get('condition') || params.get('disease');
    const parseArrayParam = (paramName: string): string[] => {
      const val = params.get(paramName);
      if (!val) return [];
      try {
        return decodeURIComponent(val).split(',').map(s => s.trim()).filter(Boolean);
      } catch {
        return val.split(',').map(s => s.trim()).filter(Boolean);
      }
    };

    const triage = params.get('triage');
    const analysisMode = params.get('analysisMode');
    const clinicalValidation = params.get('clinicalValidation') === 'true';
    const aiContext = {
      triage: triage,
      primaryCondition: conditionStr,
      secondaryConditions: parseArrayParam('secondaryConditions'),
      analysisMode: analysisMode,
      analysisSources: parseArrayParam('analysisSources'),
      capabilities: parseArrayParam('capabilities'),
      specialties: parseArrayParam('specialties'),
      clinicalValidation: clinicalValidation
    };

    const isAiMode = analysisMode === 'ai_triage' || analysisMode === 'synthetic_demo' || conditionStr !== null;
    if (isAiMode) {
      useAppStore.getState().setAiContext(aiContext);
    }

    if (triage) {
      setTriageLevel(triage);
    }
  }, []);

  useEffect(() => {
    setUser(authUser);
  }, [authUser, setUser]);

  useEffect(() => {
    document.body.setAttribute('data-theme', themeMode);
  }, [themeMode]);

  const handleLogout = async () => {
    await signOut();
    alert('✅ 로그아웃되었습니다.');
    window.location.reload();
  };

  const [showMapView, setShowMapView] = useState(false);
  const [showProfilePage, setShowProfilePage] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [modalHospital, setModalHospital] = useState<Hospital | null>(null);
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [bottomSheetHospital, setBottomSheetHospital] = useState<Hospital | null>(null);
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [showFavoritesSheet, setShowFavoritesSheet] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [routeCalcStatus, setRouteCalcStatus] = useState<Record<string, 'CALCULATING' | 'FAILED'>>({});
  const searchRequestIdRef = React.useRef(0);
  const [favoriteHospitals, setFavoriteHospitals] = useState<Hospital[]>([]);
  const [loadingFavorites, setLoadingFavorites] = useState(false);

  const filteredHospitals = useMemo(() => {
    return applyFilters(hospitals, filters, userLocation);
  }, [hospitals, filters, userLocation]);

  useEffect(() => {
    if (location) {
      setUserLocation(location);
    }
    if (error) {
      setLocationError(error.message);
    }
  }, [location, error, setUserLocation, setLocationError]);

  useEffect(() => {
    if (!user || hospitals.length === 0) {
      setFavoriteHospitals([]);
      return;
    }

    const loadFavorites = async () => {
      setLoadingFavorites(true);
      try {
        if (import.meta.env.VITE_SUPABASE_ENABLED !== 'true') return;
        const { supabase } = await import('../../infrastructure/supabase/supabaseClient');
        const { data, error: fetchError } = await supabase
          .from('favorites')
          .select('hospital_id')
          .eq('user_id', user.id);

        if (fetchError) {
          console.error('Failed to load favorites:', fetchError);
          logError(new Error(`Favorites fetch error: ${fetchError.message}`), {
            area: 'auth',
            severity: 'medium',
            extra: { code: fetchError.code, details: fetchError.details },
          });
          return;
        }

        const favoriteIds = new Set(data?.map((fav) => fav.hospital_id) || []);
        const favHospitals = hospitals.filter((h) => favoriteIds.has(h.id));
        setFavoriteHospitals(favHospitals);
        logEvent('favorites_loaded', { count: favHospitals.length });
      } catch (err) {
        console.error('Error loading favorites:', err);
        logError(err as Error, {
          area: 'auth',
          severity: 'low',
        });
      } finally {
        setLoadingFavorites(false);
      }
    };

    loadFavorites();
  }, [user, hospitals]);

  useEffect(() => {
    if (!userLocation) return;
    let isCancelled = false;

    const searchHospitals = async () => {
      if (isCancelled) return;
      setLoadingHospitals(true);

      try {
        const apiClient = new EGenApiClient();
        const repository = new HospitalRepositoryImpl(apiClient);
        const useCase = new GetNearbyHospitals(repository);
        const { aiContext } = useAppStore.getState();

        const result = await useCase.execute(
          userLocation,
          aiContext,
          (initialHospitals) => {
            if (isCancelled || initialHospitals.length === 0) return;
            setHospitals(initialHospitals, null);
            console.log(`⚡ Showing ${initialHospitals.length} current-region hospitals while neighboring regions load`);
          }
        );

        if (result.hospitals.length > 0) {
          HospitalCache.save(result.hospitals, userLocation);
        }

        if (isCancelled) return;
        setHospitals(result.hospitals, result.warning);
        console.log(`✅ Showing ${result.hospitals.length} hospitals immediately; enriching top 10 route info in background`);

        searchRequestIdRef.current += 1;
        const currentReqId = searchRequestIdRef.current;
        const top10 = result.hospitals.slice(0, 10);
        const newRouteCalcStatus: Record<string, 'CALCULATING' | 'FAILED'> = {};
        top10.forEach(h => { newRouteCalcStatus[h.id] = 'CALCULATING'; });
        setRouteCalcStatus(newRouteCalcStatus);

        logEvent('hospital_search_success', {
          hospital_count: result.hospitals.length,
          has_warning: !!result.warning,
        });

        void (async () => {
          try {
            const fetchedHospitals = await repository.loadMoreRouteInfo(userLocation, result.hospitals, 0, 10);
            if (isCancelled || searchRequestIdRef.current !== currentReqId) return;

            setRouteCalcStatus(prev => {
              const nextStatus = { ...prev };
              fetchedHospitals.forEach(h => {
                if (h.routeDuration === undefined) {
                  nextStatus[h.id] = 'FAILED';
                } else {
                  delete nextStatus[h.id];
                }
              });
              return nextStatus;
            });

            const newAllHospitals = [...fetchedHospitals, ...result.hospitals.slice(10)];
            const finalRanked = HospitalRankingService.rankHospitals(newAllHospitals, aiContext);
            setHospitals(finalRanked, result.warning);
            console.log(`✅ Final ranking completed with route info for top 10 hospitals`);
          } catch (routeErr) {
            console.error('Failed to calculate routes in background:', routeErr);
            if (!isCancelled && searchRequestIdRef.current === currentReqId) {
              setRouteCalcStatus(prev => {
                const nextStatus = { ...prev };
                top10.forEach(h => { nextStatus[h.id] = 'FAILED'; });
                return nextStatus;
              });
            }
          }
        })();
      } catch (err) {
        console.error('❌ Failed to search hospitals from API:', err);
        if (isCancelled) return;

        logError(err as Error, {
          area: 'api',
          severity: 'high',
        });

        const cached = HospitalCache.load(userLocation);
        if (cached) {
          console.warn(`⚠️ Using cached hospital data (${cached.ageMinutes} minutes old)`);
          logEvent('hospital_search_fallback_cache', {
            cache_age_minutes: cached.ageMinutes,
            is_fresh: cached.isFresh,
            hospital_count: cached.hospitals.length,
          });
          setHospitals(cached.hospitals, {
            type: 'DATA_STALE',
            message: `서버 연결에 실패하여 ${cached.ageMinutes}분 전 데이터를 사용하고 있습니다. ${cached.isFresh ? '' : '정보가 오래되었을 수 있습니다.'}`,
          });
        } else {
          logEvent('hospital_search_complete_failure', {
            has_cache: false,
          });
          setHospitals([], {
            type: 'NO_HOSPITALS_FOUND',
            message: '병원 검색 중 오류가 발생했습니다. 네트워크 연결을 확인하고 다시 시도해주세요.',
          });
        }
      } finally {
        if (!isCancelled) {
          setLoadingHospitals(false);
        }
      }
    };

    searchHospitals();
    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation, refreshTrigger]);

  const handleEmergencyCall = () => {
    if (window.confirm('119 구급대에 전화를 걸까요?')) {
      window.location.href = 'tel:119';
    }
  };

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  if (showProfilePage) {
    return <ProfilePage onBack={() => setShowProfilePage(false)} />;
  }

  if (isLoadingLocation && !userLocation) {
    return <EcgLoader message="Acquiring GPS Coordinates..." />;
  }

  if (isLoadingHospitals && hospitals.length === 0) {
    return <EcgLoader message="Loading Emergency Facilities..." />;
  }

  return (
    <>
      <NetworkStatusBanner
        isOffline={isOffline}
        justReconnected={justReconnected}
        onRefresh={handleRefresh}
      />

      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: '12px',
        paddingTop: isOffline || justReconnected ? '68px' : '12px',
        backgroundColor: theme.background.primary,
        minHeight: '100vh',
        transition: 'background-color 0.3s ease, padding-top 0.3s ease',
      }}>
      <header style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', gap: '6px' }}>
          <h1 style={{
            fontSize: '20px',
            fontWeight: '700',
            color: theme.status.critical,
            margin: '8px 0',
            transition: 'color 0.3s ease',
            flexShrink: 1,
            minWidth: 0,
          }}>
            🏥 Golden Time
          </h1>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
            <ThemeToggle />

            {user && (
              <button
                onClick={() => setShowProfilePage(true)}
                style={{
                  padding: '5px 8px',
                  fontSize: '11px',
                  fontWeight: '600',
                  backgroundColor: '#007AFF',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '3px',
                  whiteSpace: 'nowrap',
                }}
              >
                👤 프로필
              </button>
            )}
            {user ? (
              <button
                onClick={handleLogout}
                style={{
                  padding: '5px 8px',
                  fontSize: '11px',
                  fontWeight: '600',
                  backgroundColor: '#F3F4F6',
                  color: '#374151',
                  border: '2px solid #E5E7EB',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '3px',
                  whiteSpace: 'nowrap',
                }}
              >
                🚪 로그아웃
              </button>
            ) : (
              <button
                onClick={() => openLoginModal()}
                style={{
                  padding: '6px 12px',
                  fontSize: '13px',
                  fontWeight: '600',
                  backgroundColor: '#FF3B30',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                🔐 로그인
              </button>
            )}
          </div>
        </div>
        <p style={{ fontSize: '13px', color: theme.text.secondary, margin: 0, textAlign: 'center', transition: 'color 0.3s ease' }}>
          실시간 응급실 병상 현황 및 경로 안내
        </p>
      </header>

      {(triageLevel === 'RED' || triageLevel === 'YELLOW') && (
        <div style={{
          backgroundColor: triageLevel === 'RED' ? '#ef4444' : '#eab308',
          color: triageLevel === 'RED' ? 'white' : '#1f2937',
          padding: '12px 16px',
          borderRadius: '10px',
          marginBottom: '16px',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: `0 4px 12px ${triageLevel === 'RED' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(234, 179, 8, 0.4)'}`,
          animation: triageLevel === 'RED' ? 'pulse 2s infinite' : 'none'
        }}>
          <span style={{ fontSize: '20px' }}>{triageLevel === 'RED' ? '🚨' : '⚠️'}</span>
          <div>
            <div style={{ fontSize: '15px' }}>
              {useAppStore.getState().aiContext?.analysisMode === 'synthetic_demo' ? '[합성 데이터 기반 데모] ' : '[AI 분석 완료] '}
              {triageLevel === 'RED' ? '초응급(RED) 환자 이송 모드' : '응급(YELLOW) 환자 집중 관찰'}
            </div>
            <div style={{ fontSize: '12px', fontWeight: 'normal', opacity: 0.9, marginTop: '2px' }}>
              {triageLevel === 'RED' ? '수술 가능한 중환자실(ICU) 빈 병상을 최우선 탐색합니다.' : '집중 모니터링 및 병원 역량 확인을 권고합니다. 임상 진단 아님.'}
            </div>
          </div>
        </div>
      )}

      <button
        onClick={handleEmergencyCall}
        style={{
          width: '100%',
          height: '54px',
          fontSize: '18px',
          fontWeight: '700',
          backgroundColor: '#FF3B30',
          color: '#fff',
          border: 'none',
          borderRadius: '10px',
          marginBottom: '16px',
          cursor: 'pointer',
          boxShadow: '0 3px 10px rgba(255, 59, 48, 0.3)',
        }}
        aria-label="119 긴급 전화"
      >
        🚨 119 구급대 호출
      </button>

      {error && (
        <LocationPermissionPrompt
          error={error}
          onRetry={handleRefresh}
        />
      )}

      {userLocation && (
        <div
          style={{
            backgroundColor: themeMode === 'dark' ? theme.background.secondary : '#E8F5E9',
            padding: '10px',
            borderRadius: '8px',
            marginBottom: '12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '8px',
            transition: 'background-color 0.3s ease',
          }}
        >
          <div style={{ fontSize: '13px', color: themeMode === 'dark' ? theme.status.safe : '#1B5E20', flex: 1, transition: 'color 0.3s ease', wordBreak: 'break-all' }}>
            ✅ 현재 위치: {userLocation.latitude.toFixed(4)}, {userLocation.longitude.toFixed(4)}
            {userLocation.accuracy && <div style={{ fontSize: '11px', marginTop: '2px' }}>정확도: ±{Math.round(userLocation.accuracy)}m</div>}
          </div>
          <button
            onClick={handleRefresh}
            disabled={isLoadingHospitals}
            style={{
              padding: '6px 10px',
              fontSize: '13px',
              fontWeight: '600',
              backgroundColor: isLoadingHospitals ? '#ccc' : '#007AFF',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: isLoadingHospitals ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
            aria-label="병원 검색 새로고침"
          >
            🔄 새로고침
          </button>
        </div>
      )}

      <div style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
        {user && favoriteHospitals.length > 0 && (
          <button
            onClick={() => setShowFavoritesSheet(true)}
            style={{
              flex: 1,
              padding: '12px 16px',
              fontSize: '15px',
              fontWeight: '600',
              backgroundColor: themeMode === 'dark' ? theme.background.secondary : '#FFF7ED',
              color: themeMode === 'dark' ? theme.text.primary : '#C2410C',
              border: `2px solid ${themeMode === 'dark' ? theme.border.primary : '#FDBA74'}`,
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
            }}
          >
            ⭐ 즐겨찾기 ({favoriteHospitals.length})
          </button>
        )}
        <button
          onClick={() => setShowFilterSheet(true)}
          style={{
            flex: user && favoriteHospitals.length > 0 ? 1 : 'unset',
            minWidth: user && favoriteHospitals.length > 0 ? 'unset' : '100%',
            padding: '12px 16px',
            fontSize: '15px',
            fontWeight: '600',
            backgroundColor: themeMode === 'dark' ? theme.background.secondary : '#fff',
            color: theme.text.primary,
            border: `2px solid ${theme.border.primary}`,
            borderRadius: '10px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all 0.2s ease',
          }}
        >
          🔍 필터 {Object.values(filters).filter(v => v).length > 0 && `(${Object.values(filters).filter(v => v).length})`}
        </button>
      </div>

      <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', width: '100%' }}>
        <button
          onClick={() => setShowMapView(false)}
          style={{
            flex: 1,
            padding: '12px 8px',
            fontSize: '14px',
            fontWeight: showMapView ? '400' : '700',
            backgroundColor: showMapView ? '#F3F4F6' : '#FF3B30',
            color: showMapView ? '#6B7280' : '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          📋 목록 보기
        </button>
        <button
          onClick={() => setShowMapView(!showMapView)}
          style={{
            flex: 1,
            padding: '12px 8px',
            fontSize: '14px',
            fontWeight: showMapView ? '700' : '400',
            backgroundColor: showMapView ? '#FF3B30' : '#F3F4F6',
            color: showMapView ? '#fff' : '#6B7280',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          🗺️ 지도 보기
        </button>
      </div>

      {showMapView && (
        <div style={{ marginBottom: '16px' }}>
          <KakaoMap
            userLocation={userLocation}
            hospitals={filteredHospitals}
            selectedHospitalId={selectedHospital?.id}
            onHospitalClick={(hospital) => {
              setSelectedHospital(hospital);
              setBottomSheetHospital(hospital);
              setShowBottomSheet(true);
            }}
            className="rounded-lg shadow-lg"
            style={{ height: '500px', borderRadius: '12px', overflow: 'hidden' }}
          />
        </div>
      )}

      {!showMapView && (
        <>
          {filteredHospitals.length === 0 && !isLoadingHospitals ? (
            <EmptyHospitalList
              hasActiveFilters={Object.values(filters).some(v => v)}
              onClearFilters={() => useAppStore.getState().clearFilters()}
              onExpandRadius={undefined}
            />
          ) : (
            <HospitalList
              hospitals={filteredHospitals}
              userLocation={userLocation}
              warning={searchWarning}
              isLoading={isLoadingHospitals}
              sortOption={sortOption}
              onSortChange={setSortOption}
              routeCalcStatus={routeCalcStatus}
              onHospitalClick={(hospital) => {
                setSelectedHospital(hospital);
                setModalHospital(hospital);
                setShowDetailModal(true);
              }}
            />
          )}
        </>
      )}

      <LoginModal />

      {showDetailModal && modalHospital && (
        <HospitalDetailModal
          hospital={modalHospital}
          onClose={() => {
            setShowDetailModal(false);
            setModalHospital(null);
          }}
        />
      )}

      <HospitalBottomSheet
        hospital={bottomSheetHospital}
        isOpen={showBottomSheet}
        onClose={() => {
          setShowBottomSheet(false);
          setBottomSheetHospital(null);
        }}
      />

      <HospitalFilterPanel
        isOpen={showFilterSheet}
        onClose={() => setShowFilterSheet(false)}
      />

      <FavoritesBottomSheet
        isOpen={showFavoritesSheet}
        onClose={() => setShowFavoritesSheet(false)}
        favoriteHospitals={favoriteHospitals}
        userLocation={userLocation}
        isLoading={loadingFavorites}
        onHospitalClick={(hospital) => {
          setSelectedHospital(hospital);
          setModalHospital(hospital);
          setShowDetailModal(true);
          setShowFavoritesSheet(false);
        }}
      />
      </div>
    </>
  );
};