import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fetchEmsc, fetchTsunami, fetchUsgs, type AdapterResult } from "./adapters";
import { buildEvents } from "./pipeline";
import type { SeismicPayload, SourceState, SourceStatus, SyncLogEntry, TsunamiBulletin } from "./types";

const CACHE_TTL_MS = 60_000;
const SLOW_MS = 8000;
const cache = new Map<string, { at: number; promise: Promise<SeismicPayload> }>();
const syncLog: SyncLogEntry[] = [];
const lastSuccess: { usgs: string | null; emsc: string | null; noaa: string | null } = { usgs: null, emsc: null, noaa: null };

function logAttempt(sourceId: keyof typeof lastSuccess, r: AdapterResult<unknown[]>) {
  const at = new Date().toISOString();
  if (r.ok) lastSuccess[sourceId] = at;
  syncLog.unshift({ at, sourceId, ok: r.ok, durationMs: r.durationMs, received: r.data.length, error: r.error });
  if (syncLog.length > 60) syncLog.length = 60;
}

function stateOf(r: AdapterResult<unknown[]>): SourceState {
  if (r.ok) return r.durationMs > SLOW_MS ? "con_retraso" : "operativa";
  return r.timedOut ? "sin_respuesta" : "desconectada";
}

function staticSources(): SourceStatus[] {
  return [
    {
      id: "up", name: "Instituto de Geociencias — Universidad de Panamá", url: "https://sismosgeociencias.up.ac.pa/",
      serviceType: "Portal web", method: "Sin integración automática", state: "no_integrada",
      lastAttemptAt: null, lastSuccessAt: null, durationMs: null, received: null, error: null,
      note: "No se encontró una API pública documentada. Sus reportes se consultan directamente en el portal oficial.",
    },
    {
      id: "sinaproc", name: "SINAPROC — Alertas", url: "https://www.sinaproc.gob.pa/alertas/",
      serviceType: "Portal web oficial", method: "Enlace directo", state: "no_integrada",
      lastAttemptAt: null, lastSuccessAt: null, durationMs: null, received: null, error: null,
      note: "No existe un canal público automatizable documentado. Los avisos oficiales se consultan en su portal.",
    },
  ];
}

async function sync(startIso: string, endIso: string): Promise<SeismicPayload> {
  const attemptAt = new Date().toISOString();
  const [usgs, emsc] = await Promise.all([fetchUsgs(startIso, endIso), fetchEmsc(startIso, endIso)]);
  logAttempt("usgs", usgs);
  logAttempt("emsc", emsc);
  const { events, excludedOutside } = buildEvents([...usgs.data, ...emsc.data], attemptAt);
  const sources: SourceStatus[] = [
    {
      id: "usgs", name: "USGS — Servicio Geológico de EE. UU.", url: "https://earthquake.usgs.gov/fdsnws/event/1/",
      serviceType: "API FDSN Event (GeoJSON)", method: "Consulta HTTP con recuadro geográfico",
      state: stateOf(usgs), lastAttemptAt: attemptAt, lastSuccessAt: lastSuccess.usgs, durationMs: usgs.durationMs,
      received: usgs.ok ? usgs.data.length : null, error: usgs.error,
    },
    {
      id: "emsc", name: "EMSC — Centro Sismológico Euromediterráneo", url: "https://www.seismicportal.eu/fdsnws/event/1/",
      serviceType: "API FDSN Event (JSON)", method: "Consulta HTTP con recuadro geográfico",
      state: stateOf(emsc), lastAttemptAt: attemptAt, lastSuccessAt: lastSuccess.emsc, durationMs: emsc.durationMs,
      received: emsc.ok ? emsc.data.length : null, error: emsc.error,
    },
    ...staticSources(),
  ];
  return { events, excludedOutside, sources, generatedAt: attemptAt, range: { start: startIso, end: endIso } };
}

const inputSchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime().nullable(),
  /** El cliente lo envía tras detectar un sismo en vivo: omite la caché si tiene más de FRESH_MIN_MS. */
  fresh: z.boolean().optional(),
});
const FRESH_MIN_MS = 10_000;

export const getSeismicData = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => {
    const v = inputSchema.parse(d);
    const s = Date.parse(v.start);
    const e = v.end ? Date.parse(v.end) : Date.now();
    if (e <= s) throw new Error("El rango de fechas no es válido");
    if (e - s > 400 * 86400_000) throw new Error("El rango máximo es de 400 días");
    return v;
  })
  .handler(async ({ data }) => {
    const key = `${data.start}|${data.end ?? "now"}`;
    const hit = cache.get(key);
    // Protección contra consultas concurrentes duplicadas: todas las peticiones comparten la misma promesa.
    const ttl = data.fresh ? FRESH_MIN_MS : CACHE_TTL_MS;
    if (hit && Date.now() - hit.at < ttl) return hit.promise;
    const endIso = data.end ?? new Date().toISOString();
    const promise = sync(data.start, endIso);
    cache.set(key, { at: Date.now(), promise });
    if (cache.size > 40) cache.delete(cache.keys().next().value as string);
    promise.catch(() => cache.delete(key));
    return promise;
  });

let tsunamiCache: { at: number; promise: Promise<{ bulletins: TsunamiBulletin[]; source: SourceStatus }> } | null = null;

export const getTsunamiBulletins = createServerFn({ method: "GET" }).handler(async () => {
  if (tsunamiCache && Date.now() - tsunamiCache.at < CACHE_TTL_MS * 5) return tsunamiCache.promise;
  const promise = (async () => {
    const at = new Date().toISOString();
    const r = await fetchTsunami();
    logAttempt("noaa", r);
    const source: SourceStatus = {
      id: "noaa", name: "NOAA — Centros de Alerta de Tsunami", url: "https://www.tsunami.gov/",
      serviceType: "Canales Atom", method: "Lectura de boletines publicados",
      state: stateOf(r), lastAttemptAt: at, lastSuccessAt: lastSuccess.noaa, durationMs: r.durationMs,
      received: r.ok ? r.data.length : null, error: r.error,
    };
    return { bulletins: r.data, source };
  })();
  tsunamiCache = { at: Date.now(), promise };
  return promise;
});

export const getSyncLog = createServerFn({ method: "GET" }).handler(async () => ({ entries: [...syncLog] }));
