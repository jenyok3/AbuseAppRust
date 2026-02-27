use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use sysinfo::System;
use tauri::Emitter;
use tauri::Manager;
use tauri::WindowEvent;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{TrayIconBuilder, TrayIconEvent};

#[cfg(windows)]
use windows_sys::Win32::System::Console::FreeConsole;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TelegramLink {
    #[serde(default)]
    pub api_id: String,
    #[serde(default)]
    pub api_hash: String,
    #[serde(default)]
    pub phone: String,
    pub app_name: String,
    #[serde(default)]
    pub app_type: String,
    #[serde(default)]
    pub ref_link: String,
    #[serde(default)]
    pub mixed: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct AppSettings {
    #[serde(rename = "telegramThreads", default)]
    telegram_threads: String,
    #[serde(rename = "telegramFolderPath", default)]
    telegram_folder_path: String,
    #[serde(rename = "chromeThreads", default)]
    chrome_threads: String,
    #[serde(rename = "chromeFolderPath", default)]
    chrome_folder_path: String,
}

fn settings_file_path() -> PathBuf {
    if let Ok(appdata) = std::env::var("APPDATA") {
        return PathBuf::from(appdata)
            .join("AbuseApp")
            .join("settings.json");
    }

    std::env::current_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join(".abuseapp-settings.json")
}

fn load_settings_from_disk() -> AppSettings {
    let path = settings_file_path();
    let content = match fs::read_to_string(path) {
        Ok(c) => c,
        Err(_) => return AppSettings::default(),
    };

    serde_json::from_str::<AppSettings>(&content).unwrap_or_default()
}

fn save_settings_to_disk(settings: &AppSettings) -> Result<(), String> {
    let path = settings_file_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create settings directory: {}", e))?;
    }

    let body = serde_json::to_string_pretty(settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;

    fs::write(path, body).map_err(|e| format!("Failed to write settings: {}", e))
}


fn is_likely_logged_out(tdata_path: &Path) -> bool {
    let entries = match fs::read_dir(tdata_path) {
        Ok(entries) => entries,
        Err(_) => return true,
    };

    let mut names: Vec<String> = Vec::new();
    for entry in entries.flatten() {
        let file_name = entry.file_name().to_string_lossy().to_lowercase();
        names.push(file_name);
    }

    if names.is_empty() {
        return true;
    }

    let ban_markers = [
        "deleted",
        "banned",
        "suspended",
        "restricted",
        "unauthorized",
        "logout",
        "blocked",
    ];

    if names
        .iter()
        .any(|name| ban_markers.iter().any(|marker| name.contains(marker)))
    {
        return true;
    }

    let has_core = names.iter().any(|name| {
        name.contains("session")
            || name.contains("user")
            || name.contains("key")
            || name.contains("map")
            || name.contains("setting")
    });

    if !has_core {
        return true;
    }

    names.len() <= 2
}

fn list_running_telegram_processes() -> Vec<(u32, String, String)> {
    let mut system = System::new_all();
    system.refresh_processes();

    system
        .processes()
        .iter()
        .filter_map(|(pid, process)| {
            let name = process.name().to_string();
            let path = process
                .exe()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();

            let name_lower = name.to_lowercase();
            let path_lower = path.to_lowercase();
            let is_telegram = name_lower.contains("telegram")
                || path_lower.ends_with("\\telegram.exe")
                || path_lower.ends_with("/telegram")
                || path_lower.contains("\\telegram desktop\\");

            if !is_telegram {
                return None;
            }

            let pid_num = pid.to_string().parse::<u32>().unwrap_or(0);
            Some((pid_num, name, path))
        })
        .collect()
}

fn normalize_path_for_match(value: &str) -> String {
    value.to_lowercase().replace('\\', "/").trim_end_matches('/').to_string()
}

fn build_account_dirs(account_ids: &[i32], root_raw: &str, root_norm: &str) -> Vec<String> {
    account_ids
        .iter()
        .filter_map(|account_id| {
            let dir = normalize_path_for_match(
                &Path::new(root_raw)
                    .join(format!("TG {}", account_id))
                    .to_string_lossy(),
            );
            if dir.is_empty() || !dir.starts_with(root_norm) {
                None
            } else {
                Some(dir)
            }
        })
        .collect()
}

fn get_pids_for_account_dirs(account_dirs: &[String]) -> Vec<u32> {
    if account_dirs.is_empty() {
        return Vec::new();
    }

    let processes = list_running_telegram_processes();
    let mut target_pids: Vec<u32> = Vec::new();
    let mut seen: HashSet<u32> = HashSet::new();

    for (pid, _name, path) in processes {
        if !seen.insert(pid) {
            continue;
        }
        let path_norm = normalize_path_for_match(&path);
        if account_dirs.iter().any(|dir| path_norm == *dir || path_norm.starts_with(&(dir.clone() + "/"))) {
            target_pids.push(pid);
        }
    }

    target_pids
}

pub fn run() {
  let is_autostart = std::env::args().any(|arg| arg == "--autostart");

  #[cfg(windows)]
  if is_autostart {
      // Detach from console when started via autostart on Windows.
      unsafe {
          FreeConsole();
      }
  }

  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_global_shortcut::Builder::new().build())
    .plugin(tauri_plugin_autostart::init(
        tauri_plugin_autostart::MacosLauncher::LaunchAgent,
        Some(vec!["--autostart".into()]),
    ))
    .setup(move |app| {
        // Native tray to ensure it exists even when the webview is not loaded.
        let open_item = MenuItem::with_id(app, "open", "Відкрити", true, Option::<&str>::None)?;
        let quit_item = MenuItem::with_id(app, "quit", "Вийти", true, Option::<&str>::None)?;
        let tray_menu = Menu::with_items(app, &[&open_item, &quit_item])?;
        let tray_image = tauri::include_image!("icons/tray-icon.png");

        let tray_icon = TrayIconBuilder::new()
            .icon(tray_image)
            .menu(&tray_menu)
            .show_menu_on_left_click(false)
            .tooltip("AbuseApp")
            .on_menu_event(|app, event| match event.id().as_ref() {
                "open" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            })
            .on_tray_icon_event(|tray, event| {
                if let TrayIconEvent::Click { button, button_state, .. } = event {
                    // Only react to left click so right click can open the tray menu.
                    if button == tauri::tray::MouseButton::Left
                        && button_state == tauri::tray::MouseButtonState::Up
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                }
            })
            .build(app)?;

        // Keep tray alive for the lifetime of the app.
        app.manage(tray_icon);

        if let Some(window) = app.get_webview_window("main") {
            let _ = window.center();
            if !is_autostart {
                let _ = window.show();
            }

            let window_for_event = window.clone();
            window.on_window_event(move |event| {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window_for_event.hide();
                }
            });
        }
        Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      greet,
      get_accounts,
      launch_accounts,
      launch_single_account,
      launch_accounts_batch,
      launch_accounts_for_profiles,
      get_available_links,
      build_telegram_link,
      get_settings,
      save_settings,
      get_account_stats,
      update_account_status,
      get_recent_actions,
      get_daily_tasks,
      update_daily_task,
      minimize_window,
      maximize_window,
      show_window,
      close_window,
      quit_app,
      is_maximized,
      read_directory,
      open_directory_dialog,
      close_telegram_processes,
      close_telegram_accounts_batch,
      get_telegram_pids_for_accounts,
      close_single_account,
      get_running_telegram_processes,
      send_reminder_notification
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn get_accounts() -> Result<Vec<serde_json::Value>, String> {
    // Mock data for testing
    let accounts = vec![
        serde_json::json!({
            "id": "1",
            "name": "Account 1",
            "status": "active",
            "type": "telegram",
            "lastActive": "2024-02-09T10:30:00Z"
        }),
        serde_json::json!({
            "id": "2", 
            "name": "Account 2",
            "status": "blocked",
            "type": "chrome",
            "lastActive": "2024-02-08T15:45:00Z"
        }),
        serde_json::json!({
            "id": "3",
            "name": "Account 3", 
            "status": "active",
            "type": "telegram",
            "lastActive": "2024-02-07T12:20:00Z"
        })
    ];
    
    Ok(accounts)
}

#[tauri::command]
async fn launch_accounts(account_ids: Vec<String>) -> Result<String, String> {
    // Mock implementation
    Ok(format!("Launched {} accounts", account_ids.len()))
}

#[tauri::command]
async fn launch_single_account(
    account_id: i32,
    telegram_folder_path: String,
) -> Result<u32, String> {
    use std::process::Command;
    println!("[LOG] Launching TG {}", account_id);
    
    let telegram_exe_path = Path::new(&telegram_folder_path)
        .join(format!("TG {}", account_id))
        .join("Telegram.exe");
    
    if telegram_exe_path.exists() {
        match Command::new(&telegram_exe_path)
            .spawn()
        {
            Ok(child) => {
                println!("[LOG] TG {} launched without params", account_id);
                Ok(child.id())
            }
            Err(e) => {
                println!("[LOG] Failed to launch TG {}: {}", account_id, e);
                Err(format!("Failed to launch account {}: {}", account_id, e))
            }
        }
    } else {
        Err(format!("Telegram.exe not found: {}", telegram_exe_path.display()))
    }
}

#[tauri::command]
async fn launch_accounts_batch(
    link_params: TelegramLink,
    start_range: i32,
    end_range: i32,
    telegram_folder_path: String,
) -> Result<Vec<u32>, String> {
    use std::process::Command;
    use rand::seq::SliceRandom;

    println!("[LOG] Start batch launch for TG accounts");
    println!("[LOG] Range: {}-{}", start_range, end_range);
    println!(
        "[LOG] Link params: api_id={}, app_name={}, app_type={}, ref_link={}, mixed={}",
        link_params.api_id, link_params.app_name, link_params.app_type, link_params.ref_link, link_params.mixed
    );

    let link = build_telegram_link(link_params.clone()).await?;
    println!("[LOG] Generated link: {}", link);

    let mut profiles: Vec<i32> = (start_range..=end_range).collect();

    if link_params.mixed == "yes" {
        let mut rng = rand::thread_rng();
        profiles.shuffle(&mut rng);
        println!("[LOG] Profiles shuffled");
    } else {
        println!("[LOG] Profiles not shuffled");
    }

    let mut launched_pids = Vec::new();
    let settings = load_settings_from_disk();
    let batch_size = settings
        .telegram_threads
        .trim()
        .parse::<usize>()
        .ok()
        .filter(|size| *size > 0)
        .unwrap_or(1);
    
    for (i, &profile_num) in profiles.iter().enumerate() {
        if i > 0 && i % batch_size == 0 {
            println!("[LOG] Batch limit reached, returning current PID list");
            return Ok(launched_pids);
        }
        println!("[LOG] Launching TG {}", profile_num);
        
        let telegram_exe_path = Path::new(&telegram_folder_path)
            .join(format!("TG {}", profile_num))
            .join("Telegram.exe");
        
        if telegram_exe_path.exists() {
            match Command::new(&telegram_exe_path)
                .args(if !link_params.app_type.is_empty() { 
                    vec!["-startintray"] 
                } else { 
                    vec![] 
                })
                .spawn()
            {
                Ok(_child) => {
                    launched_pids.push(_child.id());
                    println!("[LOG] TG {} launched without params", profile_num);
                    tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
                }
                Err(e) => {
                    println!("[LOG] Launch error {}: {}", telegram_exe_path.display(), e);
                }
            }
            
            let args = if !link_params.app_type.is_empty() {
                vec![link.as_str(), "-startintray"]
            } else {
                vec![link.as_str()]
            };
            
            match Command::new(&telegram_exe_path)
                .args(args)
                .spawn()
            {
                Ok(_child) => {
                    println!("TG {} launched with params {}.", profile_num, link);
                    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                }
                Err(e) => {
                    println!("[LOG] Launch with params failed for TG {}: {}", profile_num, e);
                }
            }
        } else {
            println!("File not found: {}", telegram_exe_path.display());
        }
    }
    
    Ok(launched_pids)
}

#[derive(Debug, Clone, Serialize)]
struct LaunchProgressPayload {
    batch_index: usize,
    batch_total: usize,
    profile: i32,
}

#[tauri::command]
async fn launch_accounts_for_profiles(
    app: tauri::AppHandle,
    link_params: TelegramLink,
    profile_ids: Vec<i32>,
    telegram_folder_path: String,
) -> Result<Vec<u32>, String> {
    use std::process::Command;

    println!("[LOG] Start batch launch for custom profile list");
    println!("[LOG] Profiles: {:?}", profile_ids);
    println!(
        "[LOG] Link params: api_id={}, app_name={}, app_type={}, ref_link={}, mixed={}",
        link_params.api_id, link_params.app_name, link_params.app_type, link_params.ref_link, link_params.mixed
    );

    let link = build_telegram_link(link_params.clone()).await?;
    println!("[LOG] Generated link: {}", link);

    let mut launched_pids = Vec::new();

    for (index, &profile_num) in profile_ids.iter().enumerate() {
        println!("[LOG] Launching TG {}", profile_num);

        let telegram_exe_path = Path::new(&telegram_folder_path)
            .join(format!("TG {}", profile_num))
            .join("Telegram.exe");

        if telegram_exe_path.exists() {
            match Command::new(&telegram_exe_path)
                .args(if !link_params.app_type.is_empty() {
                    vec!["-startintray"]
                } else {
                    vec![]
                })
                .spawn()
            {
                Ok(_child) => {
                    launched_pids.push(_child.id());
                    println!("[LOG] TG {} launched without params", profile_num);
                    tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
                }
                Err(e) => {
                    println!("[LOG] Launch error {}: {}", telegram_exe_path.display(), e);
                }
            }

            let args = if !link_params.app_type.is_empty() {
                vec![link.as_str(), "-startintray"]
            } else {
                vec![link.as_str()]
            };

            match Command::new(&telegram_exe_path)
                .args(args)
                .spawn()
            {
                Ok(_child) => {
                    println!("TG {} launched with params {}.", profile_num, link);
                    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                }
                Err(e) => {
                    println!("[LOG] Launch with params failed for TG {}: {}", profile_num, e);
                }
            }
        } else {
            println!("File not found: {}", telegram_exe_path.display());
        }
        let _ = app.emit("telegram-launch-progress", LaunchProgressPayload {
            batch_index: index + 1,
            batch_total: profile_ids.len(),
            profile: profile_num,
        });

    }

    Ok(launched_pids)
}

#[tauri::command]
async fn get_available_links() -> Result<Vec<(String, serde_json::Value)>, String> {
    println!("[LOG] Loading available links (static config)");

    Ok(vec![
        ("GetBonus".to_string(), serde_json::json!({
            "name": "GetBonus",
            "app_name": "getbonus",
            "app_type": "app",
            "ref_link": "",
            "mixed": "yes"
        })),
        ("Lootly".to_string(), serde_json::json!({
            "name": "Lootly",
            "app_name": "LootlyGameBot",
            "app_type": "start",
            "ref_link": "",
            "mixed": "yes"
        })),
        ("Twist".to_string(), serde_json::json!({
            "name": "Twist",
            "app_name": "twistappbot",
            "app_type": "app",
            "ref_link": "",
            "mixed": "yes"
        })),
        ("Rolls".to_string(), serde_json::json!({
            "name": "Rolls",
            "app_name": "rollsgame_bot",
            "app_type": "app",
            "ref_link": "ref_xEmnaKUVPi",
            "mixed": "yes"
        })),
        ("Qzino".to_string(), serde_json::json!({
            "name": "Qzino",
            "app_name": "qzino_official_bot",
            "app_type": "app",
            "ref_link": "",
            "mixed": "yes"
        })),
        ("Quantum".to_string(), serde_json::json!({
            "name": "Quantum Machines",
            "app_name": "Quantum_Machines_bot",
            "app_type": "start",
            "ref_link": "",
            "mixed": "yes"
        })),
        ("VIRUS".to_string(), serde_json::json!({
            "name": "VIRUS",
            "app_name": "virus_play_bot",
            "app_type": "app",
            "ref_link": "",
            "mixed": "yes"
        }))
    ])
}
#[tauri::command]
async fn build_telegram_link(link_params: TelegramLink) -> Result<String, String> {
    println!(
        "[LOG] Link params: app_name={}, app_type={}, ref_link={}",
        link_params.app_name, link_params.app_type, link_params.ref_link
    );

    let mut link = format!("tg://resolve?domain={}", link_params.app_name);
    
    if !link_params.app_type.is_empty() {
        link += &format!("&appname={}", link_params.app_type);
        
        // Extract startapp parameter from ref_link if it contains a full URL
        let startapp_value = if !link_params.ref_link.is_empty() {
            if link_params.ref_link.contains("startapp=") {
                // Extract startapp value from URL
                if let Ok(url) = url::Url::parse(&link_params.ref_link) {
                    url.query_pairs()
                        .find(|(key, _)| key == "startapp")
                        .map(|(_, value)| value.to_string())
                        .unwrap_or_else(|| {
                            println!("[LOG] Failed to extract startapp, using ref_link as is");
                            link_params.ref_link.clone()
                        })
                } else {
                    println!("[LOG] Failed to parse URL, using ref_link as is");
                    link_params.ref_link.clone()
                }
            } else {
                link_params.ref_link.clone()
            }
        } else {
            String::new()
        };
        
        if !startapp_value.is_empty() {
            link += &format!("&startapp={}", startapp_value);
        } else {
            link += "&startapp";
        }
    } else {
        if !link_params.ref_link.is_empty() {
            link += &format!("&start={}", link_params.ref_link);
        } else {
            link += "&start";
        }
        println!("[LOG] Using start without app_type");
    }

    println!("[LOG] Final link: {}", link);
    Ok(link)
}

#[tauri::command]
async fn get_settings() -> Result<serde_json::Value, String> {
    let settings = load_settings_from_disk();
    serde_json::to_value(settings).map_err(|e| format!("Failed to build settings response: {}", e))
}

#[tauri::command]
async fn save_settings(settings: serde_json::Value) -> Result<(), String> {
    let mut current = load_settings_from_disk();

    if let Some(v) = settings.get("telegramThreads").and_then(|v| v.as_str()) {
        current.telegram_threads = v.to_string();
    }
    if let Some(v) = settings.get("telegramFolderPath").and_then(|v| v.as_str()) {
        current.telegram_folder_path = v.to_string();
    }
    if let Some(v) = settings.get("chromeThreads").and_then(|v| v.as_str()) {
        current.chrome_threads = v.to_string();
    }
    if let Some(v) = settings.get("chromeFolderPath").and_then(|v| v.as_str()) {
        current.chrome_folder_path = v.to_string();
    }

    save_settings_to_disk(&current)
}

#[tauri::command]
async fn get_account_stats(telegram_folder_path: Option<String>) -> Result<serde_json::Value, String> {
    let settings = load_settings_from_disk();
    let root = telegram_folder_path
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| settings.telegram_folder_path.trim().to_string());

    if root.is_empty() {
        return Ok(serde_json::json!({
            "total": 0,
            "running": 0,
            "active": 0,
            "blocked": 0,
            "unknown": 0,
            "reason": "telegram_folder_not_configured"
        }));
    }

    let root_path = PathBuf::from(&root);
    if !root_path.exists() || !root_path.is_dir() {
        return Ok(serde_json::json!({
            "total": 0,
            "running": 0,
            "active": 0,
            "blocked": 0,
            "unknown": 0,
            "reason": "telegram_folder_not_found",
            "telegramFolderPath": root
        }));
    }

    let mut accounts: Vec<(String, PathBuf)> = Vec::new();
    let entries = fs::read_dir(&root_path).map_err(|e| format!("Failed to read accounts directory: {}", e))?;
    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if !path.is_dir() {
            continue;
        }

        let has_tdata = path.join("tdata").is_dir();
        if has_tdata {
            accounts.push((name, path));
        }
    }

    let total = accounts.len() as i64;
    if total == 0 {
        return Ok(serde_json::json!({
            "total": 0,
            "running": 0,
            "active": 0,
            "blocked": 0,
            "unknown": 0,
            "telegramFolderPath": root
        }));
    }

    let running_processes = list_running_telegram_processes();
    let process_paths: Vec<String> = running_processes
        .iter()
        .map(|(_, _, path)| path.to_lowercase().replace('\\', "/"))
        .collect();
    let mut used_process_indexes: HashSet<usize> = HashSet::new();

    let mut running: i64 = 0;
    let mut blocked: i64 = 0;

    for (name, account_path) in &accounts {
        let account_path_lower = account_path
            .to_string_lossy()
            .to_lowercase()
            .replace('\\', "/");
        let account_name_lower = name.to_lowercase();
        let account_name_segment = format!("/{}/", account_name_lower);

        let mut matched_process_index: Option<usize> = None;
        for (index, process_path) in process_paths.iter().enumerate() {
            if used_process_indexes.contains(&index) {
                continue;
            }

            let path_matches = !account_path_lower.is_empty()
                && (process_path == &account_path_lower
                    || process_path.starts_with(&(account_path_lower.clone() + "/")));
            let name_matches = !account_name_lower.is_empty()
                && process_path.contains(&account_name_segment);

            if path_matches || name_matches {
                matched_process_index = Some(index);
                break;
            }
        }

        if let Some(index) = matched_process_index {
            used_process_indexes.insert(index);
            running += 1;
            continue;
        }

        let tdata_path = account_path.join("tdata");
        if is_likely_logged_out(&tdata_path) {
            blocked += 1;
        }
    }

    let unknown = (total - running - blocked).max(0);

    Ok(serde_json::json!({
        "total": total,
        "running": running,
        "active": running,
        "blocked": blocked,
        "unknown": unknown,
        "telegramFolderPath": root
    }))
}

