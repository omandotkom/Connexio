// ============================================
// Connexio — Shared Types
// ============================================

export interface Project {
	id: string;
	name: string;
	path: string;
	group: string;
	icon?: string;
	color?: string;
	tabs: TabConfig[];
	createdAt: number;
	lastOpenedAt: number;
}

export interface TabConfig {
	id: string;
	label: string;
	shell?: string;
	command?: string;
}

export interface Session {
	id: string;
	projectId: string;
	tabs: SessionTab[];
	savedAt: number;
}

export interface SessionTab {
	id: string;
	tabConfigId: string;
	scrollback?: string;
	cwd: string;
}

export interface AppTheme {
	id: string;
	name: string;
	type: "dark" | "light";
	colors: ThemeColors;
	terminal: TerminalThemeColors;
}

export interface ThemeColors {
	bgPrimary: string;
	bgSecondary: string;
	bgTertiary: string;
	borderColor: string;
	accentColor: string;
	accentHover: string;
	textPrimary: string;
	textSecondary: string;
	textMuted: string;
}

export interface TerminalThemeColors {
	background: string;
	foreground: string;
	cursor: string;
	cursorAccent: string;
	selectionBackground: string;
	black: string;
	red: string;
	green: string;
	yellow: string;
	blue: string;
	magenta: string;
	cyan: string;
	white: string;
	brightBlack: string;
	brightRed: string;
	brightGreen: string;
	brightYellow: string;
	brightBlue: string;
	brightMagenta: string;
	brightCyan: string;
	brightWhite: string;
}

export interface AppSettings {
	defaultShell: string;
	fontSize: number;
	fontFamily: string;
	cursorStyle: "bar" | "block" | "underline";
	cursorBlink: boolean;
	scrollback: number;
	copyOnSelect: boolean;
}

export interface ShellInfo {
	id: string;
	name: string;
	path: string;
}

// Persisted workspace tab (without live terminalId)
export interface WorkspaceTabState {
	id: string;
	label: string;
	shell?: string;
}

// Full workspace state to persist
export interface WorkspaceState {
	activeProjectId: string | null;
	projectTabs: Record<string, WorkspaceTabState[]>;
	activeTabIds: Record<string, string>;
}

// Task Runner
export interface TaskScript {
	name: string;
	command: string;
	source: "package.json" | "Makefile" | "Cargo.toml" | "pyproject.toml";
}

// Pinned Commands
export interface PinnedCommand {
	id: string;
	label: string;
	command: string;
	color?: string;
}

// SSH Connection
export interface SSHConnection {
	id: string;
	name: string;
	host: string;
	port: number;
	username: string;
	authMethod: "password" | "key";
	privateKeyPath?: string;
	color?: string;
}

export interface GitStatus {
	isRepo: boolean;
	branch: string;
	ahead: number;
	behind: number;
	modified: number;
	staged: number;
	untracked: number;
	conflicted: number;
	stashes: number;
	lastCommit: string;
	lastCommitTime: string;
	remoteUrl: string;
}

// Notifications
export type NotificationSource = "agent" | "command" | "system";

export interface ConnexioNotification {
	id: string;
	source: NotificationSource;
	provider?: string; // "claude" | "opencode" | "codex" | "pi" etc.
	title: string;
	body: string;
	tabId?: string;
	projectId?: string;
	timestamp: number;
	isRead: boolean;
}

export interface NotificationSettings {
	enabled: boolean;
	sound: boolean;
	showWhenFocused: boolean;
	idleThreshold: number; // seconds, for generic idle detection
}

export interface AIProvider {
	id: string;
	name: string;
	isInstalled: boolean;
	isHookInstalled: boolean;
}

// IPC Channel names
export const IPC = {
	TERMINAL_CREATE: "terminal:create",
	TERMINAL_DATA: "terminal:data",
	TERMINAL_WRITE: "terminal:write",
	TERMINAL_RESIZE: "terminal:resize",
	TERMINAL_CLOSE: "terminal:close",
	PROJECT_LIST: "project:list",
	PROJECT_ADD: "project:add",
	PROJECT_UPDATE: "project:update",
	PROJECT_DELETE: "project:delete",
	PROJECT_SELECT_DIR: "project:select-dir",
	SESSION_SAVE: "session:save",
	SESSION_LOAD: "session:load",
	SESSION_LIST: "session:list",
	SESSION_DELETE: "session:delete",
	THEME_GET: "theme:get",
	THEME_SET: "theme:set",
	THEME_LIST: "theme:list",
	APP_MINIMIZE: "app:minimize",
	APP_MAXIMIZE: "app:maximize",
	APP_CLOSE: "app:close",
	APP_IS_MAXIMIZED: "app:is-maximized",
} as const;
