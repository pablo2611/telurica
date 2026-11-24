import { createHmac } from "node:crypto";

export class ChatError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function isConfigured() {
  return process.env["SAVIA_ENABLED"] === "true" && !!process.env["NVIDIA_API_KEY"];
}

export function privateHash(value: string) {
  return createHmac("sha256", process.env["SAVIA_HASH_SECRET"] ?? process.env["NVIDIA_API_KEY"] ?? "").update(value).digest("hex");
}

export async function redis<T>(command: (string | number)[]): Promise<T> {
  const endpoint = process.env["UPSTASH_REDIS_REST_URL"] ?? process.env["KV_REST_API_URL"];
  if (!endpoint || !endpoint.startsWith("https://")) throw new ChatError(503, "La caché está temporalmente desconectada.");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env["UPSTASH_REDIS_REST_TOKEN"] ?? process.env["KV_REST_API_TOKEN"]}`, "Content-Type": "application/json" },
    body: JSON.stringify(command), signal: AbortSignal.timeout(2500),
  });
  if (!response.ok) throw new ChatError(503, "La caché está temporalmente desconectada.");
  const body = await response.json() as { result: T; error?: string };
  if (body.error) throw new ChatError(503, "La caché está temporalmente desconectada.");
  return body.result;
}

