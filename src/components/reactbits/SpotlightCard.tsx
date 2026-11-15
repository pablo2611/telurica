import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * SpotlightCard — inspirado en React Bits. Un foco radial sigue al cursor dentro de la tarjeta.
 * Usa variables CSS (sin re-render por movimiento).
 */
export function SpotlightCard({ children, className, color = "color-mix(in oklab, var(--primary) 22%, transparent)" }: { children: ReactNode; className?: string; color?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      onPointerMove={(e) => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty("--sx", `${e.clientX - r.left}px`);
        el.style.setProperty("--sy", `${e.clientY - r.top}px`);
      }}
      className={cn(
        "group/spot relative overflow-hidden rounded-xl border border-hairline bg-surface/70 backdrop-blur-sm transition-colors hover:border-primary/40",
        className,
      )}
      style={{ "--spot": color } as React.CSSProperties}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/spot:opacity-100"
        style={{ background: "radial-gradient(420px circle at var(--sx, 50%) var(--sy, 50%), var(--spot), transparent 65%)" }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}
