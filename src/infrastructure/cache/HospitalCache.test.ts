import { beforeEach, describe, expect, it } from 'vitest';
import { Hospital } from '../../domain/entities/Hospital';
import { Coordinates } from '../../domain/valueObjects/Coordinates';
import { HospitalCache } from './HospitalCache';

const CACHE_KEY = 'golden-time-hospital-cache';
const USER_LOCATION = new Coordinates(35.146, 126.9239);

function createHospital(
  id = 'A1500002',
  lat = 35.154,
  lon = 126.91
): Hospital {
  return new Hospital(
    id,
    '테스트병원',
    new Coordinates(lat, lon),
    '광주광역시 테스트로 1',
    '062-000-0000',
    '062-111-1111',
    3,
    10,
    ['응급의학과'],
    2,
    true,
    new Date(),
    true,
    true,
    true,
    10,
    600,
    5000,
    2,
    1
  );
}

describe('HospitalCache nationwide GPS scope', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('does not persist exact user coordinates and stores a nationwide search scope', () => {
    HospitalCache.save([createHospital()], USER_LOCATION);

    const raw = localStorage.getItem(CACHE_KEY);
    expect(raw).not.toBeNull();

    const cached = JSON.parse(raw as string);
    expect(cached.schemaVersion).toBe(2);
    expect(cached.region).toBe('광주광역시');
    expect(cached.searchScope).toContain('광주광역시::');
    expect(cached.searchScope).toContain('전라남도');
    expect(cached).not.toHaveProperty('location');
    expect(cached.hospitals[0].coordinates).toEqual(
      expect.objectContaining({ latitude: 35.154, longitude: 126.91 })
    );
  });

  it('invalidates a legacy single-region cache instead of reusing it', () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      hospitals: [],
      timestamp: Date.now(),
      region: '광주광역시',
      location: {
        latitude: USER_LOCATION.latitude,
        longitude: USER_LOCATION.longitude,
      },
    }));

    expect(HospitalCache.load(USER_LOCATION)).toBeNull();
    expect(localStorage.getItem(CACHE_KEY)).toBeNull();
  });

  it('rejects a cache when the nationwide region set changes', () => {
    const seoul = new Coordinates(37.5665, 126.9780);
    const busan = new Coordinates(35.1796, 129.0756);
    HospitalCache.save([createHospital('SEOUL', 37.55, 127.0)], seoul);

    expect(HospitalCache.load(busan)).toBeNull();
  });

  it('re-filters cached hospitals against the current GPS before returning them', () => {
    const seoul = new Coordinates(37.5665, 126.9780);
    HospitalCache.save([
      createHospital('NEAR', 37.55, 127.0),
      createHospital('FAR', 36.4, 126.9),
    ], seoul);

    const loaded = HospitalCache.load(seoul);
    expect(loaded?.hospitals.map((hospital) => hospital.id)).toEqual(['NEAR']);
  });
});
