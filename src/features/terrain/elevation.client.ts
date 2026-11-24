import type { TerrainPoint, TerrainReading } from "./assessment";

export const DEM_ZOOM = 13;
export const SAMPLE_RADIUS_METERS = 150;
export const decodeTerrarium = (red: number, green: number, blue: number) => red * 256 + green + blue / 256 - 32768;
export function tilePixel(point: TerrainPoint) {
  const n = 2 ** DEM_ZOOM;
  const x = (point.longitude + 180) / 360 * n;
  const lat = point.latitude * Math.PI / 180;
  const y = (1 - Math.asinh(Math.tan(lat)) / Math.PI) / 2 * n;
  return { x: Math.floor(x), y: Math.floor(y), px: Math.min(255, Math.floor((x % 1) * 256)), py: Math.min(255, Math.floor((y % 1) * 256)) };
}
export function terrainGradient(center: number, east: number, west: number, north: number, south: number) {
  if (![center, east, west, north, south].every(value => Number.isFinite(value) && value > -1000 && value < 9000)) throw new Error("El modelo no contiene elevaciones válidas en este punto.");
  const run = 2 * SAMPLE_RADIUS_METERS;
  const gradient = Math.hypot((east - west) / run, (north - south) / run);
  return { elevation: center, slopeDegrees: Math.atan(gradient) * 180 / Math.PI, slopePercent: gradient * 100, sampleSpanMeters: run };
}

const tiles = new Map<string, ImageData>();
/** Up to four small public tiles per selected point, only after a user action. No server proxy. */
export async function readTerrain(point: TerrainPoint, signal: AbortSignal): Promise<TerrainReading> {
  const dy = SAMPLE_RADIUS_METERS / 111_195;
  const dx = dy / Math.cos(point.latitude * Math.PI / 180);
  const samples = [point, { ...point, longitude: point.longitude + dx }, { ...point, longitude: point.longitude - dx }, { ...point, latitude: point.latitude + dy }, { ...point, latitude: point.latitude - dy }];
  const pixels = samples.map(tilePixel);
  const unique = new Map(pixels.map(pixel => [`${pixel.x}/${pixel.y}`, pixel]));
  const available = new Map<string, ImageData>();
  await Promise.all([...unique].map(async ([key, pixel]) => {
    const cached = tiles.get(key);
    if (cached) { available.set(key, cached); return; }
    const response = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${DEM_ZOOM}/${pixel.x}/${pixel.y}.png`, { signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]) });
    if (!response.ok) throw new Error("El proveedor de elevación no respondió. Puedes seguir explorando el mapa.");
    const bitmap = await createImageBitmap(await response.blob());
    try {
      const canvas = document.createElement("canvas"); canvas.width = canvas.height = 256;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Este navegador no permite leer la elevación del mapa.");
      context.drawImage(bitmap, 0, 0, 256, 256);
      const data = context.getImageData(0, 0, 256, 256);
      if (tiles.size >= 12) tiles.delete(tiles.keys().next().value!);
      tiles.set(key, data); available.set(key, data);
    } finally { bitmap.close(); }
  }));
  if (signal.aborted) throw signal.reason;
  const heights = pixels.map(pixel => {
    const data = available.get(`${pixel.x}/${pixel.y}`)!.data;
    const offset = (pixel.py * 256 + pixel.px) * 4;
    if (!data[offset + 3]) throw new Error("Sin elevación disponible para este punto.");
    return decodeTerrarium(data[offset]!, data[offset + 1]!, data[offset + 2]!);
  });
  return { ...terrainGradient(heights[0]!, heights[1]!, heights[2]!, heights[3]!, heights[4]!), sampledAt: new Date().toISOString() };
}
