import { useSyncExternalStore } from "react";
import { QUERY_BBOX, classifyPoint } from "./geo";

/**
 * Capa de tiempo real en el navegador.
 *
 * - EMSC publica cada sismo nuevo por WebSocket (push, segundos después de su registro).
 * - USGS publica un feed GeoJSON de la última hora que se actualiza cada minuto (CORS abierto).
 *
 * Esta capa NO reemplaza el pipeline del servidor (normalización → filtro geográfico → deduplicación).
 * Solo detecta eventos nuevos cerca de Panamá lo antes posible y pide al servidor una sincronización
 * inmediata, para que las alertas y el resto de la interfaz usen los datos consolidados.
 */

export const EMSC_WS_URL = "wss://www.seismicportal.eu/standing_order/websocket";
export const USGS_LIVE_FEED = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson";
export const USGS_POLL_MS = 30_000;
const MAX_LIVE = 30;

export type LiveSource = "usgs" | "emsc";
export type WsState = "idle" | "connecting" | "open" | "reconnecting" | "unsupported";

export interface LiveEvent {
  key: string;
  sources: LiveSource[];
  magnitude: number | null;
  magnitudeType: string | null;
  latitude: number;
  longitude: number;
  depthKm: number | null;
  occurredAtUtc: string;
  place: string | null;
  url: string;
  classification: "panama" | "maritima";
  province: string | null;
  receivedAt: string;
  /** true si llegó después de abrir la página (no forma parte de la carga inicial). */
  fresh: boolean;
}

export interface RealtimeState {
  ws: WsState;
  lastPollAt: string | null;
  lastPollOk: boolean | null;
  lastMessageAt: string | null;
  events: LiveEvent[];
}

let state: RealtimeState = { ws: "idle", lastPollAt: null, lastPollOk: null, lastMessageAt: null, events: [] };
const listeners = new Set<() => void>();
const newEventListeners = new Set<(e: LiveEvent) => void>();

function set(patch: Partial<RealtimeState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

const SERVER_STATE: RealtimeState = { ws: "idle", lastPollAt: null, lastPollOk: null, lastMessageAt: null, events: [] };
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const useRealtime = () => useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);

/** Suscribirse a eventos nuevos (llegados después de abrir la página) en Panamá o su zona marítima. */
export function onNewLiveEvent(fn: (e: LiveEvent) => void) {
  newEventListeners.add(fn);
  return () => {
    newEventListeners.delete(fn);
  };
}

export function inQueryBox(lat: number, lon: number) {
  const b = QUERY_BBOX;
  return lat >= b.minLat && lat <= b.maxLat && lon >= b.minLon && lon <= b.maxLon;
}

const R = 6371;
function distKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

type Candidate = Omit<LiveEvent, "classification" | "province" | "receivedAt" | "fresh" | "sources"> & { source: LiveSource };

/** Aplica el filtro geográfico y fusiona reportes del mismo sismo (≤ 45 s y ≤ 80 km). */
export function ingest(c: Candidate, fresh: boolean): LiveEvent | null {
  if (!Number.isFinite(c.latitude) || !Number.isFinite(c.longitude)) return null;
  if (!inQueryBox(c.latitude, c.longitude)) return null;
  const { classification, province } = classifyPoint(c.longitude, c.latitude);
  if (classification === "fuera") return null;

  const t = Date.parse(c.occurredAtUtc);
  const existing = state.events.find(
    (e) => e.key === c.key || (Math.abs(Date.parse(e.occurredAtUtc) - t) <= 45_000 && distKm(e.latitude, e.longitude, c.latitude, c.longitude) <= 80),
  );
  if (existing) {
    const merged: LiveEvent = {
      ...existing,
      sources: existing.sources.includes(c.source) ? existing.sources : [...existing.sources, c.source],
      // Si llega una actualización con magnitud, se conserva la más reciente informada.
      magnitude: c.magnitude ?? existing.magnitude,
      magnitudeType: c.magnitudeType ?? existing.magnitudeType,
    };
    set({ events: state.events.map((e) => (e === existing ? merged : e)) });
    return null;
  }

  const ev: LiveEvent = {
    key: c.key,
    sources: [c.source],
    magnitude: c.magnitude,
    magnitudeType: c.magnitudeType,
    latitude: c.latitude,
    longitude: c.longitude,
    depthKm: c.depthKm,
    occurredAtUtc: c.occurredAtUtc,
    place: c.place,
    url: c.url,
    classification,
    province,
    receivedAt: new Date().toISOString(),
    fresh,
  };
  const events = [ev, ...state.events]
    .sort((a, b) => Date.parse(b.occurredAtUtc) - Date.parse(a.occurredAtUtc))
    .slice(0, MAX_LIVE);
  set({ events });
  if (fresh) newEventListeners.forEach((l) => l(ev));
  return ev;
}

// ---------- Normalizadores ----------

interface EmscMessage {
  action?: string;
  data?: {
    id?: string;
    properties?: {
      unid?: string;
      time?: string;
      lat?: number;
      lon?: number;
      depth?: number | null;
      mag?: number | null;
      magtype?: string | null;
      flynn_region?: string | null;
      evtype?: string | null;
    };
  };
}

