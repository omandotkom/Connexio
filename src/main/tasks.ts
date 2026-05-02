import { ipcMain } from "electron";
import Store from "electron-store";
import fs from "fs";
import path from "path";
import type { PinnedCommand, TaskScript } from "../shared/types";

const store = new Store({ name: "pinned-commands" });

// ============================================
// Task Runner — detect scripts from project
// ============================================

function detectPackageJsonScripts(projectPath: string): TaskScript[] {
	try {
		const pkgPath = path.join(projectPath, "package.json");
		if (!fs.existsSync(pkgPath)) return [];
		const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
		if (!pkg.scripts) return [];
		return Object.entries(pkg.scripts).map(([name, command]) => ({
			name,
			command: `npm run ${name}`,
			source: "package.json" as const,
		}));
	} catch {
		return [];
	}
}

function detectMakefileTargets(projectPath: string): TaskScript[] {
	try {
		const makePath = path.join(projectPath, "Makefile");
		if (!fs.existsSync(makePath)) return [];
		const content = fs.readFileSync(makePath, "utf-8");
		const targets: TaskScript[] = [];
		for (const line of content.split("\n")) {
			const match = line.match(/^([a-zA-Z_][a-zA-Z0-9_-]*):/);
			if (match && !match[1].startsWith(".")) {
				targets.push({
					name: match[1],
					command: `make ${match[1]}`,
					source: "Makefile",
				});
			}
		}
		return targets;
	} catch {
		return [];
	}
}

function detectCargoScripts(projectPath: string): TaskScript[] {
	try {
		const cargoPath = path.join(projectPath, "Cargo.toml");
		if (!fs.existsSync(cargoPath)) return [];
		return [
			{ name: "build", command: "cargo build", source: "Cargo.toml" as const },
			{ name: "run", command: "cargo run", source: "Cargo.toml" as const },
			{ name: "test", command: "cargo test", source: "Cargo.toml" as const },
			{ name: "check", command: "cargo check", source: "Cargo.toml" as const },
			{
				name: "clippy",
				command: "cargo clippy",
				source: "Cargo.toml" as const,
			},
		];
	} catch {
		return [];
	}
}

function detectPythonScripts(projectPath: string): TaskScript[] {
	try {
		const pyprojectPath = path.join(projectPath, "pyproject.toml");
		if (!fs.existsSync(pyprojectPath)) return [];
		const scripts: TaskScript[] = [
			{
				name: "install",
				command: "pip install -e .",
				source: "pyproject.toml" as const,
			},
			{ name: "test", command: "pytest", source: "pyproject.toml" as const },
		];
		// Check for common tools
		const content = fs.readFileSync(pyprojectPath, "utf-8");
		if (content.includes("[tool.ruff]")) {
			scripts.push({
				name: "lint",
				command: "ruff check .",
				source: "pyproject.toml",
			});
		}
		return scripts;
	} catch {
		return [];
	}
}

// ============================================
// Pinned Commands — per project
// ============================================

function getPinnedCommands(projectId: string): PinnedCommand[] {
	return store.get(`pinned.${projectId}`, []) as PinnedCommand[];
}

function savePinnedCommands(projectId: string, commands: PinnedCommand[]) {
	store.set(`pinned.${projectId}`, commands);
}

// ============================================
// IPC Setup
// ============================================

export function setupTasksIPC() {
	// Task Runner
	ipcMain.handle("tasks:detect", (_event, projectPath: string) => {
		const scripts = [
			...detectPackageJsonScripts(projectPath),
			...detectMakefileTargets(projectPath),
			...detectCargoScripts(projectPath),
			...detectPythonScripts(projectPath),
		];
		return scripts;
	});

	// Pinned Commands
	ipcMain.handle("pinned:list", (_event, projectId: string) => {
		return getPinnedCommands(projectId);
	});

	ipcMain.handle(
		"pinned:save",
		(_event, projectId: string, commands: PinnedCommand[]) => {
			savePinnedCommands(projectId, commands);
			return commands;
		},
	);
}
