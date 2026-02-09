import { invoke } from '@tauri-apps/api/core';

// Account related API calls
export const getAccounts = async () => {
  return await invoke('get_accounts');
};

export const launchAccounts = async (accountIds: string[]) => {
  return await invoke('launch_accounts', { accountIds });
};

export const getAccountStats = async () => {
  return await invoke('get_account_stats');
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
  return await invoke('get_recent_actions');
};

// Tasks related API calls
export const getDailyTasks = async () => {
  return await invoke('get_daily_tasks');
};

export const updateDailyTask = async (taskId: string, completed: boolean) => {
  return await invoke('update_daily_task', { taskId, completed });
};

// Test function
export const greet = async (name: string) => {
  return await invoke('greet', { name });
};
