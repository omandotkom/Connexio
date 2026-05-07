// Connexio notification plugin for OpenCode
// Sends notification to Connexio when OpenCode session becomes idle
// Install: Copy to ~/.opencode/plugins/connexio-notify.js

export const ConnexioNotificationPlugin = async ({ client }) => ({
  event: async ({ event }) => {
    const port = process.env.CONNEXIO_NOTIFICATION_PORT;
    if (!port) return;
    if (event.type !== "session.idle") return;

    const sessionID = event.properties?.sessionID;
    let body = "Session completed";

    try {
      const result = await client.session.messages({
        path: { id: sessionID },
        query: { limit: 3 },
      });
      const messages = result.data || [];
      const lastAssistant = [...messages]
        .reverse()
        .find((m) => m.info?.role === "assistant");
      if (lastAssistant) {
        const textParts = (lastAssistant.parts || []).filter(
          (p) => p.type === "text"
        );
        const text = textParts.map((p) => p.text || "").join("");
        if (text) {
          body = text.replace(/[\n\r|]+/g, " ").slice(0, 200);
        }
      }
    } catch {
      // Ignore — use default body
    }

    const message = `opencode|OpenCode|${body}`;

    try {
      const { createConnection } = await import("net");
      const conn = createConnection({ port: parseInt(port), host: "127.0.0.1" });
      conn.on("error", () => {});
      conn.write(message, () => conn.end());
      await new Promise((resolve) => {
        conn.on("close", resolve);
        setTimeout(resolve, 3000);
      });
    } catch {
      // Silently fail — Connexio may not be running
    }
  },
});