#[tauri::command]
async fn update_account_status(account_id: String, status: String) -> Result<(), String> {
    // In a real app, you would update the database
    println!("Updated account {} status to {}", account_id, status);
    Ok(())
}

#[tauri::command]
async fn get_recent_actions() -> Result<Vec<serde_json::Value>, String> {
    // Mock recent actions
    let actions = vec![
        serde_json::json!({
            "id": "1",
            "action": "launch",
            "target": "Account 1",
            "timestamp": "2024-02-09T10:30:00Z"
        }),
        serde_json::json!({
            "id": "2",
            "action": "launch",
            "target": "Account 2",
            "timestamp": "2024-02-09T10:31:00Z"
        }),
        serde_json::json!({
            "id": "3",
            "action": "launch",
            "target": "Account 3",
            "timestamp": "2024-02-09T10:32:00Z"
        })
    ];
    Ok(actions)
}

#[tauri::command]
async fn get_daily_tasks() -> Result<Vec<serde_json::Value>, String> {
    // Mock daily tasks
    let tasks = vec![
        serde_json::json!({
            "id": "1",
            "title": "Launch Accounts",
            "description": "Launch Telegram accounts 1-10",
            "status": "completed",
            "due_date": "2024-02-09T10:00:00Z"
        }),
        serde_json::json!({
            "id": "2",
            "title": "Launch Accounts",
            "description": "Launch Telegram accounts 11-20",
            "status": "pending",
            "due_date": "2024-02-09T11:00:00Z"
        })
    ];
    Ok(tasks)
}

