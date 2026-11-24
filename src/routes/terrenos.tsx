import { createClientOnlyFn } from "@tanstack/react-start";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Bot, Building2, Download, LocateFixed, MapPin, Mountain, Printer, Ruler, ScanSearch } from "lucide-react";
import { TerrainExplorer } from "@/components/map/TerrainExplorer";
import { seismicQuery } from "@/features/seismic/queries";
import { periodStart, type PeriodId } from "@/features/seismic/periods";
import { findProvince } from "@/features/seismic/geo";
import { fmtDateTime, fmtMag, placeOf } from "@/features/seismic/format";
import { nearbySeismicity, nearestRegionalFault, pointProblem, terrainRecommendations, TERRAIN_PLACES, type TerrainPoint, type TerrainReading } from "@/features/terrain/assessment";
import { useHydrated } from "@/hooks/use-hydrated";

export const Route = createFileRoute("/terrenos")({
  validateSearch: (search: Record<string, unknown>): { lat?: number; lon?: number } => {
    const lat = search["lat"] == null ? NaN : Number(search["lat"]), lon = search["lon"] == null ? NaN : Number(search["lon"]);
    return Number.isFinite(lat) && Number.isFinite(lon) && !pointProblem({ latitude: lat, longitude: lon }) ? { lat, lon } : {};
  },
  head: () => ({ meta: [{ title: "Explorar terrenos de Panamá · Telúrica" }, { name: "description", content: "Relieve y edificios 3D, sismicidad cercana y ficha preliminar de un terreno en Panamá. Datos públicos y estudios pendientes." }] }),
  component: Terrenos,
});

const readElevation = createClientOnlyFn(async (point: TerrainPoint, signal: AbortSignal) => (await import("@/features/terrain/elevation.client")).readTerrain(point, signal));

const EMPTY_EVENTS: import("@/features/seismic/types").SeismicEvent[] = [];

