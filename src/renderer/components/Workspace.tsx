import { ListTodo, PanelRightClose, Server } from "lucide-react";
import { useRef, useState } from "react";
import { useProjectStore } from "../stores/projectStore";
import CommandTimer from "./CommandTimer";
import GitStatusBar from "./GitStatusBar";
import ShellPicker from "./ShellPicker";
import SSHPanel from "./SSHPanel";
import TaskPanel from "./TaskPanel";
import TerminalLayer from "./TerminalLayer";
import WorkspaceTab from "./WorkspaceTab";

type SidePanelTab = "tasks" | "ssh";

export default function Workspace() {
	const {
		projects,
		activeProjectId,
		workspaceTabs,
		activeTabIds,
		openTerminalTab,
		closeTerminalTab,
		setActiveTerminalTab,
		renameTerminalTab,
		reorderTabs,
	} = useProjectStore();

	// Drag state
	const [dragFromIndex, setDragFromIndex] = useState<number | null>(null);
	const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
	const [dragSide, setDragSide] = useState<"left" | "right" | null>(null);
	const [showSidePanel, setShowSidePanel] = useState(false);
	const [sidePanelTab, setSidePanelTab] = useState<SidePanelTab>("tasks");
	const tabBarRef = useRef<HTMLDivElement>(null);

	if (!activeProjectId) return null;

	const project = projects.find((p) => p.id === activeProjectId);
	if (!project) return null;

	const tabs = workspaceTabs[activeProjectId] || [];
	const activeTabId = activeTabIds[activeProjectId] || null;
	const activeTab = tabs.find((t) => t.id === activeTabId);

	const handleDragStart = (index: number) => {
		setDragFromIndex(index);
	};

	const handleDragOver = (index: number) => {
		if (dragFromIndex === null || dragFromIndex === index) {
			setDragOverIndex(null);
			setDragSide(null);
			return;
		}
		setDragOverIndex(index);
		setDragSide(dragFromIndex < index ? "right" : "left");
	};

	const handleDragEnd = () => {
		if (
			dragFromIndex !== null &&
			dragOverIndex !== null &&
			dragFromIndex !== dragOverIndex
		) {
			reorderTabs(activeProjectId, dragFromIndex, dragOverIndex);
		}
		setDragFromIndex(null);
		setDragOverIndex(null);
		setDragSide(null);
	};

	const handleTabBarDragOver = (e: React.DragEvent) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
	};

	const handleTabBarDrop = (e: React.DragEvent) => {
		e.preventDefault();
		handleDragEnd();
	};

	// Run command in active terminal
	const handleRunCommand = (command: string) => {
		if (activeTab?.terminalId) {
			window.connexio.terminal.write(activeTab.terminalId, `${command}\r`);
		}
	};

	// SSH connect — open new tab with SSH command
	const handleSSHConnect = async (command: string, label: string) => {
		await openTerminalTab(activeProjectId, label);
		// Wait a tick for the new tab to be created, then write the SSH command
		setTimeout(() => {
			const updatedTabs =
				useProjectStore.getState().workspaceTabs[activeProjectId] || [];
			const newTab = updatedTabs[updatedTabs.length - 1];
			if (newTab?.terminalId) {
				window.connexio.terminal.write(newTab.terminalId, `${command}\r`);
			}
		}, 500);
	};

	const toggleSidePanel = (tab: SidePanelTab) => {
		if (showSidePanel && sidePanelTab === tab) {
			setShowSidePanel(false);
		} else {
			setSidePanelTab(tab);
			setShowSidePanel(true);
		}
	};

	return (
		<div className="flex flex-col flex-1 overflow-hidden">
			{/* Workspace Header */}
			<div className="flex items-center h-8 px-3 bg-connexio-bg-secondary border-b border-connexio-border gap-2">
				<span className="text-[11px] font-medium text-connexio-text-muted truncate flex-shrink-0">
					{project.name}
				</span>
				<span className="text-[10px] text-connexio-text-muted truncate opacity-60 flex-shrink min-w-0">
					{project.path}
				</span>
				<GitStatusBar projectPath={project.path} />

				{/* Command Timer for active terminal */}
				{activeTab?.terminalId && (
					<CommandTimer terminalId={activeTab.terminalId} />
				)}

				{/* Side panel toggles */}
				<div className="ml-auto flex items-center gap-0.5 flex-shrink-0">
					<button
						onClick={() => toggleSidePanel("tasks")}
						className={`p-1 rounded transition-colors ${
							showSidePanel && sidePanelTab === "tasks"
								? "bg-connexio-accent/10 text-connexio-accent"
								: "hover:bg-connexio-bg-tertiary text-connexio-text-muted"
						}`}
						title="Tasks & Pinned Commands"
						type="button"
					>
						<ListTodo size={12} />
					</button>
					<button
						onClick={() => toggleSidePanel("ssh")}
						className={`p-1 rounded transition-colors ${
							showSidePanel && sidePanelTab === "ssh"
								? "bg-connexio-accent/10 text-connexio-accent"
								: "hover:bg-connexio-bg-tertiary text-connexio-text-muted"
						}`}
						title="SSH Connections"
						type="button"
					>
						<Server size={12} />
					</button>
				</div>
			</div>

			{/* Terminal TabBar */}
			<div
				ref={tabBarRef}
				className="flex items-center h-9 bg-connexio-bg-secondary border-b border-connexio-border"
				onDragOver={handleTabBarDragOver}
				onDrop={handleTabBarDrop}
			>
				<div className="flex items-center flex-1 overflow-x-auto">
					{tabs.map((tab, index) => (
						<WorkspaceTab
							key={tab.id}
							id={tab.id}
							label={tab.label}
							isActive={activeTabId === tab.id}
							index={index}
							canClose={tabs.length > 1}
							onSelect={() => setActiveTerminalTab(activeProjectId, tab.id)}
							onClose={() => closeTerminalTab(activeProjectId, tab.id)}
							onRename={(newLabel) =>
								renameTerminalTab(activeProjectId, tab.id, newLabel)
							}
							onDragStart={handleDragStart}
							onDragOver={handleDragOver}
							onDragEnd={handleDragEnd}
							isDragOver={dragOverIndex === index}
							dragSide={dragOverIndex === index ? dragSide : null}
						/>
					))}
				</div>

				{/* Add tab with shell picker */}
				<div className="mx-1">
					<ShellPicker
						onSelect={(shell) =>
							openTerminalTab(activeProjectId, undefined, shell)
						}
					/>
				</div>
			</div>

			{/* Main content area */}
			<div className="flex flex-1 overflow-hidden">
				{/* Terminal Area */}
				<div className="flex-1 relative overflow-hidden">
					<TerminalLayer />
				</div>

				{/* Right Side Panel */}
				{showSidePanel && (
					<div className="w-60 bg-connexio-bg-secondary border-l border-connexio-border flex flex-col">
						{/* Panel header with tabs */}
						<div className="flex items-center border-b border-connexio-border">
							<button
								onClick={() => setSidePanelTab("tasks")}
								className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
									sidePanelTab === "tasks"
										? "text-connexio-accent border-b-2 border-connexio-accent"
										: "text-connexio-text-muted hover:text-connexio-text-secondary"
								}`}
								type="button"
							>
								<ListTodo size={10} />
								Tasks
							</button>
							<button
								onClick={() => setSidePanelTab("ssh")}
								className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
									sidePanelTab === "ssh"
										? "text-connexio-accent border-b-2 border-connexio-accent"
										: "text-connexio-text-muted hover:text-connexio-text-secondary"
								}`}
								type="button"
							>
								<Server size={10} />
								SSH
							</button>
							<button
								onClick={() => setShowSidePanel(false)}
								className="ml-auto p-1 mr-1 rounded hover:bg-connexio-bg-tertiary transition-colors"
								type="button"
							>
								<PanelRightClose
									size={11}
									className="text-connexio-text-muted"
								/>
							</button>
						</div>

						{/* Panel content */}
						{sidePanelTab === "tasks" && (
							<TaskPanel
								projectId={activeProjectId}
								projectPath={project.path}
								onRunCommand={handleRunCommand}
							/>
						)}
						{sidePanelTab === "ssh" && (
							<SSHPanel
								projectId={activeProjectId}
								onConnect={handleSSHConnect}
							/>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
