import { z } from "zod";

export type SourceId = "usgs" | "emsc";
export type GeoClass = "panama" | "maritima" | "fuera";

/** Un reporte tal como lo publicó una agencia, ya normalizado. Los datos faltantes quedan en null. */
export interface SourceReport {
  sourceId: SourceId;
  externalId: string;
  magnitude: number | null;
  magnitudeType: string | null;
  latitude: number;
  longitude: number;
  depthKm: number | null;
  occurredAtUtc: string; // ISO 8601 UTC
  updatedAt: string | null;
  placeReported: string | null;
  reviewStatus: string | null; // tal como lo informa la fuente (p. ej. "reviewed", "automatic")
  author: string | null; // agencia autora informada por la fuente
  sourceUrl: string;
  impact?: {
    felt: number | null;
    cdi: number | null;
    mmi: number | null;
    alert: "green" | "yellow" | "orange" | "red" | null;
    tsunami: boolean | null;
  };
}

/** Evento consolidado: uno o más reportes de agencias que describen el mismo sismo. */
export interface SeismicEvent {
  id: string; // `${sourceId}:${externalId}` del reporte principal
  primary: SourceReport;
  reports: SourceReport[];
  classification: GeoClass;
  province: string | null;
  /** Para eventos marítimos: provincia/comarca más cercana (solo como referencia de ubicación). */
  nearestProvince: string | null;
  receivedAt: string;
}

export type SourceState =
  | "operativa"
  | "con_retraso"
  | "sin_respuesta"
  | "desconectada"
  | "no_integrada"
  | "requiere_autorizacion";

export interface SourceStatus {
  id: string;
  name: string;
  url: string;
  serviceType: string;
  method: string;
  state: SourceState;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  durationMs: number | null;
  received: number | null;
  error: string | null;
  note?: string;
}

export interface SyncLogEntry {
  at: string;
  sourceId: string;
  ok: boolean;
  durationMs: number;
  received: number;
  error: string | null;
}

export interface SeismicPayload {
  events: SeismicEvent[];
  excludedOutside: number;
  sources: SourceStatus[];
  generatedAt: string;
  range: { start: string; end: string };
}

export interface TsunamiBulletin {
  id: string;
  title: string;
  updated: string;
  summary: string;
  link: string | null;
  center: string;
}

// Validación de respuestas externas
export const usgsFeatureSchema = z.object({
  id: z.string(),
  properties: z.object({
    mag: z.number().nullable(),
    felt: z.number().nullable().optional(),
    cdi: z.number().nullable().optional(),
    mmi: z.number().nullable().optional(),
    alert: z.enum(["green", "yellow", "orange", "red"]).nullable().optional(),
    tsunami: z.union([z.literal(0), z.literal(1)]).nullable().optional(),
    magType: z.string().nullable().optional(),
    place: z.string().nullable().optional(),
    time: z.number(),
    updated: z.number().nullable().optional(),
    url: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    net: z.string().nullable().optional(),
    type: z.string().nullable().optional(),
  }),
  geometry: z.object({ coordinates: z.array(z.number().nullable()).min(2) }),
});
export const usgsCollectionSchema = z.object({ features: z.array(z.unknown()) });

export const emscFeatureSchema = z.object({
  id: z.string(),
  properties: z.object({
    unid: z.string().optional(),
    time: z.string(),
    lastupdate: z.string().nullable().optional(),
    lat: z.number(),
    lon: z.number(),
    depth: z.number().nullable().optional(),
    mag: z.number().nullable().optional(),
    magtype: z.string().nullable().optional(),
    flynn_region: z.string().nullable().optional(),
    auth: z.string().nullable().optional(),
    evtype: z.string().nullable().optional(),
  }),
});
export const emscCollectionSchema = z.object({ features: z.array(z.unknown()) });
