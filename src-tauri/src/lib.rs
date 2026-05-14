mod modules;

use modules::pty::PtyManager;
use tauri::Manager;

#[tauri::command]
fn app_get_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build())
        .setup(|app| {
            // Initialize PTY manager state
            app.manage(PtyManager::new());

            // Show window after setup
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // App
            app_get_version,
            // Terminal
            modules::pty::terminal_create,
            modules::pty::terminal_write,
            modules::pty::terminal_resize,
            modules::pty::terminal_close,
            // Projects
            modules::projects::projects_list,
            modules::projects::projects_add,
            modules::projects::projects_update,
            modules::projects::projects_delete,
            // Settings
            modules::settings::settings_get,
            modules::settings::settings_set,
            modules::settings::settings_get_shells,
            modules::settings::settings_get_default_shell,
            // Workspace
            modules::workspace::workspace_get_state,
            modules::workspace::workspace_save_state,
            // Git
            modules::git::git_status,
            modules::git::git_stage,
            modules::git::git_unstage,
            modules::git::git_commit,
            modules::git::git_push,
            modules::git::git_pull,
            modules::git::git_fetch,
            // Tasks
            modules::tasks::tasks_detect,
            // Theme
            modules::theme::theme_get,
            modules::theme::theme_set,
            modules::theme::theme_list,
            // Session
            modules::session::session_save,
            modules::session::session_load,
            modules::session::session_list,
            modules::session::session_delete,
            // Pinned
            modules::pinned::pinned_list,
            modules::pinned::pinned_save,
            // SSH
            modules::ssh::ssh_list,
            modules::ssh::ssh_save,
            modules::ssh::ssh_list_global,
            modules::ssh::ssh_save_global,
            modules::ssh::ssh_build_command,
            modules::ssh::ssh_key_exists,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                let app = window.app_handle();
                modules::pty::kill_all(app);
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Connexio");
}
