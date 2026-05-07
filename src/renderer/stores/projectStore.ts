import { v4 as uuid } from "uuid";
import { create } from "zustand";
import type {
	Project,
	WorkspaceState,
	WorkspaceTabState,
} from "../../shared/types";

export interface TerminalTab {
	id: string;
	label: string;
	shell?: string;
	terminalId: string | null;
}

interface ProjectStore {
	projects: Project[];
	activeProjectId: string | null;
	searchQuery: string;
	sidebarCollapsed: boolean;
	isRestoring: boolean;

	// Workspace: terminal tabs per project
	workspaceTabs: Record<string, TerminalTab[]>;
	activeTabIds: Record<string, string>;

	// Actions
	loadProjects: () => Promise<void>;
	addProject: (name: string, path: string, group: string) => Promise<void>;
	deleteProject: (id: string) => Promise<void>;
	setActiveProject: (id: string) => void;
	setSearchQuery: (query: string) => void;
	toggleSidebar: () => void;
	updateProjectLastOpened: (id: string) => Promise<void>;

	// Project reorder
	reorderProjects: (fromId: string, toId: string) => Promise<void>;
	moveProjectToGroup: (projectId: string, newGroup: string) => Promise<void>;

	// Workspace tab actions
	openTerminalTab: (
		projectId: string,
		label?: string,
		shell?: string,
	) => Promise<void>;
	closeTerminalTab: (projectId: string, tabId: string) => void;
	setActiveTerminalTab: (projectId: string, tabId: string) => void;
	renameTerminalTab: (
		projectId: string,
		tabId: string,
		newLabel: string,
	) => void;
	reorderTabs: (projectId: string, fromIndex: number, toIndex: number) => void;

	// Persistence
	restoreWorkspace: () => Promise<void>;
	persistWorkspace: () => void;
}

