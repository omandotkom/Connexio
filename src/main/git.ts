import { execFile } from "child_process";
import { app, ipcMain, shell } from "electron";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import type {
	GitActionResult,
	GitChangedFile,
	GitCommitEntry,
	GitDiffHunk,
	GitDiffLine,
	GitDiffResult,
	GitFileStatus,
	GitStatus,
} from "../shared/types";

const execFileAsync = promisify(execFile);

// ============================================
// Concurrency control — prevent subprocess stampede
// ============================================

/** Global cap on concurrent git subprocesses. Windows spawn is expensive. */
const MAX_CONCURRENT_GIT = 2;
let activeGitCount = 0;
const gitQueue: Array<() => void> = [];

function acquireGitSlot(timeoutMs = 5000): Promise<boolean> {
	if (activeGitCount < MAX_CONCURRENT_GIT) {
		activeGitCount++;
		return Promise.resolve(true);
	}
	return new Promise((resolve) => {
		let settled = false;
		let timer: ReturnType<typeof setTimeout> | null = null;
		const grant = () => {
			if (settled) return;
			settled = true;
			if (timer) clearTimeout(timer);
			activeGitCount++;
			resolve(true);
		};

		timer = setTimeout(() => {
			if (settled) return;
			settled = true;
			const index = gitQueue.indexOf(grant);
			if (index >= 0) gitQueue.splice(index, 1);
			resolve(false);
		}, timeoutMs);

		gitQueue.push(grant);
	});
}

function releaseGitSlot() {
	activeGitCount = Math.max(0, activeGitCount - 1);
	const next = gitQueue.shift();
	if (next) next();
}

async function runGit(
	cwd: string,
	args: string[],
	opts?: { timeout?: number; maxBuffer?: number; queueTimeout?: number },
): Promise<string> {
	const acquired = await acquireGitSlot(opts?.queueTimeout);
	if (!acquired) return "";
	try {
		const { stdout } = await execFileAsync("git", args, {
			cwd,
			timeout: opts?.timeout ?? 15000, // 15s default (up from 5s)
			maxBuffer: opts?.maxBuffer ?? 10 * 1024 * 1024, // 10MB default
			windowsHide: true,
		});
		return stdout.trim();
	} catch {
		return "";
	} finally {
		releaseGitSlot();
	}
}

// Shared porcelain status parser output
interface ParsedStatus {
	files: GitChangedFile[];
	modified: number;
	staged: number;
	untracked: number;
	conflicted: number;
}

/** Ephemeral cross-call cache so getChangedFiles can reuse getGitStatus's status output */
const stashRawStatusCache = new Map<
	string,
	{ timestamp: number; parsed: ParsedStatus }
>();
const RAW_STATUS_SHARE_TTL = 2000;

function parseStatusPorcelain(output: string): ParsedStatus {
	const files: GitChangedFile[] = [];
	let modified = 0;
	let staged = 0;
	let untracked = 0;
	let conflicted = 0;

	if (!output) return { files, modified, staged, untracked, conflicted };

	for (const line of output.split("\n")) {
		if (!line || line.length < 4) continue;

		const x = line[0] as GitFileStatus | " ";
		const y = line[1] as GitFileStatus | " ";
		const rest = line.slice(3);

		// Counters — cast to string for comparisons against '?' since it's untracked-only
		const xs = x as string;
		const ys = y as string;
		if (
			xs === "U" ||
			ys === "U" ||
			(xs === "A" && ys === "A") ||
			(xs === "D" && ys === "D")
		) {
			conflicted++;
		} else if (xs === "?") {
			untracked++;
		} else {
			if (xs !== " " && xs !== "?") staged++;
			if (ys !== " " && ys !== "?") modified++;
		}

		if (xs === "R" || ys === "R") {
			const parts = rest.split(" -> ");
			files.push({
				path: parts[1] || parts[0],
				oldPath: parts[0],
				indexStatus: x,
				workTreeStatus: y,
			});
		} else {
			files.push({
				path: rest,
				indexStatus: x,
				workTreeStatus: y,
			});
		}
	}

	return { files, modified, staged, untracked, conflicted };
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

	// Branch check first (cheapest sanity check that repo is valid)
	const branch = await runGit(
		projectPath,
		[
			"rev-parse",
			"--abbrev-ref",
			"HEAD",
		],
		{ timeout: 3000, queueTimeout: 2000 },
	);
	if (!branch) return empty;

	const statusOutput = await runGit(
		projectPath,
		[
			"status",
			"--porcelain=v1",
			"--untracked-files=normal",
		],
		{ timeout: 5000, queueTimeout: 2000 },
	);

	// Ahead/behind and last-commit metadata are non-critical. Run them after the
	// status call so source control can render promptly while switching projects.
	const [abOutput, lastCommit, lastCommitTime] = await Promise.all([
		runGit(
			projectPath,
			[
				"rev-list",
				"--left-right",
				"--count",
				`HEAD...@{upstream}`,
			],
			{ timeout: 3000, queueTimeout: 1000 },
		),
		runGit(projectPath, ["log", "-1", "--format=%s"], {
			timeout: 3000,
			queueTimeout: 1000,
		}),
		runGit(projectPath, ["log", "-1", "--format=%cr"], {
			timeout: 3000,
			queueTimeout: 1000,
		}),
	]);

	// Ahead/behind
	let ahead = 0;
	let behind = 0;
	if (abOutput) {
		const parts = abOutput.split(/\s+/);
		ahead = parseInt(parts[0], 10) || 0;
		behind = parseInt(parts[1], 10) || 0;
	}

	// Parse status once — cache it for getChangedFiles
	const parsed = parseStatusPorcelain(statusOutput);
	stashRawStatusCache.set(projectPath, {
		timestamp: Date.now(),
		parsed,
	});

	return {
		isRepo: true,
		branch,
		ahead,
		behind,
		modified: parsed.modified,
		staged: parsed.staged,
		untracked: parsed.untracked,
		conflicted: parsed.conflicted,
		stashes: 0,
		lastCommit,
		lastCommitTime,
		remoteUrl: "",
	};
}


