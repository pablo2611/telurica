import { z } from "zod";
import type { PeriodId } from "@/features/seismic/periods";
import type { SeismicEvent } from "@/features/seismic/types";

export const assistantInput = z.object({
  question: z.string().trim().min(1).max(12000),
  period: z.enum(["24h", "7d", "30d", "90d", "365d"]),
  history: z.array(z.string().max(3000)).max(4).default([]),
}).strict();

export type AssistantInput = z.infer<typeof assistantInput>;
export interface AssistantReply {
  answer: string;
  presentation?: Presentation;
  period?: PeriodId;
  mode: "ai" | "catalog";
  generatedAt: string;
  range: { start: string; end: string };
  total: number;
  maxMagnitude: number | null;
  provinces: [string, number][];
  days: { day: string; panama: number; maritima: number }[];
  events: SeismicEvent[];
  sources: { name: string; url: string; state: string }[];
  mapTruncated: boolean;
}

export const SUGGESTIONS = [
  "Resume la actividad sísmica de Panamá.",
  "Haz una tabla comparando los sismos por provincia.",
  "Muéstrame un mapa de calor de los sismos de Chiriquí.",
  "Grafica la evolución diaria de los sismos de Panamá.",
];

export function isSeismicQuestion(question: string) {
  return /tabla|mapa|gr[aá]fic|compara|resume|estad[ií]stic|datos|distribuc|fuente|bolet[ií]n|profundidad|intensidad|sism|terremot|tembl|epicentr|magnitud|tect[oó]nic|falla|tsunami|panam[aá]|chiriqu[ií]|veraguas|azuero|los santos|cocl[eé]|dari[eé]n|usgs|emsc|noaa|sinaproc|geociencia|cat[aá]logo|provinci|riesgo.*terreno/i.test(question);
}

export type ViewKind = "table" | "map" | "chart";
export interface Presentation {
  views: ViewKind[];
  tableKind: "events" | "provinces" | "sources" | "daily";
  chartKind: "provinces" | "daily";
  regions: string[];
}
export type ChatPhase = "planning" | "sources" | "analyzing" | "presenting";
export const PHASES: { id: ChatPhase; label: string; detail: string }[] = [
  { id: "planning", label: "Preparando tu consulta", detail: "Identificando el período y la visualización." },
  { id: "sources", label: "Consultando las fuentes", detail: "Recuperando el catálogo de USGS y EMSC." },
  { id: "analyzing", label: "Pensando con los datos", detail: "Preparando una explicación basada en los registros." },
  { id: "presenting", label: "Preparando el resultado", detail: "Organizando la respuesta y sus visualizaciones." },
];
