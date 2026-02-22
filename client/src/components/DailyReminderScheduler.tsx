import { useEffect, useRef } from "react";
import { useDailyTasks, useMarkDailyTaskReminded } from "@/hooks/use-dashboard";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { localStore, type DailyReminderRepeat } from "@/lib/localStore";
import { useQueryClient } from "@tanstack/react-query";

const CHECK_INTERVAL_MS = 15000;

function getNextReminderTime(current: number, repeatRule: DailyReminderRepeat): number | null {
  const next = new Date(current);
  switch (repeatRule) {
    case "daily":
      next.setDate(next.getDate() + 1);
      return next.getTime();
    case "weekly":
      next.setDate(next.getDate() + 7);
      return next.getTime();
    case "biweekly":
      next.setDate(next.getDate() + 14);
      return next.getTime();
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      return next.getTime();
    case "quarterly":
      next.setMonth(next.getMonth() + 3);
      return next.getTime();
    case "semiannual":
      next.setMonth(next.getMonth() + 6);
      return next.getTime();
    case "yearly":
      next.setFullYear(next.getFullYear() + 1);
      return next.getTime();
    case "never":
    default:
      return null;
  }
}

export function DailyReminderScheduler() {
  const { data: tasks = [] } = useDailyTasks();
  const { mutate: markReminded } = useMarkDailyTaskReminded();
  const queryClient = useQueryClient();
  const notifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let mounted = true;
    let intervalId: number | undefined;

    const checkReminders = async () => {
      if (!mounted) return;
      const now = Date.now();

      for (const task of tasks) {
        if (!task?.remindAt || task.remindAt > now) continue;
        if (task.isCompleted) continue;
        if (task.remindedAt) continue;
        const notifyKey = `${task.id}:${task.remindAt}`;
        if (notifiedRef.current.has(notifyKey)) continue;

        const granted = await isPermissionGranted();
        if (!granted) {
          const permission = await requestPermission();
          if (permission !== "granted") return;
        }

        sendNotification({
          title: "AbuseApp",
          body: `Нагадування: ${task.title}`,
        });

        notifiedRef.current.add(notifyKey);
        const repeatRule = localStore.normalizeRepeatRule(task.repeatRule);
        const nextReminderTime = getNextReminderTime(task.remindAt, repeatRule);
        if (nextReminderTime) {
          localStore.updateDailyTask(task.id, { remindAt: nextReminderTime, repeatRule });
          localStore.addLog(`Нагадування: ${task.title}`);
          queryClient.invalidateQueries({ queryKey: ["local", "dailyTasks"] });
        } else {
          const remindedAt = Date.now();
          markReminded({ id: task.id, remindedAt });
          localStore.addLog(`Нагадування: ${task.title}`);
        }

        queryClient.invalidateQueries({ queryKey: ["local", "logs"] });
      }
    };

    checkReminders();
    intervalId = window.setInterval(checkReminders, CHECK_INTERVAL_MS);

    return () => {
      mounted = false;
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, [tasks, markReminded, queryClient]);

  return null;
}
