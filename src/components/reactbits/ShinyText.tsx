import { cn } from "@/lib/utils";

/** ShinyText — inspirado en React Bits. Brillo que recorre el texto (CSS puro, ver .rb-shiny en styles.css). */
export function ShinyText({ children, className, speed = 3 }: { children: React.ReactNode; className?: string; speed?: number }) {
  return (
    <span className={cn("rb-shiny", className)} style={{ animationDuration: `${speed}s` }}>
      {children}
    </span>
  );
}
