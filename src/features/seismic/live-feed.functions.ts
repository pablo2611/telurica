import { createServerFn } from "@tanstack/react-start";
import { QUERY_BBOX } from "./geo";
import { usgsCollectionSchema, usgsFeatureSchema } from "./types";

export const USGS_LIVE_FEED = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson";
type LiveFeed = { ok: boolean; features: ReturnType<typeof usgsFeatureSchema.parse>[] };

async function fetchLiveFeed(): Promise<LiveFeed> {
  try {
    const response = await fetch(USGS_LIVE_FEED, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return { ok: false, features: [] };
    const { features } = usgsCollectionSchema.parse(await response.json());
    const box = QUERY_BBOX;
    return {
      ok: true,
      features: features.flatMap((feature) => {
        const result = usgsFeatureSchema.safeParse(feature);
        if (!result.success) return [];
        const [lon, lat] = result.data.geometry.coordinates;
        return lon != null && lat != null && lon >= box.minLon && lon <= box.maxLon && lat >= box.minLat && lat <= box.maxLat ? [result.data] : [];
      }),
    };
  } catch {
    return { ok: false, features: [] };
  }
}

let cached: { expires: number; data: Promise<LiveFeed> } | undefined;
export const getUsgsLiveFeed = createServerFn({ method: "GET" }).handler(() => {
  if (cached && cached.expires > Date.now()) return cached.data;
  const data = fetchLiveFeed();
  cached = { expires: Date.now() + 30_000, data };
  return data;
});
