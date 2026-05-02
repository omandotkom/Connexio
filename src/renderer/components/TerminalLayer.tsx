import { useProjectStore } from "../stores/projectStore";
import Terminal from "./Terminal";

/**
 * Renders ALL terminal instances from ALL projects.
 * Terminals are always mounted (never unmounted when switching tabs/projects)
 * to prevent killing running processes like opencode, vim, etc.
 * Visibility is controlled via CSS display.
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
						<Terminal terminalId={terminalId} />
					</div>
				);
			})}
		</>
	);
}
