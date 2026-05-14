use serde::Serialize;
use std::fs;
use std::path::Path;
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_hidden: bool,
    pub extension: Option<String>,
    pub size: Option<u64>,
    pub children: Option<Vec<FileEntry>>,
}

/// Common directories/files to ignore
const IGNORED: &[&str] = &[
    "node_modules", ".git", "target", "dist", "build", ".next",
    "__pycache__", ".venv", "venv", ".tox", ".mypy_cache",
    ".DS_Store", "Thumbs.db", ".idea", ".vscode",
];

fn should_ignore(name: &str) -> bool {
    IGNORED.contains(&name)
}

fn is_hidden(name: &str) -> bool {
    name.starts_with('.')
}

/// Read directory entries (one level deep)
#[tauri::command]
pub fn explorer_list_dir(_app: AppHandle, dir_path: String) -> Result<Vec<FileEntry>, String> {
    let path = Path::new(&dir_path);
    if !path.is_dir() {
        return Err(format!("Not a directory: {}", dir_path));
    }

    let mut entries = Vec::new();
    let read_dir = fs::read_dir(path).map_err(|e| format!("Failed to read dir: {}", e))?;

    for entry in read_dir.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip ignored directories
        if should_ignore(&name) {
            continue;
        }

        let entry_path = entry.path();
        let metadata = entry.metadata().ok();
        let is_dir = metadata.as_ref().map(|m| m.is_dir()).unwrap_or(false);
        let size = if !is_dir {
            metadata.as_ref().map(|m| m.len())
        } else {
            None
        };

        let extension = if !is_dir {
            entry_path
                .extension()
                .map(|e| e.to_string_lossy().to_string())
        } else {
            None
        };

        entries.push(FileEntry {
            name: name.clone(),
            path: entry_path.to_string_lossy().to_string(),
            is_dir,
            is_hidden: is_hidden(&name),
            extension,
            size,
            children: None,
        });
    }

    // Sort: directories first, then alphabetical
    entries.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(entries)
}

/// Read full tree (limited depth for performance)
#[tauri::command]
pub fn explorer_read_tree(_app: AppHandle, dir_path: String, max_depth: Option<u32>) -> Result<Vec<FileEntry>, String> {
    let depth = max_depth.unwrap_or(1);
    read_tree_recursive(&dir_path, depth)
}

fn read_tree_recursive(dir_path: &str, depth: u32) -> Result<Vec<FileEntry>, String> {
    if depth == 0 {
        return Ok(vec![]);
    }

    let path = Path::new(dir_path);
    if !path.is_dir() {
        return Ok(vec![]);
    }

    let mut entries = Vec::new();
    let read_dir = fs::read_dir(path).map_err(|e| format!("Failed to read dir: {}", e))?;

    for entry in read_dir.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if should_ignore(&name) {
            continue;
        }

        let entry_path = entry.path();
        let metadata = entry.metadata().ok();
        let is_dir = metadata.as_ref().map(|m| m.is_dir()).unwrap_or(false);
        let size = if !is_dir {
            metadata.as_ref().map(|m| m.len())
        } else {
            None
        };

        let extension = if !is_dir {
            entry_path.extension().map(|e| e.to_string_lossy().to_string())
        } else {
            None
        };

        let children = if is_dir && depth > 1 {
            read_tree_recursive(&entry_path.to_string_lossy(), depth - 1).ok()
        } else {
            None
        };

        entries.push(FileEntry {
            name: name.clone(),
            path: entry_path.to_string_lossy().to_string(),
            is_dir,
            is_hidden: is_hidden(&name),
            extension,
            size,
            children,
        });
    }

    entries.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(entries)
}
