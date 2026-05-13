import { ArrowUp, GitCommit, Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import type { GitActionResult } from "../../../shared/types";

interface Props {
	projectPath: string;
	stagedCount: number;
	onMessage: (msg: { type: "success" | "error" | "info"; text: string }) => void;
	onRefresh: () => void;
}

export default function CommitBox({
	projectPath,
	stagedCount,
	onMessage,
	onRefresh,
}: Props) {
	const [commitMessage, setCommitMessage] = useState("");
	const [isCommitting, setIsCommitting] = useState(false);
	const [isPushing, setIsPushing] = useState(false);

	const canCommit = stagedCount > 0 && commitMessage.trim().length > 0 && !isCommitting && !isPushing;

	const handleCommit = useCallback(async () => {
		if (!canCommit) return;
		setIsCommitting(true);
		try {
			const result: GitActionResult = await window.connexio.git.commit(
				projectPath,
				commitMessage.trim(),
			);
			if (result.success) {
				onMessage({ type: "success", text: result.message });
				setCommitMessage("");
				onRefresh();
			} else {
				onMessage({ type: "error", text: result.message });
			}
		} catch {
			onMessage({ type: "error", text: "Commit failed unexpectedly" });
		}
		setIsCommitting(false);
	}, [canCommit, projectPath, commitMessage, onMessage, onRefresh]);

	const handleCommitAndPush = useCallback(async () => {
		if (!canCommit) return;
		setIsCommitting(true);
		try {
			const commitResult: GitActionResult = await window.connexio.git.commit(
				projectPath,
				commitMessage.trim(),
			);
			if (!commitResult.success) {
				onMessage({ type: "error", text: commitResult.message });
				setIsCommitting(false);
				return;
			}
			setIsCommitting(false);
			setIsPushing(true);
			const pushResult: GitActionResult = await window.connexio.git.push(projectPath);
			if (pushResult.success) {
				onMessage({ type: "success", text: "Committed and pushed" });
				setCommitMessage("");
				onRefresh();
			} else {
				onMessage({ type: "error", text: pushResult.message });
				onRefresh(); // commit succeeded, refresh anyway
			}
		} catch {
			onMessage({ type: "error", text: "Commit & push failed unexpectedly" });
		}
		setIsCommitting(false);
		setIsPushing(false);
	}, [canCommit, projectPath, commitMessage, onMessage, onRefresh]);

	const handlePush = useCallback(async () => {
		if (isPushing || isCommitting) return;
		setIsPushing(true);
		try {
			const result: GitActionResult = await window.connexio.git.push(projectPath);
			if (result.success) {
				onMessage({ type: "success", text: result.message });
				onRefresh();
			} else {
				onMessage({ type: "error", text: result.message });
			}
		} catch {
			onMessage({ type: "error", text: "Push failed unexpectedly" });
		}
		setIsPushing(false);
	}, [isPushing, isCommitting, projectPath, onMessage, onRefresh]);

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		// Ctrl/Cmd + Enter to commit
		if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
			e.preventDefault();
			handleCommit();
		}
	};

	return (
		<div className="px-3 py-2 border-b border-connexio-border space-y-2">
			{/* Commit message */}
			<textarea
				value={commitMessage}
				onChange={(e) => setCommitMessage(e.target.value)}
				onKeyDown={handleKeyDown}
				placeholder={
					stagedCount > 0
						? "Commit message (Ctrl+Enter to commit)"
						: "Stage changes before committing"
				}
				className="w-full bg-connexio-bg-tertiary border border-connexio-border rounded px-2 py-1.5 text-[11px] text-connexio-text placeholder:text-connexio-text-muted/50 outline-none focus:border-connexio-accent/50 resize-none transition-colors"
				rows={2}
				disabled={isCommitting || isPushing}
			/>

			{/* Action buttons */}
			<div className="flex items-center gap-1.5">
				<button
					onClick={handleCommit}
					disabled={!canCommit}
					className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded border border-connexio-accent/40 text-connexio-accent hover:bg-connexio-accent/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
					title={
						stagedCount === 0
							? "No staged changes"
							: !commitMessage.trim()
								? "Enter a commit message"
								: "Commit staged changes (Ctrl+Enter)"
					}
					type="button"
				>
					{isCommitting ? (
						<Loader2 size={10} className="animate-spin" />
					) : (
						<GitCommit size={10} />
					)}
					Commit
				</button>

				<button
					onClick={handleCommitAndPush}
					disabled={!canCommit}
					className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded border border-green-400/40 text-green-400 hover:bg-green-400/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
					title="Commit and push"
					type="button"
				>
					{isCommitting || isPushing ? (
						<Loader2 size={10} className="animate-spin" />
					) : (
						<>
							<GitCommit size={9} />
							<ArrowUp size={9} />
						</>
					)}
					Commit & Push
				</button>

				<button
					onClick={handlePush}
					disabled={isPushing || isCommitting}
					className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded border border-connexio-border text-connexio-text-muted hover:border-connexio-text-muted/50 hover:text-connexio-text-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors ml-auto"
					title="Push to remote"
					type="button"
				>
					{isPushing ? (
						<Loader2 size={10} className="animate-spin" />
					) : (
						<ArrowUp size={10} />
					)}
					Push
				</button>
			</div>
		</div>
	);
}
