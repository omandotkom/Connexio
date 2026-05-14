import { v4 as uuid } from "uuid";
import { create } from "zustand";
import type { PaneDirection, PaneNode } from "../components/panes/SplitPane";

interface PaneStore {
	// Per-project pane trees
	paneTrees: Record<string, PaneNode>;
	// Active pane per project
	activePaneIds: Record<string, string>;

	// Actions
	initPane: (projectId: string, terminalId: string, tabId: string) => void;
	splitPane: (
		projectId: string,
		paneId: string,
		direction: PaneDirection,
		newTerminalId: string,
		newTabId: string,
	) => void;
	closePane: (projectId: string, paneId: string) => void;
	setActivePane: (projectId: string, paneId: string) => void;
	getActivePaneTerminalId: (projectId: string) => string | null;
	getPaneTree: (projectId: string) => PaneNode | null;
}

function findNode(tree: PaneNode, id: string): PaneNode | null {
	if (tree.id === id) return tree;
	if (tree.children) {
		for (const child of tree.children) {
			const found = findNode(child, id);
			if (found) return found;
		}
	}
	return null;
}

function findParent(
	tree: PaneNode,
	id: string,
): { parent: PaneNode; index: number } | null {
	if (tree.children) {
		for (let i = 0; i < tree.children.length; i++) {
			if (tree.children[i].id === id) {
				return { parent: tree, index: i };
			}
			const found = findParent(tree.children[i], id);
			if (found) return found;
		}
	}
	return null;
}

function collectTerminalIds(node: PaneNode): string[] {
	if (node.type === "terminal" && node.terminalId) {
		return [node.terminalId];
	}
	if (node.children) {
		return node.children.flatMap(collectTerminalIds);
	}
	return [];
}

function findFirstTerminalPane(node: PaneNode): PaneNode | null {
	if (node.type === "terminal") return node;
	if (node.children) {
		for (const child of node.children) {
			const found = findFirstTerminalPane(child);
			if (found) return found;
		}
	}
	return null;
}

export const usePaneStore = create<PaneStore>((set, get) => ({
	paneTrees: {},
	activePaneIds: {},

	initPane: (projectId, terminalId, tabId) => {
		const { paneTrees } = get();
		// Only init if no tree exists for this project
		if (paneTrees[projectId]) return;

		const paneId = uuid();
		set({
			paneTrees: {
				...paneTrees,
				[projectId]: {
					id: paneId,
					type: "terminal",
					terminalId,
					tabId,
				},
			},
			activePaneIds: {
				...get().activePaneIds,
				[projectId]: paneId,
			},
		});
	},

	splitPane: (projectId, paneId, direction, newTerminalId, newTabId) => {
		const { paneTrees } = get();
		const tree = paneTrees[projectId];
		if (!tree) return;

		// Deep clone
		const newTree: PaneNode = JSON.parse(JSON.stringify(tree));

		// If splitting the root and it's a terminal
		if (newTree.id === paneId && newTree.type === "terminal") {
			const originalPane: PaneNode = {
				id: uuid(),
				type: "terminal",
				terminalId: newTree.terminalId,
				tabId: newTree.tabId,
			};
			const newPane: PaneNode = {
				id: uuid(),
				type: "terminal",
				terminalId: newTerminalId,
				tabId: newTabId,
			};

			// Convert root to split
			newTree.type = "split";
			newTree.direction = direction;
			newTree.children = [originalPane, newPane];
			delete newTree.terminalId;
			delete newTree.tabId;

			set({
				paneTrees: { ...paneTrees, [projectId]: newTree },
				activePaneIds: { ...get().activePaneIds, [projectId]: newPane.id },
			});
			return;
		}

		// Find the target node in the tree
		const target = findNode(newTree, paneId);
		if (!target || target.type !== "terminal") return;

		const parentInfo = findParent(newTree, paneId);
		if (!parentInfo) return;

		const { parent, index } = parentInfo;

		const newPane: PaneNode = {
			id: uuid(),
			type: "terminal",
			terminalId: newTerminalId,
			tabId: newTabId,
		};

		// If parent split direction matches, just insert
		if (parent.direction === direction) {
			parent.children!.splice(index + 1, 0, newPane);
		} else {
			// Wrap target in a new split
			const wrapper: PaneNode = {
				id: uuid(),
				type: "split",
				direction,
				children: [{ ...target }, newPane],
			};
			parent.children![index] = wrapper;
		}

		set({
			paneTrees: { ...paneTrees, [projectId]: newTree },
			activePaneIds: { ...get().activePaneIds, [projectId]: newPane.id },
		});
	},

	closePane: (projectId, paneId) => {
		const { paneTrees } = get();
		const tree = paneTrees[projectId];
		if (!tree) return;

		// If closing the only pane, don't close
		if (tree.id === paneId && tree.type === "terminal") return;

		const newTree: PaneNode = JSON.parse(JSON.stringify(tree));
		const parentInfo = findParent(newTree, paneId);
		if (!parentInfo) return;

		const { parent, index } = parentInfo;
		parent.children!.splice(index, 1);

		// If parent has only one child left, collapse
		if (parent.children!.length === 1) {
			const remaining = parent.children![0];
			Object.assign(parent, remaining);
			delete parent.children;
		}

		// Update active pane
		const firstTerminal = findFirstTerminalPane(newTree);
		set({
			paneTrees: { ...paneTrees, [projectId]: newTree },
			activePaneIds: {
				...get().activePaneIds,
				[projectId]: firstTerminal?.id || "",
			},
		});
	},

	setActivePane: (projectId, paneId) => {
		set({
			activePaneIds: { ...get().activePaneIds, [projectId]: paneId },
		});
	},

	getActivePaneTerminalId: (projectId) => {
		const { paneTrees, activePaneIds } = get();
		const tree = paneTrees[projectId];
		if (!tree) return null;
		const activePaneId = activePaneIds[projectId];
		if (!activePaneId) return null;
		const node = findNode(tree, activePaneId);
		return node?.terminalId || null;
	},

	getPaneTree: (projectId) => {
		return get().paneTrees[projectId] || null;
	},
}));
