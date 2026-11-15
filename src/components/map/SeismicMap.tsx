import { useEffect, useRef, useState } from "react";
import type { Map as MLMap, GeoJSONSource, MapLayerMouseEvent } from "maplibre-gl";
import geoData from "@/data/panama-geo.json";
import { FAULTS, faultsGeoJSON, type Fault, type Plate } from "@/data/tectonics";
import type { SeismicEvent } from "@/features/seismic/types";
import { cssColor } from "@/lib/css-color";
import { fmtDateTime, fmtDepth, fmtMag, magClass, placeOf } from "@/features/seismic/format";
import { cn } from "@/lib/utils";

export interface MapLayers {
  panama: boolean;
  maritima: boolean;
  provinces: boolean;
}

/** Opciones visuales del mapa (vista satelital tipo Google Maps, relieve 3D real, fallas, columnas y calor). */
export interface MapView {
  basemap: "satellite" | "dark";
  terrain: boolean;
  faults: boolean;
  columns: boolean;
  heat: boolean;
}

interface Props {
  events: SeismicEvent[];
  focusedFault?: Fault;
  focusedPlate?: Plate;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  layers?: MapLayers;
  view?: Partial<MapView>;
  interactive?: boolean;
  className?: string;
  padding?: { top: number; bottom: number; left: number; right: number };
}

const PANAMA_BOUNDS: [[number, number], [number, number]] = [[-83.2, 6.9], [-77.1, 9.75]];
const esri = (s: string) => [`https://server.arcgisonline.com/ArcGIS/rest/services/${s}/MapServer/tile/{z}/{y}/{x}`];
const DEM_TILES = ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"];
/** Estilo base: imágenes satelitales Esri + etiquetas, mapa oscuro CARTO y relieve AWS Terrain Tiles (terrarium). */
const BASE_STYLE = {
  version: 8 as const,
  sources: {
    sat: { type: "raster" as const, tiles: esri("World_Imagery"), tileSize: 256, maxzoom: 19, attribution: "Imágenes © Esri, Maxar, Earthstar Geographics" },
    labels: { type: "raster" as const, tiles: esri("Reference/World_Boundaries_and_Places"), tileSize: 256, maxzoom: 19 },
    dark: { type: "raster" as const, tiles: ["a", "b", "c"].map((x) => `https://${x}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png`), tileSize: 256, attribution: "© OpenStreetMap · © CARTO" },
    dem: { type: "raster-dem" as const, tiles: DEM_TILES, tileSize: 256, encoding: "terrarium" as const, maxzoom: 13, attribution: "Relieve: AWS Terrain Tiles" },
    demhs: { type: "raster-dem" as const, tiles: DEM_TILES, tileSize: 256, encoding: "terrarium" as const, maxzoom: 13 },
  },
  layers: [
    { id: "bg", type: "background" as const, paint: { "background-color": "#0b1519" } },
    { id: "sat", type: "raster" as const, source: "sat", paint: { "raster-contrast": 0.08, "raster-fade-duration": 200 } },
    { id: "dark", type: "raster" as const, source: "dark", layout: { visibility: "none" as const }, paint: { "raster-fade-duration": 200 } },
    { id: "hill", type: "hillshade" as const, source: "demhs", paint: { "hillshade-exaggeration": 0.25 } },
    { id: "labels", type: "raster" as const, source: "labels", paint: { "raster-opacity": 0.9 } },
  ],
};
const TERRAIN = { source: "dem", exaggeration: 1.6 };

type GeoFile = { adm0: { coordinates: number[][][][] }; provinces: { name: string; coordinates: number[][][][] }[] };

