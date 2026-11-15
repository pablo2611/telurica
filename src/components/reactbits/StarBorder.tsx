import { cn } from "@/lib/utils";

/** StarBorder — inspirado en React Bits. Borde con destellos que recorren el contorno (ver .rb-star en styles.css). */
export function StarBorder({ children, className, innerClassName }: { children: React.ReactNode; className?: string; innerClassName?: string }) {
  return (
    <span className={cn("rb-star relative inline-flex overflow-hidden rounded-lg p-px", className)}>
      <span aria-hidden="true" className="rb-star-top" />
      <span aria-hidden="true" className="rb-star-bottom" />
      <span className={cn("relative z-[1] inline-flex items-center gap-2 rounded-[calc(0.5rem-1px)] bg-background/90 px-4 py-2", innerClassName)}>{children}</span>
    </span>
  );
}
