use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, OnceLock};
use rand::seq::SliceRandom;
use sysinfo::System;
use tauri::Emitter;
use tauri::Manager;
use tauri::WindowEvent;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{TrayIconBuilder, TrayIconEvent};

#[cfg(windows)]
use windows_sys::Win32::System::Console::FreeConsole;
#[cfg(windows)]
use windows_sys::Win32::UI::Shell::SetCurrentProcessExplicitAppUserModelID;
#[cfg(windows)]
use windows_sys::Win32::UI::WindowsAndMessaging::{
    EnumWindows, GetClassNameW, GetWindowTextLengthW, GetWindowTextW, GetWindowThreadProcessId,
    IsWindow, IsWindowVisible, PostMessageW, WM_CLOSE,
};
#[cfg(windows)]
use windows_sys::Win32::Storage::FileSystem::{
    CreateFileW, FILE_ATTRIBUTE_NORMAL, FILE_GENERIC_READ, OPEN_EXISTING,
};
#[cfg(windows)]
use windows_sys::Win32::Foundation::{CloseHandle, GetLastError, INVALID_HANDLE_VALUE};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
use serde::{Deserialize, Serialize};

static TELEGRAM_LAUNCH_CANCELLED: AtomicBool = AtomicBool::new(false);
#[cfg(windows)]
static CHROME_PROFILE_HWNDS: OnceLock<Mutex<HashMap<String, isize>>> = OnceLock::new();
static APP_STARTED_AT: OnceLock<std::time::Instant> = OnceLock::new();

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
    #[serde(rename = "telegramLaunchSpeed", default)]
    telegram_launch_speed: String,
    #[serde(rename = "chromeThreads", default)]
    chrome_threads: String,
    #[serde(rename = "chromeFolderPath", default)]
    chrome_folder_path: String,
}

fn normalize_launch_speed_profile(raw: &str) -> &'static str {
    match raw.trim().to_lowercase().as_str() {
        "fast" => "fast",
        "balanced" => "balanced",
        _ => "conservative",
    }
}

