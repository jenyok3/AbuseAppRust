import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { localStore, type LocalProject, type LocalAccount, type DailyReminderRepeat, type LocalDailyReminder } from "@/lib/localStore";
import { type AccountStatus } from "@/lib/accountStatus";
import { getCurrentLanguage } from "@/lib/i18n";

const lt = (uk: string, en: string, ru: string) => {
  const language = getCurrentLanguage();
  return language === "en" ? en : language === "ru" ? ru : uk;
};

// ============================================
// PROJECTS
// ============================================

export function useProjects() {
  return useQuery({
    queryKey: ["local", "projects"],
    queryFn: async () => localStore.getProjects(),
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<LocalProject, "id" | "createdAt">) => {
      return localStore.addProject(data);
    },
    onSuccess: (created) => {
      localStore.addLog(lt(`Додано проєкт ${created.name}`, `Added project ${created.name}`, `Добавлен проект ${created.name}`));
      queryClient.invalidateQueries({ queryKey: ["local", "projects"] });
      queryClient.invalidateQueries({ queryKey: ["local", "logs"] });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const ok = localStore.deleteProject(id);
      if (!ok) throw new Error("Failed to delete project");
    },
    onSuccess: (_, id) => {
      localStore.addLog(lt(`Видалено проєкт #${id}`, `Deleted project #${id}`, `Удален проект #${id}`));
      queryClient.invalidateQueries({ queryKey: ["local", "projects"] });
      queryClient.invalidateQueries({ queryKey: ["local", "logs"] });
    },
  });
}

// ============================================
// ACCOUNTS
// ============================================

export function useAccounts() {
  return useQuery({
    queryKey: ["local", "accounts"],
    queryFn: async () => localStore.getAccounts(),
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<LocalAccount, "id">) => {
      return localStore.addAccount(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["local", "accounts"] });
      queryClient.invalidateQueries({ queryKey: ["local", "stats"] });
    },
  });
}

export function useUpdateAccountNotes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, notes }: { id: number; notes: string }) => {
      const updated = localStore.updateAccountNotes(id, notes);
      if (!updated) throw new Error("Failed to update account notes");
      return updated;
    },
    onSuccess: (_updated, { id }) => {
      localStore.addLog(lt(`Оновлено нотатку для акаунта ${id}`, `Updated note for account ${id}`, `Обновлена заметка для аккаунта ${id}`));
      queryClient.invalidateQueries({ queryKey: ["local", "accounts"] });
      queryClient.invalidateQueries({ queryKey: ["local", "logs"] });
    },
  });
}

export function useUpdateAccountStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: number; status: AccountStatus }) => {
      const updated = localStore.updateAccountStatus(id, status);
      if (!updated) throw new Error("Failed to update account status");
      return updated;
    },
    onSuccess: (_updated, { id, status }) => {
      localStore.addLog(lt(`Змінено статус акаунта ${id} на ${status}`, `Changed account ${id} status to ${status}`, `Изменен статус аккаунта ${id} на ${status}`));
      queryClient.invalidateQueries({ queryKey: ["local", "accounts"] });
      queryClient.invalidateQueries({ queryKey: ["local", "stats"] });
      queryClient.invalidateQueries({ queryKey: ["local", "logs"] });
    },
  });
}

// ============================================
// DAILY TASKS
// ============================================

export function useDailyTasks() {
  return useQuery({
    queryKey: ["local", "dailyTasks"],
    queryFn: async () => localStore.getDailyTasks(),
  });
}

export function useCreateDailyTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { title: string; remindAt?: number | null }) => {
      return localStore.addDailyTask(data.title, data.remindAt);
    },
    onSuccess: (created) => {
      localStore.addLog(lt(`Додано щоденне завдання: ${created.title}`, `Added daily task: ${created.title}`, `Добавлена ежедневная задача: ${created.title}`));
      queryClient.invalidateQueries({ queryKey: ["local", "dailyTasks"] });
      queryClient.invalidateQueries({ queryKey: ["local", "logs"] });
    },
  });
}

