import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KakaoDirectionsClient } from './KakaoDirectionsClient';

describe('KakaoDirectionsClient', () => {
  let client: KakaoDirectionsClient;

  beforeEach(() => {
    client = new KakaoDirectionsClient();
    (client as any).sleep = vi.fn().mockResolvedValue(undefined);
  });

  describe('route memory cache', () => {
    const response = {
      routes: [
        {
          result_code: 0,
          result_msg: 'OK',
          summary: {
            distance: 1200,
            duration: 480,
            fare: { taxi: 5000, toll: 0 },
          },
        },
      ],
    };

    it('reuses a recent route across client instances', async () => {
      const origin = { latitude: 37.55121, longitude: 126.98821 };
      const destination = { latitude: 37.56123, longitude: 126.99823 };
      const firstClient = new KakaoDirectionsClient();
      const secondClient = new KakaoDirectionsClient();
      const firstFetch = vi.fn().mockResolvedValue(response);
      const secondFetch = vi.fn().mockResolvedValue(response);
      (firstClient as any).fetchWithRetry = firstFetch;
      (secondClient as any).fetchWithRetry = secondFetch;

      const first = await firstClient.getRouteInfo(origin, destination);
      const second = await secondClient.getRouteInfo(origin, destination);

      expect(first).toEqual(second);
      expect(firstFetch).toHaveBeenCalledTimes(1);
      expect(secondFetch).not.toHaveBeenCalled();
    });

    it('deduplicates concurrent requests for the same route', async () => {
      const origin = { latitude: 35.15951, longitude: 126.85261 };
      const destination = { latitude: 35.16953, longitude: 126.86263 };
      const firstClient = new KakaoDirectionsClient();
      const secondClient = new KakaoDirectionsClient();
      let resolveRequest!: (value: typeof response) => void;
      const pendingResponse = new Promise<typeof response>((resolve) => {
        resolveRequest = resolve;
      });
      const firstFetch = vi.fn().mockReturnValue(pendingResponse);
      const secondFetch = vi.fn().mockResolvedValue(response);
      (firstClient as any).fetchWithRetry = firstFetch;
      (secondClient as any).fetchWithRetry = secondFetch;

      const firstPromise = firstClient.getRouteInfo(origin, destination);
      const secondPromise = secondClient.getRouteInfo(origin, destination);
      resolveRequest(response);
      const [first, second] = await Promise.all([firstPromise, secondPromise]);

      expect(first).toEqual(second);
      expect(firstFetch).toHaveBeenCalledTimes(1);
      expect(secondFetch).not.toHaveBeenCalled();
    });

    it('expires cached route data after 60 seconds', async () => {
      const nowSpy = vi.spyOn(Date, 'now');
      const origin = { latitude: 35.87111, longitude: 128.60111 };
      const destination = { latitude: 35.88113, longitude: 128.61113 };
      const firstClient = new KakaoDirectionsClient();
      const secondClient = new KakaoDirectionsClient();
      const firstFetch = vi.fn().mockResolvedValue(response);
      const secondFetch = vi.fn().mockResolvedValue(response);
      (firstClient as any).fetchWithRetry = firstFetch;
      (secondClient as any).fetchWithRetry = secondFetch;

      nowSpy.mockReturnValue(1_000);
      await firstClient.getRouteInfo(origin, destination);
      nowSpy.mockReturnValue(61_001);
      await secondClient.getRouteInfo(origin, destination);

      expect(firstFetch).toHaveBeenCalledTimes(1);
      expect(secondFetch).toHaveBeenCalledTimes(1);
      nowSpy.mockRestore();
    });
  });

  describe('getBatchRouteInfoConcurrent', () => {
    it('A. 동시성 제한: 최대 3개까지만 동시 실행되는지 검증', async () => {
      let concurrentCount = 0;
      let maxConcurrent = 0;

      (client as any).getRouteInfo = vi.fn().mockImplementation(async () => {
        concurrentCount++;
        if (concurrentCount > maxConcurrent) maxConcurrent = concurrentCount;
        await new Promise(resolve => setTimeout(resolve, 10));
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