#[tauri::command]
async fn update_daily_task(task_id: String, completed: bool) -> Result<(), String> {
    // In a real app, you would update the database
    println!("Updated task {} completed to {}", task_id, completed);
    Ok(())
}

#[tauri::command]
async fn minimize_window(app: tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Main window not found".to_string())?;
    window.minimize().map_err(|e| format!("Failed to minimize window: {}", e))
}

#[tauri::command]
async fn maximize_window(app: tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Main window not found".to_string())?;

    let is_maximized = window
        .is_maximized()
        .map_err(|e| format!("Failed to read maximize state: {}", e))?;

    if is_maximized {
        window
            .unmaximize()
            .map_err(|e| format!("Failed to unmaximize window: {}", e))
    } else {
        window
            .maximize()
            .map_err(|e| format!("Failed to maximize window: {}", e))
    }
}

#[tauri::command]
async fn show_window(app: tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Main window not found".to_string())?;
    window
        .unminimize()
        .map_err(|e| format!("Failed to unminimize window: {}", e))?;
    window.show().map_err(|e| format!("Failed to show window: {}", e))?;
    window.set_focus().map_err(|e| format!("Failed to focus window: {}", e))
}

#[tauri::command]
fn send_reminder_notification(
    app: tauri::AppHandle,
    title: String,
    body: String,
) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use tauri_winrt_notification::{Sound, Toast};

        let app_id = if cfg!(debug_assertions) {
            Toast::POWERSHELL_APP_ID.to_string()
        } else {
            app.config().identifier.clone()
        };
        let app_for_click = app.clone();

        Toast::new(&app_id)
            .title(&title)
            .text1(&body)
            .sound(Some(Sound::Default))
            .on_activated(move |_| {
                if let Some(window) = app_for_click.get_webview_window("main") {
                    let _ = window.unminimize();
                    let _ = window.show();
                    let _ = window.set_focus();
                }
                Ok(())
            })
            .show()
            .map_err(|e| format!("Failed to send native reminder notification: {}", e))?;

        return Ok(());
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (app, title, body);
        Ok(())
    }
}

