import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type FormEvent } from "react";
import { Activity, Bot, ChartColumn, LoaderCircle, MapPinned, Send, ShieldCheck } from "lucide-react";
import { SeismicMap } from "@/components/map/SeismicMap";
import { Button } from "@/components/ui/button";
import { SUGGESTIONS, isSeismicQuestion, type AssistantReply } from "@/features/assistant/contract";

import { catalogAnswer } from "@/features/assistant/catalog-answer";
import { seismicQuery } from "@/features/seismic/queries";
import { periodStart } from "@/features/seismic/periods";
import { useHydrated } from "@/hooks/use-hydrated";

export const Route = createFileRoute("/savia")({
  head: () => ({ meta: [
    { title: "Savia · Asistente sísmico de Telúrica" },
    { name: "description", content: "Consulta las fuentes y estadísticas de Panamá con Savia. Respuestas con datos, gráficos y mapas de actividad observada." },
  ] }),
  component: Savia,
});

type Turn = { question: string; reply: AssistantReply };
const date = (value: string) => new Intl.DateTimeFormat("es-PA", {
  timeZone: "America/Panama", dateStyle: "medium", timeStyle: "short",
}).format(new Date(value));

function Savia() {
  const queryClient = useQueryClient();
  const hydrated = useHydrated();
  const [question, setQuestion] = useState("");
  const [period, setPeriod] = useState<"24h" | "7d" | "30d">("7d");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [visual, setVisual] = useState<"chart" | "map">("chart");
  const busy = useRef(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const status = useQuery({
    queryKey: ["savia-status"], retry: false, staleTime: 60_000, refetchOnWindowFocus: false,
    queryFn: async () => {
      const response = await fetch("/api/chat", { signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error("No se pudo comprobar el estado de Savia.");
      return await response.json() as { enabled: boolean; message: string };
    },
  });
  const latest = turns.at(-1)?.reply;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    if (!isSeismicQuestion(question)) {
      setError("Puedo ayudarte con sismos, fuentes y estadísticas de Panamá. Prueba una pregunta sugerida.");
      input.current?.focus();
      return;
    }
    busy.current = true;
    setPending(true);
    setError("");
    const submitted = question.trim();
    try {
      const response = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: submitted, period }), signal: AbortSignal.timeout(65000),
      });
      const body = await response.json().catch(() => ({ error: response.status === 429
        ? "Se alcanzó el límite temporal de consultas."
        : "El servicio de IA está temporalmente desconectado." })) as AssistantReply & { error?: string };
      if (response.status === 422) { setError(body.error ?? "Prueba una pregunta sobre sismicidad de Panamá."); return; }
      if (!response.ok) throw new Error(body.error ?? "No se pudo completar la consulta.");
      setTurns(previous => [...previous.slice(-5), { question: submitted, reply: body }]);
      setQuestion("");
    } catch (cause) {
      try {
        const catalog = await queryClient.fetchQuery({ ...seismicQuery(periodStart(period)), retry: false, staleTime: 60_000 });
        setTurns(previous => [...previous.slice(-5), { question: submitted, reply: catalogAnswer(catalog, submitted) }]);
        setQuestion("");
      } catch {
        setError("La IA y el catálogo están temporalmente sin respuesta. Puedes consultar Educación y Fuentes mientras se restablecen.");
        input.current?.focus();
      }
    } finally { busy.current = false; setPending(false); }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 pb-28 sm:px-6 lg:py-12">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-2xl">
          <div className="mb-3 flex items-center gap-2 text-sm text-primary"><Bot className="size-5" aria-hidden="true" /> Asistente de Telúrica</div>
          <h1 className="font-display text-4xl sm:text-5xl">Hola, soy Savia.</h1>
          <p className="mt-3 leading-relaxed text-muted-foreground">Te ayudo a interpretar la actividad sísmica de Panamá con datos de las fuentes. Pregunta por un período, compara provincias o explora los epicentros.</p>
        </div>
        <Link to="/fuentes" className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-border px-4 text-sm"><ShieldCheck className="size-4" aria-hidden="true" /> Consultar las fuentes</Link>
      </header>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,.85fr)]">
        <section className="min-w-0 rounded-2xl border border-border bg-surface p-4 sm:p-6" aria-labelledby="chat-title">
          <h2 id="chat-title" className="font-display text-xl">Conversemos sobre los datos</h2>
          <p className="mt-2 text-sm text-muted-foreground">Cada pregunta analiza el período elegido. Las respuestas pueden contener errores. Revisa sus cifras y fuentes.</p>
          <div className="my-5 grid gap-2 sm:grid-cols-2">
            {SUGGESTIONS.map(suggestion => (
              <button key={suggestion} type="button" disabled={pending || !hydrated} onClick={() => {
                setQuestion(suggestion); input.current?.focus();
                if (suggestion.includes("mapa")) setVisual("map");
              }} className="min-h-12 rounded-xl border border-border p-3 text-left text-sm transition-colors hover:border-primary/60 hover:bg-primary/5 disabled:opacity-50">{suggestion}</button>
            ))}
          </div>
          <div role="log" aria-label="Conversación con Savia" aria-live="polite" aria-relevant="additions" className="space-y-5">
            {turns.map((turn, index) => (
              <article key={index} className="space-y-3 border-t border-border pt-5">
                <h3 className="break-words font-medium">{turn.question}</h3>
                <p className="whitespace-pre-wrap break-words text-sm leading-7">{turn.reply.answer}</p>
                <p className="meta">{turn.reply.mode === "catalog" ? "Resumen automático del catálogo" : "Respuesta de IA"} · Catálogo consultado el {date(turn.reply.generatedAt)} · {turn.reply.total} registros</p>
              </article>
            ))}
          </div>
          <form action="/api/chat" method="post" onSubmit={submit} aria-labelledby="chat-title" className="mt-6 space-y-4">
            <fieldset disabled={pending || !hydrated}>
              <legend className="mb-2 text-sm font-medium">Período de la consulta</legend>
              <div className="flex flex-wrap gap-2">
                {([["24h", "24 horas"], ["7d", "7 días"], ["30d", "30 días"]] as const).map(([value, label]) => (
                  <label key={value} className="flex min-h-12 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-sm">
                    <input type="radio" name="period" value={value} checked={period === value} onChange={() => setPeriod(value)} className="accent-primary" />{label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div>
              <label htmlFor="savia-question" className="mb-2 block text-sm font-medium">Tu pregunta sobre Panamá</label>
              <textarea ref={input} id="savia-question" name="question" value={question} onChange={event => { setQuestion(event.target.value); setError(""); }}
                required minLength={8} maxLength={600} rows={3} disabled={pending || !hydrated}
                aria-describedby="savia-help" aria-invalid={!!error}
                onKeyDown={event => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
                    event.preventDefault(); event.currentTarget.form?.requestSubmit();
                  }
                }}
                className="w-full resize-y rounded-xl border border-border bg-background p-3 text-base leading-6 focus-visible:outline-2 focus-visible:outline-primary"
                placeholder="¿Cómo se distribuyen los sismos registrados entre tierra y mar?" />
              <p id="savia-help" className="mt-2 text-xs text-muted-foreground">Hasta 600 caracteres. Enter envía. Mayús + Enter añade una línea. Evita incluir datos personales.</p>
            </div>
            {error && <p role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm">{error}</p>}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p role="status" className="max-w-sm text-xs text-muted-foreground">
                {pending ? "Consultando las fuentes y preparando tu respuesta…" : status.isError ? "No se pudo comprobar la disponibilidad del chat." : status.data?.message ?? "Comprobando disponibilidad…"}
              </p>
              <Button type="submit" disabled={pending || !hydrated} className="min-h-12 gap-2">
                {pending ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
                {pending ? "Consultando" : "Consultar a Savia"}
              </Button>
            </div>
          </form>
        </section>

        <aside className="min-w-0 space-y-5" aria-label="Datos de la última respuesta">
          <section className="rounded-2xl border border-border bg-surface p-4 sm:p-6">
            <h2 className="flex items-center gap-2 font-display text-xl"><Activity className="size-5 text-primary" aria-hidden="true" /> Los datos detrás de la respuesta</h2>
            {latest ? (
              <>
                <p className="my-3 text-xs leading-5 text-muted-foreground">{date(latest.range.start)} — {date(latest.range.end)} · hora de Panamá</p>
                <dl className="my-5 grid grid-cols-2 gap-4">
                  <div><dt className="meta">Registros</dt><dd className="font-mono text-3xl text-primary">{latest.total}</dd></div>
                  <div><dt className="meta">Magnitud máxima</dt><dd className="font-mono text-3xl">{latest.maxMagnitude?.toFixed(1) ?? "Sin dato"}</dd></div>
                </dl>
                <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Visualización">
                  <button type="button" aria-pressed={visual === "chart"} onClick={() => setVisual("chart")} className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-border px-3 text-sm aria-pressed:bg-primary/10"><ChartColumn className="size-4" aria-hidden="true" /> Provincias</button>
                  <button type="button" aria-pressed={visual === "map"} onClick={() => setVisual("map")} className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-border px-3 text-sm aria-pressed:bg-primary/10"><MapPinned className="size-4" aria-hidden="true" /> Epicentros</button>
                </div>
                {visual === "chart" ? (
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium">Epicentros terrestres por provincia</h3>
                    {latest.provinces.length ? latest.provinces.map(([province, count]) => (
                      <div key={province}>
                        <div className="mb-1 flex justify-between gap-2 text-sm"><span>{province}</span><span className="font-mono">{count}</span></div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true"><div className="h-full rounded-full bg-primary" style={{ width: `${100 * count / Math.max(...latest.provinces.map(row => row[1]), 1)}%` }} /></div>
                      </div>
                    )) : <p className="text-sm text-muted-foreground">Sin epicentros terrestres asignados a provincias en este período.</p>}
                    <p className="text-xs text-muted-foreground">Los registros marítimos se contabilizan en el total y se muestran en el mapa.</p>
                  </div>
                ) : (
                  <div>
                    <SeismicMap events={latest.events} interactive view={{ basemap: "dark", terrain: false, faults: true, heat: true }} className="h-80 rounded-xl sm:h-96" padding={{ top: 24, bottom: 24, left: 24, right: 24 }} />
                    <p className="mt-3 text-xs leading-5 text-muted-foreground">Densidad observada de epicentros. {latest.mapTruncated ? "El mapa muestra los 300 registros más recientes del período." : "El mapa muestra los registros del período."} El color no indica probabilidad futura ni seguridad para construir.</p>
                    <Link to="/monitor" className="mt-2 inline-flex min-h-12 items-center text-sm text-primary underline">Abrir Monitor</Link>
                  </div>
                )}
                <div className="mt-6 border-t border-border pt-4">
                  <h3 className="mb-2 text-sm font-medium">Fuentes consultadas</h3>
                  <ul className="space-y-2 text-xs">{latest.sources.map(source => (
                    <li key={source.url}><a href={source.url} rel="noopener noreferrer" target="_blank" className="underline">{source.name}</a><span className="ml-2 text-muted-foreground">{source.state.replaceAll("_", " ")}</span></li>
                  ))}</ul>
                </div>
              </>
            ) : <p className="mt-4 text-sm leading-6 text-muted-foreground">Después de tu consulta aparecerán aquí las cifras y los gráficos calculados a partir del catálogo. Puedes elegir entre provincias y mapa de epicentros.</p>}
          </section>
          <section className="rounded-2xl border border-primary/20 bg-primary/5 p-5 text-sm leading-6">
            <h2 className="mb-2 font-medium">Antes de evaluar un terreno</h2>
            <p className="text-muted-foreground">La actividad reciente es una parte de la información. Una decisión de construcción requiere estudios geotécnicos, microzonificación y revisión profesional de la normativa aplicable. Savia ofrece orientación educativa.</p>
            <Link to="/educacion" className="mt-3 inline-flex min-h-12 items-center text-primary underline">Preparación y prevención</Link>
          </section>
        </aside>
      </div>
    </main>
  );
}
