import { useEffect, useRef } from "react";
import { useInView, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { cn } from "@/lib/utils";

/** CountUp — inspirado en React Bits. Cuenta hasta `to` cuando entra en pantalla y anima los cambios en vivo. */
export function CountUp({ to, decimals = 0, className, duration = 1.6 }: { to: number; decimals?: number; className?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { damping: 30 + duration * 10, stiffness: 90 / duration });
  const inView = useInView(ref, { once: true, margin: "0px" });
  const fmt = new Intl.NumberFormat("es-PA", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      if (ref.current) ref.current.textContent = fmt.format(to);
      return;
    }
    mv.set(to);
  }, [inView, to, reduce]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(
    () =>
      spring.on("change", (v) => {
        if (ref.current) ref.current.textContent = fmt.format(Number(v.toFixed(decimals)));
      }),
    [spring, decimals], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <span ref={ref} className={cn("num tabular-nums", className)}>
      {fmt.format(0)}
    </span>
  );
}
