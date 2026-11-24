import { describe, expect, it } from "vitest";
import { nearbySeismicity, nearestRegionalFault, pointProblem, terrainRecommendations, TERRAIN_PLACES } from "@/features/terrain/assessment";
import { decodeTerrarium, terrainGradient, tilePixel } from "@/features/terrain/elevation.client";
import type { SeismicEvent } from "@/features/seismic/types";

describe("terrain observations are not construction approvals", () => {
  it("accepts real reference locations in Panama, rejecting invalid and foreign points", () => {
    for (const place of TERRAIN_PLACES) expect(pointProblem(place), place.name).toBeNull();
    expect(pointProblem({ longitude: -84.09, latitude: 9.93 })).not.toBeNull();
    expect(pointProblem({ longitude: NaN, latitude: 8 })).not.toBeNull();
  });
  it("decodes the official Terrarium example and uses a camera-independent grid", () => {
    expect(decodeTerrarium(137, 219, 68)).toBeCloseTo(2523.265625, 5);
    expect(tilePixel({ longitude: 0, latitude: 0 })).toEqual({ x: 4096, y: 4096, px: 0, py: 0 });
  });
  it("computes a 20-percent planar gradient across a 300-metre window", () => {
    const result = terrainGradient(100, 130, 70, 100, 100);
    expect(result.slopePercent).toBeCloseTo(20);
    expect(result.slopeDegrees).toBeCloseTo(11.3099, 3);
    expect(result.sampleSpanMeters).toBe(300);
    expect(() => terrainGradient(NaN, 0, 0, 0, 0)).toThrow();
  });
  it("keeps zero observations distinct from unavailable measurements", () => {
    const point = { longitude: -79.518, latitude: 8.985 };
    const empty = nearbySeismicity(point, [], 25);
    expect(empty.count).toBe(0);
    expect(empty.maxMagnitude).toBeNull();
    expect(empty.closest).toBeNull();
    const event = { id: "test", primary: { longitude: point.longitude, latitude: point.latitude + 0.1, occurredAtUtc: "2026-11-24T12:00:00Z", magnitude: null } } as SeismicEvent;
    expect(nearbySeismicity(point, [event], 5).count).toBe(0);
    expect(nearbySeismicity(point, [event], 25).count).toBe(1);
    expect(nearbySeismicity(point, [event], 25).maxMagnitude).toBeNull();
  });
  it("reports only regional cortical proximity and always requires local studies", () => {
    expect(nearestRegionalFault({ longitude: -79.6, latitude: 9.03 })?.id).toBe("pm");
    const pending = terrainRecommendations(null);
    expect(pending[0]?.title).toContain("geotécnico");
    expect(pending).toHaveLength(4);
    expect(terrainRecommendations({ elevation: 100, slopeDegrees: 25, slopePercent: 46, sampleSpanMeters: 300, sampledAt: "2026-11-24T12:00:00Z" })[1]?.title).toContain("estabilidad");
  });
});
