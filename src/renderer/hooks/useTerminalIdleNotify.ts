import { useEffect, useRef } from "react";
import { useNotificationStore } from "../stores/notificationStore";
import { useProjectStore } from "../stores/projectStore";

/**
 * Hook that monitors terminal data activity and sends a notification
 * when a terminal goes idle (no output for X seconds).
 *
 * Only active when idleNotify is enabled in notification settings.
 * Skips notification if user is focused on the idle terminal.
 */
export function useTerminalIdleNotify() {
	const { settings, handleIncoming } = useNotificationStore();
	const projectStore = useProjectStore();

	// Use refs for values that change frequently to avoid re-subscribing
	const storeRef = useRef(projectStore);
	storeRef.current = projectStore;
	const handleIncomingRef = useRef(handleIncoming);
	handleIncomingRef.current = handleIncoming;
	const settingsRef = useRef(settings);
	settingsRef.current = settings;

	// Track idle timers per terminal
	const idleTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
		new Map(),
	);
	// Track which terminals received data (to avoid notifying on terminals that never had output)
	const wasActiveRef = useRef<Set<string>>(new Set());

	const idleNotify = settings?.idleNotify ?? false;
	const idleThreshold = settings?.idleThreshold ?? 5;

	useEffect(() => {
		if (!idleNotify) return;

		const threshold = idleThreshold * 1000;

		const unsubscribe = window.connexio.terminal.onData(
			(terminalId: string, _data: string) => {
				wasActiveRef.current.add(terminalId);

				// Reset idle timer for this terminal
				const existingTimer = idleTimersRef.current.get(terminalId);
				if (existingTimer) {
					clearTimeout(existingTimer);
				}

				const timer = setTimeout(() => {
					idleTimersRef.current.delete(terminalId);

					// Only notify if terminal was active
					if (!wasActiveRef.current.has(terminalId)) return;
					wasActiveRef.current.delete(terminalId);

					const currentSettings = settingsRef.current;
					if (!currentSettings?.idleNotify) return;

					// Don't notify if user is focused on this specific terminal
					if (document.hasFocus()) {
						const { activeProjectId, activeTabIds, workspaceTabs } =
							storeRef.current;
						if (activeProjectId) {
							const activeTabId = activeTabIds[activeProjectId];
							const tabs = workspaceTabs[activeProjectId] || [];
							const activeTab = tabs.find((t) => t.id === activeTabId);
							if (activeTab?.terminalId === terminalId) {
								return;
							}
						}
					}

					// Find tab label
					let tabLabel = "Terminal";
					const { workspaceTabs } = storeRef.current;
					for (const tabs of Object.values(workspaceTabs)) {
						const tab = tabs.find((t) => t.terminalId === terminalId);
						if (tab) {
							tabLabel = tab.label;
							break;
						}
					}

					handleIncomingRef.current({
						id: crypto.randomUUID(),
						source: "command",
						title: "Terminal Idle",
						body: `"${tabLabel}" has finished — no output for ${currentSettings.idleThreshold}s`,
						timestamp: Date.now(),
						isRead: false,
					});
				}, threshold);

				idleTimersRef.current.set(terminalId, timer);
			},
		);

		return () => {
			unsubscribe();
			for (const timer of idleTimersRef.current.values()) {
				clearTimeout(timer);
			}
			idleTimersRef.current.clear();
			wasActiveRef.current.clear();
		};
	}, [idleNotify, idleThreshold]);
}
