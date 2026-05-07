import { BrowserWindow } from "electron";
import net from "net";
import { v4 as uuid } from "uuid";
import type { ConnexioNotification, NotificationSource } from "../shared/types";
import { getNotificationStore } from "./notification-store";

let server: net.Server | null = null;
let serverPort: number | null = null;

/**
 * Start a local TCP server that listens for notification messages
 * from AI agent hooks (Claude, OpenCode, Codex, etc.)
 *
 * Message format: type|title|body
 * Example: "claude|Claude Code|Task completed — fixed the login bug"
 */
export function startNotificationServer(): void {
	if (server) return;

	server = net.createServer((socket) => {
		let data = "";

		socket.on("data", (chunk) => {
			data += chunk.toString();
			// Limit message size to prevent abuse
			if (data.length > 65536) {
				socket.destroy();
			}
		});

		socket.on("end", () => {
			if (data.trim()) {
				processMessage(data.trim());
			}
		});

		socket.on("error", () => {
			// Ignore client errors
		});
	});

	// Listen on random available port on localhost only
	server.listen(0, "127.0.0.1", () => {
		const addr = server?.address();
		if (addr && typeof addr === "object") {
			serverPort = addr.port;
			console.log(
				`[Connexio] Notification server listening on port ${serverPort}`,
			);
		}
	});

	server.on("error", (err) => {
		console.error("[Connexio] Notification server error:", err.message);
		server = null;
		serverPort = null;
	});
}

export function stopNotificationServer(): void {
	if (server) {
		server.close();
		server = null;
		serverPort = null;
	}
}

export function getNotificationServerPort(): number | null {
	return serverPort;
}

function processMessage(raw: string): void {
	// Support multiple messages separated by newlines
	const lines = raw.split("\n").filter((l) => l.trim());

	for (const line of lines) {
		const parts = line.split("|");
		if (parts.length < 2) continue;

		const type = parts[0].trim();
		const title = parts[1].trim() || "Notification";
		const body = parts.slice(2).join("|").trim();

		const source: NotificationSource = "agent";
		const provider = type || undefined;

		const notification: ConnexioNotification = {
			id: uuid(),
			source,
			provider,
			title,
			body,
			timestamp: Date.now(),
			isRead: false,
		};

		// Store notification
		const store = getNotificationStore();
		store.add(notification);

		// Send to renderer
		const win =
			BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
		if (win && !win.isDestroyed()) {
			win.webContents.send("notification:received", notification);
		}
	}
}
