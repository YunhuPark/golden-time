import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Hospital } from '../../domain/entities/Hospital';
import { Coordinates } from '../../domain/valueObjects/Coordinates';
import { HospitalSearchWarning } from '../../domain/usecases/GetNearbyHospitals';
import { SortOption } from '../../domain/types/SortOption';
import { User } from '@supabase/supabase-js';
import { ThemeMode } from '../../presentation/styles/theme';
import { HospitalFilters, DEFAULT_FILTERS } from '../../domain/types/HospitalFilter';

/**
 * Application State
 * Zustand를 사용한 전역 상태 관리
 */
interface AppState {
  // 테마 설정
  themeMode: ThemeMode;

  // 사용자 위치
  userLocation: Coordinates | null;
  locationError: string | null;
  isLoadingLocation: boolean;

  // 병원 검색 결과
  hospitals: Hospital[];
  searchWarning: HospitalSearchWarning | null;
  isLoadingHospitals: boolean;
  lastUpdated: Date | null;

  // 선택된 병원
  selectedHospital: Hospital | null;

  // 정렬 옵션
  sortOption: SortOption;

  // 필터 옵션
  filters: HospitalFilters;

  // 경로 정보 로딩 관련
  loadedRouteCount: number; // 현재까지 경로 정보가 로드된 병원 수
  isLoadingMoreRoutes: boolean; // 추가 경로 정보 로딩 중

  // 인증 관련
  user: User | null;
  isLoginModalOpen: boolean;
  loginRequiredFeature: string | null; // 로그인이 필요한 기능 이름

  // Actions
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;

  setUserLocation: (location: Coordinates | null) => void;
  setLocationError: (error: string | null) => void;
  setLoadingLocation: (loading: boolean) => void;

  setHospitals: (hospitals: Hospital[], warning?: HospitalSearchWarning | null) => void;
  setLoadingHospitals: (loading: boolean) => void;
  setSelectedHospital: (hospital: Hospital | null) => void;
  setSortOption: (option: SortOption) => void;
  setFilters: (filters: HospitalFilters) => void;
  toggleFilter: (filterKey: keyof HospitalFilters) => void;
  clearFilters: () => void;
  setLoadedRouteCount: (count: number) => void;
  setLoadingMoreRoutes: (loading: boolean) => void;
  updateHospitalsWithRoutes: (hospitalsWithRoutes: Hospital[]) => void;
  setUser: (user: User | null) => void;
  openLoginModal: (featureName?: string) => void;
  closeLoginModal: () => void;

  clearHospitals: () => void;
  reset: () => void;
}

/**
 * Zustand Store with Persist Middleware
 */
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Initial State
      themeMode: 'light', // 기본값: 라이트 모드

      userLocation: null,
      locationError: null,
      isLoadingLocation: true,

      hospitals: [],
      searchWarning: null,
      isLoadingHospitals: false,
      lastUpdated: null,

      selectedHospital: null,

      sortOption: 'RECOMMENDED',

      filters: DEFAULT_FILTERS,

      loadedRouteCount: 0,
      isLoadingMoreRoutes: false,

      user: null,
      isLoginModalOpen: false,
      loginRequiredFeature: null,

      // Theme Actions
      toggleTheme: () =>
        set((state) => ({
          themeMode: state.themeMode === 'light' ? 'dark' : 'light',
        })),

      setThemeMode: (mode) =>
        set({ themeMode: mode }),

      // Actions
      setUserLocation: (location) =>
        set({
      userLocation: location,
      locationError: null,
      isLoadingLocation: false,
    }),

  setLocationError: (error) =>
    set({
      locationError: error,
      isLoadingLocation: false,
    }),

  setLoadingLocation: (loading) =>
    set({ isLoadingLocation: loading }),

  setHospitals: (hospitals, warning = null) =>
    set({
      hospitals,
      searchWarning: warning,
      isLoadingHospitals: false,
      lastUpdated: new Date(),
      loadedRouteCount: 0, // 새 검색 시 리셋
    }),

  setLoadingHospitals: (loading) =>
    set({ isLoadingHospitals: loading }),

  setSelectedHospital: (hospital) =>
    set({ selectedHospital: hospital }),

  setSortOption: (option) =>
    set({ sortOption: option }),

  setFilters: (filters) =>
    set({ filters }),

  toggleFilter: (filterKey) =>
    set((state) => ({
      filters: {
        ...state.filters,
        [filterKey]: !state.filters[filterKey],
      },
    })),

  clearFilters: () =>
    set({ filters: DEFAULT_FILTERS }),

  setLoadedRouteCount: (count) =>
    set({ loadedRouteCount: count }),

  setLoadingMoreRoutes: (loading) =>
    set({ isLoadingMoreRoutes: loading }),

  updateHospitalsWithRoutes: (hospitalsWithRoutes) =>
    set((state) => {
      // 기존 병원 목록에서 경로 정보가 업데이트된 병원들을 찾아서 교체
      const updatedHospitals = state.hospitals.map((hospital) => {
        const updated = hospitalsWithRoutes.find((h) => h.id === hospital.id);
        return updated || hospital;
      });
      return { hospitals: updatedHospitals };
    }),

  setUser: (user) =>
    set({ user }),

  openLoginModal: (featureName) =>
    set({
      isLoginModalOpen: true,
      loginRequiredFeature: featureName || null,
    }),

  closeLoginModal: () =>
    set({
      isLoginModalOpen: false,
      loginRequiredFeature: null,
    }),

  clearHospitals: () =>
    set({
      hospitals: [],
      searchWarning: null,
      lastUpdated: null,
    }),

  reset: () =>
    set({
      userLocation: null,
      locationError: null,
      isLoadingLocation: true,
      hospitals: [],
      searchWarning: null,
      isLoadingHospitals: false,
      lastUpdated: null,
      selectedHospital: null,
    }),
    }),
    {
      name: 'golden-time-storage', // localStorage key
      partialize: (state) => ({
        themeMode: state.themeMode, // 테마 설정만 persist
      }),
    }
  )
);
