import { db } from "./db";
import {
  projectsTable, accountsTable, dailyTasksTable, logsTable, settingsTable,
  type Project, type InsertProject,
  type Account, type InsertAccount,
  type DailyTask, type InsertDailyTask,
  type Log, type InsertLog,
  type Settings, type InsertSettings
} from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";

export interface IStorage {
  // Projects
  getProjects(): Promise<Project[]>;
  createProject(project: InsertProject): Promise<Project>;
  deleteProject(id: number): Promise<void>;

  // Accounts
  getAccounts(): Promise<Account[]>;
  updateAccountNotes(id: number, notes: string): Promise<Account>;
  createAccount(account: InsertAccount): Promise<Account>;

  // Daily Tasks
  getDailyTasks(): Promise<DailyTask[]>;
  createDailyTask(task: InsertDailyTask): Promise<DailyTask>;
  toggleDailyTask(id: number, isCompleted: boolean): Promise<DailyTask>;
  deleteDailyTask(id: number): Promise<void>;

  // Logs
  getLogs(): Promise<Log[]>;
  createLog(log: InsertLog): Promise<Log>;

  // Stats
  getStats(): Promise<{
    totalAccounts: number;
    liveAccounts: number;
    blockedAccounts: number;
    livePercent: number;
  }>;

  // Settings
  getSettings(): Promise<Settings>;
  updateSettings(settings: InsertSettings): Promise<Settings>;
}

export class DatabaseStorage implements IStorage {
  async getProjects(): Promise<Project[]> {
    return await db.select().from(projectsTable).orderBy(desc(projectsTable.createdAt));
  }

  async createProject(project: InsertProject): Promise<Project> {
    const [newProject] = await db.insert(projectsTable).values(project).returning();
    return newProject;
  }

  async deleteProject(id: number): Promise<void> {
    await db.delete(projectsTable).where(eq(projectsTable.id, id));
  }

  async getAccounts(): Promise<Account[]> {
    return await db.select().from(accountsTable);
  }

  async createAccount(account: InsertAccount): Promise<Account> {
    const [newAccount] = await db.insert(accountsTable).values(account).returning();
    return newAccount;
  }

  async updateAccountNotes(id: number, notes: string): Promise<Account> {
    const [updated] = await db.update(accountsTable)
      .set({ notes })
      .where(eq(accountsTable.id, id))
      .returning();
    return updated;
  }

  async getDailyTasks(): Promise<DailyTask[]> {
    return await db.select().from(dailyTasksTable).orderBy(dailyTasksTable.id);
  }

  async createDailyTask(task: InsertDailyTask): Promise<DailyTask> {
    const [newTask] = await db.insert(dailyTasksTable).values(task).returning();
    return newTask;
  }

  async toggleDailyTask(id: number, isCompleted: boolean): Promise<DailyTask> {
    const [updated] = await db.update(dailyTasksTable)
      .set({ isCompleted })
      .where(eq(dailyTasksTable.id, id))
      .returning();
    return updated;
  }

  async deleteDailyTask(id: number): Promise<void> {
    await db.delete(dailyTasksTable).where(eq(dailyTasksTable.id, id));
  }

  async getLogs(): Promise<Log[]> {
    return await db.select().from(logsTable).orderBy(desc(logsTable.timestamp)).limit(50);
  }

  async createLog(log: InsertLog): Promise<Log> {
    const [newLog] = await db.insert(logsTable).values(log).returning();
    return newLog;
  }

  async getStats() {
    const allAccounts = await db.select().from(accountsTable);
    const totalAccounts = allAccounts.length;
    const liveAccounts = allAccounts.filter((a: Account) => a.status === 'live').length;
    const blockedAccounts = allAccounts.filter((a: Account) => a.status === 'blocked').length;
    
    const livePercent = totalAccounts > 0 
      ? Math.round((liveAccounts / totalAccounts) * 100) 
      : 0;

    return {
      totalAccounts,
      liveAccounts,
      blockedAccounts,
      livePercent
    };
  }

  async getSettings(): Promise<Settings> {
    const [s] = await db.select().from(settingsTable).limit(1);
    if (!s) {
      const [newSettings] = await db.insert(settingsTable).values({ 
        telegramThreads: 1, 
        telegramFolderPath: "",
        chromeThreads: 1,
        chromeFolderPath: ""
      }).returning();
      return newSettings;
    }
    return s;
  }

  async updateSettings(input: InsertSettings): Promise<Settings> {
    const s = await this.getSettings();
    const [updated] = await db.update(settingsTable)
      .set(input)
      .where(eq(settingsTable.id, s.id))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
