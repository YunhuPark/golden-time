import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KakaoDirectionsClient } from './KakaoDirectionsClient';

describe('KakaoDirectionsClient', () => {
  let client: KakaoDirectionsClient;

  beforeEach(() => {
    client = new KakaoDirectionsClient();
    // mock sleep to speed up tests
    (client as any).sleep = vi.fn().mockResolvedValue(undefined);
  });

  describe('getBatchRouteInfoConcurrent', () => {
    it('A. 동시성 제한: 최대 3개까지만 동시 실행되는지 검증', async () => {
      // Mock getRouteInfo with delayed resolution
      let concurrentCount = 0;
      let maxConcurrent = 0;

      (client as any).getRouteInfo = vi.fn().mockImplementation(async () => {
        concurrentCount++;
        if (concurrentCount > maxConcurrent) maxConcurrent = concurrentCount;
        
        await new Promise(resolve => setTimeout(resolve, 10)); // artificial delay
        
        concurrentCount--;
        return { distance: 1000, duration: 600, taxiFare: 0, tollFare: 0 };
      });

      const origin = { latitude: 37.0, longitude: 127.0 };
      const destinations = Array.from({ length: 10 }).map((_, idx) => ({
        id: `h${idx}`,
        latitude: 37.0 + idx * 0.01,
        longitude: 127.0 + idx * 0.01,
      }));

      await client.getBatchRouteInfoConcurrent(origin, destinations, 3);

      expect(maxConcurrent).toBeLessThanOrEqual(3);
      expect((client as any).getRouteInfo).toHaveBeenCalledTimes(10);
    });

    it('B. 부분 실패 격리: 일부 요청 실패가 나머지 성공 결과에 영향을 주지 않음', async () => {
      (client as any).getRouteInfo = vi.fn().mockImplementation(async (_, dest) => {
        if (dest.id === 'fail1' || dest.id === 'fail2') {
          throw new Error('Network error');
        }
        return { distance: 1000, duration: 600, taxiFare: 0, tollFare: 0 };
      });

      const origin = { latitude: 37.0, longitude: 127.0 };
      const destinations = [
        { id: 'ok1', latitude: 37.1, longitude: 127.1 },
        { id: 'fail1', latitude: 37.2, longitude: 127.2 },
        { id: 'ok2', latitude: 37.3, longitude: 127.3 },
        { id: 'fail2', latitude: 37.4, longitude: 127.4 },
        { id: 'ok3', latitude: 37.5, longitude: 127.5 },
      ];

      const result = await client.getBatchRouteInfoConcurrent(origin, destinations, 3);

      expect(result.size).toBe(3);
      expect(result.has('ok1')).toBe(true);
      expect(result.has('ok2')).toBe(true);
      expect(result.has('ok3')).toBe(true);
      expect(result.has('fail1')).toBe(false);
      expect(result.has('fail2')).toBe(false);
    });

    it('C. ID 기반 병합: 응답 완료 순서와 관계없이 정확한 병원에 매핑됨', async () => {
      // Mock with different delays
      (client as any).getRouteInfo = vi.fn().mockImplementation(async (_, dest) => {
        let delay = 10;
        if (dest.id === 'slow') delay = 50;
        if (dest.id === 'fast') delay = 1;
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return { distance: dest.latitude * 10, duration: dest.longitude * 10, taxiFare: 0, tollFare: 0 };
      });

      const origin = { latitude: 37.0, longitude: 127.0 };
      const destinations = [
        { id: 'slow', latitude: 100, longitude: 200 },
        { id: 'normal', latitude: 110, longitude: 210 },
        { id: 'fast', latitude: 120, longitude: 220 },
      ];

      const result = await client.getBatchRouteInfoConcurrent(origin, destinations, 3);

      expect(result.get('slow')).toEqual(expect.objectContaining({ distance: 1000, duration: 2000 }));
      expect(result.get('fast')).toEqual(expect.objectContaining({ distance: 1200, duration: 2200 }));
      expect(result.get('normal')).toEqual(expect.objectContaining({ distance: 1100, duration: 2100 }));
    });
  });
});
