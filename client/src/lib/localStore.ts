import { accountStatus, type AccountStatus } from "@/lib/accountStatus";

export type LocalProject = {
  id: number;
  name: string;
  type: "telegram" | "chrome";
  link?: string;
  createdAt: number;
  appName?: string;
  appType?: string;
  refLink?: string;
  mixed?: string;
};

export type LocalAccount = {
  id: number;
  name: string;
  status: AccountStatus;
  notes?: string;
  hashtags?: string[];
  projectId?: number | null;
  lastActive?: number | string;
  [key: string]: unknown;
};

export type LocalDailyTask = {
  id: number;
  title: string;
  isCompleted: boolean;
  remindAt?: number | null;
  remindedAt?: number | null;
  repeatRule?: DailyReminderRepeat;
};

export type DailyReminderRepeat =
  | "never"
  | "daily"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "semiannual"
  | "yearly";

export type LocalLog = {
  id: number;
  message: string;
  timestamp: number;
};

export type LocalHashtagMeta = {
  tag: string;
  link?: string;
};

export type LocalSettings = {
  telegramThreads: string;
  telegramFolderPath: string;
  chromeThreads: string;
  chromeFolderPath: string;
  themeEffect?: "none" | "winter" | "autumn" | "spring" | "summer";
  themeSnowSpeed?: number;
};

export type LocalUser = {
  id: string;
  name: string;
  username?: string;
  avatarUrl?: string;
  provider: "telegram";
};

export type TelegramLaunchParams = {
  api_id: string;
  api_hash: string;
  phone: string;
  app_name: string;
  app_type: string;
  ref_link: string;
  mixed: string;
};

export type TelegramLaunchState = {
  selectedProject: string;
  startRange: string;
  endRange: string;
  isMix: boolean;
  launchedPids: number[];
  pendingProfiles: number[];
  batchSize: number;
  launchParams: TelegramLaunchParams | null;
  totalProfiles: number;
  launchMode?: "project" | "plain" | null;
  updatedAt: number;
};

const STORAGE_KEYS = {
  projects: "abuseapp.projects",
  accounts: "abuseapp.accounts",
  dailyTasks: "abuseapp.dailyTasks",
  logs: "abuseapp.logs",
  dailyResetDate: "abuseapp.dailyResetDate",
  hashtagMeta: "abuseapp.hashtagMeta",
  settings: "appSettings",
  legacyProjects: "telegram_projects",
  telegramLaunch: "abuseapp.telegramLaunch",
  authUser: "abuseapp.authUser",
  authOnboardingSeen: "abuseapp.authOnboardingSeen",
} as const;

const DEFAULT_SETTINGS: LocalSettings = {
  telegramThreads: "1",
  telegramFolderPath: "",
  chromeThreads: "1",
  chromeFolderPath: "",
  themeEffect: "none",
  themeSnowSpeed: 1,
};
const LOG_RETENTION_MS = 24 * 60 * 60 * 1000;

const RECENT_LOG_ALLOWLIST: RegExp[] = [
  /додано проєкт/i,
  /оновлено проєкт/i,
  /видалено проєкт/i,
  /додано кастомний проєкт/i,
  /запущено .+/i,
  /продовжено запуск/i,
  /завершено .+/i,
  /додано хештег/i,
  /видалено хештег .* з усіх акаунтів/i,
  /оновлено хештег/i,
  /додано щоденне завдання/i,
  /видалено щоденне завдання/i,
  /заплановано нагадування/i,
  /скасовано нагадування/i,
  /нагадування:/i,
];

function shouldKeepRecentLogMessage(message: unknown): boolean {
  const text = String(message ?? "").trim();
  if (!text) return false;
  return RECENT_LOG_ALLOWLIST.some((pattern) => pattern.test(text));
}

function getLocalDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function ensureDailyReset() {
  if (typeof localStorage === "undefined") return;
  const todayKey = getLocalDateKey();
  const lastReset = readJson<string>(STORAGE_KEYS.dailyResetDate, "");
  if (lastReset === todayKey) return;

  const tasks = readJson<LocalDailyTask[]>(STORAGE_KEYS.dailyTasks, []);
  if (Array.isArray(tasks)) {
    const nextTasks = tasks.map((task) => ({
      ...task,
      isCompleted: false,
    }));
    writeJson(STORAGE_KEYS.dailyTasks, nextTasks);
  }

  writeJson(STORAGE_KEYS.logs, []);
  writeJson(STORAGE_KEYS.dailyResetDate, todayKey);
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof localStorage === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed as T;
  } catch (error) {
    console.error(`Failed to read ${key} from localStorage:`, error);
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Failed to write ${key} to localStorage:`, error);
  }
}

function nextId(items: Array<{ id: number }>): number {
  const maxId = items.reduce((max, item) => Math.max(max, item.id ?? 0), 0);
  return maxId + 1;
}

function normalizeProject(input: Partial<LocalProject> & { name: string }): LocalProject {
  return {
    id: input.id ?? 0,
    name: input.name,
    type: input.type ?? "telegram",
    link: input.link ?? "",
    createdAt: input.createdAt ?? Date.now(),
    appName: input.appName ?? input.name,
    appType: input.appType ?? "",
    refLink: input.refLink ?? "",
    mixed: input.mixed ?? "",
  };
}

function migrateLegacyProjects(): LocalProject[] {
  const legacy = readJson<[string, any][]>(STORAGE_KEYS.legacyProjects, []);
  if (!Array.isArray(legacy) || legacy.length === 0) return [];

  return legacy.map(([name, data], index) => {
    const safe = data || {};
    return normalizeProject({
      id: Number.isFinite(safe.id) ? Number(safe.id) : index + 1,
      name: safe.name || name,
      type: "telegram",
      link: safe.ref_link || "",
      createdAt: Date.now(),
      appName: safe.app_name || safe.name || name,
      appType: safe.app_type || "",
      refLink: safe.ref_link || "",
      mixed: safe.mixed || "",
    });
  });
}

export const localStore = {
  // Projects
  getProjects(): LocalProject[] {
    let projects = readJson<LocalProject[]>(STORAGE_KEYS.projects, []);
    if (!Array.isArray(projects)) projects = [];

    if (projects.length === 0) {
      const migrated = migrateLegacyProjects();
      if (migrated.length > 0) {
        projects = migrated;
        writeJson(STORAGE_KEYS.projects, projects);
      }
    }

    return projects.map((project) => normalizeProject(project));
  },

  saveProjects(projects: LocalProject[]) {
    writeJson(STORAGE_KEYS.projects, projects);
  },

  addProject(project: Omit<LocalProject, "id" | "createdAt">): LocalProject {
    const projects = this.getProjects();
    const created: LocalProject = {
      ...normalizeProject(project),
      id: nextId(projects),
      createdAt: Date.now(),
    };
    projects.push(created);
    this.saveProjects(projects);
    return created;
  },

  updateProject(id: number, patch: Partial<LocalProject>): LocalProject | null {
    const projects = this.getProjects();
    const index = projects.findIndex((p) => p.id === id);
    if (index === -1) return null;
    projects[index] = normalizeProject({ ...projects[index], ...patch, id: projects[index].id });
    this.saveProjects(projects);
    return projects[index];
  },

  deleteProject(id: number): boolean {
    const projects = this.getProjects();
    const next = projects.filter((p) => p.id !== id);
    if (next.length === projects.length) return false;
    this.saveProjects(next);
    return true;
  },

  // Accounts
  getAccounts(): LocalAccount[] {
    let accounts = readJson<LocalAccount[]>(STORAGE_KEYS.accounts, []);
    if (!Array.isArray(accounts)) accounts = [];
    return accounts.map((account) => ({
      ...account,
      status: (account.status as AccountStatus | undefined) ?? accountStatus.active,
    }));
  },

  saveAccounts(accounts: LocalAccount[]) {
    writeJson(STORAGE_KEYS.accounts, accounts);
  },

  addAccount(account: Omit<LocalAccount, "id">): LocalAccount {
    const accounts = this.getAccounts();
    const created = {
      ...account,
      id: nextId(accounts),
      name: account.name,
      status: (account.status as AccountStatus | undefined) ?? accountStatus.active,
    } as LocalAccount;
    accounts.push(created);
    this.saveAccounts(accounts);
    return created;
  },

  updateAccountNotes(id: number, notes: string): LocalAccount | null {
    const accounts = this.getAccounts();
    const index = accounts.findIndex((a) => a.id === id);
    if (index === -1) return null;
    accounts[index] = { ...accounts[index], notes };
    this.saveAccounts(accounts);
    return accounts[index];
  },

  updateAccountStatus(id: number, status: AccountStatus): LocalAccount | null {
    const accounts = this.getAccounts();
    const index = accounts.findIndex((a) => a.id === id);
    if (index === -1) return null;
    accounts[index] = { ...accounts[index], status };
    this.saveAccounts(accounts);
    return accounts[index];
  },

  // Daily tasks
  getDailyTasks(): LocalDailyTask[] {
    ensureDailyReset();
    let tasks = readJson<LocalDailyTask[]>(STORAGE_KEYS.dailyTasks, []);
    if (!Array.isArray(tasks)) tasks = [];
    return tasks.map((task) => ({
      ...task,
      isCompleted: Boolean(task?.isCompleted),
      remindAt: Number.isFinite(Number(task?.remindAt)) ? Number(task?.remindAt) : null,
      remindedAt: Number.isFinite(Number(task?.remindedAt)) ? Number(task?.remindedAt) : null,
      repeatRule: this.normalizeRepeatRule(task?.repeatRule),
    }));
  },

  saveDailyTasks(tasks: LocalDailyTask[]) {
    writeJson(STORAGE_KEYS.dailyTasks, tasks);
  },

  addDailyTask(title: string, remindAt?: number | null): LocalDailyTask {
    ensureDailyReset();
    const tasks = this.getDailyTasks();
    const created: LocalDailyTask = {
      id: nextId(tasks),
      title,
      isCompleted: false,
      remindAt: Number.isFinite(Number(remindAt)) ? Number(remindAt) : null,
      remindedAt: null,
      repeatRule: "never",
    };
    tasks.push(created);
    this.saveDailyTasks(tasks);
    return created;
  },

  toggleDailyTask(id: number, isCompleted: boolean): LocalDailyTask | null {
    ensureDailyReset();
    const tasks = this.getDailyTasks();
    const index = tasks.findIndex((t) => t.id === id);
    if (index === -1) return null;
    tasks[index] = isCompleted
      ? { ...tasks[index], isCompleted, remindAt: null, remindedAt: null, repeatRule: "never" }
      : { ...tasks[index], isCompleted };
    this.saveDailyTasks(tasks);
    return tasks[index];
  },

  updateDailyTask(
    id: number,
    patch: { title?: string; remindAt?: number | null; repeatRule?: DailyReminderRepeat }
  ): LocalDailyTask | null {
    ensureDailyReset();
    const tasks = this.getDailyTasks();
    const index = tasks.findIndex((t) => t.id === id);
    if (index === -1) return null;

    const prev = tasks[index];
    const nextTitle = typeof patch.title === "string" ? patch.title.trim() : prev.title;
    const hasReminderPatch = Object.prototype.hasOwnProperty.call(patch, "remindAt");
    const nextRemindAt = hasReminderPatch
      ? (Number.isFinite(Number(patch.remindAt)) ? Number(patch.remindAt) : null)
      : prev.remindAt ?? null;
    const hasRepeatPatch = Object.prototype.hasOwnProperty.call(patch, "repeatRule");
    const nextRepeatRule = hasRepeatPatch
      ? this.normalizeRepeatRule(patch.repeatRule)
      : this.normalizeRepeatRule(prev.repeatRule);

    tasks[index] = {
      ...prev,
      title: nextTitle,
      remindAt: nextRemindAt,
      remindedAt: hasReminderPatch && nextRemindAt ? null : prev.remindedAt ?? null,
      repeatRule: nextRemindAt ? nextRepeatRule : "never",
    };

    this.saveDailyTasks(tasks);
    return tasks[index];
  },

  updateDailyTaskReminder(id: number, remindAt?: number | null): LocalDailyTask | null {
    ensureDailyReset();
    const tasks = this.getDailyTasks();
    const index = tasks.findIndex((t) => t.id === id);
    if (index === -1) return null;
    const nextRemindAt = Number.isFinite(Number(remindAt)) ? Number(remindAt) : null;
    tasks[index] = {
      ...tasks[index],
      remindAt: nextRemindAt,
      remindedAt: nextRemindAt ? null : tasks[index].remindedAt,
      repeatRule: nextRemindAt ? this.normalizeRepeatRule(tasks[index].repeatRule) : "never",
    };
    this.saveDailyTasks(tasks);
    return tasks[index];
  },

  markDailyTaskReminded(id: number, remindedAt: number): LocalDailyTask | null {
    ensureDailyReset();
    const tasks = this.getDailyTasks();
    const index = tasks.findIndex((t) => t.id === id);
    if (index === -1) return null;
    tasks[index] = {
      ...tasks[index],
      remindedAt,
    };
    this.saveDailyTasks(tasks);
    return tasks[index];
  },

  deleteDailyTask(id: number): boolean {
    ensureDailyReset();
    const tasks = this.getDailyTasks();
    const next = tasks.filter((t) => t.id !== id);
    if (next.length === tasks.length) return false;
    this.saveDailyTasks(next);
    return true;
  },

  // Logs
  getLogs(): LocalLog[] {
    ensureDailyReset();
    let logs = readJson<LocalLog[]>(STORAGE_KEYS.logs, []);
    if (!Array.isArray(logs)) logs = [];
    const cutoff = Date.now() - LOG_RETENTION_MS;
    const filtered = logs
      .filter(
        (log) =>
          Number.isFinite(log?.timestamp) &&
          Number(log.timestamp) >= cutoff &&
          shouldKeepRecentLogMessage(log?.message)
      )
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 200);
    if (filtered.length !== logs.length) {
      this.saveLogs(filtered);
    }
    return filtered;
  },

  normalizeRepeatRule(value: unknown): DailyReminderRepeat {
    switch (value) {
      case "daily":
      case "weekly":
      case "biweekly":
      case "monthly":
      case "quarterly":
      case "semiannual":
      case "yearly":
      case "never":
        return value;
      default:
        return "never";
    }
  },

  saveLogs(logs: LocalLog[]) {
    writeJson(STORAGE_KEYS.logs, logs);
  },

  addLog(message: string): LocalLog {
    ensureDailyReset();
    const logs = this.getLogs();
    const created: LocalLog = {
      id: nextId(logs),
      message,
      timestamp: Date.now(),
    };
    if (!shouldKeepRecentLogMessage(message)) {
      return created;
    }
    const cutoff = Date.now() - LOG_RETENTION_MS;
    const next = [created, ...logs]
      .filter((log) => Number(log.timestamp) >= cutoff)
      .slice(0, 200);
    this.saveLogs(next);
    return created;
  },

  // Hashtag meta
  getHashtagMeta(): LocalHashtagMeta[] {
    let meta = readJson<LocalHashtagMeta[]>(STORAGE_KEYS.hashtagMeta, []);
    if (!Array.isArray(meta)) meta = [];
    return meta
      .map((item) => ({
        tag: String(item?.tag ?? "").trim().toLowerCase(),
        link: item?.link ? String(item.link) : "",
      }))
      .filter((item) => item.tag);
  },

  saveHashtagMeta(meta: LocalHashtagMeta[]) {
    writeJson(STORAGE_KEYS.hashtagMeta, meta);
  },

  // Settings
  getSettings(): LocalSettings {
    const settings = readJson<LocalSettings>(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
    return {
      ...DEFAULT_SETTINGS,
      ...settings,
    };
  },

  saveSettings(settings: LocalSettings) {
    writeJson(STORAGE_KEYS.settings, settings);
  },

  // Auth
  getAuthUser(): LocalUser | null {
    const user = readJson<LocalUser | null>(STORAGE_KEYS.authUser, null);
    if (!user || !user.id || !user.name) return null;
    return user;
  },

  saveAuthUser(user: LocalUser) {
    writeJson(STORAGE_KEYS.authUser, user);
  },

  clearAuthUser() {
    writeJson(STORAGE_KEYS.authUser, null);
  },

  getAuthOnboardingSeen(): boolean {
    return Boolean(readJson<boolean>(STORAGE_KEYS.authOnboardingSeen, false));
  },

  setAuthOnboardingSeen(value: boolean) {
    writeJson(STORAGE_KEYS.authOnboardingSeen, Boolean(value));
  },

  // Telegram launch state
  getTelegramLaunchState(): TelegramLaunchState | null {
    const state = readJson<TelegramLaunchState | null>(STORAGE_KEYS.telegramLaunch, null);
    if (!state || typeof state !== "object") return null;
    return {
      selectedProject: String(state.selectedProject ?? ""),
      startRange: String(state.startRange ?? ""),
      endRange: String(state.endRange ?? ""),
      isMix: Boolean(state.isMix),
      launchedPids: Array.isArray(state.launchedPids)
        ? state.launchedPids.map((pid) => Number(pid)).filter((pid) => Number.isFinite(pid))
        : [],
      pendingProfiles: Array.isArray(state.pendingProfiles)
        ? state.pendingProfiles.map((pid) => Number(pid)).filter((pid) => Number.isFinite(pid))
        : [],
      batchSize: Number.isFinite(Number(state.batchSize)) ? Number(state.batchSize) : 1,
      launchParams: state.launchParams ?? null,
      totalProfiles: Number.isFinite(Number(state.totalProfiles)) ? Number(state.totalProfiles) : 0,
      updatedAt: Number(state.updatedAt ?? Date.now()),
    };
  },

  saveTelegramLaunchState(state: TelegramLaunchState) {
    writeJson(STORAGE_KEYS.telegramLaunch, state);
  },

  clearTelegramLaunchState() {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.removeItem(STORAGE_KEYS.telegramLaunch);
    } catch (error) {
      console.error("Failed to clear telegram launch state:", error);
    }
  },

  // Stats
  getStats() {
    const accounts = this.getAccounts();
    const totalAccounts = accounts.length;
    const liveAccounts = accounts.filter((a) => a.status === accountStatus.active).length;
    const blockedAccounts = accounts.filter((a) => a.status === accountStatus.blocked).length;
    const livePercent = totalAccounts > 0 ? Math.round((liveAccounts / totalAccounts) * 100) : 0;

    return {
      totalAccounts,
      liveAccounts,
      blockedAccounts,
      livePercent,
    };
  },
};
