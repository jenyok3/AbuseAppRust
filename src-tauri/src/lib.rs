use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use sysinfo::System;
use tauri::Manager;

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

pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .invoke_handler(tauri::generate_handler![
      greet,
      get_accounts,
      launch_accounts,
      launch_single_account,
      launch_accounts_batch,
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
      close_window,
      is_maximized,
      read_directory,
      open_directory_dialog,
      close_telegram_processes,
      close_single_account,
      get_running_telegram_processes
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
    Ok(format!("Запущено {} акаунтів", account_ids.len()))
}

#[tauri::command]
async fn launch_single_account(
    account_id: i32,
    telegram_folder_path: String,
) -> Result<u32, String> {
    use std::process::Command;
    
    println!("[LOG] Запуск окремого акаунта #{}", account_id);
    
    let telegram_exe_path = Path::new(&telegram_folder_path)
        .join(format!("TG {}", account_id))
        .join("Telegram.exe");
    
    if telegram_exe_path.exists() {
        match Command::new(&telegram_exe_path)
            .spawn()
        {
            Ok(child) => {
                println!("[LOG] Акаунт {} успішно запущено, PID: {}", account_id, child.id());
                Ok(child.id())
            }
            Err(e) => {
                println!("[LOG] Помилка запуску акаунта {}: {}", account_id, e);
                Err(format!("Не вдалося запустити акаунт {}: {}", account_id, e))
            }
        }
    } else {
        println!("[LOG] Файл не знайдено: {}", telegram_exe_path.display());
        Err(format!("Файл Telegram.exe не знайдено: {}", telegram_exe_path.display()))
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
    
    // Логування початку операції
    println!("[LOG] Початок пакетного запуску акаунтів");
    println!("[LOG] Діапазон: {}-{}", start_range, end_range);
    println!("[LOG] Параметри посилання: api_id={}, app_name={}, app_type={}, ref_link={}, mixed={}", 
        link_params.api_id, link_params.app_name, link_params.app_type, link_params.ref_link, link_params.mixed);
    
    // Build the link
    let link = build_telegram_link(link_params.clone()).await?;
    println!("[LOG] Згенеровано посилання: {}", link);
    
    // Create account range
    let mut profiles: Vec<i32> = (start_range..=end_range).collect();
    
    // Shuffle if mixed
    if link_params.mixed == "yes" {
        let mut rng = rand::thread_rng();
        profiles.shuffle(&mut rng);
        println!("[LOG] Профілі випадково перемішані.");
    } else {
        println!("[LOG] Профілі не перемішані.");
    }
    
    let mut launched_pids = Vec::new();
    let batch_size = 29;
    
    for (i, &profile_num) in profiles.iter().enumerate() {
        if i > 0 && i % batch_size == 0 {
            println!("[LOG] Запущено {} акаунтів. Натисніть F6, щоб продовжити...", batch_size);
            return Ok(launched_pids);
        }
        
        println!("[LOG] Запуск акаунта #{}", profile_num);
        
        let telegram_exe_path = Path::new(&telegram_folder_path)
            .join(format!("TG {}", profile_num))
            .join("Telegram.exe");
        
        if telegram_exe_path.exists() {
            // First launch without parameters
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
                    println!("[LOG] TG {} запущено без параметрів.", profile_num);
                    tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
                }
                Err(e) => {
                    println!("[LOG] Помилка запуску процесу {}: {}", telegram_exe_path.display(), e);
                }
            }
            
            // Then launch with link as a separate argument (not with --)
            let args = if !link_params.app_type.is_empty() {
                vec![link.as_str(), "-startintray"]
            } else {
                vec![link.as_str()]
            };
            
            println!("[LOG] Запускаємо Telegram з аргументами: {:?}", args);
            
            match Command::new(&telegram_exe_path)
                .args(args)
                .spawn()
            {
                Ok(_child) => {
                    // Don't add to launched_pids since this is the same profile
                    println!("TG {} завантажено з параметрами {}.", profile_num, link);
                    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                }
                Err(e) => {
                    println!("Помилка запуску процесу з параметрами {}: {}", telegram_exe_path.display(), e);
                }
            }
        } else {
            println!("Файл не знайдено: {}", telegram_exe_path.display());
        }
    }
    
    Ok(launched_pids)
}

