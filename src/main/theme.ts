import { ipcMain } from "electron";
import Store from "electron-store";
import type { AppTheme } from "../shared/types";
import { defaultThemes } from "./themes-default";

const store = new Store({ name: "theme" });

export function setupThemeIPC() {
	ipcMain.handle("theme:get", () => {
		const themeId = store.get("activeTheme", "connexio-dark") as string;
		const themes = getThemes();
		return themes.find((t) => t.id === themeId) || themes[0];
	});

	ipcMain.handle("theme:set", (_event, themeId: string) => {
		store.set("activeTheme", themeId);
		const themes = getThemes();
		return themes.find((t) => t.id === themeId) || themes[0];
	});

	ipcMain.handle("theme:list", () => {
		return getThemes();
	});
}

function getThemes(): AppTheme[] {
	return defaultThemes;
}
