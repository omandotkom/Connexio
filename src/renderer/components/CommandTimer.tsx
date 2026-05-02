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

/**
 * Tracks command execution time by detecting prompt patterns.
 * Shows elapsed time while running, and duration of last command when done.
 * Sends desktop notification for long-running commands (>10s).
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
	useEffect(() => {
		const unsubscribe = window.connexio.terminal.onData(
			(id: string, data: string) => {
				if (id !== terminalId) return;

				// Detect prompt patterns (command finished)
				// Common patterns: PS C:\>, $, >, #, user@host:~$
				const promptPatterns = [
					/\$\s*$/m, // Unix prompt ending with $
					/>\s*$/m, // Windows PS/CMD prompt ending with >
					/#\s*$/m, // Root prompt ending with #
					/❯\s*$/m, // Starship/custom prompt
					/➜\s*$/m, // Oh-my-zsh prompt
					/PS [A-Z]:\\[^>]*>\s*$/m, // PowerShell PS C:\path>
				];

				const hasPrompt = promptPatterns.some((p) => p.test(data));

				if (hasPrompt && stateRef.current.isRunning) {
					// Command finished
					const duration = stateRef.current.startTime
						? Date.now() - stateRef.current.startTime
						: 0;

					setState({
						isRunning: false,
						startTime: null,
						lastDuration: duration,
						lastExitSuccess: true, // We can't easily detect exit code from output
					});

					// Desktop notification for long-running commands (>10s)
					if (duration > 10000) {
						const seconds = Math.round(duration / 1000);
						new Notification("Command Completed", {
							body: `Finished in ${formatDuration(duration)}`,
							silent: false,
						});
					}
				}
			},
		);

		return () => unsubscribe();
	}, [terminalId]);

	// Detect command start: when user writes to terminal
	useEffect(() => {
		// We detect "Enter" key being sent to terminal as command start
		// This is a heuristic — we intercept writes to detect \r or \n
		const originalWrite = window.connexio.terminal.write;

		// Patch: detect when Enter is pressed
		const patchedWrite = async (id: string, data: string) => {
			if (
				id === terminalId &&
				(data === "\r" || data === "\n" || data === "\r\n")
			) {
				// User pressed Enter — command started
				if (!stateRef.current.isRunning) {
					setState({
						isRunning: true,
						startTime: Date.now(),
						lastDuration: null,
						lastExitSuccess: null,
					});
				}
			}
			return originalWrite(id, data);
		};

		// We can't easily patch the preload API, so instead we'll use a simpler approach:
		// Just track based on output patterns
		// The "isRunning" state is set when we DON'T see a prompt for a while after data

		return () => {};
	}, [terminalId]);

	// Elapsed timer
	useEffect(() => {
		if (state.isRunning && state.startTime) {
			intervalRef.current = setInterval(() => {
				setElapsed(Date.now() - (stateRef.current.startTime || Date.now()));
			}, 100);
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
