import {
	AlertCircle,
	ArrowDown,
	ArrowUp,
	GitBranch,
	GitCommit,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { GitStatus } from "../../shared/types";

interface Props {
	projectPath: string;
}

export default function GitStatusBar({ projectPath }: Props) {
	const [status, setStatus] = useState<GitStatus | null>(null);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const fetchStatus = async () => {
		try {
			const result = await window.connexio.git.status(projectPath);
			setStatus(result);
		} catch {
			setStatus(null);
		}
	};

	useEffect(() => {
		fetchStatus();

		// Poll every 30 seconds (reduced from 5s to save CPU/RAM)
		intervalRef.current = setInterval(fetchStatus, 30000);

		// Also refresh when window regains focus
		const onFocus = () => fetchStatus();
		window.addEventListener("focus", onFocus);

		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
			}
			window.removeEventListener("focus", onFocus);
		};
	}, [projectPath]);

	if (!status || !status.isRepo) return null;

	const hasChanges =
		status.modified + status.staged + status.untracked + status.conflicted > 0;

	return (
		<div className="flex items-center gap-2 ml-auto">
			{/* Branch */}
			<div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-connexio-bg-tertiary">
				<GitBranch size={10} className="text-connexio-accent" />
				<span className="text-[10px] font-medium text-connexio-text-secondary">
					{status.branch}
				</span>
			</div>

			{/* Ahead/Behind */}
			{(status.ahead > 0 || status.behind > 0) && (
				<div className="flex items-center gap-1">
					{status.ahead > 0 && (
						<div className="flex items-center gap-0.5 text-[10px] text-green-400">
							<ArrowUp size={9} />
							<span>{status.ahead}</span>
						</div>
					)}
					{status.behind > 0 && (
						<div className="flex items-center gap-0.5 text-[10px] text-yellow-400">
							<ArrowDown size={9} />
							<span>{status.behind}</span>
						</div>
					)}
				</div>
			)}

			{/* Changes summary */}
			{hasChanges && (
				<div className="flex items-center gap-1.5">
					{status.staged > 0 && (
						<span
							className="text-[10px] text-green-400"
							title={`${status.staged} staged`}
						>
							+{status.staged}
						</span>
					)}
					{status.modified > 0 && (
						<span
							className="text-[10px] text-yellow-400"
							title={`${status.modified} modified`}
						>
							~{status.modified}
						</span>
					)}
					{status.untracked > 0 && (
						<span
							className="text-[10px] text-connexio-text-muted"
							title={`${status.untracked} untracked`}
						>
							?{status.untracked}
						</span>
					)}
					{status.conflicted > 0 && (
						<div
							className="flex items-center gap-0.5 text-[10px] text-red-400"
							title={`${status.conflicted} conflicts`}
						>
							<AlertCircle size={9} />
							<span>{status.conflicted}</span>
						</div>
					)}
				</div>
			)}

			{/* Last commit */}
			{status.lastCommit && (
				<div
					className="flex items-center gap-1 max-w-[150px]"
					title={`${status.lastCommit} (${status.lastCommitTime})`}
				>
					<GitCommit
						size={9}
						className="text-connexio-text-muted flex-shrink-0"
					/>
					<span className="text-[10px] text-connexio-text-muted truncate">
						{status.lastCommitTime}
					</span>
				</div>
			)}
		</div>
	);
}
