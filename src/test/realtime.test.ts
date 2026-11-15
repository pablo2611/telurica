import { describe, expect, it } from "vitest";
import { ingest, inQueryBox, onNewLiveEvent, parseEmscMessage, parseUsgsFeature } from "@/features/seismic/realtime";

describe("Capa en tiempo real", () => {
  it("normaliza un mensaje del WebSocket de EMSC", () => {
    const raw = JSON.stringify({
      action: "create",
      data: { id: "abc", properties: { unid: "20261115_0000001", time: "2026-11-15T10:00:00.0Z", lat: 8.43, lon: -82.43, depth: 12, mag: 4.1, magtype: "mb", flynn_region: "PANAMA", evtype: "ke" } },
    });
    const c = parseEmscMessage(raw);
    expect(c?.key).toBe("emsc:20261115_0000001");
    expect(c?.magnitude).toBe(4.1);
    expect(c?.depthKm).toBe(12);
  });

  it("descarta mensajes inválidos o que no son sismos", () => {
    expect(parseEmscMessage("no-json")).toBeNull();
    expect(parseEmscMessage(JSON.stringify({ data: { properties: { lat: 8, lon: -80, time: "2026-01-01T00:00:00Z", evtype: "qb" } } }))).toBeNull();
  });

  it("normaliza una entidad del feed de USGS", () => {
    const c = parseUsgsFeature({ id: "us123", properties: { mag: 3.2, time: Date.parse("2026-11-15T11:00:00Z"), place: "Panamá", type: "earthquake" }, geometry: { coordinates: [-79.5, 8.9, 30] } });
    expect(c?.key).toBe("usgs:us123");
    expect(c?.depthKm).toBe(30);
  });

  it("filtra por recuadro y clasificación geográfica, y fusiona reportes del mismo sismo", () => {
    expect(inQueryBox(19, -99)).toBe(false);
    const got: string[] = [];
    const off = onNewLiveEvent((e) => got.push(e.key));
    const base = { magnitude: 4, magnitudeType: "mb", latitude: 8.43, longitude: -82.43, depthKm: 10, occurredAtUtc: "2026-11-15T12:00:00.000Z", place: "Chiriquí", url: "https://x" };
    const a = ingest({ ...base, key: "emsc:1", source: "emsc" }, true);
    const b = ingest({ ...base, key: "usgs:1", source: "usgs", latitude: 8.5, occurredAtUtc: "2026-11-15T12:00:10.000Z" }, true);
    const outside = ingest({ ...base, key: "usgs:mx", source: "usgs", latitude: 19, longitude: -99 }, true);
    off();
    expect(a?.classification).toBe("panama");
    expect(b).toBeNull(); // fusionado con el primero
    expect(outside).toBeNull();
    expect(got).toEqual(["emsc:1"]);
  });
});
