import { classifyPoint, nearestProvince } from "./geo";
import { groupReports } from "./dedupe";
import type { SeismicEvent, SourceReport } from "./types";

/** Normalización → filtro geográfico → deduplicación. Devuelve eventos de Panamá y zona marítima. */
export function buildEvents(reports: SourceReport[], receivedAt: string): { events: SeismicEvent[]; excludedOutside: number } {
  const groups = groupReports(reports);
  const events: SeismicEvent[] = [];
  let excludedOutside = 0;
  for (const g of groups) {
    const primary = g[0];
    if (!primary) continue;
    const { classification, province } = classifyPoint(primary.longitude, primary.latitude);
    if (classification === "fuera") { excludedOutside++; continue; }
    events.push({ id: `${primary.sourceId}:${primary.externalId}`, primary, reports: g, classification, province, nearestProvince: classification === "maritima" ? nearestProvince(primary.longitude, primary.latitude) : null, receivedAt });
  }
  events.sort((a, b) => Date.parse(b.primary.occurredAtUtc) - Date.parse(a.primary.occurredAtUtc));
  return { events, excludedOutside };
}