fn launch_spawn_delays_ms(settings: &AppSettings) -> (u64, u64) {
    match normalize_launch_speed_profile(&settings.telegram_launch_speed) {
        "fast" => (1200, 700),
        "balanced" => (2000, 1200),
        _ => (3000, 2000),
    }
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

fn parse_cli_arg(parts: &[String], flag: &str) -> Option<String> {
    let prefix = format!("{flag}=");
    for i in 0..parts.len() {
        let part = parts[i].trim();
        if part == flag {
            if let Some(next) = parts.get(i + 1) {
                let value = next.trim().trim_matches('"').to_string();
                if !value.is_empty() {
                    return Some(value);
                }
            }
            continue;
        }

        if let Some(raw_value) = part.strip_prefix(&prefix) {
            let value = raw_value.trim().trim_matches('"').to_string();
            if !value.is_empty() {
                return Some(value);
            }
        }
    }
    None
}

fn parse_cmd_arg_value_joined(parts: &[String], flag: &str) -> Option<String> {
    let joined = parts.join(" ");
    let parse_tail = |tail: &str| -> Option<String> {
        let rest = tail.trim_start();
        if rest.is_empty() {
            return None;
        }

        if let Some(stripped) = rest.strip_prefix('"') {
            let end = stripped.find('"')?;
            return Some(stripped[..end].to_string());
        }

        // Unquoted value can still contain spaces (e.g. --user-data-dir=C:\...\User Data).
        // Read until next CLI flag marker (" --" or " /...") or end of command line.
        let mut end = rest.len();
        let bytes = rest.as_bytes();
        for i in 0..bytes.len().saturating_sub(1) {
            if bytes[i].is_ascii_whitespace() && (bytes[i + 1] == b'-' || bytes[i + 1] == b'/') {
                end = i;
                break;
            }
        }
        let value = rest[..end].trim().trim_matches('"').to_string();
        if value.is_empty() {
            return None;
        }
        Some(value)
    };

    let mut search_from = 0usize;
    while let Some(rel_idx) = joined[search_from..].find(flag) {
        let idx = search_from + rel_idx;
        let prev_ok = if idx == 0 {
            true
        } else {
            joined[..idx]
                .chars()
                .next_back()
                .map(|ch| ch.is_whitespace())
                .unwrap_or(true)
        };
        if !prev_ok {
            search_from = idx + flag.len();
            continue;
        }

        let after = &joined[(idx + flag.len())..];
        if let Some(tail) = after.strip_prefix('=') {
            return parse_tail(tail);
        }
        if after.chars().next().map(|ch| ch.is_whitespace()).unwrap_or(false) {
            return parse_tail(after);
        }

        search_from = idx + flag.len();
    }

    None
}

fn normalize_profile_directory_name(raw: &str) -> String {
    let trimmed = raw.trim().trim_matches('"').to_string();
    let mut split = trimmed.split_whitespace();
    let first = split.next().unwrap_or_default();
    let second = split.next().unwrap_or_default().trim_matches('"');
    let third = split.next();

    if first.eq_ignore_ascii_case("profile")
        && third.is_none()
        && !second.is_empty()
        && second.chars().all(|ch| ch.is_ascii_digit())
    {
        if let Ok(num) = second.parse::<u32>() {
            return format!("Profile {}", num);
        }
        return format!("Profile {}", second);
    }

    trimmed
}

fn parse_profile_directory_arg(parts: &[String]) -> Option<String> {
    let raw = parse_cli_arg(parts, "--profile-directory")
        .or_else(|| parse_cmd_arg_value_joined(parts, "--profile-directory"))?;

    if raw.eq_ignore_ascii_case("profile") {
        let joined = parts.join(" ");
        let marker = "--profile-directory=";
        if let Some(idx) = joined.find(marker) {
            let tail = joined[(idx + marker.len())..].trim_start();
            let mut split = tail.split_whitespace();
            let first = split.next().unwrap_or_default();
            if first.eq_ignore_ascii_case("profile") {
                if let Some(second) = split.next() {
                    let second_clean = second.trim_matches('"');
                    if second_clean.chars().all(|ch| ch.is_ascii_digit()) {
                        return Some(format!("Profile {}", second_clean));
                    }
                }
            }
        }
    }

    Some(normalize_profile_directory_name(&raw))
}

fn parse_user_data_dir_arg(parts: &[String]) -> Option<String> {
    parse_cli_arg(parts, "--user-data-dir")
        .or_else(|| parse_cmd_arg_value_joined(parts, "--user-data-dir"))
        .map(|value| value.trim_matches('"').to_string())
}

fn parse_profile_from_user_data_dir_arg(parts: &[String]) -> Option<String> {
    let user_data_dir = parse_user_data_dir_arg(parts)?;
    let normalized = user_data_dir.trim().trim_matches('"').replace('\\', "/");
    let last_segment = normalized
        .trim_end_matches('/')
        .rsplit('/')
        .next()
        .unwrap_or_default()
        .trim();
    if last_segment.is_empty() {
        return None;
    }
    let candidate = normalize_profile_directory_name(last_segment);
    let is_profile = candidate
        .strip_prefix("Profile ")
        .map(|rest| !rest.is_empty() && rest.chars().all(|ch| ch.is_ascii_digit()))
        .unwrap_or(false);
    if is_profile {
        Some(candidate)
    } else {
        None
    }
}

#[cfg(windows)]
fn expand_windows_env_markers(value: &str) -> String {
    let chars: Vec<char> = value.chars().collect();
    let mut out = String::new();
    let mut i = 0usize;
    while i < chars.len() {
        if chars[i] == '%' {
            let mut j = i + 1;
            while j < chars.len() && chars[j] != '%' {
                j += 1;
            }
            if j < chars.len() && j > i + 1 {
                let key: String = chars[(i + 1)..j].iter().collect();
                if let Ok(resolved) = std::env::var(&key) {
                    out.push_str(&resolved);
                } else {
                    out.push('%');
                    out.push_str(&key);
                    out.push('%');
                }
                i = j + 1;
                continue;
            }
        }
        out.push(chars[i]);
        i += 1;
    }
    out
}

fn normalize_user_data_dir_for_scope(value: &str) -> String {
    let raw = value.trim().trim_matches('"');
    #[cfg(windows)]
    let expanded = expand_windows_env_markers(raw);
    #[cfg(not(windows))]
    let expanded = raw.to_string();

    let normalized = normalize_path_for_match(&expanded);
    if normalized.is_empty() {
        return normalized;
    }

    if let Ok(canonical) = std::fs::canonicalize(std::path::Path::new(&expanded)) {
        let canonical_norm = normalize_path_for_match(&canonical.to_string_lossy());
        if !canonical_norm.is_empty() {
            return canonical_norm;
        }
    }

    normalized
}

fn cmd_matches_user_data_scope(parts: &[String], expected_norm: &str) -> bool {
    if let Some(raw) = parse_user_data_dir_arg(parts) {
        let candidates = vec![normalize_user_data_dir_for_scope(&raw)];
        if candidates.iter().any(|norm| norm == expected_norm) {
            return true;
        }
        return false;
    }

    let default_norm = default_chrome_user_data_dir()
        .map(|path| normalize_user_data_dir_for_scope(&path.to_string_lossy()));
    default_norm
        .as_deref()
        .map(|norm| norm == expected_norm)
        .unwrap_or(false)
}

fn cmd_matches_user_data_scope_or_unknown(parts: &[String], expected_norm: &str) -> bool {
    if parse_user_data_dir_arg(parts).is_none() {
        let default_norm = default_chrome_user_data_dir()
            .map(|path| normalize_user_data_dir_for_scope(&path.to_string_lossy()));
        return default_norm
            .as_deref()
            .map(|norm| norm == expected_norm)
            .unwrap_or(false);
    }
    cmd_matches_user_data_scope(parts, expected_norm)
}

fn resolve_chrome_exe() -> Option<PathBuf> {
    let mut candidates: Vec<PathBuf> = Vec::new();

    if let Ok(program_files) = std::env::var("ProgramFiles") {
        candidates.push(PathBuf::from(program_files).join("Google\\Chrome\\Application\\chrome.exe"));
    }
    if let Ok(program_files_x86) = std::env::var("ProgramFiles(x86)") {
        candidates.push(PathBuf::from(program_files_x86).join("Google\\Chrome\\Application\\chrome.exe"));
    }

    candidates.into_iter().find(|path| path.exists())
}

fn default_chrome_user_data_dir() -> Option<PathBuf> {
    let local_app_data = std::env::var("LOCALAPPDATA").ok()?;
    Some(PathBuf::from(local_app_data).join("Google\\Chrome\\User Data"))
}

#[cfg(windows)]
fn to_wide_null(path: &Path) -> Vec<u16> {
    let mut wide: Vec<u16> = path.as_os_str().to_string_lossy().encode_utf16().collect();
    wide.push(0);
    wide
}

#[cfg(windows)]
fn is_file_locked_windows(path: &Path) -> bool {
    if !path.exists() {
        return false;
    }
    let wide = to_wide_null(path);
    let handle = unsafe {
        CreateFileW(
            wide.as_ptr(),
            FILE_GENERIC_READ,
            0, // no sharing: fails if file is currently in use
            std::ptr::null_mut(),
            OPEN_EXISTING,
            FILE_ATTRIBUTE_NORMAL,
            0,
        )
    };
    if handle != INVALID_HANDLE_VALUE {
        unsafe {
            CloseHandle(handle);
        }
        return false;
    }
    let err = unsafe { GetLastError() };
    err == 32 || err == 33
}

#[cfg(windows)]
fn is_profile_runtime_locked(profile_path: &Path) -> bool {
    // Use profile-scoped runtime files that are typically held by Chrome only
    // while this specific profile is active.
    let direct_signal_files = [
        "History",
        "Favicons",
        "Top Sites",
        "Visited Links",
        "Web Data",
        "Login Data",
        "Current Session",
        "Current Tabs",
    ];
    for file_name in direct_signal_files {
        let candidate = profile_path.join(file_name);
        if is_file_locked_windows(&candidate) {
            return true;
        }
    }

    let cookies = profile_path.join("Network").join("Cookies");
    if is_file_locked_windows(&cookies) {
        return true;
    }

    let sessions_dir = profile_path.join("Sessions");
    if let Ok(entries) = fs::read_dir(&sessions_dir) {
        for entry in entries.flatten() {
            let fpath = entry.path();
            let fname = entry.file_name().to_string_lossy().to_string();
            if !(fname.starts_with("Session_") || fname.starts_with("Tabs_")) {
                continue;
            }
            if is_file_locked_windows(&fpath) {
                return true;
            }
        }
    }
    false
}

#[cfg(windows)]
fn list_profiles_with_runtime_lock(user_data_dir: &Path) -> Vec<String> {
    let mut result: Vec<String> = Vec::new();
    let entries = match fs::read_dir(user_data_dir) {
        Ok(v) => v,
        Err(_) => return result,
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        let is_profile_dir = name
            .strip_prefix("Profile ")
            .map(|rest| !rest.is_empty() && rest.chars().all(|ch| ch.is_ascii_digit()))
            .unwrap_or(false);
        if !is_profile_dir {
            continue;
        }
        if is_profile_runtime_locked(&path) {
            result.push(name);
        }
    }
    result.sort();
    result.dedup();
    result
}

#[cfg(not(windows))]
fn list_profiles_with_runtime_lock(_user_data_dir: &Path) -> Vec<String> {
    Vec::new()
}

fn list_recently_active_profiles_from_disk(user_data_dir: &Path, window_seconds: u64) -> Vec<String> {
    let now = std::time::SystemTime::now();
    let window = std::time::Duration::from_secs(window_seconds);
    let mut ranked: Vec<(String, std::time::SystemTime)> = Vec::new();

    let entries = match fs::read_dir(user_data_dir) {
        Ok(v) => v,
        Err(_) => return Vec::new(),
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        let is_profile_dir = name
            .strip_prefix("Profile ")
            .map(|rest| !rest.is_empty() && rest.chars().all(|ch| ch.is_ascii_digit()))
            .unwrap_or(false);
        if !is_profile_dir {
            continue;
        }

        #[cfg(windows)]
        {
            // Prefer lock-based signal: captures running profiles even when command line
            // does not expose --profile-directory and file mtimes are stale.
            if is_profile_runtime_locked(&path) {
                ranked.push((name, now));
                continue;
            }
        }

        let signal_files = [
            "Current Session",
            "Current Tabs",
        ];

        let mut latest: Option<std::time::SystemTime> = None;
        for file_name in signal_files {
            let candidate = path.join(file_name);
            if let Ok(meta) = fs::metadata(&candidate) {
                if let Ok(modified) = meta.modified() {
                    latest = Some(match latest {
                        Some(prev) if prev >= modified => prev,
                        _ => modified,
                    });
                }
            }
        }

        // Newer Chrome stores session markers in Profile X/Sessions/Session_* and Tabs_*.
        let sessions_dir = path.join("Sessions");
        if let Ok(entries) = fs::read_dir(&sessions_dir) {
            for entry in entries.flatten() {
                let fpath = entry.path();
                let fname = entry.file_name().to_string_lossy().to_string();
                if !(fname.starts_with("Session_") || fname.starts_with("Tabs_")) {
                    continue;
                }
                if let Ok(meta) = fs::metadata(&fpath) {
                    if let Ok(modified) = meta.modified() {
                        latest = Some(match latest {
                            Some(prev) if prev >= modified => prev,
                            _ => modified,
                        });
                    }
                }
            }
        }

        if let Some(last_seen) = latest {
            if now
                .duration_since(last_seen)
                .map(|age| age <= window)
                .unwrap_or(false)
            {
                ranked.push((name, last_seen));
            }
        }
    }

    ranked.sort_by(|a, b| b.1.cmp(&a.1));
    let mut result: Vec<String> = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();
    for (name, _) in ranked {
        if seen.insert(name.clone()) {
            result.push(name);
        }
    }

    result
}

fn list_running_chrome_processes() -> Vec<(u32, String, String, Vec<String>)> {
    #[cfg(windows)]
    {
        if let Some(processes) = list_running_chrome_processes_windows() {
            return processes;
        }
    }

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
            let is_chrome = name_lower == "chrome.exe"
                || name_lower == "chrome"
                || path_lower.ends_with("\\chrome.exe")
                || path_lower.ends_with("/chrome");

            if !is_chrome {
                return None;
            }

            let pid_num = pid.to_string().parse::<u32>().unwrap_or(0);
            let cmd = process
                .cmd()
                .iter()
                .map(|arg| arg.to_string())
                .collect::<Vec<_>>();

            Some((pid_num, name, path, cmd))
        })
        .collect()
}

