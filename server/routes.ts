import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // --- Projects ---
  app.get(api.projects.list.path, async (_req, res) => {
    const projects = await storage.getProjects();
    res.json(projects);
  });

  app.post(api.projects.create.path, async (req, res) => {
    try {
      const input = api.projects.create.input.parse(req.body);
      const project = await storage.createProject(input);
      res.status(201).json(project);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.projects.delete.path, async (req, res) => {
    await storage.deleteProject(Number(req.params.id));
    res.status(204).send();
  });

  // --- Accounts ---
  app.get(api.accounts.list.path, async (_req, res) => {
    const accounts = await storage.getAccounts();
    res.json(accounts);
  });

  app.post(api.accounts.create.path, async (req, res) => {
    try {
      const input = api.accounts.create.input.parse(req.body);
      const account = await storage.createAccount(input);
      res.status(201).json(account);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.patch(api.accounts.updateNotes.path, async (req, res) => {
    try {
      const { notes } = api.accounts.updateNotes.input.parse(req.body);
      const account = await storage.updateAccountNotes(Number(req.params.id), notes);
      res.json(account);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  // --- Daily Tasks ---
  app.get(api.dailyTasks.list.path, async (_req, res) => {
    const tasks = await storage.getDailyTasks();
    res.json(tasks);
  });

  app.post(api.dailyTasks.create.path, async (req, res) => {
    try {
      const input = api.dailyTasks.create.input.parse(req.body);
      const task = await storage.createDailyTask(input);
      res.status(201).json(task);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.patch(api.dailyTasks.toggle.path, async (req, res) => {
    try {
      const { isCompleted } = api.dailyTasks.toggle.input.parse(req.body);
      const task = await storage.toggleDailyTask(Number(req.params.id), isCompleted);
      res.json(task);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.dailyTasks.delete.path, async (req, res) => {
    await storage.deleteDailyTask(Number(req.params.id));
    res.status(204).send();
  });

  // --- Logs ---
  app.get(api.logs.list.path, async (_req, res) => {
    const logs = await storage.getLogs();
    res.json(logs);
  });

  app.post(api.logs.create.path, async (req, res) => {
    try {
      const input = api.logs.create.input.parse(req.body);
      const log = await storage.createLog(input);
      res.status(201).json(log);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  // --- Stats ---
  app.get(api.stats.get.path, async (_req, res) => {
    const stats = await storage.getStats();
    res.json(stats);
  });

  // --- Settings ---
  app.get(api.settings.get.path, async (_req, res) => {
    const settings = await storage.getSettings();
    res.json(settings);
  });

  app.patch(api.settings.update.path, async (req, res) => {
    try {
      const input = api.settings.update.input.parse(req.body);
      const settings = await storage.updateSettings(input);
      res.json(settings);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  // Seed Data
  await seedDatabase();

  return httpServer;
}

async function seedDatabase() {
  const projects = await storage.getProjects();
  if (projects.length === 0) {
    // Create seed projects
    const p1 = await storage.createProject({ name: "StarCase", type: "telegram" });
    const p2 = await storage.createProject({ name: "Quantum", type: "telegram" });
    const p3 = await storage.createProject({ name: "Lootly", type: "telegram" });
    
    // Create seed accounts
    await storage.createAccount({ projectId: p1.id, name: "acc_1", status: "live" });
    await storage.createAccount({ projectId: p1.id, name: "acc_2", status: "live" });
    await storage.createAccount({ projectId: p1.id, name: "acc_3", status: "blocked" });
    
    for(let i=0; i<10; i++) {
        await storage.createAccount({ projectId: p2.id, name: `qt_acc_${i}`, status: Math.random() > 0.1 ? "live" : "blocked" });
    }

    // Create seed daily tasks
    await storage.createDailyTask({ title: "Quantum", isCompleted: false });
    await storage.createDailyTask({ title: "Rolls", isCompleted: false });
    await storage.createDailyTask({ title: "xRocket", isCompleted: true });
    await storage.createDailyTask({ title: "Lootly", isCompleted: false });
    await storage.createDailyTask({ title: "GetBonus", isCompleted: false });
    await storage.createDailyTask({ title: "StarCase", isCompleted: false });
    await storage.createDailyTask({ title: "Virus", isCompleted: false });

    // Create seed logs
    await storage.createLog({ message: "Запустив StarCase" });
    await storage.createLog({ message: "Запустив Quantum" });
    await storage.createLog({ message: "Оновив акаунти" });
    await storage.createLog({ message: "Додав проект Lootly" });
  }
}
