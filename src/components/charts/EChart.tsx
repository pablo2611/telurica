import { useEffect, useRef } from "react";
import type { EChartsOption, ECharts } from "echarts";
import { cn } from "@/lib/utils";

/** Envoltorio de Apache ECharts: carga diferida en el navegador, redimensionado y limpieza al desmontar. */
export function EChart({ option, className, onClick, ariaLabel }: { option: EChartsOption; className?: string; onClick?: (p: { name: string; dataIndex: number; seriesName?: string }) => void; ariaLabel: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<ECharts | null>(null);
  const clickRef = useRef(onClick);
  clickRef.current = onClick;

  useEffect(() => {
    let disposed = false;
    let ro: ResizeObserver | null = null;
    import("echarts").then((echarts) => {
      if (disposed || !ref.current) return;
      chart.current = echarts.init(ref.current, undefined, { renderer: "canvas" });
      chart.current.setOption(option);
      chart.current.on("click", (p) => clickRef.current?.(p as never));
      ro = new ResizeObserver(() => chart.current?.resize());
      ro.observe(ref.current);
    });
    return () => { disposed = true; ro?.disconnect(); chart.current?.dispose(); chart.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { chart.current?.setOption(option, true); }, [option]);

  return <div ref={ref} role="img" aria-label={ariaLabel} className={cn("w-full", className)} />;
}
