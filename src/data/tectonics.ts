/**
 * Datos tectónicos de Panamá: placas, límites de placa y fallas corticales.
 * Trazas simplificadas a escala regional (no aptas para ubicar un terreno).
 * Fuentes: Universidad de Panamá (Tecnociencia, REICIT), IGC, Kellogg et al. 1995.
 */
export type FaultKind = "limite" | "cortical";
export interface Fault { id: string; n: string; k: FaultKind; t: string; r: string; d: string; p: [number, number][] }
export interface Plate { id: string; n: string; c: string; motion: string; body: string; at: [number, number]; arrow?: [number, number] }
export interface Stratum { a: number; b: number; n: string; c: [number, number, number] }
export const PLATES: Plate[] = [
  { id: "panama", n: "Microplaca de Panamá", c: "#5fd0d6", motion: "Bloque rígido que escapa hacia el norte entre las demás placas", body: "Corteza oceánica engrosada sobre la que está casi todo el país. Sus bordes concentran la sismicidad.", at: [-80.9, 8.35] },
  { id: "cocos", n: "Placa de Cocos", c: "#f39a3c", motion: "Hacia el NE, subduce bajo Costa Rica y el oeste de Panamá", body: "Se hunde en la Fosa Mesoamericana; su borde con Nazca es la Zona de Fractura de Panamá.", at: [-83.25, 6.95], arrow: [0.7, 0.7] },
  { id: "nazca", n: "Placa de Nazca", c: "#a855f7", motion: "Hacia el este; no subduce activamente bajo Panamá", body: "Bajo el margen pacífico se desliza de forma oblicua y casi asísmica (Cinturón Deformado del Sur).", at: [-80.2, 6.75], arrow: [1, 0.15] },
  { id: "caribe", n: "Placa del Caribe", c: "#5fd39b", motion: "Subduce hacia el sur bajo la microplaca desde hace ~14 Ma", body: "Su contacto es el Cinturón Deformado del Norte de Panamá, capaz de sismos de M8 y tsunamis.", at: [-80.6, 9.93], arrow: [0, -1] },
  { id: "sudam", n: "Sudamericana", c: "#e9d75a", motion: "Converge con Panamá a ~25 mm/año", body: "La colisión en Darién y Urabá levanta las serranías del este.", at: [-77.75, 7.15], arrow: [-1, 0.2] },
];
export const FAULTS: Fault[] = [
  { id: "cdnp", n: "Cinturón Deformado del Norte de Panamá", k: "limite", t: "Cabalgamiento · subducción del Caribe", r: "", d: "Límite norte de la microplaca. Generó el mayor sismo registrado (M8.0) y un tsunami en la costa caribeña.", p: [[-83.6, 9.95], [-82.0, 9.75], [-80.5, 9.76], [-79.2, 9.74], [-78.2, 9.45], [-77.3, 9.0]] },
  { id: "cdsp", n: "Cinturón Deformado del Sur de Panamá", k: "limite", t: "Subducción oblicua de Nazca", r: "", d: "Borde del margen pacífico donde Nazca se hunde de forma oblicua y casi asísmica.", p: [[-82.55, 7.05], [-81.5, 6.86], [-80.5, 6.8], [-79.6, 6.9], [-78.6, 6.95], [-77.3, 6.75]] },
  { id: "zfp", n: "Zona de Fractura de Panamá", k: "limite", t: "Transformante dextral Cocos–Nazca", r: "57 mm/año", d: "Ha producido sismos de magnitud 7 a 8. Su extremo norte entra en tierra por Burica.", p: [[-82.75, 6.6], [-82.8, 7.15], [-82.9, 7.62]] },
  { id: "mat", n: "Fosa Mesoamericana", k: "limite", t: "Subducción de Cocos", r: "", d: "Cocos se hunde bajo Centroamérica; termina en el punto triple Cocos–Nazca–Panamá frente a Burica.", p: [[-83.6, 8.15], [-83.25, 7.65], [-82.95, 7.28]] },
  { id: "balboa", n: "Zona de Fractura de Balboa", k: "limite", t: "Dextral", r: "", d: "Ramal paralelo de la Zona de Fractura de Panamá.", p: [[-82.25, 6.6], [-82.2, 7.15]] },
  { id: "coiba", n: "Zona de Fractura de Coiba", k: "limite", t: "Dextral", r: "", d: "Ramal oriental de la ZFP que interactúa con las fallas de la isla de Coiba.", p: [[-81.75, 6.6], [-81.65, 7.3]] },
  { id: "este", n: "Cinturón Deformado del Este · Falla Uramita", k: "limite", t: "Convergente", r: "6–15 mm/año", d: "Límite oriental de la microplaca con el Bloque Norandino (Sudamérica).", p: [[-77.35, 9.05], [-77.3, 8.4], [-77.25, 7.7], [-77.3, 7.0]] },
  { id: "as", n: "Sistema de fallas Azuero–Soná", k: "cortical", t: "Rumbo sinestral · NW–SE", r: "", d: "Atraviesa Azuero y Soná. Origen del terremoto M7.7 del 9 de octubre de 2026, que rompió varios segmentos.", p: [[-81.7, 7.8], [-81.2, 7.68], [-80.75, 7.55], [-80.35, 7.4], [-80.0, 7.28]] },
  { id: "burica", n: "Falla Media de Burica", k: "cortical", t: "Rumbo dextral", r: "", d: "Recorre el eje de la península de Burica y la frontera con Costa Rica.", p: [[-82.93, 8.5], [-82.9, 8.2], [-82.88, 7.95]] },
  { id: "pm", n: "Falla Pedro Miguel", k: "cortical", t: "Rumbo dextral · N–S", r: "2–3 mm/año", d: "Paralela al Canal; controla el diseño sísmico de la Ciudad de Panamá. 13 sismos en 2026 según el IGC.", p: [[-79.66, 9.34], [-79.64, 9.2], [-79.6, 9.03]] },
  { id: "limon", n: "Falla Limón", k: "cortical", t: "Rumbo dextral", r: "", d: "Forma un sistema con Pedro Miguel desde la Sierra Maestra (Colón) hacia el sur.", p: [[-79.6, 9.5], [-79.65, 9.34]] },
  { id: "gatun", n: "Falla Río Gatún", k: "cortical", t: "Rumbo sinestral", r: "", d: "Falla activa del área del Canal; los estudios de la ampliación le asignan potencial de M7+.", p: [[-79.95, 9.2], [-79.78, 9.28], [-79.6, 9.38]] },
  { id: "sambu", n: "Falla de Sambú", k: "cortical", t: "Rumbo", r: "", d: "Darién; parte del alineamiento de fallas del sur del istmo citado por la Universidad de Panamá.", p: [[-78.35, 7.8], [-78.15, 7.55], [-78.0, 7.3]] },
];
export const STRATA: Stratum[] = [ // km
  { a: 0, b: 3, n: "Sedimentos y rocas volcánicas", c: [120, 98, 66] },
  { a: 3, b: 15, n: "Corteza superior (basaltos, arco volcánico)", c: [86, 80, 76] },
  { a: 15, b: 30, n: "Corteza inferior (gabros)", c: [62, 58, 60] },
  { a: 30, b: 60, n: "Manto superior (peridotitas)", c: [96, 50, 38] },
];