function Terrenos() {
  const hydrated = useHydrated();
  const navigate = useNavigate({ from: "/terrenos" });
  const search = Route.useSearch();
  const [point, setPoint] = useState<TerrainPoint | null>(() => search.lat != null && search.lon != null ? { latitude: search.lat, longitude: search.lon, zoom: 14 } : null);
  const [latitude, setLatitude] = useState(() => search.lat?.toString() ?? "");
  const [longitude, setLongitude] = useState(() => search.lon?.toString() ?? "");
  const [error, setError] = useState("");
  const [gpsPending, setGpsPending] = useState(false);
  const alive = useRef(true);
  const [satellite, setSatellite] = useState(true);
  const [terrain, setTerrain] = useState(true);
  const [buildings, setBuildings] = useState(false);
  const [period, setPeriod] = useState<PeriodId>("90d");
  const [radius, setRadius] = useState(25);
  const [reading, setReading] = useState<TerrainReading | null>(null);
  const [elevationState, setElevationState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [elevationError, setElevationError] = useState("");
  const catalog = useQuery({ ...seismicQuery(periodStart(period)), enabled: !!point, refetchInterval: false, staleTime: 300_000, placeholderData: () => undefined, retry: false });
  const sourcesAvailable = !!catalog.data?.sources.some(source => ["usgs", "emsc"].includes(source.id) && ["operativa", "con_retraso"].includes(source.state));
  const statistics = useMemo(() => point && sourcesAvailable && catalog.data ? nearbySeismicity(point, catalog.data.events, radius) : null, [point, sourcesAvailable, catalog.data, radius]);
  const fault = useMemo(() => point ? nearestRegionalFault(point) : null, [point]);
  const mapEvents = useMemo(() => statistics?.nearby.map(row => row.event) ?? EMPTY_EVENTS, [statistics]);
  const recommendations = terrainRecommendations(reading);

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    if (!point) return;
    const controller = new AbortController();
    setReading(null); setElevationState("loading"); setElevationError("");
    const timer = window.setTimeout(() => {
      void Promise.resolve(readElevation(point, controller.signal))
        .then(value => { if (value && !controller.signal.aborted) { setReading(value); setElevationState("ready"); } })
        .catch(reason => { if (!controller.signal.aborted) { setElevationState("error"); setElevationError(reason instanceof Error ? reason.message : "La elevación no está disponible."); } });
    }, 450);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [point]);

  function choose(next: TerrainPoint) {
    const problem = pointProblem(next);
    if (problem) { setError(problem); return; }
    setError(""); setReading(null); setElevationState("loading"); setPoint(next); setLatitude(next.latitude.toFixed(6)); setLongitude(next.longitude.toFixed(6));
    void navigate({ search: { lat: Number(next.latitude.toFixed(6)), lon: Number(next.longitude.toFixed(6)) }, replace: true, resetScroll: false });
  }
  function locate() {
    if (!navigator.geolocation) { setError("Este navegador no ofrece ubicación. Puedes escribir las coordenadas."); return; }
    setGpsPending(true); setError("");
    navigator.geolocation.getCurrentPosition(position => {
      if (!alive.current) return;
      setGpsPending(false); choose({ longitude: position.coords.longitude, latitude: position.coords.latitude, zoom: 15 });
    }, () => { if (alive.current) { setGpsPending(false); setError("No se pudo obtener tu ubicación. Puedes elegir un punto o escribir sus coordenadas."); } }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!latitude.trim() || !longitude.trim()) { setError("Escribe ambas coordenadas."); return; }
    choose({ latitude: Number(latitude.replace(",", ".")), longitude: Number(longitude.replace(",", ".")), zoom: 15 });
  }
  const province = point ? findProvince(point.longitude, point.latitude) : null;
  const prompt = point ? `Ayúdame a preparar los estudios necesarios antes de construir en ${province ?? "Panamá"}. Punto de referencia: ${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}. La ficha preliminar tiene ${reading ? `pendiente regional aproximada de ${reading.slopeDegrees.toFixed(1)} grados en una ventana de 300 metros` : "elevación pendiente de verificar"}. No dispongo de sondeos, microzonificación ni evaluación local de inundación o licuefacción. Explica qué debería solicitar a un profesional; no certifiques aptitud del terreno.` : "";

  function download() {
    if (!point) return;
    const report = { title: "Telúrica · Ficha preliminar de terreno", status: "incompleta", generatedAt: new Date().toISOString(), location: point, province,
      topography: reading, topographyStatus: elevationState, regionalFault: fault,
      seismicity: statistics && catalog.data ? { period: catalog.data.range, radiusKm: radius, count: statistics.count, maxMagnitude: statistics.maxMagnitude, nearestEpicenterKm: statistics.closest?.distanceKm ?? null } : null,
      pending: ["Geotecnia y sondeos del predio", "Parámetros normativos y microzonificación", "Geología local y nivel freático", "Licuefacción, inundación y deslizamientos", "Uso de suelo y restricciones"],
      recommendations, limitations: "No determina aptitud constructiva ni probabilidad de un próximo sismo. Pendiente regional aproximada; las trazas de falla no tienen precisión predial. Edificios OSM no representan un levantamiento ni un inventario completo.",
      sources: ["https://registry.opendata.aws/terrain-tiles/", "https://openfreemap.org/", "https://maps.openquake.org/map/gshm-v2026_1/", "https://www.ipde.gob.pa/geoservicios/", ...(catalog.data?.sources.map(source => source.url) ?? [])] };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "telurica-ficha-terreno.json"; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <main className="terrain-page">
    <header className="terrain-header">
      <div><p className="terrain-kicker"><ScanSearch aria-hidden="true" /> Exploración del territorio</p><h1>Antes de construir,<br /><em>conoce el lugar.</em></h1><p>Explora ciudades, montañas y áreas rurales de Panamá. Reúne datos del entorno y prepara las preguntas para tu estudio de terreno.</p></div>
      <div className="terrain-header-note"><Mountain aria-hidden="true" /><span>Relieve 3D · edificios OSM<br />Datos abiertos, sin claves adicionales</span></div>
    </header>

    <div className="terrain-workspace">
      <aside className="terrain-controls" aria-label="Elegir ubicación y contexto">
        <div className="terrain-section-title"><span>01</span><h2>Elige una ubicación</h2></div>
        <p className="terrain-hint">Toca el mapa o empieza por uno de estos lugares. Las ubicaciones son puntos de referencia, no parcelas.</p>
        <div className="terrain-places">{TERRAIN_PLACES.map(place => <button type="button" key={place.name} disabled={!hydrated} onClick={() => { choose(place); setBuildings(place.kind === "Ciudad"); setSatellite(place.kind !== "Ciudad"); setTerrain(true); }}><span>{place.name}</span><small>{place.kind}</small></button>)}</div>
        <form onSubmit={submit} className="terrain-coordinate-form">
          <label htmlFor="terrain-latitude">Latitud<input id="terrain-latitude" inputMode="decimal" required placeholder="8.985" value={latitude} onChange={event => setLatitude(event.target.value)} /></label>
          <label htmlFor="terrain-longitude">Longitud<input id="terrain-longitude" inputMode="decimal" required placeholder="-79.518" value={longitude} onChange={event => setLongitude(event.target.value)} /></label>
          <button type="submit" className="terrain-primary" disabled={!hydrated}><MapPin aria-hidden="true" /> Ubicar coordenadas</button>
        </form>
        <button type="button" className="terrain-location" disabled={!hydrated || gpsPending} onClick={locate}><LocateFixed aria-hidden="true" />{gpsPending ? "Obteniendo ubicación…" : "Usar mi ubicación"}</button>
        {error && <p role="alert" className="terrain-error">{error}</p>}
        <div className="terrain-context"><div><label htmlFor="terrain-period">Catálogo sísmico</label><select id="terrain-period" value={period} onChange={event => setPeriod(event.target.value as PeriodId)}><option value="30d">30 días</option><option value="90d">90 días</option><option value="365d">1 año</option></select></div><div><label htmlFor="terrain-radius">Radio alrededor del punto</label><select id="terrain-radius" value={radius} onChange={event => setRadius(Number(event.target.value))}><option value={5}>5 km</option><option value={25}>25 km</option><option value={50}>50 km</option></select></div></div>
        <p className="terrain-privacy">Los proveedores reciben las teselas de la zona consultada. No se guarda la ubicación en una cuenta. Savia solo se consulta cuando envías tu pregunta.</p>
      </aside>

      <section className="terrain-map-section" aria-label="Visor de relieve y edificios">
        <div className="terrain-map-toolbar"><div role="group" aria-label="Fondo del mapa"><button type="button" aria-pressed={satellite} onClick={() => setSatellite(true)}>Satélite</button><button type="button" aria-pressed={!satellite} onClick={() => setSatellite(false)}>Calles</button></div><div role="group" aria-label="Capas tridimensionales"><button type="button" aria-pressed={terrain} onClick={() => setTerrain(value => !value)}><Mountain aria-hidden="true" /> Relieve 3D</button><button type="button" aria-pressed={buildings} onClick={() => setBuildings(value => !value)}><Building2 aria-hidden="true" /> Edificios 3D</button></div></div>
        <TerrainExplorer point={point} events={mapEvents} onPick={choose} satellite={satellite} terrain={terrain} buildings={buildings} />
        <p className="terrain-map-caption">Arrastra para explorar; en móvil usa dos dedos. Los edificios se muestran al acercarte a escala de calle (zoom 15 o superior), según la cobertura de OSM. Sus alturas pueden ser aproximadas. Las líneas discontinuas son trazas tectónicas regionales.</p>
      </section>
    </div>

    {!point ? <section className="terrain-empty"><Ruler aria-hidden="true" /><h2>Tu ficha empieza en un punto.</h2><p>Elige una ubicación para consultar relieve, actividad sísmica cercana, referencias tectónicas y estudios pendientes.</p></section> : <section className="terrain-report" aria-labelledby="terrain-report-title">
      <div className="terrain-report-header"><div><p className="terrain-kicker">02 · Ficha del entorno</p><h2 id="terrain-report-title">{province ?? "Ubicación seleccionada"}</h2><p className="terrain-coordinate-display">{point.latitude.toFixed(5)}° N · {Math.abs(point.longitude).toFixed(5)}° O</p></div><div className="terrain-report-actions"><button type="button" onClick={download}><Download aria-hidden="true" /> Descargar ficha</button><button type="button" onClick={() => window.print()}><Printer aria-hidden="true" /> Imprimir / PDF</button></div></div>
      <div className="terrain-assessment-status"><strong>Evaluación preliminar incompleta</strong><p>Esta ficha reúne observaciones públicas. La aptitud constructiva requiere estudios del predio y revisión profesional. No asignamos porcentajes de seguridad ni una autorización para construir.</p></div>

      <div className="terrain-metrics">
        <article><p>Elevación aproximada</p><strong>{reading ? `${Math.round(reading.elevation)} m` : elevationState === "loading" ? "Consultando…" : "Sin dato"}</strong><small>AWS Terrain Tiles · modelo regional</small></article>
        <article><p>Pendiente regional</p><strong>{reading ? `${reading.slopeDegrees.toFixed(1)}°` : elevationState === "loading" ? "Consultando…" : "Sin dato"}</strong><small>{reading ? `${reading.slopePercent.toFixed(1)} % · ventana de 300 m` : "No sustituye la topografía del predio"}</small></article>
        <article><p>Sismos en {radius} km</p><strong>{statistics ? statistics.count : catalog.isFetching ? "Consultando…" : "Sin dato"}</strong><small>{statistics ? `Magnitud máxima ${fmtMag(statistics.maxMagnitude)}` : "Requiere al menos una fuente operativa"}</small></article>
        <article><p>Epicentro más cercano del catálogo</p><strong>{statistics?.closest ? `${statistics.closest.distanceKm.toFixed(1)} km` : statistics ? "Sin registros" : "Sin dato"}</strong><small>Distancia al epicentro; no mide amenaza</small></article>
      </div>
      {elevationState === "error" && <p className="terrain-error" role="status">{elevationError} La ficha continúa con la topografía pendiente.</p>}
      {(catalog.isError || catalog.data && !sourcesAvailable) && <p className="terrain-error" role="status">El catálogo sísmico no está disponible. Esto no significa que no hayan ocurrido sismos. Puedes seguir revisando el terreno y las fuentes.</p>}
      <p className="terrain-method-note">La pendiente se calcula a partir de cinco muestras de elevación en una ventana de 300 m, independiente de la inclinación de la cámara. No detecta cortes, muros, rellenos ni la estabilidad de una parcela. {catalog.data && <>Catálogo: {fmtDateTime(catalog.data.range.start)} — {fmtDateTime(catalog.data.range.end)} · hora de Panamá.</>}</p>

      <div className="terrain-evidence-grid"><article className="terrain-evidence"><h3>Referencia tectónica</h3>{fault && <><p className="terrain-evidence-name">{fault.name}</p><p>Traza cortical regional más cercana: {fault.distanceKm < 1 ? "menos de 1 km" : `aprox. ${Math.round(fault.distanceKm)} km`}.</p><p>No es una distancia predial ni establece una franja edificable. La cartografía local debe verificarse.</p><Link to="/monitor" search={{ fault: fault.id }}>Explorar la traza regional</Link></>}</article><article className="terrain-evidence"><h3>Amenaza publicada</h3><p className="terrain-evidence-name">Modelo GEM · consulta externa</p><p>El modelo global muestra PGA en roca con 10 % de probabilidad de excedencia en 50 años. No disponemos aquí de un valor PGA verificado para este punto.</p><a href="https://maps.openquake.org/map/gshm-v2026_1/" target="_blank" rel="noopener noreferrer">Consultar el visor oficial de GEM</a></article><article className="terrain-evidence"><h3>Información que falta</h3><ul><li>Geología y sondeos del predio</li><li>Nivel freático y licuefacción</li><li>Inundación y estabilidad de laderas</li><li>Microzonificación y uso de suelo</li></ul><a href="https://www.ipde.gob.pa/geoservicios/" target="_blank" rel="noopener noreferrer">Revisar fuentes oficiales de Panamá</a></article></div>

      <section className="terrain-next-steps" aria-labelledby="terrain-next-title"><div><p className="terrain-kicker">03 · Próximos pasos</p><h2 id="terrain-next-title">Qué solicitar antes de decidir.</h2><p>Prioridades de consulta para este punto, sin convertir observaciones regionales en un dictamen.</p></div><ol>{recommendations.map((recommendation, index) => <li key={recommendation.title}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{recommendation.title}</h3><p>{recommendation.body}</p></div></li>)}</ol><Link to="/savia" search={{ question: prompt }} className="terrain-savia-link"><Bot aria-hidden="true" /> Preparar una consulta con Savia</Link><p className="terrain-hint">Abrirá tu pregunta para revisarla. La IA no se ejecuta automáticamente al mover el mapa.</p></section>

      <details className="terrain-nearby"><summary>Registros sísmicos cercanos · {statistics?.count ?? "sin datos"}</summary>{statistics && statistics.count === 0 && <p>No hay registros en este radio y período. Esto no implica ausencia de amenaza sísmica.</p>}{statistics && statistics.count > 0 && <div className="savia-table-scroll" role="region" aria-label="Sismos cerca de la ubicación" tabIndex={0}><table className="savia-table"><caption>Hasta los 20 registros más recientes dentro del radio elegido</caption><thead><tr><th scope="col">Fecha · Panamá</th><th scope="col">Lugar</th><th scope="col">Magnitud</th><th scope="col">Distancia</th></tr></thead><tbody>{statistics.nearby.slice(0, 20).map(row => <tr key={row.event.id}><th scope="row">{fmtDateTime(row.event.primary.occurredAtUtc)}</th><td>{placeOf(row.event)}</td><td>{fmtMag(row.event.primary.magnitude)}</td><td>{row.distanceKm.toFixed(1)} km</td></tr>)}</tbody></table></div>}</details>
      <details className="terrain-sources"><summary>Fuentes, precisión y consumo de recursos</summary><ul><li><a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener noreferrer">AWS / Mapzen Terrain Tiles</a>: relieve global; resolución de origen variable. Lectura a zoom fijo 13, muestra de 300 m; no precisión topográfica certificada.</li><li><a href="https://openfreemap.org/" target="_blank" rel="noopener noreferrer">OpenFreeMap / OpenStreetMap</a>: edificios y calles; cobertura incompleta y alturas aproximadas. No es fotogrametría ni catastro.</li><li>Esri: imágenes satelitales y etiquetas, con la atribución del visor. Las imágenes pueden tener distinta antigüedad según la zona.</li><li>USGS y EMSC: catálogo compartido de Telúrica. Los cálculos de proximidad se realizan en tu navegador.</li><li>Las trazas tectónicas están simplificadas a escala regional. GEM se consulta en su visor; no se inventan valores locales.</li><li>La ficha y el relieve no requieren llamadas a la IA ni bases de datos adicionales. La elevación descarga solo las teselas necesarias y conserva una caché local acotada.</li></ul></details>
    </section>}
  </main>;
}
