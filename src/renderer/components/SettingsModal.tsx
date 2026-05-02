import { Monitor, Palette, Terminal, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { AppSettings } from "../../shared/types";
import { useSettingsStore } from "../stores/settingsStore";
import { useThemeStore } from "../stores/themeStore";

type SettingsTab = "general" | "terminal" | "appearance";

const DEFAULT_SETTINGS: AppSettings = {
	defaultShell: "",
	fontSize: 13,
	fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace",
	cursorStyle: "bar",
	cursorBlink: true,
	scrollback: 5000,
	copyOnSelect: false,
};

export default function SettingsModal() {
	const {
		settings,
		shells,
		loadSettings,
		loadShells,
		updateSettings,
		closeSettings,
	} = useSettingsStore();
	const { themes, currentTheme, setTheme } = useThemeStore();

	const [activeTab, setActiveTab] = useState<SettingsTab>("general");
	const [localSettings, setLocalSettings] = useState<AppSettings | null>(null);
	const [isDirty, setIsDirty] = useState(false);

	useEffect(() => {
		loadSettings();
		loadShells();
	}, []);

	// Sync local state when settings load from backend
	useEffect(() => {
		if (settings && !localSettings) {
			setLocalSettings({ ...settings });
		}
	}, [settings, localSettings]);

	const handleChange = <K extends keyof AppSettings>(
		key: K,
		value: AppSettings[K],
	) => {
		const current = localSettings || DEFAULT_SETTINGS;
		setLocalSettings({ ...current, [key]: value });
		setIsDirty(true);
	};

	const handleSave = async () => {
		if (!localSettings) return;
		await updateSettings(localSettings);
		setIsDirty(false);
	};

	const handleClose = () => {
		if (isDirty && localSettings) {
			updateSettings(localSettings);
		}
		closeSettings();
	};

	// Use local settings or fallback to defaults while loading
	const effectiveSettings = localSettings || settings || DEFAULT_SETTINGS;

	const tabs: Array<{ id: SettingsTab; label: string; icon: React.ReactNode }> =
		[
			{ id: "general", label: "General", icon: <Monitor size={14} /> },
			{ id: "terminal", label: "Terminal", icon: <Terminal size={14} /> },
			{ id: "appearance", label: "Appearance", icon: <Palette size={14} /> },
		];

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
			<div className="bg-connexio-bg-secondary border border-connexio-border rounded-lg w-[600px] max-h-[500px] shadow-2xl flex flex-col">
				{/* Header */}
				<div className="flex items-center justify-between px-4 py-3 border-b border-connexio-border">
					<h2 className="text-sm font-semibold text-connexio-text">Settings</h2>
					<button
						onClick={handleClose}
						className="p-1 rounded hover:bg-connexio-bg-tertiary transition-colors"
						type="button"
					>
						<X size={14} className="text-connexio-text-secondary" />
					</button>
				</div>

				<div className="flex flex-1 overflow-hidden">
					{/* Sidebar tabs */}
					<div className="w-40 border-r border-connexio-border py-2 px-2 space-y-0.5">
						{tabs.map((tab) => (
							<button
								key={tab.id}
								onClick={() => setActiveTab(tab.id)}
								className={`w-full flex items-center gap-2 px-3 py-2 rounded text-xs font-medium transition-colors ${
									activeTab === tab.id
										? "bg-connexio-accent/10 text-connexio-accent border border-connexio-accent/30"
										: "text-connexio-text-secondary hover:bg-connexio-bg-tertiary border border-transparent"
								}`}
								type="button"
							>
								{tab.icon}
								{tab.label}
							</button>
						))}
					</div>

					{/* Content */}
					<div className="flex-1 overflow-y-auto p-4 space-y-5">
						{activeTab === "general" && (
							<GeneralSettings
								settings={effectiveSettings}
								shells={shells}
								onChange={handleChange}
							/>
						)}
						{activeTab === "terminal" && (
							<TerminalSettings
								settings={effectiveSettings}
								onChange={handleChange}
							/>
						)}
						{activeTab === "appearance" && (
							<AppearanceSettings
								themes={themes}
								currentThemeId={currentTheme?.id || ""}
								onThemeChange={setTheme}
							/>
						)}
					</div>
				</div>

				{/* Footer */}
				{isDirty && (
					<div className="flex items-center justify-end px-4 py-3 border-t border-connexio-border">
						<button
							onClick={handleSave}
							className="px-4 py-1.5 text-xs font-medium text-white bg-connexio-accent rounded hover:bg-connexio-accent-hover transition-colors"
							type="button"
						>
							Save Changes
						</button>
					</div>
				)}
			</div>
		</div>
	);
}

