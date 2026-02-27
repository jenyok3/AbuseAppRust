import { useEffect, useRef } from "react";
import { useDailyTasks, useMarkDailyTaskReminded } from "@/hooks/use-dashboard";
import { invoke } from "@tauri-apps/api/core";
import { localStore, type DailyReminderRepeat } from "@/lib/localStore";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";

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

async function ensureNotificationPermission(): Promise<boolean> {
  if (window.Notification.permission === "granted") return true;
  if (window.Notification.permission === "denied") return false;
  const permission = await window.Notification.requestPermission();
  return permission === "granted";
}

export function DailyReminderScheduler() {
  const { language } = useI18n();
  const tr = (uk: string, en: string, ru: string) =>
    language === "en" ? en : language === "ru" ? ru : uk;

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
        if (task.isCompleted) continue;
        const reminders = Array.isArray(task.reminders) ? task.reminders : [];
        for (const reminder of reminders) {
          if (!reminder?.remindAt || reminder.remindAt > now) continue;
          if (reminder.remindedAt) continue;
          const notifyKey = `${task.id}:${reminder.id}:${reminder.remindAt}`;
          if (notifiedRef.current.has(notifyKey)) continue;

          let sent = false;
          const notifyBody = tr(
            `Нагадування: ${task.title}`,
            `Reminder: ${task.title}`,
            `Напоминание: ${task.title}`
          );

          try {
            await invoke("send_reminder_notification", {
              title: "AbuseApp",
              body: notifyBody,
            });
            sent = true;
          } catch (error) {
            console.error("Native reminder notification failed:", error);
          }

          if (!sent) {
            const granted = await ensureNotificationPermission();
            if (!granted) continue;

            const notification = new window.Notification("AbuseApp", {
              body: notifyBody,
              tag: `daily-task-${task.id}`,
            });
            notification.onclick = async () => {
              try {
                notification.close();
                await invoke("show_window");
              } catch (error) {
                console.error("Failed to show window from reminder click:", error);
              }
            };
          }

          notifiedRef.current.add(notifyKey);
          const repeatRule = localStore.normalizeRepeatRule(reminder.repeatRule);
          const nextReminderTime = getNextReminderTime(reminder.remindAt, repeatRule);
          if (nextReminderTime) {
            localStore.updateDailyTaskReminderEntry(task.id, reminder.id, {
              remindAt: nextReminderTime,
              repeatRule,
              remindedAt: null,
            });
            localStore.addLog(notifyBody);
            queryClient.invalidateQueries({ queryKey: ["local", "dailyTasks"] });
          } else {
            const remindedAt = Date.now();
            markReminded({ id: task.id, reminderId: reminder.id, remindedAt });
            localStore.addLog(notifyBody);
          }

          queryClient.invalidateQueries({ queryKey: ["local", "logs"] });
        }
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
  }, [tasks, markReminded, queryClient, language]);

  return null;
}
