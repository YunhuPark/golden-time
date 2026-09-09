/**
 * Kakao 병원명 -> 좌표 변환 클라이언트.
 *
 * Production에서는 서버 프록시(/api/kakao/geocoding)를 우선 사용합니다.
 * 브라우저 JavaScript SDK는 보조 fallback으로만 사용합니다.
 */

declare global {
  interface Window {
    kakaoSDKReady?: Promise<boolean>;
  }
}

type GeocodeResult = {
  latitude: number;
  longitude: number;
  address: string;
};

type KakaoDocument = {
  y?: string;
  x?: string;
  road_address_name?: string;
  address_name?: string;
  category_group_code?: string;
  category_name?: string;
};

type GeocodeCacheEntry = {
  result: GeocodeResult;
  expiresAt: number;
};

const GEOCODE_CACHE_TTL_MS = 10 * 60 * 1000;
const GEOCODE_CACHE_MAX_ENTRIES = 200;
const geocodeCache = new Map<string, GeocodeCacheEntry>();
const geocodeRequestsInFlight = new Map<string, Promise<GeocodeResult | null>>();

export function buildGeocodeCacheKey(keyword: string, region?: string): string {
  const normalizedKeyword = keyword.replace(/\s+/g, ' ').trim().toLowerCase();
  const normalizedRegion = region?.replace(/\s+/g, ' ').trim().toLowerCase() || 'any-region';
  return `${normalizedRegion}::${normalizedKeyword}`;
}

export class KakaoPlacesClient {
  private placesService: any;
  private initPromise: Promise<void>;

  constructor() {
    this.initPromise = this.waitForKakaoSDK();
  }

  private async waitForKakaoSDK(): Promise<void> {
    if (typeof window === 'undefined') return;

    if (window.kakaoSDKReady) {
      const isReady = await window.kakaoSDKReady;
      if (!isReady || typeof window === 'undefined') return;
    }

    if (window.kakao && window.kakao.maps && window.kakao.maps.services) {
      this.placesService = new window.kakao.maps.services.Places();
      return;
    }

    const maxWaitTime = 5000;
    const checkInterval = 100;
    let waited = 0;

    return new Promise((resolve) => {
      const checkSDK = setInterval(() => {
        // jsdom/SSR environments may remove the browser global while this
        // asynchronous poll is still alive. Stop cleanly instead of touching
        // a destroyed window object.
        if (typeof window === 'undefined') {
          clearInterval(checkSDK);
          resolve();
          return;
        }

        if (window.kakao && window.kakao.maps && window.kakao.maps.services) {
          clearInterval(checkSDK);
          this.placesService = new window.kakao.maps.services.Places();
          resolve();
        } else if (waited >= maxWaitTime) {
          clearInterval(checkSDK);
          resolve();
        } else {
          waited += checkInterval;
        }
      }, checkInterval);
    });
  }

  async keywordToCoordinates(
    keyword: string,
    region?: string,
    userLocation?: { latitude: number; longitude: number }
  ): Promise<GeocodeResult | null> {
    if (!keyword || keyword.trim().length === 0) return null;
    if (
      keyword.includes('정보 없음') ||
      keyword.includes('미제공') ||
      keyword.includes('병원명 없음')
    ) {
      return null;
    }

    const cleanKeyword = keyword.replace(/\s+/g, ' ').trim();
    const cacheKey = buildGeocodeCacheKey(cleanKeyword, region);
    const cached = geocodeCache.get(cacheKey);
    if (cached) {
      if (cached.expiresAt > Date.now()) return cached.result;
      geocodeCache.delete(cacheKey);
    }

    const inFlight = geocodeRequestsInFlight.get(cacheKey);
    if (inFlight) return inFlight;

    const request = this.lookupCoordinates(cleanKeyword, keyword, region, userLocation)
      .then((result) => {
        if (result) this.cacheGeocode(cacheKey, result);
        return result;
      })
      .finally(() => {
        geocodeRequestsInFlight.delete(cacheKey);
      });

    geocodeRequestsInFlight.set(cacheKey, request);
    return request;
  }

