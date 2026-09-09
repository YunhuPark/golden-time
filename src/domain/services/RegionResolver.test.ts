import { describe, expect, it } from 'vitest';
import { Coordinates } from '../valueObjects/Coordinates';
import { inferRegionFromCoordinates } from './RegionResolver';

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
