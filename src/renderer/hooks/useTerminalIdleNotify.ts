import { useEffect, useRef } from "react";
import { useNotificationStore } from "../stores/notificationStore";
import { useProjectStore } from "../stores/projectStore";

/**
 * Hook that monitors terminal data activity and sends a notification
 * when a watched terminal goes idle (no output for X seconds).
 *
 * "Watched" means idleNotify is enabled in settings.
 * Only fires when the Connexio window is NOT focused.
 */
export function useTerminalIdleNotify() {
	const { settings, handleIncoming } = useNotificationStore();
	const { workspaceTabs, activeTabIds, activeProjectId } = useProjectStore();

	// Track last data timestamp per terminal
	const lastDataRef = useRef<Map<string, number>>(new Map());
	const idleTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
		new Map(),
	);
	// Track which terminals have been "active" (received data since last idle)
	const wasActiveRef = useRef<Set<string>>(new Set());

	useEffect(() => {
		if (!settings?.idleNotify) return;

		const threshold = (settings.idleThreshold ?? 5) * 1000;

		const unsubscribe = window.connexio.terminal.onData(
			(terminalId: string, _data: string) => {
				lastDataRef.current.set(terminalId, Date.now());
				wasActiveRef.current.add(terminalId);

				// Reset idle timer for this terminal
				const existingTimer = idleTimersRef.current.get(terminalId);
				if (existingTimer) {
					clearTimeout(existingTimer);
				}

				const timer = setTimeout(() => {
					idleTimersRef.current.delete(terminalId);

					// Only notify if terminal was active and window is not focused
					if (!wasActiveRef.current.has(terminalId)) return;
					wasActiveRef.current.delete(terminalId);

					// Don't notify if window is focused and user is looking at this terminal
					if (document.hasFocus()) {
						// Check if this is the active terminal
						if (activeProjectId) {
							const activeTabId = activeTabIds[activeProjectId];
							const tabs = workspaceTabs[activeProjectId] || [];
							const activeTab = tabs.find((t) => t.id === activeTabId);
							if (activeTab?.terminalId === terminalId) {
								return; // User is looking at this terminal
							}
						}
					}

					// Find tab label for this terminal
					let tabLabel = "Terminal";
					for (const [_projectId, tabs] of Object.entries(workspaceTabs)) {
						const tab = tabs.find((t) => t.terminalId === terminalId);
						if (tab) {
							tabLabel = tab.label;
							break;
						}
					}

					handleIncoming({
						id: crypto.randomUUID(),
						source: "command",
						title: "Terminal Idle",
						body: `"${tabLabel}" has finished — no output for ${settings.idleThreshold}s`,
						timestamp: Date.now(),
						isRead: false,
					});
				}, threshold);

				idleTimersRef.current.set(terminalId, timer);
			},
		);

		return () => {
			unsubscribe();
			// Clear all timers
			for (const timer of idleTimersRef.current.values()) {
				clearTimeout(timer);
			}
			idleTimersRef.current.clear();
			wasActiveRef.current.clear();
		};
	}, [
		settings?.idleNotify,
		settings?.idleThreshold,
		activeProjectId,
		activeTabIds,
		workspaceTabs,
		handleIncoming,
	]);
}
