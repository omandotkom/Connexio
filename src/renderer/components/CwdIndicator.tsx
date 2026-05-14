import { Folder } from "lucide-react";
import { useProjectStore } from "../stores/projectStore";
import { useShellIntegrationStore } from "../stores/shellIntegrationStore";

/**
 * Shows the current working directory of the active terminal.
 * Updated in real-time via OSC 7 shell integration.
 */
export default function CwdIndicator() {
	const { activeProjectId, workspaceTabs, activeTabIds } = useProjectStore();
	const { terminals } = useShellIntegrationStore();

	if (!activeProjectId) return null;

	const tabs = workspaceTabs[activeProjectId] || [];
	const activeTabId = activeTabIds[activeProjectId];
	const activeTab = tabs.find((t) => t.id === activeTabId);

	if (!activeTab?.terminalId) return null;

	const termState = terminals[activeTab.terminalId];
	const cwd = termState?.cwd;

	if (!cwd) return null;

	// Shorten path for display
	const parts = cwd.replace(/\\/g, "/").split("/");
	const shortPath =
		parts.length > 3
			? `.../${parts.slice(-2).join("/")}`
			: parts.join("/");

	return (
		<div className="flex items-center gap-1 text-[10px] text-connexio-text-muted truncate max-w-[200px]">
			<Folder size={10} className="flex-shrink-0 text-connexio-accent/60" />
			<span className="truncate" title={cwd}>
				{shortPath}
			</span>
		</div>
	);
}
