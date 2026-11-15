import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BellRing, Plus, Trash2, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { LiveBadge } from "@/components/seismic/live";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MagValue } from "@/components/seismic/bits";
import { playChime } from "@/components/site/AlertWatcher";
import { clearLog, setPrefs, useAlertLog, usePrefs } from "@/features/seismic/alert-store";
import type { AlertRule } from "@/features/seismic/alerts";
import { PROVINCE_NAMES } from "@/features/seismic/geo";
import { fmtDate, fmtTime } from "@/features/seismic/format";
import { useHydrated } from "@/hooks/use-hydrated";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/alertas")({
  head: () => ({
    meta: [
      { title: "Preferencias de alertas · Telúrica" },
      { name: "description", content: "Configure avisos de la plataforma por magnitud, zona, provincia, profundidad y fuente." },
      { property: "og:title", content: "Alertas sísmicas configurables" },
      { property: "og:description", content: "Reglas de notificación para sismos reportados en Panamá." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Alertas,
});

const field = "h-8 rounded-sm border border-input bg-surface px-2 text-sm text-foreground";

function RuleRow({ rule, onChange, onDelete }: { rule: AlertRule; onChange: (r: AlertRule) => void; onDelete: () => void }) {
  const toggle = <T extends string>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  return (
    <li className={cn("grid gap-4 border-b border-hairline py-5 lg:grid-cols-[auto_minmax(12rem,1.4fr)_repeat(5,minmax(0,1fr))_auto] lg:items-center", !rule.enabled && "opacity-60")}>
      <Switch checked={rule.enabled} onCheckedChange={(v) => onChange({ ...rule, enabled: v })} aria-label={`Activar regla ${rule.name}`} />
      <input className={cn(field, "font-medium")} value={rule.name} onChange={(e) => onChange({ ...rule, name: e.target.value })} aria-label="Nombre de la regla" />
      <label className="flex flex-col gap-1 meta">Magnitud ≥
        <select className={field} value={rule.minMagnitude} onChange={(e) => onChange({ ...rule, minMagnitude: Number(e.target.value) })}>
          {[2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7].map((m) => <option key={m} value={m}>{m.toFixed(1)}</option>)}
        </select>
      </label>
      <fieldset className="flex flex-col gap-1 meta"><legend className="mb-1">Zona</legend>
        <div className="flex gap-3 text-sm text-foreground">
          <label className="flex items-center gap-1.5"><input type="checkbox" className="accent-primary" checked={rule.zones.includes("panama")} onChange={() => onChange({ ...rule, zones: toggle(rule.zones, "panama") })} />Tierra</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" className="accent-primary" checked={rule.zones.includes("maritima")} onChange={() => onChange({ ...rule, zones: toggle(rule.zones, "maritima") })} />Mar</label>
        </div>
      </fieldset>
      <label className="flex flex-col gap-1 meta">Provincia
        <select className={field} value={rule.province ?? ""} onChange={(e) => onChange({ ...rule, province: e.target.value || null })}>
          <option value="">Cualquiera</option>{PROVINCE_NAMES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 meta">Prof. máx.
        <select className={field} value={rule.maxDepthKm ?? ""} onChange={(e) => onChange({ ...rule, maxDepthKm: e.target.value ? Number(e.target.value) : null })}>
          <option value="">Cualquiera</option>{[10, 30, 70, 150, 300].map((d) => <option key={d} value={d}>{d} km</option>)}
        </select>
      </label>
      <fieldset className="flex flex-col gap-1 meta"><legend className="mb-1">Fuente</legend>
        <div className="flex gap-3 text-sm text-foreground">
          {(["usgs", "emsc"] as const).map((s) => (
            <label key={s} className="flex items-center gap-1.5"><input type="checkbox" className="accent-primary" checked={rule.sources.includes(s)} onChange={() => onChange({ ...rule, sources: toggle(rule.sources, s) })} />{s.toUpperCase()}</label>
          ))}
        </div>
      </fieldset>
      <Button variant="ghost" size="icon" onClick={onDelete} aria-label={`Eliminar regla ${rule.name}`}><Trash2 /></Button>
    </li>
  );
}

function Alertas() {
  const prefs = usePrefs();
  const log = useAlertLog();
  const hydrated = useHydrated();
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  useEffect(() => setPerm("Notification" in window ? Notification.permission : "unsupported"), []);

  const update = (patch: Partial<typeof prefs>) => setPrefs({ ...prefs, ...patch });
  const updateRule = (r: AlertRule) => update({ rules: prefs.rules.map((x) => (x.id === r.id ? r : x)) });
  const addRule = () => update({ rules: [...prefs.rules, { id: `r-${Date.now().toString(36)}`, name: "Nueva regla", enabled: true, minMagnitude: 3.5, zones: ["panama"], province: null, maxDepthKm: null, sources: ["usgs", "emsc"] }] });

  const requestBrowser = async (on: boolean) => {
    if (!on) return update({ browser: false });
    if (!("Notification" in window)) return setPerm("unsupported");
    const p = await Notification.requestPermission();
    setPerm(p);
    update({ browser: p === "granted" });
  };

  const testAlert = () => {
    toast("Prueba · M 4.5 · Chiriquí", { description: "Así se verá una alerta real. Notificación de la plataforma, no es un aviso oficial." });
    if (prefs.sound) playChime();
    if (prefs.browser && perm === "granted") new Notification("Prueba · M 4.5 · Chiriquí", { body: "Telúrica — alerta de prueba", tag: "psw-test" });
    if ("vibrate" in navigator) navigator.vibrate?.(200);
  };

  if (!hydrated) return <main className="mx-auto max-w-[1200px] px-4 py-16 meta lg:px-8">Cargando preferencias…</main>;

  return (
    <main className="mx-auto max-w-[1400px] px-4 pb-20 pt-8 sm:pt-12 lg:px-8">
      <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
        <div>
          <h1 className="font-display text-4xl leading-none sm:text-6xl">Preferencias<br />de alertas</h1>
          <p className="mt-6 max-w-xl text-muted-foreground">
            Reciba un aviso cuando las fuentes publiquen un sismo que cumpla sus reglas. Las preferencias se guardan en este navegador.
          </p>
        </div>
        <aside className="border-l-2 border-warn pl-5 text-sm leading-relaxed text-muted-foreground">
          <p className="text-foreground">Esto no es un aviso oficial.</p>
          <p className="mt-2">Las notificaciones de la plataforma llegan después de que una agencia publica el reporte, normalmente entre segundos y pocos minutos tras el sismo (EMSC por WebSocket en vivo, USGS cada 30 s). Para alertas y órdenes de evacuación, siga a <a href="https://www.sinaproc.gob.pa/alertas/" target="_blank" rel="noreferrer" className="text-primary hover:underline">SINAPROC</a>.</p>
          <p className="mt-2">Los avisos funcionan con esta página abierta (aunque esté en otra pestaña): no hay notificaciones push con el navegador cerrado.</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <LiveBadge />
            <Button variant="outline" size="sm" onClick={testAlert}><BellRing /> Probar alerta</Button>
          </div>
        </aside>
      </div>

      {/* Estado global */}
      <section aria-label="Canales" className="mt-12 grid border-y border-hairline sm:grid-cols-3 sm:divide-x sm:divide-hairline">
        <label className="flex items-start justify-between gap-4 py-5 sm:pr-6">
          <span><span className="block font-medium">Notificaciones activas</span><span className="meta">{prefs.enabled ? "En vivo: EMSC (WebSocket) + USGS cada 30 s" : "Desactivadas"}</span></span>
          <Switch checked={prefs.enabled} onCheckedChange={(v) => update({ enabled: v })} />
        </label>
        <div className="flex items-start justify-between gap-4 py-5 sm:px-6">
          <span><span className="block font-medium">Sonido</span>
            <button type="button" onClick={playChime} className="mt-1 inline-flex items-center gap-1 meta hover:text-foreground"><Volume2 className="size-3" />Probar sonido</button>
          </span>
          <Switch checked={prefs.sound} onCheckedChange={(v) => { update({ sound: v }); if (v) playChime(); }} aria-label="Sonido" />
        </div>
        <div className="flex items-start justify-between gap-4 py-5 sm:pl-6">
          <span><span className="block font-medium">Notificación del navegador</span>
            <span className="meta">{perm === "unsupported" ? "No compatible en este navegador" : perm === "denied" ? "Permiso bloqueado en el navegador" : perm === "granted" ? "Permiso concedido" : "Se pedirá permiso"}</span>
          </span>
          <Switch checked={prefs.browser && perm === "granted"} disabled={perm === "unsupported" || perm === "denied"} onCheckedChange={requestBrowser} aria-label="Notificación del navegador" />
        </div>
      </section>

      <Tabs defaultValue="reglas" className="mt-12">
        <TabsList className="bg-surface">
          <TabsTrigger value="reglas">Reglas ({prefs.rules.length})</TabsTrigger>
          <TabsTrigger value="historial">Notificaciones entregadas ({log.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="reglas" className="mt-6">
          <ul className="border-t border-hairline">
            {prefs.rules.map((r) => <RuleRow key={r.id} rule={r} onChange={updateRule} onDelete={() => update({ rules: prefs.rules.filter((x) => x.id !== r.id) })} />)}
          </ul>
          {!prefs.rules.length && <p className="py-8 text-muted-foreground">No hay reglas. Añada una para empezar a recibir avisos.</p>}
          <Button variant="outline" className="mt-6" onClick={addRule}><Plus /> Añadir regla</Button>
        </TabsContent>
        <TabsContent value="historial" className="mt-6">
          {log.length === 0 ? (
            <p className="py-8 text-muted-foreground">Aún no se ha entregado ninguna notificación. Solo se avisa de eventos publicados después de activar las alertas.</p>
          ) : (
            <>
              <ol className="relative ml-2 border-l border-hairline">
                {log.map((l) => (
                  <li key={l.key} className="relative pb-6 pl-6">
                    <span className={cn("absolute -left-[5px] top-1.5 size-2.5 rounded-full", l.result === "error" ? "bg-destructive" : "bg-primary")} />
                    <div className="meta">Entregada {fmtDate(l.deliveredAt)} {fmtTime(l.deliveredAt)} · {l.channels.join(", ")}</div>
                    <div className="mt-1"><MagValue m={l.magnitude} className="text-lg" /> · {l.place}</div>
                    <div className="text-sm text-muted-foreground">Sismo de las {fmtTime(l.occurredAtUtc)} del {fmtDate(l.occurredAtUtc)} · regla «{l.ruleName}»{l.error && ` · error: ${l.error}`}</div>
                  </li>
                ))}
              </ol>
              <Button variant="ghost" size="sm" onClick={clearLog}>Borrar historial</Button>
            </>
          )}
        </TabsContent>
      </Tabs>
    </main>
  );
}
