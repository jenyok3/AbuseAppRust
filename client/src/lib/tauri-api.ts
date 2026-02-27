import { invoke } from "@tauri-apps/api/core";
import { localStore } from "@/lib/localStore";
import { accountStatus, type AccountStatus } from "@/lib/accountStatus";

export type AccountStats = {
  total: number;
  running: number;
  active: number;
  blocked: number;
};

export type TauriAccount = {
  id: string;
  name: string;
  status: string;
  type: string;
  lastActive?: string;
};

export type RecentAction = {
  id: string;
  action: string;
  account: string;
  time: string;
  status: "success" | "pending" | "failed";
};

export type DailyTaskItem = {
  id: string;
  title: string;
  completed: boolean;
  priority: "high" | "medium" | "low";
};

// Account related API calls
export const getAccounts = async (): Promise<TauriAccount[]> => {
  const accounts = localStore.getAccounts();
  return accounts.map((account) => ({
    id: String(account.id),
    name: String(account.name ?? account.id),
    status: String(account.status ?? accountStatus.inactive),
    type: "telegram",
    lastActive: account.lastActive ? String(account.lastActive) : "",
  }));
};

export const launchAccounts = async (accountIds: string[]) => {
  return await invoke("launch_accounts", { accountIds });
};

export const launchSingleAccount = async (accountId: number, telegramFolderPath: string) => {
  return await invoke("launch_single_account", { accountId, telegramFolderPath });
};

export const launchAccountsBatch = async (
  linkParams: unknown,
  startRange: number,
  endRange: number,
  telegramFolderPath: string
) => {
  return await invoke("launch_accounts_batch", {
    linkParams,
    startRange,
    endRange,
    telegramFolderPath,
  });
};

export const launchAccountsForProfiles = async (
  linkParams: unknown,
  profileIds: number[],
  telegramFolderPath: string
) => {
  return await invoke("launch_accounts_for_profiles", {
    linkParams,
    profileIds,
    telegramFolderPath,
  });
};

export const getAvailableLinks = async () => {
  return await invoke("get_available_links");
};

export const buildTelegramLink = async (params: unknown) => {
  return await invoke("build_telegram_link", { linkParams: params });
};

export const closeTelegramProcesses = async (pids: number[]) => {
  return await invoke("close_telegram_processes", { pids });
};

export const closeTelegramAccountsBatch = async (accountIds: number[]) => {
  return await invoke("close_telegram_accounts_batch", { accountIds });
};

export const getTelegramPidsForAccounts = async (accountIds: number[]) => {
  return await invoke<number[]>("get_telegram_pids_for_accounts", { accountIds });
};

export const closeSingleAccount = async (accountId: number) => {
  return await invoke("close_single_account", { accountId });
};

export const getRunningTelegramProcesses = async () => {
  return await invoke<Array<{ pid: number; name: string; path: string }>>("get_running_telegram_processes");
};

export const getAccountStats = async (
  telegramFolderPathOrQueryContext?: string | { queryKey?: unknown[] }
) => {
  const telegramFolderPath =
    typeof telegramFolderPathOrQueryContext === "string"
      ? telegramFolderPathOrQueryContext
      : undefined;

  return await invoke<AccountStats>("get_account_stats", { telegramFolderPath });
};

export const updateAccountStatus = async (accountId: string, status: string) => {
  const id = Number(accountId);
  if (Number.isFinite(id)) {
    localStore.updateAccountStatus(id, status as AccountStatus);
  }
  return;
};

// Settings related API calls
export const getSettings = async () => {
  return await invoke("get_settings");
};

export const saveSettings = async (settings: unknown) => {
  return await invoke("save_settings", { settings });
};

// Actions related API calls
export const getRecentActions = async (): Promise<RecentAction[]> => {
  const logs = localStore.getLogs();
  return logs.slice(0, 50).map((entry) => ({
    id: String(entry.id),
    action: String(entry.message ?? "action"),
    account: "local",
    time: new Date(entry.timestamp).toLocaleTimeString(),
    status: "success",
  }));
};

// Tasks related API calls
export const getDailyTasks = async (): Promise<DailyTaskItem[]> => {
  const tasks = localStore.getDailyTasks();
  return tasks.map((task) => ({
    id: String(task.id),
    title: String(task.title ?? ""),
    completed: Boolean(task.isCompleted),
    priority: "medium",
  }));
};

export const updateDailyTask = async (taskId: string, completed: boolean) => {
  return await invoke("update_daily_task", { taskId, completed });
};

// Test function
export const greet = async (name: string) => {
  return await invoke("greet", { name });
};

// Directory related API calls
export const readDirectory = async (path: string) => {
  return await invoke("read_directory", { path });
};

export const openDirectoryDialog = async () => {
  return await invoke("open_directory_dialog");
};
