/** Convierte un token CSS (p. ej. "--mag-3") a rgb() legible por MapLibre/ECharts, que no interpretan oklch. */
const cache = new Map<string, string>();
export function cssColor(token: string, alpha = 1): string {
  if (typeof document === "undefined") return "rgb(128,128,128)";
  const key = `${token}|${alpha}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token).trim() || token;
  const c = document.createElement("canvas");
  c.width = c.height = 1;
  const ctx = c.getContext("2d");
  if (!ctx) return "rgb(128,128,128)";
  ctx.fillStyle = raw;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  const out = `rgba(${r},${g},${b},${alpha})`;
  cache.set(key, out);
  return out;
}
