import type { GeoClass, SeismicEvent, SourceId } from "./types";

export interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  minMagnitude: number;
  zones: Exclude<GeoClass, "fuera">[];
  province: string | null; // null = cualquiera
  maxDepthKm: number | null; // null = cualquiera
  sources: SourceId[];
}

export interface AlertPrefs {
  enabled: boolean;
  sound: boolean;
  browser: boolean;
  rules: AlertRule[];
}

export interface DeliveredAlert {
  key: string; // ruleId|eventId
  ruleId: string;
  ruleName: string;
  eventId: string;
  magnitude: number | null;
  place: string;
  occurredAtUtc: string;
  deliveredAt: string;
  channels: string[];
  result: "entregada" | "error";
  error?: string;
}

export const DEFAULT_PREFS: AlertPrefs = {
  enabled: false,
  sound: false,
  browser: false,
  rules: [
    { id: "r-default", name: "Sismos sentibles en Panamá", enabled: true, minMagnitude: 4, zones: ["panama", "maritima"], province: null, maxDepthKm: null, sources: ["usgs", "emsc"] },
  ],
};

export function matchesRule(e: SeismicEvent, r: AlertRule): boolean {
  if (!r.enabled) return false;
  if (e.classification === "fuera" || !r.zones.includes(e.classification)) return false;
  const p = e.primary;
  if (p.magnitude == null || p.magnitude < r.minMagnitude) return false;
  if (r.province && e.province !== r.province) return false;
  if (r.maxDepthKm != null && (p.depthKm == null || p.depthKm > r.maxDepthKm)) return false;
  if (!e.reports.some((x) => r.sources.includes(x.sourceId))) return false;
  return true;
}

/**
 * Decide qué notificaciones generar. Solo considera eventos recibidos por primera vez (no presentes en `seen`)
 * y nunca repite la misma combinación regla+evento (claves en `delivered`).
 */
export function planNotifications(events: SeismicEvent[], prefs: AlertPrefs, seen: Set<string>, delivered: Set<string>) {
  const out: { rule: AlertRule; event: SeismicEvent; key: string }[] = [];
  if (!prefs.enabled) return out;
  for (const e of events) {
    if (seen.has(e.id)) continue;
    for (const r of prefs.rules) {
      const key = `${r.id}|${e.id}`;
      if (delivered.has(key)) continue;
      if (matchesRule(e, r)) out.push({ rule: r, event: e, key });
    }
  }
  return out;
}
