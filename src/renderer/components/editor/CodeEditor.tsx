import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { markdown } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { Save, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

// Dark theme matching Connexio
const connexioDarkTheme = EditorView.theme({
	"&": {
		backgroundColor: "#0f1117",
		color: "#e2e8f0",
		height: "100%",
		fontSize: "12px",
	},
	".cm-content": {
		fontFamily: "'JetBrains Mono', 'Cascadia Code', monospace",
		caretColor: "#7c3aed",
	},
	".cm-cursor": { borderLeftColor: "#7c3aed" },
	".cm-activeLine": { backgroundColor: "#1e203020" },
	".cm-activeLineGutter": { backgroundColor: "#1e203040" },
	".cm-gutters": {
		backgroundColor: "#0f1117",
		color: "#64748b",
		border: "none",
		fontFamily: "'JetBrains Mono', monospace",
		fontSize: "11px",
	},
	".cm-scroller": { overflow: "auto" },
	"&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
		backgroundColor: "#7c3aed30",
	},
	".cm-selectionMatch": { backgroundColor: "#7c3aed20" },
}, { dark: true });

interface Props {
	filePath: string;
	onClose: () => void;
}

function getLanguageExtension(filePath: string) {
	const ext = filePath.split(".").pop()?.toLowerCase();
	switch (ext) {
		case "js":
		case "jsx":
			return javascript({ jsx: true });
		case "ts":
		case "tsx":
			return javascript({ jsx: true, typescript: true });
		case "json":
			return json();
		case "html":
		case "htm":
			return html();
		case "css":
		case "scss":
			return css();
		case "md":
		case "mdx":
			return markdown();
		case "py":
			return python();
		case "rs":
			return rust();
		default:
			return javascript();
	}
}

export default function CodeEditor({ filePath, onClose }: Props) {
	const containerRef = useRef<HTMLDivElement>(null);
	const viewRef = useRef<EditorView | null>(null);
	const [isDirty, setIsDirty] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const originalContentRef = useRef("");
	const saveRef = useRef<() => void>(() => {});

	const fileName = filePath.replace(/\\/g, "/").split("/").pop() || "untitled";

	// Save function (ref to avoid stale closure in keymap)
	saveRef.current = async () => {
		if (!viewRef.current || saving) return;
		const content = viewRef.current.state.doc.toString();
		setSaving(true);
		try {
			await invoke("explorer_write_file", { filePath, content });
			originalContentRef.current = content;
			setIsDirty(false);
		} catch (e) {
			setError(String(e));
		}
		setSaving(false);
	};

	// Load file and create editor
	useEffect(() => {
		if (!containerRef.current) return;

		let view: EditorView | null = null;

		invoke<string>("explorer_read_file", { filePath })
			.then((content) => {
				if (!containerRef.current) return;
				originalContentRef.current = content;

				const state = EditorState.create({
					doc: content,
					extensions: [
						lineNumbers(),
						highlightActiveLine(),
						highlightActiveLineGutter(),
						history(),
						keymap.of([
							...defaultKeymap,
							...historyKeymap,
							indentWithTab,
							{
								key: "Mod-s",
								run: () => {
									saveRef.current();
									return true;
								},
							},
						]),
						getLanguageExtension(filePath),
						connexioDarkTheme,
						EditorView.updateListener.of((update) => {
							if (update.docChanged) {
								const current = update.state.doc.toString();
								setIsDirty(current !== originalContentRef.current);
							}
						}),
					],
				});

				view = new EditorView({
					state,
					parent: containerRef.current,
				});
				viewRef.current = view;
			})
			.catch((e) => {
				setError(String(e));
			});

		return () => {
			if (view) {
				view.destroy();
				viewRef.current = null;
			}
		};
	}, [filePath]);

	const handleSave = () => saveRef.current();

	return (
		<div className="flex flex-col h-full">
			{/* Editor header */}
			<div className="flex items-center justify-between px-3 py-1.5 border-b border-connexio-border bg-connexio-bg-secondary">
				<div className="flex items-center gap-2">
					<span className="text-[11px] text-connexio-text font-medium">
						{fileName}
					</span>
					{isDirty && (
						<span className="w-2 h-2 rounded-full bg-connexio-accent" title="Unsaved changes" />
					)}
				</div>
				<div className="flex items-center gap-1">
					<button
						onClick={handleSave}
						disabled={!isDirty || saving}
						className="flex items-center gap-1 px-2 py-0.5 text-[10px] rounded bg-connexio-accent/10 text-connexio-accent hover:bg-connexio-accent/20 disabled:opacity-30 transition-colors"
						title="Save (Ctrl+S)"
						type="button"
					>
						<Save size={10} />
						Save
					</button>
					<button
						onClick={onClose}
						className="p-1 rounded hover:bg-connexio-bg-tertiary transition-colors"
						title="Close editor"
						type="button"
					>
						<X size={12} className="text-connexio-text-muted" />
					</button>
				</div>
			</div>

			{/* Error */}
			{error && (
				<div className="px-3 py-1.5 text-[11px] text-red-400 bg-red-500/10 border-b border-red-500/20">
					{error}
				</div>
			)}

			{/* Editor area */}
			<div ref={containerRef} className="flex-1 overflow-hidden" />
		</div>
	);
}
