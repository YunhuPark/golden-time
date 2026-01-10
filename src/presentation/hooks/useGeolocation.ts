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

/**
 * useGeolocation Hook
 *
 * 사용자의 현재 위치를 획득하는 React Hook
 *
 * Edge Cases 처리:
 * 1. 권한 거부 → Manual input fallback + Seoul City Hall default
 * 2. 타임아웃 → Retry with longer timeout → IP geolocation
 * 3. 위치 불가 → Last known location from localStorage
 * 4. 낮은 정확도 (>100m) → Warning banner
 * 5. 브라우저 미지원 → Error message
 */
export function useGeolocation(
  options: PositionOptions = {
    enableHighAccuracy: true,
    timeout: 10000, // 10초 (응급상황 고려)
    maximumAge: 30000, // 30초간 캐시 허용
  }
): GeolocationState {
  const [state, setState] = useState<GeolocationState>({
    location: null,
    error: null,
    isLoading: true,
    accuracy: null,
  });

  useEffect(() => {
    // Edge Case 1: Geolocation API 미지원
    if (!navigator.geolocation) {
      setState({
        location: getSeoulCityHall(), // Fallback to default location
        error: {
          type: 'NOT_SUPPORTED',
          message: '브라우저가 위치 서비스를 지원하지 않습니다. 서울시청을 기본 위치로 설정합니다.',
        },
        isLoading: false,
        accuracy: null,
      });
      return;
    }

    const handleSuccess = (position: GeolocationPosition) => {
      const coords = new Coordinates(
        position.coords.latitude,
        position.coords.longitude,
        position.coords.accuracy
      );

      // 위치를 localStorage에 저장 (다음 번 fallback용)
      try {
        localStorage.setItem('lastKnownLocation', JSON.stringify({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
          timestamp: Date.now(),
        }));
      } catch (e) {
        console.warn('Failed to save location to localStorage:', e);
      }

      // Edge Case 4: 낮은 정확도 경고
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
      console.error('Geolocation error:', error);

      // Edge Case 3: Last known location fallback
      const lastKnown = getLastKnownLocation();
      if (lastKnown) {
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

      // Fallback to Seoul City Hall
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

    // Geolocation 요청 (getCurrentPosition을 먼저 시도하고, 성공하면 watchPosition 시작)
    try {
      // 1차 시도: getCurrentPosition (빠른 응답)
      let timedOut = false;

      console.log('🌍 Requesting geolocation... (timeout: 10s, fallback: 12s)');

      // 타임아웃 안전장치: 12초 후에도 응답 없으면 fallback (응급상황 고려)
      const fallbackTimeout = setTimeout(() => {
        timedOut = true;
        console.warn('⚠️ Geolocation timeout (>12s), using fallback location');
        setState({
          location: getSeoulCityHall(),
          error: {
            type: 'TIMEOUT',
            message: '위치 확인이 지연되어 기본 위치(서울시청)를 사용합니다.',
          },
          isLoading: false,
          accuracy: null,
        });
      }, 12000); // 12초 (응급상황에서는 빠른 응답 필수)

      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (timedOut) return; // 이미 타임아웃된 경우 무시
          clearTimeout(fallbackTimeout);
          console.log('✅ Geolocation success:', {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
          handleSuccess(position);
          // watchPosition 제거: 자동 새로고침 방지
          // 사용자가 원할 때만 수동으로 새로고침하도록 변경
        },
        (error) => {
          if (timedOut) return; // 이미 타임아웃된 경우 무시
          clearTimeout(fallbackTimeout);
          console.error('❌ Geolocation error:', {
            code: error.code,
            message: error.message,
            PERMISSION_DENIED: error.PERMISSION_DENIED,
            POSITION_UNAVAILABLE: error.POSITION_UNAVAILABLE,
            TIMEOUT: error.TIMEOUT,
          });
          handleError(error);
        },
        { ...options, timeout: 10000 } // 10초 (응급상황 고려)
      );

    } catch (e) {
      console.error('Failed to start geolocation watch:', e);
      setState({
        location: getSeoulCityHall(),
        error: {
          type: 'NOT_SUPPORTED',
          message: '위치 서비스를 시작할 수 없습니다.',
        },
        isLoading: false,
        accuracy: null,
      });
    }

    // Cleanup (watchId는 더 이상 사용하지 않음)
    return () => {
      // watchPosition을 사용하지 않으므로 cleanup 불필요
    };
  }, [options.enableHighAccuracy, options.timeout, options.maximumAge]);

  return state;
}

/**
 * 서울시청 좌표 (기본 위치 - 전국 사용자 기준)
 * GPS 실패 시에만 사용되는 fallback 위치
 */
function getSeoulCityHall(): Coordinates {
  return new Coordinates(37.5663, 126.9779); // Seoul City Hall (서울시청)
}

/**
 * localStorage에서 마지막 알려진 위치 가져오기
 */
function getLastKnownLocation(): {
  coords: Coordinates;
  ageMinutes: number;
} | null {
  try {
    const stored = localStorage.getItem('lastKnownLocation');
    if (!stored) return null;

    const data = JSON.parse(stored);
    const age = Date.now() - data.timestamp;
    const ageMinutes = Math.round(age / 60000);

    // 30분 이상 지난 위치는 무시
    if (ageMinutes > 30) {
      localStorage.removeItem('lastKnownLocation');
      return null;
    }

    const coords = new Coordinates(
      data.latitude,
      data.longitude,
      data.accuracy
    );

    return { coords, ageMinutes };
  } catch (e) {
    console.warn('Failed to parse last known location:', e);
    return null;
  }
}
