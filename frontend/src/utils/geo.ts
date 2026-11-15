import * as turf from '@turf/turf';
import { Depot } from '../types/defense';
import { fetchIndiaGeoJson } from '../services/api';

export const INDIA_CENTER: [number, number] = [22.5, 79.0];
export const INDIA_DEFAULT_ZOOM = 5;
export const INDIA_MAX_BOUNDS: [[number, number], [number, number]] = [
  [4.0, 65.0],
  [40.0, 100.0]
];

let cachedGeoJson: any = null;

export async function getLoadedIndiaGeoJson(): Promise<any> {
  if (cachedGeoJson) return cachedGeoJson;
  cachedGeoJson = await fetchIndiaGeoJson();
  return cachedGeoJson;
}

export function getStateForPoint(
  lat: number | null | undefined,
  lon: number | null | undefined,
  geojson?: any
): string {
  if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) {
    return 'Outside India';
  }

  // Quick bounding box check
  if (lat < 6.0 || lat > 38.0 || lon < 68.0 || lon > 98.0) {
    return 'Outside India';
  }

  const data = geojson || cachedGeoJson;
  if (!data || !data.features) {
    return 'Outside India';
  }

  const pt = turf.point([lon, lat]);
  for (const feature of data.features) {
    try {
      if (turf.booleanPointInPolygon(pt, feature)) {
        return feature.properties?.state_name || 'Outside India';
      }
    } catch {
      // Continue next feature on sliver error
    }
  }

  return 'Outside India';
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371.0;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  return Math.round(R * c * 100) / 100;
}

export function computeNearestDepotDistance(
  siteCoords: { lat?: number | null; lon?: number | null; x?: number | null; y?: number | null },
  depots: Depot[] | undefined,
  coordMode: 'geo' | 'grid',
  fallbackDepot?: { depot_lat?: number | null; depot_lon?: number | null; depot_x?: number | null; depot_y?: number | null }
): number {
  if (depots && depots.length > 0) {
    let minD = Infinity;
    for (const d of depots) {
      if (coordMode === 'geo') {
        const sLat = siteCoords.lat ?? 0;
        const sLon = siteCoords.lon ?? 0;
        const dLat = d.lat ?? 0;
        const dLon = d.lon ?? 0;
        const dist = haversineKm(sLat, sLon, dLat, dLon);
        if (dist < minD) minD = dist;
      } else {
        const sX = siteCoords.x ?? 0;
        const sY = siteCoords.y ?? 0;
        const dX = d.x ?? 0;
        const dY = d.y ?? 0;
        const dist = Math.hypot(sX - dX, sY - dY) * 10.0;
        if (dist < minD) minD = dist;
      }
    }
    if (minD !== Infinity) return Math.round(minD * 100) / 100;
  }

  // Fallback to scenario parameters depot
  if (coordMode === 'geo') {
    const sLat = siteCoords.lat ?? 0;
    const sLon = siteCoords.lon ?? 0;
    const dLat = fallbackDepot?.depot_lat ?? 0;
    const dLon = fallbackDepot?.depot_lon ?? 0;
    return haversineKm(sLat, sLon, dLat, dLon);
  } else {
    const sX = siteCoords.x ?? 0;
    const sY = siteCoords.y ?? 0;
    const dX = fallbackDepot?.depot_x ?? 0;
    const dY = fallbackDepot?.depot_y ?? 0;
    return Math.round(Math.hypot(sX - dX, sY - dY) * 1000) / 100;
  }
}