export function useToggleDailyTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isCompleted }: { id: number; isCompleted: boolean }) => {
      const updated = localStore.toggleDailyTask(id, isCompleted);
      if (!updated) throw new Error("Failed to toggle task");
      return updated;
    },
    // Optimistic UI update
    onMutate: async ({ id, isCompleted }) => {
      await queryClient.cancelQueries({ queryKey: ["local", "dailyTasks"] });
      const previousTasks = queryClient.getQueryData<any[]>(["local", "dailyTasks"]);
      queryClient.setQueryData(["local", "dailyTasks"], (old: any[] | undefined) => {
        return old?.map(task =>
          task.id === id
            ? isCompleted
              ? { ...task, isCompleted, reminders: [], remindAt: null, remindedAt: null, repeatRule: "never" }
              : { ...task, isCompleted }
            : task
        );
      });
      return { previousTasks };
    },
    onError: (err, newTodo, context) => {
      queryClient.setQueryData(["local", "dailyTasks"], context?.previousTasks);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["local", "dailyTasks"] });
      queryClient.invalidateQueries({ queryKey: ["local", "logs"] });
    },
  });
}

export function useDeleteDailyTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const ok = localStore.deleteDailyTask(id);
      if (!ok) throw new Error("Failed to delete task");
    },
    onMutate: async (id: number) => {
      const tasks = queryClient.getQueryData<any[]>(["local", "dailyTasks"]) ?? [];
      const task = tasks.find((item) => item?.id === id);
      return { title: typeof task?.title === "string" ? task.title : null };
    },
    onSuccess: (_result, _id, context) => {
      const title = typeof context?.title === "string" ? context.title : null;
      const label = title ? lt(`Видалено щоденне завдання: ${title}`, `Deleted daily task: ${title}`, `Удалена ежедневная задача: ${title}`) : lt("Видалено щоденне завдання", "Deleted daily task", "Удалена ежедневная задача");
      localStore.addLog(label);
      queryClient.invalidateQueries({ queryKey: ["local", "dailyTasks"] });
      queryClient.invalidateQueries({ queryKey: ["local", "logs"] });
    },
  });
}

export function useUpdateDailyTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      title,
      remindAt,
      repeatRule,
      reminders,
    }: {
      id: number;
      title: string;
      remindAt?: number | null;
      repeatRule?: DailyReminderRepeat;
      reminders?: LocalDailyReminder[];
    }) => {
      const updated = localStore.updateDailyTask(id, { title, remindAt, repeatRule, reminders });
      if (!updated) throw new Error("Failed to update task");
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["local", "dailyTasks"] });
      queryClient.invalidateQueries({ queryKey: ["local", "logs"] });
    },
  });
}

export function useUpdateDailyTaskReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, remindAt }: { id: number; remindAt?: number | null }) => {
      const updated = localStore.updateDailyTaskReminder(id, remindAt);
      if (!updated) throw new Error("Failed to update task reminder");
      return updated;
    },
    onSuccess: (_updated, { id, remindAt }) => {
      const label = remindAt ? lt("Заплановано", "Scheduled", "Запланировано") : lt("Скасовано", "Canceled", "Отменено");
      localStore.addLog(lt(`${label} нагадування для завдання #${id}`, `${label} reminder for task #${id}`, `${label} напоминание для задачи #${id}`));
      queryClient.invalidateQueries({ queryKey: ["local", "dailyTasks"] });
      queryClient.invalidateQueries({ queryKey: ["local", "logs"] });
    },
  });
}

export function useMarkDailyTaskReminded() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reminderId, remindedAt }: { id: number; reminderId: string; remindedAt: number }) => {
      const updated = localStore.markDailyTaskReminded(id, reminderId, remindedAt);
      if (!updated) throw new Error("Failed to mark task reminded");
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["local", "dailyTasks"] });
    },
  });
}

// ============================================
// LOGS
// ============================================

export function useLogs() {
  return useQuery({
    queryKey: ["local", "logs"],
    queryFn: async () => localStore.getLogs(),
  });
}

export function useCreateLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { message: string }) => {
      return localStore.addLog(data.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["local", "logs"] }),
  });
}

// ============================================
// STATS
// ============================================

export function useStats() {
  return useQuery({
    queryKey: ["local", "stats"],
    queryFn: async () => localStore.getStats(),
  });
}







