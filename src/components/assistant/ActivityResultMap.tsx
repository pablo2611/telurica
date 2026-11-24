import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { SeismicMap } from "@/components/map/SeismicMap";
import { spatialActivity, CELL_AREA_KM2 } from "@/features/seismic/spatial-activity";
import type { AssistantReply } from "@/features/assistant/contract";

export function ActivityResultMap({ reply, bounds }: { reply: AssistantReply; bounds: [[number, number], [number, number]] | undefined }) {
  const navigate = useNavigate();
  const [metric, setMetric] = useState<"count" | "magnitude">("count");
  const [selected, setSelected] = useState<string | null>(null);
  const [limit, setLimit] = useState(5);
  const activity = useMemo(() => reply.activity ?? spatialActivity(reply.events), [reply.activity, reply.events]);
  const cells = useMemo(() => [...activity.cells].sort((a, b) => metric === "count" ? b.count - a.count : (b.maxMagnitude ?? -Infinity) - (a.maxMagnitude ?? -Infinity)), [activity.cells, metric]);
  const zone = activity.cells.find(cell => cell.id === selected);
  const focusedBounds = useMemo<[[number, number], [number, number]] | undefined>(() => zone
    ? [[zone.longitude - 0.3, zone.latitude - 0.22], [zone.longitude + 0.3, zone.latitude + 0.22]] : bounds, [zone, bounds]);
  return (
    <div className="savia-map">
      <div className="activity-intro">
        <div><h4>¿Dónde se concentra la actividad?</h4><p>{activity.total} registros distribuidos en {activity.cells.length} zonas de ~{CELL_AREA_KM2} km². El tamaño de las zonas se mantiene al acercar el mapa.</p></div>
        <div role="group" aria-label="Estadística del mapa" className="savia-result-actions">
          <button type="button" aria-pressed={metric === "count"} onClick={() => setMetric("count")}>Número de sismos</button>
          <button type="button" aria-pressed={metric === "magnitude"} onClick={() => setMetric("magnitude")}>Magnitud máxima</button>
        </div>
      </div>
      <SeismicMap events={reply.events} activity={activity} eventBounds={focusedBounds} interactive
        view={{ basemap: "dark", terrain: false, faults: true, heat: true, activityMetric: metric }}
        className="h-[420px] rounded-xl sm:h-[480px]" padding={{ top: 28, bottom: 70, left: 28, right: 28 }}
        onSelect={id => {
          const event = reply.events.find(item => item.id === id);
          if (event) void navigate({ to: "/monitor", search: { event: event.id, period: reply.period ?? "30d", lat: event.primary.latitude, lon: event.primary.longitude } });
        }} />
      <p className="savia-footnote">Toca un hexágono para consultar sus estadísticas. Los puntos individuales abren la ficha del sismo.</p>
      {zone && <p role="status" className="activity-selected-note">Zona seleccionada: {zone.place} · {zone.count} registros · magnitud máxima {zone.maxMagnitude?.toFixed(1) ?? "sin datos"} · {zone.land} terrestres y {zone.sea} marítimos. Profundidad media: {zone.meanDepth?.toFixed(1) ?? "sin datos"}{zone.meanDepth != null ? " km" : ""}.</p>}
      {cells.length ? <div className="savia-table-scroll" role="region" aria-label="Zonas de actividad sísmica" tabIndex={0}>
        <table className="savia-table">
          <caption>Zonas ordenadas por {metric === "count" ? "número de registros" : "magnitud máxima"} · selecciona una para ubicarla</caption>
          <thead><tr><th scope="col">Zona · centro aproximado</th><th scope="col">Registros</th><th scope="col">Magnitud máx.</th><th scope="col">Parte del catálogo</th></tr></thead>
          <tbody>{cells.slice(0, limit).map(cell => <tr key={cell.id}>
            <th scope="row"><button type="button" className="activity-zone-button" aria-pressed={selected === cell.id} onClick={() => setSelected(cell.id)}>{cell.place}<small>{cell.latitude.toFixed(2)}° N · {Math.abs(cell.longitude).toFixed(2)}° O</small></button></th>
            <td>{cell.count}</td><td>{cell.maxMagnitude?.toFixed(1) ?? "Sin datos"}</td><td>{activity.total ? (cell.count / activity.total * 100).toFixed(1) : "0"} %</td>
          </tr>)}</tbody>
        </table>
      </div> : <p className="savia-footnote">No hay registros en esta selección. Amplía el período para explorar más datos.</p>}
      <div className="activity-table-actions">
        {limit < cells.length && <button type="button" className="savia-text-button" onClick={() => setLimit(value => value + 20)}>Mostrar más zonas</button>}
        {selected && <button type="button" className="savia-text-button" onClick={() => setSelected(null)}>Ver toda la selección</button>}
      </div>
      {reply.mapTruncated && <p className="savia-footnote">{reply.activity ? "Los hexágonos incluyen todo el catálogo de la selección. Los puntos individuales muestran los 300 registros más recientes." : "Esta respuesta anterior contiene una muestra de 300 registros. Repite la consulta para calcular todas las zonas."}</p>}
      <aside className="activity-hazard-note">
        <strong>Amenaza sísmica a largo plazo</strong>
        <p>Este mapa cuenta sismos observados; sus porcentajes son proporciones del catálogo. La amenaza a largo plazo se estudia con modelos de fallas, recurrencia y movimiento del suelo. Una zona sin registros recientes también puede tener amenaza.</p>
        <a href="https://maps.openquake.org/map/gshm-v2026_1/" target="_blank" rel="noopener noreferrer">Abrir mapa probabilístico de GEM · v2026.1</a>
        <p>PGA en roca · 10 % de probabilidad de excedencia en 50 años. Consulta la normativa y estudios del terreno para decisiones de construcción.</p>
      </aside>
    </div>
  );
}
