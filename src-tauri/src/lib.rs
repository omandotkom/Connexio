mod modules;

use modules::pty::PtyManager;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_log::Builder::default().build())
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
