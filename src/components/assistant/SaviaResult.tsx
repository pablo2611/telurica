import { useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChartColumn, MapPinned, Table2 } from "lucide-react";
import { SeismicMap } from "@/components/map/SeismicMap";
import { EChart } from "@/components/charts/EChart";
import { baseChart } from "@/components/charts/theme";
import { cssColor } from "@/lib/css-color";
import { useHydrated } from "@/hooks/use-hydrated";
import { fmtCoord, fmtDepth, fmtMag, placeOf } from "@/features/seismic/format";
import { presentationFor } from "@/features/assistant/presentation";
import type { AssistantReply, ViewKind } from "@/features/assistant/contract";

export const saviaDate = (value: string) => new Intl.DateTimeFormat("es", {
  timeZone: "America/Panama", day: "2-digit", month: "short", year: "numeric",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
}).format(new Date(value));

function ResultTable({ reply, question }: { reply: AssistantReply; question: string }) {
  const [visible, setVisible] = useState(12);
  const kind = reply.presentation?.tableKind ?? presentationFor(question).tableKind;
  const headers = kind === "provinces" ? ["Provincia", "Epicentros terrestres", "Proporción terrestre"]
    : kind === "sources" ? ["Fuente", "Estado"]
    : kind === "daily" ? ["Día", "Terrestres", "Marítimos", "Total"]
    : ["Fecha · Panamá", "Ubicación", "Magnitud", "Profundidad", "Coordenadas"];
  const totalLand = reply.provinces.reduce((sum, row) => sum + row[1], 0);
  const rows = kind === "provinces" ? reply.provinces.map(([name, count]) => [name, count, totalLand ? `${(100 * count / totalLand).toFixed(1)} %` : "Sin datos"])
    : kind === "sources" ? reply.sources.map(source => [source.name, source.state.replaceAll("_", " ")])
    : kind === "daily" ? reply.days.map(day => [day.day, day.panama, day.maritima, day.panama + day.maritima])
    : reply.events.map(event => [saviaDate(event.primary.occurredAtUtc), placeOf(event), fmtMag(event.primary.magnitude), fmtDepth(event.primary.depthKm), fmtCoord(event.primary.latitude, event.primary.longitude)]);
  return (
    <div>
      <div className="savia-table-scroll" role="region" aria-label="Tabla de datos sísmicos" tabIndex={0}>
        <table className="savia-table">
          <caption>{kind === "provinces" ? "Distribución por provincia · solo epicentros terrestres" : kind === "sources" ? "Estado de las fuentes consultadas" : kind === "daily" ? "Actividad diaria · hora de Panamá" : "Registros del período · más recientes primero"}</caption>
          <thead><tr>{headers.map(header => <th key={header} scope="col">{header}</th>)}</tr></thead>
          <tbody>{rows.slice(0, visible).map((row, index) => <tr key={index}>{row.map((cell, column) => column === 0 ? <th key={column} scope="row">{cell}</th> : <td key={column}>{cell}</td>)}</tr>)}</tbody>
        </table>
        {!rows.length && <p className="p-5 text-sm text-muted-foreground">No hay registros para esta selección.</p>}
      </div>
      {visible < rows.length && <button type="button" onClick={() => setVisible(count => count + 20)} className="savia-text-button">Mostrar más filas</button>}
      {kind === "events" && reply.mapTruncated && <p className="savia-footnote">La tabla incluye los 300 registros más recientes. Las cifras agregadas corresponden al catálogo completo de esta selección.</p>}
    </div>
  );
}

