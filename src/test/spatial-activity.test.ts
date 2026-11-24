import { describe, expect, it } from "vitest";
import { activityGeoJSON, CELL_AREA_KM2, spatialActivity } from "@/features/seismic/spatial-activity";
import type { SeismicEvent } from "@/features/seismic/types";

function event(id: string, patch: Partial<SeismicEvent["primary"]> = {}, classification: SeismicEvent["classification"] = "panama"): SeismicEvent {
  return { id, classification, province: "Chiriquí", nearestProvince: null, receivedAt: "2026-11-24T12:00:00Z", reports: [], primary: {
    sourceId: "usgs", externalId: id, magnitude: 3, magnitudeType: "ml", latitude: 8.43, longitude: -82.43,
    depthKm: 10, occurredAtUtc: "2026-11-24T12:00:00Z", updatedAt: null, placeReported: null, reviewStatus: null,
    author: null, sourceUrl: "https://example.test", ...patch,
  } };
}

describe("fixed-area observed seismic activity", () => {
  it("counts frequency separately from maximum magnitude and preserves missing measurements", () => {
    const result = spatialActivity([event("a"), event("b", { magnitude: 5, depthKm: null }, "maritima"), event("c", { magnitude: null, depthKm: 30 })]);
    expect(result.total).toBe(3);
    expect(result.cells).toHaveLength(1);
    expect(result.cells[0]).toMatchObject({ count: 3, land: 2, sea: 1, maxMagnitude: 5, meanDepth: 20 });
    expect(spatialActivity([event("x", { magnitude: null, depthKm: null })]).cells[0]).toMatchObject({ maxMagnitude: null, meanDepth: null });
  });
  it("aggregates the full catalogue rather than the latest 300 points", () => {
    const result = spatialActivity(Array.from({ length: 401 }, (_, i) => event(String(i))));
    expect(result.total).toBe(401);
    expect(result.cells[0]?.count).toBe(401);
  });
  it("keeps cell IDs stable when input order or magnitude changes", () => {
    const a = event("a"), b = event("b", { longitude: -78.2 });
    const original = spatialActivity([a, b]);
    const changed = spatialActivity([b, { ...a, primary: { ...a.primary, magnitude: 7 } }]);
    expect(original.cells.map(cell => cell.id).sort()).toEqual(changed.cells.map(cell => cell.id).sort());
    expect(original.cells.reduce((sum, cell) => sum + cell.count, 0)).toBe(2);
  });
  it("produces closed six-sided cells with matching statistics", () => {
    const result = activityGeoJSON(spatialActivity([event("a")]));
    const feature = result.features[0]!;
    expect(feature.geometry.coordinates[0]).toHaveLength(7);
    expect(feature.geometry.coordinates[0]?.[0]).toEqual(feature.geometry.coordinates[0]?.[6]);
    expect(feature.properties.count).toBe(1);
    expect(CELL_AREA_KM2).toBe(374);
  });
  it("does not turn empty, outside or invalid observations into a safe zone", () => {
    const result = spatialActivity([event("outside", {}, "fuera"), event("invalid", { latitude: NaN })]);
    expect(result).toEqual({ cells: [], total: 0, skipped: 2 });
    expect(activityGeoJSON(result).features).toEqual([]);
  });
});
