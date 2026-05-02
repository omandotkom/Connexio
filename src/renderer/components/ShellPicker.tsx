import { ChevronDown, Plus, Terminal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ShellInfo } from "../../shared/types";
import { useSettingsStore } from "../stores/settingsStore";

interface Props {
	onSelect: (shell?: string) => void;
}

export default function ShellPicker({ onSelect }: Props) {
	const { shells, loadShells } = useSettingsStore();
	const [isOpen, setIsOpen] = useState(false);
	const dropdownRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (shells.length === 0) {
			loadShells();
		}
	}, []);

	// Close dropdown on outside click
	useEffect(() => {
		if (!isOpen) return;
		const handleClick = (e: MouseEvent) => {
			if (
				dropdownRef.current &&
				!dropdownRef.current.contains(e.target as Node)
			) {
				setIsOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClick);
		return () => document.removeEventListener("mousedown", handleClick);
	}, [isOpen]);

	const handleDefaultClick = () => {
		onSelect(undefined); // Use default shell
	};

	const handleShellSelect = (shell: ShellInfo) => {
		onSelect(shell.path);
		setIsOpen(false);
	};

	return (
		<div ref={dropdownRef} className="relative flex items-center">
			{/* Main button — opens default shell */}
			<button
				onClick={handleDefaultClick}
				className="flex items-center justify-center w-7 h-7 rounded-l hover:bg-connexio-bg-tertiary transition-colors border-r border-connexio-border"
				title="New Terminal (default shell)"
				type="button"
			>
				<Plus size={13} className="text-connexio-text-secondary" />
			</button>

			{/* Dropdown arrow */}
			<button
				onClick={() => setIsOpen(!isOpen)}
				className="flex items-center justify-center w-5 h-7 rounded-r hover:bg-connexio-bg-tertiary transition-colors"
				title="Choose shell"
				type="button"
			>
				<ChevronDown size={10} className="text-connexio-text-muted" />
			</button>

			{/* Dropdown menu */}
			{isOpen && (
				<div className="absolute top-full right-0 mt-1 w-52 bg-connexio-bg-secondary border border-connexio-border rounded-lg shadow-xl z-50 py-1 overflow-hidden">
					<div className="px-3 py-1.5 border-b border-connexio-border">
						<span className="text-[10px] font-semibold text-connexio-text-muted uppercase tracking-wider">
							Select Shell
						</span>
					</div>
					{shells.map((shell) => (
						<button
							key={shell.id}
							onClick={() => handleShellSelect(shell)}
							className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-connexio-bg-tertiary transition-colors"
							type="button"
						>
							<Terminal
								size={12}
								className="text-connexio-text-muted flex-shrink-0"
							/>
							<div className="flex-1 min-w-0">
								<p className="text-xs text-connexio-text truncate">
									{shell.name}
								</p>
								<p className="text-[10px] text-connexio-text-muted truncate">
									{shell.path}
								</p>
							</div>
						</button>
					))}
					{shells.length === 0 && (
						<div className="px-3 py-3 text-center">
							<p className="text-xs text-connexio-text-muted">
								Detecting shells...
							</p>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