function toFeatures(events: SeismicEvent[]) {
  return {
    type: "FeatureCollection" as const,
    features: events.map((e) => ({
      type: "Feature" as const,
      id: e.id,
      geometry: { type: "Point" as const, coordinates: [e.primary.longitude, e.primary.latitude] },
      properties: {
        id: e.id,
        mag: e.primary.magnitude ?? 0,
        hasMag: e.primary.magnitude != null,
        cls: magClass(e.primary.magnitude),
        zone: e.classification,
        place: placeOf(e),
        when: fmtDateTime(e.primary.occurredAtUtc),
        depth: fmtDepth(e.primary.depthKm),
        magText: fmtMag(e.primary.magnitude),
        t: Date.parse(e.primary.occurredAtUtc),
        recent: Date.now() - Date.parse(e.primary.occurredAtUtc) < 86_400_000,
      },
    })),
  };
}

/** Columnas hexagonales por sismo (altura según magnitud) para la vista 3D. */
function toColumns(events: SeismicEvent[]) {
  return {
    type: "FeatureCollection" as const,
    features: events.filter((e) => (e.primary.magnitude ?? 0) >= 2.5).map((e) => {
      const m = e.primary.magnitude ?? 0, km = 0.9 + (m - 2.5) * 0.8, { longitude: lon, latitude: lat } = e.primary;
      const ring: number[][] = [];
      for (let i = 0; i <= 6; i++) { const a = (Math.PI / 3) * i; ring.push([lon + (km * Math.cos(a)) / (111.32 * Math.cos((lat * Math.PI) / 180)), lat + (km * Math.sin(a)) / 110.57]); }
      return { type: "Feature" as const, properties: { id: e.id, cls: magClass(e.primary.magnitude), h: Math.pow(m, 3) * 55 }, geometry: { type: "Polygon" as const, coordinates: [ring] } };
    }),
  };
}

