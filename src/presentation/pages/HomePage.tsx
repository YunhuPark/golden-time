import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../infrastructure/state/store';
import { useGeolocation } from '../hooks/useGeolocation';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { HospitalRepositoryImpl } from '../../data/repositories/HospitalRepositoryImpl';
import { EGenApiClient } from '../../data/datasources/remote/EGenApiClient';
import { GetNearbyHospitals } from '../../domain/usecases/GetNearbyHospitals';
import { Hospital } from '../../domain/entities/Hospital';
import { HospitalCache } from '../../infrastructure/cache/HospitalCache';
import { logError, logEvent } from '../../infrastructure/monitoring/sentry';
import { supabase } from '../../infrastructure/supabase/supabaseClient';
import { recordFirstHospitalResults } from '../../infrastructure/monitoring/searchPerformance';
import { HospitalCard } from '../components/hospital/HospitalCard';
import { HospitalDetailModal } from '../components/hospital/HospitalDetailModal';
import { HospitalBottomSheet } from '../components/hospital/HospitalBottomSheet';
import { HospitalFilterPanel } from '../components/hospital/HospitalFilterPanel';
import { EcgLoader } from '../components/common/EcgLoader';
import { NetworkStatusBanner } from '../components/common/NetworkStatusBanner';
import { LocationPermissionPrompt } from '../components/common/LocationPermissionPrompt';
import { SessionExpiredModal } from '../components/common/SessionExpiredModal';
import { useAuth } from '../hooks/useAuth';
import { useAuthSession } from '../hooks/useAuthSession';

