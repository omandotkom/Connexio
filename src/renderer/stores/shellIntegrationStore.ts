import { create } from "zustand";

interface TerminalState {
	cwd: string | null;
	lastCommand: string | null;
	isIdle: boolean;
}

interface ShellIntegrationStore {
	// Per-terminal state
	terminals: Record<string, TerminalState>;

	// Actions
	setCwd: (terminalId: string, cwd: string) => void;
	setIdle: (terminalId: string, idle: boolean) => void;
	setLastCommand: (terminalId: string, command: string) => void;
	getCwd: (terminalId: string) => string | null;
	removeTerminal: (terminalId: string) => void;
}

export const useShellIntegrationStore = create<ShellIntegrationStore>(
	(set, get) => ({
		terminals: {},

		setCwd: (terminalId, cwd) => {
			set((state) => ({
				terminals: {
					...state.terminals,
					[terminalId]: {
						...state.terminals[terminalId],
						cwd,
						isIdle: state.terminals[terminalId]?.isIdle ?? true,
						lastCommand: state.terminals[terminalId]?.lastCommand ?? null,
					},
				},
			}));
		},

		setIdle: (terminalId, idle) => {
			set((state) => ({
				terminals: {
					...state.terminals,
					[terminalId]: {
						...state.terminals[terminalId],
						cwd: state.terminals[terminalId]?.cwd ?? null,
						lastCommand: state.terminals[terminalId]?.lastCommand ?? null,
						isIdle: idle,
					},
				},
			}));
		},

		setLastCommand: (terminalId, command) => {
			set((state) => ({
				terminals: {
					...state.terminals,
					[terminalId]: {
						...state.terminals[terminalId],
						cwd: state.terminals[terminalId]?.cwd ?? null,
						isIdle: false,
						lastCommand: command,
					},
				},
			}));
		},

		getCwd: (terminalId) => {
			return get().terminals[terminalId]?.cwd ?? null;
		},

		removeTerminal: (terminalId) => {
			set((state) => {
				const { [terminalId]: _, ...rest } = state.terminals;
				return { terminals: rest };
			});
		},
	}),
);

/**
 * Parse OSC sequences from terminal data.
 * 
 * OSC 7: Current working directory
 *   Format: \x1b]7;file:///path/to/dir\x07
 * 
 * OSC 133: Command prompt markers (FinalTerm/iTerm2 shell integration)
 *   \x1b]133;A\x07 — Prompt start
 *   \x1b]133;B\x07 — Command start (user pressed Enter)
 *   \x1b]133;C\x07 — Command output start
 *   \x1b]133;D;exitcode\x07 — Command finished
 */
export function parseOscSequences(
	data: string,
	terminalId: string,
	store: ShellIntegrationStore,
) {
	// OSC 7: CWD reporting
	// Matches: \x1b]7;file:///C:/path or \x1b]7;file:///home/user/path
	const osc7Regex = /\x1b\]7;file:\/\/[^/]*([^\x07\x1b]*)\x07/g;
	let match: RegExpExecArray | null;
	while ((match = osc7Regex.exec(data)) !== null) {
		let cwd = decodeURIComponent(match[1]);
		// On Windows, path starts with /C:/ — remove leading slash
		if (/^\/[A-Za-z]:/.test(cwd)) {
			cwd = cwd.substring(1);
		}
		store.setCwd(terminalId, cwd);
	}

	// OSC 133;B — Command started (user pressed Enter)
	if (data.includes("\x1b]133;B\x07") || data.includes("\x1b]133;B\x1b\\")) {
		store.setIdle(terminalId, false);
	}

	// OSC 133;D — Command finished
	const osc133d = /\x1b\]133;D(?:;(\d+))?\x07/;
	if (osc133d.test(data)) {
		store.setIdle(terminalId, true);
	}
}
