import { Bot, Copy, Send, Settings, Trash2, Terminal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAIStore, type AIMessage } from "../../stores/aiStore";
import { useProjectStore } from "../../stores/projectStore";

function MessageBubble({ message }: { message: AIMessage }) {
	const isUser = message.role === "user";

	const handleCopy = () => {
		navigator.clipboard.writeText(message.content).catch(() => {});
	};

	// Simple markdown-like rendering for code blocks
	const renderContent = (content: string) => {
		const parts = content.split(/(```[\s\S]*?```)/g);
		return parts.map((part, i) => {
			if (part.startsWith("```") && part.endsWith("```")) {
				const lines = part.slice(3, -3).split("\n");
				const lang = lines[0]?.trim() || "";
				const code = lang ? lines.slice(1).join("\n") : lines.join("\n");
				return (
					<div key={i} className="my-2 rounded overflow-hidden">
						{lang && (
							<div className="text-[9px] px-2 py-0.5 bg-connexio-bg-tertiary text-connexio-text-muted border-b border-connexio-border">
								{lang}
							</div>
						)}
						<pre className="text-[11px] p-2 bg-connexio-bg overflow-x-auto">
							<code>{code}</code>
						</pre>
					</div>
				);
			}
			// Inline code
			const inlineParts = part.split(/(`[^`]+`)/g);
			return (
				<span key={i}>
					{inlineParts.map((ip, j) => {
						if (ip.startsWith("`") && ip.endsWith("`")) {
							return (
								<code
									key={j}
									className="text-[11px] px-1 py-0.5 bg-connexio-bg-tertiary rounded text-connexio-accent"
								>
									{ip.slice(1, -1)}
								</code>
							);
						}
						return <span key={j}>{ip}</span>;
					})}
				</span>
			);
		});
	};

	return (
		<div className={`flex gap-2 px-3 py-2 ${isUser ? "" : "bg-connexio-bg-secondary/50"}`}>
			<div className="flex-shrink-0 mt-0.5">
				{isUser ? (
					<div className="w-5 h-5 rounded bg-connexio-accent/20 flex items-center justify-center">
						<span className="text-[9px] font-bold text-connexio-accent">U</span>
					</div>
				) : (
					<div className="w-5 h-5 rounded bg-blue-500/20 flex items-center justify-center">
						<Bot size={11} className="text-blue-400" />
					</div>
				)}
			</div>
			<div className="flex-1 min-w-0">
				<div className="text-[12px] text-connexio-text leading-relaxed whitespace-pre-wrap break-words">
					{message.isStreaming && !message.content ? (
						<span className="text-connexio-text-muted animate-pulse">Thinking...</span>
					) : (
						renderContent(message.content)
					)}
				</div>
				{!isUser && message.content && !message.isStreaming && (
					<button
						onClick={handleCopy}
						className="mt-1 p-0.5 rounded hover:bg-connexio-bg-tertiary transition-colors"
						title="Copy response"
						type="button"
					>
						<Copy size={10} className="text-connexio-text-muted" />
					</button>
				)}
			</div>
		</div>
	);
}

export default function AIChatPanel() {
	const { messages, isLoading, sendMessage, clearMessages, config, setConfig } =
		useAIStore();
	const { activeProjectId, workspaceTabs, activeTabIds } = useProjectStore();
	const [input, setInput] = useState("");
	const [showSettings, setShowSettings] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLTextAreaElement>(null);

	// Auto-scroll to bottom
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	const handleSend = () => {
		const trimmed = input.trim();
		if (!trimmed || isLoading) return;
		setInput("");
		sendMessage(trimmed);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	};

	// Run command in active terminal
	const handleRunInTerminal = (command: string) => {
		if (!activeProjectId) return;
		const tabs = workspaceTabs[activeProjectId] || [];
		const activeTabId = activeTabIds[activeProjectId];
		const activeTab = tabs.find((t) => t.id === activeTabId);
		if (activeTab?.terminalId) {
			window.connexio.terminal.write(activeTab.terminalId, `${command}\r`);
		}
	};

	if (showSettings) {
		return <AISettingsPanel onBack={() => setShowSettings(false)} />;
	}

	return (
		<div className="flex flex-col h-full">
			{/* Header */}
			<div className="flex items-center justify-between px-3 py-2 border-b border-connexio-border">
				<div className="flex items-center gap-1.5">
					<Bot size={12} className="text-connexio-accent" />
					<span className="text-[10px] font-semibold uppercase tracking-wider text-connexio-text-muted">
						AI Chat
					</span>
					<span className="text-[9px] text-connexio-text-muted px-1 py-0.5 bg-connexio-bg-tertiary rounded">
						{config.provider}/{config.model.split("/").pop()?.slice(0, 12)}
					</span>
				</div>
				<div className="flex items-center gap-0.5">
					<button
						onClick={clearMessages}
						className="p-1 rounded hover:bg-connexio-bg-tertiary transition-colors"
						title="Clear chat"
						type="button"
					>
						<Trash2 size={11} className="text-connexio-text-muted" />
					</button>
					<button
						onClick={() => setShowSettings(true)}
						className="p-1 rounded hover:bg-connexio-bg-tertiary transition-colors"
						title="AI Settings"
						type="button"
					>
						<Settings size={11} className="text-connexio-text-muted" />
					</button>
				</div>
			</div>

			{/* Messages */}
			<div className="flex-1 overflow-y-auto">
				{messages.length === 0 ? (
					<div className="flex flex-col items-center justify-center h-full text-center px-4">
						<Bot size={24} className="text-connexio-text-muted mb-2" />
						<p className="text-[11px] text-connexio-text-muted">
							Ask anything about your project, get help with commands, or debug issues.
						</p>
					</div>
				) : (
					<>
						{messages.map((msg) => (
							<MessageBubble key={msg.id} message={msg} />
						))}
						<div ref={messagesEndRef} />
					</>
				)}
			</div>

			{/* Input */}
			<div className="border-t border-connexio-border p-2">
				<div className="flex items-end gap-1.5 bg-connexio-bg-tertiary rounded-lg px-2 py-1.5">
					<textarea
						ref={inputRef}
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="Ask AI..."
						rows={1}
						className="flex-1 bg-transparent text-[12px] text-connexio-text placeholder:text-connexio-text-muted outline-none resize-none max-h-[100px]"
						style={{ minHeight: "20px" }}
					/>
					<button
						onClick={handleSend}
						disabled={!input.trim() || isLoading}
						className="p-1 rounded hover:bg-connexio-accent/20 transition-colors disabled:opacity-30"
						type="button"
					>
						<Send size={12} className="text-connexio-accent" />
					</button>
				</div>
			</div>
		</div>
	);
}

// ─── AI Settings Panel ───────────────────────────────────────────────────────

function AISettingsPanel({ onBack }: { onBack: () => void }) {
	const { config, setConfig } = useAIStore();
	const [apiKey, setApiKey] = useState(config.apiKey);

	const providers = [
		{ id: "openai", name: "OpenAI", models: ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo", "o3-mini"] },
		{ id: "anthropic", name: "Anthropic", models: ["claude-sonnet-4-20250514", "claude-3-5-haiku-20241022"] },
		{ id: "google", name: "Google", models: ["gemini-2.0-flash", "gemini-2.5-pro-preview-05-06"] },
		{ id: "groq", name: "Groq", models: ["llama-3.3-70b-versatile", "mixtral-8x7b-32768"] },
		{ id: "local", name: "Local (LM Studio)", models: ["default"] },
	];

	const currentProvider = providers.find((p) => p.id === config.provider);

	return (
		<div className="flex flex-col h-full">
			<div className="flex items-center gap-2 px-3 py-2 border-b border-connexio-border">
				<button
					onClick={onBack}
					className="text-[11px] text-connexio-accent hover:underline"
					type="button"
				>
					← Back
				</button>
				<span className="text-[10px] font-semibold uppercase tracking-wider text-connexio-text-muted">
					AI Settings
				</span>
			</div>

			<div className="flex-1 overflow-y-auto p-3 space-y-3">
				{/* Provider */}
				<div>
					<label className="text-[10px] font-medium text-connexio-text-secondary mb-1 block">
						Provider
					</label>
					<select
						value={config.provider}
						onChange={(e) => {
							const provider = e.target.value as any;
							const models = providers.find((p) => p.id === provider)?.models || [];
							setConfig({ provider, model: models[0] || "" });
						}}
						className="w-full text-[11px] px-2 py-1.5 bg-connexio-bg-tertiary border border-connexio-border rounded text-connexio-text outline-none"
					>
						{providers.map((p) => (
							<option key={p.id} value={p.id}>
								{p.name}
							</option>
						))}
					</select>
				</div>

				{/* Model */}
				<div>
					<label className="text-[10px] font-medium text-connexio-text-secondary mb-1 block">
						Model
					</label>
					<select
						value={config.model}
						onChange={(e) => setConfig({ model: e.target.value })}
						className="w-full text-[11px] px-2 py-1.5 bg-connexio-bg-tertiary border border-connexio-border rounded text-connexio-text outline-none"
					>
						{currentProvider?.models.map((m) => (
							<option key={m} value={m}>
								{m}
							</option>
						))}
					</select>
				</div>

				{/* API Key */}
				<div>
					<label className="text-[10px] font-medium text-connexio-text-secondary mb-1 block">
						API Key
					</label>
					<input
						type="password"
						value={apiKey}
						onChange={(e) => setApiKey(e.target.value)}
						onBlur={() => setConfig({ apiKey })}
						placeholder="sk-..."
						className="w-full text-[11px] px-2 py-1.5 bg-connexio-bg-tertiary border border-connexio-border rounded text-connexio-text placeholder:text-connexio-text-muted outline-none"
					/>
				</div>

				{/* Base URL (for local) */}
				{config.provider === "local" && (
					<div>
						<label className="text-[10px] font-medium text-connexio-text-secondary mb-1 block">
							Base URL
						</label>
						<input
							type="text"
							value={config.baseUrl || ""}
							onChange={(e) => setConfig({ baseUrl: e.target.value })}
							placeholder="http://localhost:1234/v1"
							className="w-full text-[11px] px-2 py-1.5 bg-connexio-bg-tertiary border border-connexio-border rounded text-connexio-text placeholder:text-connexio-text-muted outline-none"
						/>
					</div>
				)}

				{/* System Prompt */}
				<div>
					<label className="text-[10px] font-medium text-connexio-text-secondary mb-1 block">
						System Prompt
					</label>
					<textarea
						value={config.systemPrompt}
						onChange={(e) => setConfig({ systemPrompt: e.target.value })}
						rows={4}
						className="w-full text-[11px] px-2 py-1.5 bg-connexio-bg-tertiary border border-connexio-border rounded text-connexio-text outline-none resize-none"
					/>
				</div>
			</div>
		</div>
	);
}