// ============================================
// File Type Detection
// ============================================

const MAX_DIFF_SIZE = 1024 * 1024; // 1MB
const MAX_DIFF_LINES = 5000;

function isBinaryContent(buffer: Buffer): boolean {
	// Check first 8000 bytes for null bytes (binary indicator)
	const len = Math.min(buffer.length, 8000);
	for (let i = 0; i < len; i++) {
		if (buffer[i] === 0) return true;
	}
	return false;
}

const LANGUAGE_MAP: Record<string, string> = {
	ts: "typescript",
	tsx: "typescript",
	js: "javascript",
	jsx: "javascript",
	mjs: "javascript",
	cjs: "javascript",
	py: "python",
	rb: "ruby",
	go: "go",
	rs: "rust",
	java: "java",
	kt: "kotlin",
	c: "c",
	h: "c",
	cpp: "cpp",
	hpp: "cpp",
	cs: "csharp",
	php: "php",
	swift: "swift",
	sh: "bash",
	bash: "bash",
	zsh: "bash",
	fish: "bash",
	ps1: "powershell",
	html: "xml",
	xml: "xml",
	svg: "xml",
	css: "css",
	scss: "scss",
	sass: "scss",
	less: "less",
	json: "json",
	yaml: "yaml",
	yml: "yaml",
	toml: "ini",
	ini: "ini",
	md: "markdown",
	markdown: "markdown",
	sql: "sql",
	vue: "xml",
	graphql: "graphql",
	gql: "graphql",
	dockerfile: "dockerfile",
};

function detectLanguage(filePath: string): string {
	const name = filePath.split(/[\\/]/).pop() || "";
	const lower = name.toLowerCase();

	// Special file names (no extension)
	if (lower === "dockerfile" || lower.startsWith("dockerfile."))
		return "dockerfile";
	if (lower === "makefile") return "makefile";
	if (lower === ".gitignore" || lower === ".dockerignore") return "bash";

	const ext = lower.split(".").pop() || "";
	return LANGUAGE_MAP[ext] || "plaintext";
}

const BINARY_EXTENSIONS = new Set([
	"png",
	"jpg",
	"jpeg",
	"gif",
	"ico",
	"webp",
	"bmp",
	"tiff",
	"pdf",
	"zip",
	"tar",
	"gz",
	"7z",
	"rar",
	"exe",
	"dll",
	"so",
	"dylib",
	"bin",
	"class",
	"jar",
	"war",
	"mp3",
	"mp4",
	"avi",
	"mov",
	"webm",
	"wav",
	"ogg",
	"flac",
	"woff",
	"woff2",
	"ttf",
	"otf",
	"eot",
	"db",
	"sqlite",
	"sqlite3",
	"psd",
	"ai",
	"sketch",
	"node",
]);

function hasBinaryExtension(filePath: string): boolean {
	const ext = filePath.split(".").pop()?.toLowerCase() || "";
	return BINARY_EXTENSIONS.has(ext);
}

// ============================================
// Source Control — Changed Files
// ============================================

async function getChangedFiles(projectPath: string): Promise<GitChangedFile[]> {
	// Reuse parsed status from recent getGitStatus call if still fresh
	const shared = stashRawStatusCache.get(projectPath);
	if (shared && Date.now() - shared.timestamp < RAW_STATUS_SHARE_TTL) {
		return shared.parsed.files;
	}

	const output = await runGit(
		projectPath,
		[
			"status",
			"--porcelain=v1",
			"--untracked-files=normal",
		],
		{ timeout: 5000, queueTimeout: 2000 },
	);
	const parsed = parseStatusPorcelain(output);
	stashRawStatusCache.set(projectPath, { timestamp: Date.now(), parsed });
	return parsed.files;
}

