// Fixtures de prueba aislados: no se usan en producción.
import { describe, expect, it } from "vitest";
import { classifyPoint } from "@/features/seismic/geo";
import { groupReports } from "@/features/seismic/dedupe";
import { normalizeEmsc, normalizeUsgs } from "@/features/seismic/adapters";
import { buildEvents } from "@/features/seismic/pipeline";
import { planNotifications, DEFAULT_PREFS } from "@/features/seismic/alerts";
import { fmtDate, fmtTime } from "@/features/seismic/format";
import { summarize } from "@/features/seismic/stats";
import { toCsv, toGeoJson } from "@/features/seismic/export";
import type { SourceReport } from "@/features/seismic/types";

const rep = (o: Partial<SourceReport>): SourceReport => ({
  sourceId: "usgs", externalId: "x", magnitude: 4.5, magnitudeType: "mb", latitude: 8.5, longitude: -80.5, depthKm: 20,
  occurredAtUtc: "2026-11-10T12:00:00.000Z", updatedAt: null, placeReported: null, reviewStatus: "reviewed", author: "us",
  sourceUrl: "https://example.test", ...o,
});

describe("clasificación geográfica", () => {
  it("Ciudad de Panamá está dentro de Panamá", () => {
    const r = classifyPoint(-79.52, 8.98);
    expect(r.classification).toBe("panama");
    expect(r.province).toBe("Panamá");
  });
  it("David (Chiriquí) se asigna a su provincia", () => {
    expect(classifyPoint(-82.43, 8.43)).toEqual({ classification: "panama", province: "Chiriquí" });
  });
  it("San José, Costa Rica queda fuera de cobertura", () => {
    expect(classifyPoint(-84.09, 9.93).classification).toBe("fuera");
  });
  it("Un punto en el Pacífico al sur de Chiriquí es zona marítima próxima", () => {
    expect(classifyPoint(-82.0, 7.2).classification).toBe("maritima");
  });
  it("Un punto lejano en el Pacífico queda fuera", () => {
    expect(classifyPoint(-82.0, 4.0).classification).toBe("fuera");
  });
});

describe("deduplicación", () => {
  it("agrupa el mismo sismo reportado por USGS y EMSC y conserva ambas mediciones", () => {
    const g = groupReports([
      rep({ sourceId: "usgs", externalId: "us1", magnitude: 4.6 }),
      rep({ sourceId: "emsc", externalId: "em1", magnitude: 4.4, occurredAtUtc: "2026-11-10T12:00:08.000Z", latitude: 8.6 }),
    ]);
    expect(g).toHaveLength(1);
    expect(g[0]!.map((r) => r.magnitude)).toEqual([4.6, 4.4]);
    expect(g[0]![0]!.sourceId).toBe("usgs");
  });
  it("no agrupa sismos separados por más de 30 s", () => {
    const g = groupReports([rep({ externalId: "a" }), rep({ sourceId: "emsc", externalId: "b", occurredAtUtc: "2026-11-10T12:01:00.000Z" })]);
    expect(g).toHaveLength(2);
  });
  it("no agrupa sismos a más de 60 km", () => {
    const g = groupReports([rep({ externalId: "a" }), rep({ sourceId: "emsc", externalId: "b", latitude: 9.5 })]);
    expect(g).toHaveLength(2);
  });
  it("no duplica un reporte repetido de la misma fuente", () => {
    expect(groupReports([rep({ externalId: "a" }), rep({ externalId: "a" })])).toHaveLength(1);
  });
});

