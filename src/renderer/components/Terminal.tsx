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

export default function Terminal({ terminalId }: Props) {
	const containerRef = useRef<HTMLDivElement>(null);
	const xtermRef = useRef<XTerm | null>(null);
	const fitAddonRef = useRef<FitAddon | null>(null);
	const { currentTheme } = useThemeStore();
	const { settings } = useSettingsStore();

	// Effect: create and manage terminal instance
	useEffect(() => {
		if (!containerRef.current) return;

		const xterm = new XTerm({
			fontSize: settings?.fontSize || 13,
			fontFamily:
				settings?.fontFamily ||
				"'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace",
			cursorBlink: settings?.cursorBlink ?? true,
			cursorStyle: settings?.cursorStyle || "bar",
			scrollback: settings?.scrollback || 5000,
			allowProposedApi: true,
			theme: currentTheme ? buildXtermTheme(currentTheme.terminal) : undefined,
		});

		const fitAddon = new FitAddon();
		xterm.loadAddon(fitAddon);
		xterm.loadAddon(new WebLinksAddon());

		xterm.open(containerRef.current);
		fitAddon.fit();

		xtermRef.current = xterm;
		fitAddonRef.current = fitAddon;

		// Copy on select
		const selectionDisposable = xterm.onSelectionChange(() => {
			const currentSettings = useSettingsStore.getState().settings;
			if (currentSettings?.copyOnSelect) {
				const selection = xterm.getSelection();
				if (selection) {
					navigator.clipboard.writeText(selection).catch(() => {});
				}
			}
		});

		// Send input to backend
		const dataDisposable = xterm.onData((data) => {
			window.connexio.terminal.write(terminalId, data);
		});

		// Receive output from backend
		const unsubscribe = window.connexio.terminal.onData(
			(id: string, data: string) => {
				if (id === terminalId) {
					xterm.write(data);
				}
			},
		);

		// Safe fit: only resize when container is visible and has dimensions
		const safeFit = () => {
			try {
				const el = containerRef.current;
				if (!el || el.offsetWidth === 0 || el.offsetHeight === 0) return;
				fitAddon.fit();
				const dims = fitAddon.proposeDimensions();
				if (dims && dims.cols > 0 && dims.rows > 0) {
					window.connexio.terminal.resize(terminalId, dims.cols, dims.rows);
				}
			} catch (_e) {
				// ignore resize errors during disposal or hidden state
			}
		};

		// Resize handling
		const resizeObserver = new ResizeObserver(() => safeFit());
		resizeObserver.observe(containerRef.current);

		// Initial resize after DOM settles
		const resizeTimer = setTimeout(safeFit, 100);

		return () => {
			clearTimeout(resizeTimer);
			selectionDisposable.dispose();
			dataDisposable.dispose();
			unsubscribe();
			resizeObserver.disconnect();
			xterm.dispose();
			xtermRef.current = null;
			fitAddonRef.current = null;
		};
	}, [terminalId]);

	// Effect: update theme dynamically without recreating terminal
	useEffect(() => {
		if (xtermRef.current && currentTheme) {
			xtermRef.current.options.theme = buildXtermTheme(currentTheme.terminal);
		}
	}, [currentTheme]);

	// Effect: update settings dynamically
	useEffect(() => {
		if (xtermRef.current && settings) {
			xtermRef.current.options.fontSize = settings.fontSize;
			xtermRef.current.options.fontFamily = settings.fontFamily;
			xtermRef.current.options.cursorBlink = settings.cursorBlink;
			xtermRef.current.options.cursorStyle = settings.cursorStyle;
			xtermRef.current.options.scrollback = settings.scrollback;
			// Re-fit after font change — only if visible
			const el = containerRef.current;
			if (
				fitAddonRef.current &&
				el &&
				el.offsetWidth > 0 &&
				el.offsetHeight > 0
			) {
				try {
					fitAddonRef.current.fit();
				} catch (_e) {
					// ignore
				}
			}
		}
	}, [settings]);

	return (
		<div
			ref={containerRef}
			className="terminal-container w-full h-full bg-connexio-bg"
		/>
	);
}
