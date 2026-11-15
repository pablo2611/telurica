import { QUERY_BBOX } from "./geo";
import {
  emscCollectionSchema,
  emscFeatureSchema,
  usgsCollectionSchema,
  usgsFeatureSchema,
  type SourceReport,
  type TsunamiBulletin,
} from "./types";

export interface AdapterResult<T> {
  ok: boolean;
  data: T;
  durationMs: number;
  error: string | null;
  timedOut: boolean;
}

const TIMEOUT_MS = 15000;
const MAX_RETRIES = 1;

async function fetchWithRetry(url: string, accept: string): Promise<{ res: Response | null; error: string | null; timedOut: boolean }> {
  let lastError: string | null = null;
  let timedOut = false;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 800 * attempt));
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: accept, "User-Agent": "PanamaSeismicWatch/1.0" } });
      clearTimeout(t);
      if (res.ok || res.status === 204) return { res, error: null, timedOut: false };
      lastError = `HTTP ${res.status}`;
      if (res.status < 500) break;
    } catch (e) {
      clearTimeout(t);
      timedOut = ctrl.signal.aborted;
      lastError = timedOut ? `Sin respuesta en ${TIMEOUT_MS / 1000} s` : e instanceof Error ? e.message : "Error de red";
    }
  }
  return { res: null, error: lastError, timedOut };
}

const iso = (d: string) => d.replace(/\.\d{3}Z$/, "");

export function usgsQueryUrl(startIso: string, endIso: string): string {
  const b = QUERY_BBOX;
  return `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&eventtype=earthquake&orderby=time&limit=20000&starttime=${iso(startIso)}&endtime=${iso(endIso)}&minlatitude=${b.minLat}&maxlatitude=${b.maxLat}&minlongitude=${b.minLon}&maxlongitude=${b.maxLon}`;
}
export function emscQueryUrl(startIso: string, endIso: string): string {
  const b = QUERY_BBOX;
  return `https://www.seismicportal.eu/fdsnws/event/1/query?format=json&orderby=time&limit=10000&start=${iso(startIso)}&end=${iso(endIso)}&minlat=${b.minLat}&maxlat=${b.maxLat}&minlon=${b.minLon}&maxlon=${b.maxLon}`;
}

export function normalizeUsgs(raw: unknown): SourceReport | null {
  const p = usgsFeatureSchema.safeParse(raw);
  if (!p.success) return null;
  const f = p.data;
  const [lon, lat, depth] = f.geometry.coordinates;
  if (lon == null || lat == null) return null;
  return {
    sourceId: "usgs",
    impact: {
      felt: f.properties.felt ?? null,
      cdi: f.properties.cdi ?? null,
      mmi: f.properties.mmi ?? null,
      alert: f.properties.alert ?? null,
      tsunami: f.properties.tsunami == null ? null : f.properties.tsunami === 1,
    },
    externalId: f.id,
    magnitude: f.properties.mag ?? null,
    magnitudeType: f.properties.magType ?? null,
    latitude: lat,
    longitude: lon,
    depthKm: depth ?? null,
    occurredAtUtc: new Date(f.properties.time).toISOString(),
    updatedAt: f.properties.updated ? new Date(f.properties.updated).toISOString() : null,
    placeReported: f.properties.place ?? null,
    reviewStatus: f.properties.status ?? null,
    author: f.properties.net ?? null,
    sourceUrl: f.properties.url ?? `https://earthquake.usgs.gov/earthquakes/eventpage/${f.id}`,
  };
}

export function normalizeEmsc(raw: unknown): SourceReport | null {
  const p = emscFeatureSchema.safeParse(raw);
  if (!p.success) return null;
  const { id, properties: q } = p.data;
  if (q.evtype && !["ke", "se", "fe"].includes(q.evtype)) return null; // solo sismos (conocidos o sospechados)
  const uid = q.unid ?? id;
  return {
    sourceId: "emsc",
    externalId: uid,
    magnitude: q.mag ?? null,
    magnitudeType: q.magtype ?? null,
    latitude: q.lat,
    longitude: q.lon,
    // EMSC publica la profundidad en km como valor positivo; no se convierte un dato ausente en cero.
    depthKm: q.depth == null ? null : Math.abs(q.depth),
    occurredAtUtc: new Date(q.time).toISOString(),
    updatedAt: q.lastupdate ? new Date(q.lastupdate).toISOString() : null,
    placeReported: q.flynn_region ?? null,
    reviewStatus: null,
    author: q.auth ?? null,
    sourceUrl: `https://www.seismicportal.eu/eventdetails.html?unid=${uid}`,
  };
}

async function runAdapter(url: string, collection: typeof usgsCollectionSchema, norm: (r: unknown) => SourceReport | null): Promise<AdapterResult<SourceReport[]>> {
  const t0 = Date.now();
  const { res, error, timedOut } = await fetchWithRetry(url, "application/json");
  if (!res) return { ok: false, data: [], durationMs: Date.now() - t0, error, timedOut };
  if (res.status === 204) return { ok: true, data: [], durationMs: Date.now() - t0, error: null, timedOut: false };
  try {
    const body = collection.parse(await res.json());
    const data = body.features.map(norm).filter((x): x is SourceReport => x !== null);
    return { ok: true, data, durationMs: Date.now() - t0, error: null, timedOut: false };
  } catch {
    return { ok: false, data: [], durationMs: Date.now() - t0, error: "Respuesta con formato inesperado", timedOut: false };
  }
}

export const fetchUsgs = (s: string, e: string) => runAdapter(usgsQueryUrl(s, e), usgsCollectionSchema, normalizeUsgs);
export const fetchEmsc = (s: string, e: string) => runAdapter(emscQueryUrl(s, e), emscCollectionSchema, normalizeEmsc);

export const TSUNAMI_FEEDS = [
  { center: "PTWC (Pacífico y Caribe)", url: "https://www.tsunami.gov/events/xml/PHEBAtom.xml" },
  { center: "NTWC (EE. UU. y Canadá)", url: "https://www.tsunami.gov/events/xml/PAAQAtom.xml" },
];

function tag(xml: string, name: string): string | null {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m && m[1] ? m[1].replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : null;
}

export function parseTsunamiAtom(xml: string, center: string): TsunamiBulletin[] {
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
  return entries.map((e, i) => ({
    id: tag(e, "id") ?? `${center}-${i}`,
    title: tag(e, "title") ?? "Boletín sin título",
    updated: tag(e, "updated") ?? "",
    summary: (tag(e, "summary") ?? "").slice(0, 600),
    link: e.match(/<link[^>]*href="([^"]+)"/)?.[1] ?? null,
    center,
  }));
}

export async function fetchTsunami(): Promise<AdapterResult<TsunamiBulletin[]>> {
  const t0 = Date.now();
  const results = await Promise.all(
    TSUNAMI_FEEDS.map(async (f) => {
      const { res, error } = await fetchWithRetry(f.url, "application/atom+xml");
      if (!res) return { ok: false, items: [] as TsunamiBulletin[], error };
      return { ok: true, items: parseTsunamiAtom(await res.text(), f.center), error: null };
    }),
  );
  const ok = results.some((r) => r.ok);
  return {
    ok,
    data: results.flatMap((r) => r.items),
    durationMs: Date.now() - t0,
    error: results.find((r) => !r.ok)?.error ?? null,
    timedOut: false,
  };
}
