import { useEffect } from "react";
import SettingsModal from "./components/SettingsModal";
import Sidebar from "./components/Sidebar";
import TitleBar from "./components/TitleBar";
import UpdateNotification from "./components/UpdateNotification";
import WelcomeScreen from "./components/WelcomeScreen";
import Workspace from "./components/Workspace";
import { useProjectStore } from "./stores/projectStore";
import { useSettingsStore } from "./stores/settingsStore";
import { useThemeStore } from "./stores/themeStore";

export default function App() {
	const { loadProjects, activeProjectId, restoreWorkspace } = useProjectStore();
	const { loadTheme, loadThemes } = useThemeStore();
	const { isSettingsOpen, loadSettings, loadShells } = useSettingsStore();

	useEffect(() => {
		const init = async () => {
			await loadProjects();
			await restoreWorkspace();
			loadTheme();
			loadThemes();
			loadSettings();
			loadShells();
		};
		init();
	}, []);

	return (
		<div className="flex flex-col h-screen w-screen bg-connexio-bg">
			<TitleBar />
			<div className="flex flex-1 overflow-hidden">
				<Sidebar />
				<div className="flex flex-col flex-1 overflow-hidden">
					{activeProjectId ? <Workspace /> : <WelcomeScreen />}
				</div>
			</div>

			{/* Settings Modal */}
			{isSettingsOpen && <SettingsModal />}

			{/* Auto-update notification */}
			<UpdateNotification />
		</div>
	);
}
