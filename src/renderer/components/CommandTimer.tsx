import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface CommandTimerState {
	isRunning: boolean;
	startTime: number | null;
	lastDuration: number | null;
	lastExitSuccess: boolean | null;
}

interface Props {
	terminalId: string;
}

// Shared prompt detection — compiled once, not per-chunk
const PROMPT_REGEX = /(?:\$|>|#|❯|➜)\s*$|PS [A-Z]:\\[^>]*>\s*$/m;

/**
 * Tracks command execution time by detecting prompt patterns.
 * Shows elapsed time while running, and duration of last command when done.
 * Sends desktop notification for long-running commands (>10s).
 *
 * Performance: prompt detection is throttled to avoid running regex
 * on every data chunk during heavy AI agent output streaming.
 */
export default function CommandTimer({ terminalId }: Props) {
	const [state, setState] = useState<CommandTimerState>({
		isRunning: false,
		startTime: null,
		lastDuration: null,
		lastExitSuccess: null,
	});
	const [elapsed, setElapsed] = useState(0);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const stateRef = useRef(state);
	stateRef.current = state;

	// Listen to terminal data to detect command start/end
	// Throttled: only check the LAST chunk received within a 500ms window
	useEffect(() => {
		let lastData = "";
		let checkTimer: ReturnType<typeof setTimeout> | null = null;
		let sawPrompt = false;

		const checkPrompt = () => {
			checkTimer = null;

			const hasPrompt = PROMPT_REGEX.test(lastData);

			if (hasPrompt && stateRef.current.isRunning) {
				// Command finished — prompt appeared
				const duration = stateRef.current.startTime
					? Date.now() - stateRef.current.startTime
					: 0;

				setState({
					isRunning: false,
					startTime: null,
					lastDuration: duration,
					lastExitSuccess: true,
				});

				// Desktop notification for long-running commands (>10s)
				if (duration > 10000) {
					new Notification("Command Completed", {
						body: `Finished in ${formatDuration(duration)}`,
						silent: false,
					});
				}
				sawPrompt = true;
			} else if (hasPrompt) {
				// Prompt visible, not running — ready for next command
				sawPrompt = true;
			} else if (sawPrompt && !stateRef.current.isRunning) {
				// Output appeared after prompt was shown — command started
				sawPrompt = false;
				setState({
					isRunning: true,
					startTime: Date.now(),
					lastDuration: null,
					lastExitSuccess: null,
				});
			}

			lastData = "";
		};

		const unsubscribe = window.connexio.terminal.onData(
			(id: string, data: string) => {
				if (id !== terminalId) return;

				// Buffer the last chunk — only run regex after 500ms idle
				lastData = data;
				if (checkTimer !== null) {
					clearTimeout(checkTimer);
				}
				checkTimer = setTimeout(checkPrompt, 500);
			},
		);

		return () => {
			unsubscribe();
			if (checkTimer !== null) clearTimeout(checkTimer);
		};
	}, [terminalId]);

	// Elapsed timer — update every second instead of every 100ms
	useEffect(() => {
		if (state.isRunning && state.startTime) {
			intervalRef.current = setInterval(() => {
				setElapsed(Date.now() - (stateRef.current.startTime || Date.now()));
			}, 1000);
		} else {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
			setElapsed(0);
		}

		return () => {
			if (intervalRef.current) clearInterval(intervalRef.current);
		};
	}, [state.isRunning, state.startTime]);

	// Don't render if nothing to show
	if (!state.isRunning && state.lastDuration === null) return null;

	return (
		<div className="flex items-center gap-1.5 px-2 py-0.5">
			{state.isRunning ? (
				<>
					<Clock size={10} className="text-yellow-400 animate-pulse" />
					<span className="text-[10px] text-yellow-400 font-mono tabular-nums">
						{formatDuration(elapsed)}
					</span>
				</>
			) : state.lastDuration !== null ? (
				<>
					{state.lastExitSuccess ? (
						<CheckCircle2 size={10} className="text-green-400" />
					) : (
						<XCircle size={10} className="text-red-400" />
					)}
					<span className="text-[10px] text-connexio-text-muted font-mono tabular-nums">
						{formatDuration(state.lastDuration)}
					</span>
				</>
			) : null}
		</div>
	);
}

function formatDuration(ms: number): string {
	if (ms < 1000) return `${ms}ms`;
	const seconds = Math.floor(ms / 1000);
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;
	if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
	const hours = Math.floor(minutes / 60);
	const remainingMinutes = minutes % 60;
	return `${hours}h ${remainingMinutes}m`;
}
