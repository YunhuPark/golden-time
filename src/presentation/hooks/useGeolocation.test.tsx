import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useGeolocation } from './useGeolocation';

describe('useGeolocation privacy', () => {
  const originalGeolocation = navigator.geolocation;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: originalGeolocation,
    });
    vi.restoreAllMocks();
  });

  it('does not persist precise coordinates and removes the legacy location key', async () => {
    localStorage.setItem('lastKnownLocation', JSON.stringify({
      latitude: 35.123456,
      longitude: 126.987654,
      accuracy: 10,
      timestamp: Date.now(),
    }));

    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (success: PositionCallback) => {
          success({
            coords: {
              latitude: 35.145961,
              longitude: 126.923701,
              accuracy: 12,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
              toJSON: () => ({}),
            },
            timestamp: Date.now(),
            toJSON: () => ({}),
          } as GeolocationPosition);
        },
      },
    });

    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const { result } = renderHook(() => useGeolocation());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.location?.latitude).toBe(35.145961);
    expect(result.current.location?.longitude).toBe(126.923701);
    expect(localStorage.getItem('lastKnownLocation')).toBeNull();
    expect(setItemSpy).not.toHaveBeenCalledWith('lastKnownLocation', expect.any(String));
  });
});