// === General Settings ===
function GeneralSettings({
	settings,
	shells,
	onChange,
}: {
	settings: AppSettings;
	shells: import("../../shared/types").ShellInfo[];
	onChange: <K extends keyof AppSettings>(
		key: K,
		value: AppSettings[K],
	) => void;
}) {
	return (
		<div className="space-y-4">
			<h3 className="text-xs font-semibold text-connexio-text-secondary uppercase tracking-wider">
				General
			</h3>

			{/* Default Shell */}
			<div>
				<label className="block text-xs font-medium text-connexio-text-secondary mb-1.5">
					Default Shell
				</label>
				<select
					value={settings.defaultShell}
					onChange={(e) => onChange("defaultShell", e.target.value)}
					className="w-full px-3 py-2 text-sm bg-connexio-bg-tertiary border border-connexio-border rounded text-connexio-text outline-none focus:border-connexio-accent transition-colors appearance-none cursor-pointer"
				>
					<option value="">System Default</option>
					{shells.map((shell) => (
						<option key={shell.id} value={shell.path}>
							{shell.name}
						</option>
					))}
				</select>
				<p className="text-[10px] text-connexio-text-muted mt-1">
					Shell used when opening new terminal tabs
				</p>
			</div>

			{/* Copy on Select */}
			<div className="flex items-center justify-between">
				<div>
					<label className="block text-xs font-medium text-connexio-text-secondary">
						Copy on Select
					</label>
					<p className="text-[10px] text-connexio-text-muted mt-0.5">
						Automatically copy selected text to clipboard
					</p>
				</div>
				<ToggleSwitch
					checked={settings.copyOnSelect}
					onChange={(v) => onChange("copyOnSelect", v)}
				/>
			</div>
		</div>
	);
}

// === Terminal Settings ===
function TerminalSettings({
	settings,
	onChange,
}: {
	settings: AppSettings;
	onChange: <K extends keyof AppSettings>(
		key: K,
		value: AppSettings[K],
	) => void;
}) {
	return (
		<div className="space-y-4">
			<h3 className="text-xs font-semibold text-connexio-text-secondary uppercase tracking-wider">
				Terminal
			</h3>

			{/* Font Size */}
			<div>
				<label className="block text-xs font-medium text-connexio-text-secondary mb-1.5">
					Font Size
				</label>
				<div className="flex items-center gap-3">
					<input
						type="range"
						min={10}
						max={24}
						value={settings.fontSize}
						onChange={(e) => onChange("fontSize", Number(e.target.value))}
						className="flex-1 accent-[var(--accent-color)]"
					/>
					<span className="text-xs text-connexio-text w-8 text-right">
						{settings.fontSize}px
					</span>
				</div>
			</div>

			{/* Font Family */}
			<div>
				<label className="block text-xs font-medium text-connexio-text-secondary mb-1.5">
					Font Family
				</label>
				<input
					type="text"
					value={settings.fontFamily}
					onChange={(e) => onChange("fontFamily", e.target.value)}
					className="w-full px-3 py-2 text-sm bg-connexio-bg-tertiary border border-connexio-border rounded text-connexio-text outline-none focus:border-connexio-accent transition-colors"
				/>
			</div>

			{/* Cursor Style */}
			<div>
				<label className="block text-xs font-medium text-connexio-text-secondary mb-1.5">
					Cursor Style
				</label>
				<div className="flex gap-2">
					{(["bar", "block", "underline"] as const).map((style) => (
						<button
							key={style}
							onClick={() => onChange("cursorStyle", style)}
							className={`px-3 py-1.5 text-xs rounded border transition-colors capitalize ${
								settings.cursorStyle === style
									? "border-connexio-accent bg-connexio-accent/10 text-connexio-accent"
									: "border-connexio-border text-connexio-text-secondary hover:border-connexio-text-muted"
							}`}
							type="button"
						>
							{style}
						</button>
					))}
				</div>
			</div>

			{/* Cursor Blink */}
			<div className="flex items-center justify-between">
				<div>
					<label className="block text-xs font-medium text-connexio-text-secondary">
						Cursor Blink
					</label>
					<p className="text-[10px] text-connexio-text-muted mt-0.5">
						Enable blinking cursor animation
					</p>
				</div>
				<ToggleSwitch
					checked={settings.cursorBlink}
					onChange={(v) => onChange("cursorBlink", v)}
				/>
			</div>

			{/* Scrollback */}
			<div>
				<label className="block text-xs font-medium text-connexio-text-secondary mb-1.5">
					Scrollback Lines
				</label>
				<div className="flex items-center gap-3">
					<input
						type="range"
						min={1000}
						max={50000}
						step={1000}
						value={settings.scrollback}
						onChange={(e) => onChange("scrollback", Number(e.target.value))}
						className="flex-1 accent-[var(--accent-color)]"
					/>
					<span className="text-xs text-connexio-text w-14 text-right">
						{settings.scrollback.toLocaleString()}
					</span>
				</div>
			</div>
		</div>
	);
}

