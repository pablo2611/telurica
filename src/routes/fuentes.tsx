import { createFileRoute } from "@tanstack/react-router";
import { forwardRef, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { AnimatedBeam } from "@/components/ui/animated-beam";
import { StateDot } from "@/components/seismic/bits";
import { useSeismicPeriod, syncLogQuery, tsunamiQuery } from "@/features/seismic/queries";
import { SOURCE_LABEL, fmtDate, fmtNum, fmtRelative, fmtTime } from "@/features/seismic/format";
import { DEFAULT_TOLERANCE } from "@/features/seismic/dedupe";
import { MARITIME_BUFFER_KM } from "@/features/seismic/geo";
import { cssColor } from "@/lib/css-color";
import { useHydrated } from "@/hooks/use-hydrated";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/fuentes")({
  head: () => ({
    meta: [
      { title: "Fuentes y sincronización · Telúrica" },
      { name: "description", content: "Estado real de USGS, EMSC, NOAA y fuentes nacionales, con el flujo de procesamiento y el registro de consultas." },
      { property: "og:title", content: "Procedencia de los datos sísmicos" },
      { property: "og:description", content: "Transparencia sobre fuentes, normalización, filtro geográfico y deduplicación." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Fuentes,
});

const Node = forwardRef<HTMLDivElement, { label: string; sub: string; className?: string }>(({ label, sub, className }, ref) => (
  <div ref={ref} className={cn("relative z-10 w-full max-w-[11rem] rounded-sm border border-border bg-surface-raised px-3 py-2.5", className)}>
    <div className="text-sm font-medium">{label}</div>
    <div className="meta mt-0.5">{sub}</div>
  </div>
));
Node.displayName = "Node";

function Pipeline() {
  const container = useRef<HTMLDivElement>(null);
  const usgs = useRef<HTMLDivElement>(null);
  const emsc = useRef<HTMLDivElement>(null);
  const norm = useRef<HTMLDivElement>(null);
  const geo = useRef<HTMLDivElement>(null);
  const dedupe = useRef<HTMLDivElement>(null);
  const cache = useRef<HTMLDivElement>(null);
  const ui = useRef<HTMLDivElement>(null);
  const hydrated = useHydrated();
  const beam = hydrated ? { pathColor: cssColor("--foreground"), pathOpacity: 0.15, gradientStartColor: cssColor("--primary"), gradientStopColor: cssColor("--chart-3"), duration: 4 } : null;
  return (
    <div ref={container} className="relative grid grid-cols-2 gap-x-6 gap-y-8 py-6 md:grid-cols-6 md:items-center">
      <div className="flex flex-col gap-6 md:col-span-1">
        <Node ref={usgs} label="USGS" sub="FDSN · GeoJSON" />
        <Node ref={emsc} label="EMSC" sub="FDSN · JSON" />
      </div>
      <Node ref={norm} label="Adaptadores" sub="validación Zod + normalización" />
      <Node ref={geo} label="Filtro geográfico" sub={`territorio + ${MARITIME_BUFFER_KM} km mar`} />
      <Node ref={dedupe} label="Deduplicación" sub={`≤${DEFAULT_TOLERANCE.maxSeconds} s · ≤${DEFAULT_TOLERANCE.maxKm} km`} />
      <Node ref={cache} label="Caché del servidor" sub="60 s · consulta única" />
      <Node ref={ui} label="Visualización" sub="mapa · archivo · análisis" />
      {beam && (
        <>
          <AnimatedBeam containerRef={container} fromRef={usgs} toRef={norm} {...beam} />
          <AnimatedBeam containerRef={container} fromRef={emsc} toRef={norm} {...beam} delay={0.4} />
          <AnimatedBeam containerRef={container} fromRef={norm} toRef={geo} {...beam} delay={0.8} />
          <AnimatedBeam containerRef={container} fromRef={geo} toRef={dedupe} {...beam} delay={1.2} />
          <AnimatedBeam containerRef={container} fromRef={dedupe} toRef={cache} {...beam} delay={1.6} />
          <AnimatedBeam containerRef={container} fromRef={cache} toRef={ui} {...beam} delay={2} />
        </>
      )}
    </div>
  );
}

function Fuentes() {
  const { data, isLoading, isError, error } = useSeismicPeriod("7d");
  const tsunami = useQuery(tsunamiQuery);
  const log = useQuery(syncLogQuery);
  const sources = [...(data?.sources ?? []), ...(tsunami.data ? [tsunami.data.source] : [])].sort((a, b) => {
    const order = ["usgs", "emsc", "noaa", "up", "sinaproc"];
    return order.indexOf(a.id) - order.indexOf(b.id);
  });

  return (
    <main className="pb-20">
      <header className="mx-auto max-w-[1600px] px-4 pt-12 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6 border-b border-hairline pb-8">
          <h1 className="font-display text-4xl leading-none sm:text-6xl">Procedencia<span className="text-primary">.</span></h1>
          <p className="max-w-lg text-muted-foreground">Qué se consulta, cómo se procesa y en qué estado está cada fuente en este momento. Ningún estado se marca como operativo sin una respuesta real.</p>
        </div>
      </header>

      <section className="mx-auto max-w-[1600px] px-4 pt-10 lg:px-8" aria-label="Flujo de datos">
        <h2 className="meta">Flujo de datos</h2>
        <Pipeline />
        <p className="max-w-3xl text-sm text-muted-foreground">
          El servidor centraliza las consultas: todos los visitantes comparten la misma respuesta durante 60 segundos, por lo que las fuentes no reciben una petición por cada navegador. No hay base de datos propia: el historial se consulta directamente en los catálogos de las agencias, que conservan sus registros.
        </p>
      </section>

      <section className="mx-auto mt-14 max-w-[1600px] px-4 lg:px-8" aria-label="Estado de las fuentes">
        <h2 className="font-display text-3xl">Estado de las fuentes</h2>
        {isLoading && <p className="mt-4 meta">Consultando fuentes…</p>}
        {isError && <p className="mt-4 text-destructive">Error de sincronización: {(error as Error).message}</p>}
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-foreground/30 meta">
              <tr><th className="py-2 pr-4 font-normal">Fuente</th><th className="pr-4 font-normal">Estado</th><th className="pr-4 font-normal">Servicio / método</th><th className="pr-4 font-normal">Última respuesta correcta</th><th className="pr-4 font-normal">Duración</th><th className="pr-4 font-normal">Registros</th><th className="font-normal">Detalle</th></tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.id} className="border-b border-hairline align-top">
                  <td className="py-3 pr-4"><a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-primary">{s.name}<ExternalLink className="size-3" /></a></td>
                  <td className="pr-4 py-3"><StateDot state={s.state} /></td>
                  <td className="pr-4 py-3 text-muted-foreground">{s.serviceType}<br /><span className="meta">{s.method}</span></td>
                  <td className="pr-4 py-3 num font-mono text-xs">{s.lastSuccessAt ? <>{fmtDate(s.lastSuccessAt)} {fmtTime(s.lastSuccessAt, true)}<br /><span className="text-muted-foreground">{fmtRelative(s.lastSuccessAt)}</span></> : "—"}</td>
                  <td className="pr-4 py-3 num font-mono text-xs">{s.durationMs != null ? `${fmtNum(s.durationMs)} ms` : "—"}</td>
                  <td className="pr-4 py-3 num font-mono text-xs">{s.received != null ? fmtNum(s.received) : "—"}</td>
                  <td className="py-3 text-xs text-muted-foreground">{s.error ? <span className="text-destructive">{s.error}</span> : s.note ?? (s.id === "noaa" ? "Boletines leídos de los canales Atom" : "Consulta de los últimos 7 días en el recuadro del istmo")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mx-auto mt-16 grid max-w-[1600px] gap-14 px-4 lg:grid-cols-2 lg:px-8">
        <div>
          <h2 className="font-display text-3xl">Registro de sincronización</h2>
          <p className="mt-1 text-sm text-muted-foreground">Intentos de consulta de esta instancia del servidor desde su último arranque.</p>
          <ol className="mt-6 max-h-[28rem] overflow-y-auto border-t border-hairline font-mono text-xs">
            {(log.data?.entries ?? []).map((e, i) => (
              <li key={`${e.at}${e.sourceId}${i}`} className="grid grid-cols-[9.5rem_4rem_1fr_auto] gap-3 border-b border-hairline py-2">
                <span className="text-muted-foreground">{fmtDate(e.at)} {fmtTime(e.at, true)}</span>
                <span>{SOURCE_LABEL[e.sourceId] ?? e.sourceId}</span>
                <span className={e.ok ? "text-ok" : "text-destructive"}>{e.ok ? `OK · ${fmtNum(e.received)} registros` : e.error}</span>
                <span className="text-muted-foreground">{fmtNum(e.durationMs)} ms</span>
              </li>
            ))}
            {log.data && !log.data.entries.length && <li className="py-4 text-muted-foreground">Sin intentos registrados todavía.</li>}
          </ol>
        </div>
        <div>
          <h2 className="font-display text-3xl">Boletines de tsunami (NOAA)</h2>
          <p className="mt-1 text-sm text-muted-foreground">Último contenido publicado por los centros de alerta. Se muestra tal cual; no se deduce ningún aviso a partir de la magnitud.</p>
          {tsunami.isLoading && <p className="mt-6 meta">Consultando NOAA…</p>}
          {tsunami.data && !tsunami.data.bulletins.length && <p className="mt-6 text-muted-foreground">No hay boletines publicados en los canales consultados.</p>}
          <ul className="mt-6 space-y-5">
            {(tsunami.data?.bulletins ?? []).map((b) => (
              <li key={b.id} className="border-l-2 border-primary/50 pl-4">
                <div className="meta">{b.center} · {b.updated ? `${fmtDate(b.updated)} ${fmtTime(b.updated)}` : "fecha no informada"}</div>
                <div className="mt-1 font-medium">{b.title}</div>
                {b.summary && <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{b.summary}</p>}
                {b.link && <a href={b.link} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-sm text-primary hover:underline">Boletín original <ExternalLink className="size-3" /></a>}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
