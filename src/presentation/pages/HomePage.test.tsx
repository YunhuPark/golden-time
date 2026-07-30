import { describe, it, expect, vi, beforeEach } from 'vitest';

import { render } from '@testing-library/react';
import { HomePage } from './HomePage';
import { useAppStore } from '../../infrastructure/state/store';

// Mock dependencies
vi.mock('../hooks/useGeolocation', () => ({
  useGeolocation: () => ({ location: null, error: null, isLoading: false })
}));
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: null, signOut: vi.fn() })
}));
vi.mock('../hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isOffline: false, justReconnected: false })
}));
// Map is hard to mock, just mock the components
vi.mock('../components/map/KakaoMap', () => ({ KakaoMap: () => null }));
vi.mock('../components/hospital/HospitalList', () => ({ HospitalList: () => null }));
vi.mock('../components/hospital/HospitalDetailModal', () => ({ HospitalDetailModal: () => null }));
vi.mock('../components/hospital/HospitalBottomSheet', () => ({ HospitalBottomSheet: () => null }));
vi.mock('../components/hospital/HospitalFilterPanel', () => ({ HospitalFilterPanel: () => null }));
vi.mock('../components/hospital/FavoritesBottomSheet', () => ({ FavoritesBottomSheet: () => null }));
vi.mock('../components/hospital/EmptyHospitalList', () => ({ EmptyHospitalList: () => null }));

describe('HomePage URL Context Parsing', () => {
  beforeEach(() => {
    useAppStore.setState({ aiContext: null });
  });

  it('should not set aiContext for normal access', () => {
    // No URL params
    delete (window as any).location;
    window.location = { search: '' } as any;

    render(<HomePage />);
    expect(useAppStore.getState().aiContext).toBeNull();
  });

  it('should parse sepsis_demo and synthetic_demo correctly', () => {
    delete (window as any).location;
    window.location = { 
      search: '?primaryCondition=sepsis_demo&triage=RED&analysisMode=synthetic_demo&capabilities=응급실%20운영,CT' 
    } as any;

    render(<HomePage />);
    const context = useAppStore.getState().aiContext;
    expect(context).not.toBeNull();
    expect(context?.primaryCondition).toBe('sepsis_demo');
    expect(context?.triage).toBe('RED');
    expect(context?.analysisMode).toBe('synthetic_demo');
    expect(context?.capabilities).toEqual(['응급실 운영', 'CT']);
  });

  it('should prioritize primaryCondition over condition over disease', () => {
    delete (window as any).location;
    window.location = { 
      search: '?disease=A&condition=B&primaryCondition=brain_lesion_demo' 
    } as any;

    render(<HomePage />);
    expect(useAppStore.getState().aiContext?.primaryCondition).toBe('brain_lesion_demo');
  });

  it('should set aiContext even if only condition is provided (fallback)', () => {
    delete (window as any).location;
    window.location = { search: '?condition=unknown_demo' } as any;

    render(<HomePage />);
    expect(useAppStore.getState().aiContext?.primaryCondition).toBe('unknown_demo');
  });
});
