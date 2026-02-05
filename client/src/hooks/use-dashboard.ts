import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertProject, type InsertAccount, type InsertDailyTask, type InsertLog } from "@shared/schema";

// ============================================
// PROJECTS
// ============================================

export function useProjects() {
  return useQuery({
    queryKey: [api.projects.list.path],
    queryFn: async () => {
      const res = await fetch(api.projects.list.path);
      if (!res.ok) throw new Error("Failed to fetch projects");
      return api.projects.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertProject) => {
      const res = await fetch(api.projects.create.path, {
        method: api.projects.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create project");
      return api.projects.create.responses[201].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.projects.list.path] }),
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.projects.delete.path, { id });
      const res = await fetch(url, { method: api.projects.delete.method });
      if (!res.ok) throw new Error("Failed to delete project");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.projects.list.path] }),
  });
}

// ============================================
// ACCOUNTS
// ============================================

export function useAccounts() {
  return useQuery({
    queryKey: [api.accounts.list.path],
    queryFn: async () => {
      const res = await fetch(api.accounts.list.path);
      if (!res.ok) throw new Error("Failed to fetch accounts");
      return api.accounts.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertAccount) => {
      const res = await fetch(api.accounts.create.path, {
        method: api.accounts.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create account");
      return api.accounts.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.accounts.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.stats.get.path] });
    },
  });
}

// ============================================
// DAILY TASKS
// ============================================

export function useDailyTasks() {
  return useQuery({
    queryKey: [api.dailyTasks.list.path],
    queryFn: async () => {
      const res = await fetch(api.dailyTasks.list.path);
      if (!res.ok) throw new Error("Failed to fetch daily tasks");
      return api.dailyTasks.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateDailyTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertDailyTask) => {
      const res = await fetch(api.dailyTasks.create.path, {
        method: api.dailyTasks.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create task");
      return api.dailyTasks.create.responses[201].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.dailyTasks.list.path] }),
  });
}

export function useToggleDailyTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isCompleted }: { id: number; isCompleted: boolean }) => {
      const url = buildUrl(api.dailyTasks.toggle.path, { id });
      const res = await fetch(url, {
        method: api.dailyTasks.toggle.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCompleted }),
      });
      if (!res.ok) throw new Error("Failed to toggle task");
      return api.dailyTasks.toggle.responses[200].parse(await res.json());
    },
    // Optimistic UI update
    onMutate: async ({ id, isCompleted }) => {
      await queryClient.cancelQueries({ queryKey: [api.dailyTasks.list.path] });
      const previousTasks = queryClient.getQueryData<any[]>([api.dailyTasks.list.path]);
      queryClient.setQueryData([api.dailyTasks.list.path], (old: any[] | undefined) => {
        return old?.map(task => task.id === id ? { ...task, isCompleted } : task);
      });
      return { previousTasks };
    },
    onError: (err, newTodo, context) => {
      queryClient.setQueryData([api.dailyTasks.list.path], context?.previousTasks);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [api.dailyTasks.list.path] });
    },
  });
}

export function useDeleteDailyTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.dailyTasks.delete.path, { id });
      const res = await fetch(url, { method: api.dailyTasks.delete.method });
      if (!res.ok) throw new Error("Failed to delete task");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.dailyTasks.list.path] }),
  });
}

// ============================================
// LOGS
// ============================================

export function useLogs() {
  return useQuery({
    queryKey: [api.logs.list.path],
    queryFn: async () => {
      const res = await fetch(api.logs.list.path);
      if (!res.ok) throw new Error("Failed to fetch logs");
      return api.logs.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertLog) => {
      const res = await fetch(api.logs.create.path, {
        method: api.logs.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create log");
      return api.logs.create.responses[201].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.logs.list.path] }),
  });
}

// ============================================
// STATS
// ============================================

export function useStats() {
  return useQuery({
    queryKey: [api.stats.get.path],
    queryFn: async () => {
      const res = await fetch(api.stats.get.path);
      if (!res.ok) throw new Error("Failed to fetch stats");
      return api.stats.get.responses[200].parse(await res.json());
    },
  });
}
