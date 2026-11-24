import { Square } from "lucide-react";
import { PHASES, type ChatPhase } from "@/features/assistant/contract";

export function SaviaThinking({ phase, elapsed, onStop }: { phase: ChatPhase; elapsed: number; onStop: () => void }) {
  const active = PHASES.findIndex(item => item.id === phase);
  return (
    <div className="savia-thinking" role="status" aria-live="polite">
      <progress className="savia-progress" aria-label={PHASES[active]?.label ?? "Preparando respuesta"} />
      <div className="savia-thinking-body min-w-0">
        <p className="savia-thinking-title">{PHASES[active]?.label}</p>
        <p className="savia-thinking-detail">{PHASES[active]?.detail}</p>
        <div className="savia-steps" aria-hidden="true">{PHASES.map((step, index) => <span key={step.id} data-state={index < active ? "done" : index === active ? "active" : "waiting"} />)}</div>
        <div className="savia-wait-meta"><span aria-live="off">{elapsed} s transcurridos</span><button type="button" onClick={onStop}><Square className="size-3" aria-hidden="true" /> Detener consulta</button></div>
        {elapsed >= 12 && <p className="savia-thinking-detail">La fuente está tardando más de lo habitual. Puedes detener la consulta. La espera máxima es de 45 segundos.</p>}
      </div>
    </div>
  );
}
