import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      GET: async () => {
        const { assistantStatus } = await import("@/features/assistant/chat.server");
        return assistantStatus();
      },
      POST: async ({ request }) => {
        const { handleAssistant } = await import("@/features/assistant/chat.server");
        return handleAssistant(request);
      },
    },
  },
});
