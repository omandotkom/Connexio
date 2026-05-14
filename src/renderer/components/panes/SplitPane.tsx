import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useProjectStore } from "../../stores/projectStore";
import Terminal from "../Terminal";

export type PaneDirection = "horizontal" | "vertical";

export interface PaneNode {
	id: string;
	type: "terminal" | "split";
	// For terminal panes
	terminalId?: string;
	tabId?: string;
	// For split panes
	direction?: PaneDirection;
	children?: PaneNode[];
}

interface SplitPaneProps {
	node: PaneNode;
	activeProjectId: string;
	activePaneId: string | null;
	onPaneSelect: (paneId: string) => void;
}

export default function SplitPane({
	node,
	activeProjectId,
	activePaneId,
	onPaneSelect,
}: SplitPaneProps) {
	if (node.type === "terminal") {
		const isActive = activePaneId === node.id;
		return (
			<div
				className={`relative w-full h-full ${isActive ? "ring-1 ring-connexio-accent/40" : ""}`}
				onClick={() => onPaneSelect(node.id)}
				onKeyDown={() => {}}
			>
				{node.terminalId && (
					<Terminal terminalId={node.terminalId} isVisible={true} />
				)}
			</div>
		);
	}

	if (node.type === "split" && node.children && node.children.length > 0) {
		const direction = node.direction === "vertical" ? "vertical" : "horizontal";

		return (
			<PanelGroup direction={direction} className="w-full h-full">
				{node.children.map((child, index) => (
					<>
						{index > 0 && (
							<PanelResizeHandle
								key={`handle-${child.id}`}
								className={`${
									direction === "horizontal"
										? "w-[3px] hover:bg-connexio-accent/40 active:bg-connexio-accent/60"
										: "h-[3px] hover:bg-connexio-accent/40 active:bg-connexio-accent/60"
								} bg-connexio-border transition-colors`}
							/>
						)}
						<Panel key={child.id} minSize={15}>
							<SplitPane
								node={child}
								activeProjectId={activeProjectId}
								activePaneId={activePaneId}
								onPaneSelect={onPaneSelect}
							/>
						</Panel>
					</>
				))}
			</PanelGroup>
		);
	}

	return null;
}
