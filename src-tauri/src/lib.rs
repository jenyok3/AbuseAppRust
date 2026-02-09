#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      greet,
      get_accounts,
      launch_accounts,
      get_settings,
      save_settings,
      get_account_stats,
      update_account_status,
      get_recent_actions,
      get_daily_tasks,
      update_daily_task
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
            "lastActive": "2024-02-09T08:15:00Z"
        })
    ];
    Ok(accounts)
}

#[tauri::command]
async fn launch_accounts(account_ids: Vec<String>) -> Result<String, String> {
    // TODO: Implement actual account launching logic
    println!("Launching accounts: {:?}", account_ids);
    Ok(format!("Successfully launched {} accounts", account_ids.len()))
}

#[tauri::command]
async fn get_settings() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({
        "telegram_threads": 1,
        "chrome_threads": 1,
        "telegram_folder_path": "C:\\Users\\Admin\\Documents\\TelegramAccounts",
        "chrome_folder_path": "C:\\Users\\Admin\\Documents\\ChromeAccounts"
    }))
}

#[tauri::command]
async fn save_settings(settings: serde_json::Value) -> Result<String, String> {
    // TODO: Implement actual settings saving
    println!("Saving settings: {:?}", settings);
    Ok("Settings saved successfully".to_string())
}

#[tauri::command]
async fn get_account_stats() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({
        "active": 15,
        "blocked": 5,
        "total": 20
    }))
}

#[tauri::command]
async fn update_account_status(account_id: String, status: String) -> Result<String, String> {
    // TODO: Implement actual status update
    println!("Updating account {} status to {}", account_id, status);
    Ok("Account status updated".to_string())
}

#[tauri::command]
async fn get_recent_actions() -> Result<Vec<serde_json::Value>, String> {
    Ok(vec![
        serde_json::json!({
            "id": "1",
            "action": "Запуск акаунта",
            "account": "Account 1",
            "time": "10:30",
            "status": "success"
        }),
        serde_json::json!({
            "id": "2", 
            "action": "Зупинка акаунта",
            "account": "Account 2",
            "time": "09:45",
            "status": "success"
        }),
        serde_json::json!({
            "id": "3",
            "action": "Перевірка статусу",
            "account": "Account 3", 
            "time": "08:15",
            "status": "pending"
        })
    ])
}

#[tauri::command]
async fn get_daily_tasks() -> Result<Vec<serde_json::Value>, String> {
    Ok(vec![
        serde_json::json!({
            "id": "1",
            "title": "Запуск 10 акаунтів Telegram",
            "completed": false,
            "priority": "high"
        }),
        serde_json::json!({
            "id": "2",
            "title": "Перевірка статусу всіх акаунтів", 
            "completed": true,
            "priority": "medium"
        }),
        serde_json::json!({
            "id": "3",
            "title": "Оновлення налаштувань Chrome",
            "completed": false,
            "priority": "low"
        })
    ])
}

#[tauri::command]
async fn update_daily_task(task_id: String, completed: bool) -> Result<String, String> {
    // TODO: Implement actual task update
    println!("Updating task {} completed to {}", task_id, completed);
    Ok("Task updated".to_string())
}
