import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import { Download } from "lucide-react";
import { AnimatedGridPattern } from "@/components/ui/animated-grid-pattern";
import { NumberTicker } from "@/components/ui/number-ticker";
import { Button } from "@/components/ui/button";
import { EChart } from "@/components/charts/EChart";
import { baseChart } from "@/components/charts/theme";
import { PeriodSwitch } from "@/components/seismic/bits";
import { useSeismicPeriod, useSeismicRange } from "@/features/seismic/queries";
import { periodById, periodStart, type PeriodId } from "@/features/seismic/periods";
import { byProvince, countByDay, histogram, summarize } from "@/features/seismic/stats";
import { fmtNum } from "@/features/seismic/format";
import { exportEvents } from "@/features/seismic/export";
import { cssColor } from "@/lib/css-color";
import { useHydrated } from "@/hooks/use-hydrated";

export const Route = createFileRoute("/analisis")({
  head: () => ({
    meta: [
      { title: "Análisis · Telúrica" },
      { name: "description", content: "Actividad sísmica de Panamá por día, magnitud, profundidad y provincia, calculada con datos de USGS y EMSC." },
      { property: "og:title", content: "Laboratorio de datos sísmicos de Panamá" },
      { property: "og:description", content: "Series temporales y distribuciones de sismos en Panamá y su zona marítima." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Analisis,
});

const MAG_EDGES = [0, 2, 3, 4, 5, 6, 10];
const MAG_LABELS = ["< 2", "2–2.9", "3–3.9", "4–4.9", "5–5.9", "≥ 6"];
const DEPTH_EDGES = [0, 10, 30, 70, 150, 300, 800];
const DEPTH_LABELS = ["0–10", "10–30", "30–70", "70–150", "150–300", "> 300"];

function delta(cur: number, prev: number | undefined) {
  if (prev == null) return null;
  if (prev === 0) return cur === 0 ? "sin cambio" : "sin registros previos";
  const d = ((cur - prev) / prev) * 100;
  return `${d > 0 ? "+" : ""}${fmtNum(d, 0)} % vs. período anterior`;
}

function Analisis() {
  const [period, setPeriod] = useState<PeriodId>("30d");
  const hydrated = useHydrated();
  const { data, isLoading, isError, error } = useSeismicPeriod(period);
  const days = periodById(period).days;
  const curStart = periodStart(period);
  const prevStart = new Date(Date.parse(curStart) - days * 86400_000).toISOString();
  const prev = useSeismicRange(prevStart, curStart);
  const events = data?.events ?? [];
  const s = summarize(events);
  const ps = prev.data ? summarize(prev.data.events) : undefined;

  const options = useMemo(() => {
    if (!hydrated || !data) return null;
    const b = baseChart();
    const daily = countByDay(events, data.range.start, data.range.end);
    const timeline: EChartsOption = {
      textStyle: b.textStyle, tooltip: { ...b.tooltip, trigger: "axis" }, legend: { ...b.legend, top: 0, right: 0 },
      grid: { left: 44, right: 12, top: 36, bottom: 40 },
      xAxis: { type: "category", data: daily.map((d) => d.day.split("-").reverse().slice(0, 2).join("/")), ...b.axis, splitLine: { show: false } },
      yAxis: { type: "value", name: "eventos", minInterval: 1, ...b.axis },
      ...(days > 60 ? { dataZoom: [{ type: "inside" as const }, { type: "slider" as const, height: 16, bottom: 6, textStyle: { color: b.text }, borderColor: "transparent" }] } : {}),
      series: [
        { name: "Territorio panameño", type: "bar", stack: "t", data: daily.map((d) => d.panama), itemStyle: { color: cssColor("--chart-1") }, barMaxWidth: 18 },
        { name: "Zona marítima", type: "bar", stack: "t", data: daily.map((d) => d.maritima), itemStyle: { color: cssColor("--chart-4") }, barMaxWidth: 18 },
      ],
    };
    const mags = events.map((e) => e.primary.magnitude).filter((m): m is number => m != null);
    const magH = histogram(mags, MAG_EDGES);
    const magColors = ["--mag-1", "--mag-1", "--mag-2", "--mag-3", "--mag-4", "--mag-5"].map((t) => cssColor(t));
    const magChart: EChartsOption = {
      textStyle: b.textStyle, tooltip: { ...b.tooltip, trigger: "axis" }, grid: { left: 40, right: 8, top: 16, bottom: 44 },
      xAxis: { type: "category", data: MAG_LABELS, name: "magnitud", nameLocation: "middle", nameGap: 30, ...b.axis, splitLine: { show: false } },
      yAxis: { type: "value", minInterval: 1, ...b.axis },
      series: [{ type: "bar", name: "Eventos", data: magH.map((v, i) => ({ value: v, itemStyle: { color: magColors[i] ?? b.text } })), barWidth: "62%" }],
    };
    const depths = events.map((e) => e.primary.depthKm).filter((d): d is number => d != null);
    const depthH = histogram(depths, DEPTH_EDGES);
    const depthChart: EChartsOption = {
      textStyle: b.textStyle, tooltip: { ...b.tooltip, trigger: "axis" }, grid: { left: 64, right: 16, top: 16, bottom: 30 },
      yAxis: { type: "category", inverse: true, data: DEPTH_LABELS, name: "km", ...b.axis, splitLine: { show: false } },
      xAxis: { type: "value", minInterval: 1, ...b.axis },
      series: [{ type: "bar", name: "Eventos", data: depthH, itemStyle: { color: cssColor("--chart-3") }, barWidth: "58%" }],
    };
    const prov = byProvince(events);
    const provChart: EChartsOption = {
      textStyle: b.textStyle, tooltip: { ...b.tooltip, trigger: "axis" }, grid: { left: 150, right: 24, top: 8, bottom: 24 },
      yAxis: { type: "category", inverse: true, data: prov.map((p) => p[0]), ...b.axis, axisLabel: { ...b.axis.axisLabel, fontFamily: "IBM Plex Sans", fontSize: 12 }, splitLine: { show: false } },
      xAxis: { type: "value", minInterval: 1, ...b.axis },
      series: [{ type: "bar", name: "Eventos", data: prov.map((p) => p[1]), itemStyle: { color: cssColor("--chart-2") }, barWidth: "56%" }],
    };
    return { timeline, magChart, depthChart, provChart, magsN: mags.length, depthsN: depths.length, provN: prov.length };
  }, [hydrated, data, events, days]);

  return (
    <main className="pb-20">
      <header className="relative overflow-hidden border-b border-hairline">
        <AnimatedGridPattern numSquares={24} maxOpacity={0.12} duration={4} repeatDelay={1.5} width={48} height={48}
          className="absolute inset-0 h-full w-full fill-primary/20 stroke-foreground/5 [mask-image:linear-gradient(to_left,black,transparent_75%)]" />
        <div className="relative mx-auto grid max-w-[1600px] gap-8 px-4 py-14 lg:grid-cols-[1fr_auto] lg:items-end lg:px-8">
          <div>
            <p className="font-mono text-xs tracking-[0.25em] text-primary">LABORATORIO DE DATOS</p>
            <h1 className="mt-4 max-w-3xl font-display text-4xl leading-[1.02] sm:text-6xl">¿Cómo se ha comportado la actividad sísmica?</h1>
          </div>
          <div className="flex flex-col items-start gap-3 lg:items-end">
            <PeriodSwitch value={period} onChange={setPeriod} options={["7d", "30d", "90d", "365d"]} />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={!events.length} onClick={() => exportEvents(events, "csv", `analisis-${period}`)}><Download /> CSV</Button>
              <Button variant="outline" size="sm" disabled={!events.length} onClick={() => exportEvents(events, "geojson", `analisis-${period}`)}><Download /> GeoJSON</Button>
            </div>
          </div>
        </div>
      </header>

      {/* Cifras calculadas */}
      <section className="mx-auto max-w-[1600px] px-4 lg:px-8">
        {isLoading && <p className="py-10 meta">Calculando con los registros de las fuentes…</p>}
        {isError && <p className="py-10 text-destructive">No se pudieron obtener los datos: {(error as Error).message}</p>}
        {data && (
          <dl className="grid grid-cols-2 divide-hairline border-b border-hairline py-8 md:grid-cols-4 md:divide-x">
            <div className="py-3 md:px-6 md:first:pl-0">
              <dt className="meta">Eventos</dt>
              <dd className="font-display text-5xl"><NumberTicker value={s.total} /></dd>
              <dd className="meta">{delta(s.total, ps?.total) ?? "comparando…"}</dd>
            </div>
            <div className="py-3 md:px-6">
              <dt className="meta">Magnitud máxima</dt>
              <dd className="font-display text-5xl">{s.maxMag == null ? "—" : <NumberTicker value={s.maxMag} decimalPlaces={1} />}</dd>
              <dd className="meta">{s.withMag ? `de ${fmtNum(s.withMag)} con magnitud` : "No hay registros suficientes"}</dd>
            </div>
            <div className="py-3 md:px-6">
              <dt className="meta">Magnitud media</dt>
              <dd className="font-display text-5xl">{s.meanMag == null ? "—" : <NumberTicker value={s.meanMag} decimalPlaces={2} />}</dd>
              <dd className="meta">{ps?.meanMag != null ? `anterior: ${fmtNum(ps.meanMag, 2)}` : "—"}</dd>
            </div>
            <div className="py-3 md:px-6">
              <dt className="meta">Profundidad media</dt>
              <dd className="font-display text-5xl">{s.meanDepth == null ? "—" : <><NumberTicker value={s.meanDepth} /><span className="text-2xl text-muted-foreground"> km</span></>}</dd>
              <dd className="meta">{s.withDepth ? `de ${fmtNum(s.withDepth)} con profundidad` : "No hay registros suficientes"}</dd>
            </div>
          </dl>
        )}
      </section>

      {options && (
        <>
          <section className="mx-auto max-w-[1600px] px-4 pt-12 lg:px-8">
            <h2 className="font-display text-2xl">Eventos por día</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Conteo diario en hora de Panamá, separado entre epicentros en territorio nacional y en la zona marítima próxima. {days > 60 && "Arrastre o use la rueda para acercar."}</p>
            <EChart option={options.timeline} className="mt-6 h-[340px]" ariaLabel="Gráfico de barras de eventos por día" />
          </section>

          <section className="mx-auto mt-16 grid max-w-[1600px] gap-12 px-4 lg:grid-cols-2 lg:px-8">
            <div>
              <h2 className="font-display text-2xl">Distribución por magnitud</h2>
              <p className="mt-1 text-sm text-muted-foreground">{fmtNum(options.magsN)} eventos con magnitud informada. Se usa la magnitud del reporte principal, con el tipo que publica cada agencia.</p>
              <EChart option={options.magChart} className="mt-6 h-[300px]" ariaLabel="Histograma de magnitudes" />
            </div>
            <div>
              <h2 className="font-display text-2xl">Distribución por profundidad</h2>
              <p className="mt-1 text-sm text-muted-foreground">{fmtNum(options.depthsN)} eventos con profundidad informada. Los sismos someros (menos de 70 km) suelen sentirse con más intensidad.</p>
              <EChart option={options.depthChart} className="mt-6 h-[300px]" ariaLabel="Histograma de profundidades" />
            </div>
          </section>

          <section className="mx-auto mt-16 grid max-w-[1600px] gap-12 px-4 lg:grid-cols-[2fr_1fr] lg:px-8">
            <div>
              <h2 className="font-display text-2xl">Provincias y comarcas</h2>
              <p className="mt-1 text-sm text-muted-foreground">Solo epicentros dentro del territorio, asignados por su posición en los límites de geoBoundaries.</p>
              {options.provN ? <EChart option={options.provChart} className="mt-6 h-[360px]" ariaLabel="Eventos por provincia" /> : <p className="mt-6 text-muted-foreground">No hay epicentros en territorio panameño en este período.</p>}
            </div>
            <div className="lg:border-l lg:border-hairline lg:pl-10">
              <h2 className="font-display text-2xl">Tierra y mar</h2>
              <div className="mt-6 flex h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${s.panama} terrestres y ${s.maritima} marítimos`}>
                <div className="bg-chart-1" style={{ width: `${s.total ? (s.panama / s.total) * 100 : 0}%` }} />
                <div className="bg-chart-4" style={{ width: `${s.total ? (s.maritima / s.total) * 100 : 0}%` }} />
              </div>
              <p className="mt-4 text-sm"><span className="num font-mono text-chart-1">{fmtNum(s.panama)}</span> terrestres · <span className="num font-mono text-chart-4">{fmtNum(s.maritima)}</span> marítimos</p>
              <h3 className="mt-10 meta">Glosario</h3>
              <dl className="mt-3 space-y-3 text-sm">
                <div><dt className="text-foreground">Magnitud</dt><dd className="text-muted-foreground">Energía liberada por el sismo, en escala logarítmica. Cada agencia indica su tipo (Mw, mb, ML…).</dd></div>
                <div><dt className="text-foreground">Profundidad</dt><dd className="text-muted-foreground">Distancia en km desde la superficie hasta el hipocentro.</dd></div>
                <div><dt className="text-foreground">Media</dt><dd className="text-muted-foreground">Calculada solo con los registros que tienen el dato; los desconocidos no se cuentan como cero.</dd></div>
              </dl>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
