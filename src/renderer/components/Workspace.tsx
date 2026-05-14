import { Bot, FolderTree, GitBranch, Globe, ListTodo, PanelRightClose, Server } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useProjectStore } from "../stores/projectStore";
import { AIChatPanel } from "./ai";
import CommandTimer from "./CommandTimer";
import ConfirmDialog from "./ConfirmDialog";
import { CodeEditor } from "./editor";
import { FileExplorer } from "./explorer";
import ShellPicker from "./ShellPicker";
import SourcePanel from "./SourcePanel";
import SSHPanel from "./SSHPanel";
import TaskPanel from "./TaskPanel";
import TerminalLayer from "./TerminalLayer";
import WebPreview from "./WebPreview";
import WorkspaceTab from "./WorkspaceTab";

type SidePanelTab = "ai" | "explorer" | "tasks" | "ssh" | "source";

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
	const [closeConfirmTabId, setCloseConfirmTabId] = useState<string | null>(
		null,
	);
	const [editorFile, setEditorFile] = useState<string | null>(null);
	const [showPreview, setShowPreview] = useState(false);
	const tabBarRef = useRef<HTMLDivElement>(null);

	// Resizable side panel
	const [panelWidth, setPanelWidth] = useState(360);
	const isResizing = useRef(false);
	const panelRef = useRef<HTMLDivElement>(null);

	const handleResizeStart = useCallback((e: React.MouseEvent) => {
		e.preventDefault();
		isResizing.current = true;
		document.body.style.cursor = "col-resize";
		document.body.style.userSelect = "none";
	}, []);

	useEffect(() => {
		const handleResizeMove = (e: MouseEvent) => {
			if (!isResizing.current || !panelRef.current) return;
			const containerRect = panelRef.current.parentElement?.getBoundingClientRect();
			if (!containerRect) return;
			const newWidth = containerRect.right - e.clientX;
			setPanelWidth(Math.max(280, Math.min(600, newWidth)));
		};

		const handleResizeEnd = () => {
			if (isResizing.current) {
				isResizing.current = false;
				document.body.style.cursor = "";
				document.body.style.userSelect = "";
			}
		};

		document.addEventListener("mousemove", handleResizeMove);
		document.addEventListener("mouseup", handleResizeEnd);
		return () => {
			document.removeEventListener("mousemove", handleResizeMove);
			document.removeEventListener("mouseup", handleResizeEnd);
		};
	}, []);

	// Listen for footer panel open/close events
	useEffect(() => {
		const handlePanelEvent = (e: Event) => {
			const detail = (e as CustomEvent).detail;
			if (detail === "close") {
				setShowSidePanel(false);
			} else if (detail === "ai" || detail === "explorer" || detail === "source" || detail === "tasks" || detail === "ssh") {
				setSidePanelTab(detail as SidePanelTab);
				setShowSidePanel(true);
			}
		};
		window.addEventListener("connexio:open-panel", handlePanelEvent);
		return () => window.removeEventListener("connexio:open-panel", handlePanelEvent);
	}, []);

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

	// Close tab with confirmation
	const handleCloseTab = (tabId: string) => {
		setCloseConfirmTabId(tabId);
	};

	const confirmCloseTab = () => {
		if (closeConfirmTabId) {
			closeTerminalTab(activeProjectId, closeConfirmTabId);
			setCloseConfirmTabId(null);
		}
	};

	const cancelCloseTab = () => {
		setCloseConfirmTabId(null);
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

				{/* Command Timer for active terminal */}
				{activeTab?.terminalId && (
					<CommandTimer terminalId={activeTab.terminalId} />
				)}

				{/* Web Preview toggle */}
				<button
					onClick={() => setShowPreview(!showPreview)}
					className={`p-1 rounded transition-colors ${
						showPreview
							? "bg-connexio-accent/10 text-connexio-accent"
							: "hover:bg-connexio-bg-tertiary text-connexio-text-muted"
					}`}
					title="Web Preview"
					type="button"
				>
					<Globe size={12} />
				</button>

				{/* Side panel toggles */}
				<div className="ml-auto flex items-center gap-0.5 flex-shrink-0">
					<button
						onClick={() => toggleSidePanel("ai")}
						className={`p-1 rounded transition-colors ${
							showSidePanel && sidePanelTab === "ai"
								? "bg-connexio-accent/10 text-connexio-accent"
								: "hover:bg-connexio-bg-tertiary text-connexio-text-muted"
						}`}
						title="AI Chat"
						type="button"
					>
						<Bot size={12} />
					</button>
					<button
						onClick={() => toggleSidePanel("explorer")}
						className={`p-1 rounded transition-colors ${
							showSidePanel && sidePanelTab === "explorer"
								? "bg-connexio-accent/10 text-connexio-accent"
								: "hover:bg-connexio-bg-tertiary text-connexio-text-muted"
						}`}
						title="File Explorer"
						type="button"
					>
						<FolderTree size={12} />
					</button>
					<button
						onClick={() => toggleSidePanel("source")}
						className={`p-1 rounded transition-colors ${
							showSidePanel && sidePanelTab === "source"
								? "bg-connexio-accent/10 text-connexio-accent"
								: "hover:bg-connexio-bg-tertiary text-connexio-text-muted"
						}`}
						title="Source Control"
						type="button"
					>
						<GitBranch size={12} />
					</button>
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
							onClose={() => handleCloseTab(tab.id)}
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

					{/* Add tab — inline after last tab */}
					<div className="flex-shrink-0 ml-0.5">
						<ShellPicker
							onSelect={(shell) =>
								openTerminalTab(activeProjectId, undefined, shell)
							}
						/>
					</div>
				</div>
			</div>

			{/* Main content area */}
			<div className="flex flex-1 overflow-hidden">
				{/* Terminal / Editor / Preview Area */}
				<div className="flex-1 relative overflow-hidden flex flex-col">
					{showPreview ? (
						<WebPreview onClose={() => setShowPreview(false)} />
					) : editorFile ? (
						<CodeEditor
							filePath={editorFile}
							onClose={() => setEditorFile(null)}
						/>
					) : (
						<TerminalLayer />
					)}
				</div>

				{/* Right Side Panel */}
				{showSidePanel && (
					<div
						ref={panelRef}
						className="bg-connexio-bg-secondary border-l border-connexio-border flex flex-col relative"
						style={{ width: sidePanelTab === "source" || sidePanelTab === "explorer" || sidePanelTab === "ai" ? panelWidth : 240 }}
					>
						{/* Resize handle */}
						{(sidePanelTab === "source" || sidePanelTab === "explorer" || sidePanelTab === "ai") && (
							<div
								className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-connexio-accent/30 active:bg-connexio-accent/50 transition-colors z-10"
								onMouseDown={handleResizeStart}
							/>
						)}
						{/* Panel header with tabs */}
						<div className="flex items-center border-b border-connexio-border">
							<button
								onClick={() => setSidePanelTab("ai")}
								className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
									sidePanelTab === "ai"
										? "text-connexio-accent border-b-2 border-connexio-accent"
										: "text-connexio-text-muted hover:text-connexio-text-secondary"
								}`}
								type="button"
							>
								<Bot size={10} />
								AI
							</button>
							<button
								onClick={() => setSidePanelTab("explorer")}
								className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
									sidePanelTab === "explorer"
										? "text-connexio-accent border-b-2 border-connexio-accent"
										: "text-connexio-text-muted hover:text-connexio-text-secondary"
								}`}
								type="button"
							>
								<FolderTree size={10} />
								Files
							</button>
							<button
								onClick={() => setSidePanelTab("source")}
								className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
									sidePanelTab === "source"
										? "text-connexio-accent border-b-2 border-connexio-accent"
										: "text-connexio-text-muted hover:text-connexio-text-secondary"
								}`}
								type="button"
							>
								<GitBranch size={10} />
								Source
							</button>
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
						{sidePanelTab === "ai" && <AIChatPanel />}
						{sidePanelTab === "explorer" && (
							<FileExplorer
								projectPath={project.path}
								onOpenInTerminal={(path) => {
									openTerminalTab(activeProjectId, `Terminal (${path.split(/[\\/]/).pop()})`);
								}}
								onOpenFile={(filePath) => setEditorFile(filePath)}
							/>
						)}
						{sidePanelTab === "source" && (
							<SourcePanel projectPath={project.path} />
						)}
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

			{/* Close tab confirmation dialog */}
			{closeConfirmTabId && (
				<ConfirmDialog
					title="Close Terminal"
					message="Are you sure you want to close this terminal? Any running process will be terminated."
					confirmLabel="Close"
					cancelLabel="Cancel"
					variant="warning"
					onConfirm={confirmCloseTab}
					onCancel={cancelCloseTab}
				/>
			)}
		</div>
	);
}
