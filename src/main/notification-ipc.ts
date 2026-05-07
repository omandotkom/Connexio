import { ipcMain } from "electron";
import type { NotificationSettings } from "../shared/types";
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

	ipcMain.handle("notification:update-settings", (_event, settings: NotificationSettings) => {
		return store.updateSettings(settings);
	});

	ipcMain.handle("notification:get-port", () => {
		return getNotificationServerPort();
	});
}
