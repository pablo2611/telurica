import { useQuery } from "@tanstack/react-query";
import { getHeadlines } from "@/features/seismic/news.functions";
import { fmtDate, fmtNum, placeOf } from "@/features/seismic/format";
import type { SeismicEvent } from "@/features/seismic/types";

export function ImpactAndNews({ events, loading }: { events: SeismicEvent[]; loading: boolean }) {
  const strongest = events.reduce<SeismicEvent | undefined>((current, event) =>
    event.primary.magnitude != null && (current?.primary.magnitude ?? -Infinity) < event.primary.magnitude ? event : current, undefined);
  const report = strongest?.reports.find((item) => item.sourceId === "usgs" && item.impact);
  const impact = report?.impact;
  const news = useQuery({ queryKey: ["panama-seismic-news"], queryFn: () => getHeadlines(), staleTime: 15 * 60_000, retry: false });
  const values = [
    ["Reportes de percepción", impact?.felt],
    ["Intensidad comunitaria (CDI)", impact?.cdi],
    ["Intensidad estimada (MMI)", impact?.mmi],
    ["Nivel PAGER", impact?.alert ? ({ green: "Verde", yellow: "Amarillo", orange: "Naranja", red: "Rojo" })[impact.alert] : null],
    ["Indicador de tsunami USGS", impact?.tsunami == null ? null : impact.tsunami ? "Marcado" : "Sin marca"],
  ] as const;

  return (
    <div className="mx-auto grid max-w-[1600px] gap-6 px-4 pb-12 lg:grid-cols-2 lg:px-8">
      <section className="glass rounded-xl border border-hairline p-5 sm:p-6">
        <h2 className="font-display text-2xl">Daños e impacto</h2>
        {strongest ? <>
          <p className="mt-2 text-sm text-muted-foreground">Mayor magnitud en 30 días · M {fmtNum(strongest.primary.magnitude ?? 0, 1)} · {placeOf(strongest)} · {fmtDate(strongest.primary.occurredAtUtc)}</p>
          <dl className="mt-4 divide-y divide-hairline">
            {values.map(([label, value]) => <div className="flex flex-wrap justify-between gap-x-4 py-2 text-sm" key={label}><dt>{label}</dt><dd className="text-muted-foreground">{value ?? "Sin datos"}</dd></div>)}
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">PAGER estima el impacto. El indicador de tsunami es un dato del catálogo, no una alerta oficial.</p>
          {report && <a href={report.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm text-primary">Ver reporte USGS</a>}
        </> : <p className="mt-3 text-sm text-muted-foreground">{loading ? "Cargando el catálogo…" : "Sin sismos con magnitud registrada en el período."}</p>}
      </section>
      <section className="glass rounded-xl border border-hairline p-5 sm:p-6">
        <h2 className="font-display text-2xl">Noticias</h2>
        <p className="mb-3 mt-2 text-sm text-muted-foreground">Titulares sobre sismos en Panamá · Google News</p>
        {news.isPending ? <p className="text-sm">Cargando titulares…</p> : news.isError ? <p className="text-sm text-muted-foreground">El RSS no está disponible en este momento.</p> : news.data.length ? <ul className="divide-y divide-hairline">
          {news.data.map((item) => <li key={item.link} className="space-y-1 py-3">
            <a className="text-sm hover:text-primary hover:underline" href={item.link} target="_blank" rel="noopener noreferrer">{item.title}</a>
            <p className="meta">{item.source} · <time dateTime={item.date}>{fmtDate(item.date)}</time></p>
          </li>)}
        </ul> : <p className="text-sm text-muted-foreground">Sin titulares disponibles.</p>}
      </section>
    </div>
  );
}
