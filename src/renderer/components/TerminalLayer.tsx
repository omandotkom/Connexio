import { useProjectStore } from "../stores/projectStore";
import Terminal from "./Terminal";

/**
 * Renders ALL terminal instances from ALL projects.
 * Terminals are always mounted (never unmounted when switching projects)
 * to prevent losing terminal state and running processes.
 *
 * Visibility is controlled via CSS display:none which keeps the xterm.js
 * instance alive but prevents it from consuming layout/paint resources.
 *
 * Performance is handled elsewhere:
 * - Write batcher in Terminal.tsx reduces render overhead
 * - Resize debounce prevents rapid reflows
 * - CommandTimer is throttled
 * - Git polling is reduced
 */
export default function TerminalLayer() {
	const { workspaceTabs, activeTabIds, activeProjectId } = useProjectStore();

	// Collect all terminals across all projects
	const allTerminals: Array<{
		projectId: string;
		tabId: string;
		terminalId: string;
	}> = [];

	for (const [projectId, tabs] of Object.entries(workspaceTabs)) {
		for (const tab of tabs) {
			if (tab.terminalId) {
				allTerminals.push({
					projectId,
					tabId: tab.id,
					terminalId: tab.terminalId,
				});
			}
		}
	}

	return (
		<>
			{allTerminals.map(({ projectId, tabId, terminalId }) => {
				const isProjectActive = projectId === activeProjectId;
				const isTabActive = activeTabIds[projectId] === tabId;
				const isVisible = isProjectActive && isTabActive;

				return (
					<div
						key={terminalId}
						className={`absolute inset-0 ${isVisible ? "block" : "hidden"}`}
					>
						<Terminal terminalId={terminalId} isVisible={isVisible} />
					</div>
				);
			})}
		</>
	);
}
