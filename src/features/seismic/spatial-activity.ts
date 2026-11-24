import type { SeismicEvent } from "./types";

// Fixed pointy hexagons in a local equirectangular projection centered on Panama.
// At 6–11°N the area distortion relative to 8.5°N is < 1%. No screen/zoom weighting.
const R = 6371.0088;
const RAD = Math.PI / 180;
const COS = Math.cos(8.5 * RAD);
export const CELL_RADIUS_KM = 12;
export const CELL_AREA_KM2 = Math.round(3 * Math.sqrt(3) * CELL_RADIUS_KM ** 2 / 2);
export interface ActivityCell {
  id: string;
  longitude: number;
  latitude: number;
  count: number;
  land: number;
  sea: number;
  maxMagnitude: number | null;
  meanDepth: number | null;
  latest: string;
  place: string;
}
export interface SpatialActivity { cells: ActivityCell[]; total: number; skipped: number }

function axial(x: number, y: number): [number, number] {
  const q = (Math.sqrt(3) / 3 * x - y / 3) / CELL_RADIUS_KM;
  const r = (2 / 3 * y) / CELL_RADIUS_KM;
  let a = Math.round(q), b = Math.round(-q - r), c = Math.round(r);
  const da = Math.abs(a - q), db = Math.abs(b + q + r), dc = Math.abs(c - r);
  if (da > db && da > dc) a = -b - c;
  else if (db > dc) b = -a - c;
  else c = -a - b;
  return [a, c];
}
const unproject = (x: number, y: number): [number, number] => [x / (R * RAD * COS) - 80, y / (R * RAD) + 8.5];

/** Aggregate the deduplicated, geographically filtered catalogue BEFORE sampling UI events. */
export function spatialActivity(events: SeismicEvent[]): SpatialActivity {
  const cells = new Map<string, ActivityCell & { depths: number; depthSum: number }>();
  let skipped = 0;
  for (const event of events) {
    const { longitude: lon, latitude: lat, magnitude, depthKm, occurredAtUtc } = event.primary;
    if (event.classification === "fuera" || !Number.isFinite(lon) || !Number.isFinite(lat) || lon < -180 || lon > 180 || lat < -90 || lat > 90) { skipped++; continue; }
    const [q, r] = axial((lon + 80) * R * RAD * COS, (lat - 8.5) * R * RAD);
    const id = `${q}:${r}`;
    let cell = cells.get(id);
    if (!cell) {
      const [longitude, latitude] = unproject(CELL_RADIUS_KM * Math.sqrt(3) * (q + r / 2), CELL_RADIUS_KM * 1.5 * r);
      cell = { id, longitude, latitude, count: 0, land: 0, sea: 0, maxMagnitude: null, meanDepth: null, latest: occurredAtUtc, place: event.province ?? event.nearestProvince ?? "Zona marítima", depths: 0, depthSum: 0 };
      cells.set(id, cell);
    }
    cell.count++;
    if (event.classification === "panama") cell.land++; else cell.sea++;
    if (magnitude != null && Number.isFinite(magnitude)) cell.maxMagnitude = Math.max(cell.maxMagnitude ?? -Infinity, magnitude);
    if (depthKm != null && Number.isFinite(depthKm) && depthKm >= 0) { cell.depths++; cell.depthSum += depthKm; }
    if (occurredAtUtc > cell.latest) cell.latest = occurredAtUtc;
  }
  return {
    cells: [...cells.values()].map(({ depths, depthSum, ...cell }) => ({ ...cell, meanDepth: depths ? depthSum / depths : null })).sort((a, b) => b.count - a.count || a.id.localeCompare(b.id)),
    total: events.length - skipped, skipped,
  };
}

export function activityGeoJSON(activity: SpatialActivity) {
  return { type: "FeatureCollection" as const, features: activity.cells.map(cell => {
    const x = (cell.longitude + 80) * R * RAD * COS, y = (cell.latitude - 8.5) * R * RAD;
    const ring = Array.from({ length: 6 }, (_, i) => {
      const angle = (60 * i - 30) * RAD;
      return unproject(x + CELL_RADIUS_KM * Math.cos(angle), y + CELL_RADIUS_KM * Math.sin(angle));
    });
    ring.push(ring[0]!);
    return { type: "Feature" as const, id: cell.id, properties: { ...cell }, geometry: { type: "Polygon" as const, coordinates: [ring] } };
  }) };
}
