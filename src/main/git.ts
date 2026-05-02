import { execFile } from "child_process";
import { app, ipcMain } from "electron";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import type { GitStatus } from "../shared/types";

const execFileAsync = promisify(execFile);

async function runGit(cwd: string, args: string[]): Promise<string> {
	try {
		const { stdout } = await execFileAsync("git", args, {
			cwd,
			timeout: 5000,
			windowsHide: true,
		});
		return stdout.trim();
	} catch {
		return "";
	}
}

async function getGitStatus(projectPath: string): Promise<GitStatus> {
	const empty: GitStatus = {
		isRepo: false,
		branch: "",
		ahead: 0,
		behind: 0,
		modified: 0,
		staged: 0,
		untracked: 0,
		conflicted: 0,
		stashes: 0,
		lastCommit: "",
		lastCommitTime: "",
		remoteUrl: "",
	};

	// Check if .git exists
	const gitDir = path.join(projectPath, ".git");
	try {
		const stat = fs.statSync(gitDir);
		if (!stat.isDirectory() && !stat.isFile()) return empty;
	} catch {
		return empty;
	}

	// Branch name
	const branch = await runGit(projectPath, [
		"rev-parse",
		"--abbrev-ref",
		"HEAD",
	]);
	if (!branch) return empty;

	// Ahead/behind
	let ahead = 0;
	let behind = 0;
	const abOutput = await runGit(projectPath, [
		"rev-list",
		"--left-right",
		"--count",
		`HEAD...@{upstream}`,
	]);
	if (abOutput) {
		const parts = abOutput.split(/\s+/);
		ahead = parseInt(parts[0], 10) || 0;
		behind = parseInt(parts[1], 10) || 0;
	}

	// Status (porcelain)
	const statusOutput = await runGit(projectPath, ["status", "--porcelain=v1"]);
	let modified = 0;
	let staged = 0;
	let untracked = 0;
	let conflicted = 0;

	if (statusOutput) {
		for (const line of statusOutput.split("\n")) {
			if (!line) continue;
			const x = line[0];
			const y = line[1];

			if (
				x === "U" ||
				y === "U" ||
				(x === "A" && y === "A") ||
				(x === "D" && y === "D")
			) {
				conflicted++;
			} else if (x === "?") {
				untracked++;
			} else {
				if (x !== " " && x !== "?") staged++;
				if (y !== " " && y !== "?") modified++;
			}
		}
	}

	// Stash count
	const stashOutput = await runGit(projectPath, ["stash", "list"]);
	const stashes = stashOutput ? stashOutput.split("\n").length : 0;

	// Last commit
	const lastCommit = await runGit(projectPath, ["log", "-1", "--format=%s"]);
	const lastCommitTime = await runGit(projectPath, [
		"log",
		"-1",
		"--format=%cr",
	]);

	// Remote URL
	const remoteUrl = await runGit(projectPath, [
		"config",
		"--get",
		"remote.origin.url",
	]);

	return {
		isRepo: true,
		branch,
		ahead,
		behind,
		modified,
		staged,
		untracked,
		conflicted,
		stashes,
		lastCommit,
		lastCommitTime,
		remoteUrl,
	};
}

export function setupGitIPC() {
	ipcMain.handle("git:status", async (_event, projectPath: string) => {
		return getGitStatus(projectPath);
	});

	ipcMain.handle("app:get-version", () => {
		return app.getVersion();
	});
}
