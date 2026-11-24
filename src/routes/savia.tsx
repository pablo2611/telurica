import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type FormEvent } from "react";
import { Bot, ChartColumn, MapPinned, Send, ShieldCheck, Sparkles, Square, Table2 } from "lucide-react";
import { SaviaResult, saviaDate } from "@/components/assistant/SaviaResult";
import { SaviaThinking } from "@/components/assistant/SaviaThinking";
import { SUGGESTIONS, isSeismicQuestion, type AssistantReply, type ChatPhase, type AssistantInput } from "@/features/assistant/contract";
import { readAssistant } from "@/features/assistant/stream";
import { requestedPeriod } from "@/features/assistant/presentation";
import { catalogAnswer } from "@/features/assistant/catalog-answer";
import { seismicQuery } from "@/features/seismic/queries";
import { periodStart } from "@/features/seismic/periods";
import { useHydrated } from "@/hooks/use-hydrated";

export const Route = createFileRoute("/savia")({
  head: () => ({ meta: [
    { title: "Savia · Asistente sísmico de Telúrica" },
    { name: "description", content: "Pregunta por los sismos de Panamá y recibe explicaciones, tablas, gráficas y mapas con datos de las fuentes." },
  ] }),
  component: Savia,
});

type Turn = { id: number; question: string; reply: AssistantReply };
const icons = [Sparkles, Table2, MapPinned, ChartColumn];

