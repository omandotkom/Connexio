import Store from "electron-store";
import type {
	ConnexioNotification,
	NotificationSettings,
} from "../shared/types";

const MAX_NOTIFICATIONS = 200;

const store = new Store<{
	notifications: ConnexioNotification[];
	notificationSettings: NotificationSettings;
}>({
	name: "notifications",
	defaults: {
		notifications: [],
		notificationSettings: {
			enabled: true,
			sound: true,
			soundVolume: 0.5,
			customSoundPath: null,
			showWhenFocused: false,
			idleNotify: false,
			idleThreshold: 5,
		},
	},
});

class NotificationStore {
	getAll(): ConnexioNotification[] {
		return store.get("notifications", []);
	}

	add(notification: ConnexioNotification): void {
		const notifications = this.getAll();
		notifications.unshift(notification);

		// Trim to max
		if (notifications.length > MAX_NOTIFICATIONS) {
			notifications.length = MAX_NOTIFICATIONS;
		}

		store.set("notifications", notifications);
	}

	markAsRead(id: string): void {
		const notifications = this.getAll();
		const index = notifications.findIndex((n) => n.id === id);
		if (index !== -1) {
			notifications[index].isRead = true;
			store.set("notifications", notifications);
		}
	}

	markAllAsRead(): void {
		const notifications = this.getAll();
		for (const n of notifications) {
			n.isRead = true;
		}
		store.set("notifications", notifications);
	}

	remove(id: string): void {
		const notifications = this.getAll().filter((n) => n.id !== id);
		store.set("notifications", notifications);
	}

	clear(): void {
		store.set("notifications", []);
	}

	getUnreadCount(): number {
		return this.getAll().filter((n) => !n.isRead).length;
	}

	// Settings
	getSettings(): NotificationSettings {
		return store.get("notificationSettings", {
			enabled: true,
			sound: true,
			soundVolume: 0.5,
			customSoundPath: null,
			showWhenFocused: false,
			idleNotify: false,
			idleThreshold: 5,
		});
	}

	updateSettings(settings: NotificationSettings): NotificationSettings {
		store.set("notificationSettings", settings);
		return settings;
	}
}

let instance: NotificationStore | null = null;

export function getNotificationStore(): NotificationStore {
	if (!instance) {
		instance = new NotificationStore();
	}
	return instance;
}