#[tauri::command]
async fn get_available_links() -> Result<Vec<(String, serde_json::Value)>, String> {
    // Логування початку операції
    println!("[LOG] Початок отримання доступних посилань");
    
    // Запускаємо Python-скрипт для отримання реальних посилань
    use std::process::Command;
    
    let output = Command::new("python")
        .arg("-c")
        .arg(r#"
import json
import sys
import os
from datetime import datetime

# Отримуємо посилання з вашого скрипту
links = {
    "GetBonus": {
        "appName": "getbonus",
        "appType": "app",
        "refLink": "",
        "mixed": "yes"
    },
    "Lootly": {
        "appName": "LootlyGameBot",
        "appType": "start",
        "refLink": "",
        "mixed": "yes"
    },
    "Twist": {
        "appName": "twistappbot",
        "appType": "app",
        "refLink": "",
        "mixed": "yes"
    },
    "Rolls": {
        "appName": "rollsgame_bot",
        "appType": "app",
        "refLink": "ref_xEmnaKUVPi",
        "mixed": "yes"
    },
    "Qzino": {
        "appName": "qzino_official_bot",
        "appType": "app",
        "refLink": "",
        "mixed": "yes"
    },
    "Quantum": {
        "appName": "Quantum_Machines_bot",
        "appType": "start",
        "refLink": "",
        "mixed": "yes"
    },
    "VIRUS": {
        "appName": "virus_play_bot",
        "appType": "app",
        "refLink": "",
        "mixed": "yes"
    }
}

# Виводимо результат у JSON для Tauri
print(json.dumps(links))
"#)
        .output()
        .map_err(|e| format!("Failed to execute Python script: {}", e))?;

    match output.status.success() {
        true => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            println!("[LOG] Python-скрипт успішно виконано");
            
            // Парсимо JSON відповідь
            match serde_json::from_str::<serde_json::Value>(&stdout) {
                Ok(links_data) => {
                    let mut result = Vec::new();
                    for (name, data) in links_data.as_object().unwrap() {
                        result.push((name.to_string(), serde_json::json!(data)));
                    }
                    println!("[LOG] Отримано {} доступних посилань", result.len());
                    Ok(result)
                }
                Err(e) => {
                    println!("[LOG] Помилка парсингу JSON: {}", e);
                    // Повертаємо тестові дані у разі помилки
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
            }
        }
        false => {
            let stderr = String::from_utf8_lossy(&output.stderr);
            println!("[LOG] Помилка Python-скрипту: {}", stderr);
            Err(format!("Failed to get links: {}", stderr))
        }
    }
}

#[tauri::command]
async fn build_telegram_link(link_params: TelegramLink) -> Result<String, String> {
    // Логування початку операції
    println!("[LOG] Початок побудови посилання для: {}", link_params.app_name);
    println!("[LOG] Повний ref_link: {}", link_params.ref_link);
    
    // Використовуємо той самий формат, що й Python скрипт
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
                            println!("[LOG] Не вдалося витягти startapp з URL, використовуємо повний ref_link");
                            link_params.ref_link.clone()
                        })
                } else {
                    println!("[LOG] Не вдалося розпарсити URL, використовуємо ref_link як є");
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
        println!("[LOG] Додано параметр app_type: {}, startapp: {}", link_params.app_type, startapp_value);
    } else {
        if !link_params.ref_link.is_empty() {
            link += &format!("&start={}", link_params.ref_link);
        } else {
            link += "&start";
        }
        println!("[LOG] Використовується start параметр замість app_type");
    }
    
    println!("[LOG] Згенеровано посилання: {}", link);
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
async fn update_daily_task(task_id: String, status: String) -> Result<(), String> {
    // In a real app, you would update the database
    println!("Updated task {} status to {}", task_id, status);
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
async fn close_window(app: tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Main window not found".to_string())?;
    window.close().map_err(|e| format!("Failed to close window: {}", e))
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
                if entry.file_type().ok().is_some_and(|ft| ft.is_dir()) {
                    let mut files = Vec::new();
                    if let Ok(dir_entries) = std::fs::read_dir(entry.path()) {
                        for file_entry in dir_entries.flatten() {
                            let file = file_entry.file_name();
                            let file_path = file_entry.path();
                            if file_path.extension().and_then(|s| s.to_str()) == Some("session") {
                                if let Ok(metadata) = file_entry.metadata() {
                                    let file_name = file.to_string_lossy();
                                    files.push(serde_json::json!({
                                        "id": files.len() + 1,
                                        "name": file_name.strip_suffix(".session").unwrap_or(&file_name),
                                        "status": if metadata.modified().ok().and_then(|t| t.elapsed().ok()).map_or(true, |d| d.as_secs() < 300) {
                                            "активні"
                                        } else {
                                            "заблоковані"
                                        },
                                        "notes": format!("{} (session)", file_path.display()),
                                        "session_type": "session",
                                        "isFile": true,
                                        "isDir": false,
                                        "size": metadata.len(),
                                        "modified": metadata.modified().ok()
                                    }));
                                }
                            }
                        }
                    }
                }
                
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
        .set_title("Виберіть папку з акаунтами")
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
    
    let mut closed_count = 0;
    
    for pid in pids {
        #[cfg(target_os = "windows")]
        {
            match Command::new("taskkill")
                .args(["/F", "/PID", &pid.to_string()])
                .output()
            {
                Ok(output) => {
                    if output.status.success() {
                        closed_count += 1;
                        println!("Процес телеграму {} завершено", pid);
                    } else {
                        println!("Не вдалося завершити процес {}: {}", pid, String::from_utf8_lossy(&output.stderr));
                    }
                }
                Err(e) => {
                    println!("Помилка при завершенні процесу {}: {}", pid, e);
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
                        println!("Процес телеграму {} завершено", pid);
                    } else {
                        println!("Не вдалося завершити процес {}: {}", pid, String::from_utf8_lossy(&output.stderr));
                    }
                }
                Err(e) => {
                    println!("Помилка при завершенні процесу {}: {}", pid, e);
                }
            }
        }
    }
    
    Ok(format!("Завершено {} процесів", closed_count))
}

