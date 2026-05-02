import { BrowserWindow, ipcMain } from "electron";
import fs from "fs";
import * as pty from "node-pty";
import os from "os";

const terminals: Map<string, pty.IPty> = new Map();
let terminalCounter = 0;

function getDefaultShell(): string {
	if (os.platform() === "win32") {
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
		(_event, projectPath: string, shell?: string) => {
			const id = `term-${++terminalCounter}`;
			const shellPath = shell || getDefaultShell();
			const cwd = isValidDirectory(projectPath) ? projectPath : os.homedir();

			try {
				const ptyProcess = pty.spawn(shellPath, [], {
					name: "xterm-256color",
					cols: 80,
					rows: 24,
					cwd,
					env: process.env as Record<string, string>,
				});

				ptyProcess.onData((data: string) => {
					const windows = BrowserWindow.getAllWindows();
					for (const win of windows) {
						if (!win.isDestroyed()) {
							win.webContents.send("terminal:data", id, data);
						}
					}
				});

				ptyProcess.onExit(() => {
					terminals.delete(id);
				});

				terminals.set(id, ptyProcess);
				return id;
			} catch (error) {
				console.error(`Failed to create terminal: ${error}`);
				throw new Error(`Failed to create terminal: ${error}`);
			}
		},
	);

	ipcMain.handle("terminal:write", (_event, id: string, data: string) => {
		const term = terminals.get(id);
		if (term) {
			term.write(data);
		}
	});

	ipcMain.handle(
		"terminal:resize",
		(_event, id: string, cols: number, rows: number) => {
			const term = terminals.get(id);
			if (term) {
				try {
					if (cols > 0 && rows > 0) {
						term.resize(cols, rows);
					}
				} catch (_e) {
					// Ignore resize errors
				}
			}
		},
	);

	ipcMain.handle("terminal:close", (_event, id: string) => {
		const term = terminals.get(id);
		if (term) {
			try {
				term.kill();
			} catch (_e) {
				// Terminal may already be dead
			}
			terminals.delete(id);
		}
	});
}

/**
 * Kill all active terminal processes.
 * Called before app quit to avoid node-pty fork issues on Windows.
 */
export function killAllTerminals() {
	for (const [id, term] of terminals.entries()) {
		try {
			term.kill();
		} catch (_e) {
			// Terminal may already be dead
		}
		terminals.delete(id);
	}
}

// Cleanup on process exit as safety net
process.on("exit", () => {
	killAllTerminals();
});
