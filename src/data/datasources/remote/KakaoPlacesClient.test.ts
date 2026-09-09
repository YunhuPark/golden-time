import { describe, expect, it } from 'vitest';
import { buildGeocodeCacheKey } from './KakaoPlacesClient';

describe('buildGeocodeCacheKey', () => {
  it('normalizes whitespace and case', () => {
    expect(buildGeocodeCacheKey('  Test   Hospital  ', ' 광주광역시 ')).toBe(
      '광주광역시::test hospital'
    );
  });

  it('keeps identical hospital names in different regions isolated', () => {
    expect(buildGeocodeCacheKey('한국병원', '광주광역시')).not.toBe(
      buildGeocodeCacheKey('한국병원', '서울특별시')
    );
  });

  it('uses an explicit bucket when region is unavailable', () => {
    expect(buildGeocodeCacheKey('한국병원')).toBe('any-region::한국병원');
  });
});
