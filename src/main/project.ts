import { ipcMain } from "electron";
import Store from "electron-store";
import type { Project } from "../shared/types";

const store = new Store({ name: "projects" });

function getProjects(): Project[] {
	return store.get("projects", []) as Project[];
}

function saveProjects(projects: Project[]) {
	store.set("projects", projects);
}

export function setupProjectIPC() {
	ipcMain.handle("project:list", () => {
		return getProjects();
	});

	ipcMain.handle("project:add", (_event, project: Project) => {
		const projects = getProjects();
		projects.push(project);
		saveProjects(projects);
		return project;
	});

	ipcMain.handle("project:update", (_event, updated: Project) => {
		const projects = getProjects();
		const index = projects.findIndex((p) => p.id === updated.id);
		if (index !== -1) {
			projects[index] = updated;
			saveProjects(projects);
		}
		return updated;
	});

	ipcMain.handle("project:delete", (_event, id: string) => {
		const projects = getProjects();
		const filtered = projects.filter((p) => p.id !== id);
		saveProjects(filtered);
		return true;
	});
}
