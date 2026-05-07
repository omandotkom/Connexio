// Connexio notification hook for Pi Agent
// Sends notification to Connexio when Pi agent finishes processing
// Install: Add to ~/.pi/hooks/connexio-notify.ts and reference in settings.json

import type { HookAPI } from "@mariozechner/pi-coding-agent/hooks";
import { createConnection } from "net";

export default function (pi: HookAPI) {
  pi.on("agent_end", async (event, ctx) => {
    const port = process.env.CONNEXIO_NOTIFICATION_PORT;
    if (!port) return;

    const messageCount = event.messages?.length ?? 0;
    let body = `Session ended with ${messageCount} messages`;

    // Try to get last assistant message
    if (event.messages && event.messages.length > 0) {
      const lastMsg = [...event.messages]
        .reverse()
        .find((m: any) => m.role === "assistant");
      if (lastMsg && lastMsg.content) {
        const text =
          typeof lastMsg.content === "string"
            ? lastMsg.content
            : Array.isArray(lastMsg.content)
              ? lastMsg.content
                  .filter((p: any) => p.type === "text")
                  .map((p: any) => p.text || "")
                  .join("")
              : "";
        if (text) {
          body = text.replace(/[\n\r|]+/g, " ").slice(0, 200);
        }
      }
    }

    const message = `pi|Pi Agent|${body}`;

    try {
      const conn = createConnection({ port: parseInt(port), host: "127.0.0.1" });
      conn.on("error", () => {});
      conn.write(message, () => conn.end());
      await new Promise<void>((resolve) => {
        conn.on("close", resolve);
        setTimeout(resolve, 3000);
      });
    } catch {
      // Silently fail — Connexio may not be running
    }
  });
}
