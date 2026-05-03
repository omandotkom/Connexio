import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Terminal as XTerm } from "@xterm/xterm";
import { useEffect, useRef } from "react";
import type { TerminalThemeColors } from "../../shared/types";
import { useSettingsStore } from "../stores/settingsStore";
import { useThemeStore } from "../stores/themeStore";
import "@xterm/xterm/css/xterm.css";

interface Props {
	terminalId: string;
	isVisible?: boolean;
}

function buildXtermTheme(terminal: TerminalThemeColors) {
	return {
		background: terminal.background,
		foreground: terminal.foreground,
		cursor: terminal.cursor,
		cursorAccent: terminal.cursorAccent,
		selectionBackground: terminal.selectionBackground,
		black: terminal.black,
		red: terminal.red,
		green: terminal.green,
		yellow: terminal.yellow,
		blue: terminal.blue,
		magenta: terminal.magenta,
		cyan: terminal.cyan,
		white: terminal.white,
		brightBlack: terminal.brightBlack,
		brightRed: terminal.brightRed,
		brightGreen: terminal.brightGreen,
		brightYellow: terminal.brightYellow,
		brightBlue: terminal.brightBlue,
		brightMagenta: terminal.brightMagenta,
		brightCyan: terminal.brightCyan,
		brightWhite: terminal.brightWhite,
	};
}

