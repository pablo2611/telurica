import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";

const CHARS = "0123456789°′″NSEO·.-";

/** DecryptedText — inspirado en React Bits. Revela el texto carácter a carácter desde símbolos aleatorios. */
export function DecryptedText({ text, className, speed = 40 }: { text: string; className?: string; speed?: number }) {
  const reduce = useReducedMotion();
  const [out, setOut] = useState(text);
  useEffect(() => {
    if (reduce) return;
    let i = 0;
    const id = setInterval(() => {
      i++;
      setOut(
        text
          .split("")
          .map((ch, k) => (k < i || ch === " " ? ch : CHARS[Math.floor(Math.random() * CHARS.length)]))
          .join(""),
      );
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed, reduce]);
  return (
    <span className={className} aria-label={text}>
      <span aria-hidden="true">{out}</span>
    </span>
  );
}