export default function HomePage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const {
    hospitals,
    setHospitals,
    selectedHospital,
    setSelectedHospital,
    filters,
    setFilters,
    resetFilters,
    aiContext,
  } = useAppStore();

  const { location: userLocation, error: locationError, loading: locationLoading, retry: retryLocation } = useGeolocation();
  const { isOffline } = useNetworkStatus();
  const { sessionExpired, closeSessionExpiredModal, reopenLogin } = useAuthSession();

  const [loadingHospitals, setLoadingHospitals] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [loadingFavorites, setLoadingFavorites] = useState(false);
  const [favoriteHospitals, setFavoriteHospitals] = useState<Hospital[]>([]);
  const [routeCalcStatus, setRouteCalcStatus] = useState<Record<string, 'CALCULATING' | 'FAILED'>>({});
  const [showLocationPermissionPrompt, setShowLocationPermissionPrompt] = useState(false);

  const searchRequestIdRef = useRef(0);

  const filteredHospitals = hospitals.filter((hospital) => {
    if (filters.onlyAvailable && !hospital.hasAvailableBeds()) return false;
    if (filters.hasCT && !hospital.hasCT) return false;
    if (filters.hasMRI && !hospital.hasMRI) return false;
    if (filters.hasSurgery && !hospital.hasSurgery) return false;
    if (filters.traumaCenterOnly && hospital.traumaLevel !== 1) return false;
    if (filters.minBeds > 0 && hospital.availableBeds < filters.minBeds) return false;
    return true;
  });

  const handleHospitalClick = useCallback((hospital: Hospital) => {
    setSelectedHospital(hospital);
  }, [setSelectedHospital]);

  const handleCloseDetail = useCallback(() => {
    setSelectedHospital(null);
  }, [setSelectedHospital]);

  useEffect(() => {
    if (!locationLoading && locationError && !userLocation) {
      setShowLocationPermissionPrompt(true);
    } else if (userLocation) {
      setShowLocationPermissionPrompt(false);
    }
  }, [locationLoading, locationError, userLocation]);

  useEffect(() => {
    if (!user || hospitals.length === 0) {
      setFavoriteHospitals([]);
      return;
    }

    let isCancelled = false;

    const loadFavorites = async () => {
      setLoadingFavorites(true);
      try {
        const { data, error: fetchError } = await supabase
          .from('favorites')
          .select('hospital_id')
          .eq('user_id', user.id);

        if (isCancelled) return;

        if (fetchError) {
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
        if (!isCancelled) setLoadingFavorites(false);
      }
    };

    loadFavorites();
    return () => {
      isCancelled = true;
    };
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
        const { aiContext: currentAiContext } = useAppStore.getState();

        const result = await useCase.execute(userLocation, currentAiContext);

        if (result.hospitals.length > 0) {
          HospitalCache.save(result.hospitals, userLocation);
        }

        if (isCancelled) return;
        setHospitals(result.hospitals, result.warning);
        recordFirstHospitalResults(result.hospitals.length);
        console.log(`✅ Showing ${result.hospitals.length} hospitals immediately; enriching top 10 route info in background`);

        searchRequestIdRef.current += 1;
        const currentReqId = searchRequestIdRef.current;
        const top10 = result.hospitals.slice(0, 10);

        const newRouteCalcStatus: Record<string, 'CALCULATING' | 'FAILED'> = {};
        top10.forEach((hospital) => {
          newRouteCalcStatus[hospital.id] = 'CALCULATING';
        });
        setRouteCalcStatus(newRouteCalcStatus);

        logEvent('hospital_search_success', {
          hospital_count: result.hospitals.length,
          has_warning: !!result.warning,
        });

        void (async () => {
          try {
            const fetchedHospitals = await repository.loadMoreRouteInfo(
              userLocation,
              result.hospitals,
              0,
              10
            );

            if (isCancelled || searchRequestIdRef.current !== currentReqId) return;

            setRouteCalcStatus((prev) => {
              const nextStatus = { ...prev };
              fetchedHospitals.forEach((hospital) => {
                if (hospital.routeDuration === undefined) {
                  nextStatus[hospital.id] = 'FAILED';
                } else {
                  delete nextStatus[hospital.id];
                }
              });
              return nextStatus;
            });

            const newAllHospitals = [...fetchedHospitals, ...result.hospitals.slice(10)];
            const { HospitalRankingService } = await import('../../domain/services/HospitalRankingService');
            const finalRanked = HospitalRankingService.rankHospitals(newAllHospitals, currentAiContext);

            setHospitals(finalRanked, result.warning);
            console.log('✅ Final ranking completed with route info for top 10 hospitals');
          } catch (routeErr) {
            console.error('Failed to calculate routes in background:', routeErr);
            if (!isCancelled && searchRequestIdRef.current === currentReqId) {
              setRouteCalcStatus((prev) => {
                const nextStatus = { ...prev };
                top10.forEach((hospital) => {
                  nextStatus[hospital.id] = 'FAILED';
                });
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
          extra: { has_location: true },
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
            type: 'API_ERROR',
            message: '병원 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.',
          });
        }
      } finally {
        if (!isCancelled) setLoadingHospitals(false);
      }
    };

    searchHospitals();
    return () => {
      isCancelled = true;
    };
  }, [userLocation, setHospitals]);

  const hasActiveFilters =
    filters.onlyAvailable ||
    filters.hasCT ||
    filters.hasMRI ||
    filters.hasSurgery ||
    filters.traumaCenterOnly ||
    filters.minBeds > 0;

  if (locationLoading && !userLocation) {
    return <EcgLoader message="현재 위치를 확인하고 있습니다" />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <NetworkStatusBanner />

      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-xl font-bold">Golden Time</h1>
            <p className="text-sm text-muted-foreground">실시간 응급실 검색</p>
          </div>
          <div className="flex items-center gap-2">
            {user && (
              <button
                type="button"
                onClick={() => navigate('/profile')}
                className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
              >
                프로필
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowFilters((value) => !value)}
              className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
            >
              필터{hasActiveFilters ? ' •' : ''}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4">
        {aiContext && (
          <div className="mb-4 rounded-lg border border-border bg-card p-4">
            <div className="text-sm font-semibold">외부 분석 컨텍스트 적용 중</div>
            <div className="mt-1 text-sm text-muted-foreground">
              {aiContext.primaryCondition || '상태 미지정'} · {aiContext.triage || '중증도 미지정'}
            </div>
          </div>
        )}

        {showFilters && (
          <div className="mb-4">
            <HospitalFilterPanel
              filters={filters}
              onChange={setFilters}
              onReset={resetFilters}
            />
          </div>
        )}

        {loadingHospitals && hospitals.length === 0 ? (
          <EcgLoader message="주변 응급실을 찾고 있습니다" />
        ) : filteredHospitals.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <p className="font-semibold">조건에 맞는 병원이 없습니다.</p>
            <button
              type="button"
              onClick={resetFilters}
              className="mt-4 rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
            >
              필터 초기화
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredHospitals.map((hospital) => (
              <HospitalCard
                key={hospital.id}
                hospital={hospital}
                isFavorite={favoriteHospitals.some((favorite) => favorite.id === hospital.id)}
                loadingFavorite={loadingFavorites}
                routeStatus={routeCalcStatus[hospital.id]}
                onClick={() => handleHospitalClick(hospital)}
              />
            ))}
          </div>
        )}
      </main>

      {selectedHospital && (
        <>
          <HospitalDetailModal hospital={selectedHospital} onClose={handleCloseDetail} />
          <HospitalBottomSheet hospital={selectedHospital} onClose={handleCloseDetail} />
        </>
      )}

      {showLocationPermissionPrompt && (
        <LocationPermissionPrompt
          error={locationError}
          onRetry={() => {
            setShowLocationPermissionPrompt(false);
            retryLocation();
          }}
          onClose={() => setShowLocationPermissionPrompt(false)}
        />
      )}

      <SessionExpiredModal
        open={sessionExpired}
        onClose={closeSessionExpiredModal}
        onRelogin={reopenLogin}
      />
    </div>
  );
}
