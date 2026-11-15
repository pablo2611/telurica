import { cn } from "@/lib/utils";

/** GradientText — inspirado en React Bits. Degradado animado en el texto usando los tokens del tema. */
export function GradientText({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("rb-gradient-text", className)}>{children}</span>;
}
