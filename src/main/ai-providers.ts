import { app } from "electron";
import fs from "fs";
import os from "os";
import path from "path";
import { getNotificationServerPort } from "./notification-server";

export interface AIProvider {
	id: string;
	name: string;
	isInstalled: boolean;
	isHookInstalled: boolean;
}

const CONNEXIO_MARKER = "# connexio-notification-hook";

function getHomedir(): string {
	return os.homedir();
}

function getHooksDir(): string {
	// In production: hooks are in resources/assets/hooks/
	// In dev: hooks are in assets/hooks/
	if (app.isPackaged) {
		return path.join(process.resourcesPath, "assets", "hooks");
	}
	return path.join(__dirname, "..", "..", "assets", "hooks");
}

// ============================================
// Claude Code
// ============================================

function getClaudeSettingsPath(): string {
	return path.join(getHomedir(), ".claude", "settings.json");
}

function isClaudeInstalled(): boolean {
	const paths = [
		path.join(getHomedir(), ".claude"),
		path.join(getHomedir(), "AppData", "Local", "Programs", "claude", "claude.exe"),
	];
	return paths.some((p) => fs.existsSync(p));
}

function isClaudeHookInstalled(): boolean {
	const settingsPath = getClaudeSettingsPath();
	if (!fs.existsSync(settingsPath)) return false;
	try {
		const content = fs.readFileSync(settingsPath, "utf-8");
		return content.includes(CONNEXIO_MARKER);
	} catch {
		return false;
	}
}

function installClaudeHook(): { success: boolean; error?: string } {
	try {
		const settingsPath = getClaudeSettingsPath();
		const settingsDir = path.dirname(settingsPath);

		// Ensure directory exists
		if (!fs.existsSync(settingsDir)) {
			fs.mkdirSync(settingsDir, { recursive: true });
		}

		// Read existing settings
		let settings: Record<string, any> = {};
		if (fs.existsSync(settingsPath)) {
			// Backup
			const backupPath = settingsPath + ".connexio-backup";
			fs.copyFileSync(settingsPath, backupPath);
			settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
		}

		// Build hook command
		const hookScript = path.join(getHooksDir(), "connexio-claude-hook.ps1");
		const command = `powershell -ExecutionPolicy Bypass -File "${hookScript}" -Event stop ${CONNEXIO_MARKER}`;

		// Add hooks
		if (!settings.hooks) settings.hooks = {};

		const hookEntry = {
			matcher: "",
			hooks: [{ type: "command", command, timeout: 10 }],
		};

		// Add to Stop hooks (append, don't replace)
		const stopHooks: any[] = settings.hooks.Stop || [];
		// Remove existing Connexio hooks
		const filteredStop = stopHooks.filter(
			(h: any) => !JSON.stringify(h).includes(CONNEXIO_MARKER),
		);
		filteredStop.push(hookEntry);
		settings.hooks.Stop = filteredStop;

		// Add to Notification hooks
		const notifCommand = `powershell -ExecutionPolicy Bypass -File "${hookScript}" -Event notification ${CONNEXIO_MARKER}`;
		const notifEntry = {
			matcher: "",
			hooks: [{ type: "command", command: notifCommand, timeout: 10 }],
		};
		const notifHooks: any[] = settings.hooks.Notification || [];
		const filteredNotif = notifHooks.filter(
			(h: any) => !JSON.stringify(h).includes(CONNEXIO_MARKER),
		);
		filteredNotif.push(notifEntry);
		settings.hooks.Notification = filteredNotif;

		// Write back
		fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf-8");
		return { success: true };
	} catch (err: any) {
		return { success: false, error: err.message };
	}
}

function uninstallClaudeHook(): { success: boolean; error?: string } {
	try {
		const settingsPath = getClaudeSettingsPath();
		if (!fs.existsSync(settingsPath)) return { success: true };

		const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
		if (!settings.hooks) return { success: true };

		for (const key of ["Stop", "Notification"]) {
			if (Array.isArray(settings.hooks[key])) {
				settings.hooks[key] = settings.hooks[key].filter(
					(h: any) => !JSON.stringify(h).includes(CONNEXIO_MARKER),
				);
				if (settings.hooks[key].length === 0) {
					delete settings.hooks[key];
				}
			}
		}

		if (Object.keys(settings.hooks).length === 0) {
			delete settings.hooks;
		}

		fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf-8");
		return { success: true };
	} catch (err: any) {
		return { success: false, error: err.message };
	}
}

// ============================================
// OpenCode
// ============================================

function getOpenCodePluginsDir(): string {
	return path.join(getHomedir(), ".opencode", "plugins");
}

function isOpenCodeInstalled(): boolean {
	const paths = [
		path.join(getHomedir(), ".opencode"),
		path.join(getHomedir(), ".local", "bin", "opencode"),
		path.join(getHomedir(), ".local", "bin", "opencode.exe"),
	];
	return paths.some((p) => fs.existsSync(p));
}

function isOpenCodeHookInstalled(): boolean {
	const pluginPath = path.join(getOpenCodePluginsDir(), "connexio-notify.js");
	return fs.existsSync(pluginPath);
}

