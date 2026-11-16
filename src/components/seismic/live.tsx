import { ExternalLink, Radio } from "lucide-react";
import { useEffect, useState } from "react";
import { useRealtime, type LiveEvent, type WsState } from "@/features/seismic/realtime";
import { fmtDate, fmtDepth, fmtMag, fmtRelative, fmtTime, magClass, placeOf } from "@/features/seismic/format";
import type { SeismicEvent } from "@/features/seismic/types";
import { AnimatedList } from "@/components/reactbits";
import { cn } from "@/lib/utils";

const MAG_TEXT = ["text-mag-0", "text-mag-1", "text-mag-2", "text-mag-3", "text-mag-4", "text-mag-5"];
const MAG_BG = ["bg-mag-0", "bg-mag-1", "bg-mag-2", "bg-mag-3", "bg-mag-4", "bg-mag-5"];

const WS_LABEL: Record<WsState, string> = {
  idle: "Iniciando",
  connecting: "Conectando",
  open: "En vivo",
  reconnecting: "Reconectando",
  unsupported: "Sondeo",
};

/** Re-render cada `ms` para que los tiempos relativos avancen solos. */
export function useTick(ms = 15_000) {
  const [, set] = useState(0);
  useEffect(() => {
    const id = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

export function LiveDot({ tone = "ok", pulse = true, className }: { tone?: "ok" | "warn" | "bad" | "muted"; pulse?: boolean; className?: string }) {
  const bg = tone === "ok" ? "bg-ok" : tone === "warn" ? "bg-warn" : tone === "bad" ? "bg-destructive" : "bg-muted-foreground";
  return (
    <span className={cn("relative inline-flex size-2.5", className)} aria-hidden="true">
      {pulse && <span className={cn("live-ring absolute inline-flex size-full rounded-full", bg)} />}
      <span className={cn("relative inline-flex size-2.5 rounded-full", bg)} />
    </span>
  );
}

/** Estado de la conexión en tiempo real (WebSocket EMSC + feed USGS). */
export function LiveBadge({ className, compact = false }: { className?: string; compact?: boolean }) {
  const rt = useRealtime();
  const tone = rt.ws === "open" ? "ok" : rt.ws === "reconnecting" ? "warn" : rt.lastPollOk === false ? "bad" : "muted";
  const label = rt.ws === "open" ? "En vivo" : rt.ws === "unsupported" && rt.lastPollOk ? "En vivo (sondeo)" : WS_LABEL[rt.ws];
  return (
    <span
      className={cn("inline-flex items-center gap-2 rounded-full border border-hairline bg-surface/70 px-2.5 py-1 font-mono text-[0.68rem] uppercase tracking-[0.14em]", className)}
      title={`WebSocket EMSC: ${WS_LABEL[rt.ws]} · Feed USGS: ${rt.lastPollAt ? `${rt.lastPollOk ? "operativo" : "sin respuesta"} · ${fmtTime(rt.lastPollAt, true)}` : "pendiente"}`}
    >
      <LiveDot tone={tone} pulse={tone === "ok"} />
      {!compact && <span className={tone === "ok" ? "text-ok" : "text-muted-foreground"}>{label}</span>}
    </span>
  );
}

type FeedRow = Pick<LiveEvent, "key" | "magnitude" | "depthKm" | "place" | "province" | "url" | "occurredAtUtc" | "sources"> & {
  classification: SeismicEvent["classification"];
};

function LiveRow({ e, live, isNew }: { e: FeedRow; live: boolean; isNew: boolean }) {
  const k = magClass(e.magnitude);
  return (
    <a
      href={e.url}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "group flex items-center gap-3 rounded-lg border border-hairline bg-background/60 px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-accent/30",
        isNew && "border-primary/50 bg-primary/5",
      )}
    >
      <span className={cn("grid size-11 shrink-0 place-items-center rounded-md font-mono text-base font-semibold text-background", MAG_BG[k])}>{fmtMag(e.magnitude)}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm">{e.province ?? e.place ?? "Zona marítima"}</span>
          {isNew && <span className="rounded-sm bg-primary px-1.5 py-px font-mono text-[0.6rem] uppercase tracking-wider text-primary-foreground">Nuevo</span>}
        </span>
        <span className="meta block truncate">
          {live ? fmtTime(e.occurredAtUtc, true) : fmtDate(e.occurredAtUtc)} · {fmtRelative(e.occurredAtUtc)} · {fmtDepth(e.depthKm)} · {e.classification === "maritima" ? "Mar" : "Tierra"}
        </span>
      </span>
      <span className="hidden flex-col items-end gap-1 sm:flex">
        <span className={cn("font-mono text-[0.65rem]", MAG_TEXT[k])}>{e.sources.map((s) => s.toUpperCase()).join(" + ")}</span>
        <ExternalLink className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
      </span>
    </a>
  );
}

/** Feed de detecciones en vivo (preliminares) en Panamá y su zona marítima. */
export function LiveFeed({ catalog, loading, unavailable }: { catalog: SeismicEvent[]; loading: boolean; unavailable: boolean }) {
  const rt = useRealtime();
  useTick();
  const now = Date.now();
  const live = rt.events.filter((event) => Date.parse(event.occurredAtUtc) >= now - 60 * 60_000);
  const historical = live.length === 0;
  const recent: FeedRow[] = catalog.slice(0, 5).map((event) => ({
    key: event.id,
    magnitude: event.primary.magnitude,
    depthKm: event.primary.depthKm,
    place: placeOf(event),
    province: null,
    url: event.primary.sourceUrl,
    occurredAtUtc: event.primary.occurredAtUtc,
    sources: [...new Set(event.reports.map((report) => report.sourceId))],
    classification: event.classification,
  }));
  const newKeys = new Set(live.filter((event) => event.fresh && now - Date.parse(event.receivedAt) < 5 * 60_000).map((event) => event.key));
  const status = !historical ? "Última hora · datos preliminares"
    : rt.lastPollOk === false || rt.ws === "reconnecting" ? "Una fuente en vivo no responde. Consulta el catálogo más abajo."
    : rt.lastPollOk && rt.ws === "open" ? "Sin detecciones nuevas recibidas en la última hora."
    : "Conectando con las fuentes en vivo…";
  return (
    <div className="px-4">
      <p className="meta px-1 pt-4" role="status">{status}</p>
      {historical && recent.length > 0 && <h3 className="px-1 pt-3 font-display text-base">Últimos sismos del catálogo</h3>}
      <AnimatedList
      maxHeight="22rem"
      items={historical ? recent : live}
      getKey={(e) => e.key}
      render={(e) => <LiveRow e={e} live={!historical} isNew={newKeys.has(e.key)} />}
      empty={
        <li className="flex flex-col items-center gap-3 py-10 text-center text-sm text-muted-foreground">
          <Radio className="size-6 text-primary/60" aria-hidden="true" />
          <span>
            {loading ? "Cargando catálogo…" : unavailable ? "No se pudo consultar el catálogo." : "No hay registros recientes disponibles en el catálogo."}
          </span>
        </li>
      }
      />
    </div>
  );
}