#[cfg(windows)]
fn powershell_output_hidden(args: &[&str]) -> Option<std::process::Output> {
    use std::os::windows::process::CommandExt;
    use std::process::Command;

    const CREATE_NO_WINDOW: u32 = 0x08000000;
    Command::new("powershell")
        .creation_flags(CREATE_NO_WINDOW)
        .args(args)
        .output()
        .ok()
}

#[cfg(windows)]
fn get_running_chrome_profiles_windows(expected_user_data_norm: &str) -> Option<Vec<String>> {
    let escaped_expected = expected_user_data_norm.replace('\'', "''");
    let script = format!(
        r#"
$ErrorActionPreference = 'Stop'
$expected = '{escaped_expected}'

function Normalize-PathLike([string]$path) {{
  if ([string]::IsNullOrWhiteSpace($path)) {{ return '' }}
  $p = $path.Trim().Trim('"').ToLower().Replace('\','/')
  if ($p.StartsWith('//?/')) {{ $p = $p.Substring(4) }}
  elseif ($p.StartsWith('/??/')) {{ $p = $p.Substring(4) }}
  while ($p.EndsWith('/')) {{ $p = $p.Substring(0, $p.Length - 1) }}
  return $p
}}

$items = Get-CimInstance Win32_Process | Select-Object Name, CommandLine, ExecutablePath
$profilesScoped = New-Object System.Collections.Generic.HashSet[string]([System.StringComparer]::OrdinalIgnoreCase)
$profilesAny = New-Object System.Collections.Generic.HashSet[string]([System.StringComparer]::OrdinalIgnoreCase)

foreach ($item in $items) {{
  $name = [string]$item.Name
  $exe = [string]$item.ExecutablePath
  $cmd = [string]$item.CommandLine
  if ([string]::IsNullOrWhiteSpace($cmd)) {{ continue }}
  $nameLikeChrome = $name -match '(?i)chrome'
  $exeLikeChrome = $exe -match '(?i)(\\|/)?chrome(\.exe)?$'
  $hasProfileArg = $cmd -match '(?i)--profile-directory(?:=|\s+)'
  if (-not ($nameLikeChrome -or $exeLikeChrome -or $hasProfileArg)) {{ continue }}

  $profile = $null
  if ($cmd -match '--profile-directory=(?:"([^"]+)"|(.+?))(?=\s(?:--|/)|$)') {{
    $profile = if ($matches[1]) {{ $matches[1] }} else {{ $matches[2] }}
  }} elseif ($cmd -match '--profile-directory\s+(?:"([^"]+)"|(.+?))(?=\s(?:--|/)|$)') {{
    $profile = if ($matches[1]) {{ $matches[1] }} else {{ $matches[2] }}
  }}
  $scope = $null
  if ($cmd -match '--user-data-dir=(?:"([^"]+)"|(.+?))(?=\s(?:--|/)|$)') {{
    $scope = if ($matches[1]) {{ $matches[1] }} else {{ $matches[2] }}
  }} elseif ($cmd -match '--user-data-dir\s+(?:"([^"]+)"|(.+?))(?=\s(?:--|/)|$)') {{
    $scope = if ($matches[1]) {{ $matches[1] }} else {{ $matches[2] }}
  }}

  if (-not $profile -and $scope) {{
    $leaf = Split-Path -Path $scope -Leaf
    if ($leaf -match '^(?i:profile)\s+(\d+)$') {{
      $profile = 'Profile ' + [int]$matches[1]
    }}
  }}

  if (-not $profile) {{ continue }}
  $profile = $profile.Trim().Trim('"')
  if ([string]::IsNullOrWhiteSpace($profile)) {{ continue }}

  if ($profile -match '^(?i:profile)\s+(\d+)$') {{
    $profile = 'Profile ' + [int]$matches[1]
  }}

  if ($scope) {{
    $scope = [Environment]::ExpandEnvironmentVariables([string]$scope)
  }} else {{
    $scope = "$env:LOCALAPPDATA\Google\Chrome\User Data"
  }}
  $scopeNorm = Normalize-PathLike $scope
  [void]$profilesAny.Add($profile)
  if ($scopeNorm -eq $expected) {{
    [void]$profilesScoped.Add($profile)
  }}
}}

$out = if ($profilesScoped.Count -gt 0) {{ $profilesScoped.ToArray() }} else {{ $profilesAny.ToArray() }}
$out | Sort-Object | ConvertTo-Json -Compress
"#
    );

    let output = powershell_output_hidden(&["-NoProfile", "-Command", &script])?;
    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8(output.stdout).ok()?;
    let trimmed = stdout.trim();
    if trimmed.is_empty() || trimmed == "null" {
        return Some(Vec::new());
    }

    let json: serde_json::Value = serde_json::from_str(trimmed).ok()?;
    let mut result: Vec<String> = Vec::new();
    match json {
        serde_json::Value::Array(items) => {
            for item in &items {
                if let Some(value) = item.as_str() {
                    let normalized = normalize_profile_directory_name(value);
                    if !normalized.is_empty() {
                        result.push(normalized);
                    }
                }
            }
        }
        serde_json::Value::String(value) => {
            let normalized = normalize_profile_directory_name(&value);
            if !normalized.is_empty() {
                result.push(normalized);
            }
        }
        _ => {}
    }

    result.sort();
    result.dedup();
    Some(result)
}

#[cfg(windows)]
fn list_running_chrome_processes_windows() -> Option<Vec<(u32, String, String, Vec<String>)>> {
    let script = r#"
$ErrorActionPreference = 'Stop'
$items = Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Select-Object ProcessId, CommandLine, ExecutablePath
$items | ConvertTo-Json -Compress
"#;

    let output = powershell_output_hidden(&["-NoProfile", "-Command", script])?;
    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8(output.stdout).ok()?;
    let trimmed = stdout.trim();
    if trimmed.is_empty() {
        return Some(Vec::new());
    }

    let json: serde_json::Value = serde_json::from_str(trimmed).ok()?;
    let mut result: Vec<(u32, String, String, Vec<String>)> = Vec::new();

    let push_item = |item: &serde_json::Value, out: &mut Vec<(u32, String, String, Vec<String>)>| {
        let pid_u64 = item.get("ProcessId").and_then(|v| v.as_u64()).unwrap_or(0);
        let pid = u32::try_from(pid_u64).unwrap_or(0);
        if pid == 0 {
            return;
        }
        let cmd_line = item
            .get("CommandLine")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let exe_path = item
            .get("ExecutablePath")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        out.push((pid, "chrome.exe".to_string(), exe_path, vec![cmd_line]));
    };

    match json {
        serde_json::Value::Array(items) => {
            for item in &items {
                push_item(item, &mut result);
            }
        }
        serde_json::Value::Object(_) => {
            push_item(&json, &mut result);
        }
        _ => {}
    }

    Some(result)
}

#[cfg(windows)]
fn find_chrome_pids_by_profile_windows(profile_name: &str) -> Option<Vec<u32>> {
    let escaped_profile = profile_name.replace('\'', "''");
    let script = format!(
        r#"
$profile = '{escaped_profile}'
$items = Get-CimInstance Win32_Process | Select-Object ProcessId, Name, CommandLine, ExecutablePath
$items = @($items | Where-Object {{
  $name = [string]$_.Name
  $exe = [string]$_.ExecutablePath
  $cmd = [string]$_.CommandLine
  if ([string]::IsNullOrWhiteSpace($cmd)) {{ return $false }}
  $nameLikeChrome = $name -match '(?i)chrome'
  $exeLikeChrome = $exe -match '(?i)(\\|/)?chrome(\.exe)?$'
  $hasProfileArg = $cmd -match '(?i)--profile-directory(?:=|\s+)'
  return ($nameLikeChrome -or $exeLikeChrome -or $hasProfileArg)
}})
$result = @()
foreach ($item in $items) {{
  $cmd = [string]$item.CommandLine
  if ([string]::IsNullOrWhiteSpace($cmd)) {{ continue }}
  $name = $null
  if ($cmd -match '--profile-directory=(?:"([^"]+)"|(.+?))(?=\s(?:--|/)|$)') {{
    $name = if ($matches[1]) {{ $matches[1] }} else {{ $matches[2] }}
  }} elseif ($cmd -match '--profile-directory\s+(?:"([^"]+)"|(.+?))(?=\s(?:--|/)|$)') {{
    $name = if ($matches[1]) {{ $matches[1] }} else {{ $matches[2] }}
  }}
  if ($name) {{ $name = $name.Trim() }}
  if (-not $name -and $cmd -match '--user-data-dir=(?:"([^"]+)"|(.+?))(?=\s(?:--|/)|$)') {{
    $scope = if ($matches[1]) {{ $matches[1] }} else {{ $matches[2] }}
    $leaf = Split-Path -Path $scope -Leaf
    if ($leaf -match '^(?i:profile)\s+(\d+)$') {{
      $name = 'Profile ' + $matches[1]
    }}
  }} elseif (-not $name -and $cmd -match '--user-data-dir\s+(?:"([^"]+)"|(.+?))(?=\s(?:--|/)|$)') {{
    $scope = if ($matches[1]) {{ $matches[1] }} else {{ $matches[2] }}
    $leaf = Split-Path -Path $scope -Leaf
    if ($leaf -match '^(?i:profile)\s+(\d+)$') {{
      $name = 'Profile ' + $matches[1]
    }}
  }}
  if ($name) {{
    if ($name -ieq 'Profile' -and $cmd -match '--profile-directory(?:=|\s+)Profile\s+(\d+)(?=\s(?:--|/)|$)') {{
      $name = 'Profile ' + $matches[1]
    }}
    if ($name -ieq $profile) {{
      $result += [int]$item.ProcessId
    }}
  }}
}}
$result | Sort-Object -Unique | ConvertTo-Json -Compress
"#
    );

    let output = powershell_output_hidden(&["-NoProfile", "-Command", &script])?;
    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8(output.stdout).ok()?;
    let trimmed = stdout.trim();
    if trimmed.is_empty() || trimmed == "null" {
        return Some(Vec::new());
    }

    let json: serde_json::Value = serde_json::from_str(trimmed).ok()?;
    let mut pids: Vec<u32> = Vec::new();
    match json {
        serde_json::Value::Array(items) => {
            for item in &items {
                if let Some(num) = item.as_u64() {
                    if let Ok(pid) = u32::try_from(num) {
                        pids.push(pid);
                    }
                }
            }
        }
        serde_json::Value::Number(num) => {
            if let Some(raw) = num.as_u64() {
                if let Ok(pid) = u32::try_from(raw) {
                    pids.push(pid);
                }
            }
        }
        _ => {}
    }

    Some(pids)
}

#[cfg(windows)]
fn kill_pid_windows_force(pid: u32) -> bool {
    use std::os::windows::process::CommandExt;
    use std::process::Command;
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let taskkill_soft_ok = Command::new("taskkill")
        .creation_flags(CREATE_NO_WINDOW)
        .args(["/T", "/PID", &pid.to_string()])
        .output()
        .map(|out| out.status.success())
        .unwrap_or(false);

    if taskkill_soft_ok {
        return true;
    }

    let close_main_window_ok = Command::new("powershell")
        .creation_flags(CREATE_NO_WINDOW)
        .args([
            "-NoProfile",
            "-Command",
            &format!(
                "$p=Get-Process -Id {} -ErrorAction SilentlyContinue; if($p){{$null=$p.CloseMainWindow(); Start-Sleep -Milliseconds 700; if(-not (Get-Process -Id {} -ErrorAction SilentlyContinue)){{exit 0}}}}; exit 1",
                pid, pid
            ),
        ])
        .output()
        .map(|out| out.status.success())
        .unwrap_or(false);

    if close_main_window_ok {
        return true;
    }

    let taskkill_ok = Command::new("taskkill")
        .creation_flags(CREATE_NO_WINDOW)
        .args(["/F", "/T", "/PID", &pid.to_string()])
        .output()
        .map(|out| out.status.success())
        .unwrap_or(false);

    if taskkill_ok {
        return true;
    }

    Command::new("powershell")
        .creation_flags(CREATE_NO_WINDOW)
        .args([
            "-NoProfile",
            "-Command",
            &format!("Stop-Process -Id {} -Force -ErrorAction SilentlyContinue", pid),
        ])
        .output()
        .map(|out| out.status.success())
        .unwrap_or(false)
}

#[cfg(windows)]
fn chrome_profile_hwnd_store() -> &'static Mutex<HashMap<String, isize>> {
    CHROME_PROFILE_HWNDS.get_or_init(|| Mutex::new(HashMap::new()))
}

