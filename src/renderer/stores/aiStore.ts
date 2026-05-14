import { create } from "zustand";

export type AIProvider = "openai" | "anthropic" | "google" | "groq" | "local";

export interface AIMessage {
	id: string;
	role: "user" | "assistant" | "system";
	content: string;
	timestamp: number;
	isStreaming?: boolean;
}

export interface AIConfig {
	provider: AIProvider;
	apiKey: string;
	model: string;
	baseUrl?: string; // For local/custom endpoints
	systemPrompt: string;
}

interface AIStore {
	// State
	messages: AIMessage[];
	isLoading: boolean;
	config: AIConfig;
	isOpen: boolean;

	// Actions
	setOpen: (open: boolean) => void;
	toggleOpen: () => void;
	sendMessage: (content: string, terminalContext?: string) => Promise<void>;
	clearMessages: () => void;
	setConfig: (config: Partial<AIConfig>) => void;
	loadConfig: () => void;
}

const DEFAULT_CONFIG: AIConfig = {
	provider: "openai",
	apiKey: "",
	model: "gpt-4o-mini",
	systemPrompt:
		"You are a helpful coding assistant integrated into Connexio terminal manager. Help the user with coding tasks, terminal commands, and project management. Be concise and practical. When suggesting commands, format them in code blocks.",
};

function loadConfigFromStorage(): AIConfig {
	try {
		const stored = localStorage.getItem("connexio-ai-config");
		if (stored) {
			return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
		}
	} catch {}
	return DEFAULT_CONFIG;
}

function saveConfigToStorage(config: AIConfig) {
	try {
		// Don't persist API key to localStorage for security
		const { apiKey, ...rest } = config;
		localStorage.setItem("connexio-ai-config", JSON.stringify(rest));
	} catch {}
}

export const useAIStore = create<AIStore>((set, get) => ({
	messages: [],
	isLoading: false,
	config: loadConfigFromStorage(),
	isOpen: false,

	setOpen: (open) => set({ isOpen: open }),
	toggleOpen: () => set((s) => ({ isOpen: !s.isOpen })),

	sendMessage: async (content, terminalContext) => {
		const { config, messages } = get();

		if (!config.apiKey) {
			set({
				messages: [
					...messages,
					{
						id: crypto.randomUUID(),
						role: "user",
						content,
						timestamp: Date.now(),
					},
					{
						id: crypto.randomUUID(),
						role: "assistant",
						content:
							"⚠️ No API key configured. Go to Settings → AI to add your API key.",
						timestamp: Date.now(),
					},
				],
			});
			return;
		}

		const userMessage: AIMessage = {
			id: crypto.randomUUID(),
			role: "user",
			content,
			timestamp: Date.now(),
		};

		const assistantMessage: AIMessage = {
			id: crypto.randomUUID(),
			role: "assistant",
			content: "",
			timestamp: Date.now(),
			isStreaming: true,
		};

		set({
			messages: [...messages, userMessage, assistantMessage],
			isLoading: true,
		});

		try {
			const systemMessages: AIMessage[] = [
				{
					id: "system",
					role: "system",
					content: config.systemPrompt + (terminalContext ? `\n\nCurrent terminal context:\n${terminalContext}` : ""),
					timestamp: 0,
				},
			];

			const allMessages = [...systemMessages, ...messages, userMessage];

			const response = await fetchAIResponse(config, allMessages);

			set((state) => ({
				messages: state.messages.map((m) =>
					m.id === assistantMessage.id
						? { ...m, content: response, isStreaming: false }
						: m,
				),
				isLoading: false,
			}));
		} catch (error: any) {
			set((state) => ({
				messages: state.messages.map((m) =>
					m.id === assistantMessage.id
						? {
								...m,
								content: `❌ Error: ${error.message || "Failed to get response"}`,
								isStreaming: false,
							}
						: m,
				),
				isLoading: false,
			}));
		}
	},

	clearMessages: () => set({ messages: [] }),

	setConfig: (partial) => {
		const newConfig = { ...get().config, ...partial };
		set({ config: newConfig });
		saveConfigToStorage(newConfig);
	},

	loadConfig: () => {
		set({ config: loadConfigFromStorage() });
	},
}));

// ─── AI Provider API calls ───────────────────────────────────────────────────

async function fetchAIResponse(
	config: AIConfig,
	messages: AIMessage[],
): Promise<string> {
	const formattedMessages = messages.map((m) => ({
		role: m.role,
		content: m.content,
	}));

	switch (config.provider) {
		case "openai":
		case "groq":
		case "local": {
			const baseUrl =
				config.provider === "groq"
					? "https://api.groq.com/openai/v1"
					: config.provider === "local"
						? config.baseUrl || "http://localhost:1234/v1"
						: "https://api.openai.com/v1";

			const res = await fetch(`${baseUrl}/chat/completions`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${config.apiKey}`,
				},
				body: JSON.stringify({
					model: config.model,
					messages: formattedMessages,
					max_tokens: 4096,
				}),
			});

			if (!res.ok) {
				const err = await res.text();
				throw new Error(`API error (${res.status}): ${err}`);
			}

			const data = await res.json();
			return data.choices?.[0]?.message?.content || "No response";
		}

		case "anthropic": {
			const systemMsg = formattedMessages.find((m) => m.role === "system");
			const chatMessages = formattedMessages.filter((m) => m.role !== "system");

			const res = await fetch("https://api.anthropic.com/v1/messages", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-api-key": config.apiKey,
					"anthropic-version": "2023-06-01",
					"anthropic-dangerous-direct-browser-access": "true",
				},
				body: JSON.stringify({
					model: config.model || "claude-sonnet-4-20250514",
					max_tokens: 4096,
					system: systemMsg?.content || "",
					messages: chatMessages,
				}),
			});

			if (!res.ok) {
				const err = await res.text();
				throw new Error(`API error (${res.status}): ${err}`);
			}

			const data = await res.json();
			return data.content?.[0]?.text || "No response";
		}

		case "google": {
			const systemMsg = formattedMessages.find((m) => m.role === "system");
			const chatMessages = formattedMessages
				.filter((m) => m.role !== "system")
				.map((m) => ({
					role: m.role === "assistant" ? "model" : "user",
					parts: [{ text: m.content }],
				}));

			const model = config.model || "gemini-2.0-flash";
			const res = await fetch(
				`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						systemInstruction: systemMsg
							? { parts: [{ text: systemMsg.content }] }
							: undefined,
						contents: chatMessages,
					}),
				},
			);

			if (!res.ok) {
				const err = await res.text();
				throw new Error(`API error (${res.status}): ${err}`);
			}

			const data = await res.json();
			return (
				data.candidates?.[0]?.content?.parts?.[0]?.text || "No response"
			);
		}

		default:
			throw new Error(`Unsupported provider: ${config.provider}`);
	}
}
