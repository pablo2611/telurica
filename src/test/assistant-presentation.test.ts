import { describe, expect, it } from "vitest";
import { presentationFor, requestedPeriod } from "@/features/assistant/presentation";
import { readAssistant } from "@/features/assistant/stream";

describe("Savia requested outputs", () => {
  it("selects a real table instead of a textual description", () => {
    expect(presentationFor("Haz una tabla comparando las provincias")).toMatchObject({ views: ["table"], tableKind: "provinces" });
    expect(presentationFor("Tabla con los últimos sismos y su magnitud")).toMatchObject({ views: ["table"], tableKind: "events" });
  });
  it("selects a scoped map and supports multiple requested views", () => {
    expect(presentationFor("Dame un mapa y una tabla de Chiriquí")).toMatchObject({ views: ["table", "map"], regions: ["Chiriquí"] });
    expect(presentationFor("Grafica la evolución diaria")).toMatchObject({ views: ["chart"], chartKind: "daily" });
  });
  it("preserves the region when a user requests another view in a follow-up", () => {
    expect(presentationFor("Ahora muestra una tabla", "Mapa de Chiriquí")).toMatchObject({ views: ["table"], regions: ["Chiriquí"] });
  });
  it("treats Panama as the country unless a province is explicit", () => {
    expect(presentationFor("Haz una tabla de Panamá").regions).toEqual([]);
    expect(presentationFor("Mapa de la provincia de Panamá").regions).toEqual(["Panamá"]);
  });
  it("honors periods written in the prompt", () => {
    expect(requestedPeriod({ question: "Sismos del último mes", period: "7d", history: [] })).toBe("30d");
    expect(requestedPeriod({ question: "Actividad del último año", period: "7d", history: [] })).toBe("365d");
  });
  it("decodes UTF-8 events split between arbitrary network chunks", async () => {
    const bytes = new TextEncoder().encode('data: {"type":"phase","phase":"analyzing"}\n\ndata: {"type":"result","reply":{"answer":"Panamá"}}\n\n');
    const stream = new ReadableStream<Uint8Array>({ start(controller) {
      for (let offset = 0; offset < bytes.length; offset += 5) controller.enqueue(bytes.slice(offset, offset + 5));
      controller.close();
    } });
    const phases: string[] = [];
    const reply = await readAssistant(new Response(stream, { headers: { "content-type": "text/event-stream" } }), phase => phases.push(phase));
    expect(phases).toEqual(["analyzing"]);
    expect(reply.answer).toBe("Panamá");
  });
});
