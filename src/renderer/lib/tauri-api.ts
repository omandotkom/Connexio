/**
 * Connexio Tauri API Adapter
 *
 * This module provides the same interface as the old Electron preload bridge
 * (`window.connexio`) but routes calls through Tauri's `invoke` and `listen`.
 *
 * Components can import from here instead of relying on `window.connexio`.
 */

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type {
	AppSettings,
	PinnedCommand,
	Project,
	Session,
	SSHConnection,
	WorkspaceState,
	GitStatus,
	TaskScript,
	ShellInfo,
	AppTheme,
} from "@shared/types";

// ─── Terminal ────────────────────────────────────────────────────────────────

interface TerminalContext {
	projectId: string;
	projectName: string;
	tabId: string;
	tabLabel: string;
}

export const terminal = {
	create: async (projectPath: string, shell?: string, context?: TerminalContext): Promise<string> => {
		try {
			return await invoke("terminal_create", { projectPath, shell: shell || null, context: context || null });
		} catch (e) {
			console.error("[Tauri] terminal_create failed:", e);
			throw e;
		}
	},

	write: (id: string, data: string): Promise<void> =>
		invoke("terminal_write", { id, data }),

	resize: (id: string, cols: number, rows: number): Promise<void> =>
		invoke("terminal_resize", { id, cols: Math.round(cols), rows: Math.round(rows) }),

	close: (id: string): Promise<void> =>
		invoke("terminal_close", { id }),

	onData: (callback: (id: string, data: string) => void): (() => void) => {
		let unlisten: UnlistenFn | null = null;
		let disposed = false;
		listen<[string, string]>("terminal:data", (event) => {
			if (disposed) return;
			const [id, data] = event.payload;
			callback(id, data);
		}).then((fn) => {
			if (disposed) {
				fn();
			} else {
				unlisten = fn;
			}
		});
		return () => {
			disposed = true;
			if (unlisten) unlisten();
		};
	},
};

// ─── Projects ────────────────────────────────────────────────────────────────

export const project = {
	list: (): Promise<Project[]> => invoke("projects_list"),

	add: (proj: Project): Promise<Project[]> =>
		invoke("projects_add", { project: proj }),

	update: (proj: Project): Promise<Project[]> =>
		invoke("projects_update", { project: proj }),

	delete: (id: string): Promise<Project[]> =>
		invoke("projects_delete", { id }),

	selectDir: async (): Promise<string | null> => {
		const selected = await open({ directory: true, multiple: false });
		return selected as string | null;
	},
};

// ─── Session ─────────────────────────────────────────────────────────────────

export const session = {
	save: (sess: Session): Promise<void> =>
		invoke("session_save", { session: sess }),

	load: (id: string): Promise<Session | null> =>
		invoke("session_load", { id }),

	list: (): Promise<Session[]> => invoke("session_list"),

	delete: (id: string): Promise<void> => invoke("session_delete", { id }),
};

// ─── Settings ────────────────────────────────────────────────────────────────

export const settings = {
	get: (): Promise<AppSettings> => invoke("settings_get"),

	set: (s: AppSettings): Promise<AppSettings> =>
		invoke("settings_set", { settings: s }),

	getShells: (): Promise<ShellInfo[]> => invoke("settings_get_shells"),

	getDefaultShell: (): Promise<string> => invoke("settings_get_default_shell"),
};

// ─── Workspace ───────────────────────────────────────────────────────────────

export const workspace = {
	getState: (): Promise<WorkspaceState> => invoke("workspace_get_state"),

	saveState: (state: WorkspaceState): Promise<void> =>
		invoke("workspace_save_state", { state }),
};

// ─── Tasks ───────────────────────────────────────────────────────────────────

export const tasks = {
	detect: (projectPath: string): Promise<TaskScript[]> =>
		invoke("tasks_detect", { projectPath }),
};

// ─── Pinned Commands ─────────────────────────────────────────────────────────

export const pinned = {
	list: (projectId: string): Promise<PinnedCommand[]> =>
		invoke("pinned_list", { projectId }),

	save: (projectId: string, commands: PinnedCommand[]): Promise<void> =>
		invoke("pinned_save", { projectId, commands }),
};

// ─── SSH ─────────────────────────────────────────────────────────────────────

