import {
	ChevronDown,
	ChevronRight,
	File,
	FileCode,
	FileJson,
	FileText,
	FilePlus,
	Folder,
	FolderOpen,
	FolderPlus,
	Image,
	RefreshCw,
	Terminal,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import ExplorerContextMenu from "./ExplorerContextMenu";

interface FileEntry {
	name: string;
	path: string;
	isDir: boolean;
	isHidden: boolean;
	extension: string | null;
	size: number | null;
	children: FileEntry[] | null;
}

interface Props {
	projectPath: string;
	onOpenInTerminal?: (path: string) => void;
	onOpenFile?: (filePath: string) => void;
}

function parentDir(filePath: string): string {
	const normalized = filePath.replace(/\\/g, "/");
	return normalized.substring(0, normalized.lastIndexOf("/"));
}

function joinPath(dir: string, name: string): string {
	const d = dir.replace(/\\/g, "/").replace(/\/$/, "");
	return `${d}/${name}`;
}

function getFileIcon(entry: FileEntry) {
	if (entry.isDir) return null;
	const ext = entry.extension?.toLowerCase();
	switch (ext) {
		case "ts": case "tsx": case "js": case "jsx": case "py": case "rs":
		case "go": case "java": case "c": case "cpp": case "cs": case "php":
			return <FileCode size={14} className="text-blue-400 flex-shrink-0" />;
		case "json": case "yaml": case "yml": case "toml":
			return <FileJson size={14} className="text-yellow-400 flex-shrink-0" />;
		case "md": case "txt": case "log":
			return <FileText size={14} className="text-gray-400 flex-shrink-0" />;
		case "png": case "jpg": case "jpeg": case "gif": case "svg": case "webp":
			return <Image size={14} className="text-green-400 flex-shrink-0" />;
		case "sh": case "bash": case "ps1": case "bat": case "cmd":
			return <Terminal size={14} className="text-green-300 flex-shrink-0" />;
		default:
			return <File size={14} className="text-connexio-text-muted flex-shrink-0" />;
	}
}

// ─── Inline Input ────────────────────────────────────────────────────────────

function InlineInput({ initialValue, placeholder, onConfirm, onCancel }: {
	initialValue?: string;
	placeholder?: string;
	onConfirm: (value: string) => void;
	onCancel: () => void;
}) {
	const [value, setValue] = useState(initialValue || "");
	return (
		<input
			autoFocus
			value={value}
			placeholder={placeholder}
			onChange={(e) => setValue(e.target.value)}
			onBlur={() => { if (value.trim()) onConfirm(value.trim()); else onCancel(); }}
			onKeyDown={(e) => {
				if (e.key === "Enter" && value.trim()) { e.preventDefault(); onConfirm(value.trim()); }
				if (e.key === "Escape") onCancel();
				e.stopPropagation();
			}}
			onClick={(e) => e.stopPropagation()}
			className="flex-1 min-w-0 text-[12px] px-1 py-0 bg-connexio-bg border border-connexio-accent/60 rounded text-connexio-text outline-none"
		/>
	);
}

// ─── File Tree Node ──────────────────────────────────────────────────────────

function FileTreeNode({ entry, depth, onOpenFile, onContextMenu, renamingPath, onRenameConfirm, newItem, onNewItemConfirm, onNewItemCancel }: {
	entry: FileEntry;
	depth: number;
	onOpenFile?: (filePath: string) => void;
	onContextMenu?: (e: React.MouseEvent, entry: FileEntry) => void;
	renamingPath: string | null;
	onRenameConfirm: (oldPath: string, newName: string) => void;
	newItem: { parent: string; type: "file" | "folder" } | null;
	onNewItemConfirm: (parent: string, name: string, type: "file" | "folder") => void;
	onNewItemCancel: () => void;
}) {
	const [expanded, setExpanded] = useState(false);
	const [children, setChildren] = useState<FileEntry[] | null>(entry.children);
	const [loading, setLoading] = useState(false);

	// Auto-expand when new item targets this folder
	useEffect(() => {
		if (newItem && newItem.parent === entry.path && !expanded) {
			setExpanded(true);
			if (!children) {
				invoke<FileEntry[]>("explorer_list_dir", { dirPath: entry.path })
					.then(setChildren).catch(() => {});
			}
		}
	}, [newItem]);

	const toggleExpand = useCallback(async () => {
		if (!entry.isDir) return;
		if (!expanded && !children) {
			setLoading(true);
			const result = await invoke<FileEntry[]>("explorer_list_dir", { dirPath: entry.path }).catch(() => []);
			setChildren(result as FileEntry[]);
			setLoading(false);
		}
		setExpanded(!expanded);
	}, [expanded, children, entry]);

	const handleClick = () => {
		if (entry.isDir) toggleExpand();
		else onOpenFile?.(entry.path);
	};

	const showNewItem = newItem && newItem.parent === entry.path;

	return (
		<div>
			<div
				className={`flex items-center gap-1 px-2 py-[3px] cursor-pointer hover:bg-connexio-bg-tertiary rounded-sm transition-colors ${entry.isHidden ? "opacity-60" : ""}`}
				style={{ paddingLeft: `${depth * 12 + 8}px` }}
				onClick={handleClick}
				onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu?.(e, entry); }}
			>
				{entry.isDir ? (
					<>
						{expanded ? <ChevronDown size={12} className="text-connexio-text-muted flex-shrink-0" /> : <ChevronRight size={12} className="text-connexio-text-muted flex-shrink-0" />}
						{expanded ? <FolderOpen size={14} className="text-connexio-accent flex-shrink-0" /> : <Folder size={14} className="text-connexio-accent/70 flex-shrink-0" />}
					</>
				) : (
					<>
						<span className="w-3 flex-shrink-0" />
						{getFileIcon(entry)}
					</>
				)}

				{renamingPath === entry.path ? (
					<InlineInput
						initialValue={entry.name}
						onConfirm={(val) => onRenameConfirm(entry.path, val)}
						onCancel={() => onRenameConfirm(entry.path, entry.name)}
					/>
				) : (
					<span className="text-[12px] text-connexio-text truncate">{entry.name}</span>
				)}
			</div>

			{entry.isDir && expanded && (
				<div>
					{showNewItem && (
						<div className="flex items-center gap-1 px-2 py-[3px]" style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}>
							<span className="w-3 flex-shrink-0" />
							{newItem!.type === "folder"
								? <Folder size={14} className="text-connexio-accent/70 flex-shrink-0" />
								: <File size={14} className="text-connexio-text-muted flex-shrink-0" />}
							<InlineInput
								placeholder={newItem!.type === "folder" ? "folder-name" : "filename.ext"}
								onConfirm={(val) => onNewItemConfirm(entry.path, val, newItem!.type)}
								onCancel={onNewItemCancel}
							/>
						</div>
					)}
					{children?.map((child) => (
						<FileTreeNode
							key={child.path}
							entry={child}
							depth={depth + 1}
							onOpenFile={onOpenFile}
							onContextMenu={onContextMenu}
							renamingPath={renamingPath}
							onRenameConfirm={onRenameConfirm}
							newItem={newItem}
							onNewItemConfirm={onNewItemConfirm}
							onNewItemCancel={onNewItemCancel}
						/>
					))}
					{loading && (
						<div className="text-[11px] text-connexio-text-muted px-2 py-1" style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}>Loading...</div>
					)}
				</div>
			)}
		</div>
	);
}

