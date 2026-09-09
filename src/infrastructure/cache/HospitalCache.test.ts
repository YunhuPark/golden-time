import { beforeEach, describe, expect, it } from 'vitest';
import { Hospital } from '../../domain/entities/Hospital';
import { Coordinates } from '../../domain/valueObjects/Coordinates';
import { HospitalCache } from './HospitalCache';

const CACHE_KEY = 'golden-time-hospital-cache';
const USER_LOCATION = new Coordinates(35.146, 126.9239);

function createHospital(): Hospital {
  return new Hospital(
    'A1500002',
    '테스트병원',
    new Coordinates(35.154, 126.91),
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

describe('HospitalCache privacy', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('does not persist the user precise coordinates on new cache writes', () => {
    HospitalCache.save([createHospital()], USER_LOCATION);

    const raw = localStorage.getItem(CACHE_KEY);
    expect(raw).not.toBeNull();

    const cached = JSON.parse(raw as string);
    expect(cached.region).toBe('광주광역시');
    expect(cached).not.toHaveProperty('location');
    expect(cached.hospitals[0].coordinates).toEqual(
      expect.objectContaining({ latitude: 35.154, longitude: 126.91 })
    );
  });

  it('removes precise coordinates from a legacy cache entry when it is read', () => {
    const hospital = createHospital();
    HospitalCache.save([hospital], USER_LOCATION);

    const current = JSON.parse(localStorage.getItem(CACHE_KEY) as string);
    current.location = {
      latitude: USER_LOCATION.latitude,
      longitude: USER_LOCATION.longitude,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(current));

    const loaded = HospitalCache.load(USER_LOCATION);
    expect(loaded?.hospitals).toHaveLength(1);

    const migrated = JSON.parse(localStorage.getItem(CACHE_KEY) as string);
    expect(migrated).not.toHaveProperty('location');
  });
});