export default function Terminal({ terminalId, isVisible }: Props) {
	const containerRef = useRef<HTMLDivElement>(null);
	const xtermRef = useRef<XTerm | null>(null);
	const fitAddonRef = useRef<FitAddon | null>(null);
	// Global disposed flag — checked by ALL operations on this terminal
	const disposedRef = useRef(false);
	const { currentTheme } = useThemeStore();
	const { settings } = useSettingsStore();

	// Safe wrapper: only call xterm/fitAddon if not disposed
	const safeFit = () => {
		if (disposedRef.current) return;
		try {
			const el = containerRef.current;
			if (!el || el.offsetWidth === 0 || el.offsetHeight === 0) return;
			const fitAddon = fitAddonRef.current;
			if (!fitAddon) return;
			fitAddon.fit();
			const dims = fitAddon.proposeDimensions();
			if (dims && dims.cols > 0 && dims.rows > 0) {
				window.connexio.terminal.resize(terminalId, dims.cols, dims.rows);
			}
		} catch (_e) {
			// ignore — terminal may be mid-dispose
		}
	};

	// Effect: create and manage terminal instance
	useEffect(() => {
		if (!containerRef.current) return;

		disposedRef.current = false;

		const xterm = new XTerm({
			fontSize: settings?.fontSize || 13,
			fontFamily:
				settings?.fontFamily ||
				"'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace",
			cursorBlink: settings?.cursorBlink ?? true,
			cursorStyle: settings?.cursorStyle || "bar",
			scrollback: settings?.scrollback || 2000,
			allowProposedApi: true,
			theme: currentTheme ? buildXtermTheme(currentTheme.terminal) : undefined,
			letterSpacing: 0,
			convertEol: false,
			altClickMovesCursor: true,
			fastScrollModifier: "alt",
			fastScrollSensitivity: 5,
		});

		const fitAddon = new FitAddon();
		xterm.loadAddon(fitAddon);
		xterm.loadAddon(new WebLinksAddon());

		xterm.open(containerRef.current);

		xtermRef.current = xterm;
		fitAddonRef.current = fitAddon;

		// --- Write batcher ---
		let writeBuffer = "";
		let writeRafId: number | null = null;
		let writeTimeoutId: ReturnType<typeof setTimeout> | null = null;

		const flushWrites = () => {
			writeRafId = null;
			if (writeTimeoutId !== null) {
				clearTimeout(writeTimeoutId);
				writeTimeoutId = null;
			}
			if (disposedRef.current || writeBuffer.length === 0) {
				writeBuffer = "";
				return;
			}
			const data = writeBuffer;
			writeBuffer = "";
			try {
				xterm.write(data);
			} catch (_e) {
				// terminal disposed mid-flush
			}
		};

		const batchWrite = (data: string) => {
			if (disposedRef.current) return;
			writeBuffer += data;
			if (writeRafId === null) {
				writeRafId = requestAnimationFrame(flushWrites);
			}
			if (writeTimeoutId === null) {
				writeTimeoutId = setTimeout(flushWrites, 8);
			}
		};

		// --- Event listeners ---
		const selectionDisposable = xterm.onSelectionChange(() => {
			if (disposedRef.current) return;
			const currentSettings = useSettingsStore.getState().settings;
			if (currentSettings?.copyOnSelect) {
				const selection = xterm.getSelection();
				if (selection) {
					navigator.clipboard.writeText(selection).catch(() => {});
				}
			}
		});

		const dataDisposable = xterm.onData((data) => {
			if (disposedRef.current) return;
			window.connexio.terminal.write(terminalId, data);
		});

		const unsubscribe = window.connexio.terminal.onData(
			(id: string, data: string) => {
				if (id === terminalId) {
					batchWrite(data);
				}
			},
		);

		// --- Resize ---
		let resizeTimer: ReturnType<typeof setTimeout> | null = null;
		const debouncedFit = () => {
			if (disposedRef.current) return;
			if (resizeTimer !== null) clearTimeout(resizeTimer);
			resizeTimer = setTimeout(() => {
				resizeTimer = null;
				safeFit();
			}, 100);
		};

		const resizeObserver = new ResizeObserver(() => debouncedFit());
		resizeObserver.observe(containerRef.current);

		const initTimer1 = setTimeout(safeFit, 50);
		const initTimer2 = setTimeout(safeFit, 200);
		const initTimer3 = setTimeout(safeFit, 500);

		// --- Cleanup ---
		return () => {
			// 1. Set disposed flag FIRST — stops all async operations immediately
			disposedRef.current = true;

			// 2. Cancel all pending timers
			clearTimeout(initTimer1);
			clearTimeout(initTimer2);
			clearTimeout(initTimer3);
			if (resizeTimer !== null) clearTimeout(resizeTimer);
			if (writeRafId !== null) cancelAnimationFrame(writeRafId);
			if (writeTimeoutId !== null) clearTimeout(writeTimeoutId);
			writeBuffer = "";

			// 3. Remove IPC listener (stops data flow from backend)
			unsubscribe();

			// 4. Remove xterm event listeners
			selectionDisposable.dispose();
			dataDisposable.dispose();

			// 5. Disconnect resize observer
			resizeObserver.disconnect();

			// 6. Finally dispose xterm (after everything else is cleaned up)
			try {
				xterm.dispose();
			} catch (_e) {
				// ignore
			}
			xtermRef.current = null;
			fitAddonRef.current = null;
		};
	}, [terminalId]);

	// Effect: update theme
	useEffect(() => {
		if (disposedRef.current || !xtermRef.current || !currentTheme) return;
		try {
			xtermRef.current.options.theme = buildXtermTheme(currentTheme.terminal);
		} catch (_e) {
			// ignore
		}
	}, [currentTheme]);

	// Effect: re-fit when terminal becomes visible
	useEffect(() => {
		if (!isVisible || disposedRef.current) return;
		if (!xtermRef.current || !fitAddonRef.current) return;

		const timer = setTimeout(() => {
			safeFit();
			try {
				xtermRef.current?.focus();
			} catch (_e) {
				// ignore
			}
		}, 50);

		return () => clearTimeout(timer);
	}, [isVisible, terminalId]);

	// Effect: update settings
	useEffect(() => {
		if (disposedRef.current || !xtermRef.current || !settings) return;
		try {
			xtermRef.current.options.fontSize = settings.fontSize;
			xtermRef.current.options.fontFamily = settings.fontFamily;
			xtermRef.current.options.cursorBlink = settings.cursorBlink;
			xtermRef.current.options.cursorStyle = settings.cursorStyle;
			xtermRef.current.options.scrollback = settings.scrollback;
			safeFit();
		} catch (_e) {
			// ignore
		}
	}, [settings]);

	return (
		<div
			ref={containerRef}
			className="terminal-container w-full h-full bg-connexio-bg"
		/>
	);
}
