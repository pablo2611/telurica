import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Download } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { EventDetail, MagValue, ZoneTag } from "@/components/seismic/bits";
import { useSeismicRange } from "@/features/seismic/queries";
import { PROVINCE_NAMES } from "@/features/seismic/geo";
import { SOURCE_LABEL, dayKey, fmtDate, fmtNum, fmtTime, placeOf } from "@/features/seismic/format";
import { exportEvents } from "@/features/seismic/export";
import type { SeismicEvent } from "@/features/seismic/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/historial")({
  head: () => ({
    meta: [
      { title: "Archivo sísmico · Telúrica" },
      { name: "description", content: "Consulte y exporte el registro de sismos de Panamá por fecha, magnitud, profundidad, fuente y provincia." },
      { property: "og:title", content: "Archivo sísmico de Panamá" },
      { property: "og:description", content: "Registro filtrable de sismos con procedencia y exportación CSV y GeoJSON." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Historial,
});

type SortKey = "time" | "mag" | "depth";
const PAGE = 40;
const today = () => dayKey(new Date().toISOString());
const daysAgo = (n: number) => dayKey(new Date(Date.now() - n * 86400_000).toISOString());

const field = "h-9 rounded-sm border border-input bg-surface px-2.5 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring";

function Historial() {
  const [from, setFrom] = useState(daysAgo(90));
  const [to, setTo] = useState(today());
  const [minMag, setMinMag] = useState("");
  const [maxDepth, setMaxDepth] = useState("");
  const [source, setSource] = useState<"all" | "usgs" | "emsc">("all");
  const [zone, setZone] = useState<"all" | "panama" | "maritima">("all");
  const [province, setProvince] = useState("all");
  const [review, setReview] = useState<"all" | "reviewed" | "automatic">("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "time", dir: -1 });
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<SeismicEvent | null>(null);

  const startIso = new Date(`${from}T00:00:00-05:00`).toISOString();
  const endIso = to >= today() ? null : new Date(`${to}T23:59:59-05:00`).toISOString();
  const validRange = from <= to;
  const { data, isLoading, isError, error, isFetching } = useSeismicRange(validRange ? startIso : new Date(`${to}T00:00:00-05:00`).toISOString(), endIso);

  const rows = useMemo(() => {
    let r = data?.events ?? [];
    const mm = parseFloat(minMag.replace(",", "."));
    const md = parseFloat(maxDepth.replace(",", "."));
    if (!isNaN(mm)) r = r.filter((e) => e.primary.magnitude != null && e.primary.magnitude >= mm);
    if (!isNaN(md)) r = r.filter((e) => e.primary.depthKm != null && e.primary.depthKm <= md);
    if (source !== "all") r = r.filter((e) => e.reports.some((x) => x.sourceId === source));
    if (zone !== "all") r = r.filter((e) => e.classification === zone);
    if (province !== "all") r = r.filter((e) => e.province === province);
    if (review !== "all") r = r.filter((e) => e.reports.some((x) => x.reviewStatus === review));
    const val = (e: SeismicEvent) => (sort.key === "time" ? Date.parse(e.primary.occurredAtUtc) : sort.key === "mag" ? e.primary.magnitude : e.primary.depthKm);
    return [...r].sort((a, b) => {
      const va = val(a), vb = val(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      return (va - vb) * sort.dir;
    });
  }, [data, minMag, maxDepth, source, zone, province, review, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const pageRows = rows.slice(page * PAGE, page * PAGE + PAGE);
  const reset = () => setPage(0);
  const toggleSort = (key: SortKey) => { setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: -1 })); reset(); };
  const SortIcon = ({ k }: { k: SortKey }) => (sort.key === k ? (sort.dir === -1 ? <ArrowDown className="inline size-3" /> : <ArrowUp className="inline size-3" />) : null);

  return (
    <main className="pb-16">
      <header className="mx-auto max-w-[1600px] px-4 pt-12 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <h1 className="font-display text-[clamp(2.5rem,8vw,7rem)] font-light leading-[0.9] tracking-tight">Archivo<br />sísmico</h1>
          </div>
          <p className="max-w-sm text-muted-foreground lg:text-right">
            Registros consultados en los catálogos de USGS y EMSC, ya filtrados a Panamá y su zona marítima. Haga clic en una fila para ver todas las mediciones.
          </p>
        </div>
      </header>

      {/* Franja de consulta */}
      <section aria-label="Filtros" className="sticky top-14 z-20 mt-10 border-y border-hairline bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-end gap-x-4 gap-y-3 px-4 py-3 lg:px-8">
          <label className="flex flex-col gap-1 meta">Desde<input type="date" className={field} value={from} max={to} min={daysAgo(400)} onChange={(e) => { setFrom(e.target.value); reset(); }} /></label>
          <label className="flex flex-col gap-1 meta">Hasta<input type="date" className={field} value={to} min={from} max={today()} onChange={(e) => { setTo(e.target.value); reset(); }} /></label>
          <label className="flex flex-col gap-1 meta">Mag. mín.<input inputMode="decimal" placeholder="—" className={cn(field, "w-20")} value={minMag} onChange={(e) => { setMinMag(e.target.value); reset(); }} /></label>
          <label className="flex flex-col gap-1 meta">Prof. máx. (km)<input inputMode="decimal" placeholder="—" className={cn(field, "w-24")} value={maxDepth} onChange={(e) => { setMaxDepth(e.target.value); reset(); }} /></label>
          <label className="flex flex-col gap-1 meta">Fuente
            <select className={field} value={source} onChange={(e) => { setSource(e.target.value as typeof source); reset(); }}>
              <option value="all">Todas</option><option value="usgs">USGS</option><option value="emsc">EMSC</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 meta">Ubicación
            <select className={field} value={zone} onChange={(e) => { setZone(e.target.value as typeof zone); reset(); }}>
              <option value="all">Terrestre y marítima</option><option value="panama">Territorio panameño</option><option value="maritima">Zona marítima próxima</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 meta">Provincia / comarca
            <select className={field} value={province} onChange={(e) => { setProvince(e.target.value); reset(); }}>
              <option value="all">Todas</option>{PROVINCE_NAMES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 meta">Revisión (USGS)
            <select className={field} value={review} onChange={(e) => { setReview(e.target.value as typeof review); reset(); }}>
              <option value="all">Cualquiera</option><option value="reviewed">Revisado</option><option value="automatic">Automático</option>
            </select>
          </label>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" disabled={!rows.length} onClick={() => exportEvents(rows, "csv", `sismos-panama-${from}-${to}`)}><Download /> CSV</Button>
            <Button variant="outline" size="sm" disabled={!rows.length} onClick={() => exportEvents(rows, "geojson", `sismos-panama-${from}-${to}`)}><Download /> GeoJSON</Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1600px] px-4 lg:px-8">
        <div className="flex items-center justify-between py-4 meta">
          <span>
            {!validRange ? "La fecha inicial debe ser anterior a la final." : isLoading ? "Consultando fuentes…" : isError ? `Error: ${(error as Error).message}` : `${fmtNum(rows.length)} registros${data ? ` de ${fmtNum(data.events.length)} en el rango` : ""}`}
            {isFetching && !isLoading && " · actualizando"}
          </span>
          {data && <span className="hidden sm:inline">Consulta: {fmtDate(data.generatedAt)} {fmtTime(data.generatedAt)}</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-foreground/30 meta">
              <tr>
                <th className="py-2 pr-4 font-normal"><button type="button" onClick={() => toggleSort("time")} className="hover:text-foreground">Fecha y hora <SortIcon k="time" /></button></th>
                <th className="pr-4 font-normal"><button type="button" onClick={() => toggleSort("mag")} className="hover:text-foreground">Magnitud <SortIcon k="mag" /></button></th>
                <th className="pr-4 font-normal"><button type="button" onClick={() => toggleSort("depth")} className="hover:text-foreground">Profundidad <SortIcon k="depth" /></button></th>
                <th className="pr-4 font-normal">Ubicación</th>
                <th className="pr-4 font-normal">Tipo</th>
                <th className="pr-4 font-normal">Fuentes</th>
                <th className="font-normal">Revisión</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((e) => (
                <tr key={e.id} tabIndex={0} onClick={() => setSelected(e)} onKeyDown={(k) => k.key === "Enter" && setSelected(e)}
                  className="cursor-pointer border-b border-hairline transition-colors hover:bg-surface focus-visible:bg-surface">
                  <td className="py-2.5 pr-4 num font-mono text-xs">{fmtDate(e.primary.occurredAtUtc)} <span className="text-muted-foreground">{fmtTime(e.primary.occurredAtUtc, true)}</span></td>
                  <td className="pr-4"><MagValue m={e.primary.magnitude} className="text-base" /> <span className="meta">{e.primary.magnitudeType ?? ""}</span></td>
                  <td className="pr-4 num font-mono text-xs">{e.primary.depthKm == null ? <span className="text-muted-foreground">No determinada</span> : `${e.primary.depthKm.toFixed(1)} km`}</td>
                  <td className="max-w-[22rem] truncate pr-4">{placeOf(e)}</td>
                  <td className="pr-4"><ZoneTag e={e} /></td>
                  <td className="pr-4 font-mono text-xs">{e.reports.map((r) => SOURCE_LABEL[r.sourceId]).join(" + ")}</td>
                  <td className="text-xs text-muted-foreground">{e.primary.reviewStatus === "reviewed" ? "Revisado" : e.primary.reviewStatus === "automatic" ? "Automático" : e.primary.reviewStatus ?? "No informada"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && !rows.length && <p className="py-16 text-center text-muted-foreground">No hay registros con estos filtros en las fuentes consultadas.</p>}
        </div>
        {rows.length > PAGE && (
          <nav aria-label="Paginación" className="flex items-center justify-between py-6">
            <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
            <span className="meta">Página {page + 1} de {pages}</span>
            <Button variant="ghost" size="sm" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>
          </nav>
        )}
      </section>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto border-hairline bg-background sm:max-w-md">
          <SheetHeader><SheetTitle className="sr-only">Detalle del evento</SheetTitle></SheetHeader>
          {selected && <EventDetail e={selected} />}
        </SheetContent>
      </Sheet>
    </main>
  );
}