function Savia() {
  const queryClient = useQueryClient();
  const hydrated = useHydrated();
  const [question, setQuestion] = useState("");
  const [period, setPeriod] = useState<AssistantInput["period"]>("7d");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pendingQuestion, setPendingQuestion] = useState("");
  const [phase, setPhase] = useState<ChatPhase>("planning");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  const active = useRef<AbortController | null>(null);
  const resultAnchor = useRef<HTMLDivElement>(null);
  const sequence = useRef(0);
  const pending = !!pendingQuestion;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (active.current) return;
    const submitted = question.trim();
    const history = turns.slice(-4).map(turn => turn.question.slice(0, 3000));
    if (!isSeismicQuestion([...history, submitted].join(" "))) {
      setError("Pregúntame por los sismos, las fuentes o los datos de Panamá.");
      input.current?.focus();
      return;
    }
    const controller = new AbortController();
    active.current = controller;
    setPendingQuestion(submitted);
    setPhase("planning");
    setError("");
    setNotice("");
    const data = { question: submitted, period, history };
    const addReply = (reply: AssistantReply) => {
      if (controller.signal.aborted) return;
      sequence.current += 1;
      const id = sequence.current;
      setTurns(previous => [...previous, { id, question: submitted, reply }]);
      setQuestion("");
      setPeriod(requestedPeriod(data));
      requestAnimationFrame(() => resultAnchor.current?.scrollIntoView({ behavior: "instant", block: "start" }));
    };
    try {
      const response = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify(data), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(65000)]),
      });
      addReply(await readAssistant(response, setPhase));
    } catch {
      if (controller.signal.aborted) {
        setNotice("Consulta detenida. Puedes editar tu pregunta y volver a enviarla.");
      } else {
        try {
          setPhase("sources");
          const catalog = await queryClient.fetchQuery({ ...seismicQuery(periodStart(requestedPeriod(data))), retry: false, staleTime: 60_000 });
          if (!controller.signal.aborted) addReply(catalogAnswer(catalog, submitted, history.at(-1)));
        } catch {
          setError("Las fuentes están temporalmente sin respuesta. Puedes consultar Fuentes y volver a intentarlo.");
          input.current?.focus();
        }
      }
    } finally {
      active.current = null;
      setPendingQuestion("");
    }
  }

  return (
    <main className="savia-page">
      <header className="savia-topline">
        <span><span className="savia-signal" aria-hidden="true" /> Savia · Telúrica</span>
        <Link to="/fuentes"><ShieldCheck className="size-4" aria-hidden="true" /> Fuentes de los datos</Link>
      </header>
      <section className={turns.length ? "savia-intro savia-intro-compact" : "savia-intro"} aria-labelledby="savia-title">
        <div className="savia-orb" aria-hidden="true"><span /><Bot /></div>
        <p className="savia-eyebrow">Tu observatorio, en una conversación</p>
        <h1 id="savia-title">Hola, soy Savia.</h1>
        <p>Pregunta por Panamá. Exploremos sus datos con <span>tablas, gráficas y mapas.</span></p>
        {!turns.length && <div className="savia-starters">
          {SUGGESTIONS.map((suggestion, index) => {
            const Icon = icons[index] ?? Sparkles;
            return <button key={suggestion} type="button" disabled={pending || !hydrated} onClick={() => { setQuestion(suggestion); input.current?.focus(); }}>
              <Icon aria-hidden="true" /><span>{suggestion}</span>
            </button>;
          })}
        </div>}
      </section>

      <section className="savia-conversation" aria-label="Conversación con Savia">
        <div role="log" aria-label="Conversación con Savia" aria-live="polite" aria-relevant="additions">
          {turns.map((turn, index) => (
            <article className="savia-turn" key={turn.id}>
              {index === turns.length - 1 && <div ref={resultAnchor} className="savia-result-anchor" />}
              <div className="savia-user-message"><h2>{turn.question}</h2></div>
              <div className="savia-assistant-message">
                <div className="savia-author"><span className="savia-avatar"><Bot aria-hidden="true" /></span><strong>Savia</strong><span>{turn.reply.mode === "catalog" ? "Datos del catálogo" : "Análisis con IA"}</span></div>
                <div className="savia-prose">{turn.reply.answer.split("\n\n").map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{paragraph}</p>)}</div>
                <SaviaResult reply={turn.reply} question={turn.question} />
                <p className="savia-footnote">Datos consultados el {saviaDate(turn.reply.generatedAt)} · hora de Panamá</p>
              </div>
            </article>
          ))}
        </div>
        {pending && <div className="savia-turn"><div className="savia-user-message"><h2>{pendingQuestion}</h2></div><SaviaThinking phase={phase} /></div>}
      </section>

      <form action="/api/chat" method="post" onSubmit={submit} aria-label="Pregunta a Savia" className="savia-composer">
        <label htmlFor="savia-question" className="sr-only">Tu pregunta sobre Panamá</label>
        <textarea ref={input} id="savia-question" name="question" value={question} onChange={event => { setQuestion(event.target.value); setError(""); }}
          required minLength={8} maxLength={12000} rows={2} disabled={pending || !hydrated}
          aria-describedby="savia-help" aria-invalid={!!error}
          onKeyDown={event => {
            if (event.key === "Enter" && !event.shiftKey) {
              if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
              event.preventDefault(); event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder="Pídele una tabla, un mapa o una explicación…" />
        <div className="savia-composer-bottom">
          <div className="savia-period">
            <label htmlFor="savia-period">Período</label>
            <select id="savia-period" name="period" value={period} disabled={pending || !hydrated} onChange={event => setPeriod(event.target.value as AssistantInput["period"])}>
              <option value="24h">Últimas 24 horas</option><option value="7d">Últimos 7 días</option><option value="30d">Últimos 30 días</option><option value="90d">Últimos 90 días</option><option value="365d">Último año</option>
            </select>
          </div>
          {pending ? <button type="button" className="savia-submit savia-stop" onClick={() => active.current?.abort()}><Square className="size-4" aria-hidden="true" /> Detener</button>
            : <button type="submit" className="savia-submit" disabled={!hydrated}><Send className="size-4" aria-hidden="true" /> Consultar a Savia</button>}
        </div>
        {error && <p role="alert" className="savia-form-error">{error}</p>}
        {notice && <p role="status" className="savia-footnote">{notice}</p>}
      </form>
      <p id="savia-help" className="savia-help">Enter para enviar · Mayús + Enter para una nueva línea. Verifica las fuentes antes de tomar decisiones.</p>
      <p className="savia-disclaimer">Actividad observada y orientación educativa. Para construir, consulta estudios geotécnicos y a un profesional. <Link to="/educacion">Preparación y prevención</Link></p>
    </main>
  );
}
