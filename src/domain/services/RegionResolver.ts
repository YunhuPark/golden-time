import { Coordinates } from '../valueObjects/Coordinates';

/**
 * Infer the E-Gen first-level region for a coordinate.
 *
 * Metropolitan/special cities are checked before surrounding provinces so
 * overlapping bounding boxes resolve to the more specific administrative area.
 * Returns null rather than guessing when a coordinate is outside the supported
 * bounds; callers can then fail safely instead of assigning the wrong region.
 */
export function inferRegionFromCoordinates(coords: Coordinates): string | null {
  const { latitude, longitude } = coords;

  if (latitude >= 37.4 && latitude <= 37.7 && longitude >= 126.7 && longitude <= 127.2) return '서울특별시';
  if (latitude >= 37.3 && latitude <= 37.6 && longitude >= 126.5 && longitude <= 126.8) return '인천광역시';
  if (latitude >= 35.0 && latitude <= 35.3 && longitude >= 128.9 && longitude <= 129.2) return '부산광역시';
  if (latitude >= 35.75 && latitude <= 36.05 && longitude >= 128.45 && longitude <= 128.75) return '대구광역시';
  if (latitude >= 35.05 && latitude <= 35.30 && longitude >= 126.70 && longitude <= 127.05) return '광주광역시';
  if (latitude >= 36.20 && latitude <= 36.50 && longitude >= 127.20 && longitude <= 127.60) return '대전광역시';
  if (latitude >= 35.35 && latitude <= 35.75 && longitude >= 129.00 && longitude <= 129.50) return '울산광역시';
  if (latitude >= 36.45 && latitude <= 36.75 && longitude >= 127.10 && longitude <= 127.45) return '세종특별자치시';

  if (latitude >= 37.0 && latitude <= 38.3 && longitude >= 126.3 && longitude <= 127.9) return '경기도';
  if (latitude >= 34.6 && latitude <= 35.7 && longitude >= 127.5 && longitude <= 129.6) return '경상남도';
  if (latitude >= 35.5 && latitude <= 37.2 && longitude >= 128.0 && longitude <= 130.0) return '경상북도';
  if (latitude >= 34.0 && latitude <= 35.6 && longitude >= 125.8 && longitude <= 127.8) return '전라남도';
  if (latitude >= 35.3 && latitude <= 36.2 && longitude >= 126.3 && longitude <= 127.9) return '전북특별자치도';
  if (latitude >= 35.9 && latitude <= 37.1 && longitude >= 126.1 && longitude <= 127.7) return '충청남도';
  if (latitude >= 36.0 && latitude <= 37.3 && longitude >= 127.3 && longitude <= 129.0) return '충청북도';
  if (latitude >= 37.0 && latitude <= 38.7 && longitude >= 127.0 && longitude <= 129.6) return '강원특별자치도';
  if (latitude >= 33.1 && latitude <= 33.7 && longitude >= 126.0 && longitude <= 127.0) return '제주특별자치도';

  return null;
}
