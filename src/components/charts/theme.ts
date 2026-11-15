import { cssColor } from "@/lib/css-color";
/** Estilo base de ejes y texto para ECharts tomado de los tokens del sistema. */
export function baseChart() {
  const text = cssColor("--muted-foreground");
  const line = cssColor("--foreground", 0.12);
  const axis = {
    axisLine: { lineStyle: { color: line } },
    axisTick: { show: false },
    axisLabel: { color: text, fontFamily: "IBM Plex Mono", fontSize: 11 },
    splitLine: { lineStyle: { color: cssColor("--foreground", 0.06) } },
    nameTextStyle: { color: text, fontFamily: "IBM Plex Mono", fontSize: 11 },
  };
  return {
    text,
    axis,
    tooltip: {
      backgroundColor: cssColor("--popover"),
      borderColor: cssColor("--border"),
      textStyle: { color: cssColor("--foreground"), fontFamily: "IBM Plex Sans", fontSize: 12 },
    },
    legend: { textStyle: { color: text, fontFamily: "IBM Plex Sans" }, icon: "roundRect", itemWidth: 10, itemHeight: 10 },
    textStyle: { fontFamily: "IBM Plex Sans" },
  };
}
