import { ImpactAndNews } from "@/components/seismic/ImpactAndNews";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight, BellRing, Database, Layers3, ShieldAlert, Waves } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { SeismicMap, MagLegend } from "@/components/map/SeismicMap";
import { MagValue, StateDot, ZoneTag } from "@/components/seismic/bits";
import { LiveBadge, LiveFeed, useTick } from "@/components/seismic/live";
import { BlurText, CountUp, DecryptedText, GradientText, SeismoWaves, ShinyText, SpotlightCard, StarBorder } from "@/components/reactbits";
import { useSeismicPeriod } from "@/features/seismic/queries";
import { useRealtime } from "@/features/seismic/realtime";
import { summarize } from "@/features/seismic/stats";
import { SOURCE_LABEL, fmtDate, fmtDepth, fmtNum, fmtRelative, fmtTime, placeOf } from "@/features/seismic/format";
import { MARITIME_BUFFER_KM } from "@/features/seismic/geo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/resumen")({
  head: () => ({
    meta: [
      { title: "Resumen en vivo · Telúrica" },
      { name: "description", content: "Sismos en Panamá en tiempo real: detecciones en vivo de EMSC y USGS, mapa y registro de los últimos 30 días." },
      { property: "og:title", content: "Sismos en Panamá en tiempo real" },
      { property: "og:description", content: "Detecciones en vivo, mapa y últimos sismos reportados por USGS y EMSC en Panamá." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Resumen,
});

function Stat({ label, children, foot, className }: { label: string; children: React.ReactNode; foot?: React.ReactNode; className?: string }) {
  return (
    <SpotlightCard className={cn("p-5 sm:p-6", className)}>
      <p className="meta uppercase">{label}</p>
      <div className="mt-3 font-display text-4xl leading-none sm:text-5xl">{children}</div>
      {foot && <div className="mt-3 text-sm text-muted-foreground">{foot}</div>}
    </SpotlightCard>
  );
}

function Resumen() {
  const { data, isLoading, isError, error } = useSeismicPeriod("30d");
  const rt = useRealtime();
  useTick(30_000);
  const events = data?.events ?? [];
  const s = summarize(events);
  const recent = events.slice(0, 8);
  const latest = events[0];
  const freshCount = rt.events.filter((e) => e.fresh).length;

  return (
    <main>
      {/* ───────── HERO ───────── */}
      <AuroraBackground className="border-b border-hairline">
        <SeismoWaves className="opacity-70 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" intensity={Math.min(1, freshCount / 3)} />
        <section className="relative mx-auto grid max-w-[1600px] gap-10 px-4 pb-12 pt-10 sm:pt-14 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-14 lg:px-8 lg:pb-16 lg:pt-20">
          <div className="flex flex-col justify-center">
            <div className="flex flex-wrap items-center gap-3">
              <LiveBadge />
              <DecryptedText text="8°59′N · 79°31′O" className="font-mono text-xs tracking-[0.25em] text-primary" />
            </div>

            <h1 className="mt-6 font-display text-[2.6rem] font-light leading-[0.98] sm:text-6xl xl:text-[5.25rem]">
              <BlurText text="Sismos en Panamá," className="block" />
              <BlurText text="en tiempo real." className="block" delay={0.25} wordClassName="rb-gradient-text italic" />
            </h1>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Escuchamos el canal en vivo de <span className="text-foreground">EMSC</span> y el feed de <span className="text-foreground">USGS</span>, filtramos al
              territorio nacional y a {MARITIME_BUFFER_KM} km de mar, y te avisamos en segundos.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/monitor" className="group">
                <StarBorder innerClassName="text-sm font-medium group-hover:bg-accent/60">
                  Abrir monitor en vivo <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </StarBorder>
              </Link>
              <Link
                to="/alertas"
                className="inline-flex items-center gap-2 rounded-lg border border-hairline px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                <BellRing className="size-4" /> Activar alertas
              </Link>
            </div>

            <div className="mt-8 min-h-[3rem]">
              {isLoading && <ShinyText className="meta">Consultando USGS y EMSC…</ShinyText>}
              {isError && <p className="text-sm text-destructive">No se pudieron consultar las fuentes: {(error as Error).message}</p>}
              {data && (
                <div className="flex flex-wrap gap-x-5 gap-y-2 meta">
                  {data.sources
                    .filter((x) => x.id === "usgs" || x.id === "emsc")
                    .map((src) => (
                      <span key={src.id} className="flex items-center gap-2">
                        <StateDot state={src.state} withLabel={false} />
                        {SOURCE_LABEL[src.id]} · {src.received ?? "—"} registros
                      </span>
                    ))}
                  <span>
                    Sincronizado {fmtTime(data.generatedAt)} ({fmtRelative(data.generatedAt)})
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Panel en vivo */}
          <SpotlightCard className="flex flex-col self-start bg-surface/80">
            <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-4">
              <div>
                <h2 className="font-display text-xl leading-none">Detecciones en vivo</h2>
                <p className="mt-1.5 meta">Panamá y su zona marítima</p>
              </div>
              <Waves className="size-5 text-primary" aria-hidden="true" />
            </div>
            <LiveFeed catalog={events} loading={isLoading} unavailable={isError || !!data?.sources.filter((source) => source.id === "usgs" || source.id === "emsc").every((source) => source.received === null)} />
            <div className="flex items-center justify-between gap-2 border-t border-hairline px-5 py-3 meta">
              <span>{rt.lastPollAt ? `USGS ${rt.lastPollOk ? "operativo" : "sin respuesta"} · ${fmtTime(rt.lastPollAt, true)}` : "USGS pendiente"}</span>
              <span>{rt.ws === "open" ? "EMSC conectado" : rt.ws === "reconnecting" ? "EMSC reconectando" : "EMSC pendiente"}</span>
            </div>
          </SpotlightCard>
        </section>
      </AuroraBackground>

      {/* ───────── CIFRAS ───────── */}
      <section className="mx-auto max-w-[1600px] px-4 pt-10 lg:px-8 lg:pt-14" aria-labelledby="cifras">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="cifras" className="font-display text-2xl sm:text-3xl">Últimos 30 días</h2>
          <Link to="/analisis" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            Ver análisis <ArrowUpRight className="size-4" />
          </Link>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <Stat label="Sismos reportados" foot={data ? `${fmtNum(s.multiSource)} con más de una agencia` : "—"}>
            {data ? <CountUp to={s.total} /> : "—"}
          </Stat>
          <Stat label="En territorio" foot="Epicentro dentro del límite nacional">
            {data ? <CountUp to={s.panama} /> : "—"}
          </Stat>
          <Stat label="Zona marítima" foot={`Hasta ${MARITIME_BUFFER_KM} km de la costa`}>
            {data ? <CountUp to={s.maritima} className="text-primary" /> : "—"}
          </Stat>
          <Stat
            label="Mayor magnitud"
            foot={s.strongest ? `${fmtDate(s.strongest.primary.occurredAtUtc)} · ${s.strongest.classification === "maritima" ? `mar, frente a ${s.strongest.nearestProvince ?? "Panamá"}` : placeOf(s.strongest)}` : "—"}
          >
            {s.maxMag != null ? <MagValue m={s.maxMag} /> : "—"}
          </Stat>
        </div>
        {latest && (
          <p className="mt-4 text-sm text-muted-foreground">
            Último sismo confirmado: <MagValue m={latest.primary.magnitude} /> · {placeOf(latest)} · {fmtRelative(latest.primary.occurredAtUtc)}
          </p>
        )}
      </section>

      {/* ───────── MAPA + REGISTRO ───────── */}
      <section className="mx-auto grid max-w-[1600px] gap-6 px-4 py-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:px-8 lg:py-14">
        <div className="relative min-h-[380px] overflow-hidden rounded-xl border border-hairline sm:min-h-[480px] lg:min-h-[600px]">
          <SeismicMap events={events} interactive={false} view={{ basemap: "satellite", terrain: false, faults: true }} className="absolute inset-0" padding={{ top: 30, bottom: 30, left: 30, right: 30 }} />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-3 p-3 sm:p-4">
            <MagLegend className="pointer-events-auto rounded-lg glass px-3 py-2" />
            <Link
              to="/monitor"
              className="pointer-events-auto inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-float hover:bg-primary/90"
            >
              Explorar mapa <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>

        <div className="flex flex-col">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-display text-2xl sm:text-3xl">Registro reciente</h2>
            <Link to="/historial" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
              Archivo <ArrowUpRight className="size-4" />
            </Link>
          </div>
          {data && recent.length === 0 && <p className="mt-6 text-muted-foreground">Sin eventos en los últimos 30 días.</p>}
          {isLoading && (
            <ul className="mt-6 space-y-2" aria-hidden="true">
              {Array.from({ length: 6 }, (_, i) => (
                <li key={i} className="h-16 animate-pulse rounded-lg bg-surface" />
              ))}
            </ul>
          )}
          <ol className="mt-6 space-y-2">
            <AnimatePresence initial={false}>
              {recent.map((e, i) => (
                <motion.li
                  key={e.id}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: i * 0.03 } }}
                  exit={{ opacity: 0 }}
                  className="grid grid-cols-[1fr_auto] items-center gap-4 rounded-lg border border-hairline bg-surface/50 px-4 py-3 transition-colors hover:border-primary/30"
                >
                  <span className="min-w-0">
                    <span className="block truncate">{placeOf(e)}</span>
                    <span className="meta flex flex-wrap items-center gap-x-2">
                      <span className="num">
                        {fmtDate(e.primary.occurredAtUtc)} {fmtTime(e.primary.occurredAtUtc)}
                      </span>
                      <span>· {fmtDepth(e.primary.depthKm)}</span>
                      <span className="hidden sm:inline">· {e.reports.map((r) => SOURCE_LABEL[r.sourceId]).join(" + ")}</span>
                      <span className="hidden sm:inline">
                        · <ZoneTag e={e} />
                      </span>
                    </span>
                  </span>
                  <MagValue m={e.primary.magnitude} className="text-2xl" />
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
        </div>
      </section>

      {/* ───────── METODOLOGÍA ───────── */}
      <section className="border-t border-hairline contour-bg">
        <div className="mx-auto max-w-[1600px] px-4 py-14 lg:px-8 lg:py-20">
          <h2 className="max-w-xl font-display text-3xl leading-tight sm:text-4xl">
            Datos abiertos, <GradientText>sin adornos.</GradientText>
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Waves,
                title: "En vivo",
                body: "EMSC empuja cada sismo nuevo por WebSocket y USGS se consulta cada 30 s. Al detectar uno cerca de Panamá, el servidor sincroniza al instante.",
              },
              {
                icon: Layers3,
                title: "Cobertura",
                body: `Solo cuenta como panameño lo que cae dentro del límite nacional (geoBoundaries). El mar hasta ${MARITIME_BUFFER_KM} km se muestra aparte${data ? `; ${fmtNum(data.excludedOutside)} eventos externos descartados` : ""}.`,
              },
              {
                icon: Database,
                title: "Sin duplicados",
                body: "Si dos agencias reportan el mismo sismo se agrupan conservando ambas mediciones y su enlace al reporte original.",
              },
              {
                icon: ShieldAlert,
                title: "Límites",
                body: "No predecimos sismos. Ante una emergencia siga a SINAPROC y al Instituto de Geociencias de la Universidad de Panamá.",
              },
            ].map(({ icon: Icon, title, body }) => (
              <SpotlightCard key={title} className="p-6">
                <Icon className="size-5 text-primary" aria-hidden="true" />
                <h3 className="mt-4 font-display text-xl">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </SpotlightCard>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Link to="/fuentes" className="inline-flex items-center gap-2 text-primary hover:underline">
              Estado de las fuentes <ArrowRight className="size-4" />
            </Link>
            <a className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground" href="https://www.sinaproc.gob.pa/alertas/" target="_blank" rel="noreferrer">
              SINAPROC <ArrowUpRight className="size-4" />
            </a>
            <a className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground" href="https://sismosgeociencias.up.ac.pa/" target="_blank" rel="noreferrer">
              Instituto de Geociencias <ArrowUpRight className="size-4" />
            </a>
          </div>
        </div>
      </section>
      <ImpactAndNews events={events} loading={isLoading} />
    </main>
  );
}