// ─── Main File Explorer ──────────────────────────────────────────────────────

export default function FileExplorer({ projectPath, onOpenInTerminal, onOpenFile }: Props) {
	const [entries, setEntries] = useState<FileEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [showHidden, setShowHidden] = useState(false);
	const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entry: FileEntry } | null>(null);
	const [renamingPath, setRenamingPath] = useState<string | null>(null);
	const [newItem, setNewItem] = useState<{ parent: string; type: "file" | "folder" } | null>(null);

	const refresh = useCallback(() => {
		if (!projectPath) return;
		invoke<FileEntry[]>("explorer_list_dir", { dirPath: projectPath })
			.then((result) => { setEntries(result); setLoading(false); })
			.catch(() => setLoading(false));
	}, [projectPath]);

	useEffect(() => { refresh(); }, [refresh]);

	// ─── Actions ─────────────────────────────────────────────────────────────

	const handleRename = async (oldPath: string, newName: string) => {
		setRenamingPath(null);
		const currentName = oldPath.replace(/\\/g, "/").split("/").pop();
		if (!newName || newName === currentName) return;
		try {
			await invoke("explorer_rename", { oldPath, newPath: joinPath(parentDir(oldPath), newName) });
			refresh();
		} catch (e) {
			console.error("Rename failed:", e);
		}
	};

	const handleDelete = async (targetPath: string) => {
		const name = targetPath.replace(/\\/g, "/").split("/").pop();
		if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
		try {
			await invoke("explorer_delete", { targetPath });
			refresh();
		} catch (e) {
			console.error("Delete failed:", e);
		}
	};

	const handleNewItem = async (parent: string, name: string, type: "file" | "folder") => {
		setNewItem(null);
		const fullPath = joinPath(parent, name);
		try {
			if (type === "file") await invoke("explorer_new_file", { filePath: fullPath });
			else await invoke("explorer_new_folder", { dirPath: fullPath });
			refresh();
			// Open new file in editor
			if (type === "file" && onOpenFile) onOpenFile(fullPath);
		} catch (e) {
			console.error("Create failed:", e);
		}
	};

	const handleOpenExternal = (path: string) => {
		invoke("explorer_open_path", { targetPath: path }).catch(() => {});
	};

	// ─── Render ──────────────────────────────────────────────────────────────

	const filteredEntries = showHidden ? entries : entries.filter((e) => !e.isHidden);

	return (
		<div className="flex flex-col h-full overflow-hidden">
			{/* Header */}
			<div className="flex items-center justify-between px-3 py-2 border-b border-connexio-border">
				<span className="text-[10px] font-semibold uppercase tracking-wider text-connexio-text-muted">
					Explorer
				</span>
				<div className="flex items-center gap-1">
					<button onClick={() => setNewItem({ parent: projectPath, type: "file" })} className="p-0.5 rounded hover:bg-connexio-bg-tertiary" title="New File" type="button">
						<FilePlus size={12} className="text-connexio-text-muted" />
					</button>
					<button onClick={() => setNewItem({ parent: projectPath, type: "folder" })} className="p-0.5 rounded hover:bg-connexio-bg-tertiary" title="New Folder" type="button">
						<FolderPlus size={12} className="text-connexio-text-muted" />
					</button>
					<button onClick={refresh} className="p-0.5 rounded hover:bg-connexio-bg-tertiary" title="Refresh" type="button">
						<RefreshCw size={12} className="text-connexio-text-muted" />
					</button>
					<button onClick={() => setShowHidden(!showHidden)} className={`text-[10px] px-1 py-0.5 rounded ${showHidden ? "bg-connexio-accent/10 text-connexio-accent" : "text-connexio-text-muted"}`} title="Toggle hidden" type="button">
						.*
					</button>
				</div>
			</div>

			{/* New item at root level */}
			{newItem && newItem.parent === projectPath && (
				<div className="flex items-center gap-1 px-2 py-[3px]" style={{ paddingLeft: "8px" }}>
					<span className="w-3 flex-shrink-0" />
					{newItem.type === "folder"
						? <Folder size={14} className="text-connexio-accent/70 flex-shrink-0" />
						: <File size={14} className="text-connexio-text-muted flex-shrink-0" />}
					<InlineInput
						placeholder={newItem.type === "folder" ? "folder-name" : "filename.ext"}
						onConfirm={(val) => handleNewItem(projectPath, val, newItem.type)}
						onCancel={() => setNewItem(null)}
					/>
				</div>
			)}

			{/* Tree */}
			<div className="flex-1 overflow-y-auto py-1" onContextMenu={(e) => {
				e.preventDefault();
				// Right-click empty area = root context
				setContextMenu({ x: e.clientX, y: e.clientY, entry: { name: "", path: projectPath, isDir: true, isHidden: false, extension: null, size: null, children: null } });
			}}>
				{loading ? (
					<div className="text-[11px] text-connexio-text-muted px-3 py-2">Loading...</div>
				) : filteredEntries.length === 0 ? (
					<div className="text-[11px] text-connexio-text-muted px-3 py-2">Empty directory</div>
				) : (
					filteredEntries.map((entry) => (
						<FileTreeNode
							key={entry.path}
							entry={entry}
							depth={0}
							onOpenFile={onOpenFile}
							onContextMenu={(e, ent) => setContextMenu({ x: e.clientX, y: e.clientY, entry: ent })}
							renamingPath={renamingPath}
							onRenameConfirm={handleRename}
							newItem={newItem}
							onNewItemConfirm={handleNewItem}
							onNewItemCancel={() => setNewItem(null)}
						/>
					))
				)}
			</div>

			{/* Context Menu */}
			{contextMenu && (
				<ExplorerContextMenu
					x={contextMenu.x}
					y={contextMenu.y}
					isDir={contextMenu.entry.isDir}
					onClose={() => setContextMenu(null)}
					onRename={() => { setRenamingPath(contextMenu.entry.path); setContextMenu(null); }}
					onDelete={() => { handleDelete(contextMenu.entry.path); setContextMenu(null); }}
					onNewFile={() => { setNewItem({ parent: contextMenu.entry.isDir ? contextMenu.entry.path : projectPath, type: "file" }); setContextMenu(null); }}
					onNewFolder={() => { setNewItem({ parent: contextMenu.entry.isDir ? contextMenu.entry.path : projectPath, type: "folder" }); setContextMenu(null); }}
					onCopyPath={() => { navigator.clipboard.writeText(contextMenu.entry.path).catch(() => {}); setContextMenu(null); }}
					onOpenInTerminal={() => { onOpenInTerminal?.(contextMenu.entry.isDir ? contextMenu.entry.path : parentDir(contextMenu.entry.path)); setContextMenu(null); }}
					onOpenExternal={() => { handleOpenExternal(contextMenu.entry.path); setContextMenu(null); }}
				/>
			)}
		</div>
	);
}