export function SeismicMap({ events, focusedFault, focusedPlate, selectedId, onSelect, layers = { panama: true, maritima: true, provinces: true }, view, interactive = true, className, padding }: Props) {
  const v: MapView = { basemap: "satellite", terrain: interactive, faults: true, columns: false, heat: false, ...view };
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    let disposed = false;
    let raf = 0;
    let map: MLMap | null = null;
    (async () => {
      try {
        const [ml, worker] = await Promise.all([
          import("maplibre-gl"),
          import("maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url"),
        ]);
        if (disposed || !ref.current) return;
        ml.setWorkerUrl(worker.default);
        map = new ml.Map({
          container: ref.current,
          style: BASE_STYLE as never,
          bounds: PANAMA_BOUNDS,
          maxPitch: 80,
          // En pantallas estrechas se ignora el padding de escritorio para no alejar el mapa al mundo entero.
          fitBoundsOptions: { padding: ref.current.clientWidth < 768 ? { top: 20, bottom: 190, left: 16, right: 16 } : (padding ?? 24) },
          interactive,
          attributionControl: { compact: true },
          cooperativeGestures: false,
        });
        mapRef.current = map;
        if (interactive) {
          map.addControl(new ml.NavigationControl({ visualizePitch: true }), "bottom-right");
          map.addControl(new ml.FullscreenControl(), "bottom-right");
          map.addControl(new ml.ScaleControl({ unit: "metric" }), "bottom-left");
        }
        map.on("load", () => {
          if (!map || disposed) return;
          const g = geoData as unknown as GeoFile;
          map.addSource("provinces", {
            type: "geojson",
            data: { type: "FeatureCollection", features: g.provinces.map((p) => ({ type: "Feature", properties: { name: p.name }, geometry: { type: "MultiPolygon", coordinates: p.coordinates } })) },
          });
          map.addLayer({ id: "prov-fill", type: "fill", source: "provinces", paint: { "fill-color": cssColor("--primary", 1), "fill-opacity": 0.03 } });
          map.addLayer({ id: "prov-line", type: "line", source: "provinces", paint: { "line-color": "#ffffff", "line-opacity": 0.35, "line-width": 0.8 } });
          map.addSource("adm0", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "MultiPolygon", coordinates: g.adm0.coordinates } } });
          map.addLayer({ id: "adm0-line", type: "line", source: "adm0", paint: { "line-color": "#ffffff", "line-opacity": 0.6, "line-width": 1.3 } });
          // Fallas y límites de placa
          map.addSource("faults", { type: "geojson", data: faultsGeoJSON() });
          map.addLayer({ id: "f-focus", type: "line", source: "faults", filter: ["==", ["get", "id"], ""], paint: { "line-color": "#5fd0d6", "line-width": 8, "line-opacity": 0.9 } });
          map.addLayer({ id: "f-glow", type: "line", source: "faults", layout: { "line-cap": "round" }, paint: { "line-color": ["match", ["get", "k"], "limite", "#ff5a4f", "#ffb347"], "line-width": 8, "line-opacity": 0.2, "line-blur": 3 } });
          map.addLayer({ id: "f-lim", type: "line", source: "faults", filter: ["==", ["get", "k"], "limite"], layout: { "line-cap": "round" }, paint: { "line-color": "#ff5a4f", "line-width": ["interpolate", ["linear"], ["zoom"], 5, 1.8, 10, 3.5] } });
          map.addLayer({ id: "f-cor", type: "line", source: "faults", filter: ["==", ["get", "k"], "cortical"], paint: { "line-color": "#ffb347", "line-width": ["interpolate", ["linear"], ["zoom"], 5, 1.6, 10, 3], "line-dasharray": [2, 1.4] } });
          map.addSource("events", { type: "geojson", data: toFeatures([]) });
          map.addSource("columns", { type: "geojson", data: toColumns([]) });
          const colorExpr = ["match", ["get", "cls"], 1, cssColor("--mag-1"), 2, cssColor("--mag-2"), 3, cssColor("--mag-3"), 4, cssColor("--mag-4"), 5, cssColor("--mag-5"), cssColor("--mag-0")];
          const base = ["interpolate", ["exponential", 1.7], ["get", "mag"], 0, 2.5, 3, 4.5, 5, 10, 6, 16, 7.7, 30];
          const RZ = (k: number) => ["interpolate", ["linear"], ["zoom"], 4, ["*", base, 0.6 * k], 7, ["*", base, k], 11, ["*", base, 2 * k]];
          const radius = RZ(1);
          map.addLayer({ id: "ev-heat", type: "heatmap", source: "events", layout: { visibility: "none" }, paint: { "heatmap-weight": ["interpolate", ["linear"], ["get", "mag"], 1, 0.05, 5, 0.6, 7.7, 1], "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 4, 14, 9, 36], "heatmap-opacity": 0.75, "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(0,0,0,0)", 0.2, "#2b7a8c", 0.45, "#e9d75a", 0.7, "#f39a3c", 1, "#f0614f"] } as never });
          map.addLayer({ id: "ev-cols", type: "fill-extrusion", source: "columns", layout: { visibility: "none" }, paint: { "fill-extrusion-color": colorExpr as never, "fill-extrusion-height": ["get", "h"], "fill-extrusion-opacity": 0.85 } as never });
          map.addLayer({
            id: "ev-halo", type: "circle", source: "events",
            paint: { "circle-radius": RZ(2.3) as never, "circle-color": colorExpr as never, "circle-opacity": 0.28, "circle-blur": 1, "circle-pitch-alignment": "map" },
          });
          map.addLayer({
            id: "ev-pulse", type: "circle", source: "events", filter: ["==", ["get", "recent"], true],
            paint: { "circle-radius": radius as never, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": colorExpr as never, "circle-stroke-width": 2, "circle-stroke-opacity": 0.8, "circle-pitch-alignment": "map" },
          });
          map.addLayer({
            id: "ev-dot", type: "circle", source: "events", layout: { "circle-sort-key": ["get", "mag"] } as never,
            paint: {
              "circle-pitch-alignment": "map",
              "circle-radius": radius as never,
              "circle-color": colorExpr as never,
              "circle-stroke-color": ["case", ["==", ["get", "zone"], "maritima"], "#bff6f8", "#ffffff"] as never,
              "circle-stroke-width": ["case", ["==", ["get", "zone"], "maritima"], 1.6, 1] as never,
              "circle-opacity": 0.9,
            },
          });
          map.addLayer({
            id: "ev-selected", type: "circle", source: "events", filter: ["==", ["get", "id"], ""],
            paint: { "circle-radius": ["+", radius, 7] as never, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": "#ffffff", "circle-stroke-width": 2.5, "circle-pitch-alignment": "map" },
          });
          if (interactive) {
            const popup = new ml.Popup({ closeButton: false, closeOnClick: false, offset: 12 });
            map.on("mouseenter", "ev-dot", (e: MapLayerMouseEvent) => {
              if (!map) return;
              map.getCanvas().style.cursor = "pointer";
              const f = e.features?.[0];
              if (!f) return;
              const p = f.properties as { when: string; magText: string; place: string; depth: string };
              const content = document.createElement("div");
              const time = document.createElement("small");
              time.textContent = p.when;
              const summary = document.createElement("div");
              summary.textContent = `M ${p.magText} · ${p.place}`;
              const depth = document.createElement("small");
              depth.textContent = `Profundidad: ${p.depth}`;
              content.append(time, summary, depth);
              popup.setLngLat(e.lngLat).setDOMContent(content).addTo(map);
            });
            map.on("mouseleave", "ev-dot", () => { if (map) map.getCanvas().style.cursor = ""; popup.remove(); });
            map.on("click", "ev-dot", (e: MapLayerMouseEvent) => {
              const id = e.features?.[0]?.properties?.["id"] as string | undefined;
              if (id) onSelectRef.current?.(id);
            });
            const fpop = new ml.Popup({ closeButton: true, offset: 8, maxWidth: "280px" });
            for (const l of ["f-lim", "f-cor"]) {
              map.on("mouseenter", l, () => { if (map) map.getCanvas().style.cursor = "pointer"; });
              map.on("mouseleave", l, () => { if (map) map.getCanvas().style.cursor = ""; });
              map.on("click", l, (e: MapLayerMouseEvent) => {
                if (!map || map.queryRenderedFeatures(e.point, { layers: ["ev-dot"] }).length) return;
                const f = FAULTS.find((x) => x.id === e.features?.[0]?.properties?.["id"]);
                if (!f) return;
                fpop.setLngLat(e.lngLat).setHTML(`<div style="font-family:var(--font-mono);font-size:10px;text-transform:uppercase;color:${f.k === "limite" ? "#ff5a4f" : "#ffb347"}">${f.k === "limite" ? "Límite de placa" : "Falla cortical"}</div><div style="font-size:14px;font-weight:600;margin-top:2px">${f.n}</div><div style="font-size:12px;opacity:.8;margin-top:2px">${f.t}${f.r ? " · " + f.r : ""}</div><div style="font-size:12px;opacity:.75;margin-top:6px">${f.d}</div>`).addTo(map);
              });
            }
          }
          // Pulso de sismos de las últimas 24 h (~30 fps, en pausa con la pestaña oculta)
          let last = 0;
          const tick = (now: number) => {
            if (disposed || !map) return;
            raf = requestAnimationFrame(tick);
            if (now - last < 33 || document.hidden || !map.getLayer("ev-pulse")) return;
            last = now;
            const k = (now % 2000) / 2000;
            map.setPaintProperty("ev-pulse", "circle-radius", RZ(1 + k * 2.2) as never);
            map.setPaintProperty("ev-pulse", "circle-stroke-opacity", 0.85 * (1 - k));
          };
          raf = requestAnimationFrame(tick);
          setReady(true);
        });
        map.on("error", (e) => console.warn("Mapa:", e.error?.message));
      } catch (e) {
        setFailed(e instanceof Error ? e.message : "No se pudo iniciar el mapa");
      }
    })();
    return () => { disposed = true; cancelAnimationFrame(raf); map?.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const visible = events.filter((e) => (e.classification === "panama" ? layers.panama : layers.maritima));
    (map.getSource("events") as GeoJSONSource | undefined)?.setData(toFeatures([...visible].sort((a, b) => (a.primary.magnitude ?? 0) - (b.primary.magnitude ?? 0))));
    (map.getSource("columns") as GeoJSONSource | undefined)?.setData(toColumns(visible));
    const vis = layers.provinces ? "visible" : "none";
    map.setLayoutProperty("prov-fill", "visibility", vis);
    map.setLayoutProperty("prov-line", "visibility", vis);
  }, [ready, events, layers.panama, layers.maritima, layers.provinces]);

  // Vista: mapa base, relieve 3D, fallas, columnas, calor
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const vis = (on: boolean) => (on ? "visible" : "none");
    const sat = v.basemap === "satellite";
    map.setLayoutProperty("sat", "visibility", vis(sat));
    map.setLayoutProperty("labels", "visibility", vis(sat));
    map.setLayoutProperty("dark", "visibility", vis(!sat));
    map.setPaintProperty("hill", "hillshade-exaggeration", sat ? 0.25 : 0.5);
    for (const l of ["f-glow", "f-lim", "f-cor", "f-focus"]) map.setLayoutProperty(l, "visibility", vis(v.faults));
    map.setLayoutProperty("ev-cols", "visibility", vis(v.columns));
    map.setLayoutProperty("ev-heat", "visibility", vis(v.heat));
    map.setTerrain(v.terrain ? (TERRAIN as never) : null);
    if (interactive) map.easeTo({ pitch: v.terrain || v.columns ? Math.max(map.getPitch(), 50) : 0, duration: 800 });
  }, [ready, v.basemap, v.terrain, v.faults, v.columns, v.heat, interactive]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.setFilter("f-focus", ["==", ["get", "id"], focusedFault?.id ?? ""]);
    if (focusedFault) {
      const longitudes = focusedFault.p.map(([lon]) => lon);
      const latitudes = focusedFault.p.map(([, lat]) => lat);
      map.fitBounds([[Math.min(...longitudes), Math.min(...latitudes)], [Math.max(...longitudes), Math.max(...latitudes)]], {
        padding: map.getContainer().clientWidth < 768 ? { top: 64, bottom: 150, left: 28, right: 28 } : { top: 70, bottom: 150, left: 340, right: 50 },
        maxZoom: 9,
        duration: 0,
      });
    } else if (focusedPlate) {
      map.jumpTo({ center: focusedPlate.at, zoom: 6.5 });
    }
  }, [ready, focusedFault, focusedPlate]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.setFilter("ev-selected", ["==", ["get", "id"], selectedId ?? ""]);
    const ev = events.find((e) => e.id === selectedId);
    if (ev && interactive) map.flyTo({ center: [ev.primary.longitude, ev.primary.latitude], zoom: Math.max(map.getZoom(), 8), duration: 1200, essential: true });
  }, [ready, selectedId, events, interactive]);

  return (
    <div className={cn("relative overflow-hidden bg-surface", className)}>
      <div ref={ref} className="h-full w-full" role="region" aria-label="Mapa de sismos de Panamá" />
      {!ready && !failed && <div className="absolute inset-0 grid place-items-center meta">Cargando mapa…</div>}
      {failed && <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-muted-foreground">El mapa no se pudo cargar: {failed}</div>}
    </div>
  );
}

export function MagLegend({ className }: { className?: string }) {
  const bands = [
    { c: "bg-mag-1", l: "< 3" }, { c: "bg-mag-2", l: "3–3.9" }, { c: "bg-mag-3", l: "4–4.9" }, { c: "bg-mag-4", l: "5–5.9" }, { c: "bg-mag-5", l: "≥ 6" },
  ];
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 meta", className)}>
      <span className="text-foreground/80">Magnitud</span>
      {bands.map((b) => (
        <span key={b.l} className="flex items-center gap-1.5"><span className={cn("size-2.5 rounded-full", b.c)} />{b.l}</span>
      ))}
      <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full border border-mag-2" />Marítimo</span>
      <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-[#ff5a4f]" />Límite de placa</span>
      <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded border-t-2 border-dashed border-[#ffb347]" />Falla</span>
    </div>
  );
}
