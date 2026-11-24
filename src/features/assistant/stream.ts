import type { AssistantReply, ChatPhase } from "./contract";

/** Status events describe server operations, never private model reasoning. */
export async function readAssistant(response: Response, onPhase: (phase: ChatPhase) => void): Promise<AssistantReply> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "El servicio de IA está temporalmente desconectado." })) as { error?: string };
    throw new Error(body.error ?? "No se pudo completar la consulta.");
  }
  if (!response.headers.get("content-type")?.includes("text/event-stream")) return response.json() as Promise<AssistantReply>;
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No se recibió la respuesta.");
  const decoder = new TextDecoder();
  let pending = "";
  let result: AssistantReply | undefined;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      pending += decoder.decode(chunk.value, { stream: true });
      const frames = pending.split("\n\n");
      pending = frames.pop() ?? "";
      for (const frame of frames) {
        const line = frame.split("\n").find(value => value.startsWith("data: "));
        if (!line) continue;
        const event = JSON.parse(line.slice(6)) as { type: string; phase?: ChatPhase; reply?: AssistantReply; message?: string };
        if (event.type === "phase" && event.phase) onPhase(event.phase);
        if (event.type === "result" && event.reply) result = event.reply;
        if (event.type === "error") throw new Error(event.message ?? "No se pudo completar la consulta.");
      }
    }
  } finally { reader.releaseLock(); }
  if (!result) throw new Error("La respuesta se interrumpió. Inténtalo de nuevo.");
  return result;
}