export function parseEmscMessage(raw: string): Candidate | null {
  let msg: EmscMessage;
  try {
    msg = JSON.parse(raw) as EmscMessage;
  } catch {
    return null;
  }
  const p = msg.data?.properties;
  if (!p || typeof p.lat !== "number" || typeof p.lon !== "number" || !p.time) return null;
  if (p.evtype && !["ke", "se", "fe"].includes(p.evtype)) return null;
  const uid = p.unid ?? msg.data?.id ?? `${p.time}-${p.lat}-${p.lon}`;
  return {
    key: `emsc:${uid}`,
    source: "emsc",
    magnitude: typeof p.mag === "number" ? p.mag : null,
    magnitudeType: p.magtype ?? null,
    latitude: p.lat,
    longitude: p.lon,
    depthKm: typeof p.depth === "number" ? Math.abs(p.depth) : null,
    occurredAtUtc: new Date(p.time).toISOString(),
    place: p.flynn_region ?? null,
    url: `https://www.seismicportal.eu/eventdetails.html?unid=${uid}`,
  };
}

interface UsgsFeature {
  id?: string;
  properties?: { mag?: number | null; magType?: string | null; place?: string | null; time?: number; url?: string | null; type?: string | null };
  geometry?: { coordinates?: (number | null)[] };
}

export function parseUsgsFeature(f: UsgsFeature): Candidate | null {
  const c = f.geometry?.coordinates;
  const p = f.properties;
  if (!f.id || !p || typeof p.time !== "number" || !c) return null;
  if (p.type && p.type !== "earthquake") return null;
  const [lon, lat, depth] = c;
  if (typeof lon !== "number" || typeof lat !== "number") return null;
  return {
    key: `usgs:${f.id}`,
    source: "usgs",
    magnitude: typeof p.mag === "number" ? p.mag : null,
    magnitudeType: p.magType ?? null,
    latitude: lat,
    longitude: lon,
    depthKm: typeof depth === "number" ? depth : null,
    occurredAtUtc: new Date(p.time).toISOString(),
    place: p.place ?? null,
    url: p.url ?? `https://earthquake.usgs.gov/earthquakes/eventpage/${f.id}`,
  };
}

// ---------- Motor ----------

let started = false;
let ws: WebSocket | null = null;
let retry = 0;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let firstPollDone = false;
const startedAt = Date.now();

function connectWs() {
  if (typeof WebSocket === "undefined") {
    set({ ws: "unsupported" });
    return;
  }
  set({ ws: retry ? "reconnecting" : "connecting" });
  let sock: WebSocket;
  try {
    sock = new WebSocket(EMSC_WS_URL);
  } catch {
    scheduleReconnect();
    return;
  }
  ws = sock;
  sock.onopen = () => {
    retry = 0;
    set({ ws: "open" });
  };
  sock.onmessage = (m) => {
    set({ lastMessageAt: new Date().toISOString() });
    const c = parseEmscMessage(typeof m.data === "string" ? m.data : "");
    if (c) ingest(c, true);
  };
  sock.onclose = () => {
    if (ws === sock) scheduleReconnect();
  };
  sock.onerror = () => sock.close();
}

function closeSocket() {
  const sock = ws;
  ws = null;
  if (!sock) return;
  sock.onclose = null;
  sock.onerror = null;
  sock.onmessage = null;
  sock.close();
}

function scheduleReconnect() {
  ws = null;
  if (!started) return;
  retry++;
  set({ ws: "reconnecting" });
  // Retroceso exponencial con tope de 60 s.
  const delay = Math.min(60_000, 1000 * 2 ** Math.min(retry, 6));
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(connectWs, delay);
}

async function pollUsgs() {
  try {
    const res = await fetch(USGS_LIVE_FEED, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as { features?: UsgsFeature[] };
    for (const f of body.features ?? []) {
      const c = parseUsgsFeature(f);
      if (!c) continue;
      // En la primera consulta solo son "nuevos" los sismos ocurridos después de abrir la página.
      const fresh = firstPollDone || Date.parse(c.occurredAtUtc) > startedAt;
      ingest(c, fresh);
    }
    firstPollDone = true;
    set({ lastPollAt: new Date().toISOString(), lastPollOk: true });
  } catch {
    set({ lastPollAt: new Date().toISOString(), lastPollOk: false });
  }
}

function onVisibility() {
  // Al volver a la pestaña, consultar de inmediato y reabrir el socket si se cerró.
  if (document.visibilityState === "visible") {
    void pollUsgs();
    if (!ws || ws.readyState === WebSocket.CLOSED) {
      closeSocket();
      connectWs();
    }
  }
}

/** Inicia el motor una sola vez por pestaña. Devuelve la función de parada. */
export function startRealtime(): () => void {
  if (typeof window === "undefined" || started) return () => {};
  started = true;
  connectWs();
  void pollUsgs();
  pollTimer = setInterval(() => void pollUsgs(), USGS_POLL_MS);
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    started = false;
    if (pollTimer) clearInterval(pollTimer);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    document.removeEventListener("visibilitychange", onVisibility);
    closeSocket();
    set({ ws: "idle" });
  };
}

/** Marca de "sincronización forzada" que la consulta al servidor envía tras un evento en vivo. */
let freshUntil = 0;
export function requestFreshSync(ms = 20_000) {
  freshUntil = Date.now() + ms;
}
export const wantsFreshSync = () => Date.now() < freshUntil;