#[cfg(windows)]
fn cache_profile_hwnd(profile_name: &str, hwnd: isize) {
    if let Ok(mut guard) = chrome_profile_hwnd_store().lock() {
        guard.insert(profile_name.to_string(), hwnd);
    }
}

#[cfg(windows)]
fn take_cached_profile_hwnd(profile_name: &str) -> Option<isize> {
    chrome_profile_hwnd_store()
        .lock()
        .ok()
        .and_then(|mut guard| guard.remove(profile_name))
}

#[cfg(windows)]
fn get_cached_profile_hwnd(profile_name: &str) -> Option<isize> {
    chrome_profile_hwnd_store()
        .lock()
        .ok()
        .and_then(|guard| guard.get(profile_name).copied())
}

#[cfg(windows)]
fn list_visible_chrome_windows() -> Vec<(isize, u32)> {
    use windows_sys::Win32::Foundation::{BOOL, HWND, LPARAM};

    struct EnumCtx {
        out: Vec<(isize, u32)>,
    }

    unsafe extern "system" fn enum_windows_cb(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let ctx = &mut *(lparam as *mut EnumCtx);
        if IsWindowVisible(hwnd) == 0 {
            return 1;
        }

        let mut class_buf = [0u16; 256];
        let class_len = GetClassNameW(hwnd, class_buf.as_mut_ptr(), class_buf.len() as i32);
        if class_len <= 0 {
            return 1;
        }
        let class_name = String::from_utf16_lossy(&class_buf[..class_len as usize]);
        if class_name != "Chrome_WidgetWin_1" {
            return 1;
        }

        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut pid);
        if pid == 0 {
            return 1;
        }

        ctx.out.push((hwnd as isize, pid));
        1
    }

    let mut ctx = Box::new(EnumCtx { out: Vec::new() });
    unsafe {
        EnumWindows(Some(enum_windows_cb), (&mut *ctx as *mut EnumCtx) as LPARAM);
    }
    ctx.out
}

