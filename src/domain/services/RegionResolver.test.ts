import { describe, expect, it } from 'vitest';
import { Coordinates } from '../valueObjects/Coordinates';
import { getRegionsWithinRadius, inferRegionFromCoordinates } from './RegionResolver';

describe('inferRegionFromCoordinates', () => {
  it('resolves Gwangju before the surrounding Jeollanam-do bounds', () => {
    const gwangju = new Coordinates(35.1460, 126.9239);
    expect(inferRegionFromCoordinates(gwangju)).toBe('광주광역시');
  });

  it('resolves Seoul before Gyeonggi-do', () => {
    const seoul = new Coordinates(37.5665, 126.9780);
    expect(inferRegionFromCoordinates(seoul)).toBe('서울특별시');
  });

  it('resolves a Jeollanam-do coordinate outside Gwangju', () => {
    const mokpo = new Coordinates(34.8118, 126.3922);
    expect(inferRegionFromCoordinates(mokpo)).toBe('전라남도');
  });

  it('returns null instead of guessing for unsupported coordinates', () => {
    const unsupported = new Coordinates(25.0, 121.5);
    expect(inferRegionFromCoordinates(unsupported)).toBeNull();
  });
});

describe('getRegionsWithinRadius', () => {
  it('includes neighboring first-level regions around the Seoul metropolitan area', () => {
    const seoul = new Coordinates(37.5665, 126.9780);
    const regions = getRegionsWithinRadius(seoul, 100);

    expect(regions[0]).toBe('서울특별시');
    expect(regions).toContain('경기도');
    expect(regions).toContain('인천광역시');
  });

  it('includes both provinces near an administrative boundary', () => {
    const border = new Coordinates(36.95, 127.0);
    const regions = getRegionsWithinRadius(border, 100);

    expect(regions).toContain('경기도');
    expect(regions).toContain('충청남도');
  });

  it('keeps Jeju searches scoped to regions that can intersect the radius', () => {
    const jeju = new Coordinates(33.4996, 126.5312);
    const regions = getRegionsWithinRadius(jeju, 100);

    expect(regions[0]).toBe('제주특별자치도');
    expect(regions).not.toContain('서울특별시');
  });

  it('returns no unrelated fallback region outside Korea coverage', () => {
    const unsupported = new Coordinates(25.0, 121.5);
    expect(getRegionsWithinRadius(unsupported, 100)).toEqual([]);
  });
});
