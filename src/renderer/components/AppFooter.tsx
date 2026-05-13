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

		if (intervalRef.current) clearInterval(intervalRef.current);
		intervalRef.current = setInterval(fetchGitStatus, 30000);

		return () => {
			mountedRef.current = false;
			if (intervalRef.current) clearInterval(intervalRef.current);
		};
	}, [fetchGitStatus]);

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
		<div className="flex items-center h-[32px] px-2.5 bg-connexio-bg-secondary border-t border-connexio-border text-[12px] select-none gap-2.5">
			{/* Project segment */}
			{project && (
				<button
					onClick={handleCopyPath}
					className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-connexio-bg-tertiary hover:bg-connexio-accent/10 transition-colors truncate max-w-[200px]"
					title={pathCopied ? "Path copied!" : `Click to copy: ${project.path}`}
					type="button"
				>
					<span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
					<span className="truncate font-medium text-connexio-text-secondary">
						{pathCopied ? "Copied!" : project.name}
					</span>
				</button>
			)}

			{/* Separator */}
			{project && gitStatus?.isRepo && (
				<div className="w-px h-3.5 bg-connexio-border" />
			)}

			{/* Git segment */}
			{gitStatus?.isRepo && (
				<div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-connexio-bg-tertiary">
					<GitBranch size={11} className="text-connexio-accent flex-shrink-0" />
					<span className="font-medium text-connexio-text-secondary">
						{gitStatus.branch}
					</span>
					{(gitStatus.ahead > 0 || gitStatus.behind > 0) && (
						<span className="flex items-center gap-1">
							{gitStatus.ahead > 0 && (
								<span className="flex items-center gap-0 text-green-400 font-medium">
									<ArrowUp size={10} />
									{gitStatus.ahead}
								</span>
							)}
							{gitStatus.behind > 0 && (
								<span className="flex items-center gap-0 text-yellow-400 font-medium">
									<ArrowDown size={10} />
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
						<span className="flex items-center gap-0.5 text-red-400 font-medium">
							<AlertCircle size={10} />
							{gitStatus.conflicted}
						</span>
					)}
				</div>
			)}

			{/* Separator */}
			{activeTab && (
				<div className="w-px h-3.5 bg-connexio-border" />
			)}

			{/* Terminal segment */}
			{activeTab && (
				<div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-connexio-bg-tertiary text-connexio-text-muted">
					<Terminal size={11} className="flex-shrink-0" />
					<span className="truncate max-w-[120px]">{activeTab.label}</span>
					{tabs.length > 1 && (
						<span className="text-connexio-text-muted/60">
							· {tabs.length} tabs
						</span>
					)}
				</div>
			)}

			{/* Spacer */}
			<div className="flex-1" />

			{/* Notifications segment */}
			{unreadCount > 0 && (
				<div className="flex items-center gap-1 px-2 py-0.5 rounded bg-connexio-accent/10 text-connexio-accent font-medium">
					<Bell size={11} />
					<span>{unreadCount} new</span>
				</div>
			)}

			{/* Separator */}
			{appVersion && (
				<div className="w-px h-3.5 bg-connexio-border" />
			)}

			{/* Version */}
			{appVersion && (
				<span className="px-1.5 py-0.5 rounded bg-connexio-bg-tertiary text-connexio-text-muted">
					v{appVersion}
				</span>
			)}
		</div>
	);
}