#[tauri::command]
async fn close_window(app: tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Main window not found".to_string())?;
    window.hide().map_err(|e| format!("Failed to hide window: {}", e))
}

#[tauri::command]
async fn quit_app(app: tauri::AppHandle) -> Result<(), String> {
    app.exit(0);
    Ok(())
}

#[tauri::command]
async fn is_maximized(app: tauri::AppHandle) -> Result<bool, String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Main window not found".to_string())?;
    window
        .is_maximized()
        .map_err(|e| format!("Failed to read maximize state: {}", e))
}

#[tauri::command]
async fn read_directory(path: String) -> Result<Vec<serde_json::Value>, String> {
    
    let mut entries = Vec::new();
    
    match std::fs::read_dir(&path) {
        Ok(dir_entries) => {
            for entry in dir_entries.flatten() {
                entries.push(serde_json::json!({
                    "id": entries.len() + 1,
                    "name": entry.file_name().to_string_lossy(),
                    "is_dir": entry.file_type().ok().is_some_and(|ft| ft.is_dir()),
                    "size": entry.metadata().ok().map_or(0, |m| m.len()),
                    "modified": entry.metadata().ok().and_then(|m| m.modified().ok()),
                    "path": entry.path().to_string_lossy()
                }));
            }
        }
        Err(e) => {
            return Err(format!("Failed to read directory: {}", e));
        }
    }
    
    Ok(entries)
}

