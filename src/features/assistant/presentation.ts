import { periodStart } from "@/features/seismic/periods";
import type { AssistantInput, Presentation, ViewKind } from "./contract";
import type { SeismicEvent } from "@/features/seismic/types";

const REGIONS = ["Chiriquí", "Los Santos", "Herrera", "Veraguas", "Coclé", "Bocas del Toro", "Darién", "Colón", "Panamá Oeste", "Comarca Emberá-Wounaan", "Comarca Ngäbe-Buglé", "Guna Yala"];
const normalized = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function presentationFor(question: string, previous = ""): Presentation {
  const text = normalized(question);
  const regionText = /^(y\b|ahora\b|eso\b|muestra|haz|pon|agrega|tambien|quiero|dame|puedes)/.test(text) ? normalized(previous + " " + question) : text;
  const regions = REGIONS.filter(name => regionText.includes(normalized(name)));
  if (/provincia de panama(?! oeste)/.test(regionText)) regions.push("Panamá");
  const views: ViewKind[] = [];
  if (/tabla|tabular|listado|ultimos? sismos|sismos.*(?:ayer|hoy)|(?:ayer|hoy).*sismos/.test(text)) views.push("table");
  if (/mapa|calor|epicentro.*ver|ubica/.test(text)) views.push("map");
  if (/graf|evolucion|tendencia|serie|diari/.test(text)) views.push("chart");
  return {
    views,
    regions,
    tableKind: /fuente/.test(text) ? "sources" : /diari|por dia|evolucion/.test(text) ? "daily" : /provincia|compara/.test(text) ? "provinces" : "events",
    chartKind: /diari|por dia|evolucion|tiempo|tendencia/.test(text) ? "daily" : "provinces",
  };
}

export function requestedPeriod(input: AssistantInput): AssistantInput["period"] {
  const text = normalized(input.question);
  if (/365|un ano|ultimo ano|anual/.test(text)) return "365d";
  if (/90\s*(?:dias|d)|tres meses|trimestre/.test(text)) return "90d";
  if (/30\s*(?:dias|d)|ultimo mes|este mes|mensual/.test(text)) return "30d";
  if (/7\s*(?:dias|d)|semana/.test(text)) return "7d";
  if (/24\s*(?:horas|h)|hoy|ultimo dia/.test(text)) return "24h";
  return input.period;
}

export function filterRegion(events: SeismicEvent[], regions: string[]) {
  if (!regions.length) return events;
  return events.filter(event => regions.some(region =>
    normalized(event.province ?? event.nearestProvince ?? "") === normalized(region)));
}


/** Calendar days in Panama (UTC−5), not a rolling 24-hour window. End is exclusive. */
export function requestedRange(input: AssistantInput, now = Date.now()) {
  const text = normalized(input.question);
  const localDay = new Date(now - 5 * 3600_000).toISOString().slice(0, 10);
  const midnight = Date.parse(`${localDay}T00:00:00-05:00`);
  const offset = /\banteayer\b/.test(text) ? 2 : /\bayer\b/.test(text) ? 1 : /\bhoy\b/.test(text) ? 0 : null;
  if (offset != null) {
    const start = new Date(midnight - offset * 86400_000).toISOString();
    const end = offset === 0 ? null : new Date(midnight - (offset - 1) * 86400_000).toISOString();
    const date = new Intl.DateTimeFormat("es", { timeZone: "America/Panama", day: "2-digit", month: "long", year: "numeric" }).format(new Date(start));
    return { start, end, label: `${offset === 0 ? "Hoy" : offset === 1 ? "Ayer" : "Anteayer"}: ${date} · hora de Panamá` };
  }
  return { start: periodStart(requestedPeriod(input), now), end: null, label: "Período seleccionado · hora de Panamá" };
}
