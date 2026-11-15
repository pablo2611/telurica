import { useId } from "react";
import { cn } from "@/lib/utils";

/** Isotipo de Telúrica: sismograma con epicentro. Mismo diseño que public/favicon.svg. */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="#14333a" />
          <stop offset="1" stopColor="#091317" />
        </linearGradient>
        <linearGradient id={`${id}ln`} x1="8" y1="0" x2="56" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5fd0d6" stopOpacity=".35" />
          <stop offset=".45" stopColor="#5fd0d6" />
          <stop offset="1" stopColor="#5fd0d6" stopOpacity=".35" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="62" height="62" rx="16" fill={`url(#${id}bg)`} />
      <rect x="1.5" y="1.5" width="61" height="61" rx="15.5" stroke="#5fd0d6" strokeOpacity=".35" />
      <circle cx="32" cy="17" r="9" stroke="#f39a3c" strokeOpacity=".28" strokeWidth="1.5" className="origin-center [transform-box:fill-box] motion-safe:animate-[blip_2.4s_ease-out_infinite]" />
      <polyline points="9,38 19,38 23,33 27,44 32,17 37,51 41,32 45,40 48,38 55,38" stroke={`url(#${id}ln)`} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="32" cy="17" r="3.4" fill="#f39a3c" />
    </svg>
  );
}

/** Logotipo completo: isotipo + "telúrica" (la ú en color de acento). */
export function Logo({ className, size = "md", tagline = true }: { className?: string; size?: "sm" | "md" | "lg"; tagline?: boolean }) {
  const s = { sm: { mark: "size-7", word: "text-lg" }, md: { mark: "size-9", word: "text-[1.35rem]" }, lg: { mark: "size-14", word: "text-4xl" } }[size];
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={cn(s.mark, "shrink-0 drop-shadow-[0_6px_18px_rgba(95,208,214,0.18)]")} />
      <span className="flex flex-col leading-none">
        <span className={cn("font-brand text-foreground", s.word)}>
          tel<span className="text-primary">ú</span>rica
        </span>
        {tagline && <span className="mt-1 font-mono text-[0.55rem] uppercase tracking-[0.24em] text-muted-foreground">Sismos · Panamá</span>}
      </span>
    </span>
  );
}
