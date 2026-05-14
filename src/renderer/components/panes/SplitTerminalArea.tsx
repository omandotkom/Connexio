import { Columns2, Rows2, X } from "lucide-react";
import { useProjectStore } from "../../stores/projectStore";
import { usePaneStore } from "../../stores/paneStore";
import SplitPane from "./SplitPane";

interface Props {
	projectId: string;
	terminalId: string;
	tabId: string;
}

/**
 * Wraps a terminal tab with split pane capability.
 * When not split, renders nothing (terminal rendered by TerminalLayer).
 * When split, renders the pane tree with multiple terminals.
 */
export default function SplitTerminalArea({ projectId, terminalId, tabId }: Props) {
	const {
		paneTrees,
		activePaneIds,
		splitPane,
		closePane,
		setActivePane,
		getActivePaneTerminalId,
		initPane,
	} = usePaneStore();

	const tree = paneTrees[`${projectId}:${tabId}`];
	const activePaneId = activePaneIds[`${projectId}:${tabId}`] || null;
	const key = `${projectId}:${tabId}`;

	// If no split exists, just show split buttons overlay
	if (!tree) {
		return (
			<div className="absolute top-1 right-1 z-50 flex items-center gap-0.5">
				<button
					onClick={() => handleSplit("horizontal")}
					className="p-1 rounded bg-connexio-bg-secondary border border-connexio-border hover:bg-connexio-accent/20 hover:border-connexio-accent/40 transition-colors"
					title="Split Right"
					type="button"
				>
					<Columns2 size={12} className="text-connexio-text-secondary" />
				</button>
				<button
					onClick={() => handleSplit("vertical")}
					className="p-1 rounded bg-connexio-bg-secondary border border-connexio-border hover:bg-connexio-accent/20 hover:border-connexio-accent/40 transition-colors"
					title="Split Down"
					type="button"
				>
					<Rows2 size={12} className="text-connexio-text-secondary" />
				</button>
			</div>
		);
	}

	// Split exists — render pane tree (this takes over the full area)
	const canClose = tree.type === "split";

	async function handleSplit(direction: "horizontal" | "vertical") {
		const { projects } = useProjectStore.getState();
		const project = projects.find((p) => p.id === projectId);
		if (!project) return;

		try {
			const newTabId = crypto.randomUUID();
			const newTerminalId = await window.connexio.terminal.create(
				project.path,
				undefined,
				{
					projectId,
					projectName: project.name,
					tabId: newTabId,
					tabLabel: "Split",
				},
			);

			if (!paneTrees[key]) {
				// First split — init tree with current terminal, then split
				initPane(key, terminalId, tabId);
				// Need to wait for state update
				setTimeout(() => {
					const { paneTrees: trees, activePaneIds: ids } = usePaneStore.getState();
					const currentTree = trees[key];
					if (currentTree) {
						splitPane(key, currentTree.id, direction, newTerminalId, newTabId);
					}
				}, 0);
			} else {
				const targetPaneId = activePaneId || tree.id;
				splitPane(key, targetPaneId, direction, newTerminalId, newTabId);
			}
		} catch (e) {
			console.error("[Connexio] Failed to split terminal:", e);
		}
	}

	function handleClosePane() {
		if (!activePaneId) return;
		const tid = getActivePaneTerminalId(key);
		closePane(key, activePaneId);
		if (tid) {
			window.connexio.terminal.close(tid);
		}
	}

	return (
		<div className="absolute inset-0 z-10 flex flex-col">
			{/* Split controls */}
			<div className="absolute top-1 right-1 z-50 flex items-center gap-0.5">
				<button
					onClick={() => handleSplit("horizontal")}
					className="p-1 rounded bg-connexio-bg-secondary border border-connexio-border hover:bg-connexio-accent/20 hover:border-connexio-accent/40 transition-colors"
					title="Split Right"
					type="button"
				>
					<Columns2 size={12} className="text-connexio-text-secondary" />
				</button>
				<button
					onClick={() => handleSplit("vertical")}
					className="p-1 rounded bg-connexio-bg-secondary border border-connexio-border hover:bg-connexio-accent/20 hover:border-connexio-accent/40 transition-colors"
					title="Split Down"
					type="button"
				>
					<Rows2 size={12} className="text-connexio-text-secondary" />
				</button>
				{canClose && (
					<button
						onClick={handleClosePane}
						className="p-1 rounded bg-connexio-bg-secondary border border-connexio-border hover:bg-red-500/20 hover:border-red-500/40 transition-colors"
						title="Close Pane"
						type="button"
					>
						<X size={12} className="text-connexio-text-secondary" />
					</button>
				)}
			</div>

			{/* Pane tree */}
			<div className="flex-1">
				<SplitPane
					node={tree}
					activePaneId={activePaneId}
					onPaneSelect={(id) => setActivePane(key, id)}
				/>
			</div>
		</div>
	);
}