// ============================================
// Source Control — Diff
// ============================================

function parseDiff(rawDiff: string, filePath: string): GitDiffResult {
	const hunks: GitDiffHunk[] = [];

	if (!rawDiff) return { file: filePath, hunks };

	const lines = rawDiff.split("\n");
	let currentHunk: GitDiffHunk | null = null;
	let oldLineNo = 0;
	let newLineNo = 0;

	for (const line of lines) {
		// Hunk header: @@ -oldStart,oldCount +newStart,newCount @@
		if (line.startsWith("@@")) {
			const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
			if (match) {
				oldLineNo = parseInt(match[1], 10);
				newLineNo = parseInt(match[2], 10);
			}
			currentHunk = { header: line, lines: [] };
			hunks.push(currentHunk);
			continue;
		}

		if (!currentHunk) continue;

		// Skip diff metadata lines
		if (
			line.startsWith("diff ") ||
			line.startsWith("index ") ||
			line.startsWith("---") ||
			line.startsWith("+++")
		) {
			continue;
		}

		if (line.startsWith("+")) {
			const diffLine: GitDiffLine = {
				type: "add",
				content: line.slice(1),
				newLineNo: newLineNo++,
			};
			currentHunk.lines.push(diffLine);
		} else if (line.startsWith("-")) {
			const diffLine: GitDiffLine = {
				type: "remove",
				content: line.slice(1),
				oldLineNo: oldLineNo++,
			};
			currentHunk.lines.push(diffLine);
		} else if (line.startsWith(" ") || line === "") {
			const diffLine: GitDiffLine = {
				type: "context",
				content: line.slice(1),
				oldLineNo: oldLineNo++,
				newLineNo: newLineNo++,
			};
			currentHunk.lines.push(diffLine);
		}
	}

	return { file: filePath, hunks };
}

async function getDiff(
	projectPath: string,
	filePath: string,
	staged: boolean,
): Promise<GitDiffResult> {
	const language = detectLanguage(filePath);

	// Quick reject: binary extension
	if (hasBinaryExtension(filePath)) {
		return { file: filePath, hunks: [], isBinary: true, language };
	}

	const args = staged
		? ["diff", "--cached", "--", filePath]
		: ["diff", "--", filePath];

	// Use larger buffer for diff (git can emit big output)
	let output = "";
	try {
		const { stdout } = await execFileAsync("git", args, {
			cwd: projectPath,
			timeout: 10000,
			windowsHide: true,
			maxBuffer: MAX_DIFF_SIZE * 4, // 4MB buffer
		});
		output = stdout;
	} catch (err: unknown) {
		const e = err as { code?: string };
		if (e.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") {
			return {
				file: filePath,
				hunks: [],
				isTooLarge: true,
				language,
			};
		}
		return { file: filePath, hunks: [], language };
	}

	// Git may report "Binary files differ"
	if (output.includes("Binary files") && output.includes("differ")) {
		return { file: filePath, hunks: [], isBinary: true, language };
	}

	if (output.length > MAX_DIFF_SIZE) {
		return {
			file: filePath,
			hunks: [],
			isTooLarge: true,
			fileSize: output.length,
			language,
		};
	}

	const parsed = parseDiff(output, filePath);

	// Truncate very long diffs (but keep them viewable)
	let totalLines = 0;
	let truncated = false;
	const limitedHunks: GitDiffHunk[] = [];
	for (const hunk of parsed.hunks) {
		if (totalLines >= MAX_DIFF_LINES) {
			truncated = true;
			break;
		}
		const remaining = MAX_DIFF_LINES - totalLines;
		if (hunk.lines.length > remaining) {
			limitedHunks.push({
				header: hunk.header,
				lines: hunk.lines.slice(0, remaining),
			});
			truncated = true;
			break;
		}
		limitedHunks.push(hunk);
		totalLines += hunk.lines.length;
	}

	return {
		file: filePath,
		hunks: limitedHunks,
		truncated,
		language,
	};
}

