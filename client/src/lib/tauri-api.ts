import { invoke } from '@tauri-apps/api/core';

type AccountStats = {
  total: number;
  running: number;
  active: number;
  blocked: number;
  unknown?: number;
  telegramFolderPath?: string;
  reason?: string;
};

// Account related API calls
export const getAccounts = async () => {
  return await invoke<any[]>('get_accounts');
};

export const launchAccounts = async (accountIds: string[]) => {
  return await invoke('launch_accounts', { accountIds });
};

export const launchSingleAccount = async (accountId: number, telegramFolderPath: string) => {
  return await invoke('launch_single_account', { accountId, telegramFolderPath });
};

export const launchAccountsBatch = async (linkParams: any, startRange: number, endRange: number, telegramFolderPath: string) => {
  return await invoke('launch_accounts_batch', { 
    linkParams, 
    startRange, 
    endRange, 
    telegramFolderPath 
  });
};

export const getAvailableLinks = async () => {
  return await invoke('get_available_links');
};

export const buildTelegramLink = async (params: any) => {
  return await invoke('build_telegram_link', { params });
};

export const closeTelegramProcesses = async (pids: number[]) => {
  return await invoke('close_telegram_processes', { pids });
};

export const closeSingleAccount = async (accountId: number) => {
  return await invoke('close_single_account', { accountId });
};

export const getRunningTelegramProcesses = async () => {
  return await invoke<Array<{ pid: number; name: string; path: string }>>('get_running_telegram_processes');
};

export const getAccountStats = async (
  telegramFolderPathOrQueryContext?: string | { queryKey?: unknown[] }
) => {
  const telegramFolderPath =
    typeof telegramFolderPathOrQueryContext === 'string'
      ? telegramFolderPathOrQueryContext
      : undefined;

  return await invoke<AccountStats>('get_account_stats', { telegramFolderPath });
};

export const updateAccountStatus = async (accountId: string, status: string) => {
  return await invoke('update_account_status', { accountId, status });
};

// Settings related API calls
export const getSettings = async () => {
  return await invoke('get_settings');
};

export const saveSettings = async (settings: any) => {
  return await invoke('save_settings', { settings });
};

// Actions related API calls
export const getRecentActions = async () => {
  return await invoke<any[]>('get_recent_actions');
};

// Tasks related API calls
export const getDailyTasks = async () => {
  return await invoke<any[]>('get_daily_tasks');
};

export const updateDailyTask = async (taskId: string, completed: boolean) => {
  return await invoke('update_daily_task', { taskId, completed });
};

// Test function
export const greet = async (name: string) => {
  return await invoke('greet', { name });
};

// Directory related API calls
export const readDirectory = async (path: string) => {
  return await invoke('read_directory', { path });
};

export const openDirectoryDialog = async () => {
  return await invoke('open_directory_dialog');
};
