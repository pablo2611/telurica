import { classifyPoint } from "@/features/seismic/geo";
import { haversineKm } from "@/features/seismic/dedupe";
import type { SeismicEvent } from "@/features/seismic/types";
import { FAULTS } from "@/data/tectonics";

export interface TerrainPoint { longitude: number; latitude: number; zoom?: number }
export interface TerrainReading { elevation: number; slopeDegrees: number; slopePercent: number; sampleSpanMeters: number; sampledAt: string }
export const TERRAIN_PLACES = [
  { name: "Ciudad de Panamá", kind: "Ciudad", longitude: -79.518, latitude: 8.985, zoom: 16 },
  { name: "David", kind: "Ciudad", longitude: -82.433, latitude: 8.433, zoom: 16 },
  { name: "Boquete", kind: "Montaña", longitude: -82.432, latitude: 8.777, zoom: 13 },
  { name: "Volcán", kind: "Tierras altas", longitude: -82.641, latitude: 8.775, zoom: 12.5 },
  { name: "Soná", kind: "Entorno rural", longitude: -81.322, latitude: 8.012, zoom: 13 },
  { name: "Chitré", kind: "Ciudad", longitude: -80.433, latitude: 7.968, zoom: 16 },
] as const;

export function pointProblem(point: TerrainPoint): string | null {
  if (!Number.isFinite(point.longitude) || !Number.isFinite(point.latitude) || point.longitude < -180 || point.longitude > 180 || point.latitude < -90 || point.latitude > 90) return "Revisa las coordenadas: usa latitud y longitud en grados decimales.";
  if (classifyPoint(point.longitude, point.latitude).classification !== "panama") return "El punto queda fuera del territorio terrestre de Panamá según los límites regionales disponibles. Ajusta el punto; estos límites no tienen precisión de parcela.";
  return null;
}

/** Regional traces only. Do not expose a parcel-scale setback or construction threshold. */
export function nearestRegionalFault(point: TerrainPoint) {
  let best: { id: string; name: string; distanceKm: number } | null = null;
  const kx = 111.32 * Math.cos(point.latitude * Math.PI / 180), ky = 110.57;
  for (const fault of FAULTS.filter(f => f.k === "cortical")) {
    for (let i = 1; i < fault.p.length; i++) {
      const a = fault.p[i - 1]!, b = fault.p[i]!;
      const ax = (a[0] - point.longitude) * kx, ay = (a[1] - point.latitude) * ky;
      const dx = (b[0] - a[0]) * kx, dy = (b[1] - a[1]) * ky;
      const length = dx * dx + dy * dy;
      const t = length ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / length)) : 0;
      const distanceKm = Math.hypot(ax + t * dx, ay + t * dy);
      if (!best || distanceKm < best.distanceKm) best = { id: fault.id, name: fault.n, distanceKm };
    }
  }
  return best;
}

export function nearbySeismicity(point: TerrainPoint, events: SeismicEvent[], radiusKm: number) {
  const nearby = events.map(event => ({ event, distanceKm: haversineKm(point.latitude, point.longitude, event.primary.latitude, event.primary.longitude) }))
    .filter(row => row.distanceKm <= radiusKm).sort((a, b) => Date.parse(b.event.primary.occurredAtUtc) - Date.parse(a.event.primary.occurredAtUtc));
  const magnitudes = nearby.flatMap(row => row.event.primary.magnitude == null ? [] : [row.event.primary.magnitude]);
  return { nearby, count: nearby.length, maxMagnitude: magnitudes.length ? Math.max(...magnitudes) : null, closest: [...nearby].sort((a, b) => a.distanceKm - b.distanceKm)[0] ?? null };
}

export function terrainRecommendations(reading: TerrainReading | null) {
  return [
    { title: "Estudio geotécnico del predio", body: "Solicita sondeos y ensayos para conocer capacidad portante, estratigrafía, asentamientos y nivel freático. El relieve y los edificios del mapa no describen el subsuelo." },
    { title: reading && reading.slopeDegrees >= 15 ? "Revisar estabilidad de laderas y cortes" : "Levantamiento topográfico y drenaje", body: reading && reading.slopeDegrees >= 15
      ? "El modelo regional presenta una pendiente apreciable. Prioriza una evaluación profesional de estabilidad, drenaje y obras de corte o relleno. El umbral de 15° solo organiza esta lista; no es un límite normativo ni una clasificación de riesgo."
      : "Mide cotas, drenajes, rellenos y cambios de pendiente en el predio. Una pendiente regional suave no confirma estabilidad ni aptitud para construir." },
    { title: "Amenaza y diseño sismorresistente", body: "Solicita los parámetros de diseño aplicables según la normativa panameña vigente y, cuando corresponda, microzonificación y respuesta local del suelo. Los sismos recientes no sustituyen esos estudios." },
    { title: "Uso de suelo y amenazas del entorno", body: "Verifica con el municipio y las entidades competentes uso de suelo, inundación, deslizamientos, licuefacción, restricciones ambientales y trazas de falla a escala local." },
  ];
}
