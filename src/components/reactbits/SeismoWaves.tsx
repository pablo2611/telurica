import { useEffect, useRef } from "react";
import { cssColor } from "@/lib/css-color";
import { cn } from "@/lib/utils";

/**
 * SeismoWaves — fondo en canvas inspirado en "Threads"/"Waves" de React Bits, reinterpretado como
 * un sismograma: varias trazas con ruido suave y ráfagas ocasionales. `intensity` (0–1) aumenta la
 * amplitud, p. ej. cuando llega un sismo en vivo.
 */
export function SeismoWaves({ className, lines = 9, intensity = 0 }: { className?: string; lines?: number; intensity?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const intensityRef = useRef(intensity);
  intensityRef.current = intensity;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const color = cssColor("--primary");
    let w = 0, h = 0, raf = 0, t = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    const bursts = Array.from({ length: lines }, () => ({ at: Math.random(), amp: 0 }));

    const draw = () => {
      t += 0.012;
      ctx.clearRect(0, 0, w, h);
      for (let l = 0; l < lines; l++) {
        const y0 = (h / (lines + 1)) * (l + 1);
        const b = bursts[l]!;
        if (Math.random() < 0.002 + intensityRef.current * 0.02) b.amp = 18 + Math.random() * 30 * (1 + intensityRef.current * 2);
        b.amp *= 0.985;
        b.at = (b.at + 0.0015) % 1.2;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 4) {
          const nx = x / w;
          const base = Math.sin(nx * 9 + t * 1.3 + l) * 3 + Math.sin(nx * 23 - t * 2.1 + l * 2) * 1.6;
          const d = Math.abs(nx - b.at);
          const env = Math.exp(-d * d * 900);
          const burst = env * b.amp * Math.sin(nx * 260 + t * 30);
          const y = y0 + base + burst;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.08 + (l % 3 === 0 ? 0.12 : 0.04);
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (!reduce) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [lines]);

  return <canvas ref={ref} aria-hidden="true" className={cn("pointer-events-none absolute inset-0 h-full w-full", className)} />;
}