#[tauri::command]
async fn open_directory_dialog(app: tauri::AppHandle) -> Result<String, String> {
    use tauri_plugin_dialog::DialogExt;
    
    let (tx, rx) = tokio::sync::oneshot::channel();
    
    app.dialog()
        .file()
        .set_title("Select accounts folder")
        .pick_folder(move |result| {
            let _ = tx.send(result);
        });
    
    let selected_path = rx.await
        .map_err(|e| format!("Dialog error: {}", e))?
        .ok_or_else(|| "No directory selected".to_string())?
        .as_path()
        .map_or_else(|| "".to_string(), |p| p.to_string_lossy().to_string());
    
    Ok(selected_path)
}

#[tauri::command]
async fn close_telegram_processes(pids: Vec<u32>) -> Result<String, String> {
    use std::process::Command;

    let settings = load_settings_from_disk();
    let root_raw = settings.telegram_folder_path.trim().to_string();
    if root_raw.is_empty() {
        return Err("Telegram folder path is not configured".to_string());
    }
    let root = normalize_path_for_match(&root_raw);

    let running = list_running_telegram_processes();
    let mut allowed_pids: HashSet<u32> = HashSet::new();
    for (pid, _name, path) in running {
        let path_norm = normalize_path_for_match(&path);
        if path_norm.starts_with(&root) {
            allowed_pids.insert(pid);
        }
    }

    let mut closed_count = 0;
    
    for pid in pids {
        if !allowed_pids.contains(&pid) {
            continue;
        }
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;

            match Command::new("taskkill")
                .creation_flags(CREATE_NO_WINDOW)
                .args(["/F", "/PID", &pid.to_string()])
                .output()
            {
                Ok(output) => {
                    if output.status.success() {
                        closed_count += 1;
                        println!("Telegram process {} terminated", pid);
                    } else {
                        println!(
                            "Failed to terminate process {}: {}",
                            pid,
                            String::from_utf8_lossy(&output.stderr)
                        );
                    }
                }
                Err(e) => {
                    println!("Error terminating process {}: {}", pid, e);
                }
            }
        }
        
        #[cfg(not(target_os = "windows"))]
        {
            match Command::new("kill")
                .arg("-9")
                .arg(pid.to_string())
                .output()
            {
                Ok(output) => {
                    if output.status.success() {
                        closed_count += 1;
                        println!("Telegram process {} terminated", pid);
                    } else {
                        println!(
                            "Failed to terminate process {}: {}",
                            pid,
                            String::from_utf8_lossy(&output.stderr)
                        );
                    }
                }
                Err(e) => {
                    println!("Error terminating process {}: {}", pid, e);
                }
            }
        }
    }

    Ok(format!("Closed {} processes", closed_count))
}

