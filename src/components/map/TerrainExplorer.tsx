import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MLMap, Marker } from "maplibre-gl";
import { BASE_STYLE, PANAMA_BOUNDS } from "./SeismicMap";
import { faultsGeoJSON } from "@/data/tectonics";
import type { TerrainPoint } from "@/features/terrain/assessment";
import type { SeismicEvent } from "@/features/seismic/types";
import { cssColor } from "@/lib/css-color";

interface Props {
  point: TerrainPoint | null;
  events: SeismicEvent[];
  onPick: (point: TerrainPoint) => void;
  satellite: boolean;
  terrain: boolean;
  buildings: boolean;
}

export function TerrainExplorer({ point, events, onPick, satellite, terrain, buildings }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const pick = useRef(onPick); pick.current = onPick;
  const [ready, setReady] = useState(false);
  const [settled, setSettled] = useState(false);
  const [visibleBuildings, setVisibleBuildings] = useState(0);
  const [failure, setFailure] = useState("");
  const [layerWarning, setLayerWarning] = useState("");
  useEffect(() => {
    let disposed = false;
    let instance: MLMap | null = null;
    let observer: ResizeObserver | null = null;
    void (async () => {
      try {
        const [ml, worker] = await Promise.all([import("maplibre-gl"), import("maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url")]);
        if (disposed || !host.current) return;
        ml.setWorkerUrl(worker.default);
        instance = new ml.Map({ container: host.current, style: BASE_STYLE as never, bounds: PANAMA_BOUNDS,
          fitBoundsOptions: { padding: 24 }, maxBounds: [[-84.2, 5.8], [-76.2, 11]], maxZoom: 18, maxPitch: 70,
          attributionControl: { compact: true }, cooperativeGestures: true });
        map.current = instance;
        instance.on("movestart", () => { if (!disposed) setSettled(false); });
        instance.on("sourcedataloading", () => { if (!disposed) setSettled(false); });
        instance.on("idle", () => {
          if (disposed || !instance) return;
          setSettled(true);
          setVisibleBuildings(instance.getLayer("terrain-buildings") ? instance.queryRenderedFeatures({ layers: ["terrain-buildings"] }).length : 0);
        });
        instance.addControl(new ml.NavigationControl({ visualizePitch: true }), "top-right");
        instance.addControl(new ml.FullscreenControl(), "top-right");
        instance.addControl(new ml.ScaleControl({ unit: "metric" }), "bottom-left");
        const pin = document.createElement("div"); pin.className = "terrain-pin"; pin.setAttribute("role", "img"); pin.setAttribute("aria-label", "Ubicación seleccionada");
        marker.current = new ml.Marker({ element: pin, anchor: "bottom" });
        instance.on("click", event => pick.current({ longitude: event.lngLat.lng, latitude: event.lngLat.lat, zoom: Math.max(13, instance?.getZoom() ?? 13) }));
        instance.on("error", event => {
          if (disposed) return;
          const source = "sourceId" in event ? String(event.sourceId) : "";
          if (["dem", "demhs", "sat", "city"].includes(source)) setLayerWarning("Una capa del proveedor no pudo cargar. Puedes cambiar la vista y continuar con las coordenadas y la ficha.");
        });
        instance.once("load", () => {
          if (!instance || disposed) return;
          instance.addSource("terrain-faults", { type: "geojson", data: faultsGeoJSON() });
          instance.addLayer({ id: "terrain-faults", type: "line", source: "terrain-faults", paint: { "line-color": cssColor("--warn"), "line-width": 2, "line-dasharray": [3, 2], "line-opacity": 0.8 } });
          instance.addSource("terrain-events", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          instance.addLayer({ id: "terrain-events", type: "circle", source: "terrain-events", paint: { "circle-color": cssColor("--primary"), "circle-radius": 4, "circle-stroke-color": cssColor("--foreground"), "circle-stroke-width": 1, "circle-opacity": 0.75 } });
          setReady(true);
        });
        observer = new ResizeObserver(() => instance?.resize()); observer.observe(host.current);
      } catch { if (!disposed) setFailure("El visor 3D no está disponible en este navegador. Puedes elegir una ubicación con los botones o las coordenadas y consultar su ficha."); }
    })();
    return () => { disposed = true; observer?.disconnect(); marker.current?.remove(); instance?.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance || !point) return;
    marker.current?.setLngLat([point.longitude, point.latitude]).addTo(instance);
    instance.flyTo({ center: [point.longitude, point.latitude], zoom: point.zoom ?? 14, duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 500 });
  }, [ready, point]);

  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    instance.setLayoutProperty("sat", "visibility", satellite ? "visible" : "none");
    instance.setLayoutProperty("labels", "visibility", satellite ? "visible" : "none");
    instance.setLayoutProperty("dark", "visibility", satellite ? "none" : "visible");
    instance.setTerrain(terrain ? { source: "dem", exaggeration: 1 } : null);
    instance.easeTo({ pitch: terrain || buildings ? 50 : 0, duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 400 });
    if (buildings && !instance.getSource("city")) {
      instance.addSource("city", { type: "vector", url: "https://tiles.openfreemap.org/planet" });
      instance.addLayer({ id: "terrain-buildings", type: "fill-extrusion", source: "city", "source-layer": "building", minzoom: 14.5,
        filter: ["all", ["!=", ["get", "hide_3d"], true], ["has", "render_height"]],
        paint: { "fill-extrusion-color": cssColor("--primary"), "fill-extrusion-height": ["max", 0, ["to-number", ["get", "render_height"], 0]], "fill-extrusion-base": ["max", 0, ["to-number", ["get", "render_min_height"], 0]], "fill-extrusion-opacity": 0.82 } });
    }
    if (instance.getLayer("terrain-buildings")) instance.setLayoutProperty("terrain-buildings", "visibility", buildings ? "visible" : "none");
  }, [ready, satellite, terrain, buildings]);

  useEffect(() => {
    if (!ready) return;
    map.current?.getSource<GeoJSONSource>("terrain-events")?.setData({ type: "FeatureCollection", features: events.map(event => ({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [event.primary.longitude, event.primary.latitude] } })) });
  }, [ready, events]);

  return <div className="terrain-viewport" data-map-settled={settled} data-visible-buildings={visibleBuildings}>
    <div ref={host} className="terrain-canvas" role="region" aria-label="Mapa 3D para explorar terrenos de Panamá" />
    {!ready && !failure && <p className="terrain-map-loading" role="status">Cargando el visor de Panamá…</p>}
    {failure && <p className="terrain-map-loading">{failure}</p>}
    {ready && <span className="terrain-map-label">{terrain ? "Relieve real · escala vertical 1×" : buildings ? "Edificios 3D · OSM" : "Vista desde arriba"}</span>}
    {ready && !settled && <span className="terrain-tile-status">Actualizando la vista…</span>}
    {layerWarning && <p className="terrain-layer-warning" role="status">{layerWarning}</p>}
  </div>;
}
