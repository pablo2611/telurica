import geoData from "@/data/panama-geo.json";
import type { GeoClass } from "./types";

type Ring = number[][];
type MultiPolygon = Ring[][];

interface GeoFile {
  adm0: { coordinates: MultiPolygon };
  provinces: { name: string; coordinates: MultiPolygon }[];
  neighbors: { name: string; coordinates: MultiPolygon }[];
}
const geo = geoData as unknown as GeoFile;

/** Radio de la zona marítima de monitoreo, medido desde el límite nacional de Panamá. */
export const MARITIME_BUFFER_KM = 150;

/** Recuadro amplio usado para consultar a las fuentes (lat/lon, WGS84). Luego se clasifica cada punto. */
export const QUERY_BBOX = { minLat: 3.5, maxLat: 11.5, minLon: -85.5, maxLon: -75.5 };

function pointInRing(lon: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi = 0, yi = 0] = ring[i]!;
    const [xj = 0, yj = 0] = ring[j]!;
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function pointInMultiPolygon(lon: number, lat: number, mp: MultiPolygon): boolean {
  for (const poly of mp) {
    if (!poly[0] || !pointInRing(lon, lat, poly[0])) continue;
    let inHole = false;
    for (let h = 1; h < poly.length; h++) if (pointInRing(lon, lat, poly[h]!)) inHole = true;
    if (!inHole) return true;
  }
  return false;
}

/** Distancia aproximada (km) de un punto al borde de un multipolígono, con proyección equirectangular local. */
export function distanceToMultiPolygonKm(lon: number, lat: number, mp: MultiPolygon): number {
  const kx = 111.32 * Math.cos((lat * Math.PI) / 180);
  const ky = 110.57;
  let best = Infinity;
  for (const poly of mp)
    for (const ring of poly)
      for (let i = 1; i < ring.length; i++) {
        const a = ring[i - 1]!, b = ring[i]!;
        const ax = (a[0]! - lon) * kx, ay = (a[1]! - lat) * ky;
        const bx = (b[0]! - lon) * kx, by = (b[1]! - lat) * ky;
        const dx = bx - ax, dy = by - ay;
        const len2 = dx * dx + dy * dy;
        const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
        const px = ax + t * dx, py = ay + t * dy;
        const d = Math.sqrt(px * px + py * py);
        if (d < best) best = d;
      }
  return best;
}

export function findProvince(lon: number, lat: number): string | null {
  for (const p of geo.provinces) if (pointInMultiPolygon(lon, lat, p.coordinates)) return p.name;
  return null;
}

/**
 * Clasifica un epicentro:
 * - "panama": dentro del territorio nacional.
 * - "maritima": fuera del territorio, a ≤ MARITIME_BUFFER_KM del límite nacional y no en tierra de un país vecino.
 * - "fuera": cualquier otro caso.
 */
export function classifyPoint(lon: number, lat: number): { classification: GeoClass; province: string | null } {
  if (pointInMultiPolygon(lon, lat, geo.adm0.coordinates)) {
    return { classification: "panama", province: findProvince(lon, lat) };
  }
  for (const n of geo.neighbors) if (pointInMultiPolygon(lon, lat, n.coordinates)) return { classification: "fuera", province: null };
  if (distanceToMultiPolygonKm(lon, lat, geo.adm0.coordinates) <= MARITIME_BUFFER_KM) return { classification: "maritima", province: null };
  return { classification: "fuera", province: null };
}

export function nearestProvince(lon: number, lat: number): string | null {
  let best: string | null = null, bd = Infinity;
  for (const p of geo.provinces) {
    const d = distanceToMultiPolygonKm(lon, lat, p.coordinates);
    if (d < bd) { bd = d; best = p.name; }
  }
  return best;
}

export const PROVINCE_NAMES = geo.provinces.map((p) => p.name).sort((a, b) => a.localeCompare(b, "es"));
