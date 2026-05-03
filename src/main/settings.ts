import { ipcMain } from "electron";
import Store from "electron-store";
import fs from "fs";
import os from "os";
import path from "path";
import type { AppSettings, ShellInfo } from "../shared/types";

const store = new Store({ name: "settings" });

const DEFAULT_SETTINGS: AppSettings = {
	defaultShell: "",
	fontSize: 13,
	fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace",
	cursorStyle: "bar",
	cursorBlink: true,
	scrollback: 5000,
	copyOnSelect: false,
};

function getSettings(): AppSettings {
	return store.get("settings", DEFAULT_SETTINGS) as AppSettings;
}

function saveSettings(settings: AppSettings) {
	store.set("settings", settings);
}

function shellExists(shellPath: string): boolean {
	try {
		return fs.existsSync(shellPath);
	} catch {
		return false;
	}
}

function detectShells(): ShellInfo[] {
	const shells: ShellInfo[] = [];

	try {
		const platform = os.platform();

		if (platform === "win32") {
			const systemRoot = process.env.SystemRoot || "C:\\Windows";

			// PowerShell 7 (pwsh)
			const pwsh7Paths = [
				"C:\\Program Files\\PowerShell\\7\\pwsh.exe",
				path.join(os.homedir(), ".dotnet", "tools", "pwsh.exe"),
			];
			for (const p of pwsh7Paths) {
				if (shellExists(p)) {
					shells.push({ id: "pwsh7", name: "PowerShell 7", path: p });
					break;
				}
			}

			// Windows PowerShell 5.1
			const wpshPath = path.join(
				systemRoot,
				"System32",
				"WindowsPowerShell",
				"v1.0",
				"powershell.exe",
			);
			if (shellExists(wpshPath)) {
				shells.push({
					id: "powershell",
					name: "Windows PowerShell",
					path: wpshPath,
				});
			}

			// CMD
			const cmdPath = path.join(systemRoot, "System32", "cmd.exe");
			if (shellExists(cmdPath)) {
				shells.push({ id: "cmd", name: "Command Prompt", path: cmdPath });
			}

			// Git Bash
			const gitBashPaths = [
				"C:\\Program Files\\Git\\bin\\bash.exe",
				"C:\\Program Files (x86)\\Git\\bin\\bash.exe",
				path.join(
					process.env.LOCALAPPDATA || "",
					"Programs",
					"Git",
					"bin",
					"bash.exe",
				),
			];
			for (const p of gitBashPaths) {
				if (p && shellExists(p)) {
					shells.push({ id: "gitbash", name: "Git Bash", path: p });
					break;
				}
			}

			// WSL
			const wslPath = path.join(systemRoot, "System32", "wsl.exe");
			if (shellExists(wslPath)) {
				shells.push({ id: "wsl", name: "WSL", path: wslPath });
			}

			// Nushell
			const nushellPaths = [
				path.join(os.homedir(), ".cargo", "bin", "nu.exe"),
				"C:\\Program Files\\nu\\bin\\nu.exe",
			];
			for (const p of nushellPaths) {
				if (shellExists(p)) {
					shells.push({ id: "nushell", name: "Nushell", path: p });
					break;
				}
			}
		} else {
			// Unix-like systems
			const unixShells: Array<{ id: string; name: string; paths: string[] }> = [
				{ id: "bash", name: "Bash", paths: ["/bin/bash", "/usr/bin/bash"] },
				{ id: "zsh", name: "Zsh", paths: ["/bin/zsh", "/usr/bin/zsh"] },
				{
					id: "fish",
					name: "Fish",
					paths: [
						"/usr/bin/fish",
						"/usr/local/bin/fish",
						"/opt/homebrew/bin/fish",
					],
				},
				{
					id: "pwsh",
					name: "PowerShell",
					paths: ["/usr/bin/pwsh", "/usr/local/bin/pwsh"],
				},
				{
					id: "nushell",
					name: "Nushell",
					paths: [
						path.join(os.homedir(), ".cargo", "bin", "nu"),
						"/usr/bin/nu",
						"/usr/local/bin/nu",
					],
				},
			];

			for (const shell of unixShells) {
				for (const p of shell.paths) {
					if (shellExists(p)) {
						shells.push({ id: shell.id, name: shell.name, path: p });
						break;
					}
				}
			}

			// Also check SHELL env
			const envShell = process.env.SHELL;
			if (envShell && !shells.find((s) => s.path === envShell)) {
				const name = path.basename(envShell);
				shells.push({
					id: "env-default",
					name: `${name} (default)`,
					path: envShell,
				});
			}
		}
	} catch (error) {
		console.error("Error detecting shells:", error);
	}

	return shells;
}

export function setupSettingsIPC() {
	ipcMain.handle("settings:get", () => {
		return getSettings();
	});

	ipcMain.handle("settings:set", (_event, settings: AppSettings) => {
		saveSettings(settings);
		return settings;
	});

	ipcMain.handle("settings:get-shells", () => {
		return detectShells();
	});

	ipcMain.handle("settings:get-default-shell", () => {
		const settings = getSettings();
		if (settings.defaultShell) return settings.defaultShell;
		if (os.platform() === "win32") {
			// Prefer PowerShell 7 over Windows PowerShell 5.1
			const pwsh7 = "C:\\Program Files\\PowerShell\\7\\pwsh.exe";
			try {
				if (fs.existsSync(pwsh7)) return pwsh7;
			} catch {
				// ignore
			}
			return "powershell.exe";
		}
		return process.env.SHELL || "/bin/bash";
	});
}