async function getDiffUntracked(
	projectPath: string,
	filePath: string,
): Promise<GitDiffResult> {
	const language = detectLanguage(filePath);
	const fullPath = path.join(projectPath, filePath);

	// Quick reject: binary extension
	if (hasBinaryExtension(filePath)) {
		return { file: filePath, hunks: [], isBinary: true, language };
	}

	try {
		const stat = fs.statSync(fullPath);

		// Size check
		if (stat.size > MAX_DIFF_SIZE) {
			return {
				file: filePath,
				hunks: [],
				isTooLarge: true,
				fileSize: stat.size,
				language,
			};
		}

		// Read as buffer first to check binary
		const buffer = fs.readFileSync(fullPath);
		if (isBinaryContent(buffer)) {
			return {
				file: filePath,
				hunks: [],
				isBinary: true,
				fileSize: stat.size,
				language,
			};
		}

		const content = buffer.toString("utf-8");
		const lines = content.split("\n");

		// Line count limit
		let truncated = false;
		let displayLines = lines;
		if (lines.length > MAX_DIFF_LINES) {
			displayLines = lines.slice(0, MAX_DIFF_LINES);
			truncated = true;
		}

		const diffLines: GitDiffLine[] = displayLines.map((line, i) => ({
			type: "add" as const,
			content: line,
			newLineNo: i + 1,
		}));

		return {
			file: filePath,
			hunks: [
				{
					header: `@@ -0,0 +1,${lines.length} @@ (new file)`,
					lines: diffLines,
				},
			],
			truncated,
			fileSize: stat.size,
			language,
		};
	} catch {
		return { file: filePath, hunks: [], language };
	}
}

// ============================================
// Source Control — Stage / Unstage / Discard
// ============================================

async function stageFile(
	projectPath: string,
	filePath: string,
): Promise<boolean> {
	const result = await runGit(projectPath, ["add", "--", filePath]);
	return result !== null;
}

async function stageAll(projectPath: string): Promise<boolean> {
	const result = await runGit(projectPath, ["add", "-A"]);
	return result !== null;
}

async function unstageFile(
	projectPath: string,
	filePath: string,
): Promise<boolean> {
	const result = await runGit(projectPath, [
		"restore",
		"--staged",
		"--",
		filePath,
	]);
	return result !== null;
}

async function unstageAll(projectPath: string): Promise<boolean> {
	const result = await runGit(projectPath, ["reset", "HEAD"]);
	return result !== null;
}

async function discardFile(
	projectPath: string,
	filePath: string,
): Promise<boolean> {
	// Check if file is untracked
	const statusOutput = await runGit(projectPath, [
		"status",
		"--porcelain",
		"--",
		filePath,
	]);
	if (statusOutput && statusOutput.startsWith("?")) {
		// Untracked file — delete it
		const fullPath = path.join(projectPath, filePath);
		try {
			fs.unlinkSync(fullPath);
			return true;
		} catch {
			return false;
		}
	}
	// Tracked file — restore
	const result = await runGit(projectPath, ["checkout", "--", filePath]);
	return result !== null;
}

// ============================================
// IPC-level cache (prevents redundant git subprocess spawns)
// ============================================

const STATUS_CACHE_TTL_MS = 3000;
const CHANGED_FILES_CACHE_TTL_MS = 3000;

interface CacheEntry<T> {
	value: T;
	timestamp: number;
}

const statusCache = new Map<string, CacheEntry<GitStatus>>();
const changedFilesCache = new Map<string, CacheEntry<GitChangedFile[]>>();
const statusInflight = new Map<string, Promise<GitStatus>>();
const changedFilesInflight = new Map<string, Promise<GitChangedFile[]>>();

function invalidateStatusCaches(projectPath: string) {
	statusCache.delete(projectPath);
	changedFilesCache.delete(projectPath);
	stashRawStatusCache.delete(projectPath);
}

/** Bound cache size — evict oldest entries if over cap */
const MAX_CACHE_PROJECTS = 8;
function enforceCacheCap<T>(cache: Map<string, CacheEntry<T>>) {
	if (cache.size <= MAX_CACHE_PROJECTS) return;
	let oldestKey: string | null = null;
	let oldestTime = Infinity;
	for (const [k, v] of cache) {
		if (v.timestamp < oldestTime) {
			oldestTime = v.timestamp;
			oldestKey = k;
		}
	}
	if (oldestKey) cache.delete(oldestKey);
}

async function getCachedStatus(projectPath: string): Promise<GitStatus> {
	const cached = statusCache.get(projectPath);
	if (cached && Date.now() - cached.timestamp < STATUS_CACHE_TTL_MS) {
		return cached.value;
	}
	let inflight = statusInflight.get(projectPath);
	if (!inflight) {
		inflight = getGitStatus(projectPath)
			.then((value) => {
				statusCache.set(projectPath, { value, timestamp: Date.now() });
				enforceCacheCap(statusCache);
				statusInflight.delete(projectPath);
				return value;
			})
			.catch((err) => {
				statusInflight.delete(projectPath);
				throw err;
			});
		statusInflight.set(projectPath, inflight);
	}
	return inflight;
}

async function getCachedChangedFiles(
	projectPath: string,
): Promise<GitChangedFile[]> {
	const cached = changedFilesCache.get(projectPath);
	if (cached && Date.now() - cached.timestamp < CHANGED_FILES_CACHE_TTL_MS) {
		return cached.value;
	}
	let inflight = changedFilesInflight.get(projectPath);
	if (!inflight) {
		inflight = getChangedFiles(projectPath)
			.then((value) => {
				changedFilesCache.set(projectPath, {
					value,
					timestamp: Date.now(),
				});
				enforceCacheCap(changedFilesCache);
				changedFilesInflight.delete(projectPath);
				return value;
			})
			.catch((err) => {
				changedFilesInflight.delete(projectPath);
				throw err;
			});
		changedFilesInflight.set(projectPath, inflight);
	}
	return inflight;
}

