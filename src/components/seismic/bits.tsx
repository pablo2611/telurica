import { ExternalLink } from "lucide-react";
import { AnimatedBackground } from "@/components/ui/animated-background";
import { CLASS_LABEL, SOURCE_LABEL, STATE_LABEL, fmtCoord, fmtDate, fmtDepth, fmtMag, fmtTime, magClass, placeOf } from "@/features/seismic/format";
import { PERIODS, type PeriodId } from "@/features/seismic/periods";
import type { SeismicEvent, SourceState } from "@/features/seismic/types";
import { cn } from "@/lib/utils";
import { nearestFault, stratumAt } from "@/data/tectonics";

const MAG_BG = ["bg-mag-0", "bg-mag-1", "bg-mag-2", "bg-mag-3", "bg-mag-4", "bg-mag-5"];
const MAG_TEXT = ["text-mag-0", "text-mag-1", "text-mag-2", "text-mag-3", "text-mag-4", "text-mag-5"];
export const magBg = (m: number | null) => MAG_BG[magClass(m)];
export const magText = (m: number | null) => MAG_TEXT[magClass(m)];

export function MagValue({ m, className }: { m: number | null; className?: string }) {
  return <span className={cn("num font-mono", magText(m), className)} title={m == null ? "Magnitud no informada" : undefined}>{fmtMag(m)}</span>;
}

/** Selector de período (Motion Primitives · Animated Background). Cambia la consulta real. */
export function PeriodSwitch({ value, onChange, options = PERIODS.map((p) => p.id), className }: { value: PeriodId; onChange: (p: PeriodId) => void; options?: PeriodId[]; className?: string }) {
  return (
    <div role="radiogroup" aria-label="Período" className={cn("inline-flex rounded-md border border-border bg-surface p-0.5", className)}>
      <AnimatedBackground defaultValue={value} className="rounded-[5px] bg-accent" transition={{ type: "spring", bounce: 0.15, duration: 0.35 }} onValueChange={(id) => id && onChange(id as PeriodId)}>
        {options.map((id) => (
          <button key={id} data-id={id} type="button" role="radio" aria-checked={value === id}
            className="px-3 py-1 font-mono text-xs text-muted-foreground transition-colors aria-checked:text-foreground">
            {PERIODS.find((p) => p.id === id)!.label}
          </button>
        ))}
      </AnimatedBackground>
    </div>
  );
}

const STATE_TONE: Record<SourceState, string> = {
  operativa: "bg-ok", con_retraso: "bg-warn", sin_respuesta: "bg-destructive", desconectada: "bg-destructive", no_integrada: "bg-muted-foreground/50", requiere_autorizacion: "bg-warn",
};
export function StateDot({ state, withLabel = true }: { state: SourceState; withLabel?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn("size-2 rounded-full", STATE_TONE[state])} aria-hidden="true" />
      {withLabel && <span>{STATE_LABEL[state]}</span>}
    </span>
  );
}

export function ZoneTag({ e }: { e: SeismicEvent }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-mono text-[0.7rem]", e.classification === "maritima" ? "text-primary" : "text-muted-foreground")}>
      <span className={cn("size-1.5 rounded-full", e.classification === "maritima" ? "border border-primary" : "bg-foreground/60")} />
      {e.classification === "maritima" ? "Marítimo" : "Terrestre"}
    </span>
  );
}

