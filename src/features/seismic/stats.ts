import { dayKey } from "./format";
import type { SeismicEvent } from "./types";

export interface Summary {
  total: number;
  panama: number;
  maritima: number;
  withMag: number;
  maxMag: number | null;
  meanMag: number | null;
  withDepth: number;
  meanDepth: number | null;
  strongest: SeismicEvent | null;
  multiSource: number;
}

export function summarize(events: SeismicEvent[]): Summary {
  const mags = events.filter((e) => e.primary.magnitude != null);
  const depths = events.filter((e) => e.primary.depthKm != null);
  const strongest = mags.reduce<SeismicEvent | null>((b, e) => (!b || e.primary.magnitude! > b.primary.magnitude! ? e : b), null);
  return {
    total: events.length,
    panama: events.filter((e) => e.classification === "panama").length,
    maritima: events.filter((e) => e.classification === "maritima").length,
    withMag: mags.length,
    maxMag: strongest?.primary.magnitude ?? null,
    meanMag: mags.length ? mags.reduce((s, e) => s + e.primary.magnitude!, 0) / mags.length : null,
    withDepth: depths.length,
    meanDepth: depths.length ? depths.reduce((s, e) => s + e.primary.depthKm!, 0) / depths.length : null,
    strongest,
    multiSource: events.filter((e) => e.reports.length > 1).length,
  };
}

/** Conteo por día (hora de Panamá) entre start y end, incluyendo días sin eventos. */
export function countByDay(events: SeismicEvent[], startIso: string, endIso: string) {
  const days: string[] = [];
  const d = new Date(Date.parse(startIso));
  const end = Date.parse(endIso);
  while (d.getTime() <= end + 86400_000) {
    const k = dayKey(d.toISOString());
    if (!days.includes(k)) days.push(k);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  const lastKey = dayKey(endIso);
  const trimmed = days.slice(0, days.indexOf(lastKey) + 1 || days.length);
  const map = new Map(trimmed.map((k) => [k, { panama: 0, maritima: 0 }]));
  for (const e of events) {
    const k = dayKey(e.primary.occurredAtUtc);
    const row = map.get(k);
    if (row && e.classification !== "fuera") row[e.classification]++;
  }
  return [...map.entries()].map(([day, v]) => ({ day, ...v }));
}

export function histogram(values: number[], edges: number[]): number[] {
  const out = new Array(edges.length - 1).fill(0);
  for (const v of values)
    for (let i = 0; i < edges.length - 1; i++)
      if (v >= edges[i]! && (v < edges[i + 1]! || (i === edges.length - 2 && v <= edges[i + 1]!))) { out[i]++; break; }
  return out;
}

export function byProvince(events: SeismicEvent[]) {
  const m = new Map<string, number>();
  for (const e of events) if (e.classification === "panama") m.set(e.province ?? "No asignada", (m.get(e.province ?? "No asignada") ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
