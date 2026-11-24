import type { SeismicPayload } from "@/features/seismic/types";
import { summarize, byProvince, countByDay } from "@/features/seismic/stats";
import type { AssistantReply } from "./contract";

/** Deterministic fallback. Counts always come from the same pipeline as the maps. */
export function catalogAnswer(catalog: SeismicPayload, question: string): AssistantReply {
  if (!catalog.sources.some(source => ["usgs", "emsc"].includes(source.id) && ["operativa", "con_retraso"].includes(source.state))) {
    throw new Error("Las fuentes están desconectadas. Puedes consultar Educación y los portales oficiales mientras se restablecen.");
  }
  const summary = summarize(catalog.events);
  const provinces = byProvince(catalog.events);
  const counts = provinces.map(([name, count]) => `${name}: ${count}`).join("; ");
  const construction = /constru|terreno|riesgo|segur/i.test(question);
  const answer = [
    "Resumen automático del catálogo. La interpretación de IA está temporalmente limitada.",
    `En el período seleccionado hay ${summary.total} registros: ${summary.panama} con epicentro terrestre y ${summary.maritima} en la zona marítima próxima.`,
    summary.maxMag == null ? "No hay una magnitud máxima informada." : `La magnitud máxima informada es ${summary.maxMag.toFixed(1)}.`,
    counts ? `Distribución de epicentros terrestres por provincia: ${counts}.` : "No hay epicentros terrestres asignados a provincias en este período.",
    construction
      ? "La aptitud de un terreno requiere estudios geotécnicos, microzonificación y revisión profesional de la normativa. Consulta al Instituto de Geociencias de la Universidad de Panamá y a SINAPROC."
      : "Puedes explorar la gráfica por provincias y el mapa de epicentros de esta respuesta.",
    "La densidad observada depende de la cobertura del catálogo. No indica probabilidad de un próximo sismo ni certifica seguridad para construir.",
  ].join("\n\n");
  return {
    answer, mode: "catalog", generatedAt: catalog.generatedAt, range: catalog.range,
    total: summary.total, maxMagnitude: summary.maxMag, provinces,
    days: countByDay(catalog.events, catalog.range.start, catalog.range.end),
    events: catalog.events.slice(0, 300), sources: catalog.sources.map(({ name, url, state }) => ({ name, url, state })),
    mapTruncated: catalog.events.length > 300,
  };
}
