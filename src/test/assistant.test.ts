import { afterEach, describe, expect, it, vi } from "vitest";
import { assistantInput, isSeismicQuestion } from "@/features/assistant/contract";
import { ChatError, isConfigured, reserve } from "@/features/assistant/budget.server";
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

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("Savia security boundaries", () => {
  it("accepts a bounded question and rejects extra fields or arbitrary periods", () => {
    expect(assistantInput.safeParse({ question: "Actividad sísmica de Panamá", period: "7d" }).success).toBe(true);
    expect(assistantInput.safeParse({ question: "x".repeat(601), period: "7d" }).success).toBe(false);
    expect(assistantInput.safeParse({ question: "Actividad sísmica de Panamá", period: "365d" }).success).toBe(false);
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
    const response = await handleAssistant(request({ question: "Panamá " + "x".repeat(5000), period: "7d" }));
    expect(response.status).toBe(413);
  });

  it("remains closed when the persistent limiter is missing", async () => {
    vi.stubEnv("SAVIA_ENABLED", "true");
    vi.stubEnv("NVIDIA_API_KEY", "test-secret");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(isConfigured()).toBe(false);
    const response = await handleAssistant(request({ question: "Sismos de Panamá esta semana", period: "7d" }));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("test-secret");
    expect(fetch).not.toHaveBeenCalled();
    const status = await assistantStatus();
    expect(await status.json()).toMatchObject({ enabled: false });
  });

  it("rejects off-topic messages locally", async () => {
    expect((await handleAssistant(request({ question: "Escribe un poema de videojuegos", period: "7d" }))).status).toBe(422);
  });

  it("requires a trusted ingress identity instead of trusting arbitrary forwarded-for", async () => {
    const r = new Request("https://telurica.vercel.app/api/chat", { headers: { "x-forwarded-for": "1.2.3.4" } });
    await expect(reserve(r)).rejects.toBeInstanceOf(ChatError);
  });

  it("checks every quota atomically before permitting upstream requests", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example");
    vi.stubEnv("SAVIA_HASH_SECRET", "test-hmac");
    const fetch = vi.fn().mockResolvedValue(Response.json({ result: 0 }));
    vi.stubGlobal("fetch", fetch);
    await expect(reserve(new Request("https://telurica.vercel.app", { headers: { "x-vercel-forwarded-for": "1.2.3.4" } }))).rejects.toMatchObject({ status: 429 });
    const command = JSON.parse(fetch.mock.calls[0]![1].body);
    expect(command[0]).toBe("EVAL");
    expect(command[2]).toBe(5);
    expect(JSON.stringify(command)).not.toContain("1.2.3.4");
    expect(command.slice(8, 12)).toEqual([3, 10, 100, 1500]);
  });

  it("fails closed when the quota store fails", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "unavailable" }, { status: 503 })));
    await expect(reserve(new Request("https://telurica.vercel.app", { headers: { "x-vercel-forwarded-for": "1.2.3.4" } }))).rejects.toMatchObject({ status: 503 });
  });
});