/** Ficha completa de un evento, con todas las mediciones de agencias y sus diferencias. */
export function EventDetail({ e }: { e: SeismicEvent }) {
  const p = e.primary;
  return (
    <div className="space-y-6">
      <div>
        <div className="meta">{fmtDate(p.occurredAtUtc)} · {fmtTime(p.occurredAtUtc, true)} hora de Panamá</div>
        <div className="mt-2 flex items-end gap-3">
          <MagValue m={p.magnitude} className="text-6xl leading-none" />
          <div className="pb-1 font-mono text-sm text-muted-foreground">{p.magnitudeType ?? "tipo no informado"}</div>
        </div>
        <h3 className="mt-3 font-display text-2xl leading-tight">{placeOf(e)}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{CLASS_LABEL[e.classification]}{e.classification === "maritima" && " — fuera del territorio terrestre panameño"}</p>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-y border-hairline py-4 text-sm">
        <div><dt className="meta">Profundidad</dt><dd className="num font-mono">{fmtDepth(p.depthKm)}</dd></div>
        <div><dt className="meta">Coordenadas</dt><dd className="num font-mono text-xs">{fmtCoord(p.latitude, p.longitude)}</dd></div>
        <div><dt className="meta">Hora UTC</dt><dd className="num font-mono text-xs">{p.occurredAtUtc.replace("T", " ").replace(/\.\d+Z$/, "Z")}</dd></div>
        <div><dt className="meta">Revisión (fuente)</dt><dd>{p.reviewStatus ?? "No informada"}</dd></div>
        <div><dt className="meta">Lugar reportado</dt><dd className="text-xs">{p.placeReported ?? "No informado"}</dd></div>
        <div><dt className="meta">Recibido</dt><dd className="num font-mono text-xs">{fmtDate(e.receivedAt)} {fmtTime(e.receivedAt)}</dd></div>
        <TectonicRows e={e} />
      </dl>
      <div>
        <h4 className="meta mb-2">Reportes de agencias ({e.reports.length})</h4>
        <table className="w-full text-left text-xs">
          <thead className="meta"><tr><th className="py-1 font-normal">Fuente</th><th className="font-normal">Mag.</th><th className="font-normal">Prof.</th><th className="font-normal">Hora</th><th className="font-normal">Autor</th><th /></tr></thead>
          <tbody className="font-mono">
            {e.reports.map((r) => (
              <tr key={`${r.sourceId}${r.externalId}`} className="border-t border-hairline">
                <td className="py-1.5">{SOURCE_LABEL[r.sourceId]}</td>
                <td><MagValue m={r.magnitude} /> <span className="text-muted-foreground">{r.magnitudeType ?? ""}</span></td>
                <td className="num">{r.depthKm == null ? "s/d" : r.depthKm.toFixed(0)}</td>
                <td className="num">{fmtTime(r.occurredAtUtc, true)}</td>
                <td>{r.author ?? "—"}</td>
                <td className="text-right"><a href={r.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex text-primary hover:underline" aria-label={`Abrir reporte original en ${SOURCE_LABEL[r.sourceId]}`}><ExternalLink className="size-3.5" /></a></td>
              </tr>
            ))}
          </tbody>
        </table>
        {e.reports.length > 1 && (
          <p className="mt-2 text-xs text-muted-foreground">Agrupados por coincidencia de hora (≤ 30 s), distancia (≤ 60 km) y magnitud (≤ 1.0). Se conserva cada medición original.</p>
        )}
      </div>
    </div>
  );
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="py-10 text-center text-sm text-muted-foreground">{children}</p>;
}

/** Contexto tectónico del sismo: falla más cercana (proximidad, no causa), roca en el foco y energía relativa. */
function TectonicRows({ e }: { e: SeismicEvent }) {
  const p = e.primary;
  const { fault, km } = nearestFault(p.longitude, p.latitude);
  const rock = p.depthKm == null ? null : stratumAt(p.depthKm);
  return (
    <>
      <div className="col-span-2">
        <dt className="meta">Falla más cercana</dt>
        <dd>
          <span className={fault.k === "limite" ? "text-[#ff5a4f]" : "text-[#ffb347]"}>{fault.n}</span>{" "}
          <span className="meta">a {km.toFixed(0)} km · {fault.t}</span>
        </dd>
      </div>
      <div><dt className="meta">Roca en el foco</dt><dd className="text-xs">{rock ? rock.n.split(" (")[0] : "No determinada"}</dd></div>
      <div><dt className="meta">Energía</dt><dd className="num font-mono text-xs">{p.magnitude == null ? "s/d" : `≈ ${Math.pow(10, 1.5 * (p.magnitude - 4)).toLocaleString("es-PA", { maximumFractionDigits: 0 })} × M4`}</dd></div>
    </>
  );
}
