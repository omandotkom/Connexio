import { BrowserWindow, ipcMain } from "electron";
import fs from "fs";
import * as pty from "node-pty";
import os from "os";
import { getNotificationServerPort } from "./notification-server";

interface TerminalEntry {
	process: pty.IPty;
	cols: number;
	rows: number;
}

interface TerminalContext {
	projectId: string;
	projectName: string;
	tabId: string;
	tabLabel: string;
}

const terminals: Map<string, TerminalEntry> = new Map();
let terminalCounter = 0;

// Resize debounce timers per terminal — prevents rapid resize events
// from corrupting TUI apps (opencode, vim, htop) on Windows ConPTY
const resizeTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
const RESIZE_DEBOUNCE_MS = 150;

function getDefaultShell(): string {
	if (os.platform() === "win32") {
		// Prefer PowerShell 7 (pwsh) over Windows PowerShell 5.1
		const pwsh7Paths = [
			"C:\\Program Files\\PowerShell\\7\\pwsh.exe",
			"C:\\Program Files (x86)\\PowerShell\\7\\pwsh.exe",
		];
		for (const p of pwsh7Paths) {
			try {
				if (fs.existsSync(p)) return p;
			} catch {
				// ignore
			}
		}
		// Fallback to Windows PowerShell 5.1
		return "powershell.exe";
	}
	return process.env.SHELL || "/bin/bash";
}

function isValidDirectory(dirPath: string): boolean {
	try {
		return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
	} catch {
		return false;
	}
}

export function setupTerminalIPC() {
	ipcMain.handle(
		"terminal:create",
		(_event, projectPath: string, shell?: string, context?: TerminalContext) => {
			const id = `term-${++terminalCounter}`;
			const shellPath = shell || getDefaultShell();
			const cwd = isValidDirectory(projectPath) ? projectPath : os.homedir();

			try {
				// Build environment with proper terminal capabilities
				const env: Record<string, string> = {
					...(process.env as Record<string, string>),
					TERM: "xterm-256color",
					COLORTERM: "truecolor",
					TERM_PROGRAM: "Connexio",
				};

				// Ensure LANG is set for proper Unicode rendering
				if (!env.LANG) {
					env.LANG = "en_US.UTF-8";
				}

				// Inject notification context so AI agent hooks can connect and identify the source tab
				const notifPort = getNotificationServerPort();
				if (notifPort) {
					env.CONNEXIO_NOTIFICATION_PORT = String(notifPort);
				}
				if (context) {
					env.CONNEXIO_PROJECT_ID = context.projectId;
					env.CONNEXIO_PROJECT_NAME = context.projectName;
					env.CONNEXIO_TAB_ID = context.tabId;
					env.CONNEXIO_TAB_LABEL = context.tabLabel;
					env.CONNEXIO_TERMINAL_ID = id;
				}

				const ptyProcess = pty.spawn(shellPath, [], {
					name: "xterm-256color",
					cols: 80,
					rows: 24,
					cwd,
					env,
					// On Windows: use the bundled conpty.dll (same approach as VS Code
					// and Windows Terminal). The OS-shipped ConPTY is often outdated
					// and has rendering bugs with TUI apps (opencode, vim, htop).
					// useConptyDll uses the newer conpty.dll shipped with node-pty.
					...(os.platform() === "win32"
						? {
								useConpty: true,
								useConptyDll: true,
								conptyInheritCursor: false,
							}
						: {}),
				});

				ptyProcess.onData((data: string) => {
					// Send only to the focused window instead of broadcasting to all
					const win =
						BrowserWindow.getFocusedWindow() ||
						BrowserWindow.getAllWindows()[0];
					if (win && !win.isDestroyed()) {
						win.webContents.send("terminal:data", id, data);
					}
				});

				ptyProcess.onExit(() => {
					terminals.delete(id);
					const timer = resizeTimers.get(id);
					if (timer) {
						clearTimeout(timer);
						resizeTimers.delete(id);
					}
				});

				terminals.set(id, { process: ptyProcess, cols: 80, rows: 24 });
				return id;
			} catch (error) {
				console.error(`Failed to create terminal: ${error}`);
				throw new Error(`Failed to create terminal: ${error}`);
			}
		},
	);

	ipcMain.handle("terminal:write", (_event, id: string, data: string) => {
		const entry = terminals.get(id);
		if (entry) {
			entry.process.write(data);
		}
	});

	ipcMain.handle(
		"terminal:resize",
		(_event, id: string, cols: number, rows: number) => {
			const entry = terminals.get(id);
			if (!entry) return;
			if (cols <= 0 || rows <= 0) return;

			// Skip if dimensions haven't actually changed
			if (entry.cols === cols && entry.rows === rows) return;

			// Debounce resize on Windows to prevent ConPTY glitches with TUI apps
			// ConPTY sends a full screen repaint on each resize, and rapid resizes
			// cause the TUI to receive partial/corrupted frames
			const existingTimer = resizeTimers.get(id);
			if (existingTimer) {
				clearTimeout(existingTimer);
			}

			const timer = setTimeout(() => {
				resizeTimers.delete(id);
				const current = terminals.get(id);
				if (!current) return;
				try {
					current.process.resize(cols, rows);
					current.cols = cols;
					current.rows = rows;
				} catch (_e) {
					// Ignore resize errors
				}
			}, RESIZE_DEBOUNCE_MS);

			resizeTimers.set(id, timer);
		},
	);

	ipcMain.handle("terminal:close", (_event, id: string) => {
		const entry = terminals.get(id);
		if (entry) {
			try {
				entry.process.kill();
			} catch (_e) {
				// Terminal may already be dead
			}
			terminals.delete(id);
			const timer = resizeTimers.get(id);
			if (timer) {
				clearTimeout(timer);
				resizeTimers.delete(id);
			}
		}
	});
}

/**
 * Kill all active terminal processes.
 * Called before app quit to avoid node-pty fork issues on Windows.
 */
export function killAllTerminals() {
	for (const [id, entry] of terminals.entries()) {
		try {
			entry.process.kill();
		} catch (_e) {
			// Terminal may already be dead
		}
		terminals.delete(id);
	}
	for (const [id, timer] of resizeTimers.entries()) {
		clearTimeout(timer);
		resizeTimers.delete(id);
	}
}

// Cleanup on process exit as safety net
process.on("exit", () => {
	killAllTerminals();
});
