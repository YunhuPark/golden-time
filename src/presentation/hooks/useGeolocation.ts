import { useState, useEffect } from 'react';
import { Coordinates } from '../../domain/valueObjects/Coordinates';

/**
 * Geolocation 에러 타입
 */
export interface GeolocationError {
  type: 'PERMISSION_DENIED' | 'POSITION_UNAVAILABLE' | 'TIMEOUT' | 'NOT_SUPPORTED' | 'STALE_DATA';
  message: string;
  code?: number;
}

/**
 * Geolocation 상태
 */
export interface GeolocationState {
  location: Coordinates | null;
  error: GeolocationError | null;
  isLoading: boolean;
  accuracy: number | null;
}

type LastKnownLocation = {
  coords: Coordinates;
  timestamp: number;
};

let lastKnownLocation: LastKnownLocation | null = null;

function clearLegacyPersistedLocation(): void {
  try {
    localStorage.removeItem('lastKnownLocation');
  } catch {
    // Storage may be unavailable in privacy modes; there is nothing else to do.
  }
}

/**
 * useGeolocation Hook
 *
 * 사용자의 현재 위치를 획득하는 React Hook
 *
 * Edge Cases 처리:
 * 1. 권한 거부 → Manual input fallback + Seoul City Hall default
 * 2. 타임아웃 → 현재 페이지 세션의 last known location 또는 기본 위치 fallback
 * 3. 위치 불가 → 메모리에만 유지한 last known location 사용
 * 4. 낮은 정확도 (>100m) → Warning banner
 * 5. 브라우저 미지원 → Error message
 */
export function useGeolocation(
  options: PositionOptions = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 30000,
  }
): GeolocationState {
  const { enableHighAccuracy, timeout, maximumAge } = options;
  const [state, setState] = useState<GeolocationState>({
    location: null,
    error: null,
    isLoading: true,
    accuracy: null,
  });

  useEffect(() => {
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const timeoutDuration = isMobile ? 10000 : 30000;
    const fallbackDuration = isMobile ? 12000 : 35000;

    console.log(`🌍 Device: ${isMobile ? 'Mobile' : 'Desktop'}, Timeout: ${timeoutDuration/1000}s, Fallback: ${fallbackDuration/1000}s`);

    clearLegacyPersistedLocation();

    if (!navigator.geolocation) {
      setState({
        location: getSeoulCityHall(),
        error: {
          type: 'NOT_SUPPORTED',
          message: '브라우저가 위치 서비스를 지원하지 않습니다. 서울시청을 기본 위치로 설정합니다.',
        },
        isLoading: false,
        accuracy: null,
      });
      return undefined;
    }

    const handleSuccess = (position: GeolocationPosition) => {
      const coords = new Coordinates(
        position.coords.latitude,
        position.coords.longitude,
        position.coords.accuracy
      );

      lastKnownLocation = {
        coords,
        timestamp: Date.now(),
      };
      clearLegacyPersistedLocation();

      const lowAccuracyWarning = coords.accuracy && coords.accuracy > 100
        ? {
            type: 'STALE_DATA' as const,
            message: `위치 정확도가 낮습니다 (±${Math.round(coords.accuracy)}m). Wi-Fi 활성화를 권장합니다.`,
          }
        : null;

      setState({
        location: coords,
        error: lowAccuracyWarning,
        isLoading: false,
        accuracy: coords.accuracy ?? null,
      });
    };

    const handleError = (error: GeolocationPositionError) => {
      const lastKnown = getLastKnownLocation();
      if (lastKnown) {
        console.info('ℹ️ Geolocation unavailable; using last known location', {
          code: error.code,
          message: error.message,
          ageMinutes: lastKnown.ageMinutes,
        });
        setState({
          location: lastKnown.coords,
          error: {
            type: 'STALE_DATA',
            message: `현재 위치를 가져올 수 없어 마지막 알려진 위치를 사용합니다 (${lastKnown.ageMinutes}분 전).`,
            code: error.code,
          },
          isLoading: false,
          accuracy: lastKnown.coords.accuracy ?? null,
        });
        return;
      }

      const errorMessages: Record<number, GeolocationError> = {
        [error.PERMISSION_DENIED]: {
          type: 'PERMISSION_DENIED',
          message: '위치 접근 권한이 거부되었습니다. 수동으로 위치를 입력하거나 권한을 허용해주세요.',
          code: error.code,
        },
        [error.POSITION_UNAVAILABLE]: {
          type: 'POSITION_UNAVAILABLE',
          message: '현재 위치를 확인할 수 없습니다. 서울시청을 기본 위치로 설정합니다.',
          code: error.code,
        },
        [error.TIMEOUT]: {
          type: 'TIMEOUT',
          message: '위치 확인 시간이 초과되었습니다. 서울시청을 기본 위치로 설정합니다.',
          code: error.code,
        },
      };

      console.info('ℹ️ Geolocation unavailable; using default location', {
        code: error.code,
        message: error.message,
      });
      setState({
        location: getSeoulCityHall(),
        error: errorMessages[error.code] ?? {
          type: 'POSITION_UNAVAILABLE',
          message: '알 수 없는 오류가 발생했습니다.',
          code: error.code,
        },
        isLoading: false,
        accuracy: null,
      });
    };

    try {
      let timedOut = false;

      const fallbackTimeout = setTimeout(() => {
        timedOut = true;
        const lastKnown = getLastKnownLocation();
        console.info(`ℹ️ Geolocation timeout (>${fallbackDuration/1000}s), using fallback location`);
        setState({
          location: lastKnown?.coords ?? getSeoulCityHall(),
          error: {
            type: lastKnown ? 'STALE_DATA' : 'TIMEOUT',
            message: lastKnown
              ? `위치 확인이 지연되어 현재 페이지 세션의 마지막 위치를 사용합니다 (${lastKnown.ageMinutes}분 전).`
              : '위치 확인이 지연되어 기본 위치(서울시청)를 사용합니다.',
          },
          isLoading: false,
          accuracy: lastKnown?.coords.accuracy ?? null,
        });
      }, fallbackDuration);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (timedOut) return;
          clearTimeout(fallbackTimeout);
          console.log('✅ Geolocation success:', {
            accuracy: position.coords.accuracy,
          });
          handleSuccess(position);
        },
        (error) => {
          if (timedOut) return;
          clearTimeout(fallbackTimeout);
          handleError(error);
        },
        { enableHighAccuracy, maximumAge, timeout: timeoutDuration }
      );

      return () => {
        clearTimeout(fallbackTimeout);
      };
    } catch (e) {
      console.error('Failed to start geolocation:', e);
      setState({
        location: getSeoulCityHall(),
        error: {
          type: 'NOT_SUPPORTED',
          message: '위치 서비스를 시작할 수 없습니다.',
        },
        isLoading: false,
        accuracy: null,
      });
      return undefined;
    }
  }, [enableHighAccuracy, timeout, maximumAge]);

  return state;
}

function getSeoulCityHall(): Coordinates {
  return new Coordinates(37.5663, 126.9779);
}

function getLastKnownLocation(): {
  coords: Coordinates;
  ageMinutes: number;
} | null {
  clearLegacyPersistedLocation();
  if (!lastKnownLocation) return null;

  const age = Date.now() - lastKnownLocation.timestamp;
  const ageMinutes = Math.round(age / 60000);
  if (ageMinutes > 30) {
    lastKnownLocation = null;
    return null;
  }

  return { coords: lastKnownLocation.coords, ageMinutes };
}
