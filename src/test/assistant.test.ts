import { afterEach, describe, expect, it, vi } from "vitest";
import { assistantInput, isSeismicQuestion } from "@/features/assistant/contract";
import { isConfigured } from "@/features/assistant/runtime.server";
import { getSeismicData, getTsunamiBulletins } from "@/features/seismic/seismic.functions";
import type { SourceStatus } from "@/features/seismic/types";
import { handleAssistant, assistantStatus } from "@/features/assistant/chat.server";

vi.mock("@/features/seismic/seismic.functions", () => ({
  getSeismicData: vi.fn(), getTsunamiBulletins: vi.fn(),
}));

function request(value: unknown, origin = "https://telurica.vercel.app") {
  return new Request("https://telurica.vercel.app/api/chat", {
    method: "POST", headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
}

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetAllMocks(); });

describe("Savia security boundaries", () => {
  it("accepts a bounded question and rejects extra fields or arbitrary periods", () => {
    expect(assistantInput.safeParse({ question: "Actividad sísmica de Panamá", period: "7d" }).success).toBe(true);
    expect(assistantInput.safeParse({ question: "x".repeat(12001), period: "7d" }).success).toBe(false);
    expect(assistantInput.safeParse({ question: "Actividad sísmica de Panamá", period: "999d" }).success).toBe(false);
    expect(assistantInput.safeParse({ question: "Actividad sísmica de Panamá", period: "7d", apiKey: "override" }).success).toBe(false);
    expect(isSeismicQuestion("Escribe un poema de videojuegos")).toBe(false);
  });

  it("rejects a foreign or missing origin before any outgoing request", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect((await handleAssistant(request({}, "https://attacker.example"))).status).toBe(403);
    const noOrigin = new Request("https://telurica.vercel.app/api/chat", { method: "POST", body: "{}" });
    expect((await handleAssistant(noOrigin)).status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("caps actual body size even when content-length is absent", async () => {
    const response = await handleAssistant(request({ question: "Panamá " + "x".repeat(70000), period: "7d" }));
    expect(response.status).toBe(413);
  });

  it("does not require a quota store to enable inference", () => {
    vi.stubEnv("SAVIA_ENABLED", "true");
    vi.stubEnv("NVIDIA_API_KEY", "test-secret");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    expect(isConfigured()).toBe(true);
    vi.stubEnv("SAVIA_ENABLED", "false");
    expect(isConfigured()).toBe(false);
  });

  it("rejects off-topic messages locally", async () => {
    expect((await handleAssistant(request({ question: "Escribe un poema de videojuegos", period: "7d" }))).status).toBe(422);
  });

});

describe("Savia grounded response", () => {
  function configure(providerContent: string) {
    vi.stubEnv("SAVIA_ENABLED", "true");
    vi.stubEnv("NVIDIA_API_KEY", "test-secret-never-send-to-browser");
    vi.stubEnv("SAVIA_HASH_SECRET", "test-hmac-secret-at-least-32-characters");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-redis-token");
    const source: SourceStatus = {
      id: "usgs", name: "USGS", url: "https://earthquake.usgs.gov/",
      serviceType: "API", method: "HTTP", state: "operativa", lastAttemptAt: null,
      lastSuccessAt: null, durationMs: 10, received: 0, error: null,
    };
    vi.mocked(getSeismicData).mockResolvedValue({
      events: [], excludedOutside: 0, sources: [source], generatedAt: "2026-11-23T12:00:00.000Z",
      range: { start: "2026-11-16T12:00:00.000Z", end: "2026-11-23T12:00:00.000Z" },
    });
    vi.mocked(getTsunamiBulletins).mockResolvedValue({ bulletins: [], source: { ...source, id: "noaa", name: "NOAA" } });
    const fetch = vi.fn(async (url: string, init: RequestInit) => {
      if (url === "https://redis.example") {
        const command = JSON.parse(init.body as string);
        return Response.json({ result: command[0] === "GET" ? null : 1 });
      }
      expect(url).toBe("https://integrate.api.nvidia.com/v1/chat/completions");
      const body = JSON.parse(init.body as string);
      expect(body.max_tokens).toBe(1500);
      expect(body.chat_template_kwargs.enable_thinking).toBe(false);
      expect(body.messages).toHaveLength(2);
      expect(body.messages[1].content).not.toContain("test-secret-never-send-to-browser");
      return Response.json({ choices: [{ message: { content: providerContent } }] });
    });
    vi.stubGlobal("fetch", fetch);
    const r = request({ question: "Resume los sismos de Panamá esta semana", period: "7d" });
    r.headers.set("x-vercel-forwarded-for", "1.2.3.4");
    return { r, fetch };
  }

  it("returns authoritative counters and sources with bounded inference and no secrets", async () => {
    const { r, fetch } = configure(JSON.stringify({ answer: "Sin registros en el período consultado.", inScope: true }));
    const response = await handleAssistant(r);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.total).toBe(0);
    expect(body.sources.map((source: { name: string }) => source.name)).toEqual(["USGS", "NOAA"]);
    expect(JSON.stringify(body)).not.toContain("test-secret");
    expect(fetch.mock.calls.filter(([url]) => url.includes("nvidia"))).toHaveLength(1);
  });

  it("allows repeated questions without personal, minute or daily quotas", async () => {
    const { fetch } = configure(JSON.stringify({ answer: "El catálogo refleja la actividad observada.", inScope: true }));
    for (let attempt = 0; attempt < 12; attempt++) {
      const response = await handleAssistant(request({ question: "Resume los sismos de Panamá", period: "7d" }));
      expect(response.status).toBe(200);
    }
    expect(fetch.mock.calls.filter(([url]) => url.includes("nvidia"))).toHaveLength(12);
    expect(fetch.mock.calls.some(([, init]) => (init.body as string).includes("EVAL"))).toBe(false);
  });

  it("keeps answering if its optional cache is unavailable", async () => {
    configure(JSON.stringify({ answer: "La gráfica refleja el catálogo.", inScope: true }));
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("KV_REST_API_URL", "");
    expect((await handleAssistant(request({ question: "Resume los sismos de Panamá", period: "7d" }))).status).toBe(200);
  });

  it("streams actual source, inference and presentation phases followed by a result", async () => {
    const { r } = configure(JSON.stringify({ answer: "La gráfica refleja el catálogo.", inScope: true }));
    r.headers.set("Accept", "text/event-stream");
    const response = await handleAssistant(r);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    const stream = await response.text();
    expect(stream).toContain('"phase":"sources"');
    expect(stream).toContain('"phase":"analyzing"');
    expect(stream).toContain('"phase":"presenting"');
    expect(stream).toContain('"type":"result"');
    expect(stream).not.toContain("test-secret-never-send-to-browser");
  });

  it("rejects unstructured or off-topic provider output", async () => {
    const malformed = configure(JSON.stringify({ answer: "Sin datos", inScope: true, tool: "execute" }));
    expect((await handleAssistant(malformed.r)).status).toBe(502);
    const inventedCount = configure(JSON.stringify({ answer: "Hay 5 boletines y no hay peligro para Panamá.", inScope: true }));
    expect((await handleAssistant(inventedCount.r)).status).toBe(502);
    const unsafeSite = configure(JSON.stringify({ answer: "El terreno es seguro para construir.", inScope: true }));
    expect((await handleAssistant(unsafeSite.r)).status).toBe(502);
    const unrelated = configure(JSON.stringify({ answer: "Tema ajeno", inScope: false }));
    expect((await handleAssistant(unrelated.r)).status).toBe(422);
  });
});