describe("normalización", () => {
  it("USGS conserva los indicadores de impacto y distingue cero de un dato ausente", () => {
    const base = { id: "us9", geometry: { coordinates: [-80, 8, 15] } };
    const properties = { mag: 4.5, time: 1794711702502 };
    const report = normalizeUsgs({
      ...base, properties: { ...properties, felt: 0, cdi: 3.1, mmi: 4.2, alert: "green", tsunami: 0 },
    });
    expect(report?.impact).toEqual({ felt: 0, cdi: 3.1, mmi: 4.2, alert: "green", tsunami: false });
    expect(normalizeUsgs({ ...base, properties })?.impact?.tsunami).toBeNull();
  });
  it("USGS: profundidad y magnitud ausentes quedan en null, no en cero", () => {
    const r = normalizeUsgs({ id: "us9", properties: { mag: null, time: 1794711702502, place: "x" }, geometry: { coordinates: [-80, 8, null] } });
    expect(r?.magnitude).toBeNull();
    expect(r?.depthKm).toBeNull();
  });
  it("EMSC: convierte la respuesta y descarta eventos que no son sismos", () => {
    const base = { id: "1", properties: { unid: "u1", time: "2026-11-15T18:28:24.0Z", lat: 7.6, lon: -80.6, depth: 10, mag: 3.5, magtype: "m", evtype: "ke" } };
    expect(normalizeEmsc(base)?.depthKm).toBe(10);
    expect(normalizeEmsc({ ...base, properties: { ...base.properties, evtype: "km" } })).toBeNull();
  });
  it("el pipeline excluye los eventos fuera de cobertura", () => {
    const { events, excludedOutside } = buildEvents([rep({ externalId: "in" }), rep({ externalId: "cr", latitude: 9.93, longitude: -84.09, occurredAtUtc: "2026-11-11T00:00:00.000Z" })], "2026-11-15T00:00:00.000Z");
    expect(events.map((e) => e.primary.externalId)).toEqual(["in"]);
    expect(excludedOutside).toBe(1);
  });
});

describe("alertas", () => {
  const { events } = buildEvents([rep({ externalId: "e1", magnitude: 4.5 }), rep({ externalId: "e2", magnitude: 3.0, occurredAtUtc: "2026-11-12T00:00:00.000Z" })], "2026-11-15T00:00:00.000Z");
  const prefs = { ...DEFAULT_PREFS, enabled: true };
  it("notifica solo eventos nuevos que cumplen la regla (M ≥ 4)", () => {
    const plan = planNotifications(events, prefs, new Set(), new Set());
    expect(plan.map((p) => p.event.primary.externalId)).toEqual(["e1"]);
  });
  it("no notifica dos veces el mismo evento para la misma regla", () => {
    const first = planNotifications(events, prefs, new Set(), new Set());
    const again = planNotifications(events, prefs, new Set(), new Set(first.map((p) => p.key)));
    expect(again).toHaveLength(0);
  });
  it("no notifica eventos ya vistos en la línea base", () => {
    expect(planNotifications(events, prefs, new Set(events.map((e) => e.id)), new Set())).toHaveLength(0);
  });
  it("no notifica si las alertas están desactivadas", () => {
    expect(planNotifications(events, { ...prefs, enabled: false }, new Set(), new Set())).toHaveLength(0);
  });
});

describe("formato y estadísticas", () => {
  it("muestra fecha DD/MM/AAAA y hora 24 h de Panamá (UTC-5)", () => {
    expect(fmtDate("2026-11-15T03:30:00.000Z")).toBe("14/11/2026");
    expect(fmtTime("2026-11-15T18:05:00.000Z")).toBe("13:05");
  });
  it("la media de magnitud ignora valores desconocidos", () => {
    const { events } = buildEvents([rep({ externalId: "a", magnitude: 4 }), rep({ externalId: "b", magnitude: null, occurredAtUtc: "2026-11-12T00:00:00.000Z" })], "x");
    expect(summarize(events).meanMag).toBe(4);
  });
  it("las exportaciones contienen las filas consultadas", () => {
    const { events } = buildEvents([rep({ externalId: "a" })], "2026-11-15T00:00:00.000Z");
    expect(toCsv(events).split("\n")).toHaveLength(2);
    expect(toGeoJson(events).features[0]!.geometry.coordinates).toEqual([-80.5, 8.5]);
  });
});