#[cfg(windows)]
fn find_visible_chrome_windows_by_title_fragment(fragment: &str) -> Vec<isize> {
    use windows_sys::Win32::Foundation::{BOOL, HWND, LPARAM};

    struct EnumCtx {
        out: Vec<isize>,
        fragment_lower: String,
    }

    unsafe extern "system" fn enum_windows_cb(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let ctx = &mut *(lparam as *mut EnumCtx);
        if IsWindowVisible(hwnd) == 0 {
            return 1;
        }

        let mut class_buf = [0u16; 256];
        let class_len = GetClassNameW(hwnd, class_buf.as_mut_ptr(), class_buf.len() as i32);
        if class_len <= 0 {
            return 1;
        }
        let class_name = String::from_utf16_lossy(&class_buf[..class_len as usize]);
        if class_name != "Chrome_WidgetWin_1" {
            return 1;
        }

        let title_len = GetWindowTextLengthW(hwnd);
        if title_len <= 0 {
            return 1;
        }
        let mut title_buf = vec![0u16; (title_len + 1) as usize];
        let copied = GetWindowTextW(hwnd, title_buf.as_mut_ptr(), title_len + 1);
        if copied <= 0 {
            return 1;
        }
        let title = String::from_utf16_lossy(&title_buf[..copied as usize]).to_lowercase();
        if title.contains(&ctx.fragment_lower) {
            ctx.out.push(hwnd as isize);
        }
        1
    }

    let mut ctx = Box::new(EnumCtx {
        out: Vec::new(),
        fragment_lower: fragment.to_lowercase(),
    });
    unsafe {
        EnumWindows(Some(enum_windows_cb), (&mut *ctx as *mut EnumCtx) as LPARAM);
    }
    ctx.out
}

#[cfg(windows)]
fn list_visible_chrome_window_handles() -> Vec<isize> {
    list_visible_chrome_windows()
        .into_iter()
        .map(|(hwnd, _)| hwnd)
        .collect()
}

#[cfg(windows)]
fn post_wm_close(hwnd_raw: isize) -> bool {
    let hwnd = hwnd_raw;
    if unsafe { IsWindow(hwnd) } == 0 {
        return false;
    }
    unsafe { PostMessageW(hwnd, WM_CLOSE, 0, 0) != 0 }
}

#[cfg(windows)]
fn cache_chrome_window_for_profile(profile_name: &str) {
    let Some(pid_list) = find_chrome_pids_by_profile_windows(profile_name) else {
        return;
    };
    if pid_list.is_empty() {
        return;
    }

    let pid_set: HashSet<u32> = pid_list.into_iter().collect();
    let windows = list_visible_chrome_windows();
    if let Some((hwnd, _)) = windows.iter().rev().find(|(_, pid)| pid_set.contains(pid)) {
        cache_profile_hwnd(profile_name, *hwnd);
    }
}

#[cfg(windows)]
fn ensure_profile_hwnd_binding_windows(profile_name: &str) -> bool {
    if let Some(hwnd) = get_cached_profile_hwnd(profile_name) {
        if unsafe { IsWindow(hwnd) } != 0 {
            return true;
        }
        let _ = take_cached_profile_hwnd(profile_name);
    }

    cache_chrome_window_for_profile(profile_name);
    if let Some(hwnd) = get_cached_profile_hwnd(profile_name) {
        if unsafe { IsWindow(hwnd) } != 0 {
            return true;
        }
        let _ = take_cached_profile_hwnd(profile_name);
    }

    let candidates = find_visible_chrome_windows_by_title_fragment(profile_name);
    if candidates.len() == 1 {
        cache_profile_hwnd(profile_name, candidates[0]);
        return true;
    }

    false
}

#[cfg(windows)]
fn close_chrome_profile_windows(profile_name: &str) -> Option<bool> {
    use std::thread;
    use std::time::Duration;
    if !ensure_profile_hwnd_binding_windows(profile_name) {
        return Some(false);
    }

    let Some(cached_hwnd) = get_cached_profile_hwnd(profile_name) else {
        return Some(false);
    };
    if !post_wm_close(cached_hwnd) {
        let _ = take_cached_profile_hwnd(profile_name);
        return Some(false);
    }

    thread::sleep(Duration::from_millis(900));
    if unsafe { IsWindow(cached_hwnd) } == 0 {
        let _ = take_cached_profile_hwnd(profile_name);
        return Some(true);
    }

    Some(true)
}

#[cfg(windows)]
fn try_infer_and_close_profile_by_single_unmapped_window(
    profile_name: &str,
    user_data_dir: &Path,
) -> Option<bool> {
    let debug = detect_running_chrome_profiles(Some(user_data_dir.to_string_lossy().to_string())).ok()?;
    if !debug.final_profiles.iter().any(|name| name == profile_name) {
        return Some(false);
    }

    let mapped = chrome_profile_hwnd_store().lock().ok()?;
    let mapped_profiles: HashSet<String> = mapped.keys().cloned().collect();
    let mapped_hwnds: HashSet<isize> = mapped.values().copied().collect();
    drop(mapped);

    let unmapped_profiles: Vec<String> = debug
        .final_profiles
        .into_iter()
        .filter(|name| !mapped_profiles.contains(name))
        .collect();
    let unmapped_hwnds: Vec<isize> = list_visible_chrome_window_handles()
        .into_iter()
        .filter(|hwnd| !mapped_hwnds.contains(hwnd))
        .collect();

    if unmapped_profiles.len() == 1
        && unmapped_hwnds.len() == 1
        && unmapped_profiles[0] == profile_name
    {
        cache_profile_hwnd(profile_name, unmapped_hwnds[0]);
        return close_chrome_profile_windows(profile_name);
    }

    None
}

