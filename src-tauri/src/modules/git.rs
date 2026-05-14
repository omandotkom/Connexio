use serde::Serialize;
use std::path::Path;
use std::process::Command;
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct GitStatus {
    pub is_repo: bool,
    pub branch: String,
    pub ahead: u32,
    pub behind: u32,
    pub modified: u32,
    pub staged: u32,
    pub untracked: u32,
    pub conflicted: u32,
    pub stashes: u32,
    pub last_commit: String,
    pub last_commit_time: String,
    pub remote_url: String,
}

fn run_git(cwd: &str, args: &[&str]) -> Option<String> {
    Command::new("git")
        .args(args)
        .current_dir(cwd)
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
}

#[tauri::command]
pub fn git_status(_app: AppHandle, project_path: String) -> GitStatus {
    if !Path::new(&project_path).join(".git").exists() {
        return GitStatus::default();
    }

    let branch = run_git(&project_path, &["rev-parse", "--abbrev-ref", "HEAD"])
        .unwrap_or_default();

    // Ahead/behind
    let (ahead, behind) = run_git(&project_path, &["rev-list", "--left-right", "--count", "HEAD...@{upstream}"])
        .map(|s| {
            let parts: Vec<&str> = s.split_whitespace().collect();
            let a = parts.first().and_then(|v| v.parse().ok()).unwrap_or(0);
            let b = parts.get(1).and_then(|v| v.parse().ok()).unwrap_or(0);
            (a, b)
        })
        .unwrap_or((0, 0));

    // Status counts
    let status_output = run_git(&project_path, &["status", "--porcelain=v1"]).unwrap_or_default();
    let mut modified = 0u32;
    let mut staged = 0u32;
    let mut untracked = 0u32;
    let mut conflicted = 0u32;

    for line in status_output.lines() {
        if line.len() < 2 {
            continue;
        }
        let x = line.chars().nth(0).unwrap_or(' ');
        let y = line.chars().nth(1).unwrap_or(' ');

        if x == 'U' || y == 'U' || (x == 'A' && y == 'A') || (x == 'D' && y == 'D') {
            conflicted += 1;
        } else if x == '?' && y == '?' {
            untracked += 1;
        } else {
            if x != ' ' && x != '?' {
                staged += 1;
            }
            if y != ' ' && y != '?' {
                modified += 1;
            }
        }
    }

    // Stash count
    let stashes = run_git(&project_path, &["stash", "list"])
        .map(|s| s.lines().count() as u32)
        .unwrap_or(0);

    // Last commit
    let last_commit = run_git(&project_path, &["log", "-1", "--format=%s"]).unwrap_or_default();
    let last_commit_time = run_git(&project_path, &["log", "-1", "--format=%cr"]).unwrap_or_default();

    // Remote URL
    let remote_url = run_git(&project_path, &["remote", "get-url", "origin"]).unwrap_or_default();

    GitStatus {
        is_repo: true,
        branch,
        ahead,
        behind,
        modified,
        staged,
        untracked,
        conflicted,
        stashes,
        last_commit,
        last_commit_time,
        remote_url,
    }
}

#[tauri::command]
pub fn git_stage(_app: AppHandle, project_path: String, file_path: String) -> Result<(), String> {
    run_git(&project_path, &["add", &file_path])
        .map(|_| ())
        .ok_or_else(|| "Failed to stage file".to_string())
}

#[tauri::command]
pub fn git_unstage(_app: AppHandle, project_path: String, file_path: String) -> Result<(), String> {
    run_git(&project_path, &["restore", "--staged", &file_path])
        .map(|_| ())
        .ok_or_else(|| "Failed to unstage file".to_string())
}

#[tauri::command]
pub fn git_commit(_app: AppHandle, project_path: String, message: String) -> Result<String, String> {
    run_git(&project_path, &["commit", "-m", &message])
        .ok_or_else(|| "Failed to commit".to_string())
}

#[tauri::command]
pub fn git_push(_app: AppHandle, project_path: String) -> Result<String, String> {
    run_git(&project_path, &["push"])
        .ok_or_else(|| "Failed to push".to_string())
}

#[tauri::command]
pub fn git_pull(_app: AppHandle, project_path: String) -> Result<String, String> {
    run_git(&project_path, &["pull"])
        .ok_or_else(|| "Failed to pull".to_string())
}

#[tauri::command]
pub fn git_fetch(_app: AppHandle, project_path: String) -> Result<String, String> {
    run_git(&project_path, &["fetch"])
        .ok_or_else(|| "Failed to fetch".to_string())
}
