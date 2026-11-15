"use client";
// Aceternity UI — Aurora Background (instalado vía registry shadcn). Adaptado: colores tomados de los
// tokens del sistema (--aurora-a/b/c, --background), sin modo claro, y sin envolver en <main>/100vh.
import { cn } from "@/lib/utils";
import React, { ReactNode } from "react";

interface AuroraBackgroundProps extends React.HTMLProps<HTMLDivElement> {
  children: ReactNode;
  showRadialGradient?: boolean;
}

export const AuroraBackground = ({ className, children, showRadialGradient = true, ...props }: AuroraBackgroundProps) => {
  return (
    <div className={cn("relative isolate overflow-hidden", className)} {...props}>
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div
          className={cn(
            `after:animate-aurora absolute -inset-[10px] opacity-40 blur-[14px] will-change-transform
            [--aurora:repeating-linear-gradient(100deg,var(--aurora-a)_10%,var(--aurora-b)_15%,var(--aurora-c)_20%,var(--aurora-b)_25%,var(--aurora-a)_30%)]
            [--dark-gradient:repeating-linear-gradient(100deg,var(--background)_0%,var(--background)_7%,transparent_10%,transparent_12%,var(--background)_16%)]
            [background-image:var(--dark-gradient),var(--aurora)] [background-size:300%,_200%] [background-position:50%_50%,50%_50%]
            after:absolute after:inset-0 after:content-[""] after:[background-image:var(--dark-gradient),var(--aurora)]
            after:[background-size:200%,_100%] after:mix-blend-soft-light`,
            showRadialGradient && `[mask-image:radial-gradient(ellipse_at_80%_0%,black_10%,transparent_70%)]`,
          )}
        />
      </div>
      {children}
    </div>
  );
};
