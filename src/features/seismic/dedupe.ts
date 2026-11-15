import type { SourceId, SourceReport } from "./types";

export interface DedupeTolerance {
  maxSeconds: number;
  maxKm: number;
  maxMagDiff: number;
}
export const DEFAULT_TOLERANCE: DedupeTolerance = { maxSeconds: 30, maxKm: 60, maxMagDiff: 1.0 };

/** Prioridad para elegir el reporte principal de un grupo (menor = preferido). */
export const SOURCE_PRIORITY: Record<SourceId, number> = { usgs: 0, emsc: 1 };

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function isSameEvent(a: SourceReport, b: SourceReport, tol: DedupeTolerance = DEFAULT_TOLERANCE): boolean {
  if (a.sourceId === b.sourceId) return a.externalId === b.externalId;
  const dt = Math.abs(Date.parse(a.occurredAtUtc) - Date.parse(b.occurredAtUtc)) / 1000;
  if (dt > tol.maxSeconds) return false;
  if (haversineKm(a.latitude, a.longitude, b.latitude, b.longitude) > tol.maxKm) return false;
  if (a.magnitude != null && b.magnitude != null && Math.abs(a.magnitude - b.magnitude) > tol.maxMagDiff) return false;
  return true;
}

/** Agrupa reportes de distintas agencias que describen el mismo sismo, conservando todos los originales. */
export function groupReports(reports: SourceReport[], tol: DedupeTolerance = DEFAULT_TOLERANCE): SourceReport[][] {
  const sorted = [...reports].sort((a, b) => Date.parse(a.occurredAtUtc) - Date.parse(b.occurredAtUtc));
  const groups: SourceReport[][] = [];
  for (const r of sorted) {
    let target: SourceReport[] | undefined;
    for (let i = groups.length - 1; i >= 0; i--) {
      const g = groups[i]!;
      const last = g[g.length - 1]!;
      if ((Date.parse(r.occurredAtUtc) - Date.parse(last.occurredAtUtc)) / 1000 > tol.maxSeconds * 2) break;
      if (g.some((x) => x.sourceId === r.sourceId && x.externalId === r.externalId)) { target = undefined; break; }
      if (!g.some((x) => x.sourceId === r.sourceId) && g.some((x) => isSameEvent(x, r, tol))) { target = g; break; }
    }
    if (target) target.push(r);
    else if (!groups.some((g) => g.some((x) => x.sourceId === r.sourceId && x.externalId === r.externalId))) groups.push([r]);
  }
  for (const g of groups) g.sort((a, b) => SOURCE_PRIORITY[a.sourceId] - SOURCE_PRIORITY[b.sourceId]);
  return groups;
}
