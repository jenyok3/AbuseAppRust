import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { sqliteTable, text as sqliteText, integer as sqliteInteger, real as sqliteReal } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// PostgreSQL tables
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  link: text("link"),
  type: text("type").default("telegram"), // telegram or chrome
  createdAt: timestamp("created_at").defaultNow(),
});

export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id),
  name: text("name").notNull(),
  status: text("status").default("live"), // live, blocked
  lastActive: timestamp("last_active").defaultNow(),
  notes: text("notes"),
});

export const dailyTasks = pgTable("daily_tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  isCompleted: boolean("is_completed").default(false),
});

export const logs = pgTable("logs", {
  id: serial("id").primaryKey(),
  message: text("message").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  telegramThreads: integer("telegram_threads").default(1),
  telegramFolderPath: text("telegram_folder_path").default(""),
  chromeThreads: integer("chrome_threads").default(1),
  chromeFolderPath: text("chrome_folder_path").default(""),
});

// SQLite tables
export const projectsSqlite = sqliteTable("projects", {
  id: sqliteInteger("id").primaryKey({ autoIncrement: true }),
  name: sqliteText("name").notNull(),
  link: sqliteText("link"),
  type: sqliteText("type").default("telegram"), // telegram or chrome
  createdAt: sqliteInteger("created_at", { mode: "timestamp" }).default(new Date()),
});

export const accountsSqlite = sqliteTable("accounts", {
  id: sqliteInteger("id").primaryKey({ autoIncrement: true }),
  projectId: sqliteInteger("project_id").references(() => projectsSqlite.id),
  name: sqliteText("name").notNull(),
  status: sqliteText("status").default("live"), // live, blocked
  lastActive: sqliteInteger("last_active", { mode: "timestamp" }).default(new Date()),
  notes: sqliteText("notes"),
});

export const dailyTasksSqlite = sqliteTable("daily_tasks", {
  id: sqliteInteger("id").primaryKey({ autoIncrement: true }),
  title: sqliteText("title").notNull(),
  isCompleted: sqliteInteger("is_completed", { mode: "boolean" }).default(false),
});

export const logsSqlite = sqliteTable("logs", {
  id: sqliteInteger("id").primaryKey({ autoIncrement: true }),
  message: sqliteText("message").notNull(),
  timestamp: sqliteInteger("timestamp", { mode: "timestamp" }).default(new Date()),
});

export const settingsSqlite = sqliteTable("settings", {
  id: sqliteInteger("id").primaryKey({ autoIncrement: true }),
  telegramThreads: sqliteInteger("telegram_threads").default(1),
  telegramFolderPath: sqliteText("telegram_folder_path").default(""),
  chromeThreads: sqliteInteger("chrome_threads").default(1),
  chromeFolderPath: sqliteText("chrome_folder_path").default(""),
});

// Helper to get the right tables based on environment
export const isSqlite = typeof process === 'undefined' || !process.env.DATABASE_URL;
export const projectsTable = isSqlite ? projectsSqlite : projects;
export const accountsTable = isSqlite ? accountsSqlite : accounts;
export const dailyTasksTable = isSqlite ? dailyTasksSqlite : dailyTasks;
export const logsTable = isSqlite ? logsSqlite : logs;
export const settingsTable = isSqlite ? settingsSqlite : settings;

export const insertProjectSchema = createInsertSchema(projectsTable).omit({ id: true, createdAt: true });
export const insertAccountSchema = createInsertSchema(accountsTable).omit({ id: true, lastActive: true });
export const insertDailyTaskSchema = createInsertSchema(dailyTasksTable).omit({ id: true });
export const insertLogSchema = createInsertSchema(logsTable).omit({ id: true, timestamp: true });
export const insertSettingsSchema = createInsertSchema(settingsTable).omit({ id: true });

export type Project = typeof projectsTable.$inferSelect;
export type Account = typeof accountsTable.$inferSelect;
export type DailyTask = typeof dailyTasksTable.$inferSelect;
export type Log = typeof logsTable.$inferSelect;
export type Settings = typeof settingsTable.$inferSelect;

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type InsertDailyTask = z.infer<typeof insertDailyTaskSchema>;
export type InsertLog = z.infer<typeof insertLogSchema>;
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