#[tauri::command]
async fn close_single_account(account_id: i32) -> Result<String, String> {
    use std::process::Command;
    
    println!("[LOG] Закриття акаунта #{}", account_id);
    
    #[cfg(target_os = "windows")]
    {
        // Find Telegram processes by window title or command line
        let output = Command::new("tasklist")
            .args(["/FI", "IMAGENAME eq Telegram.exe", "/FO", "CSV", "/NH"])
            .output()
            .map_err(|e| format!("Failed to list processes: {}", e))?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        let mut closed_count = 0;
        let mut found_processes = Vec::new();
        
        println!("[LOG] Tasklist output for account {}:", account_id);
        println!("[LOG] Full output: {}", stdout);
        
        for line in stdout.lines() {
            if line.contains("Telegram.exe") {
                let parts: Vec<&str> = line.split(',').collect();
                if parts.len() >= 2 {
                    let pid_str = parts[1].trim_matches('"');
                    if let Ok(pid) = pid_str.parse::<u32>() {
                        found_processes.push(pid);
                        println!("[LOG] Found Telegram process with PID: {}", pid);
                        
                        // Try to get more details about this process
                        let detail_output = Command::new("tasklist")
                            .args(["/FI", "PID eq", &pid.to_string(), "/FO", "CSV"])
                            .output();
                        
                        if let Ok(detail) = detail_output {
                            let detail_stdout = String::from_utf8_lossy(&detail.stdout);
                            println!("[LOG] Process details for PID {}: {}", pid, detail_stdout);
                        }
                        
                        // Try to kill process
                        match Command::new("taskkill")
                            .args(["/F", "/PID", &pid.to_string()])
                            .output()
                        {
                            Ok(_) => {
                                println!("[LOG] Процес Telegram {} завершено", pid);
                                closed_count += 1;
                            }
                            Err(e) => {
                                println!("[LOG] Помилка завершення процесу {}: {}", pid, e);
                            }
                        }
                    }
                }
            }
        }
        
        println!("[LOG] Found {} Telegram processes, closed {} of them", found_processes.len(), closed_count);
        
        if closed_count > 0 {
            Ok(format!("Закрито {} процесів Telegram", closed_count))
        } else {
            Err("Не знайдено активних процесів Telegram".to_string())
        }
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        // For non-Windows systems
        match Command::new("pkill")
            .args(["-f", "Telegram"])
            .output()
        {
            Ok(_) => Ok("Процеси Telegram завершено".to_string()),
            Err(e) => Err(format!("Помилка завершення процесів: {}", e)),
        }
    }
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
