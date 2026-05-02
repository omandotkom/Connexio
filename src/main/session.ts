import { ipcMain } from "electron";
import Store from "electron-store";
import type { Session } from "../shared/types";

const store = new Store({ name: "sessions" });

function getSessions(): Session[] {
	return store.get("sessions", []) as Session[];
}

function saveSessions(sessions: Session[]) {
	store.set("sessions", sessions);
}

export function setupSessionIPC() {
	ipcMain.handle("session:save", (_event, session: Session) => {
		const sessions = getSessions();
		const index = sessions.findIndex((s) => s.id === session.id);
		if (index !== -1) {
			sessions[index] = session;
		} else {
			sessions.push(session);
		}
		saveSessions(sessions);
		return session;
	});

	ipcMain.handle("session:load", (_event, id: string) => {
		const sessions = getSessions();
		return sessions.find((s) => s.id === id) || null;
	});

	ipcMain.handle("session:list", () => {
		return getSessions();
	});

	ipcMain.handle("session:delete", (_event, id: string) => {
		const sessions = getSessions();
		const filtered = sessions.filter((s) => s.id !== id);
		saveSessions(filtered);
		return true;
	});
}