// ============================================
// Commit, Push, History
// ============================================

async function gitCommit(
	projectPath: string,
	message: string,
): Promise<GitActionResult> {
	if (!message.trim()) {
		return { success: false, message: "Commit message cannot be empty" };
	}
	try {
		const { stdout, stderr } = await execFileAsync(
			"git",
			["commit", "-m", message],
			{
				cwd: projectPath,
				timeout: 30000,
				windowsHide: true,
				maxBuffer: 5 * 1024 * 1024,
			},
		);
		return {
			success: true,
			message: "Committed successfully",
			output: stdout || stderr,
		};
	} catch (err: unknown) {
		const e = err as { stderr?: string; message?: string };
		const errMsg = e.stderr || e.message || "Commit failed";
		// Common error patterns
		if (errMsg.includes("nothing to commit")) {
			return { success: false, message: "Nothing to commit" };
		}
		if (errMsg.includes("Please tell me who you are")) {
			return {
				success: false,
				message: "Git user.name and user.email not configured",
			};
		}
		return { success: false, message: errMsg.split("\n")[0] || "Commit failed" };
	}
}

async function gitPush(projectPath: string): Promise<GitActionResult> {
	try {
		const { stdout, stderr } = await execFileAsync("git", ["push"], {
			cwd: projectPath,
			timeout: 60000,
			windowsHide: true,
			maxBuffer: 5 * 1024 * 1024,
		});
		return {
			success: true,
			message: "Pushed successfully",
			output: stdout || stderr,
		};
	} catch (err: unknown) {
		const e = err as { stderr?: string; message?: string };
		const errMsg = e.stderr || e.message || "Push failed";
		if (errMsg.includes("no upstream branch") || errMsg.includes("has no upstream")) {
			return {
				success: false,
				message: "No upstream branch. Use terminal to set upstream.",
			};
		}
		if (errMsg.includes("rejected")) {
			return {
				success: false,
				message: "Push rejected. Pull remote changes first.",
			};
		}
		if (errMsg.includes("Authentication") || errMsg.includes("fatal: could not read")) {
			return {
				success: false,
				message: "Authentication failed. Check credentials.",
			};
		}
		return { success: false, message: errMsg.split("\n")[0] || "Push failed" };
	}
}

async function gitFetch(projectPath: string): Promise<GitActionResult> {
	try {
		const { stdout, stderr } = await execFileAsync("git", ["fetch", "--prune"], {
			cwd: projectPath,
			timeout: 60000,
			windowsHide: true,
			maxBuffer: 5 * 1024 * 1024,
		});
		return {
			success: true,
			message: "Fetched successfully",
			output: stdout || stderr,
		};
	} catch (err: unknown) {
		const e = err as { stderr?: string; message?: string };
		const errMsg = e.stderr || e.message || "Fetch failed";
		if (errMsg.includes("Authentication") || errMsg.includes("fatal: could not read")) {
			return { success: false, message: "Authentication failed. Check credentials." };
		}
		return { success: false, message: errMsg.split("\n")[0] || "Fetch failed" };
	}
}

async function gitPull(projectPath: string): Promise<GitActionResult> {
	try {
		const { stdout, stderr } = await execFileAsync("git", ["pull"], {
			cwd: projectPath,
			timeout: 60000,
			windowsHide: true,
			maxBuffer: 5 * 1024 * 1024,
		});
		const output = stdout || stderr;
		if (output.includes("Already up to date")) {
			return { success: true, message: "Already up to date", output };
		}
		return { success: true, message: "Pulled successfully", output };
	} catch (err: unknown) {
		const e = err as { stderr?: string; message?: string };
		const errMsg = e.stderr || e.message || "Pull failed";
		if (errMsg.includes("CONFLICT") || errMsg.includes("Merge conflict")) {
			return { success: false, message: "Pull resulted in merge conflicts. Resolve them manually." };
		}
		if (errMsg.includes("uncommitted changes") || errMsg.includes("would be overwritten")) {
			return { success: false, message: "Cannot pull: you have uncommitted changes." };
		}
		if (errMsg.includes("no tracking information")) {
			return { success: false, message: "No upstream branch configured for pull." };
		}
		if (errMsg.includes("Authentication") || errMsg.includes("fatal: could not read")) {
			return { success: false, message: "Authentication failed. Check credentials." };
		}
		return { success: false, message: errMsg.split("\n")[0] || "Pull failed" };
	}
}

