import { Group, Panel, Separator } from "react-resizable-panels";
import Terminal from "../Terminal";

export type PaneDirection = "horizontal" | "vertical";

export interface PaneNode {
	id: string;
	type: "terminal" | "split";
	// For terminal panes
	terminalId?: string;
	// For split panes
	direction?: PaneDirection;
	children?: PaneNode[];
}

interface SplitPaneProps {
	node: PaneNode;
	activePaneId: string | null;
	onPaneSelect: (paneId: string) => void;
}

export default function SplitPane({
	node,
	activePaneId,
	onPaneSelect,
}: SplitPaneProps) {
	if (node.type === "terminal") {
		const isActive = activePaneId === node.id;
		return (
			<div
				className={`relative w-full h-full ${isActive ? "ring-1 ring-inset ring-connexio-accent/40" : ""}`}
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
		const orientation = node.direction === "vertical" ? "vertical" : "horizontal";

		return (
			<Group orientation={orientation} className="w-full h-full">
				{node.children.map((child, index) => (
					<>
						{index > 0 && (
							<Separator
								key={`sep-${child.id}`}
								className={`${
									orientation === "horizontal"
										? "w-[3px] hover:bg-connexio-accent/40 active:bg-connexio-accent/60"
										: "h-[3px] hover:bg-connexio-accent/40 active:bg-connexio-accent/60"
								} bg-connexio-border transition-colors`}
							/>
						)}
						<Panel key={child.id} minSize="15%">
							<SplitPane
								node={child}
								activePaneId={activePaneId}
								onPaneSelect={onPaneSelect}
							/>
						</Panel>
					</>
				))}
			</Group>
		);
	}

	return null;
}
