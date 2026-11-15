import { CLASS_LABEL } from "./format";
import type { SeismicEvent } from "./types";

export const EXPORT_FIELDS = [
  "id", "fuente", "id_externo", "hora_utc", "magnitud", "tipo_magnitud", "latitud", "longitud", "profundidad_km",
  "clasificacion", "provincia", "lugar_reportado", "estado_revision", "autor", "fuentes_coincidentes", "actualizado_utc", "recibido_utc", "url_fuente",
] as const;

function row(e: SeismicEvent): (string | number | null)[] {
  const p = e.primary;
  return [
    e.id, p.sourceId, p.externalId, p.occurredAtUtc, p.magnitude, p.magnitudeType, p.latitude, p.longitude, p.depthKm,
    CLASS_LABEL[e.classification], e.province, p.placeReported, p.reviewStatus, p.author,
    e.reports.map((r) => `${r.sourceId}:${r.externalId}`).join(" | "), p.updatedAt, e.receivedAt, p.sourceUrl,
  ];
}
const esc = (v: string | number | null) => {
  if (v == null) return "";
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export function toCsv(events: SeismicEvent[]): string {
  return [EXPORT_FIELDS.join(","), ...events.map((e) => row(e).map(esc).join(","))].join("\n");
}
export function toGeoJson(events: SeismicEvent[]) {
  return {
    type: "FeatureCollection",
    features: events.map((e) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [e.primary.longitude, e.primary.latitude] },
      properties: Object.fromEntries(EXPORT_FIELDS.map((f, i) => [f, row(e)[i]])),
    })),
  };
}
export function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function exportEvents(events: SeismicEvent[], format: "csv" | "geojson", stem: string) {
  if (format === "csv") download(`${stem}.csv`, "\uFEFF" + toCsv(events), "text/csv;charset=utf-8");
  else download(`${stem}.geojson`, JSON.stringify(toGeoJson(events), null, 2), "application/geo+json");
}
