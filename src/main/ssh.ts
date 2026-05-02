import { dialog, ipcMain } from "electron";
import Store from "electron-store";
import fs from "fs";
import type { SSHConnection } from "../shared/types";

const store = new Store({ name: "ssh-connections" });

function getConnections(projectId: string): SSHConnection[] {
	return store.get(`ssh.${projectId}`, []) as SSHConnection[];
}

function saveConnections(projectId: string, connections: SSHConnection[]) {
	store.set(`ssh.${projectId}`, connections);
}

function getGlobalConnections(): SSHConnection[] {
	return store.get("ssh.global", []) as SSHConnection[];
}

function saveGlobalConnections(connections: SSHConnection[]) {
	store.set("ssh.global", connections);
}

/**
 * Build the SSH command string for a connection.
 * This generates a command that can be run in a terminal tab.
 */
function buildSSHCommand(conn: SSHConnection): string {
	let cmd = "ssh";

	if (conn.port !== 22) {
		cmd += ` -p ${conn.port}`;
	}

	if (conn.authMethod === "key" && conn.privateKeyPath) {
		cmd += ` -i "${conn.privateKeyPath}"`;
	}

	cmd += ` ${conn.username}@${conn.host}`;

	return cmd;
}

export function setupSSHIPC() {
	// Per-project connections
	ipcMain.handle("ssh:list", (_event, projectId: string) => {
		return getConnections(projectId);
	});

	ipcMain.handle(
		"ssh:save",
		(_event, projectId: string, connections: SSHConnection[]) => {
			saveConnections(projectId, connections);
			return connections;
		},
	);

	// Global connections (shared across projects)
	ipcMain.handle("ssh:list-global", () => {
		return getGlobalConnections();
	});

	ipcMain.handle("ssh:save-global", (_event, connections: SSHConnection[]) => {
		saveGlobalConnections(connections);
		return connections;
	});

	// Build SSH command
	ipcMain.handle("ssh:build-command", (_event, connection: SSHConnection) => {
		return buildSSHCommand(connection);
	});

	// Select private key file
	ipcMain.handle("ssh:select-key", async (_event) => {
		const result = await dialog.showOpenDialog({
			title: "Select SSH Private Key",
			properties: ["openFile"],
			filters: [
				{ name: "All Files", extensions: ["*"] },
				{ name: "PEM Files", extensions: ["pem"] },
			],
			defaultPath: process.env.HOME || process.env.USERPROFILE || "",
		});
		if (result.canceled) return null;
		return result.filePaths[0];
	});

	// Test if key file exists
	ipcMain.handle("ssh:key-exists", (_event, keyPath: string) => {
		try {
			return fs.existsSync(keyPath);
		} catch {
			return false;
		}
	});
}
