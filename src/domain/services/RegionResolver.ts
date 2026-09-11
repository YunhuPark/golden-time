import { Coordinates } from '../valueObjects/Coordinates';

interface RegionBounds {
  name: string;
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

/**
 * Tight bounds are used only to identify the user's primary first-level region.
 * Metropolitan/special cities are intentionally checked before surrounding provinces.
 */
const PRIMARY_REGION_BOUNDS: RegionBounds[] = [
  { name: '서울특별시', minLat: 37.4, maxLat: 37.7, minLon: 126.7, maxLon: 127.2 },
  { name: '인천광역시', minLat: 37.3, maxLat: 37.6, minLon: 126.5, maxLon: 126.8 },
  { name: '부산광역시', minLat: 35.0, maxLat: 35.3, minLon: 128.9, maxLon: 129.2 },
  { name: '대구광역시', minLat: 35.75, maxLat: 36.05, minLon: 128.45, maxLon: 128.75 },
  { name: '광주광역시', minLat: 35.05, maxLat: 35.3, minLon: 126.7, maxLon: 127.05 },
  { name: '대전광역시', minLat: 36.2, maxLat: 36.5, minLon: 127.2, maxLon: 127.6 },
  { name: '울산광역시', minLat: 35.35, maxLat: 35.75, minLon: 129.0, maxLon: 129.5 },
  { name: '세종특별자치시', minLat: 36.45, maxLat: 36.75, minLon: 127.1, maxLon: 127.45 },
  { name: '경기도', minLat: 37.0, maxLat: 38.3, minLon: 126.3, maxLon: 127.9 },
  { name: '경상남도', minLat: 34.6, maxLat: 35.7, minLon: 127.5, maxLon: 129.6 },
  { name: '경상북도', minLat: 35.5, maxLat: 37.2, minLon: 128.0, maxLon: 130.0 },
  { name: '전라남도', minLat: 34.0, maxLat: 35.6, minLon: 125.8, maxLon: 127.8 },
  { name: '전북특별자치도', minLat: 35.3, maxLat: 36.2, minLon: 126.3, maxLon: 127.9 },
  { name: '충청남도', minLat: 35.9, maxLat: 37.1, minLon: 126.1, maxLon: 127.7 },
  { name: '충청북도', minLat: 36.0, maxLat: 37.3, minLon: 127.3, maxLon: 129.0 },
  { name: '강원특별자치도', minLat: 37.0, maxLat: 38.7, minLon: 127.0, maxLon: 129.6 },
  { name: '제주특별자치도', minLat: 33.1, maxLat: 33.7, minLon: 126.0, maxLon: 127.0 },
];

/**
 * Broader coverage bounds are used to decide which E-Gen regions could contain
 * a hospital inside the requested radius. The final hospital list is always
 * filtered by the hospital's actual coordinate, so broad bounds only increase
 * source coverage; they do not make a distant hospital eligible.
 */
const SEARCH_REGION_BOUNDS: RegionBounds[] = [
  { name: '서울특별시', minLat: 37.35, maxLat: 37.75, minLon: 126.72, maxLon: 127.22 },
  { name: '인천광역시', minLat: 37.0, maxLat: 38.1, minLon: 124.4, maxLon: 126.95 },
  { name: '부산광역시', minLat: 34.85, maxLat: 35.4, minLon: 128.75, maxLon: 129.4 },
  { name: '대구광역시', minLat: 35.55, maxLat: 36.2, minLon: 128.3, maxLon: 129.0 },
  { name: '광주광역시', minLat: 34.95, maxLat: 35.35, minLon: 126.65, maxLon: 127.1 },
  { name: '대전광역시', minLat: 36.1, maxLat: 36.55, minLon: 127.15, maxLon: 127.7 },
  { name: '울산광역시', minLat: 35.25, maxLat: 35.85, minLon: 128.95, maxLon: 129.55 },
  { name: '세종특별자치시', minLat: 36.35, maxLat: 36.8, minLon: 127.0, maxLon: 127.5 },
  { name: '경기도', minLat: 36.8, maxLat: 38.35, minLon: 126.25, maxLon: 128.0 },
  { name: '경상남도', minLat: 34.45, maxLat: 35.85, minLon: 127.45, maxLon: 129.65 },
  { name: '경상북도', minLat: 35.35, maxLat: 37.65, minLon: 127.85, maxLon: 131.95 },
  { name: '전라남도', minLat: 33.85, maxLat: 35.65, minLon: 124.6, maxLon: 127.9 },
  { name: '전북특별자치도', minLat: 35.15, maxLat: 36.35, minLon: 126.15, maxLon: 128.05 },
  { name: '충청남도', minLat: 35.75, maxLat: 37.15, minLon: 125.75, maxLon: 127.85 },
  { name: '충청북도', minLat: 35.9, maxLat: 37.35, minLon: 127.2, maxLon: 129.05 },
  { name: '강원특별자치도', minLat: 36.85, maxLat: 38.75, minLon: 126.95, maxLon: 129.85 },
  { name: '제주특별자치도', minLat: 32.95, maxLat: 33.75, minLon: 125.8, maxLon: 127.1 },
];

function contains(bounds: RegionBounds, coords: Coordinates): boolean {
  return (
    coords.latitude >= bounds.minLat &&
    coords.latitude <= bounds.maxLat &&
    coords.longitude >= bounds.minLon &&
    coords.longitude <= bounds.maxLon
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function distanceToBoundsKm(coords: Coordinates, bounds: RegionBounds): number {
  const closest = new Coordinates(
    clamp(coords.latitude, bounds.minLat, bounds.maxLat),
    clamp(coords.longitude, bounds.minLon, bounds.maxLon)
  );
  return coords.distanceTo(closest) / 1000;
}

/**
 * Infer the E-Gen first-level region for a coordinate.
 * Returns null rather than assigning an unrelated fallback region.
 */
export function inferRegionFromCoordinates(coords: Coordinates): string | null {
  return PRIMARY_REGION_BOUNDS.find((bounds) => contains(bounds, coords))?.name ?? null;
}

/**
 * Return every first-level E-Gen region whose coverage can intersect the user's
 * search radius. The primary region is ordered first when it can be resolved.
 *
 * This is what allows a user near an administrative boundary to see a closer
 * emergency room in a neighboring province/city instead of being constrained
 * to one STAGE1 response.
 */
export function getRegionsWithinRadius(
  coords: Coordinates,
  radiusKm = 100
): string[] {
  if (!Number.isFinite(radiusKm) || radiusKm < 0) {
    throw new Error(`Invalid radiusKm: ${radiusKm}`);
  }

  const primaryRegion = inferRegionFromCoordinates(coords);

  return SEARCH_REGION_BOUNDS
    .map((bounds, index) => ({
      name: bounds.name,
      index,
      distanceKm: distanceToBoundsKm(coords, bounds),
    }))
    .filter((candidate) => candidate.distanceKm <= radiusKm)
    .sort((a, b) => {
      if (a.name === primaryRegion && b.name !== primaryRegion) return -1;
      if (b.name === primaryRegion && a.name !== primaryRegion) return 1;
      if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
      return a.index - b.index;
    })
    .map((candidate) => candidate.name);
}