const KX = 110.2, KY = 110.6;
function segKm(lon: number, lat: number, a: [number, number], b: [number, number]) {
  const ax = (a[0] - lon) * KX, ay = (a[1] - lat) * KY, bx = (b[0] - lon) * KX, by = (b[1] - lat) * KY;
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l)) : 0;
  return Math.hypot(ax + t * dx, ay + t * dy);
}
/** Falla más cercana a un punto (solo proximidad: no implica que sea la causante). */
export function nearestFault(lon: number, lat: number): { fault: Fault; km: number } {
  let fault = FAULTS[0]!, km = Infinity;
  for (const f of FAULTS) for (let i = 1; i < f.p.length; i++) { const d = segKm(lon, lat, f.p[i - 1]!, f.p[i]!); if (d < km) { km = d; fault = f; } }
  return { fault, km };
}
export const stratumAt = (depthKm: number) => STRATA.find((s) => depthKm >= s.a && depthKm < s.b) ?? STRATA[STRATA.length - 1]!;
export const faultsGeoJSON = () => ({
  type: "FeatureCollection" as const,
  features: FAULTS.map((f) => ({ type: "Feature" as const, properties: { id: f.id, k: f.k, n: f.n }, geometry: { type: "LineString" as const, coordinates: f.p } })),
});
