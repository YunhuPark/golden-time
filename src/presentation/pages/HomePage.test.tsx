import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hospital } from '../../domain/entities/Hospital';
import { Coordinates } from '../../domain/valueObjects/Coordinates';
import { useAppStore } from '../../infrastructure/state/store';
import { HomePage } from './HomePage';

const {
  mockGeolocationState,
  mockFindNearby,
  mockLoadMoreRouteInfo,
} = vi.hoisted(() => ({
  mockGeolocationState: {
    current: {
      location: null as Coordinates | null,
      error: null as Error | null,
      isLoading: false,
    },
  },
  mockFindNearby: vi.fn(),
  mockLoadMoreRouteInfo: vi.fn(),
}));

vi.mock('../hooks/useGeolocation', () => ({
  useGeolocation: () => mockGeolocationState.current,
}));
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: null, signOut: vi.fn() }),
}));
vi.mock('../hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isOffline: false, justReconnected: false }),
}));
vi.mock('../components/map/KakaoMap', () => ({ KakaoMap: () => null }));
vi.mock('../components/hospital/HospitalList', () => ({ HospitalList: () => null }));
vi.mock('../components/hospital/HospitalDetailModal', () => ({ HospitalDetailModal: () => null }));
vi.mock('../components/hospital/HospitalBottomSheet', () => ({ HospitalBottomSheet: () => null }));
vi.mock('../components/hospital/HospitalFilterPanel', () => ({ HospitalFilterPanel: () => null }));
vi.mock('../components/hospital/FavoritesBottomSheet', () => ({ FavoritesBottomSheet: () => null }));
vi.mock('../components/hospital/EmptyHospitalList', () => ({ EmptyHospitalList: () => null }));

vi.mock('../../data/repositories/HospitalRepositoryImpl', () => ({
  HospitalRepositoryImpl: vi.fn().mockImplementation(function MockHospitalRepositoryImpl() {
    return {
      findNearby: mockFindNearby,
      loadMoreRouteInfo: mockLoadMoreRouteInfo,
    };
  }),
}));

function makeHospital(id: string, name: string, routeDuration?: number): Hospital {
  return new Hospital(
    id,
    name,
    new Coordinates(37.5, 127),
    '서울특별시 테스트 주소',
    '02-0000-0000',
    null,
    5,
    10,
    ['응급의학과'],
    3,
    true,
    new Date(),
    true,
    true,
    true,
    undefined,
    routeDuration,
    routeDuration ? 1000 : undefined
  );
}

function resetStore(): void {
  useAppStore.setState({
    userLocation: null,
    locationError: null,
    hospitals: [],
    searchWarning: null,
    isLoadingHospitals: false,
    selectedHospital: null,
    aiContext: null,
    user: null,
  });
}

afterEach(() => {
  cleanup();
});

describe('HomePage URL Context Parsing', () => {
  beforeEach(() => {
    resetStore();
    mockFindNearby.mockReset();
    mockLoadMoreRouteInfo.mockReset();
    mockGeolocationState.current = { location: null, error: null, isLoading: false };
    window.history.replaceState({}, '', '/');
  });

  it('should not set aiContext for normal access', () => {
    render(<HomePage />);
    expect(useAppStore.getState().aiContext).toBeNull();
  });

  it('should parse sepsis_demo and synthetic_demo correctly', () => {
    window.history.replaceState(
      {},
      '',
      '/?primaryCondition=sepsis_demo&triage=RED&analysisMode=synthetic_demo&capabilities=응급실%20운영,CT'
    );

    render(<HomePage />);
    const context = useAppStore.getState().aiContext;
    expect(context).not.toBeNull();
    expect(context?.primaryCondition).toBe('sepsis_demo');
    expect(context?.triage).toBe('RED');
    expect(context?.analysisMode).toBe('synthetic_demo');
    expect(context?.capabilities).toEqual(['응급실 운영', 'CT']);
  });

  it('should prioritize primaryCondition over condition over disease', () => {
    window.history.replaceState(
      {},
      '',
      '/?disease=A&condition=B&primaryCondition=brain_lesion_demo'
    );

    render(<HomePage />);
    expect(useAppStore.getState().aiContext?.primaryCondition).toBe('brain_lesion_demo');
  });

  it('should set aiContext even if only condition is provided (fallback)', () => {
    window.history.replaceState({}, '', '/?condition=unknown_demo');

    render(<HomePage />);
    expect(useAppStore.getState().aiContext?.primaryCondition).toBe('unknown_demo');
  });
});

describe('HomePage Async Route & Unmount Handling', () => {
  beforeEach(() => {
    resetStore();
    window.history.replaceState({}, '', '/');
    mockGeolocationState.current = {
      location: new Coordinates(37, 127),
      error: null,
      isLoading: false,
    };
    mockFindNearby.mockReset();
    mockLoadMoreRouteInfo.mockReset();
  });

  afterEach(() => {
    mockGeolocationState.current = { location: null, error: null, isLoading: false };
    vi.clearAllMocks();
  });

  it('keeps the newest hospital search when an older request resolves late', async () => {
    let resolveFirst!: (value: Hospital[]) => void;
    let resolveSecond!: (value: Hospital[]) => void;

    mockFindNearby
      .mockImplementationOnce(() => new Promise<Hospital[]>((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => new Promise<Hospital[]>((resolve) => { resolveSecond = resolve; }));
    mockLoadMoreRouteInfo.mockResolvedValue([]);

    const firstHospital = makeHospital('old', 'Old Hospital');
    const secondHospital = makeHospital('new', 'New Hospital');

    const { rerender } = render(<HomePage />);
    await waitFor(() => expect(mockFindNearby).toHaveBeenCalledTimes(1));

    mockGeolocationState.current = {
      location: new Coordinates(37.1, 127.1),
      error: null,
      isLoading: false,
    };
    rerender(<HomePage />);
    await waitFor(() => expect(mockFindNearby).toHaveBeenCalledTimes(2));

    await act(async () => {
      resolveSecond([secondHospital]);
    });
    await waitFor(() => expect(useAppStore.getState().hospitals[0]?.id).toBe('new'));

    await act(async () => {
      resolveFirst([firstHospital]);
    });

    expect(useAppStore.getState().hospitals[0]?.id).toBe('new');
  });

  it('does not apply background route results after unmount', async () => {
    let resolveRoutes!: (value: Hospital[]) => void;
    const initialHospital = makeHospital('1', 'Initial Hospital');
    const routedHospital = makeHospital('1', 'Initial Hospital', 300);

    mockFindNearby.mockResolvedValue([initialHospital]);
    mockLoadMoreRouteInfo.mockImplementation(
      () => new Promise<Hospital[]>((resolve) => { resolveRoutes = resolve; })
    );

    const { unmount } = render(<HomePage />);

    await waitFor(() => expect(useAppStore.getState().hospitals[0]?.id).toBe('1'));
    expect(useAppStore.getState().hospitals[0]?.routeDuration).toBeUndefined();

    unmount();

    await act(async () => {
      resolveRoutes([routedHospital]);
    });

    expect(useAppStore.getState().hospitals[0]?.routeDuration).toBeUndefined();
  });
});
