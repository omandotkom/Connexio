import { BrowserWindow, ipcMain } from "electron";
import { autoUpdater } from "electron-updater";

export interface UpdateInfo {
	version: string;
	releaseNotes: string;
	releaseName: string;
}

export interface UpdateProgress {
	percent: number;
	bytesPerSecond: number;
	transferred: number;
	total: number;
}

// Send update events to renderer
function sendToRenderer(channel: string, ...args: any[]) {
	const windows = BrowserWindow.getAllWindows();
	for (const win of windows) {
		if (!win.isDestroyed()) {
			win.webContents.send(channel, ...args);
		}
	}
}

export function setupUpdaterIPC() {
	// Configure auto-updater
	autoUpdater.autoDownload = false;
	autoUpdater.autoInstallOnAppQuit = true;

	// Updater events → renderer
	autoUpdater.on("checking-for-update", () => {
		sendToRenderer("updater:checking");
	});

	autoUpdater.on("update-available", (info) => {
		const updateInfo: UpdateInfo = {
			version: info.version,
			releaseNotes:
				typeof info.releaseNotes === "string"
					? info.releaseNotes
					: Array.isArray(info.releaseNotes)
						? info.releaseNotes.map((n) => n.note).join("\n")
						: "",
			releaseName: info.releaseName || `v${info.version}`,
		};
		sendToRenderer("updater:available", updateInfo);
	});

	autoUpdater.on("update-not-available", () => {
		sendToRenderer("updater:not-available");
	});

	autoUpdater.on("download-progress", (progress) => {
		const progressInfo: UpdateProgress = {
			percent: progress.percent,
			bytesPerSecond: progress.bytesPerSecond,
			transferred: progress.transferred,
			total: progress.total,
		};
		sendToRenderer("updater:progress", progressInfo);
	});

	autoUpdater.on("update-downloaded", (info) => {
		sendToRenderer("updater:downloaded", {
			version: info.version,
			releaseName: info.releaseName || `v${info.version}`,
		});
	});

	autoUpdater.on("error", (error) => {
		sendToRenderer("updater:error", error.message);
	});

	// IPC handlers
	ipcMain.handle("updater:check", async () => {
		try {
			const result = await autoUpdater.checkForUpdates();
			return result?.updateInfo?.version || null;
		} catch (error) {
			console.error("Update check failed:", error);
			return null;
		}
	});

	ipcMain.handle("updater:download", async () => {
		try {
			await autoUpdater.downloadUpdate();
			return true;
		} catch (error) {
			console.error("Update download failed:", error);
			return false;
		}
	});

	ipcMain.handle("updater:install", () => {
		autoUpdater.quitAndInstall(false, true);
	});
}

/**
 * Start periodic update checks (every 4 hours).
 * Call this after app is ready and window is created.
 */
export function startUpdateChecker() {
	// Check after 30 seconds (give app time to start)
	setTimeout(() => {
		autoUpdater.checkForUpdates().catch(() => {});
	}, 30_000);

	// Then check every 4 hours
	setInterval(
		() => {
			autoUpdater.checkForUpdates().catch(() => {});
		},
		4 * 60 * 60 * 1000,
	);
}
