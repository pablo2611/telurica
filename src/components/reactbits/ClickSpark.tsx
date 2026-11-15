import { useEffect, useRef, type ReactNode } from "react";
import { cssColor } from "@/lib/css-color";

/** ClickSpark — inspirado en React Bits. Destellos radiales en cada clic dentro del contenedor. */
export function ClickSpark({ children, count = 8, radius = 18, className }: { children: ReactNode; count?: number; radius?: number; className?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const sparks = useRef<{ x: number; y: number; a: number; t0: number }[]>([]);

  useEffect(() => {
    const c = canvas.current, el = wrap.current;
    if (!c || !el) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const color = cssColor("--primary");
    let raf = 0;
    const resize = () => {
      c.width = el.clientWidth;
      c.height = el.clientHeight;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();
    const loop = (now: number) => {
      ctx.clearRect(0, 0, c.width, c.height);
      sparks.current = sparks.current.filter((s) => {
        const p = (now - s.t0) / 450;
        if (p >= 1) return false;
        const e = p * (2 - p);
        const d = e * radius;
        const len = 10 * (1 - e);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(s.x + d * Math.cos(s.a), s.y + d * Math.sin(s.a));
        ctx.lineTo(s.x + (d + len) * Math.cos(s.a), s.y + (d + len) * Math.sin(s.a));
        ctx.stroke();
        return true;
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [radius]);

  return (
    <div
      ref={wrap}
      className={className}
      style={{ position: "relative" }}
      onPointerDown={(e) => {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const r = wrap.current!.getBoundingClientRect();
        const now = performance.now();
        for (let i = 0; i < count; i++) sparks.current.push({ x: e.clientX - r.left, y: e.clientY - r.top, a: (2 * Math.PI * i) / count, t0: now });
      }}
    >
      {children}
      <canvas ref={canvas} aria-hidden="true" className="pointer-events-none absolute inset-0" />
    </div>
  );
}
