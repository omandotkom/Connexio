import { ipcMain } from "electron";
import Store from "electron-store";
import type { WorkspaceState } from "../shared/types";

const store = new Store({ name: "workspace" });

const DEFAULT_STATE: WorkspaceState = {
	activeProjectId: null,
	projectTabs: {},
	activeTabIds: {},
};

function getWorkspaceState(): WorkspaceState {
	return store.get("workspace", DEFAULT_STATE) as WorkspaceState;
}

function saveWorkspaceState(state: WorkspaceState) {
	store.set("workspace", state);
}

export function setupWorkspaceIPC() {
	ipcMain.handle("workspace:get-state", () => {
		return getWorkspaceState();
	});

	ipcMain.handle("workspace:save-state", (_event, state: WorkspaceState) => {
		saveWorkspaceState(state);
		return true;
	});
}
