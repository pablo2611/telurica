import { z } from "zod";
import type { SeismicEvent } from "@/features/seismic/types";

export const assistantInput = z.object({
  question: z.string().trim().min(8).max(600),
  period: z.enum(["24h", "7d", "30d"]),
}).strict();

export type AssistantInput = z.infer<typeof assistantInput>;
export interface AssistantReply {
  answer: string;
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
  "Resume la actividad sísmica de Panamá en este período.",
  "Compara los registros de Chiriquí y Los Santos.",
  "Explica el mapa de densidad de epicentros de Panamá.",
  "¿Qué debo consultar para evaluar el riesgo sísmico de un terreno en Panamá?",
];

export function isSeismicQuestion(question: string) {
  return /fuente|bolet[ií]n|profundidad|intensidad|sism|terremot|tembl|epicentr|magnitud|tect[oó]nic|falla|tsunami|panam[aá]|chiriqu[ií]|veraguas|azuero|los santos|cocl[eé]|dari[eé]n|usgs|emsc|noaa|sinaproc|geociencia|cat[aá]logo|provinci|riesgo.*terreno/i.test(question);
}
