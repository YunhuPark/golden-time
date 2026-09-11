import { Coordinates } from '../valueObjects/Coordinates';

type RegionBounds = {
  name: string;
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
  priority: number;
};

const REGION_BOUNDS: RegionBounds[] = [
  { name: '서울특별시', minLat: 37.4, maxLat: 37.7, minLon: 126.7, maxLon: 127.2, priority: 0 },
  { name: '인천광역시', minLat: 37.3, maxLat: 37.6, minLon: 126.5, maxLon: 126.8, priority: 0 },
  { name: '부산광역시', minLat: 35.0, maxLat: 35.3, minLon: 128.9, maxLon: 129.2, priority: 0 },
  { name: '대구광역시', minLat: 35.75, maxLat: 36.05, minLon: 128.45, maxLon: 128.75, priority: 0 },
  { name: '광주광역시', minLat: 35.05, maxLat: 35.30, minLon: 126.70, maxLon: 127.05, priority: 0 },
  { name: '대전광역시', minLat: 36.20, maxLat: 36.50, minLon: 127.20, maxLon: 127.60, priority: 0 },
  { name: '울산광역시', minLat: 35.35, maxLat: 35.75, minLon: 129.00, maxLon: 129.50, priority: 0 },
  { name: '세종특별자치시', minLat: 36.45, maxLat: 36.75, minLon: 127.10, maxLon: 127.45, priority: 0 },
  { name: '경기도', minLat: 37.0, maxLat: 38.3, minLon: 126.3, maxLon: 127.9, priority: 1 },
  { name: '경상남도', minLat: 34.6, maxLat: 35.7, minLon: 127.5, maxLon: 129.6, priority: 1 },
  { name: '경상북도', minLat: 35.5, maxLat: 37.2, minLon: 128.0, maxLon: 130.0, priority: 1 },
  { name: '전라남도', minLat: 34.0, maxLat: 35.6, minLon: 125.8, maxLon: 127.8, priority: 1 },
  { name: '전북특별자치도', minLat: 35.3, maxLat: 36.2, minLon: 126.3, maxLon: 127.9, priority: 1 },
  { name: '충청남도', minLat: 35.9, maxLat: 37.1, minLon: 126.1, maxLon: 127.7, priority: 1 },
  { name: '충청북도', minLat: 36.0, maxLat: 37.3, minLon: 127.3, maxLon: 129.0, priority: 1 },
  { name: '강원특별자치도', minLat: 37.0, maxLat: 38.7, minLon: 127.0, maxLon: 129.6, priority: 1 },
  { name: '제주특별자치도', minLat: 33.1, maxLat: 33.7, minLon: 126.0, maxLon: 127.0, priority: 1 },
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function distanceKmToBounds(coords: Coordinates, bounds: RegionBounds): number {
  const nearestLat = clamp(coords.latitude, bounds.minLat, bounds.maxLat);
  const nearestLon = clamp(coords.longitude, bounds.minLon, bounds.maxLon);
  const latKm = (coords.latitude - nearestLat) * 111.32;
  const avgLatRad = ((coords.latitude + nearestLat) / 2) * Math.PI / 180;
  const lonKm = (coords.longitude - nearestLon) * 111.32 * Math.cos(avgLatRad);
  return Math.hypot(latKm, lonKm);
}

/**
 * Infer the E-Gen first-level region for a coordinate.
 * Metropolitan/special cities win over surrounding provinces when bounds overlap.
 */
export function inferRegionFromCoordinates(coords: Coordinates): string | null {
  const matches = REGION_BOUNDS
    .filter((region) =>
      coords.latitude >= region.minLat &&
      coords.latitude <= region.maxLat &&
      coords.longitude >= region.minLon &&
      coords.longitude <= region.maxLon
    )
    .sort((a, b) => a.priority - b.priority);

  return matches[0]?.name ?? null;
}

/**
 * Return every first-level E-Gen region whose approximate geographic bounds are
 * within radiusKm of the user's GPS coordinate. The current region is returned
 * first, followed by neighboring regions ordered by distance.
 *
 * Jeju is intentionally isolated from mainland fan-out. Rectangular province
 * bounds include offshore waters/islands, so a pure bounding-box distance can
 * create a false mainland overlap even though a 100km emergency search should
 * stay on Jeju. Mainland searches likewise do not fan out to Jeju.
 */
export function getRegionsWithinRadius(
  coords: Coordinates,
  radiusKm = 100
): string[] {
  const currentRegion = inferRegionFromCoordinates(coords);
  if (!currentRegion) return [];

  if (currentRegion === '제주특별자치도') {
    return ['제주특별자치도'];
  }

  return REGION_BOUNDS
    .filter((region) => region.name !== '제주특별자치도')
    .map((region) => ({
      name: region.name,
      distanceKm: distanceKmToBounds(coords, region),
      isCurrent: region.name === currentRegion,
    }))
    .filter((region) => region.distanceKm <= radiusKm)
    .sort((a, b) => {
      if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
      return a.distanceKm - b.distanceKm;
    })
    .map((region) => region.name);
}
