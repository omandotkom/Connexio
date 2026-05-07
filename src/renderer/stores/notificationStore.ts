import { create } from "zustand";
import type {
	ConnexioNotification,
	NotificationSettings,
} from "../../shared/types";

interface NotificationStore {
	notifications: ConnexioNotification[];
	unreadCount: number;
	settings: NotificationSettings | null;
	isOpen: boolean;
	toast: ConnexioNotification | null;

	// Actions
	loadNotifications: () => Promise<void>;
	loadSettings: () => Promise<void>;
	updateSettings: (settings: NotificationSettings) => Promise<void>;
	markRead: (id: string) => Promise<void>;
	markAllRead: () => Promise<void>;
	remove: (id: string) => Promise<void>;
	clear: () => Promise<void>;
	togglePanel: () => void;
	closePanel: () => void;

	// Real-time
	handleIncoming: (notification: ConnexioNotification) => void;
	dismissToast: () => void;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
	notifications: [],
	unreadCount: 0,
	settings: null,
	isOpen: false,
	toast: null,

	loadNotifications: async () => {
		const notifications = await window.connexio.notification.list();
		const unreadCount = await window.connexio.notification.unreadCount();
		set({ notifications, unreadCount });
	},

	loadSettings: async () => {
		const settings = await window.connexio.notification.getSettings();
		set({ settings });
	},

	updateSettings: async (settings: NotificationSettings) => {
		const updated = await window.connexio.notification.updateSettings(settings);
		set({ settings: updated });
	},

	markRead: async (id: string) => {
		await window.connexio.notification.markRead(id);
		const { notifications } = get();
		const updated = notifications.map((n) =>
			n.id === id ? { ...n, isRead: true } : n,
		);
		set({
			notifications: updated,
			unreadCount: updated.filter((n) => !n.isRead).length,
		});
	},

	markAllRead: async () => {
		await window.connexio.notification.markAllRead();
		const { notifications } = get();
		set({
			notifications: notifications.map((n) => ({ ...n, isRead: true })),
			unreadCount: 0,
		});
	},

	remove: async (id: string) => {
		await window.connexio.notification.remove(id);
		const { notifications } = get();
		const updated = notifications.filter((n) => n.id !== id);
		set({
			notifications: updated,
			unreadCount: updated.filter((n) => !n.isRead).length,
		});
	},

	clear: async () => {
		await window.connexio.notification.clear();
		set({ notifications: [], unreadCount: 0 });
	},

	togglePanel: () => {
		set((state) => ({ isOpen: !state.isOpen }));
	},

	closePanel: () => {
		set({ isOpen: false });
	},

	handleIncoming: (notification: ConnexioNotification) => {
		const { notifications, settings } = get();
		const updated = [notification, ...notifications];
		set({
			notifications: updated,
			unreadCount: updated.filter((n) => !n.isRead).length,
			toast: notification,
		});

		// Auto-dismiss toast after 4 seconds
		setTimeout(() => {
			const { toast } = get();
			if (toast?.id === notification.id) {
				set({ toast: null });
			}
		}, 4000);

		// Play sound if enabled
		if (settings?.sound) {
			try {
				const soundUrl = new URL(
					"../assets/notification.wav",
					import.meta.url,
				).href;
				const audio = new Audio(soundUrl);
				audio.volume = settings.soundVolume ?? 0.5;
				audio.play().catch(() => {});
			} catch {
				// Ignore audio errors
			}
		}
	},

	dismissToast: () => {
		set({ toast: null });
	},
}));