#[tauri::command]
async fn close_telegram_accounts_batch(account_ids: Vec<i32>) -> Result<String, String> {
    use std::process::Command;

    if account_ids.is_empty() {
        return Ok("Closed 0 processes".to_string());
    }

    let settings = load_settings_from_disk();
    let root_raw = settings.telegram_folder_path.trim().to_string();
    if root_raw.is_empty() {
        return Err("Telegram folder path is not configured".to_string());
    }
    let root = normalize_path_for_match(&root_raw);

    let account_dirs = build_account_dirs(&account_ids, &root_raw, &root);

    if account_dirs.is_empty() {
        return Ok("Closed 0 processes".to_string());
    }

    let mut closed_pids: HashSet<u32> = HashSet::new();
    let mut attempts = 0;

    while attempts < 3 {
        let target_pids = get_pids_for_account_dirs(&account_dirs);
        if target_pids.is_empty() {
            break;
        }

        for pid in target_pids {
            #[cfg(target_os = "windows")]
            {
                use std::os::windows::process::CommandExt;
                const CREATE_NO_WINDOW: u32 = 0x08000000;

                match Command::new("taskkill")
                    .creation_flags(CREATE_NO_WINDOW)
                    .args(["/F", "/PID", &pid.to_string()])
                    .output()
                {
                    Ok(output) => {
                        if output.status.success() {
                            if closed_pids.insert(pid) {
                                println!("Telegram process {} terminated (batch)", pid);
                            }
                        } else {
                            println!(
                                "Failed to terminate process {}: {}",
                                pid,
                                String::from_utf8_lossy(&output.stderr)
                            );
                        }
                    }
                    Err(e) => {
                        println!("Error terminating process {}: {}", pid, e);
                    }
                }
            }

            #[cfg(not(target_os = "windows"))]
            {
                match Command::new("kill")
                    .arg("-9")
                    .arg(pid.to_string())
                    .output()
                {
                    Ok(output) => {
                        if output.status.success() {
                            if closed_pids.insert(pid) {
                                println!("Telegram process {} terminated (batch)", pid);
                            }
                        } else {
                            println!(
                                "Failed to terminate process {}: {}",
                                pid,
                                String::from_utf8_lossy(&output.stderr)
                            );
                        }
                    }
                    Err(e) => {
                        println!("Error terminating process {}: {}", pid, e);
                    }
                }
            }
        }

        attempts += 1;
        if attempts < 3 {
            tokio::time::sleep(tokio::time::Duration::from_millis(600)).await;
        }
    }

    Ok(format!("Closed {} processes", closed_pids.len()))
}