function ResultChart({ reply }: { reply: AssistantReply }) {
  const hydrated = useHydrated();
  const daily = reply.presentation?.chartKind === "daily";
  const option = useMemo<EChartsOption>(() => {
    if (!hydrated) return {};
    const theme = baseChart();
    return {
      animation: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      animationDuration: 400,
      grid: { left: 12, right: 18, top: 20, bottom: 20, containLabel: true },
      tooltip: { ...theme.tooltip, trigger: "axis", renderMode: "richText" },
      xAxis: { ...theme.axis, type: "category", data: daily ? reply.days.map(day => day.day) : reply.provinces.map(row => row[0]), axisLabel: { ...theme.axis.axisLabel, rotate: daily ? 0 : 25 } },
      yAxis: { ...theme.axis, type: "value", minInterval: 1 },
      series: daily ? [
        { name: "Terrestres", type: "line", showSymbol: false, data: reply.days.map(day => day.panama), lineStyle: { width: 2, color: cssColor("--primary") }, itemStyle: { color: cssColor("--primary") }, areaStyle: { color: cssColor("--primary", 0.1) } },
        { name: "Marítimos", type: "line", showSymbol: false, data: reply.days.map(day => day.maritima), lineStyle: { width: 2, color: "#8aa9ff" }, itemStyle: { color: "#8aa9ff" } },
      ] : [{ name: "Epicentros terrestres", type: "bar", data: reply.provinces.map(row => row[1]), itemStyle: { color: cssColor("--primary"), borderRadius: [4, 4, 0, 0] }, barMaxWidth: 38 }],
    };
  }, [reply, daily, hydrated]);
  return (
    <div className="savia-chart">
      <h4>{daily ? "Evolución diaria de los registros" : "Epicentros terrestres por provincia"}</h4>
      {hydrated && <EChart option={option} ariaLabel={daily ? "Gráfica de evolución diaria de sismos terrestres y marítimos" : "Gráfica de epicentros terrestres por provincia"} className="h-72 sm:h-80" />}
      {daily && <p className="savia-footnote">Turquesa · terrestres. Azul · marítimos. Usa la tabla para consultar los valores exactos.</p>}
    </div>
  );
}

export function SaviaResult({ reply, question }: { reply: AssistantReply; question: string }) {
  const navigate = useNavigate();
  const presentation = reply.presentation ?? presentationFor(question);
  const [views, setViews] = useState<ViewKind[]>(presentation.views);
  const bounds = useMemo<[[number, number], [number, number]] | undefined>(() => {
    if (!presentation.regions.length || !reply.events.length) return undefined;
    const longitude = reply.events.map(event => event.primary.longitude);
    const latitude = reply.events.map(event => event.primary.latitude);
    return [[Math.min(...longitude) - 0.08, Math.min(...latitude) - 0.08], [Math.max(...longitude) + 0.08, Math.max(...latitude) + 0.08]];
  }, [presentation.regions, reply.events]);
  function toggle(view: ViewKind) {
    setViews(current => current.includes(view) ? current.filter(item => item !== view) : [...current, view]);
  }
  return (
    <div className="savia-result">
      <div className="savia-result-summary">
        <span><strong>{reply.total}</strong> registros</span>
        <span><strong>{reply.maxMagnitude?.toFixed(1) ?? "—"}</strong> magnitud máxima</span>
        {presentation.regions.length > 0 && <span className="savia-scope">{presentation.regions.join(" · ")}</span>}
      </div>
      <div className="savia-result-actions" role="group" aria-label="Visualización de esta respuesta">
        {([{ id: "table", label: "Tabla", icon: Table2 }, { id: "chart", label: "Gráfica", icon: ChartColumn }, { id: "map", label: "Mapa", icon: MapPinned }] as const).map(view => (
          <button key={view.id} type="button" aria-pressed={views.includes(view.id)} onClick={() => toggle(view.id)}><view.icon className="size-4" aria-hidden="true" />{view.label}</button>
        ))}
      </div>
      {views.includes("table") && <ResultTable reply={reply} question={question} />}
      {views.includes("chart") && <ResultChart reply={reply} />}
      {views.includes("map") && (
        <div className="savia-map">
          <SeismicMap events={reply.events} eventBounds={bounds} interactive
            view={{ basemap: "dark", terrain: false, faults: true, heat: true }}
            className="h-80 rounded-xl sm:h-[420px]" padding={{ top: 28, bottom: 28, left: 28, right: 28 }}
            onSelect={id => {
              const event = reply.events.find(item => item.id === id);
              if (event) void navigate({ to: "/monitor", search: { event: event.id, period: reply.period ?? "30d", lat: event.primary.latitude, lon: event.primary.longitude } });
            }} />
          <p className="savia-footnote">Densidad observada de epicentros{reply.mapTruncated ? " · muestra de los 300 registros más recientes" : ""}. Los colores describen este catálogo y período. La evaluación de un terreno requiere estudios geotécnicos y revisión profesional.</p>
          <Link to="/monitor" className="savia-text-button">Explorar en el Monitor</Link>
        </div>
      )}
      <details className="savia-sources">
        <summary>Fuentes y período de esta respuesta</summary>
        <p>{saviaDate(reply.range.start)} — {saviaDate(reply.range.end)} · hora de Panamá</p>
        <ul>{reply.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.name}</a><span>{source.state.replaceAll("_", " ")}</span></li>)}</ul>
      </details>
    </div>
  );
}
