import { createHmac, randomUUID } from "node:crypto";

export const QUOTAS = { minute: 3, visitorDay: 10, day: 100, month: 1500, concurrent: 2 } as const;
export class ChatError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function isConfigured() {
  return process.env["SAVIA_ENABLED"] === "true" &&
    !!process.env["NVIDIA_API_KEY"] && !!(process.env["UPSTASH_REDIS_REST_URL"] ?? process.env["KV_REST_API_URL"]) &&
    !!(process.env["UPSTASH_REDIS_REST_TOKEN"] ?? process.env["KV_REST_API_TOKEN"]) && (process.env["SAVIA_HASH_SECRET"]?.length ?? 0) >= 32;
}

export function privateHash(value: string) {
  return createHmac("sha256", process.env["SAVIA_HASH_SECRET"] ?? "").update(value).digest("hex");
}

export async function redis<T>(command: (string | number)[]): Promise<T> {
  const endpoint = process.env["UPSTASH_REDIS_REST_URL"] ?? process.env["KV_REST_API_URL"];
  if (!endpoint || !endpoint.startsWith("https://")) throw new ChatError(503, "El control de consumo está temporalmente desconectado.");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env["UPSTASH_REDIS_REST_TOKEN"] ?? process.env["KV_REST_API_TOKEN"]}`, "Content-Type": "application/json" },
    body: JSON.stringify(command), signal: AbortSignal.timeout(2500),
  });
  if (!response.ok) throw new ChatError(503, "El control de consumo está temporalmente desconectado.");
  const body = await response.json() as { result: T; error?: string };
  if (body.error) throw new ChatError(503, "El control de consumo está temporalmente desconectado.");
  return body.result;
}

// One atomic reservation across every server instance. Failed requests consume their
// reservation too. No refunds can accidentally release another concurrent request.
export const RESERVE = `
for i = 1, 4 do
  local count = tonumber(redis.call('GET', KEYS[i]) or '0')
  if count >= tonumber(ARGV[i]) then return 0 end
end
redis.call('ZREMRANGEBYSCORE', KEYS[5], '-inf', ARGV[5])
if redis.call('ZCARD', KEYS[5]) >= tonumber(ARGV[6]) then return 0 end
for i = 1, 4 do
  redis.call('INCR', KEYS[i])
  redis.call('EXPIRE', KEYS[i], ARGV[7 + i])
end
redis.call('ZADD', KEYS[5], ARGV[7], ARGV[12])
redis.call('EXPIRE', KEYS[5], 120)
return 1
`;

export async function reserve(request: Request) {
  // Vercel sets this header at its trusted ingress. The ordinary forwarded-for
  // header is deliberately never used as a source of identity.
  const address = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  if (!address) throw new ChatError(503, "La protección del chat requiere el acceso a través de Vercel.");
  const now = Date.now();
  const utc = new Date(now).toISOString();
  const visitor = privateHash(address);
  const prefix = "telurica:savia:v1:";
  const lease = randomUUID();
  const activeKey = prefix + "active";
  const result = await redis<number>([
    "EVAL", RESERVE, 5,
    prefix + "minute:" + visitor + ":" + Math.floor(now / 60_000),
    prefix + "visitor:" + visitor + ":" + utc.slice(0, 10),
    prefix + "day:" + utc.slice(0, 10),
    prefix + "month:" + utc.slice(0, 7),
    activeKey,
    QUOTAS.minute, QUOTAS.visitorDay, QUOTAS.day, QUOTAS.month,
    now, QUOTAS.concurrent, now + 90_000, 120, 172800, 172800, 5356800, lease,
  ]);
  if (result !== 1) throw new ChatError(429, "Savia alcanzó una cuota de consultas o está atendiendo otras solicitudes. Inténtalo más tarde.");
  return async () => {
    // The 90-second lease expires even if this process is terminated.
    await redis(["ZREM", activeKey, lease]).catch(() => undefined);
  };
}