function installOpenCodeHook(): { success: boolean; error?: string } {
	try {
		const pluginsDir = getOpenCodePluginsDir();
		if (!fs.existsSync(pluginsDir)) {
			fs.mkdirSync(pluginsDir, { recursive: true });
		}

		const source = path.join(getHooksDir(), "connexio-opencode-plugin.js");
		const dest = path.join(pluginsDir, "connexio-notify.js");

		fs.copyFileSync(source, dest);
		return { success: true };
	} catch (err: any) {
		return { success: false, error: err.message };
	}
}

function uninstallOpenCodeHook(): { success: boolean; error?: string } {
	try {
		const pluginPath = path.join(getOpenCodePluginsDir(), "connexio-notify.js");
		if (fs.existsSync(pluginPath)) {
			fs.unlinkSync(pluginPath);
		}
		return { success: true };
	} catch (err: any) {
		return { success: false, error: err.message };
	}
}

// ============================================
// Pi Agent
// ============================================

function getPiHooksDir(): string {
	return path.join(getHomedir(), ".pi", "hooks");
}

function getPiSettingsPath(): string {
	return path.join(getHomedir(), ".pi", "agent", "settings.json");
}

function isPiInstalled(): boolean {
	return fs.existsSync(path.join(getHomedir(), ".pi", "agent"));
}

function isPiHookInstalled(): boolean {
	const hookPath = path.join(getPiHooksDir(), "connexio-notify.ts");
	if (!fs.existsSync(hookPath)) return false;

	// Also check if referenced in settings
	const settingsPath = getPiSettingsPath();
	if (!fs.existsSync(settingsPath)) return false;
	try {
		const content = fs.readFileSync(settingsPath, "utf-8");
		return content.includes("connexio-notify");
	} catch {
		return false;
	}
}

function installPiHook(): { success: boolean; error?: string } {
	try {
		// Copy hook file
		const hooksDir = getPiHooksDir();
		if (!fs.existsSync(hooksDir)) {
			fs.mkdirSync(hooksDir, { recursive: true });
		}

		const source = path.join(getHooksDir(), "connexio-pi-hook.ts");
		const dest = path.join(hooksDir, "connexio-notify.ts");
		fs.copyFileSync(source, dest);

		// Add to settings.json
		const settingsPath = getPiSettingsPath();
		let settings: Record<string, any> = {};
		if (fs.existsSync(settingsPath)) {
			// Backup
			const backupPath = settingsPath + ".connexio-backup";
			fs.copyFileSync(settingsPath, backupPath);
			settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
		}

		const hookRef = "~/.pi/hooks/connexio-notify.ts";
		if (!settings.hooks) settings.hooks = [];
		if (!settings.hooks.includes(hookRef)) {
			settings.hooks.push(hookRef);
		}

		fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf-8");
		return { success: true };
	} catch (err: any) {
		return { success: false, error: err.message };
	}
}

function uninstallPiHook(): { success: boolean; error?: string } {
	try {
		// Remove hook file
		const hookPath = path.join(getPiHooksDir(), "connexio-notify.ts");
		if (fs.existsSync(hookPath)) {
			fs.unlinkSync(hookPath);
		}

		// Remove from settings.json
		const settingsPath = getPiSettingsPath();
		if (fs.existsSync(settingsPath)) {
			const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
			if (Array.isArray(settings.hooks)) {
				settings.hooks = settings.hooks.filter(
					(h: string) => !h.includes("connexio-notify"),
				);
				if (settings.hooks.length === 0) {
					delete settings.hooks;
				}
			}
			fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf-8");
		}

		return { success: true };
	} catch (err: any) {
		return { success: false, error: err.message };
	}
}

// ============================================
// Public API
// ============================================

export function getProviders(): AIProvider[] {
	return [
		{
			id: "claude",
			name: "Claude Code",
			isInstalled: isClaudeInstalled(),
			isHookInstalled: isClaudeHookInstalled(),
		},
		{
			id: "opencode",
			name: "OpenCode",
			isInstalled: isOpenCodeInstalled(),
			isHookInstalled: isOpenCodeHookInstalled(),
		},
		{
			id: "pi",
			name: "Pi Agent",
			isInstalled: isPiInstalled(),
			isHookInstalled: isPiHookInstalled(),
		},
	];
}

export function installHook(providerId: string): { success: boolean; error?: string } {
	switch (providerId) {
		case "claude":
			return installClaudeHook();
		case "opencode":
			return installOpenCodeHook();
		case "pi":
			return installPiHook();
		default:
			return { success: false, error: `Unknown provider: ${providerId}` };
	}
}

export function uninstallHook(providerId: string): { success: boolean; error?: string } {
	switch (providerId) {
		case "claude":
			return uninstallClaudeHook();
		case "opencode":
			return uninstallOpenCodeHook();
		case "pi":
			return uninstallPiHook();
		default:
			return { success: false, error: `Unknown provider: ${providerId}` };
	}
}

export function getNotificationPort(): number | null {
	return getNotificationServerPort();
}
