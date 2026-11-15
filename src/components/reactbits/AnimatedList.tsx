import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * AnimatedList — inspirado en React Bits. Los elementos nuevos entran con escala/opacity
 * y la lista tiene degradados de desvanecimiento arriba y abajo.
 */
export function AnimatedList<T>({
  items,
  getKey,
  render,
  className,
  maxHeight = "28rem",
  empty,
}: {
  items: T[];
  getKey: (t: T) => string;
  render: (t: T, i: number) => React.ReactNode;
  className?: string;
  maxHeight?: string;
  empty?: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <div className={cn("relative", className)}>
      <ul className="space-y-2 overflow-y-auto overscroll-contain px-1 py-3 [scrollbar-width:thin]" style={{ maxHeight }}>
        <AnimatePresence initial={false}>
          {items.map((t, i) => (
            <motion.li
              key={getKey(t)}
              layout={!reduce}
              initial={reduce ? false : { opacity: 0, scale: 0.92, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            >
              {render(t, i)}
            </motion.li>
          ))}
        </AnimatePresence>
        {items.length === 0 && empty}
      </ul>
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-surface to-transparent" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-surface to-transparent" />
    </div>
  );
}