#[derive(Debug, Clone, Serialize)]
struct ChromeLaunchResult {
    selected: usize,
    started: usize,
    skipped: usize,
    failed: usize,
}

#[derive(Debug, Clone, Serialize)]
struct ChromeCloseResult {
    target: usize,
    closed: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ChromeRunningProfilesDebug {
    process_profiles: Vec<String>,
    disk_lock_profiles: Vec<String>,
    final_profiles: Vec<String>,
}

fn normalize_path_for_match(value: &str) -> String {
    let mut normalized = value.to_lowercase().replace('\\', "/");
    if let Some(stripped) = normalized.strip_prefix("//?/") {
        normalized = stripped.to_string();
    } else if let Some(stripped) = normalized.strip_prefix("/??/") {
        normalized = stripped.to_string();
    }
    normalized.trim_end_matches('/').to_string()
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

#[cfg(windows)]
fn set_explicit_app_user_model_id() {
    let mut app_id: Vec<u16> = "com.abuseapp.desktop".encode_utf16().collect();
    app_id.push(0);
    // Improves taskbar icon identity matching on first launch after install.
    let _ = unsafe { SetCurrentProcessExplicitAppUserModelID(app_id.as_ptr()) };
}

pub fn run() {
  let _ = APP_STARTED_AT.get_or_init(std::time::Instant::now);
  let is_autostart = std::env::args().any(|arg| arg == "--autostart");

  #[cfg(windows)]
  if is_autostart {
      // Detach from console when started via autostart on Windows.
      unsafe {
          FreeConsole();
      }
  }

  #[cfg(windows)]
  set_explicit_app_user_model_id();

  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_global_shortcut::Builder::new().build())
    .plugin(tauri_plugin_autostart::init(
        tauri_plugin_autostart::MacosLauncher::LaunchAgent,
        Some(vec!["--autostart".into()]),
    ))
    .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.show();
            let _ = window.unminimize();
            let _ = window.set_focus();
        }
    }))
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
      request_telegram_launch_cancel,
      close_single_account,
      get_running_telegram_processes,
      launch_chrome_profiles,
      close_chrome_profiles,
      get_running_chrome_profiles,
      get_running_chrome_profiles_debug,
      get_closable_chrome_profiles,
      launch_single_chrome_profile,
      close_single_chrome_profile,
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
    TELEGRAM_LAUNCH_CANCELLED.store(false, Ordering::SeqCst);
    let settings = load_settings_from_disk();
    let (post_spawn_wait_ms, post_link_wait_ms) = launch_spawn_delays_ms(&settings);

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
    let batch_size = settings
        .telegram_threads
        .trim()
        .parse::<usize>()
        .ok()
        .filter(|size| *size > 0)
        .unwrap_or(1);
    
    for (i, &profile_num) in profiles.iter().enumerate() {
        if TELEGRAM_LAUNCH_CANCELLED.load(Ordering::SeqCst) {
            println!("[LOG] Launch cancelled before TG {}", profile_num);
            break;
        }
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
                    tokio::time::sleep(tokio::time::Duration::from_millis(post_spawn_wait_ms)).await;
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

            if TELEGRAM_LAUNCH_CANCELLED.load(Ordering::SeqCst) {
                println!("[LOG] Launch cancelled before deep link for TG {}", profile_num);
                break;
            }
            
            match Command::new(&telegram_exe_path)
                .args(args)
                .spawn()
            {
                Ok(_child) => {
                    println!("TG {} launched with params {}.", profile_num, link);
                    tokio::time::sleep(tokio::time::Duration::from_millis(post_link_wait_ms)).await;
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
    TELEGRAM_LAUNCH_CANCELLED.store(false, Ordering::SeqCst);
    let settings = load_settings_from_disk();
    let (post_spawn_wait_ms, post_link_wait_ms) = launch_spawn_delays_ms(&settings);

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
        if TELEGRAM_LAUNCH_CANCELLED.load(Ordering::SeqCst) {
            println!("[LOG] Launch cancelled before TG {}", profile_num);
            break;
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
                    tokio::time::sleep(tokio::time::Duration::from_millis(post_spawn_wait_ms)).await;
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

            if TELEGRAM_LAUNCH_CANCELLED.load(Ordering::SeqCst) {
                println!("[LOG] Launch cancelled before deep link for TG {}", profile_num);
                break;
            }

            match Command::new(&telegram_exe_path)
                .args(args)
                .spawn()
            {
                Ok(_child) => {
                    println!("TG {} launched with params {}.", profile_num, link);
                    tokio::time::sleep(tokio::time::Duration::from_millis(post_link_wait_ms)).await;
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
async fn request_telegram_launch_cancel() -> Result<(), String> {
    TELEGRAM_LAUNCH_CANCELLED.store(true, Ordering::SeqCst);
    Ok(())
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
    let app_type = link_params.app_type.trim();
    let raw_ref_link = link_params.ref_link.trim();

    if !app_type.is_empty() {
        link += &format!("&appname={}", app_type);

        // Extract startapp/start payload from a full URL when possible.
        let payload = if raw_ref_link.is_empty() {
            String::new()
        } else if raw_ref_link.contains("startapp=") || raw_ref_link.contains("start=") {
            if let Ok(url) = url::Url::parse(raw_ref_link) {
                url.query_pairs()
                    .find(|(key, _)| key == "startapp" || key == "start")
                    .map(|(_, value)| value.to_string())
                    .unwrap_or_else(|| {
                        println!("[LOG] Failed to extract startapp/start, using ref_link as is");
                        raw_ref_link.to_string()
                    })
            } else {
                println!("[LOG] Failed to parse URL, using ref_link as is");
                raw_ref_link.to_string()
            }
        } else {
            raw_ref_link.to_string()
        };

        if !payload.is_empty() {
            link += &format!("&startapp={}", payload);
        } else {
            println!("[LOG] app_type provided without payload, using appname only");
        }
    } else if !raw_ref_link.is_empty() {
        link += &format!("&start={}", raw_ref_link);
        println!("[LOG] Using start without app_type");
    } else {
        println!("[LOG] No app_type/ref_link payload, using domain-only resolve link");
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
    if let Some(v) = settings.get("telegramLaunchSpeed").and_then(|v| v.as_str()) {
        current.telegram_launch_speed = v.to_string();
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

#[tauri::command]
async fn launch_chrome_profiles(
    chrome_folder_path: String,
    start_range: i32,
    end_range: i32,
    mixed: bool,
    target_url: Option<String>,
) -> Result<ChromeLaunchResult, String> {
    use std::process::Command;

    if start_range <= 0 || end_range <= 0 || end_range < start_range {
        return Err("Invalid range for Chrome profiles".to_string());
    }

    let chrome_exe = resolve_chrome_exe()
        .ok_or_else(|| "Chrome executable was not found in Program Files".to_string())?;

    let user_data_dir = if chrome_folder_path.trim().is_empty() {
        default_chrome_user_data_dir()
            .ok_or_else(|| "Cannot resolve Chrome User Data directory".to_string())?
    } else {
        PathBuf::from(chrome_folder_path.trim())
    };

    if !user_data_dir.exists() {
        return Err(format!(
            "Chrome profiles directory not found: {}",
            user_data_dir.to_string_lossy()
        ));
    }

    let mut profiles: Vec<(i32, String)> = fs::read_dir(&user_data_dir)
        .map_err(|e| format!("Failed to read Chrome profiles directory: {e}"))?
        .flatten()
        .filter_map(|entry| {
            let is_dir = entry.file_type().ok()?.is_dir();
            if !is_dir {
                return None;
            }
            let name = entry.file_name().to_string_lossy().to_string();
            if !name.starts_with("Profile ") {
                return None;
            }
            let num = name
                .strip_prefix("Profile ")
                .and_then(|raw| raw.parse::<i32>().ok())?;
            if num < start_range || num > end_range {
                return None;
            }
            Some((num, name))
        })
        .collect();

    profiles.sort_by_key(|(num, _)| *num);
    if mixed {
        let mut rng = rand::thread_rng();
        profiles.shuffle(&mut rng);
    }

    let user_data_norm = normalize_user_data_dir_for_scope(&user_data_dir.to_string_lossy());
    let mut opened_profiles: HashSet<String> = HashSet::new();
    for (_pid, _name, _path, cmd) in list_running_chrome_processes() {
        if !cmd_matches_user_data_scope_or_unknown(&cmd, user_data_norm.as_str()) {
            continue;
        }
        if let Some(profile) =
            parse_profile_directory_arg(&cmd).or_else(|| parse_profile_from_user_data_dir_arg(&cmd))
        {
            opened_profiles.insert(profile);
        }
    }

    let mut started = 0usize;
    let mut skipped = 0usize;
    let mut failed = 0usize;
    let url = target_url
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());

    for (_num, profile_name) in &profiles {
        if opened_profiles.contains(profile_name) {
            skipped += 1;
            continue;
        }
        #[cfg(windows)]
        let before_hwnds: HashSet<isize> = list_visible_chrome_window_handles().into_iter().collect();

        let mut args = vec![
            format!("--user-data-dir={}", user_data_dir.to_string_lossy()),
            format!("--profile-directory={profile_name}"),
        ];
        if let Some(target) = &url {
            args.push(target.clone());
        }

        match Command::new(&chrome_exe).args(args).spawn() {
            Ok(_) => {
                started += 1;
                opened_profiles.insert(profile_name.clone());
                tokio::time::sleep(tokio::time::Duration::from_millis(600)).await;
                #[cfg(windows)]
                {
                    let mut cached = false;
                    for _ in 0..12 {
                        let after = list_visible_chrome_window_handles();
                        if let Some(hwnd) = after.into_iter().find(|hwnd| !before_hwnds.contains(hwnd)) {
                            cache_profile_hwnd(profile_name.as_str(), hwnd);
                            cached = true;
                            break;
                        }
                        tokio::time::sleep(tokio::time::Duration::from_millis(150)).await;
                    }
                    if !cached {
                        cache_chrome_window_for_profile(profile_name.as_str());
                    }
                }
            }
            Err(_) => {
                failed += 1;
            }
        }
    }

    Ok(ChromeLaunchResult {
        selected: profiles.len(),
        started,
        skipped,
        failed,
    })
}

#[tauri::command]
async fn close_chrome_profiles(chrome_folder_path: String) -> Result<ChromeCloseResult, String> {
    let user_data_dir = if chrome_folder_path.trim().is_empty() {
        default_chrome_user_data_dir()
            .ok_or_else(|| "Cannot resolve Chrome User Data directory".to_string())?
    } else {
        PathBuf::from(chrome_folder_path.trim())
    };

    let user_data_norm = normalize_path_for_match(&user_data_dir.to_string_lossy());
    let mut system = System::new_all();
    system.refresh_processes();

    let target_pids: Vec<u32> = system
        .processes()
        .iter()
        .filter_map(|(pid, process)| {
            let name = process.name().to_string().to_lowercase();
            if !(name == "chrome.exe" || name == "chrome") {
                return None;
            }
            let cmd = process
                .cmd()
                .iter()
                .map(|arg| arg.to_string())
                .collect::<Vec<_>>();
            if !cmd_matches_user_data_scope(&cmd, user_data_norm.as_str()) {
                return None;
            }
            pid.to_string().parse::<u32>().ok()
        })
        .collect();

    let mut closed = 0usize;
    for pid in &target_pids {
        #[cfg(target_os = "windows")]
        {
            if kill_pid_windows_force(*pid) {
                closed += 1;
            }
        }

        #[cfg(not(target_os = "windows"))]
        {
            use std::process::Command;
            if Command::new("kill")
                .arg("-9")
                .arg(pid.to_string())
                .output()
                .map(|output| output.status.success())
                .unwrap_or(false)
            {
                closed += 1;
            }
        }
    }

    Ok(ChromeCloseResult {
        target: target_pids.len(),
        closed,
    })
}

#[tauri::command]
async fn get_running_chrome_profiles(chrome_folder_path: Option<String>) -> Result<Vec<String>, String> {
    let debug = detect_running_chrome_profiles(chrome_folder_path)?;
    Ok(debug.final_profiles)
}

fn detect_running_chrome_profiles(
    chrome_folder_path: Option<String>,
) -> Result<ChromeRunningProfilesDebug, String> {
    let user_data_dir = match chrome_folder_path {
        Some(path) if !path.trim().is_empty() => PathBuf::from(path.trim()),
        _ => default_chrome_user_data_dir()
            .ok_or_else(|| "Cannot resolve Chrome User Data directory".to_string())?,
    };
    let user_data_norm = normalize_user_data_dir_for_scope(&user_data_dir.to_string_lossy());

    let mut running: HashSet<String> = HashSet::new();
    let mut process_profiles: HashSet<String> = HashSet::new();

    #[cfg(windows)]
    {
        if let Some(list) = get_running_chrome_profiles_windows(user_data_norm.as_str()) {
            for item in list {
                process_profiles.insert(item.clone());
                running.insert(item);
            }
        } else {
            let mut running_scoped: HashSet<String> = HashSet::new();
            let mut running_any_scope: HashSet<String> = HashSet::new();
            for (_pid, _name, _path, cmd) in list_running_chrome_processes() {
                if let Some(profile) =
                    parse_profile_directory_arg(&cmd).or_else(|| parse_profile_from_user_data_dir_arg(&cmd))
                {
                    running_any_scope.insert(profile.clone());
                    if cmd_matches_user_data_scope_or_unknown(&cmd, user_data_norm.as_str()) {
                        running_scoped.insert(profile);
                    }
                }
            }
            let base = if running_scoped.is_empty() { running_any_scope } else { running_scoped };
            for item in base {
                process_profiles.insert(item.clone());
                running.insert(item);
            }
        }
    }

    #[cfg(not(windows))]
    {
        let mut running_scoped: HashSet<String> = HashSet::new();
        let mut running_any_scope: HashSet<String> = HashSet::new();
        for (_pid, _name, _path, cmd) in list_running_chrome_processes() {
            if let Some(profile) =
                parse_profile_directory_arg(&cmd).or_else(|| parse_profile_from_user_data_dir_arg(&cmd))
            {
                running_any_scope.insert(profile.clone());
                if cmd_matches_user_data_scope_or_unknown(&cmd, user_data_norm.as_str()) {
                    running_scoped.insert(profile);
                }
            }
        }
        let base = if running_scoped.is_empty() { running_any_scope } else { running_scoped };
        for item in base {
            process_profiles.insert(item.clone());
            running.insert(item);
        }
    }

    let disk_lock_profiles = list_profiles_with_runtime_lock(&user_data_dir);
    let running_chrome_exists = !list_running_chrome_processes().is_empty();
    // Disk fallback is only needed when process-level detection is incomplete
    // (commonly only "Profile 1" is visible in command line).
    if running_chrome_exists && running.len() <= 1 {
        for profile in &disk_lock_profiles {
            running.insert(profile.clone());
        }
        // Use mtime-based fallback only if lock-based detection found nothing.
        // This avoids stale "active" profiles after manual close.
        let app_uptime_secs = APP_STARTED_AT
            .get()
            .map(|started| started.elapsed().as_secs())
            .unwrap_or(999);
        if disk_lock_profiles.is_empty() && app_uptime_secs >= 12 {
            let recent_profiles = list_recently_active_profiles_from_disk(&user_data_dir, 300);
            for profile in recent_profiles.into_iter().take(8) {
                running.insert(profile);
            }
        }
    }

    let mut process_list = process_profiles.into_iter().collect::<Vec<_>>();
    process_list.sort();
    let mut final_list = running.into_iter().collect::<Vec<_>>();
    final_list.sort();

    Ok(ChromeRunningProfilesDebug {
        process_profiles: process_list,
        disk_lock_profiles,
        final_profiles: final_list,
    })
}

#[tauri::command]
async fn get_running_chrome_profiles_debug(
    chrome_folder_path: Option<String>,
) -> Result<ChromeRunningProfilesDebug, String> {
    detect_running_chrome_profiles(chrome_folder_path)
}

#[tauri::command]
async fn get_closable_chrome_profiles(
    chrome_folder_path: Option<String>,
) -> Result<Vec<String>, String> {
    let debug = detect_running_chrome_profiles(chrome_folder_path)?;

    #[cfg(windows)]
    {
        let mut closable = debug
            .final_profiles
            .into_iter()
            .filter(|profile| ensure_profile_hwnd_binding_windows(profile.as_str()))
            .collect::<Vec<_>>();
        closable.sort();
        closable.dedup();
        return Ok(closable);
    }

    #[cfg(not(windows))]
    {
        let mut closable = debug.final_profiles;
        closable.sort();
        closable.dedup();
        Ok(closable)
    }
}

#[tauri::command]
async fn launch_single_chrome_profile(
    chrome_folder_path: String,
    profile_name: String,
    target_url: Option<String>,
) -> Result<bool, String> {
    use std::process::Command;

    let profile = profile_name.trim().to_string();
    if profile.is_empty() {
        return Err("Profile name is required".to_string());
    }

    let chrome_exe = resolve_chrome_exe()
        .ok_or_else(|| "Chrome executable was not found in Program Files".to_string())?;
    let user_data_dir = if chrome_folder_path.trim().is_empty() {
        default_chrome_user_data_dir()
            .ok_or_else(|| "Cannot resolve Chrome User Data directory".to_string())?
    } else {
        PathBuf::from(chrome_folder_path.trim())
    };
    let profile_dir = user_data_dir.join(&profile);
    if !profile_dir.exists() {
        return Err(format!("Profile directory not found: {}", profile_dir.to_string_lossy()));
    }

    let user_data_norm = normalize_user_data_dir_for_scope(&user_data_dir.to_string_lossy());
    for (_pid, _name, _path, cmd) in list_running_chrome_processes() {
        if !cmd_matches_user_data_scope(&cmd, user_data_norm.as_str()) {
            continue;
        }
        if let Some(cmd_profile) =
            parse_profile_directory_arg(&cmd).or_else(|| parse_profile_from_user_data_dir_arg(&cmd))
        {
            if cmd_profile == profile {
                return Ok(false);
            }
        }
    }

    let mut args = vec![
        format!("--user-data-dir={}", user_data_dir.to_string_lossy()),
        format!("--profile-directory={profile}"),
    ];
    if let Some(url) = target_url {
        let trimmed = url.trim();
        if !trimmed.is_empty() {
            args.push(trimmed.to_string());
        }
    }

    #[cfg(windows)]
    let before_hwnds: HashSet<isize> = list_visible_chrome_window_handles().into_iter().collect();

    Command::new(chrome_exe)
        .args(args)
        .spawn()
        .map_err(|e| format!("Failed to launch Chrome profile: {e}"))?;

    #[cfg(windows)]
    {
        let mut cached = false;
        for _ in 0..12 {
            let after = list_visible_chrome_window_handles();
            if let Some(hwnd) = after.into_iter().find(|hwnd| !before_hwnds.contains(hwnd)) {
                cache_profile_hwnd(profile.as_str(), hwnd);
                cached = true;
                break;
            }
            tokio::time::sleep(tokio::time::Duration::from_millis(150)).await;
        }
        if !cached {
            cache_chrome_window_for_profile(profile.as_str());
        }
    }

    Ok(true)
}

#[tauri::command]
async fn close_single_chrome_profile(
    chrome_folder_path: String,
    profile_name: String,
) -> Result<bool, String> {
    let profile = profile_name.trim().to_string();
    if profile.is_empty() {
        return Err("Profile name is required".to_string());
    }

    #[cfg(windows)]
    {
        let user_data_dir = if chrome_folder_path.trim().is_empty() {
            default_chrome_user_data_dir()
                .ok_or_else(|| "Cannot resolve Chrome User Data directory".to_string())?
        } else {
            PathBuf::from(chrome_folder_path.trim())
        };

        if close_chrome_profile_windows(profile.as_str()).unwrap_or(false) {
            return Ok(true);
        }

        if try_infer_and_close_profile_by_single_unmapped_window(profile.as_str(), &user_data_dir)
            .unwrap_or(false)
        {
            return Ok(true);
        }

        let mut closed_any = false;
        if let Some(pids) = find_chrome_pids_by_profile_windows(profile.as_str()) {
            for pid in pids {
                if kill_pid_windows_force(pid) {
                    closed_any = true;
                }
            }
        }
        return Ok(closed_any);
    }

    #[cfg(not(windows))]
    {
        let user_data_dir = if _chrome_folder_path.trim().is_empty() {
            default_chrome_user_data_dir()
                .ok_or_else(|| "Cannot resolve Chrome User Data directory".to_string())?
        } else {
            PathBuf::from(_chrome_folder_path.trim())
        };
        let user_data_norm = normalize_user_data_dir_for_scope(&user_data_dir.to_string_lossy());

        let target_pids: Vec<u32> = list_running_chrome_processes()
            .into_iter()
            .filter_map(|(pid, _name, _path, cmd)| {
                if !cmd_matches_user_data_scope_or_unknown(&cmd, user_data_norm.as_str()) {
                    return None;
                }
                let cmd_profile =
                    parse_profile_directory_arg(&cmd).or_else(|| parse_profile_from_user_data_dir_arg(&cmd));
                if cmd_profile.as_deref() != Some(profile.as_str()) {
                    return None;
                }
                Some(pid)
            })
            .collect();

        let mut closed_any = false;
        for pid in target_pids {
            use std::process::Command;
            if Command::new("kill")
                .arg("-9")
                .arg(pid.to_string())
                .output()
                .map(|output| output.status.success())
                .unwrap_or(false)
            {
                closed_any = true;
            }
        }

        return Ok(closed_any);
    }
}








