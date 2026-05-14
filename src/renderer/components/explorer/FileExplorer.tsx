import {
	ChevronDown,
	ChevronRight,
	File,
	FileCode,
	FileJson,
	FileText,
	Folder,
	FolderOpen,
	Image,
	Package,
	Terminal,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

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
}

function getFileIcon(entry: FileEntry) {
	if (entry.isDir) return null; // handled separately

	const ext = entry.extension?.toLowerCase();
	switch (ext) {
		case "ts":
		case "tsx":
		case "js":
		case "jsx":
		case "py":
		case "rs":
		case "go":
		case "java":
		case "c":
		case "cpp":
		case "cs":
		case "php":
		case "rb":
		case "swift":
		case "kt":
			return <FileCode size={14} className="text-blue-400 flex-shrink-0" />;
		case "json":
		case "yaml":
		case "yml":
		case "toml":
			return <FileJson size={14} className="text-yellow-400 flex-shrink-0" />;
		case "md":
		case "txt":
		case "log":
			return <FileText size={14} className="text-gray-400 flex-shrink-0" />;
		case "png":
		case "jpg":
		case "jpeg":
		case "gif":
		case "svg":
		case "webp":
		case "ico":
			return <Image size={14} className="text-green-400 flex-shrink-0" />;
		case "sh":
		case "bash":
		case "zsh":
		case "ps1":
		case "bat":
		case "cmd":
			return <Terminal size={14} className="text-green-300 flex-shrink-0" />;
		default:
			return <File size={14} className="text-connexio-text-muted flex-shrink-0" />;
	}
}

function FileTreeNode({
	entry,
	depth,
	onOpenInTerminal,
}: {
	entry: FileEntry;
	depth: number;
	onOpenInTerminal?: (path: string) => void;
}) {
	const [expanded, setExpanded] = useState(false);
	const [children, setChildren] = useState<FileEntry[] | null>(entry.children);
	const [loading, setLoading] = useState(false);

	const toggleExpand = useCallback(async () => {
		if (!entry.isDir) return;

		if (!expanded && !children) {
			setLoading(true);
			try {
				const result = await invoke<FileEntry[]>("explorer_list_dir", {
					dirPath: entry.path,
				});
				setChildren(result);
			} catch (e) {
				console.error("Failed to list dir:", e);
			}
			setLoading(false);
		}
		setExpanded(!expanded);
	}, [expanded, children, entry]);

	const handleClick = () => {
		if (entry.isDir) {
			toggleExpand();
		} else {
			// Open file with default OS app
			invoke("git_open_file", {
				projectPath: entry.path.substring(0, entry.path.lastIndexOf("\\")),
				filePath: entry.name,
			}).catch(() => {
				// Fallback: try opener directly
			});
		}
	};

	const handleContextMenu = (e: React.MouseEvent) => {
		e.preventDefault();
		if (entry.isDir && onOpenInTerminal) {
			onOpenInTerminal(entry.path);
		}
	};

	return (
		<div>
			<div
				className={`flex items-center gap-1 px-2 py-[3px] cursor-pointer hover:bg-connexio-bg-tertiary rounded-sm transition-colors group ${
					entry.isHidden ? "opacity-60" : ""
				}`}
				style={{ paddingLeft: `${depth * 12 + 8}px` }}
				onClick={handleClick}
				onContextMenu={handleContextMenu}
			>
				{/* Expand/collapse icon for directories */}
				{entry.isDir ? (
					<>
						{expanded ? (
							<ChevronDown size={12} className="text-connexio-text-muted flex-shrink-0" />
						) : (
							<ChevronRight size={12} className="text-connexio-text-muted flex-shrink-0" />
						)}
						{expanded ? (
							<FolderOpen size={14} className="text-connexio-accent flex-shrink-0" />
						) : (
							<Folder size={14} className="text-connexio-accent/70 flex-shrink-0" />
						)}
					</>
				) : (
					<>
						<span className="w-3 flex-shrink-0" />
						{getFileIcon(entry)}
					</>
				)}

				{/* File/folder name */}
				<span className="text-[12px] text-connexio-text truncate">
					{entry.name}
				</span>
			</div>

			{/* Children */}
			{entry.isDir && expanded && children && (
				<div>
					{children.map((child) => (
						<FileTreeNode
							key={child.path}
							entry={child}
							depth={depth + 1}
							onOpenInTerminal={onOpenInTerminal}
						/>
					))}
				</div>
			)}

			{entry.isDir && expanded && loading && (
				<div
					className="text-[11px] text-connexio-text-muted px-2 py-1"
					style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}
				>
					Loading...
				</div>
			)}
		</div>
	);
}

export default function FileExplorer({ projectPath, onOpenInTerminal }: Props) {
	const [entries, setEntries] = useState<FileEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [showHidden, setShowHidden] = useState(false);

	useEffect(() => {
		if (!projectPath) return;
		setLoading(true);
		invoke<FileEntry[]>("explorer_list_dir", { dirPath: projectPath })
			.then((result) => {
				setEntries(result);
				setLoading(false);
			})
			.catch((e) => {
				console.error("Failed to load explorer:", e);
				setLoading(false);
			});
	}, [projectPath]);

	const filteredEntries = showHidden
		? entries
		: entries.filter((e) => !e.isHidden);

	return (
		<div className="flex flex-col h-full overflow-hidden">
			{/* Header */}
			<div className="flex items-center justify-between px-3 py-2 border-b border-connexio-border">
				<span className="text-[10px] font-semibold uppercase tracking-wider text-connexio-text-muted">
					Explorer
				</span>
				<button
					onClick={() => setShowHidden(!showHidden)}
					className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
						showHidden
							? "bg-connexio-accent/10 text-connexio-accent"
							: "text-connexio-text-muted hover:text-connexio-text-secondary"
					}`}
					title={showHidden ? "Hide hidden files" : "Show hidden files"}
					type="button"
				>
					.*
				</button>
			</div>

			{/* Tree */}
			<div className="flex-1 overflow-y-auto py-1">
				{loading ? (
					<div className="text-[11px] text-connexio-text-muted px-3 py-2">
						Loading...
					</div>
				) : filteredEntries.length === 0 ? (
					<div className="text-[11px] text-connexio-text-muted px-3 py-2">
						Empty directory
					</div>
				) : (
					filteredEntries.map((entry) => (
						<FileTreeNode
							key={entry.path}
							entry={entry}
							depth={0}
							onOpenInTerminal={onOpenInTerminal}
						/>
					))
				)}
			</div>
		</div>
	);
}
