import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * BlurText — inspirado en React Bits (reactbits.dev/text-animations/blur-text).
 * Reimplementado con `motion`: cada palabra entra desenfocada y sube a su sitio.
 */
export function BlurText({
  text,
  className,
  delay = 0,
  stagger = 0.08,
  as: Tag = "span",
  wordClassName,
}: {
  text: string;
  className?: string;
  wordClassName?: string;
  delay?: number;
  stagger?: number;
  as?: "span" | "h1" | "h2" | "p";
}) {
  const reduce = useReducedMotion();
  const lines = text.split("\n");
  let i = 0;
  return (
    <Tag className={cn("inline-block", className)} aria-label={text.replace(/\n/g, " ")}>
      {lines.map((line, li) => (
        <span key={li} className="block" aria-hidden="true">
          {line.split(" ").map((w, wi) => {
            const d = delay + i++ * stagger;
            return (
              <motion.span
                key={`${li}-${wi}`}
                className={cn("inline-block will-change-[filter,transform]", wordClassName)}
                initial={reduce ? false : { opacity: 0, filter: "blur(12px)", y: 18 }}
                animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
                transition={{ duration: 0.7, delay: d, ease: [0.22, 1, 0.36, 1] }}
              >
                {w}
                {wi < line.split(" ").length - 1 ? " " : ""}
              </motion.span>
            );
          })}
        </span>
      ))}
    </Tag>
  );
}