async function gitHistory(
	projectPath: string,
	limit = 50,
): Promise<GitCommitEntry[]> {
	const SEP = "\x1f"; // unit separator
	const format = `%h${SEP}%H${SEP}%an${SEP}%ar${SEP}%s`;
	try {
		const { stdout } = await execFileAsync(
			"git",
			["log", `--pretty=format:${format}`, `-n`, String(limit)],
			{
				cwd: projectPath,
				timeout: 10000,
				windowsHide: true,
				maxBuffer: 5 * 1024 * 1024,
			},
		);
		if (!stdout.trim()) return [];
		return stdout
			.trim()
			.split("\n")
			.map((line) => {
				const [shortHash, hash, author, relativeTime, ...subjectParts] =
					line.split(SEP);
				return {
					shortHash: shortHash || "",
					hash: hash || "",
					author: author || "",
					relativeTime: relativeTime || "",
					subject: subjectParts.join(SEP) || "",
				};
			})
			.filter((e) => e.shortHash);
	} catch {
		return [];
	}
}

// ============================================
// Branch operations
// ============================================

interface GitBranchEntry {
	name: string;
	current: boolean;
	remote: boolean;
}

async function gitBranches(projectPath: string): Promise<GitBranchEntry[]> {
	try {
		const { stdout } = await execFileAsync(
			"git",
			["branch", "-a", "--no-color"],
			{
				cwd: projectPath,
				timeout: 5000,
				windowsHide: true,
				maxBuffer: 2 * 1024 * 1024,
			},
		);
		if (!stdout.trim()) return [];

		const branches: GitBranchEntry[] = [];
		const seen = new Set<string>();

		for (const line of stdout.split("\n")) {
			const trimmed = line.trim();
			if (!trimmed) continue;

			const current = trimmed.startsWith("* ");
			let name = current ? trimmed.slice(2) : trimmed;

			// Skip detached HEAD indicator
			if (name.startsWith("(HEAD detached")) continue;

			const remote = name.startsWith("remotes/");
			if (remote) {
				name = name.replace(/^remotes\//, "");
				// Skip HEAD pointer
				if (name.includes("/HEAD")) continue;
			}

			if (seen.has(name)) continue;
			seen.add(name);

			branches.push({ name, current, remote });
		}

		return branches;
	} catch {
		return [];
	}
}

async function gitCheckout(
	projectPath: string,
	branch: string,
): Promise<GitActionResult> {
	try {
		const { stdout, stderr } = await execFileAsync(
			"git",
			["checkout", branch],
			{
				cwd: projectPath,
				timeout: 15000,
				windowsHide: true,
				maxBuffer: 5 * 1024 * 1024,
			},
		);
		return {
			success: true,
			message: `Switched to branch '${branch}'`,
			output: stdout || stderr,
		};
	} catch (err: unknown) {
		const e = err as { stderr?: string; message?: string };
		const errMsg = e.stderr || e.message || "Checkout failed";
		if (errMsg.includes("would be overwritten") || errMsg.includes("uncommitted changes")) {
			return {
				success: false,
				message: "Cannot switch: you have uncommitted changes. Commit or stash them first.",
			};
		}
		if (errMsg.includes("did not match any")) {
			return { success: false, message: `Branch '${branch}' not found.` };
		}
		return { success: false, message: errMsg.split("\n")[0] || "Checkout failed" };
	}
}

async function gitCreateBranch(
	projectPath: string,
	branchName: string,
): Promise<GitActionResult> {
	if (!branchName.trim()) {
		return { success: false, message: "Branch name cannot be empty" };
	}
	// Validate branch name
	if (/\s/.test(branchName) || branchName.includes("..") || branchName.startsWith("-")) {
		return { success: false, message: "Invalid branch name" };
	}
	try {
		const { stdout, stderr } = await execFileAsync(
			"git",
			["checkout", "-b", branchName.trim()],
			{
				cwd: projectPath,
				timeout: 10000,
				windowsHide: true,
				maxBuffer: 5 * 1024 * 1024,
			},
		);
		return {
			success: true,
			message: `Created and switched to '${branchName.trim()}'`,
			output: stdout || stderr,
		};
	} catch (err: unknown) {
		const e = err as { stderr?: string; message?: string };
		const errMsg = e.stderr || e.message || "Create branch failed";
		if (errMsg.includes("already exists")) {
			return { success: false, message: `Branch '${branchName}' already exists.` };
		}
		return { success: false, message: errMsg.split("\n")[0] || "Create branch failed" };
	}
}

// ============================================
// Publish Branch (push -u)
// ============================================

async function gitPublishBranch(projectPath: string): Promise<GitActionResult> {
	// Get current branch name
	try {
		const { stdout: branchOut } = await execFileAsync(
			"git",
			["rev-parse", "--abbrev-ref", "HEAD"],
			{ cwd: projectPath, timeout: 5000, windowsHide: true },
		);
		const branch = branchOut.trim();
		if (!branch || branch === "HEAD") {
			return { success: false, message: "Cannot publish: detached HEAD state" };
		}

		const { stdout, stderr } = await execFileAsync(
			"git",
			["push", "-u", "origin", branch],
			{
				cwd: projectPath,
				timeout: 60000,
				windowsHide: true,
				maxBuffer: 5 * 1024 * 1024,
			},
		);
		return {
			success: true,
			message: `Published branch '${branch}' to origin`,
			output: stdout || stderr,
		};
	} catch (err: unknown) {
		const e = err as { stderr?: string; message?: string };
		const errMsg = e.stderr || e.message || "Publish failed";
		if (errMsg.includes("Authentication") || errMsg.includes("fatal: could not read")) {
			return { success: false, message: "Authentication failed. Check credentials." };
		}
		return { success: false, message: errMsg.split("\n")[0] || "Publish failed" };
	}
}

// ============================================
// Stash operations
// ============================================

interface GitStashEntry {
	index: number;
	message: string;
}

async function gitStashList(projectPath: string): Promise<GitStashEntry[]> {
	try {
		const { stdout } = await execFileAsync(
			"git",
			["stash", "list", "--format=%gd%x1f%s"],
			{
				cwd: projectPath,
				timeout: 5000,
				windowsHide: true,
				maxBuffer: 2 * 1024 * 1024,
			},
		);
		if (!stdout.trim()) return [];
		return stdout
			.trim()
			.split("\n")
			.map((line, i) => {
				const parts = line.split("\x1f");
				return {
					index: i,
					message: parts[1] || parts[0] || `stash@{${i}}`,
				};
			});
	} catch {
		return [];
	}
}

async function gitStashSave(
	projectPath: string,
	message?: string,
): Promise<GitActionResult> {
	try {
		const args = ["stash", "push"];
		if (message && message.trim()) {
			args.push("-m", message.trim());
		}
		const { stdout, stderr } = await execFileAsync("git", args, {
			cwd: projectPath,
			timeout: 15000,
			windowsHide: true,
			maxBuffer: 5 * 1024 * 1024,
		});
		const output = stdout || stderr;
		if (output.includes("No local changes")) {
			return { success: false, message: "No local changes to stash" };
		}
		return { success: true, message: "Changes stashed", output };
	} catch (err: unknown) {
		const e = err as { stderr?: string; message?: string };
		const errMsg = e.stderr || e.message || "Stash failed";
		if (errMsg.includes("No local changes")) {
			return { success: false, message: "No local changes to stash" };
		}
		return { success: false, message: errMsg.split("\n")[0] || "Stash failed" };
	}
}

async function gitStashPop(projectPath: string, index = 0): Promise<GitActionResult> {
	try {
		const { stdout, stderr } = await execFileAsync(
			"git",
			["stash", "pop", `stash@{${index}}`],
			{
				cwd: projectPath,
				timeout: 15000,
				windowsHide: true,
				maxBuffer: 5 * 1024 * 1024,
			},
		);
		return { success: true, message: "Stash popped", output: stdout || stderr };
	} catch (err: unknown) {
		const e = err as { stderr?: string; message?: string };
		const errMsg = e.stderr || e.message || "Stash pop failed";
		if (errMsg.includes("CONFLICT")) {
			return { success: false, message: "Stash pop resulted in conflicts. Resolve manually." };
		}
		return { success: false, message: errMsg.split("\n")[0] || "Stash pop failed" };
	}
}

async function gitStashApply(projectPath: string, index = 0): Promise<GitActionResult> {
	try {
		const { stdout, stderr } = await execFileAsync(
			"git",
			["stash", "apply", `stash@{${index}}`],
			{
				cwd: projectPath,
				timeout: 15000,
				windowsHide: true,
				maxBuffer: 5 * 1024 * 1024,
			},
		);
		return { success: true, message: "Stash applied", output: stdout || stderr };
	} catch (err: unknown) {
		const e = err as { stderr?: string; message?: string };
		const errMsg = e.stderr || e.message || "Stash apply failed";
		if (errMsg.includes("CONFLICT")) {
			return { success: false, message: "Stash apply resulted in conflicts. Resolve manually." };
		}
		return { success: false, message: errMsg.split("\n")[0] || "Stash apply failed" };
	}
}

async function gitStashDrop(projectPath: string, index = 0): Promise<GitActionResult> {
	try {
		const { stdout, stderr } = await execFileAsync(
			"git",
			["stash", "drop", `stash@{${index}}`],
			{
				cwd: projectPath,
				timeout: 5000,
				windowsHide: true,
			},
		);
		return { success: true, message: "Stash dropped", output: stdout || stderr };
	} catch (err: unknown) {
		const e = err as { stderr?: string; message?: string };
		return { success: false, message: (e.stderr || e.message || "Drop failed").split("\n")[0] };
	}
}

// ============================================
// IPC Setup
// ============================================

export function setupGitIPC() {
	ipcMain.handle("git:status", async (_event, projectPath: string) => {
		return getCachedStatus(projectPath);
	});

	ipcMain.handle("git:changed-files", async (_event, projectPath: string) => {
		return getCachedChangedFiles(projectPath);
	});

	ipcMain.handle(
		"git:diff",
		async (_event, projectPath: string, filePath: string, staged: boolean) => {
			return getDiff(projectPath, filePath, staged);
		},
	);

	ipcMain.handle(
		"git:diff-untracked",
		async (_event, projectPath: string, filePath: string) => {
			return getDiffUntracked(projectPath, filePath);
		},
	);

	ipcMain.handle(
		"git:stage",
		async (_event, projectPath: string, filePath: string) => {
			const result = await stageFile(projectPath, filePath);
			invalidateStatusCaches(projectPath);
			return result;
		},
	);

	ipcMain.handle("git:stage-all", async (_event, projectPath: string) => {
		const result = await stageAll(projectPath);
		invalidateStatusCaches(projectPath);
		return result;
	});

	ipcMain.handle(
		"git:unstage",
		async (_event, projectPath: string, filePath: string) => {
			const result = await unstageFile(projectPath, filePath);
			invalidateStatusCaches(projectPath);
			return result;
		},
	);

	ipcMain.handle("git:unstage-all", async (_event, projectPath: string) => {
		const result = await unstageAll(projectPath);
		invalidateStatusCaches(projectPath);
		return result;
	});

	ipcMain.handle(
		"git:discard",
		async (_event, projectPath: string, filePath: string) => {
			const result = await discardFile(projectPath, filePath);
			invalidateStatusCaches(projectPath);
			return result;
		},
	);

	ipcMain.handle(
		"git:open-file",
		async (_event, projectPath: string, filePath: string) => {
			const fullPath = path.join(projectPath, filePath);
			try {
				await shell.openPath(fullPath);
				return true;
			} catch {
				return false;
			}
		},
	);

	ipcMain.handle(
		"git:commit",
		async (_event, projectPath: string, message: string) => {
			const result = await gitCommit(projectPath, message);
			if (result.success) invalidateStatusCaches(projectPath);
			return result;
		},
	);

	ipcMain.handle("git:push", async (_event, projectPath: string) => {
		const result = await gitPush(projectPath);
		if (result.success) invalidateStatusCaches(projectPath);
		return result;
	});

	ipcMain.handle("git:fetch", async (_event, projectPath: string) => {
		const result = await gitFetch(projectPath);
		if (result.success) invalidateStatusCaches(projectPath);
		return result;
	});

	ipcMain.handle("git:pull", async (_event, projectPath: string) => {
		const result = await gitPull(projectPath);
		if (result.success) invalidateStatusCaches(projectPath);
		return result;
	});

	ipcMain.handle(
		"git:history",
		async (_event, projectPath: string, limit?: number) => {
			return gitHistory(projectPath, limit);
		},
	);

	ipcMain.handle("git:branches", async (_event, projectPath: string) => {
		return gitBranches(projectPath);
	});

	ipcMain.handle(
		"git:checkout",
		async (_event, projectPath: string, branch: string) => {
			const result = await gitCheckout(projectPath, branch);
			if (result.success) invalidateStatusCaches(projectPath);
			return result;
		},
	);

	ipcMain.handle(
		"git:create-branch",
		async (_event, projectPath: string, branchName: string) => {
			const result = await gitCreateBranch(projectPath, branchName);
			if (result.success) invalidateStatusCaches(projectPath);
			return result;
		},
	);

	ipcMain.handle("git:publish-branch", async (_event, projectPath: string) => {
		const result = await gitPublishBranch(projectPath);
		if (result.success) invalidateStatusCaches(projectPath);
		return result;
	});

	ipcMain.handle("git:stash-list", async (_event, projectPath: string) => {
		return gitStashList(projectPath);
	});

	ipcMain.handle(
		"git:stash-save",
		async (_event, projectPath: string, message?: string) => {
			const result = await gitStashSave(projectPath, message);
			if (result.success) invalidateStatusCaches(projectPath);
			return result;
		},
	);

	ipcMain.handle(
		"git:stash-pop",
		async (_event, projectPath: string, index?: number) => {
			const result = await gitStashPop(projectPath, index);
			if (result.success) invalidateStatusCaches(projectPath);
			return result;
		},
	);

	ipcMain.handle(
		"git:stash-apply",
		async (_event, projectPath: string, index?: number) => {
			const result = await gitStashApply(projectPath, index);
			if (result.success) invalidateStatusCaches(projectPath);
			return result;
		},
	);

	ipcMain.handle(
		"git:stash-drop",
		async (_event, projectPath: string, index?: number) => {
			const result = await gitStashDrop(projectPath, index);
			return result;
		},
	);

	ipcMain.handle("app:get-version", () => {
		return app.getVersion();
	});
}
