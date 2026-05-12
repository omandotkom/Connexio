import { contextBridge, type IpcRendererEvent, ipcRenderer } from "electron";
import type {
	AppSettings,
	PinnedCommand,
	Project,
	Session,
	SSHConnection,
	WorkspaceState,
} from "../shared/types";

// Prevent MaxListenersExceededWarning when many terminals are open
// Each terminal registers its own listener on "terminal:data"
ipcRenderer.setMaxListeners(50);

contextBridge.exposeInMainWorld("connexio", {
	terminal: {
		create: (
			projectPath: string,
			shell?: string,
			context?: {
				projectId: string;
				projectName: string;
				tabId: string;
				tabLabel: string;
			},
		) => ipcRenderer.invoke("terminal:create", projectPath, shell, context),
		write: (id: string, data: string) =>
			ipcRenderer.invoke("terminal:write", id, data),
		resize: (id: string, cols: number, rows: number) =>
			ipcRenderer.invoke("terminal:resize", id, cols, rows),
		close: (id: string) => ipcRenderer.invoke("terminal:close", id),
		onData: (callback: (id: string, data: string) => void) => {
			const listener = (_event: IpcRendererEvent, id: string, data: string) =>
				callback(id, data);
			ipcRenderer.on("terminal:data", listener);
			return () => ipcRenderer.removeListener("terminal:data", listener);
		},
	},

	project: {
		list: () => ipcRenderer.invoke("project:list"),
		add: (project: Project) => ipcRenderer.invoke("project:add", project),
		update: (project: Project) => ipcRenderer.invoke("project:update", project),
		delete: (id: string) => ipcRenderer.invoke("project:delete", id),
		selectDir: () => ipcRenderer.invoke("project:select-dir"),
	},

	session: {
		save: (session: Session) => ipcRenderer.invoke("session:save", session),
		load: (id: string) => ipcRenderer.invoke("session:load", id),
		list: () => ipcRenderer.invoke("session:list"),
		delete: (id: string) => ipcRenderer.invoke("session:delete", id),
	},

	theme: {
		get: () => ipcRenderer.invoke("theme:get"),
		set: (themeId: string) => ipcRenderer.invoke("theme:set", themeId),
		list: () => ipcRenderer.invoke("theme:list"),
	},

	settings: {
		get: () => ipcRenderer.invoke("settings:get"),
		set: (settings: AppSettings) =>
			ipcRenderer.invoke("settings:set", settings),
		getShells: () => ipcRenderer.invoke("settings:get-shells"),
		getDefaultShell: () => ipcRenderer.invoke("settings:get-default-shell"),
	},

	workspace: {
		getState: () => ipcRenderer.invoke("workspace:get-state"),
		saveState: (state: WorkspaceState) =>
			ipcRenderer.invoke("workspace:save-state", state),
	},

	tasks: {
		detect: (projectPath: string) =>
			ipcRenderer.invoke("tasks:detect", projectPath),
	},

	pinned: {
		list: (projectId: string) => ipcRenderer.invoke("pinned:list", projectId),
		save: (projectId: string, commands: PinnedCommand[]) =>
			ipcRenderer.invoke("pinned:save", projectId, commands),
	},

	ssh: {
		list: (projectId: string) => ipcRenderer.invoke("ssh:list", projectId),
		save: (projectId: string, connections: SSHConnection[]) =>
			ipcRenderer.invoke("ssh:save", projectId, connections),
		listGlobal: () => ipcRenderer.invoke("ssh:list-global"),
		saveGlobal: (connections: SSHConnection[]) =>
			ipcRenderer.invoke("ssh:save-global", connections),
		buildCommand: (connection: SSHConnection) =>
			ipcRenderer.invoke("ssh:build-command", connection),
		selectKey: () => ipcRenderer.invoke("ssh:select-key"),
		keyExists: (keyPath: string) =>
			ipcRenderer.invoke("ssh:key-exists", keyPath),
	},

	git: {
		status: (projectPath: string) =>
			ipcRenderer.invoke("git:status", projectPath),
		changedFiles: (projectPath: string) =>
			ipcRenderer.invoke("git:changed-files", projectPath),
		diff: (projectPath: string, filePath: string, staged: boolean) =>
			ipcRenderer.invoke("git:diff", projectPath, filePath, staged),
		diffUntracked: (projectPath: string, filePath: string) =>
			ipcRenderer.invoke("git:diff-untracked", projectPath, filePath),
		stage: (projectPath: string, filePath: string) =>
			ipcRenderer.invoke("git:stage", projectPath, filePath),
		stageAll: (projectPath: string) =>
			ipcRenderer.invoke("git:stage-all", projectPath),
		unstage: (projectPath: string, filePath: string) =>
			ipcRenderer.invoke("git:unstage", projectPath, filePath),
		unstageAll: (projectPath: string) =>
			ipcRenderer.invoke("git:unstage-all", projectPath),
		discard: (projectPath: string, filePath: string) =>
			ipcRenderer.invoke("git:discard", projectPath, filePath),
		openFile: (projectPath: string, filePath: string) =>
			ipcRenderer.invoke("git:open-file", projectPath, filePath),
	},

	updater: {
		check: () => ipcRenderer.invoke("updater:check"),
		download: () => ipcRenderer.invoke("updater:download"),
		install: () => ipcRenderer.invoke("updater:install"),
		onChecking: (cb: () => void) => {
			ipcRenderer.on("updater:checking", cb);
			return () => ipcRenderer.removeListener("updater:checking", cb);
		},
		onAvailable: (cb: (info: any) => void) => {
			const listener = (_e: any, info: any) => cb(info);
			ipcRenderer.on("updater:available", listener);
			return () => ipcRenderer.removeListener("updater:available", listener);
		},
		onNotAvailable: (cb: () => void) => {
			ipcRenderer.on("updater:not-available", cb);
			return () => ipcRenderer.removeListener("updater:not-available", cb);
		},
		onProgress: (cb: (progress: any) => void) => {
			const listener = (_e: any, progress: any) => cb(progress);
			ipcRenderer.on("updater:progress", listener);
			return () => ipcRenderer.removeListener("updater:progress", listener);
		},
		onDownloaded: (cb: (info: any) => void) => {
			const listener = (_e: any, info: any) => cb(info);
			ipcRenderer.on("updater:downloaded", listener);
			return () => ipcRenderer.removeListener("updater:downloaded", listener);
		},
		onError: (cb: (error: string) => void) => {
			const listener = (_e: any, error: string) => cb(error);
			ipcRenderer.on("updater:error", listener);
			return () => ipcRenderer.removeListener("updater:error", listener);
		},
	},

	app: {
		minimize: () => ipcRenderer.invoke("app:minimize"),
		maximize: () => ipcRenderer.invoke("app:maximize"),
		close: () => ipcRenderer.invoke("app:close"),
		isMaximized: () => ipcRenderer.invoke("app:is-maximized"),
		getVersion: () => ipcRenderer.invoke("app:get-version"),
	},

	notification: {
		list: () => ipcRenderer.invoke("notification:list"),
		unreadCount: () => ipcRenderer.invoke("notification:unread-count"),
		markRead: (id: string) => ipcRenderer.invoke("notification:mark-read", id),
		markAllRead: () => ipcRenderer.invoke("notification:mark-all-read"),
		remove: (id: string) => ipcRenderer.invoke("notification:remove", id),
		clear: () => ipcRenderer.invoke("notification:clear"),
		getSettings: () => ipcRenderer.invoke("notification:get-settings"),
		updateSettings: (
			settings: import("../shared/types").NotificationSettings,
		) => ipcRenderer.invoke("notification:update-settings", settings),
		getPort: () => ipcRenderer.invoke("notification:get-port"),
		onReceived: (
			cb: (
				notification: import("../shared/types").ConnexioNotification,
			) => void,
		) => {
			const listener = (
				_e: IpcRendererEvent,
				notification: import("../shared/types").ConnexioNotification,
			) => cb(notification);
			ipcRenderer.on("notification:received", listener);
			return () =>
				ipcRenderer.removeListener("notification:received", listener);
		},
		onNavigate: (
			cb: (
				notification: import("../shared/types").ConnexioNotification,
			) => void,
		) => {
			const listener = (
				_e: IpcRendererEvent,
				notification: import("../shared/types").ConnexioNotification,
			) => cb(notification);
			ipcRenderer.on("notification:navigate", listener);
			return () =>
				ipcRenderer.removeListener("notification:navigate", listener);
		},
		getProviders: () => ipcRenderer.invoke("notification:get-providers"),
		installHook: (providerId: string) =>
			ipcRenderer.invoke("notification:install-hook", providerId),
		uninstallHook: (providerId: string) =>
			ipcRenderer.invoke("notification:uninstall-hook", providerId),
		uploadSound: () => ipcRenderer.invoke("notification:upload-sound"),
		removeCustomSound: () =>
			ipcRenderer.invoke("notification:remove-custom-sound"),
		getSoundPath: () => ipcRenderer.invoke("notification:get-sound-path"),
	},
});
