import {
	AlertCircle,
	ArrowDown,
	ArrowUp,
	Bell,
	GitBranch,
	Terminal,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GitStatus } from "../../shared/types";
import { useNotificationStore } from "../stores/notificationStore";
import { useProjectStore } from "../stores/projectStore";

export default function AppFooter() {
	const { projects, activeProjectId, workspaceTabs, activeTabIds } =
		useProjectStore();
	const { unreadCount } = useNotificationStore();
	const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
	const [appVersion, setAppVersion] = useState("");
	const [pathCopied, setPathCopied] = useState(false);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const mountedRef = useRef(true);

	const project = projects.find((p) => p.id === activeProjectId);

	// Fetch git status for active project
	const fetchGitStatus = useCallback(async () => {
		if (!project) {
			setGitStatus(null);
			return;
		}
		try {
			const result = await window.connexio.git.status(project.path);
			if (mountedRef.current) setGitStatus(result);
		} catch {
			if (mountedRef.current) setGitStatus(null);
		}
	}, [project]);

	useEffect(() => {
		mountedRef.current = true;
		fetchGitStatus();

		// Poll every 30s
		if (intervalRef.current) clearInterval(intervalRef.current);
		intervalRef.current = setInterval(fetchGitStatus, 30000);

		return () => {
			mountedRef.current = false;
			if (intervalRef.current) clearInterval(intervalRef.current);
		};
	}, [fetchGitStatus]);

	// Get app version
	useEffect(() => {
		window.connexio.app.getVersion().then((v: string) => setAppVersion(v));
	}, []);

	const handleCopyPath = useCallback(() => {
		if (!project) return;
		navigator.clipboard.writeText(project.path);
		setPathCopied(true);
		setTimeout(() => setPathCopied(false), 2000);
	}, [project]);

	// Terminal info
	const tabs = activeProjectId ? workspaceTabs[activeProjectId] || [] : [];
	const activeTabId = activeProjectId
		? activeTabIds[activeProjectId] || null
		: null;
	const activeTab = tabs.find((t) => t.id === activeTabId);

	// Git summary
	const changesCount = gitStatus
		? gitStatus.modified + gitStatus.staged + gitStatus.untracked
		: 0;

	return (
		<div className="flex items-center h-[22px] px-3 bg-connexio-bg-secondary border-t border-connexio-border text-[10px] select-none gap-3">
			{/* Left: Project */}
			{project && (
				<button
					onClick={handleCopyPath}
					className="flex items-center gap-1 text-connexio-text-muted hover:text-connexio-text-secondary transition-colors truncate max-w-[180px]"
					title={pathCopied ? "Copied!" : `Click to copy: ${project.path}`}
					type="button"
				>
					<span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
					<span className="truncate">{project.name}</span>
				</button>
			)}

			{/* Git status */}
			{gitStatus?.isRepo && (
				<div className="flex items-center gap-1.5 text-connexio-text-muted">
					<GitBranch size={9} className="text-connexio-accent" />
					<span className="text-connexio-text-secondary">
						{gitStatus.branch}
					</span>
					{(gitStatus.ahead > 0 || gitStatus.behind > 0) && (
						<span className="flex items-center gap-0.5">
							{gitStatus.ahead > 0 && (
								<span className="flex items-center gap-0 text-green-400">
									<ArrowUp size={8} />
									{gitStatus.ahead}
								</span>
							)}
							{gitStatus.behind > 0 && (
								<span className="flex items-center gap-0 text-yellow-400">
									<ArrowDown size={8} />
									{gitStatus.behind}
								</span>
							)}
						</span>
					)}
					{changesCount > 0 && (
						<span className="text-connexio-text-muted">
							· {changesCount} change{changesCount !== 1 ? "s" : ""}
						</span>
					)}
					{gitStatus.conflicted > 0 && (
						<span className="flex items-center gap-0.5 text-red-400">
							<AlertCircle size={8} />
							{gitStatus.conflicted}
						</span>
					)}
				</div>
			)}

			{/* Terminal info */}
			{activeTab && (
				<div className="flex items-center gap-1 text-connexio-text-muted">
					<Terminal size={9} />
					<span className="truncate max-w-[100px]">{activeTab.label}</span>
					{tabs.length > 1 && (
						<span className="text-connexio-text-muted/60">
							· {tabs.length} tabs
						</span>
					)}
				</div>
			)}

			{/* Spacer */}
			<div className="flex-1" />

			{/* Notifications */}
			{unreadCount > 0 && (
				<div className="flex items-center gap-1 text-connexio-accent">
					<Bell size={9} />
					<span>{unreadCount}</span>
				</div>
			)}

			{/* Version */}
			{appVersion && (
				<span className="text-connexio-text-muted/60">v{appVersion}</span>
			)}
		</div>
	);
}
