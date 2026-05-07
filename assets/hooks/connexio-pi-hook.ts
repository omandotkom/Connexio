// Connexio notification extension for Pi Agent
// Sends notification to Connexio when Pi agent finishes processing
// Auto-loaded from ~/.pi/agent/extensions/

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { createConnection } from "net";

export default function (pi: ExtensionAPI) {
	pi.on("agent_response_end", async (event) => {
		const port = process.env.CONNEXIO_NOTIFICATION_PORT;
		if (!port) return;

		let body = "Task completed";

		// Try to extract summary from event
		if (event && typeof event === "object") {
			const msg = (event as any).message || (event as any).content;
			if (typeof msg === "string" && msg.length > 0) {
				body = msg.replace(/[\n\r|]+/g, " ").slice(0, 200);
			}
		}

		const message = `pi|Pi Agent|${body}`;

		try {
			const conn = createConnection({
				port: parseInt(port),
				host: "127.0.0.1",
			});
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
