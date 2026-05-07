import { app, dialog, ipcMain } from "electron";
import fs from "fs";
import path from "path";
import type { NotificationSettings } from "../shared/types";
import { getProviders, installHook, uninstallHook } from "./ai-providers";
import { getNotificationServerPort } from "./notification-server";
import { getNotificationStore } from "./notification-store";

export function setupNotificationIPC(): void {
	const store = getNotificationStore();

	ipcMain.handle("notification:list", () => {
		return store.getAll();
	});

	ipcMain.handle("notification:unread-count", () => {
		return store.getUnreadCount();
	});

	ipcMain.handle("notification:mark-read", (_event, id: string) => {
		store.markAsRead(id);
	});

	ipcMain.handle("notification:mark-all-read", () => {
		store.markAllAsRead();
	});

	ipcMain.handle("notification:remove", (_event, id: string) => {
		store.remove(id);
	});

	ipcMain.handle("notification:clear", () => {
		store.clear();
	});

	ipcMain.handle("notification:get-settings", () => {
		return store.getSettings();
	});

	ipcMain.handle(
		"notification:update-settings",
		(_event, settings: NotificationSettings) => {
			return store.updateSettings(settings);
		},
	);

	ipcMain.handle("notification:get-port", () => {
		return getNotificationServerPort();
	});

	// AI Provider hooks
	ipcMain.handle("notification:get-providers", () => {
		return getProviders();
	});

	ipcMain.handle("notification:install-hook", (_event, providerId: string) => {
		return installHook(providerId);
	});

	ipcMain.handle(
		"notification:uninstall-hook",
		(_event, providerId: string) => {
			return uninstallHook(providerId);
		},
	);

	// Custom sound upload
	ipcMain.handle("notification:upload-sound", async () => {
		const result = await dialog.showOpenDialog({
			title: "Select Notification Sound",
			filters: [{ name: "Audio", extensions: ["wav", "mp3", "ogg"] }],
			properties: ["openFile"],
		});

		if (result.canceled || result.filePaths.length === 0) {
			return { success: false };
		}

		const sourcePath = result.filePaths[0];
		const soundsDir = path.join(app.getPath("userData"), "sounds");

		if (!fs.existsSync(soundsDir)) {
			fs.mkdirSync(soundsDir, { recursive: true });
		}

		const ext = path.extname(sourcePath);
		const destPath = path.join(soundsDir, `notification${ext}`);

		try {
			fs.copyFileSync(sourcePath, destPath);
			// Update settings with custom path
			const settings = store.getSettings();
			store.updateSettings({ ...settings, customSoundPath: destPath });
			return { success: true, path: destPath };
		} catch (err: any) {
			return { success: false, error: err.message };
		}
	});

	// Remove custom sound
	ipcMain.handle("notification:remove-custom-sound", () => {
		const settings = store.getSettings();
		if (settings.customSoundPath) {
			try {
				if (fs.existsSync(settings.customSoundPath)) {
					fs.unlinkSync(settings.customSoundPath);
				}
			} catch {
				// ignore
			}
		}
		store.updateSettings({ ...settings, customSoundPath: null });
		return { success: true };
	});

	// Get custom sound path for renderer to load
	ipcMain.handle("notification:get-sound-path", () => {
		const settings = store.getSettings();
		return settings.customSoundPath;
	});
}
