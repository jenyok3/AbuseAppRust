import React from "react";
import { useEffect, useRef, useState } from "react";
import { useDailyTasks, useCreateDailyTask, useToggleDailyTask, useDeleteDailyTask, useUpdateDailyTask } from "@/hooks/use-dashboard";
import { CheckSquare, Plus, Trash2, Loader2, Pencil, Clock, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { type DailyReminderRepeat, type LocalDailyReminder } from "@/lib/localStore";
import { useI18n } from "@/lib/i18n";

const MONTHS_GENITIVE = {
  uk: ["січня", "лютого", "березня", "квітня", "травня", "червня", "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"],
  en: ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"],
  ru: ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"],
} as const;

const MONTHS_NOMINATIVE = {
  uk: ["січень", "лютий", "березень", "квітень", "травень", "червень", "липень", "серпень", "вересень", "жовтень", "листопад", "грудень"],
  en: ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"],
  ru: ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"],
} as const;

export function DailyTasksPanel() {
  const DAILY_WIDGET_VISIBILITY_WINDOW_MS = 24 * 60 * 60 * 1000;
  const { language } = useI18n();
  const tr = (uk: string, en: string, ru: string) =>
    language === "en" ? en : language === "ru" ? ru : uk;
  const monthsGenitive = MONTHS_GENITIVE[language];
  const monthsNominative = MONTHS_NOMINATIVE[language];
  const monthToIndex: Record<string, number> = monthsGenitive.reduce((acc, month, index) => {
    acc[month] = index;
    return acc;
  }, {} as Record<string, number>);
  const repeatOptions: Array<{ value: DailyReminderRepeat; label: string }> = [
    { value: "never", label: tr("Ніколи", "Never", "Никогда") },
    { value: "daily", label: tr("Щодня", "Daily", "Ежедневно") },
    { value: "weekly", label: tr("Щотижня", "Weekly", "Еженедельно") },
    { value: "biweekly", label: tr("Раз на 2 тижні", "Every 2 weeks", "Раз в 2 недели") },
    { value: "monthly", label: tr("Щомісяця", "Monthly", "Ежемесячно") },
    { value: "quarterly", label: tr("Раз на 3 місяці", "Every 3 months", "Раз в 3 месяца") },
    { value: "semiannual", label: tr("Раз на 6 місяців", "Every 6 months", "Раз в 6 месяцев") },
    { value: "yearly", label: tr("Щороку", "Yearly", "Ежегодно") },
  ];
  const { data: tasks, isLoading } = useDailyTasks();
  const { mutate: createTask, isPending: isCreating } = useCreateDailyTask();
  const { mutate: toggleTask } = useToggleDailyTask();
  const { mutate: deleteTask } = useDeleteDailyTask();
  const { mutate: updateTask } = useUpdateDailyTask();

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editingTaskTitle, setEditingTaskTitle] = useState("");
  const [editingTaskReminders, setEditingTaskReminders] = useState<LocalDailyReminder[]>([]);
  const [editingTaskReminderDate, setEditingTaskReminderDate] = useState("");
  const [editingTaskReminderHour, setEditingTaskReminderHour] = useState("");
  const [editingTaskReminderMinute, setEditingTaskReminderMinute] = useState("");
  const [editingTaskRepeatRule, setEditingTaskRepeatRule] = useState<DailyReminderRepeat>("never");
  const [isCalendarMode, setIsCalendarMode] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<Date>(new Date());
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [isTimeInputFocused, setIsTimeInputFocused] = useState(false);
  const hourInputRef = useRef<HTMLInputElement | null>(null);
  const minuteInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowTs(Date.now());
    }, 60000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const formatReminderDateText = (time?: number | null) => {
    if (!time) return "";
    const date = new Date(time);
    return `${date.getDate()} ${monthsGenitive[date.getMonth()]}`;
  };

  const formatReminderTimeText = (time?: number | null) => {
    if (!time) return "";
    const date = new Date(time);
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${pad(date.getHours())}${pad(date.getMinutes())}`;
  };

  const formatReminderDisplayText = (time?: number | null) => {
    if (!time) return "";
    const date = new Date(time);
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${date.getDate()} ${monthsGenitive[date.getMonth()]} ${tr("о", "at", "в")} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const getRepeatLabel = (value?: DailyReminderRepeat) =>
    repeatOptions.find((option) => option.value === value)?.label ?? tr("Ніколи", "Never", "Никогда");

  const parseDateTextToDate = (value: string): Date | null => {
    const match = value.trim().toLowerCase().match(/^(\d{1,2})\s+([a-zа-яіїєґ]+)$/i);
    if (!match) return null;
    const day = Number(match[1]);
    const monthIndex = monthToIndex[match[2]];
    if (!Number.isFinite(day) || day < 1 || day > 31 || monthIndex === undefined) return null;
    const now = new Date();
    const next = new Date(now.getFullYear(), monthIndex, day);
    if (next.getMonth() !== monthIndex || next.getDate() !== day) return null;
    return next;
  };

  const formatDateButtonLabel = (date: Date): string => `${date.getDate()} ${monthsGenitive[date.getMonth()]}`;

  const getCalendarGrid = (month: Date): Array<{ date: Date; inMonth: boolean }> => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const startOffset = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(first.getDate() - startOffset);
    const days: Array<{ date: Date; inMonth: boolean }> = [];
    for (let i = 0; i < 42; i += 1) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push({ date: d, inMonth: d.getMonth() === month.getMonth() });
    }
    return days;
  };

  const parseReminder = (dateTextRaw: string, hourRaw: string, minuteRaw: string) => {
    const dateText = dateTextRaw.trim().toLowerCase();
    const hourText = hourRaw.trim();
    const minuteText = minuteRaw.trim();

    if (!dateText && !hourText && !minuteText) {
      return { isValid: true, value: null as number | null };
    }

    if (!dateText || !hourText || !minuteText) {
      return { isValid: false, value: null as number | null };
    }

    const dateMatch = dateText.match(/^(\d{1,2})\s+([a-zа-яіїєґ]+)$/i);
    if (!dateMatch) {
      return { isValid: false, value: null as number | null };
    }

    const day = Number(dateMatch[1]);
    const monthText = dateMatch[2];
    const monthIndex = monthToIndex[monthText];
    if (!Number.isFinite(day) || day < 1 || day > 31 || monthIndex === undefined) {
      return { isValid: false, value: null as number | null };
    }

    const hour = Number(hourText);
    const minute = Number(minuteText);
    if (
      !/^\d{1,2}$/.test(hourText) ||
      !/^\d{1,2}$/.test(minuteText) ||
      !Number.isFinite(hour) ||
      !Number.isFinite(minute) ||
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59
    ) {
      return { isValid: false, value: null as number | null };
    }

    const now = new Date();
    const candidate = new Date(now.getFullYear(), monthIndex, day, hour, minute, 0, 0);

    if (
      candidate.getMonth() !== monthIndex ||
      candidate.getDate() !== day ||
      !Number.isFinite(candidate.getTime())
    ) {
      return { isValid: false, value: null as number | null };
    }

    if (candidate.getTime() <= Date.now()) {
      return { isValid: false, value: null as number | null };
    }

    return { isValid: true, value: candidate.getTime() };
  };

  const mergeReminder = (remindAt: number, repeatRule: DailyReminderRepeat) => {
    const trimmed = editingTaskReminders.filter((reminder) => reminder.remindAt !== remindAt);
    return [
      ...trimmed,
      {
        id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        remindAt,
        remindedAt: null,
        repeatRule,
      },
    ];
  };

  const normalizeMinuteInput = (raw: string): string => {
    const digits = raw.replace(/\D/g, "").slice(0, 2);
    if (!digits) return "";
    if (digits.length === 1) {
      const first = Number(digits[0]);
      return first > 5 ? "5" : digits;
    }
    const first = Number(digits[0]);
    if (first > 5) return "5";
    return digits;
  };

  const handleTimeInputBlur = () => {
    window.setTimeout(() => {
      const activeElement = document.activeElement;
      const keepFocused =
        activeElement === hourInputRef.current || activeElement === minuteInputRef.current;
      setIsTimeInputFocused(keepFocused);
    }, 0);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    createTask(
      { title: newTaskTitle, remindAt: null },
      {
        onSuccess: () => {
          setNewTaskTitle("");
        },
      }
    );
  };

  const canSubmit = !!newTaskTitle.trim() && !isCreating;
  const parsedReminder = parseReminder(editingTaskReminderDate, editingTaskReminderHour, editingTaskReminderMinute);
  const reminderInputsFilled =
    !!editingTaskReminderDate.trim() &&
    !!editingTaskReminderHour.trim() &&
    !!editingTaskReminderMinute.trim();
  const isReminderInvalid = reminderInputsFilled && !parsedReminder.isValid;
  const canSaveTaskEdit = !!editingTaskTitle.trim() && parsedReminder.isValid;
  const plannedScheduleItems = (tasks ?? [])
    .flatMap((task) => {
      const taskReminders =
        editingTaskId === task.id
          ? editingTaskReminders
          : (Array.isArray(task.reminders) ? task.reminders : []);

      return taskReminders
        .filter((reminder) => !reminder.remindedAt && reminder.remindAt > nowTs)
        .map((reminder) => ({
          taskId: task.id,
          taskTitle: task.title,
          reminder,
        }));
    })
    .sort((a, b) => a.reminder.remindAt - b.reminder.remindAt);
  const visibleTasks = (tasks ?? []).filter((task) => {
    const reminders = Array.isArray(task.reminders) ? task.reminders : [];
    const pendingReminders = reminders.filter((reminder) => !reminder.remindedAt && reminder.remindAt > nowTs);
    if (pendingReminders.length === 0) return true;

    const nearestPendingReminderMs = Math.min(...pendingReminders.map((reminder) => reminder.remindAt - nowTs));
    return nearestPendingReminderMs <= DAILY_WIDGET_VISIBILITY_WINDOW_MS;
  });
  const isEmptyState = !isLoading && visibleTasks.length === 0;

  const openEditTaskModal = (task: { id: number; title: string; reminders?: LocalDailyReminder[] }) => {
    const reminders = Array.isArray(task.reminders) ? task.reminders : [];
    const sortedReminders = reminders
      .slice()
      .sort((a, b) => Number(a.remindAt) - Number(b.remindAt));

    setEditingTaskId(task.id);
    setEditingTaskTitle(task.title);
    setEditingTaskReminders(sortedReminders);
    setEditingTaskReminderDate("");
    setEditingTaskReminderHour("");
    setEditingTaskReminderMinute("");
    setEditingTaskRepeatRule("never");
    setIsTimeInputFocused(false);

    const selectedDate = sortedReminders[0]?.remindAt ? new Date(sortedReminders[0].remindAt) : new Date();
    setCalendarSelectedDate(selectedDate);
    setCalendarMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
    setIsCalendarMode(false);
    setIsEditModalOpen(true);
  };

  const closeEditTaskModal = () => {
    setIsEditModalOpen(false);
    setEditingTaskId(null);
    setEditingTaskTitle("");
    setEditingTaskReminders([]);
    setEditingTaskReminderDate("");
    setEditingTaskReminderHour("");
    setEditingTaskReminderMinute("");
    setEditingTaskRepeatRule("never");
    setIsTimeInputFocused(false);
    setIsCalendarMode(false);
  };

  return (
    <>
      <div className="bg-card/40 backdrop-blur-sm border border-white/5 rounded-3xl p-6 flex flex-col h-full w-full min-h-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
            <CheckSquare className="text-primary w-5 h-5" />
            Daily
          </h2>
          <span className="text-xs font-mono text-muted-foreground bg-white/5 px-2 py-1 rounded">
            {visibleTasks.filter((t) => t.isCompleted).length || 0} / {visibleTasks.length || 0}
          </span>
        </div>

        <ScrollArea className="flex-1 min-h-0 overflow-y-auto -mx-2 px-2">
          <div
            className={cn(
              "space-y-2 pb-4",
              isEmptyState && "flex min-h-[220px] flex-col items-center justify-center pb-0"
            )}
          >
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground text-sm">{tr("Завантаження задач...", "Loading tasks...", "Загрузка задач...")}</div>
            ) : visibleTasks.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm opacity-50">{tr("Немає щоденних завдань", "No daily tasks", "Нет ежедневных задач")}</div>
            ) : (
              visibleTasks.map((task) => {
                const reminders = Array.isArray(task.reminders) ? task.reminders : [];
                const hasReminder = reminders.some((reminder) => reminder.remindAt > nowTs && !reminder.remindedAt);
                const isReminded =
                  reminders.length > 0 &&
                  reminders.every((reminder) =>
                    reminder.remindedAt || reminder.remindAt <= nowTs
                  );

                return (
                  <div key={task.id} className="flex flex-col gap-2">
                    <div className="group flex items-center gap-3 min-w-0 p-3 rounded-xl hover:bg-white/5 transition-all border border-transparent hover:border-white/5">
                      <label className="checkbox-container">
                        <input
                          type="checkbox"
                          checked={task.isCompleted || false}
                          onChange={(e) => toggleTask({ id: task.id, isCompleted: e.target.checked })}
                        />
                        <svg viewBox="0 0 64 64" height="20" width="20">
                          <path d="M 0 16 V 56 A 8 8 90 0 0 8 64 H 56 A 8 8 90 0 0 64 56 V 8 A 8 8 90 0 0 56 0 H 8 A 8 8 90 0 0 0 8 V 16 L 32 48 L 64 16 V 8 A 8 8 90 0 0 56 0 H 8 A 8 8 90 0 0 0 8 V 56 A 8 8 90 0 0 8 64 H 56 A 8 8 90 0 0 64 56 V 16" className="checkbox-path"></path>
                        </svg>
                      </label>
                      <div className="flex-1 min-w-0 flex items-start">
                        <span
                          className={cn(
                            "min-w-0 max-w-full truncate text-sm transition-all duration-300",
                            task.isCompleted ? "text-muted-foreground" : "text-white"
                          )}
                        >
                          {task.title}
                        </span>
                        {hasReminder && !isReminded ? (
                          <span className="ml-1 -mt-0.5 shrink-0 leading-none">
                            <Clock strokeWidth={2.4} className="w-3 h-3 text-primary" />
                          </span>
                        ) : null}
                      </div>
                      <div className="relative flex items-center justify-end w-[72px]">
                        {isReminded ? (
                          <span className="absolute right-0 text-[10px] text-muted-foreground transition-opacity group-hover:opacity-0">
                            {tr("Нагадано", "Reminded", "Напомнено")}
                          </span>
                        ) : null}
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEditTaskModal(task)}
                            className="p-1.5 text-muted-foreground hover:text-white hover:bg-white/10 rounded-md transition-all"
                            title={tr("Редагувати", "Edit", "Редактировать")}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteTask(task.id)}
                            className="p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-400/10 rounded-md transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        <form onSubmit={handleCreate} className="mt-4" autoComplete="off">
          <div className="relative group">
            <Input
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder={tr("Додати нове завдання...", "Add new task...", "Добавить новую задачу...")}
              className="daily-tasks-input !bg-black/50 !border-white/10 text-sm h-10 rounded-xl pr-12 w-full transition-all duration-300 !focus:outline-none !focus:border-primary/50 !focus:bg-black/60 !focus:ring-2 !focus:ring-primary/20 !focus-visible:outline-none !focus-visible:border-primary/50 !focus-visible:bg-black/60 !focus-visible:ring-2 !focus-visible:ring-primary/20 !focus-visible:ring-offset-0"
            />
            <Button
              type="submit"
              disabled={!canSubmit}
              size="icon"
              className={`absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg transition-all ${
                canSubmit
                  ? "border-transparent bg-gradient-to-r from-primary to-primary/80 text-white hover:scale-105"
                  : "border-white/5 bg-white/[0.01] text-white/35 cursor-default"
              }`}
            >
              {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </Button>
          </div>
        </form>
      </div>

      {isEditModalOpen ? (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={cn("w-full max-w-md rounded-3xl border border-white/10 bg-black/50 backdrop-blur-md p-6", isCalendarMode ? "pb-2" : "")}>
            {isCalendarMode ? (
              <>
                <h3 className="text-xl font-display font-bold text-white mb-4">{tr("Оберіть дату", "Choose date", "Выберите дату")}</h3>
                <div className="mb-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                    className="h-8 w-8 rounded-md text-white/80 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <p className="text-sm font-semibold text-white">
                    {`${monthsNominative[calendarMonth.getMonth()].charAt(0).toUpperCase()}${monthsNominative[calendarMonth.getMonth()].slice(1)} ${calendarMonth.getFullYear()}`}
                  </p>
                  <button
                    type="button"
                    onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                    className="h-8 w-8 rounded-md text-white/80 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {[tr("Пн", "Mo", "Пн"), tr("Вт", "Tu", "Вт"), tr("Ср", "We", "Ср"), tr("Чт", "Th", "Чт"), tr("Пт", "Fr", "Пт"), tr("Сб", "Sa", "Сб"), tr("Нд", "Su", "Вс")].map((d) => (
                    <span key={d} className="text-[11px] text-muted-foreground text-center py-1">{d}</span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {getCalendarGrid(calendarMonth).map((cell) => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const isPast = cell.date < today;
                    const isSelected =
                      cell.date.getDate() === calendarSelectedDate.getDate() &&
                      cell.date.getMonth() === calendarSelectedDate.getMonth() &&
                      cell.date.getFullYear() === calendarSelectedDate.getFullYear();

                    return (
                      <button
                        key={cell.date.toISOString()}
                        type="button"
                        onClick={() => {
                          setCalendarSelectedDate(cell.date);
                          setEditingTaskReminderDate(formatDateButtonLabel(cell.date));
                          setIsCalendarMode(false);
                        }}
                        className={cn(
                          "h-8 w-8 justify-self-center rounded-full text-sm transition-colors",
                          isSelected
                            ? "bg-primary text-white"
                            : cell.inMonth
                              ? isPast
                                ? "text-white/40 hover:bg-white/5"
                                : "text-white hover:bg-white/10"
                              : isPast
                                ? "text-white/20 hover:bg-white/5"
                                : "text-white hover:bg-white/10",
                          "border border-transparent"
                        )}
                      >
                        {cell.date.getDate()}
                      </button>
                    );
                  })}
                </div>
                <div className="flex justify-end pt-2 pr-0.5">
                  <Button
                    type="button"
                    onClick={() => setIsCalendarMode(false)}
                    className="h-11 px-4 text-base bg-transparent border-0 text-white hover:bg-transparent rounded-xl transition-none shadow-none hover:shadow-none focus-visible:ring-0"
                  >
                    {tr("Закрити", "Close", "Закрыть")}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-xl font-display font-bold text-white mb-5">{tr("Редагувати завдання", "Edit task", "Редактировать задачу")}</h3>
                <form
                  className="space-y-4"
                  autoComplete="off"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!editingTaskId || !editingTaskTitle.trim() || !parsedReminder.isValid) return;
                    let nextReminders = editingTaskReminders;
                    if (parsedReminder.value) {
                      nextReminders = mergeReminder(parsedReminder.value, editingTaskRepeatRule);
                    }
                    updateTask(
                      {
                        id: editingTaskId,
                        title: editingTaskTitle.trim(),
                        reminders: nextReminders,
                      },
                      {
                        onSuccess: () => {
                          setEditingTaskReminderDate("");
                          setEditingTaskReminderHour("");
                          setEditingTaskReminderMinute("");
                          setEditingTaskRepeatRule("never");
                          closeEditTaskModal();
                        },
                      }
                    );
                  }}
                >
                  <div className="space-y-2">
                    <p className="text-sm font-normal text-muted-foreground">{tr("Назва", "Title", "Название")}</p>
                    <Input
                      value={editingTaskTitle}
                      onChange={(e) => setEditingTaskTitle(e.target.value)}
                      autoComplete="new-password"
                      className="bg-black/50 border-white/10 h-11 rounded-xl text-white"
                      placeholder={tr("Введіть назву завдання", "Enter task title", "Введите название задачи")}
                    />
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-normal text-muted-foreground">{tr("Дата й час нагадування", "Reminder date and time", "Дата и время напоминания")}</p>
                    <div className="flex flex-wrap items-end justify-start gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          const parsedDate = parseDateTextToDate(editingTaskReminderDate);
                          const baseDate = parsedDate ?? new Date();
                          setCalendarSelectedDate(baseDate);
                          setCalendarMonth(new Date(baseDate.getFullYear(), baseDate.getMonth(), 1));
                          setIsCalendarMode(true);
                        }}
                        className="w-full sm:w-[170px] h-10 bg-transparent border-0 border-b border-white/30 text-center text-white/95 hover:border-white/60 transition-colors"
                      >
                        {editingTaskReminderDate || tr("Оберіть дату", "Choose date", "Выберите дату")}
                      </button>
                      <span className="text-white/70 text-sm pb-1">{tr("о", "at", "в")}</span>
                      <div
                        className={cn("h-10 w-[100px] shrink-0 border-b flex items-center justify-center gap-1", isReminderInvalid ? "border-red-500" : "border-white/30")}
                        onClick={() => {
                          setIsTimeInputFocused(true);
                          hourInputRef.current?.focus();
                        }}
                      >
                        <input
                          ref={hourInputRef}
                          value={editingTaskReminderHour}
                          onFocus={() => setIsTimeInputFocused(true)}
                          onBlur={handleTimeInputBlur}
                          onChange={(e) => {
                            const digits = e.target.value.replace(/\D/g, "").slice(0, 2);
                            if (!digits) {
                              setEditingTaskReminderHour("");
                              return;
                            }

                            if (digits.length === 1) {
                              setEditingTaskReminderHour(digits);
                              return;
                            }

                            const asHour = Number(digits);
                            if (Number.isFinite(asHour) && asHour <= 23) {
                              setEditingTaskReminderHour(digits);
                              minuteInputRef.current?.focus();
                              return;
                            }

                            // Invalid 2-digit hour (e.g. 35): spill second digit into minutes => 3:5
                            setEditingTaskReminderHour(digits[0]);
                            setEditingTaskReminderMinute((prev) => {
                              const nextMinute = `${digits[1]}${prev}`.slice(0, 2);
                              return nextMinute;
                            });
                            minuteInputRef.current?.focus();
                          }}
                          className="w-7 bg-transparent border-0 text-center text-white placeholder:text-white/40 focus:outline-none"
                          placeholder={isTimeInputFocused ? "" : "21"}
                          inputMode="numeric"
                          autoComplete="new-password"
                        />
                        <span className="text-white/70">:</span>
                        <input
                          ref={minuteInputRef}
                          value={editingTaskReminderMinute}
                          onFocus={() => setIsTimeInputFocused(true)}
                          onBlur={handleTimeInputBlur}
                          onChange={(e) => setEditingTaskReminderMinute(normalizeMinuteInput(e.target.value))}
                          onKeyDown={(e) => {
                            if (e.key === "Backspace" && editingTaskReminderMinute.length === 0) {
                              hourInputRef.current?.focus();
                            }
                          }}
                          className="w-7 bg-transparent border-0 text-center text-white placeholder:text-white/40 focus:outline-none"
                          placeholder={isTimeInputFocused ? "" : "08"}
                          inputMode="numeric"
                          autoComplete="new-password"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-sm font-normal text-muted-foreground">{tr("Повторювати:", "Repeat:", "Повторять:")}</span>
                      <Select
                        value={editingTaskRepeatRule}
                        onValueChange={(value) => setEditingTaskRepeatRule(value as DailyReminderRepeat)}
                      >
                        <SelectTrigger
                          hideIcon
                          className="h-auto w-auto bg-transparent border-0 px-0 py-0 text-sm text-white hover:text-white/90 focus:ring-0 focus:ring-offset-0"
                        >
                          <SelectValue />
                          <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-70" />
                        </SelectTrigger>
                        <SelectContent className="bg-black/95 border-white/10 text-white">
                          {repeatOptions.map((option) => (
                            <SelectItem
                              key={option.value}
                              value={option.value}
                              className="text-xs focus:bg-white/10 focus:text-white data-[highlighted]:bg-white/10 data-[highlighted]:text-white"
                            >
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {plannedScheduleItems.length > 0 ? (
                      <div className="pt-2 space-y-2">
                        <p className="text-sm font-normal text-muted-foreground text-center">{tr("Заплановано", "Scheduled", "Запланировано")}</p>
                        {plannedScheduleItems.map((item) => (
                            <div key={`${item.taskId}-${item.reminder.id || item.reminder.remindAt}`} className="flex items-start justify-between gap-2">
                              <span className="min-w-0 flex-1 break-words text-sm text-white/85">
                                {formatReminderDisplayText(item.reminder.remindAt)}
                                {item.reminder.repeatRule && item.reminder.repeatRule !== "never"
                                  ? ` • ${getRepeatLabel(item.reminder.repeatRule)}`
                                  : ""}
                                {` — ${item.taskTitle}`}
                              </span>
                              {item.taskId === editingTaskId ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingTaskReminders((prev) =>
                                      prev.filter((existingReminder) => existingReminder.id !== item.reminder.id)
                                    );
                                  }}
                                  className="h-7 px-2 rounded-md text-xs text-red-500 hover:text-red-400 hover:bg-red-500/15 transition-colors"
                                >
                                  {tr("Видалити", "Delete", "Удалить")}
                                </button>
                              ) : null}
                            </div>
                          ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <Button
                      type="button"
                      onClick={closeEditTaskModal}
                      className="flex-1 h-11 bg-black/50 border border-white/10 text-white hover:bg-white/10 rounded-xl"
                    >
                      {tr("Скасувати", "Cancel", "Отмена")}
                    </Button>
                    <Button
                      type="submit"
                      disabled={!canSaveTaskEdit}
                      className="flex-1 h-12 bg-primary hover:bg-primary active:bg-primary/95 text-white border-0 shadow-none hover:shadow-none focus-visible:ring-0 rounded-xl transition-all duration-200"
                    >
                      {tr("Зберегти", "Save", "Сохранить")}
                    </Button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