#[tauri::command]
async fn get_telegram_pids_for_accounts(account_ids: Vec<i32>) -> Result<Vec<u32>, String> {
    if account_ids.is_empty() {
        return Ok(Vec::new());
    }

    let settings = load_settings_from_disk();
    let root_raw = settings.telegram_folder_path.trim().to_string();
    if root_raw.is_empty() {
        return Err("Telegram folder path is not configured".to_string());
    }
    let root = normalize_path_for_match(&root_raw);

    let account_dirs = build_account_dirs(&account_ids, &root_raw, &root);
    if account_dirs.is_empty() {
        return Ok(Vec::new());
    }

    Ok(get_pids_for_account_dirs(&account_dirs))
}

#[tauri::command]
async fn close_single_account(account_id: i32) -> Result<String, String> {
    use std::process::Command;

    let settings = load_settings_from_disk();
    let root = settings.telegram_folder_path.trim().to_string();
    if root.is_empty() {
        return Err("Telegram folder path is not configured".to_string());
    }

    let account_dir = Path::new(&root).join(format!("TG {}", account_id));
    let account_dir_lower = account_dir
        .to_string_lossy()
        .to_lowercase()
        .replace('\\', "/");

    if account_dir_lower.is_empty() {
        return Err("Invalid account folder path".to_string());
    }

    let processes = list_running_telegram_processes();
    let mut target_pids: Vec<u32> = Vec::new();

    for (pid, _name, path) in processes {
        let path_lower = path.to_lowercase().replace('\\', "/");
        if path_lower == account_dir_lower || path_lower.starts_with(&(account_dir_lower.clone() + "/")) {
            target_pids.push(pid);
        }
    }

    if target_pids.is_empty() {
        return Err("No running Telegram processes found for this account".to_string());
    }

    let mut closed_count = 0;

    for pid in target_pids {
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;

            match Command::new("taskkill")
                .creation_flags(CREATE_NO_WINDOW)
                .args(["/F", "/PID", &pid.to_string()])
                .output()
            {
                Ok(output) => {
                    if output.status.success() {
                        closed_count += 1;
                        println!("Telegram process {} terminated", pid);
                    } else {
                        println!(
                            "Failed to terminate process {}: {}",
                            pid,
                            String::from_utf8_lossy(&output.stderr)
                        );
                    }
                }
                Err(e) => {
                    println!("Error terminating process {}: {}", pid, e);
                }
            }
        }

        #[cfg(not(target_os = "windows"))]
        {
            match Command::new("kill")
                .arg("-9")
                .arg(pid.to_string())
                .output()
            {
                Ok(output) => {
                    if output.status.success() {
                        closed_count += 1;
                        println!("Telegram process {} terminated", pid);
                    } else {
                        println!(
                            "Failed to terminate process {}: {}",
                            pid,
                            String::from_utf8_lossy(&output.stderr)
                        );
                    }
                }
                Err(e) => {
                    println!("Error terminating process {}: {}", pid, e);
                }
            }
        }
    }

    Ok(format!("Closed {} Telegram processes", closed_count))
}
#[tauri::command]
async fn get_running_telegram_processes() -> Result<Vec<serde_json::Value>, String> {
    let processes = list_running_telegram_processes()
        .into_iter()
        .map(|(pid, name, path)| {
            serde_json::json!({
                "pid": pid,
                "name": name,
                "path": path
            })
        })
        .collect();

    Ok(processes)
}





