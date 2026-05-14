import {
	Columns2,
	Rows2,
	X,
} from "lucide-react";
import { useEffect } from "react";
import { useProjectStore } from "../../stores/projectStore";
import { usePaneStore } from "../../stores/paneStore";
import SplitPane from "./SplitPane";

/**
 * Renders the split pane terminal area for the active project.
 * Falls back to single terminal if no split is configured.
 */
export default function SplitTerminalArea() {
	const { activeProjectId, workspaceTabs, activeTabIds } = useProjectStore();
	const {
		paneTrees,
		activePaneIds,
		initPane,
		splitPane,
		closePane,
		setActivePane,
		getActivePaneTerminalId,
	} = usePaneStore();

	// Initialize pane tree when active tab changes
	useEffect(() => {
		if (!activeProjectId) return;
		const tabs = workspaceTabs[activeProjectId] || [];
		const activeTabId = activeTabIds[activeProjectId];
		const activeTab = tabs.find((t) => t.id === activeTabId);

		if (activeTab?.terminalId && !paneTrees[activeProjectId]) {
			initPane(activeProjectId, activeTab.terminalId, activeTab.id);
		}
	}, [activeProjectId, workspaceTabs, activeTabIds]);

	if (!activeProjectId) return null;

	const tree = paneTrees[activeProjectId];
	const activePaneId = activePaneIds[activeProjectId] || null;

	// If no pane tree yet, show nothing (will init on next render)
	if (!tree) return null;

	const handleSplit = async (direction: "horizontal" | "vertical") => {
		if (!activeProjectId || !activePaneId) return;

		// Create a new terminal for the split
		const { projects } = useProjectStore.getState();
		const project = projects.find((p) => p.id === activeProjectId);
		if (!project) return;

		try {
			const tabId = crypto.randomUUID();
			const terminalId = await window.connexio.terminal.create(
				project.path,
				undefined,
				{
					projectId: activeProjectId,
					projectName: project.name,
					tabId,
					tabLabel: `Split`,
				},
			);
			splitPane(activeProjectId, activePaneId, direction, terminalId, tabId);
		} catch (e) {
			console.error("[Connexio] Failed to create split terminal:", e);
		}
	};

	const handleClosePane = () => {
		if (!activeProjectId || !activePaneId) return;
		// Get terminal ID before closing to kill it
		const terminalId = getActivePaneTerminalId(activeProjectId);
		closePane(activeProjectId, activePaneId);
		if (terminalId) {
			window.connexio.terminal.close(terminalId);
		}
	};

	// Check if we can close (more than one pane)
	const canClose = tree.type === "split";

	return (
		<div className="relative w-full h-full flex flex-col">
			{/* Split controls */}
			<div className="absolute top-1 right-1 z-20 flex items-center gap-0.5 opacity-0 hover:opacity-100 transition-opacity">
				<button
					onClick={() => handleSplit("horizontal")}
					className="p-1 rounded bg-connexio-bg-secondary/80 border border-connexio-border hover:bg-connexio-bg-tertiary transition-colors"
					title="Split Right"
					type="button"
				>
					<Columns2 size={12} className="text-connexio-text-muted" />
				</button>
				<button
					onClick={() => handleSplit("vertical")}
					className="p-1 rounded bg-connexio-bg-secondary/80 border border-connexio-border hover:bg-connexio-bg-tertiary transition-colors"
					title="Split Down"
					type="button"
				>
					<Rows2 size={12} className="text-connexio-text-muted" />
				</button>
				{canClose && (
					<button
						onClick={handleClosePane}
						className="p-1 rounded bg-connexio-bg-secondary/80 border border-connexio-border hover:bg-red-500/20 transition-colors"
						title="Close Pane"
						type="button"
					>
						<X size={12} className="text-connexio-text-muted" />
					</button>
				)}
			</div>

			{/* Pane tree */}
			<div className="flex-1 overflow-hidden">
				<SplitPane
					node={tree}
					activeProjectId={activeProjectId}
					activePaneId={activePaneId}
					onPaneSelect={(id) => setActivePane(activeProjectId, id)}
				/>
			</div>
		</div>
	);
}