// === Appearance Settings ===
function AppearanceSettings({
	themes,
	currentThemeId,
	onThemeChange,
}: {
	themes: import("../../shared/types").AppTheme[];
	currentThemeId: string;
	onThemeChange: (themeId: string) => void;
}) {
	return (
		<div className="space-y-4">
			<h3 className="text-xs font-semibold text-connexio-text-secondary uppercase tracking-wider">
				Appearance
			</h3>

			{/* Theme */}
			<div>
				<label className="block text-xs font-medium text-connexio-text-secondary mb-2">
					Theme
				</label>
				<div className="grid grid-cols-1 gap-2">
					{themes.map((theme) => (
						<button
							key={theme.id}
							onClick={() => onThemeChange(theme.id)}
							className={`flex items-center gap-3 px-3 py-2.5 rounded border transition-colors text-left ${
								currentThemeId === theme.id
									? "border-connexio-accent bg-connexio-accent/10"
									: "border-connexio-border hover:border-connexio-text-muted"
							}`}
							type="button"
						>
							{/* Color preview */}
							<div className="flex gap-1">
								<div
									className="w-4 h-4 rounded-sm border border-white/10"
									style={{ backgroundColor: theme.colors.bgPrimary }}
								/>
								<div
									className="w-4 h-4 rounded-sm border border-white/10"
									style={{ backgroundColor: theme.colors.accentColor }}
								/>
								<div
									className="w-4 h-4 rounded-sm border border-white/10"
									style={{ backgroundColor: theme.terminal.green }}
								/>
							</div>
							<div className="flex-1">
								<p className="text-xs text-connexio-text font-medium">
									{theme.name}
								</p>
								<p className="text-[10px] text-connexio-text-muted capitalize">
									{theme.type}
								</p>
							</div>
							{currentThemeId === theme.id && (
								<div className="w-2 h-2 rounded-full bg-connexio-accent" />
							)}
						</button>
					))}
				</div>
			</div>
		</div>
	);
}

// === Toggle Switch ===
function ToggleSwitch({
	checked,
	onChange,
}: {
	checked: boolean;
	onChange: (value: boolean) => void;
}) {
	return (
		<button
			onClick={() => onChange(!checked)}
			className={`relative w-9 h-5 rounded-full transition-colors ${
				checked
					? "bg-connexio-accent"
					: "bg-connexio-bg-tertiary border border-connexio-border"
			}`}
			type="button"
		>
			<div
				className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
					checked ? "translate-x-4" : "translate-x-0.5"
				}`}
			/>
		</button>
	);
}
