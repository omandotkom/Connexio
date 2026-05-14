use serde::Serialize;
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    pub version: String,
    pub available: bool,
}

#[tauri::command]
pub fn updater_check(_app: AppHandle) -> UpdateInfo {
    // Stub — real updater will use tauri-plugin-updater
    UpdateInfo {
        version: env!("CARGO_PKG_VERSION").to_string(),
        available: false,
    }
}

#[tauri::command]
pub fn updater_download(_app: AppHandle) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub fn updater_install(_app: AppHandle) -> Result<(), String> {
    Ok(())
}
