import { app, BrowserWindow, dialog, ipcMain } from "electron";
import path from "path";
import { setupGitIPC } from "./git";
import { setupProjectIPC } from "./project";
import { setupSessionIPC } from "./session";
import { setupSettingsIPC } from "./settings";
import { setupSSHIPC } from "./ssh";
import { setupTasksIPC } from "./tasks";
import { killAllTerminals, setupTerminalIPC } from "./terminal";
import { setupThemeIPC } from "./theme";
import { setupUpdaterIPC, startUpdateChecker } from "./updater";
import { setupWorkspaceIPC } from "./workspace";

// Fix GPU cache lock errors on Windows by disabling GPU disk cache
app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");
// Prevent GPU cache "Access is denied" errors when multiple instances or stale locks exist
app.commandLine.appendSwitch("gpu-disk-cache-size-kb", "0");

// Performance: reduce memory usage
app.commandLine.appendSwitch("js-flags", "--max-old-space-size=256");
// Disable features we don't need
app.commandLine.appendSwitch(
	"disable-features",
	"SpareRendererForSitePerProcess",
);

// Fix node-pty conpty_console_list_agent.js fork on Windows/Electron:
// When node-pty kills a terminal, it forks an agent via child_process.fork().
// In Electron, fork() uses the Electron binary which can't AttachConsole.
// Solution: Kill all terminals BEFORE app quits so the fork never happens.
// The `before-quit` handler at the bottom calls killAllTerminals().

// Enforce single instance — prevent GPU cache conflicts and duplicate terminals
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
	app.quit();
}

let mainWindow: BrowserWindow | null = null;

function createWindow() {
	// Resolve icon path — works in both dev and production
	const iconPath = path.join(
		app.isPackaged ? process.resourcesPath : path.join(__dirname, "..", ".."),
		"assets",
		process.platform === "win32" ? "icon.ico" : "icon.png",
	);

	mainWindow = new BrowserWindow({
		width: 1200,
		height: 800,
		minWidth: 800,
		minHeight: 600,
		frame: false,
		titleBarStyle: "hidden",
		icon: iconPath,
		webPreferences: {
			preload: path.join(__dirname, "preload.js"),
			nodeIntegration: false,
			contextIsolation: true,
		},
		backgroundColor: "#0f1117",
		show: false,
	});

	const rendererPath = path.join(
		__dirname,
		"..",
		"..",
		"renderer",
		"index.html",
	);

	if (app.isPackaged) {
		// Production: always load from built files
		mainWindow.loadFile(rendererPath);
	} else {
		// Development: try Vite dev server, fallback to built files
		const devServerUrl = "http://localhost:5173";

		mainWindow
			.loadURL(devServerUrl)
			.then(() => {
				// Dev server available — open DevTools
				mainWindow?.webContents.openDevTools({ mode: "detach" });
			})
			.catch(() => {
				// Dev server not running — fallback to built renderer
				console.log("Vite dev server not available, loading built renderer...");
				mainWindow?.loadFile(rendererPath);
			});
	}

	mainWindow.once("ready-to-show", () => {
		mainWindow?.show();
	});

	mainWindow.on("closed", () => {
		mainWindow = null;
	});
}

function setupAppIPC() {
	ipcMain.handle("app:minimize", () => mainWindow?.minimize());
	ipcMain.handle("app:maximize", () => {
		if (mainWindow?.isMaximized()) {
			mainWindow.unmaximize();
		} else {
			mainWindow?.maximize();
		}
	});
	ipcMain.handle("app:close", () => mainWindow?.close());
	ipcMain.handle("app:is-maximized", () => mainWindow?.isMaximized());

	ipcMain.handle("project:select-dir", async () => {
		if (!mainWindow) return null;
		const result = await dialog.showOpenDialog(mainWindow, {
			properties: ["openDirectory"],
		});
		if (result.canceled) return null;
		return result.filePaths[0];
	});
}

app.on("second-instance", () => {
	// Someone tried to open a second instance — focus existing window
	if (mainWindow) {
		if (mainWindow.isMinimized()) mainWindow.restore();
		mainWindow.focus();
	}
});

app.whenReady().then(() => {
	// Register all IPC handlers once before creating window
	setupAppIPC();
	setupTerminalIPC();
	setupProjectIPC();
	setupSessionIPC();
	setupThemeIPC();
	setupSettingsIPC();
	setupWorkspaceIPC();
	setupGitIPC();
	setupTasksIPC();
	setupSSHIPC();
	setupUpdaterIPC();

	createWindow();

	// Start auto-update checker (only in production)
	if (app.isPackaged) {
		startUpdateChecker();
	}

	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow();
		}
	});
});

// Kill all terminals BEFORE quit to avoid node-pty fork issue
app.on("before-quit", () => {
	killAllTerminals();
});

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit();
	}
});