// Debounce helper for auto-save
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function debouncedSave(fn: () => void) {
	if (saveTimer) clearTimeout(saveTimer);
	saveTimer = setTimeout(fn, 500);
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
	projects: [],
	activeProjectId: null,
	searchQuery: "",
	sidebarCollapsed: false,
	isRestoring: false,
	workspaceTabs: {},
	activeTabIds: {},

	loadProjects: async () => {
		const projects = await window.connexio.project.list();
		set({ projects });
	},

	addProject: async (name: string, projectPath: string, group: string) => {
		const project: Project = {
			id: uuid(),
			name,
			path: projectPath,
			group,
			tabs: [{ id: uuid(), label: "Terminal 1" }],
			createdAt: Date.now(),
			lastOpenedAt: Date.now(),
		};
		await window.connexio.project.add(project);
		const projects = await window.connexio.project.list();
		set({ projects });
	},

	deleteProject: async (id: string) => {
		const { workspaceTabs, activeTabIds, activeProjectId, projects } = get();
		const tabs = workspaceTabs[id] || [];

		// 1. First update state to remove the project from UI
		//    This unmounts Terminal components BEFORE we kill PTY processes
		const { [id]: _removedTabs, ...restTabs } = workspaceTabs;
		const { [id]: _removedActive, ...restActiveIds } = activeTabIds;

		// If deleting active project, switch to another one
		let newActiveId: string | null = activeProjectId;
		if (activeProjectId === id) {
			const remaining = projects.filter((p) => p.id !== id);
			newActiveId = remaining.length > 0 ? remaining[0].id : null;
		}

		set({
			workspaceTabs: restTabs,
			activeTabIds: restActiveIds,
			activeProjectId: newActiveId,
		});

		// 2. Now close PTY processes (after UI has unmounted terminals)
		for (const tab of tabs) {
			if (tab.terminalId) {
				await window.connexio.terminal.close(tab.terminalId);
			}
		}

		// 3. Delete from storage
		await window.connexio.project.delete(id);
		set({ projects: await window.connexio.project.list() });

		get().persistWorkspace();
	},

	setActiveProject: (id: string) => {
		const { activeProjectId, projects } = get();
		if (activeProjectId === id) return;

		const project = projects.find((p) => p.id === id);
		if (!project) return;

		set({ activeProjectId: id });

		// Auto-open first terminal tab if workspace is empty
		const tabs = get().workspaceTabs[id];
		if (!tabs || tabs.length === 0) {
			get().openTerminalTab(id, "Terminal 1");
		}

		get().updateProjectLastOpened(id);
		get().persistWorkspace();
	},

	setSearchQuery: (query: string) => {
		set({ searchQuery: query });
	},

	toggleSidebar: () => {
		set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
	},

	updateProjectLastOpened: async (id: string) => {
		const { projects } = get();
		const project = projects.find((p) => p.id === id);
		if (project) {
			const updated = { ...project, lastOpenedAt: Date.now() };
			await window.connexio.project.update(updated);
		}
	},

	// === Project Reorder ===

	reorderProjects: async (fromId: string, toId: string) => {
		const { projects } = get();
		const fromIndex = projects.findIndex((p) => p.id === fromId);
		const toIndex = projects.findIndex((p) => p.id === toId);
		if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

		const reordered = [...projects];
		const [moved] = reordered.splice(fromIndex, 1);
		reordered.splice(toIndex, 0, moved);

		set({ projects: reordered });

		// Persist order: update all projects
		for (const project of reordered) {
			await window.connexio.project.update(project);
		}
	},

	moveProjectToGroup: async (projectId: string, newGroup: string) => {
		const { projects } = get();
		const project = projects.find((p) => p.id === projectId);
		if (!project || project.group === newGroup) return;

		const updated = { ...project, group: newGroup };
		await window.connexio.project.update(updated);

		set({
			projects: projects.map((p) => (p.id === projectId ? updated : p)),
		});
	},

	// === Workspace Tab Actions ===

	openTerminalTab: async (
		projectId: string,
		label?: string,
		shell?: string,
	) => {
		const { projects, workspaceTabs, activeTabIds } = get();
		const project = projects.find((p) => p.id === projectId);
		if (!project) return;

		const existingTabs = workspaceTabs[projectId] || [];
		const tabLabel = label || `Terminal ${existingTabs.length + 1}`;

		const newTabId = uuid();
		const terminalId = await window.connexio.terminal.create(
			project.path,
			shell,
			{
				projectId,
				projectName: project.name,
				tabId: newTabId,
				tabLabel,
			},
		);

		const newTab: TerminalTab = {
			id: newTabId,
			label: tabLabel,
			shell,
			terminalId,
		};

		set({
			workspaceTabs: {
				...workspaceTabs,
				[projectId]: [...existingTabs, newTab],
			},
			activeTabIds: {
				...activeTabIds,
				[projectId]: newTab.id,
			},
		});

		get().persistWorkspace();
	},

	closeTerminalTab: (projectId: string, tabId: string) => {
		const { workspaceTabs, activeTabIds } = get();
		const tabs = workspaceTabs[projectId] || [];
		const tab = tabs.find((t) => t.id === tabId);

		if (tab?.terminalId) {
			window.connexio.terminal.close(tab.terminalId);
		}

		const newTabs = tabs.filter((t) => t.id !== tabId);
		const currentActiveId = activeTabIds[projectId];

		const newActiveTabIds = { ...activeTabIds };
		if (currentActiveId === tabId) {
			newActiveTabIds[projectId] = newTabs[newTabs.length - 1]?.id || "";
		}

		set({
			workspaceTabs: {
				...workspaceTabs,
				[projectId]: newTabs,
			},
			activeTabIds: newActiveTabIds,
		});

		get().persistWorkspace();
	},

	setActiveTerminalTab: (projectId: string, tabId: string) => {
		set({
			activeTabIds: {
				...get().activeTabIds,
				[projectId]: tabId,
			},
		});
		get().persistWorkspace();
	},

	renameTerminalTab: (projectId: string, tabId: string, newLabel: string) => {
		const { workspaceTabs } = get();
		const tabs = workspaceTabs[projectId] || [];
		const updatedTabs = tabs.map((t) =>
			t.id === tabId ? { ...t, label: newLabel } : t,
		);

		set({
			workspaceTabs: {
				...workspaceTabs,
				[projectId]: updatedTabs,
			},
		});

		get().persistWorkspace();
	},

	reorderTabs: (projectId: string, fromIndex: number, toIndex: number) => {
		const { workspaceTabs } = get();
		const tabs = [...(workspaceTabs[projectId] || [])];
		if (
			fromIndex < 0 ||
			toIndex < 0 ||
			fromIndex >= tabs.length ||
			toIndex >= tabs.length
		)
			return;

		const [movedTab] = tabs.splice(fromIndex, 1);
		tabs.splice(toIndex, 0, movedTab);

		set({
			workspaceTabs: {
				...workspaceTabs,
				[projectId]: tabs,
			},
		});

		get().persistWorkspace();
	},

	// === Persistence ===

	restoreWorkspace: async () => {
		set({ isRestoring: true });

		try {
			const saved = await window.connexio.workspace.getState();
			if (!saved || !saved.projectTabs) {
				set({ isRestoring: false });
				return;
			}

			const { projects } = get();
			const restoredTabs: Record<string, TerminalTab[]> = {};
			const restoredActiveIds: Record<string, string> = {};

			// Restore tabs for each project — create terminal processes
			// Projects restore in parallel, tabs within a project are sequential
			// to avoid race conditions with xterm.js mounting
			const projectEntries = Object.entries(saved.projectTabs)
				.map(([projectId, tabStates]) => ({
					projectId,
					tabStates,
					project: projects.find((p) => p.id === projectId),
				}))
				.filter((e) => e.project && e.tabStates.length > 0);

			await Promise.all(
				projectEntries.map(async ({ projectId, tabStates, project }) => {
					const tabs: TerminalTab[] = [];
					for (const tabState of tabStates) {
						try {
							const terminalId = await window.connexio.terminal.create(
								project!.path,
								tabState.shell,
							);
							tabs.push({
								id: tabState.id,
								label: tabState.label,
								shell: tabState.shell,
								terminalId,
							});
						} catch {
							// Skip tabs that fail to create
						}
					}

					if (tabs.length > 0) {
						restoredTabs[projectId] = tabs;
						const savedActiveId = saved.activeTabIds[projectId];
						const activeExists = tabs.find((t) => t.id === savedActiveId);
						restoredActiveIds[projectId] = activeExists
							? savedActiveId
							: tabs[0].id;
					}
				}),
			);

			// Restore active project if it still exists
			const activeProjectId =
				saved.activeProjectId &&
				projects.find((p) => p.id === saved.activeProjectId)
					? saved.activeProjectId
					: null;

			set({
				workspaceTabs: restoredTabs,
				activeTabIds: restoredActiveIds,
				activeProjectId,
				isRestoring: false,
			});
		} catch (error) {
			console.error("Failed to restore workspace:", error);
			set({ isRestoring: false });
		}
	},

	persistWorkspace: () => {
		// Don't persist while restoring
		if (get().isRestoring) return;

		debouncedSave(() => {
			const { activeProjectId, workspaceTabs, activeTabIds } = get();

			// Convert TerminalTab[] to WorkspaceTabState[] (strip terminalId)
			const projectTabs: Record<string, WorkspaceTabState[]> = {};
			for (const [projectId, tabs] of Object.entries(workspaceTabs)) {
				if (tabs.length > 0) {
					projectTabs[projectId] = tabs.map((t) => ({
						id: t.id,
						label: t.label,
						shell: t.shell,
					}));
				}
			}

			const state: WorkspaceState = {
				activeProjectId,
				projectTabs,
				activeTabIds,
			};

			window.connexio.workspace.saveState(state).catch((err: unknown) => {
				console.error("Failed to persist workspace:", err);
			});
		});
	},
}));
