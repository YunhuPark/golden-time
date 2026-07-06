import React, { useEffect, useState, useMemo } from 'react';
import { useGeolocation } from '../hooks/useGeolocation';
import { useAuth } from '../hooks/useAuth';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useAppStore } from '../../infrastructure/state/store';
import { HospitalList } from '../components/hospital/HospitalList';
import { HospitalDetailModal } from '../components/hospital/HospitalDetailModal';
import { HospitalBottomSheet } from '../components/hospital/HospitalBottomSheet';
import { HospitalFilterPanel } from '../components/hospital/HospitalFilterPanel';
import { FavoritesBottomSheet } from '../components/hospital/FavoritesBottomSheet';
import { EmptyHospitalList } from '../components/hospital/EmptyHospitalList';
import { KakaoMap } from '../components/map/KakaoMap';
import { LoginModal } from '../components/auth/LoginModal';
import { ProfilePage } from './ProfilePage';
import { EcgLoader } from '../components/common/EcgLoader';
import { ThemeToggle } from '../components/common/ThemeToggle';
import { LocationPermissionPrompt } from '../components/common/LocationPermissionPrompt';
import { NetworkStatusBanner } from '../components/common/NetworkStatusBanner';
import { lightTheme, darkTheme } from '../styles/theme';
import { GetNearbyHospitals } from '../../domain/usecases/GetNearbyHospitals';
import { HospitalRepositoryImpl } from '../../data/repositories/HospitalRepositoryImpl';
import { EGenApiClient } from '../../data/datasources/remote/EGenApiClient';
import { HospitalCache } from '../../infrastructure/cache/HospitalCache';
import { logError, logEvent } from '../../infrastructure/monitoring/sentry';
import { supabase } from '../../infrastructure/supabase/supabaseClient';
import { Hospital } from '../../domain/entities/Hospital';
import { applyFilters } from '../../domain/types/HospitalFilter';

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

  // 현재 테마
  const theme = themeMode === 'light' ? lightTheme : darkTheme;

  // 위치 정보 획득
  const { location, error, isLoading: isLoadingLocation } = useGeolocation();

  // 네트워크 상태 감지
  const { isOffline, justReconnected } = useNetworkStatus();

  // 인증 상태
  const { user: authUser, signOut } = useAuth();

  // URL 쿼리 파라미터 확인 (Medical AI 연동)
  const [triageLevel, setTriageLevel] = useState<string | null>(null);
  const [targetDisease, setTargetDisease] = useState<string | null>(null);
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const triage = params.get('triage');
    const disease = params.get('disease');
    
    if (disease) {
      setTargetDisease(disease);
    }
    
    if (triage) {
      setTriageLevel(triage);
      
      // RED 응급도일 경우 자동 필터링 적용
      if (triage === 'RED') {
        // 기존 상태가 초기화되기 전에 약간의 지연 후 필터 적용
        setTimeout(() => {
          const store = useAppStore.getState();
          store.setFilters({
            ...store.filters,
            hasAvailableBeds: true,
            hasSurgery: true, // 수술 가능 병원 우선
          });
        }, 100);
      }
    }
  }, []);

  // 인증 상태 동기화
  useEffect(() => {
    setUser(authUser);
  }, [authUser, setUser]);

  // 테마 모드 동기화 (body data-theme 속성 업데이트)
  useEffect(() => {
    document.body.setAttribute('data-theme', themeMode);
  }, [themeMode]);

  // 로그아웃 핸들러
  const handleLogout = async () => {
    await signOut();
    alert('✅ 로그아웃되었습니다.');
    window.location.reload();
  };

  // 지도/리스트 뷰 토글 (모바일용)
  const [showMapView, setShowMapView] = useState(false);

  // 프로필 페이지 표시 여부
  const [showProfilePage, setShowProfilePage] = useState(false);

  // 병원 상세 모달 (리뷰 표시)
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [modalHospital, setModalHospital] = useState<Hospital | null>(null);

  // Bottom Sheet (지도 마커 클릭용)
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [bottomSheetHospital, setBottomSheetHospital] = useState<Hospital | null>(null);

  // Filter Bottom Sheet
  const [showFilterSheet, setShowFilterSheet] = useState(false);

  // Favorites Bottom Sheet
  const [showFavoritesSheet, setShowFavoritesSheet] = useState(false);

  // 강제 새로고침 플래그
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // 즐겨찾기한 병원 목록
  const [favoriteHospitals, setFavoriteHospitals] = useState<Hospital[]>([]);
  const [loadingFavorites, setLoadingFavorites] = useState(false);

  // 필터가 적용된 병원 목록 (useMemo로 최적화)
  const filteredHospitals = useMemo(() => {
    return applyFilters(hospitals, filters, userLocation);
  }, [hospitals, filters, userLocation]);

  // 위치 정보를 스토어에 동기화
  useEffect(() => {
    if (location) {
      setUserLocation(location);
    }
    if (error) {
      setLocationError(error.message);
    }
  }, [location, error, setUserLocation, setLocationError]);

  // 즐겨찾기한 병원 ID 목록 로드 및 매칭
  useEffect(() => {
    if (!user || hospitals.length === 0) {
      setFavoriteHospitals([]);
      return;
    }

    const loadFavorites = async () => {
      setLoadingFavorites(true);
      try {
        const { data, error: fetchError } = await supabase
          .from('favorites')
          .select('hospital_id')
          .eq('user_id', user.id);

        if (fetchError) {
          console.error('Failed to load favorites:', fetchError);

          // Supabase 에러 로깅
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

  // 병원 검색 (위치가 확정되면 자동 실행)
  useEffect(() => {
    if (!userLocation) return;

    const searchHospitals = async () => {
      setLoadingHospitals(true);

      try {
        // Use Case 실행
        const apiClient = new EGenApiClient();
        const repository = new HospitalRepositoryImpl(apiClient);
        const useCase = new GetNearbyHospitals(repository);

        const result = await useCase.execute(userLocation, targetDisease || undefined);

        // API 성공 시 캐시에 저장
        if (result.hospitals.length > 0) {
          HospitalCache.save(result.hospitals, userLocation, '서울특별시'); // TODO: 실제 지역 추론
        }

        setHospitals(result.hospitals, result.warning);

        // 초기 로드 완료 (경로 정보는 병원 카드에서 개별적으로 로드됨)
        console.log(`✅ Loaded ${result.hospitals.length} hospitals from API`);

        // 성공 이벤트 로깅
        logEvent('hospital_search_success', {
          hospital_count: result.hospitals.length,
          has_warning: !!result.warning,
        });
      } catch (err) {
        console.error('❌ Failed to search hospitals from API:', err);

        // 에러 로깅 (Sentry)
        logError(err as Error, {
          area: 'api',
          severity: 'high',
          extra: {
            location: {
              lat: userLocation.latitude,
              lon: userLocation.longitude,
            },
          },
        });

        // API 실패 시 캐시 데이터 시도
        const cached = HospitalCache.load(userLocation);

        if (cached) {
          console.warn(`⚠️ Using cached hospital data (${cached.ageMinutes} minutes old)`);

          // 캐시 사용 이벤트 로깅
          logEvent('hospital_search_fallback_cache', {
            cache_age_minutes: cached.ageMinutes,
            is_fresh: cached.isFresh,
            hospital_count: cached.hospitals.length,
          });

          setHospitals(cached.hospitals, {
            type: 'NETWORK_ERROR',
            message: `서버 연결에 실패하여 ${cached.ageMinutes}분 전 데이터를 사용하고 있습니다. ${cached.isFresh ? '' : '정보가 오래되었을 수 있습니다.'}`,
          });
        } else {
          // 캐시도 없으면 에러 표시
          logEvent('hospital_search_complete_failure', {
            has_cache: false,
          });

          setHospitals([], {
            type: 'NO_HOSPITALS_FOUND',
            message: '병원 검색 중 오류가 발생했습니다. 네트워크 연결을 확인하고 다시 시도해주세요.',
          });
        }
      } finally {
        setLoadingHospitals(false);
      }
    };

    searchHospitals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation, refreshTrigger]);

  // 119 긴급 호출
  const handleEmergencyCall = () => {
    if (window.confirm('119 구급대에 전화를 걸까요?')) {
      window.location.href = 'tel:119';
    }
  };

  // 병원 검색 새로고침
  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // 추가 병원 경로 정보 로드 (현재 사용하지 않음 - 향후 무한 스크롤 구현 시 사용)
  // const handleLoadMoreRoutes = async () => {
  //   if (!userLocation || isLoadingMoreRoutes) return;
  //   setLoadingMoreRoutes(true);
  //   try {
  //     const apiClient = new EGenApiClient();
  //     const repository = new HospitalRepositoryImpl(apiClient);
  //     const hospitalsWithRoutes = await repository.loadMoreRouteInfo(
  //       userLocation,
  //       hospitals,
  //       loadedRouteCount,
  //       10
  //     );
  //     updateHospitalsWithRoutes(hospitalsWithRoutes);
  //     setLoadedRouteCount(loadedRouteCount + hospitalsWithRoutes.length);
  //     console.log(`✅ Loaded route info for ${hospitalsWithRoutes.length} more hospitals`);
  //   } catch (err) {
  //     console.error('Failed to load more route info:', err);
  //   } finally {
  //     setLoadingMoreRoutes(false);
  //   }
  // };

  // 프로필 페이지가 표시되면 해당 페이지만 렌더링
  if (showProfilePage) {
    return <ProfilePage onBack={() => setShowProfilePage(false)} />;
  }

  // 초기 로딩 상태 (위치 + 병원 데이터)
  if (isLoadingLocation && !userLocation) {
    return <EcgLoader message="Acquiring GPS Coordinates..." />;
  }

  if (isLoadingHospitals && hospitals.length === 0) {
    return <EcgLoader message="Loading Emergency Facilities..." />;
  }

  return (
    <>
      {/* 네트워크 상태 배너 */}
      <NetworkStatusBanner
        isOffline={isOffline}
        justReconnected={justReconnected}
        onRefresh={handleRefresh}
      />

      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: '12px',
        paddingTop: isOffline || justReconnected ? '68px' : '12px', // 배너 높이만큼 여백 (모바일 최적화)
        backgroundColor: theme.background.primary,
        minHeight: '100vh',
        transition: 'background-color 0.3s ease, padding-top 0.3s ease',
      }}>
        {/* 헤더 - 모바일 최적화 */}
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
            {/* 테마 토글 */}
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

      {/* Medical AI 연동 알림 배너 */}
      {triageLevel === 'RED' && (
        <div style={{
          backgroundColor: '#ef4444',
          color: 'white',
          padding: '12px 16px',
          borderRadius: '10px',
          marginBottom: '16px',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)',
          animation: 'pulse 2s infinite'
        }}>
          <span style={{ fontSize: '20px' }}>🚨</span>
          <div>
            <div style={{ fontSize: '15px' }}>[AI 분석 완료] 초응급(RED) 환자 이송 모드</div>
            <div style={{ fontSize: '12px', fontWeight: 'normal', opacity: 0.9, marginTop: '2px' }}>
              수술 가능한 중환자실(ICU) 빈 병상을 최우선 탐색합니다.
            </div>
          </div>
        </div>
      )}

      {/* 긴급 호출 버튼 (항상 표시) - 모바일 최적화 */}
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

      {/* 위치 정보 에러 */}
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

      {/* 필터 & 즐겨찾기 버튼 */}
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

      {/* 뷰 전환 버튼 (모바일용) */}
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


      {/* 지도 뷰 */}
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

      {/* 병원 목록 뷰 */}
      {!showMapView && (
        <>
          {filteredHospitals.length === 0 && !isLoadingHospitals ? (
            <EmptyHospitalList
              hasActiveFilters={Object.values(filters).some(v => v)}
              onClearFilters={() => useAppStore.getState().clearFilters()}
              onExpandRadius={undefined} // TODO: 반경 확대 기능 구현 시 추가
            />
          ) : (
            <HospitalList
              hospitals={filteredHospitals}
              userLocation={userLocation}
              warning={searchWarning}
              isLoading={isLoadingHospitals}
              sortOption={sortOption}
              targetDisease={targetDisease}
              onSortChange={setSortOption}
              onHospitalClick={(hospital) => {
                setSelectedHospital(hospital);
                setModalHospital(hospital);
                setShowDetailModal(true);
              }}
            />
          )}
        </>
      )}

      {/* 로그인 모달 */}
      <LoginModal />

      {/* 병원 상세 모달 (리뷰) - 목록 뷰용 */}
      {showDetailModal && modalHospital && (
        <HospitalDetailModal
          hospital={modalHospital}
          onClose={() => {
            setShowDetailModal(false);
            setModalHospital(null);
          }}
        />
      )}

      {/* Bottom Sheet (지도 마커 클릭용) */}
      <HospitalBottomSheet
        hospital={bottomSheetHospital}
        isOpen={showBottomSheet}
        onClose={() => {
          setShowBottomSheet(false);
          setBottomSheetHospital(null);
        }}
      />

      {/* Filter Bottom Sheet */}
      <HospitalFilterPanel
        isOpen={showFilterSheet}
        onClose={() => setShowFilterSheet(false)}
      />

      {/* Favorites Bottom Sheet */}
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