export const ssh = {
	list: (projectId: string): Promise<SSHConnection[]> =>
		invoke("ssh_list", { projectId }),

	save: (projectId: string, connections: SSHConnection[]): Promise<void> =>
		invoke("ssh_save", { projectId, connections }),

	listGlobal: (): Promise<SSHConnection[]> => invoke("ssh_list_global"),

	saveGlobal: (connections: SSHConnection[]): Promise<void> =>
		invoke("ssh_save_global", { connections }),

	buildCommand: (connection: SSHConnection): Promise<string> =>
		invoke("ssh_build_command", { connection }),

	selectKey: async (): Promise<string | null> => {
		const selected = await open({
			multiple: false,
			filters: [{ name: "SSH Keys", extensions: ["pem", "key", "pub", ""] }],
		});
		return selected as string | null;
	},

	keyExists: (keyPath: string): Promise<boolean> =>
		invoke("ssh_key_exists", { keyPath }),
};

// ─── Git ─────────────────────────────────────────────────────────────────────

export const git = {
	status: (projectPath: string): Promise<GitStatus> =>
		invoke("git_status", { projectPath }),

	stage: (projectPath: string, filePath: string): Promise<void> =>
		invoke("git_stage", { projectPath, filePath }),

	unstage: (projectPath: string, filePath: string): Promise<void> =>
		invoke("git_unstage", { projectPath, filePath }),

	commit: (projectPath: string, message: string): Promise<string> =>
		invoke("git_commit", { projectPath, message }),

	push: (projectPath: string): Promise<string> =>
		invoke("git_push", { projectPath }),

	pull: (projectPath: string): Promise<string> =>
		invoke("git_pull", { projectPath }),

	fetch: (projectPath: string): Promise<string> =>
		invoke("git_fetch", { projectPath }),
};

// ─── Theme ───────────────────────────────────────────────────────────────────

export const theme = {
	get: (): Promise<AppTheme> => invoke("theme_get"),
	set: async (themeId: string): Promise<AppTheme> => {
		await invoke("theme_set", { themeId });
		// Return the theme after setting it
		return invoke("theme_get");
	},
	list: (): Promise<AppTheme[]> => invoke("theme_list"),
};

// ─── App Window ──────────────────────────────────────────────────────────────

export const app = {
	minimize: () => getCurrentWindow().minimize(),
	maximize: async () => {
		const win = getCurrentWindow();
		if (await win.isMaximized()) {
			await win.unmaximize();
		} else {
			await win.maximize();
		}
	},
	close: () => getCurrentWindow().close(),
	isMaximized: () => getCurrentWindow().isMaximized(),
	getVersion: (): Promise<string> => invoke("app_get_version"),
};

// ─── Updater (stub for now) ──────────────────────────────────────────────────

export const updater = {
	check: (): Promise<any> => invoke("updater_check"),
	download: (): Promise<void> => invoke("updater_download"),
	install: (): Promise<void> => invoke("updater_install"),
	onChecking: (_cb: () => void) => () => {},
	onAvailable: (_cb: (info: any) => void) => () => {},
	onNotAvailable: (_cb: () => void) => () => {},
	onProgress: (_cb: (progress: any) => void) => () => {},
	onDownloaded: (_cb: (info: any) => void) => () => {},
	onError: (_cb: (error: string) => void) => () => {},
};

// ─── Notification (stub for now) ─────────────────────────────────────────────

export const notification = {
	list: (): Promise<any[]> => Promise.resolve([]),
	unreadCount: (): Promise<number> => Promise.resolve(0),
	markRead: (_id: string): Promise<void> => Promise.resolve(),
	markAllRead: (): Promise<void> => Promise.resolve(),
	remove: (_id: string): Promise<void> => Promise.resolve(),
	clear: (): Promise<void> => Promise.resolve(),
	getSettings: (): Promise<any> => Promise.resolve({}),
	updateSettings: (_settings: any): Promise<void> => Promise.resolve(),
	getPort: (): Promise<number | null> => Promise.resolve(null),
	onReceived: (_cb: (n: any) => void) => () => {},
	onNavigate: (_cb: (n: any) => void) => () => {},
	getProviders: (): Promise<any[]> => Promise.resolve([]),
	installHook: (_providerId: string): Promise<void> => Promise.resolve(),
	uninstallHook: (_providerId: string): Promise<void> => Promise.resolve(),
	uploadSound: (): Promise<void> => Promise.resolve(),
	removeCustomSound: (): Promise<void> => Promise.resolve(),
	getSoundPath: (): Promise<string | null> => Promise.resolve(null),
};

// ─── Combined API (drop-in replacement for window.connexio) ──────────────────

export const connexioApi = {
	terminal,
	project,
	session,
	settings,
	workspace,
	tasks,
	pinned,
	ssh,
	git,
	theme,
	app,
	updater,
	notification,
};

export default connexioApi;
