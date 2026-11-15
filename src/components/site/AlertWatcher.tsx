import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { onNewLiveEvent, requestFreshSync, startRealtime } from "@/features/seismic/realtime";
import { planNotifications } from "@/features/seismic/alerts";
import { appendLog, getLog, getSeen, setSeen, updateLog, usePrefs } from "@/features/seismic/alert-store";
import { fmtMag, fmtTime, placeOf } from "@/features/seismic/format";
import { useSeismicPeriod } from "@/features/seismic/queries";

export function playChime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [660, 880].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      o.type = "sine";
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18);
      g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + i * 0.18 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.4);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.18);
      o.stop(ctx.currentTime + i * 0.18 + 0.45);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch {
    /* audio no disponible */
  }
}

/**
 * Motor de notificaciones en la página abierta. Consume eventos ya normalizados y clasificados.
 * La primera carga fija una línea base: solo se notifican eventos que aparezcan después.
 */
/** Parpadea el título de la pestaña cuando llega una alerta con la página en segundo plano. */
function flashTitle(text: string) {
  if (typeof document === "undefined" || document.visibilityState === "visible") return;
  const original = document.title;
  let on = false;
  const id = setInterval(() => {
    document.title = on ? original : text;
    on = !on;
  }, 1000);
  const stop = () => {
    if (document.visibilityState !== "visible") return;
    clearInterval(id);
    document.title = original;
    document.removeEventListener("visibilitychange", stop);
  };
  document.addEventListener("visibilitychange", stop);
}

/**
 * Puente de tiempo real: abre el WebSocket de EMSC y el feed de USGS. Cuando aparece un sismo nuevo
 * cerca de Panamá, pide al servidor una sincronización inmediata (las alertas usan datos consolidados)
 * y muestra un aviso preliminar.
 */
export function RealtimeBridge() {
  const qc = useQueryClient();
  const prefs = usePrefs();
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  useEffect(() => {
    const stop = startRealtime();
    const off = onNewLiveEvent((e) => {
      requestFreshSync();
      void qc.invalidateQueries({ queryKey: ["seismic"] });
      const p = prefsRef.current;
      const min = Math.min(...p.rules.filter((r) => r.enabled).map((r) => r.minMagnitude), 99);
      if (p.enabled && (e.magnitude ?? 0) >= min - 0.5) {
        toast(`Detección en vivo · M ${fmtMag(e.magnitude)}`, {
          description: `${e.place ?? "Cerca de Panamá"} · ${fmtTime(e.occurredAtUtc)} · dato preliminar de ${e.sources.map((x) => x.toUpperCase()).join(" + ")}, confirmando…`,
        });
      }
    });
    return () => {
      off();
      stop();
    };
  }, [qc]);
  return null;
}

export function AlertWatcher() {
  const prefs = usePrefs();
  const { data } = useSeismicPeriod("7d");
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  useEffect(() => {
    if (!data) return;
    const ids = new Set(data.events.map((e) => e.id));
    const seen = getSeen();
    if (!seen) { setSeen(ids); return; }
    const delivered = new Set(getLog().map((l) => l.key));
    const plan = planNotifications(data.events, prefsRef.current, seen, delivered);
    for (const { rule, event, key } of plan) {
      const channels = ["plataforma"];
      if (prefsRef.current.browser && "Notification" in window && Notification.permission === "granted") channels.push("navegador");
      if (prefsRef.current.sound) channels.push("sonido");
      const title = `M ${fmtMag(event.primary.magnitude)} · ${placeOf(event)}`;
      // Registrar antes de entregar para evitar duplicados.
      appendLog({
        key, ruleId: rule.id, ruleName: rule.name, eventId: event.id, magnitude: event.primary.magnitude,
        place: placeOf(event), occurredAtUtc: event.primary.occurredAtUtc, deliveredAt: new Date().toISOString(), channels, result: "entregada",
      });
      try {
        toast(title, { description: `${fmtTime(event.primary.occurredAtUtc)} hora de Panamá · regla «${rule.name}». Notificación de la plataforma, no es un aviso oficial.` });
        if (channels.includes("navegador")) new Notification(title, { body: `Regla «${rule.name}». Consulte fuentes oficiales.`, tag: key });
        if (channels.includes("sonido")) playChime();
        if ("vibrate" in navigator) navigator.vibrate?.([200, 100, 200]);
        flashTitle(`⚠ ${title}`);
      } catch (err) {
        updateLog(key, { result: "error", error: err instanceof Error ? err.message : "Error de entrega" });
      }
    }
    for (const id of ids) seen.add(id);
    setSeen(seen);
  }, [data]);
  return null;
}
