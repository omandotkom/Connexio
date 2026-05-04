import { GripVertical, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface TabProps {
	id: string;
	label: string;
	isActive: boolean;
	index: number;
	canClose: boolean;
	onSelect: () => void;
	onClose: () => void;
	onRename: (newLabel: string) => void;
	onDragStart: (index: number) => void;
	onDragOver: (index: number) => void;
	onDragEnd: () => void;
	isDragOver: boolean;
	dragSide: "left" | "right" | null;
}

export default function WorkspaceTab({
	id,
	label,
	isActive,
	index,
	canClose,
	onSelect,
	onClose,
	onRename,
	onDragStart,
	onDragOver,
	onDragEnd,
	isDragOver,
	dragSide,
}: TabProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [editValue, setEditValue] = useState(label);
	const inputRef = useRef<HTMLInputElement>(null);
	const tabRef = useRef<HTMLDivElement>(null);

	// Focus input when entering edit mode
	useEffect(() => {
		if (isEditing && inputRef.current) {
			inputRef.current.focus();
			inputRef.current.select();
		}
	}, [isEditing]);

	const commitRename = () => {
		const trimmed = editValue.trim();
		if (trimmed && trimmed !== label) {
			onRename(trimmed);
		} else {
			setEditValue(label);
		}
		setIsEditing(false);
	};

	const cancelRename = () => {
		setEditValue(label);
		setIsEditing(false);
	};

	const handleDoubleClick = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setEditValue(label);
		setIsEditing(true);
	};

	const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		e.stopPropagation();
		if (e.key === "Enter") {
			e.preventDefault();
			commitRename();
		} else if (e.key === "Escape") {
			e.preventDefault();
			cancelRename();
		}
	};

	// Drag indicator styles
	const dragIndicatorClass = isDragOver
		? dragSide === "left"
			? "before:absolute before:left-0 before:top-1 before:bottom-1 before:w-0.5 before:bg-connexio-accent before:rounded-full"
			: "after:absolute after:right-0 after:top-1 after:bottom-1 after:w-0.5 after:bg-connexio-accent after:rounded-full"
		: "";

	return (
		<div
			ref={tabRef}
			role="tab"
			tabIndex={0}
			aria-selected={isActive}
			draggable={!isEditing}
			className={`relative group flex items-center gap-1 px-1 h-9 border-r border-connexio-border cursor-pointer transition-colors min-w-0 max-w-[200px] select-none ${
				isActive
					? "bg-connexio-bg border-b-2 border-b-connexio-accent"
					: "hover:bg-connexio-bg-tertiary"
			} ${dragIndicatorClass}`}
			onClick={() => {
				if (!isEditing) onSelect();
			}}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					if (!isEditing) onSelect();
				}
				if (e.key === "F2") {
					e.preventDefault();
					setEditValue(label);
					setIsEditing(true);
				}
			}}
			onDragStart={(e) => {
				e.dataTransfer.effectAllowed = "move";
				e.dataTransfer.setData("text/plain", id);
				// Make drag image slightly transparent
				if (tabRef.current) {
					e.dataTransfer.setDragImage(tabRef.current, 0, 0);
				}
				onDragStart(index);
			}}
			onDragOver={(e) => {
				e.preventDefault();
				e.dataTransfer.dropEffect = "move";
				onDragOver(index);
			}}
			onDragEnd={() => {
				onDragEnd();
			}}
		>
			{/* Drag handle */}
			<div className="flex-shrink-0 opacity-0 group-hover:opacity-40 hover:!opacity-80 cursor-grab active:cursor-grabbing transition-opacity">
				<GripVertical size={10} className="text-connexio-text-muted" />
			</div>

			{/* Label or input */}
			{isEditing ? (
				<input
					ref={inputRef}
					type="text"
					value={editValue}
					onChange={(e) => setEditValue(e.target.value)}
					onBlur={commitRename}
					onKeyDown={handleInputKeyDown}
					onClick={(e) => e.stopPropagation()}
					onMouseDown={(e) => e.stopPropagation()}
					className="text-xs bg-connexio-bg-tertiary text-connexio-text border border-connexio-accent rounded px-1 py-0.5 outline-none min-w-[60px] max-w-[140px] w-full"
					maxLength={30}
				/>
			) : (
				<span
					className={`text-xs truncate px-1 ${
						isActive ? "text-connexio-text" : "text-connexio-text-secondary"
					}`}
					onDoubleClick={handleDoubleClick}
					title="Double-click to rename"
				>
					{label}
				</span>
			)}

			{/* Close button */}
			{canClose && !isEditing && (
				<button
					onClick={(e) => {
						e.stopPropagation();
						onClose();
					}}
					className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-500/20 transition-all"
					type="button"
				>
					<X size={10} className="text-connexio-text-muted" />
				</button>
			)}
		</div>
	);
}
