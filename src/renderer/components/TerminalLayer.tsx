import { useProjectStore } from "../stores/projectStore";
import { usePaneStore } from "../stores/paneStore";
import Terminal from "./Terminal";
import { SplitTerminalArea } from "./panes";

/**
 * Renders ALL terminal instances from ALL projects.
 * Terminals are always mounted (never unmounted when switching projects)
 * to prevent losing terminal state and running processes.
 *
 * Visibility is controlled via CSS display:none which keeps the xterm.js
 * instance alive but prevents it from consuming layout/paint resources.
 *
 * Split pane overlay is shown on the active tab when splits exist.
 */
export default function TerminalLayer() {
	const { workspaceTabs, activeTabIds, activeProjectId } = useProjectStore();
	const { paneTrees } = usePaneStore();

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
				const splitKey = `${projectId}:${tabId}`;
				const hasSplit = !!paneTrees[splitKey];

				return (
					<div
						key={terminalId}
						className={`absolute inset-0 ${isVisible ? "block" : "hidden"}`}
					>
						{/* Base terminal (hidden when split is active) */}
						<div className={hasSplit ? "hidden" : "w-full h-full"}>
							<Terminal terminalId={terminalId} isVisible={isVisible && !hasSplit} />
						</div>

						{/* Split pane overlay + controls */}
						{isVisible && (
							<SplitTerminalArea
								projectId={projectId}
								terminalId={terminalId}
								tabId={tabId}
							/>
						)}
					</div>
				);
			})}
		</>
	);
}
