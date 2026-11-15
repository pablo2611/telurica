import type { GeoClass, SeismicEvent, SourceState } from "./types";

const TZ = "America/Panama";
const partsFmt = new Intl.DateTimeFormat("es-PA", {
  timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

function parts(iso: string) {
  const o = { year: "", month: "", day: "", hour: "", minute: "", second: "" } as Record<"year" | "month" | "day" | "hour" | "minute" | "second", string>;
  for (const p of partsFmt.formatToParts(new Date(iso))) if (p.type in o) o[p.type as keyof typeof o] = p.value;
  return o;
}
/** DD/MM/AAAA en hora de Panamá. */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const p = parts(iso);
  return `${p.day}/${p.month}/${p.year}`;
}
/** HH:MM (24 h) en hora de Panamá. */
export function fmtTime(iso: string | null | undefined, seconds = false): string {
  if (!iso) return "—";
  const p = parts(iso);
  return seconds ? `${p.hour}:${p.minute}:${p.second}` : `${p.hour}:${p.minute}`;
}
export const fmtDateTime = (iso: string | null | undefined) => (iso ? `${fmtDate(iso)} ${fmtTime(iso)}` : "—");
/** Clave de día AAAA-MM-DD en hora de Panamá, para agregaciones. */
export function dayKey(iso: string): string {
  const p = parts(iso);
  return `${p.year}-${p.month}-${p.day}`;
}

export function fmtRelative(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "—";
  const s = Math.round((now - Date.parse(iso)) / 1000);
  if (s < 60) return "hace segundos";
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 48) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} días`;
}

export const fmtMag = (m: number | null) => (m == null ? "s/d" : m.toFixed(1));
export const fmtDepth = (d: number | null) => (d == null ? "No determinada" : `${d.toFixed(d < 10 ? 1 : 0)} km`);
export const fmtCoord = (lat: number, lon: number) =>
  `${Math.abs(lat).toFixed(3)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(3)}° ${lon >= 0 ? "E" : "O"}`;
export const fmtNum = (n: number, d = 0) => new Intl.NumberFormat("es-PA", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);

export const CLASS_LABEL: Record<GeoClass, string> = {
  panama: "Territorio panameño",
  maritima: "Zona marítima próxima",
  fuera: "Fuera de cobertura",
};
export const SOURCE_LABEL: Record<string, string> = { usgs: "USGS", emsc: "EMSC", noaa: "NOAA", up: "UP Geociencias", sinaproc: "SINAPROC" };
export const STATE_LABEL: Record<SourceState, string> = {
  operativa: "Operativa",
  con_retraso: "Con retraso",
  sin_respuesta: "Sin respuesta",
  desconectada: "Desconectada",
  no_integrada: "No integrada",
  requiere_autorizacion: "Requiere autorización",
};

/** Clase de magnitud discreta (1–5) para la escala de color; 0 = desconocida. */
export function magClass(m: number | null): 0 | 1 | 2 | 3 | 4 | 5 {
  if (m == null) return 0;
  if (m < 3) return 1;
  if (m < 4) return 2;
  if (m < 5) return 3;
  if (m < 6) return 4;
  return 5;
}
export const MAG_BANDS = [
  { cls: 1, label: "< 3.0" },
  { cls: 2, label: "3.0 – 3.9" },
  { cls: 3, label: "4.0 – 4.9" },
  { cls: 4, label: "5.0 – 5.9" },
  { cls: 5, label: "≥ 6.0" },
] as const;

export function placeOf(e: SeismicEvent): string {
  if (e.classification === "panama") return e.province ?? e.primary.placeReported ?? "Panamá";
  return e.nearestProvince ? `Mar, frente a ${e.nearestProvince}` : "Zona marítima próxima";
}