  private async lookupCoordinates(
    cleanKeyword: string,
    originalKeyword: string,
    region?: string,
    userLocation?: { latitude: number; longitude: number }
  ): Promise<GeocodeResult | null> {
    // Hospital names are usually unique. Try the direct name first so mixed
    // regional feeds (e.g. Gwangju/Jeonnam) do not waste a request on an
    // incorrect region-qualified query. Region remains a fallback for ambiguous names.
    const searchQueries = Array.from(
      new Set([
        cleanKeyword,
        region ? `${cleanKeyword} ${region}` : cleanKeyword,
      ])
    );

    for (const query of searchQueries) {
      const proxyResult = await this.performProxySearch(query, originalKeyword, userLocation);
      if (proxyResult) return proxyResult;
    }

    await this.initPromise;
    if (!this.placesService) {
      console.warn(`Geocoding unavailable for "${originalKeyword}": proxy and JS SDK both failed`);
      return null;
    }

    for (const query of searchQueries) {
      const sdkResult = await this.performSdkSearch(query, originalKeyword, userLocation);
      if (sdkResult) return sdkResult;
    }

    return null;
  }

  private async performProxySearch(
    searchQuery: string,
    originalKeyword: string,
    userLocation?: { latitude: number; longitude: number }
  ): Promise<GeocodeResult | null> {
    try {
      const params = new URLSearchParams({
        type: 'keyword',
        query: searchQuery,
        size: '5',
      });
      const response = await fetch(`/api/kakao/geocoding?${params.toString()}`, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) return null;

      const payload = await response.json() as { documents?: KakaoDocument[] };
      return this.pickResult(payload.documents || [], searchQuery, originalKeyword, userLocation);
    } catch (error) {
      console.warn(`Proxy geocoding failed for "${originalKeyword}"`, error);
      return null;
    }
  }

  private performSdkSearch(
    searchQuery: string,
    originalKeyword: string,
    userLocation?: { latitude: number; longitude: number }
  ): Promise<GeocodeResult | null> {
    return new Promise((resolve) => {
      this.placesService.keywordSearch(
        searchQuery,
        (result: KakaoDocument[], status: any) => {
          if (status !== window.kakao.maps.services.Status.OK || !result) {
            resolve(null);
            return;
          }
          resolve(this.pickResult(result, searchQuery, originalKeyword, userLocation));
        },
        { size: 5 }
      );
    });
  }

  private cacheGeocode(cacheKey: string, result: GeocodeResult): void {
    const now = Date.now();
    for (const [key, entry] of geocodeCache) {
      if (entry.expiresAt <= now) geocodeCache.delete(key);
    }

    if (geocodeCache.size >= GEOCODE_CACHE_MAX_ENTRIES) {
      const oldestKey = geocodeCache.keys().next().value as string | undefined;
      if (oldestKey) geocodeCache.delete(oldestKey);
    }

    geocodeCache.set(cacheKey, {
      result,
      expiresAt: now + GEOCODE_CACHE_TTL_MS,
    });
  }

  private pickResult(
    result: KakaoDocument[],
    searchQuery: string,
    originalKeyword: string,
    userLocation?: { latitude: number; longitude: number }
  ): GeocodeResult | null {
    if (result.length === 0) return null;

    const hospitals = result.filter((place) =>
      place.category_group_code === 'HP8' ||
      place.category_name?.includes('병원') ||
      place.category_name?.includes('의료')
    );
    const firstResult = hospitals[0] ?? result[0];
    if (!firstResult) return null;

    const latitude = Number(firstResult.y);
    const longitude = Number(firstResult.x);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    if (latitude < 33 || latitude > 39 || longitude < 124 || longitude > 132) return null;

    if (userLocation) {
      const distance = this.calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        latitude,
        longitude
      );
      if (distance > 100) {
        console.warn(
          `Ignoring far geocode for "${originalKeyword}" (${searchQuery}): ${distance.toFixed(1)}km`
        );
        return null;
      }
    }

    return {
      latitude,
      longitude,
      address: firstResult.road_address_name || firstResult.address_name || '주소 정보 없음',
    };
  }

  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
