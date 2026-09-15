import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GeofencingService } from './GeofencingService';
import { Coordinates } from '../valueObjects/Coordinates';

const HOSPITAL = new Coordinates(35.1524229, 126.8539184);

// 위도 1도는 약 111,195m. 반경 경계를 넉넉히 벗어나거나 들어오도록 만든다.
const metersNorth = (from: Coordinates, meters: number) =>
  new Coordinates(from.latitude + meters / 111_195, from.longitude);

const position = (coords: Coordinates): GeolocationPosition => ({
  coords: {
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracy: 10,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
    toJSON: () => ({}),
  },
  timestamp: Date.now(),
  toJSON: () => ({}),
}) as GeolocationPosition;

describe('GeofencingService', () => {
  let service: GeofencingService;
  let watchPosition: ReturnType<typeof vi.fn>;
  let clearWatch: ReturnType<typeof vi.fn>;
  let emitPosition: (coords: Coordinates) => void;
  let originalGeolocation: PropertyDescriptor | undefined;

  const setGeolocation = (value: unknown) => {
    Object.defineProperty(navigator, 'geolocation', { value, configurable: true });
  };

  beforeEach(() => {
    originalGeolocation = Object.getOwnPropertyDescriptor(navigator, 'geolocation');

    let onSuccess: ((pos: GeolocationPosition) => void) | null = null;
    watchPosition = vi.fn((success: (pos: GeolocationPosition) => void) => {
      onSuccess = success;
      return 1;
    });
    clearWatch = vi.fn();
    emitPosition = (coords) => onSuccess?.(position(coords));

    setGeolocation({ watchPosition, clearWatch });
    vi.spyOn(console, 'log').mockImplementation(() => {});

    service = GeofencingService.getInstance();
    service.clearAll();
    clearWatch.mockClear();
  });

  afterEach(() => {
    service.clearAll();
    if (originalGeolocation) {
      Object.defineProperty(navigator, 'geolocation', originalGeolocation);
    }
    vi.restoreAllMocks();
  });

  it('싱글톤이다', () => {
    expect(GeofencingService.getInstance()).toBe(service);
  });

  describe('등록과 해제', () => {
    it('geofence를 등록하면 위치 감시를 시작한다', () => {
      const result = service.addGeofence('hpid-1', '상무병원', HOSPITAL, { onEnter: vi.fn() });

      expect(result.success).toBe(true);
      expect(service.isMonitoring('hpid-1')).toBe(true);
      expect(service.getActiveGeofenceCount()).toBe(1);
      expect(watchPosition).toHaveBeenCalledTimes(1);
    });

    it('두 번째 geofence를 등록해도 감시는 한 번만 시작한다', () => {
      service.addGeofence('hpid-1', '상무병원', HOSPITAL, { onEnter: vi.fn() });
      service.addGeofence('hpid-2', '무등병원', HOSPITAL, { onEnter: vi.fn() });

      expect(service.getActiveGeofenceCount()).toBe(2);
      expect(watchPosition).toHaveBeenCalledTimes(1);
    });

    it('마지막 geofence를 제거하면 감시를 멈춘다', () => {
      service.addGeofence('hpid-1', '상무병원', HOSPITAL, { onEnter: vi.fn() });
      service.addGeofence('hpid-2', '무등병원', HOSPITAL, { onEnter: vi.fn() });

      service.removeGeofence('hpid-1');
      expect(clearWatch).not.toHaveBeenCalled();

      service.removeGeofence('hpid-2');
      expect(clearWatch).toHaveBeenCalledTimes(1);
      expect(service.getActiveGeofenceCount()).toBe(0);
    });

    it('geolocation을 쓸 수 없으면 실패를 알린다', () => {
      setGeolocation(undefined);
      // 'geolocation' in navigator 검사를 통과하지 못하도록 속성 자체를 지운다.
      Reflect.deleteProperty(navigator, 'geolocation');

      const result = service.addGeofence('hpid-1', '상무병원', HOSPITAL, { onEnter: vi.fn() });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not supported/i);
      expect(service.isMonitoring('hpid-1')).toBe(false);
    });
  });

  describe('진입과 이탈', () => {
    it('반경 안으로 들어오면 onEnter를 호출한다', () => {
      const onEnter = vi.fn();
      service.addGeofence('hpid-1', '상무병원', HOSPITAL, { onEnter }, 100);

      emitPosition(metersNorth(HOSPITAL, 500));
      expect(onEnter).not.toHaveBeenCalled();

      emitPosition(metersNorth(HOSPITAL, 50));
      expect(onEnter).toHaveBeenCalledWith('hpid-1', '상무병원');
    });

    // 도착 알림이 매 위치 갱신마다 뜨면 안 된다.
    it('반경 안에 머무는 동안 onEnter를 다시 호출하지 않는다', () => {
      const onEnter = vi.fn();
      service.addGeofence('hpid-1', '상무병원', HOSPITAL, { onEnter }, 100);

      emitPosition(metersNorth(HOSPITAL, 50));
      emitPosition(metersNorth(HOSPITAL, 30));
      emitPosition(HOSPITAL);

      expect(onEnter).toHaveBeenCalledTimes(1);
    });

    it('반경 밖으로 나가면 onExit를 호출한다', () => {
      const onEnter = vi.fn();
      const onExit = vi.fn();
      service.addGeofence('hpid-1', '상무병원', HOSPITAL, { onEnter, onExit }, 100);

      emitPosition(metersNorth(HOSPITAL, 50));
      emitPosition(metersNorth(HOSPITAL, 500));

      expect(onExit).toHaveBeenCalledWith('hpid-1', '상무병원');
    });

    it('다시 들어오면 onEnter가 또 호출된다', () => {
      const onEnter = vi.fn();
      service.addGeofence('hpid-1', '상무병원', HOSPITAL, { onEnter, onExit: vi.fn() }, 100);

      emitPosition(metersNorth(HOSPITAL, 50));
      emitPosition(metersNorth(HOSPITAL, 500));
      emitPosition(metersNorth(HOSPITAL, 50));

      expect(onEnter).toHaveBeenCalledTimes(2);
    });

    it('onExit가 없어도 이탈 시 터지지 않는다', () => {
      const onEnter = vi.fn();
      service.addGeofence('hpid-1', '상무병원', HOSPITAL, { onEnter }, 100);

      emitPosition(metersNorth(HOSPITAL, 50));

      expect(() => emitPosition(metersNorth(HOSPITAL, 500))).not.toThrow();
    });

    it('반경은 병원마다 따로 적용된다', () => {
      const near = vi.fn();
      const far = vi.fn();
      service.addGeofence('hpid-near', '좁은반경', HOSPITAL, { onEnter: near }, 100);
      service.addGeofence('hpid-far', '넓은반경', HOSPITAL, { onEnter: far }, 1000);

      emitPosition(metersNorth(HOSPITAL, 500));

      expect(near).not.toHaveBeenCalled();
      expect(far).toHaveBeenCalledWith('hpid-far', '넓은반경');
    });

    it('제거된 geofence는 더 이상 알리지 않는다', () => {
      const onEnter = vi.fn();
      service.addGeofence('hpid-1', '상무병원', HOSPITAL, { onEnter }, 100);
      service.removeGeofence('hpid-1');

      emitPosition(HOSPITAL);

      expect(onEnter).not.toHaveBeenCalled();
    });
  });
});
