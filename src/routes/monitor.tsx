import { FAULTS, PLATES } from "@/data/tectonics";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, ChevronUp, Layers, X } from "lucide-react";
import { SeismicMap, MagLegend, type MapLayers, type MapView } from "@/components/map/SeismicMap";
import { EventDetail, MagValue, PeriodSwitch, magBg } from "@/components/seismic/bits";
import { LiveBadge } from "@/components/seismic/live";
import { useSeismicPeriod } from "@/features/seismic/queries";
import { periodById, type PeriodId } from "@/features/seismic/periods";
import { fmtDate, fmtNum, fmtRelative, fmtTime, placeOf } from "@/features/seismic/format";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useRealtime } from "@/features/seismic/realtime";
import type { SourceReport, SeismicEvent } from "@/features/seismic/types";

export const Route = createFileRoute("/monitor")({
  head: () => ({
    meta: [
      { title: "Monitor en vivo · Telúrica" },
      { name: "description", content: "Mapa interactivo de los sismos reportados en Panamá y su zona marítima, actualizado cada minuto." },
      { property: "og:title", content: "Monitor sísmico en vivo de Panamá" },
      { property: "og:description", content: "Explore epicentros, magnitudes y profundidades sobre el mapa de Panamá." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { fault?: string; plate?: string; event?: string; lat?: number; lon?: number } => {
    const fault = FAULTS.find((item) => item.id === search["fault"]);
    const plate = PLATES.find((item) => item.id === search["plate"]);
    const event = search["event"];
    const lat = search["lat"];
    const lon = search["lon"];
    return {
      ...(fault && { fault: fault.id }),
      ...(plate && { plate: plate.id }),
      ...(typeof event === "string" && /^(usgs|emsc):[a-z0-9._-]{1,100}$/i.test(event) && { event }),
      ...(typeof lat === "number" && typeof lon === "number" && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && { lat, lon }),
    };
  },
  component: Monitor,
});

function Timeline({ events, start, end, selectedId, onSelect }: { events: SeismicEvent[]; start: number; end: number; selectedId: string | null; onSelect: (id: string) => void }) {
  const span = Math.max(1, end - start);
  const ticks = 6;
  return (
    <div className="relative h-28 px-4 pb-6 pt-3">
      <div className="relative h-full">
        {[0, 1, 2, 3].map((i) => <div key={i} className="absolute inset-x-0 border-t border-hairline" style={{ top: `${(i / 3) * 100}%` }} />)}
        {events.map((e) => {
          const x = ((Date.parse(e.primary.occurredAtUtc) - start) / span) * 100;
          const m = e.primary.magnitude ?? 0;
          const y = 100 - Math.min(1, Math.max(0, (m - 1) / 6)) * 100;
          return (
            <button key={e.id} type="button" onClick={() => onSelect(e.id)} aria-label={`M ${m.toFixed(1)} ${placeOf(e)} ${fmtDate(e.primary.occurredAtUtc)}`}
              className={cn("absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform hover:scale-150", magBg(e.primary.magnitude), selectedId === e.id && "scale-[2] ring-2 ring-foreground", e.classification === "maritima" && "opacity-70")}
              style={{ left: `${x}%`, top: `${y}%` }} />
          );
        })}
        <span className="absolute -left-1 top-0 -translate-x-full pr-1 meta">M7</span>
        <span className="absolute -left-1 bottom-0 -translate-x-full pr-1 meta">M1</span>
      </div>
      <div className="absolute inset-x-4 bottom-0 flex justify-between meta">
        {Array.from({ length: ticks }, (_, i) => <span key={i}>{fmtDate(new Date(start + (span * i) / (ticks - 1)).toISOString()).slice(0, 5)}</span>)}
      </div>
    </div>
  );
}

function Monitor() {
  const { fault, plate, event, lat, lon } = Route.useSearch();
  const navigate = useNavigate({ from: "/monitor" });
  const realtime = useRealtime();
  const focusedFault = FAULTS.find((item) => item.id === fault);
  const focusedPlate = PLATES.find((item) => item.id === plate);
  const [period, setPeriod] = useState<PeriodId>("30d");
  const [minMag, setMinMag] = useState(0);
  const [layers, setLayers] = useState<MapLayers>({ panama: true, maritima: true, provinces: true });
  const [view, setView] = useState<MapView>({ basemap: "satellite", terrain: false, faults: true, columns: false, heat: false });
  const toggleView = (k: Exclude<keyof MapView, "basemap">) => setView((v) => ({ ...v, [k]: !v[k] }));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(!event);
  const [toolsOpen, setToolsOpen] = useState(!event);
  const { data, isLoading, isError, isFetching } = useSeismicPeriod(period);
  useEffect(() => { if (window.innerWidth < 768) setToolsOpen(false); }, []);

  const events = useMemo(() => (data?.events ?? []).filter((e) => minMag === 0 || (e.primary.magnitude ?? -1) >= minMag), [data, minMag]);
  const visible = events.filter((e) => (e.classification === "panama" ? layers.panama : layers.maritima));
  const latest = visible[0];
  const linkMatch = event ? data?.events.find((item) => item.id === event ||
    item.reports.some((report) => `${report.sourceId}:${report.externalId}` === event)) : undefined;
  const preliminary = event && !linkMatch ? realtime.events.find((item) => item.key === event) : undefined;
  const preliminaryEvent = useMemo<SeismicEvent | undefined>(() => {
    if (!preliminary) return undefined;
    const report: SourceReport = {
      sourceId: preliminary.key.startsWith("usgs:") ? "usgs" : "emsc",
      externalId: preliminary.key.split(":")[1] ?? "",
      latitude: preliminary.latitude, longitude: preliminary.longitude,
      magnitude: preliminary.magnitude, magnitudeType: preliminary.magnitudeType,
      depthKm: preliminary.depthKm, occurredAtUtc: preliminary.occurredAtUtc,
      updatedAt: null, placeReported: preliminary.place, reviewStatus: null, author: null, sourceUrl: preliminary.url,
    };
    return { id: preliminary.key, primary: report, reports: [report], classification: preliminary.classification,
      province: preliminary.province, nearestProvince: null, receivedAt: preliminary.receivedAt };
  }, [preliminary]);
  const selected = event ? linkMatch ?? preliminaryEvent : data?.events.find((item) => item.id === selectedId);
  const mapEvents = useMemo(() => selected && !events.some((item) => item.id === selected.id) ? [...events, selected] : events, [events, selected]);
  const epicenter = useMemo<[number, number] | undefined>(() =>
    event && !selected && lat != null && lon != null ? [lon, lat] : undefined, [event, selected, lat, lon]);
  const selectEvent = (id: string | null) => {
    setSelectedId(id);
    if (event) void navigate({ search: {}, replace: true });
  };
  useEffect(() => {
    if (!event) return;
    setSelectedId(null);
    setToolsOpen(false);
    setTimelineOpen(false);
  }, [event]);
  const start = data ? Date.parse(data.range.start) : Date.now() - 86400_000;
  const end = data ? Date.parse(data.range.end) : Date.now();

  return (
    <main className="relative h-[calc(100dvh-3.5rem)] overflow-hidden">
      <SeismicMap {...(focusedFault && { focusedFault })} {...(focusedPlate && { focusedPlate })} events={mapEvents} layers={layers} view={view} selectedId={selected?.id ?? null} onSelect={selectEvent} {...(epicenter && { epicenter })} className="absolute inset-0" padding={{ top: 60, bottom: 160, left: 340, right: 60 }} />

      {/* Herramientas contextuales */}
      <div className="glass absolute left-3 top-3 z-10 w-[min(320px,calc(100%-1.5rem))] rounded-xl border border-hairline shadow-float">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <div className="flex items-center gap-2"><h1 className="font-display text-xl leading-none">Monitor</h1><LiveBadge compact /></div>
            <p className="mt-1 meta">
              {isLoading ? "Consultando fuentes…" : isError ? "Error al consultar las fuentes" : data ? `${fmtNum(visible.length)} eventos · ${periodById(period).long}` : ""}
              {isFetching && !isLoading && " · actualizando"}
            </p>
          </div>
          <button type="button" onClick={() => setToolsOpen((v) => !v)} className="rounded-sm p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" aria-expanded={toolsOpen} aria-label="Mostrar u ocultar herramientas">
            <Layers className="size-4" />
          </button>
        </div>
        {toolsOpen && (
          <div className="space-y-5 border-t border-hairline px-4 py-4">
            <PeriodSwitch value={period} onChange={setPeriod} options={["24h", "7d", "30d", "90d"]} />
            <div>
              <div className="flex justify-between text-sm"><label htmlFor="minmag">Magnitud mínima</label><span className="num font-mono">{minMag === 0 ? "Todas" : `≥ ${minMag.toFixed(1)}`}</span></div>
              <Slider id="minmag" className="mt-3" min={0} max={6} step={0.5} value={[minMag]} onValueChange={(v) => setMinMag(v[0] ?? 0)} aria-label="Magnitud mínima" />
            </div>
            <div className="space-y-2">
              <div className="meta">Vista</div>
              <div className="inline-flex rounded-lg border border-border bg-surface p-0.5" role="radiogroup" aria-label="Mapa base">
                {([["satellite", "Satélite"], ["dark", "Oscuro"]] as const).map(([k, l]) => (
                  <button key={k} type="button" role="radio" aria-checked={view.basemap === k} onClick={() => setView((v) => ({ ...v, basemap: k }))}
                    className="rounded-md px-3 py-1 text-xs text-muted-foreground transition-colors aria-checked:bg-accent aria-checked:text-foreground">{l}</button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {([["terrain", "Relieve 3D"], ["faults", "Fallas"], ["columns", "Columnas"], ["heat", "Calor"]] as const).map(([k, l]) => (
                  <button key={k} type="button" aria-pressed={view[k]} onClick={() => toggleView(k)}
                    className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground aria-pressed:border-primary/50 aria-pressed:bg-primary/15 aria-pressed:text-primary">{l}</button>
                ))}
              </div>
            </div>
            <fieldset className="space-y-2.5 text-sm">
              <legend className="meta mb-2">Capas</legend>
              {([["panama", "Epicentros en territorio panameño"], ["maritima", "Epicentros en zona marítima próxima"], ["provinces", "Límites de provincias y comarcas"]] as const).map(([k, label]) => (
                <label key={k} className="flex items-center justify-between gap-3">
                  <span>{label}</span>
                  <Switch checked={layers[k]} onCheckedChange={(v) => setLayers((l) => ({ ...l, [k]: v }))} />
                </label>
              ))}
            </fieldset>
            <MagLegend />
            {data && <p className="meta">Sincronizado {fmtTime(data.generatedAt)} · {fmtRelative(data.generatedAt)}. Se sincroniza cada 60 s y al instante cuando EMSC/USGS publican un sismo nuevo.</p>}
          </div>
        )}
      </div>

      {/* Panel de detalle */}
      <AnimatePresence>
        {(selected || epicenter) && (
          <motion.aside key="detail" initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }} transition={{ duration: 0.25 }}
            className="absolute bottom-[calc(4.4rem+env(safe-area-inset-bottom))] right-0 z-20 max-h-[44dvh] w-full overflow-y-auto border-t lg:top-0 lg:max-h-none lg:max-w-sm lg:border-l border-hairline bg-background/95 p-6 backdrop-blur-md lg:bottom-0" aria-label="Detalle del evento">
            <button type="button" onClick={() => selectEvent(null)} className="absolute right-4 top-4 rounded-sm p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Cerrar detalle">
              <X className="size-4" />
            </button>
            {preliminaryEvent && <p className="meta mb-3">Detección preliminar</p>}
            {selected ? <EventDetail e={selected} /> : epicenter && (
              <div className="space-y-3 pr-8">
                <h2 className="font-display text-xl">Epicentro del sismo</h2>
                <p className="font-mono text-sm">{epicenter[1].toFixed(4)}°, {epicenter[0].toFixed(4)}°</p>
                <p className="text-sm text-muted-foreground">{isLoading ? "Consultando la ficha del catálogo…" : "La ficha todavía no está disponible en el catálogo."}</p>
              </div>
            )}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Cronología */}
      <div className={cn("glass absolute bottom-[calc(4.4rem+env(safe-area-inset-bottom))] left-0 z-10 border-t border-hairline lg:bottom-0", selected ? "right-0 lg:right-96" : "right-0")}>
        <button type="button" onClick={() => setTimelineOpen((v) => !v)} className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-accent/40" aria-expanded={timelineOpen}>
          <span className="flex items-center gap-3"><span className="font-display">Cronología</span><span className="meta">magnitud en el tiempo · clic para ubicar</span></span>
          {timelineOpen ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
        </button>
        {timelineOpen && (visible.length ? <Timeline events={visible} start={start} end={end} selectedId={selected?.id ?? null} onSelect={selectEvent} /> : <p className="px-4 pb-4 text-sm text-muted-foreground">{isLoading ? "Cargando…" : "Sin eventos con los filtros actuales."}</p>)}
        {timelineOpen && latest && (
          <div className="flex items-center gap-2 border-t border-hairline px-4 py-2 text-sm">
            <span className="meta">Último:</span>
            <button type="button" onClick={() => selectEvent(latest.id)} className="truncate hover:text-primary">
              <MagValue m={latest.primary.magnitude} /> · {placeOf(latest)} · {fmtDate(latest.primary.occurredAtUtc)} {fmtTime(latest.primary.occurredAtUtc)}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
