import { PHASES, type ChatPhase } from "@/features/assistant/contract";

export function SaviaThinking({ phase }: { phase: ChatPhase }) {
  const active = PHASES.findIndex(item => item.id === phase);
  return (
    <div className="savia-thinking" role="status" aria-live="polite">
      <progress className="savia-progress" aria-label={PHASES[active]?.label ?? "Preparando respuesta"} />
      <div className="min-w-0">
        <p className="savia-thinking-title">{PHASES[active]?.label}</p>
        <p className="savia-thinking-detail">{PHASES[active]?.detail}</p>
        <div className="savia-steps" aria-hidden="true">{PHASES.map((step, index) => <span key={step.id} data-state={index < active ? "done" : index === active ? "active" : "waiting"} />)}</div>
      </div>
    </div>
  );
}
