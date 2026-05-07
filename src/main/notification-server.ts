import { BrowserWindow, Notification } from "electron";
import net from "net";
import { v4 as uuid } from "uuid";
import type { ConnexioNotification, NotificationSource } from "../shared/types";
import { getNotificationStore } from "./notification-store";

let server: net.Server | null = null;
let serverPort: number | null = null;

// Dedupe: avoid duplicate notifications within short window
const recentNotifications = new Map<string, number>();
const DEDUPE_WINDOW_MS = 3000;

/**
 * Start a local TCP server that listens for notification messages
 * from AI agent hooks (Claude, OpenCode, Codex, etc.)
 *
 * Supported formats:
 * 1. JSON line (preferred): {"provider":"pi","title":"Pi Agent","body":"Done","tabId":"..."}
 * 2. Legacy pipe: type|title|body
 */
export function startNotificationServer(): void {
	if (server) return;

	server = net.createServer((socket) => {
		let data = "";

		socket.on("data", (chunk) => {
			data += chunk.toString();
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
	const lines = raw.split("\n").filter((l) => l.trim());

	for (const line of lines) {
		const notification = parseNotification(line.trim());
		if (!notification) continue;

		// Dedupe exact provider/title/body within 3s
		const dedupeKey = `${notification.provider || ""}|${notification.title}|${notification.body}`;
		const now = Date.now();
		const lastTime = recentNotifications.get(dedupeKey);
		if (lastTime && now - lastTime < DEDUPE_WINDOW_MS) {
			continue;
		}
		recentNotifications.set(dedupeKey, now);

		// Cleanup old dedupe entries
		for (const [key, time] of recentNotifications.entries()) {
			if (now - time > DEDUPE_WINDOW_MS) {
				recentNotifications.delete(key);
			}
		}

		// Store notification
		const store = getNotificationStore();
		store.add(notification);

		// Send to renderer
		const win =
			BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
		if (win && !win.isDestroyed()) {
			win.webContents.send("notification:received", notification);
		}

		// Native OS notification when app is not focused
		if (!win || !win.isFocused()) {
			showNativeNotification(notification);
		}
	}
}

function parseNotification(line: string): ConnexioNotification | null {
	// Preferred JSON format
	if (line.startsWith("{")) {
		try {
			const payload = JSON.parse(line) as Partial<ConnexioNotification> & {
				provider?: string;
			};
			return {
				id: uuid(),
				source: payload.source || "agent",
				provider: payload.provider,
				title: payload.title || "Notification",
				body: payload.body || "",
				tabId: payload.tabId,
				projectId: payload.projectId,
				terminalId: payload.terminalId,
				projectName: payload.projectName,
				tabLabel: payload.tabLabel,
				timestamp: Date.now(),
				isRead: false,
			};
		} catch {
			return null;
		}
	}

	// Backward-compatible legacy pipe format: type|title|body
	const parts = line.split("|");
	if (parts.length < 2) return null;

	const type = parts[0].trim();
	const title = parts[1].trim() || "Notification";
	const body = parts.slice(2).join("|").trim();
	const source: NotificationSource = "agent";

	return {
		id: uuid(),
		source,
		provider: type || undefined,
		title,
		body,
		timestamp: Date.now(),
		isRead: false,
	};
}

function showNativeNotification(notification: ConnexioNotification): void {
	if (!Notification.isSupported()) return;

	const contextParts = [notification.projectName, notification.tabLabel].filter(
		Boolean,
	);
	const title = contextParts.length
		? `${notification.title} — ${contextParts.join(" / ")}`
		: notification.title;

	const nativeNotification = new Notification({
		title,
		subtitle: "Connexio",
		body: notification.body,
		silent: true, // sound handled by renderer custom sound
	});

	nativeNotification.on("click", () => {
		const win = BrowserWindow.getAllWindows()[0];
		if (win && !win.isDestroyed()) {
			if (win.isMinimized()) win.restore();
			win.focus();
			win.webContents.send("notification:navigate", notification);
		}
	});

	nativeNotification.show();
}
