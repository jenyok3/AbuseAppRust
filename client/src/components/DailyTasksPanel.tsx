import React from "react";
import { useRef, useState } from "react";
import { useDailyTasks, useCreateDailyTask, useToggleDailyTask, useDeleteDailyTask, useUpdateDailyTask } from "@/hooks/use-dashboard";
import { CheckSquare, Plus, Trash2, Loader2, Pencil, Clock, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { type DailyReminderRepeat } from "@/lib/localStore";

const UKR_MONTHS = [
  "січня",
  "лютого",
  "березня",
  "квітня",
  "травня",
  "червня",
  "липня",
  "серпня",
  "вересня",
  "жовтня",
  "листопада",
  "грудня",
] as const;

const UKR_MONTHS_NOMINATIVE = [
  "січень",
  "лютий",
  "березень",
  "квітень",
  "травень",
  "червень",
  "липень",
  "серпень",
  "вересень",
  "жовтень",
  "листопад",
  "грудень",
] as const;

const UKR_MONTH_TO_INDEX: Record<string, number> = UKR_MONTHS.reduce((acc, month, index) => {
  acc[month] = index;
  return acc;
}, {} as Record<string, number>);

const REPEAT_OPTIONS: Array<{ value: DailyReminderRepeat; label: string }> = [
  { value: "never", label: "Ніколи" },
  { value: "daily", label: "Щодня" },
  { value: "weekly", label: "Щотижня" },
  { value: "biweekly", label: "Раз на 2 тижні" },
  { value: "monthly", label: "Щомісяця" },
  { value: "quarterly", label: "Раз на 3 місяці" },
  { value: "semiannual", label: "Раз на 6 місяців" },
  { value: "yearly", label: "Щороку" },
];

export function DailyTasksPanel() {
  const { data: tasks, isLoading } = useDailyTasks();
  const { mutate: createTask, isPending: isCreating } = useCreateDailyTask();
  const { mutate: toggleTask } = useToggleDailyTask();
  const { mutate: deleteTask } = useDeleteDailyTask();
  const { mutate: updateTask } = useUpdateDailyTask();

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editingTaskTitle, setEditingTaskTitle] = useState("");
  const [editingTaskOriginalRemindAt, setEditingTaskOriginalRemindAt] = useState<number | null>(null);
  const [editingTaskReminderDate, setEditingTaskReminderDate] = useState("");
  const [editingTaskReminderHour, setEditingTaskReminderHour] = useState("");
  const [editingTaskReminderMinute, setEditingTaskReminderMinute] = useState("");
  const [editingTaskRepeatRule, setEditingTaskRepeatRule] = useState<DailyReminderRepeat>("never");
  const [isCalendarMode, setIsCalendarMode] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<Date>(new Date());
  const hourInputRef = useRef<HTMLInputElement | null>(null);
  const minuteInputRef = useRef<HTMLInputElement | null>(null);

  const formatReminderDateText = (time?: number | null) => {
    if (!time) return "";
    const date = new Date(time);
    return `${date.getDate()} ${UKR_MONTHS[date.getMonth()]}`;
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
    return `${date.getDate()} ${UKR_MONTHS[date.getMonth()]} о ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const parseDateTextToDate = (value: string): Date | null => {
    const match = value.trim().toLowerCase().match(/^(\d{1,2})\s+([а-яіїєґ]+)$/i);
    if (!match) return null;
    const day = Number(match[1]);
    const monthIndex = UKR_MONTH_TO_INDEX[match[2]];
    if (!Number.isFinite(day) || day < 1 || day > 31 || monthIndex === undefined) return null;
    const now = new Date();
    const next = new Date(now.getFullYear(), monthIndex, day);
    if (next.getMonth() !== monthIndex || next.getDate() !== day) return null;
    return next;
  };

  const formatDateButtonLabel = (date: Date): string => `${date.getDate()} ${UKR_MONTHS[date.getMonth()]}`;

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

    const dateMatch = dateText.match(/^(\d{1,2})\s+([а-яіїєґ]+)$/i);
    if (!dateMatch) {
      return { isValid: false, value: null as number | null };
    }

    const day = Number(dateMatch[1]);
    const monthText = dateMatch[2];
    const monthIndex = UKR_MONTH_TO_INDEX[monthText];
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

  const openEditTaskModal = (task: { id: number; title: string; remindAt?: number | null; repeatRule?: DailyReminderRepeat }) => {
    const validRemindAt =
      Number.isFinite(Number(task.remindAt)) && Number(task.remindAt) > 0
        ? Number(task.remindAt)
        : null;

    setEditingTaskId(task.id);
    setEditingTaskTitle(task.title);
    setEditingTaskOriginalRemindAt(validRemindAt);
    setEditingTaskReminderDate(formatReminderDateText(validRemindAt ?? Date.now()));

    const timeText = formatReminderTimeText(validRemindAt);
    setEditingTaskReminderHour(timeText.slice(0, 2));
    setEditingTaskReminderMinute(timeText.slice(2, 4));
    setEditingTaskRepeatRule(task.repeatRule ?? "never");

    const selectedDate = validRemindAt ? new Date(validRemindAt) : new Date();
    setCalendarSelectedDate(selectedDate);
    setCalendarMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
    setIsCalendarMode(false);
    setIsEditModalOpen(true);
  };

  const closeEditTaskModal = () => {
    setIsEditModalOpen(false);
    setEditingTaskId(null);
    setEditingTaskTitle("");
    setEditingTaskOriginalRemindAt(null);
    setEditingTaskReminderDate("");
    setEditingTaskReminderHour("");
    setEditingTaskReminderMinute("");
    setEditingTaskRepeatRule("never");
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
            {tasks?.filter((t) => t.isCompleted).length || 0} / {tasks?.length || 0}
          </span>
        </div>

        <ScrollArea className="flex-1 min-h-0 overflow-y-auto -mx-2 px-2">
          <div className="space-y-2 pb-4">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground text-sm">Loading tasks...</div>
            ) : tasks?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm opacity-50 min-h-[120px] flex items-center justify-center">No daily tasks set.</div>
            ) : (
              tasks?.map((task) => {
                const isReminded = !!(task.remindedAt && task.remindAt && task.remindAt <= Date.now());
                const hasReminder = Number.isFinite(Number(task.remindAt)) && Number(task.remindAt) > 0;

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
                        {hasReminder ? (
                          <span className="ml-1 -mt-0.5 shrink-0 leading-none">
                            <Clock strokeWidth={2.4} className="w-3 h-3 text-primary" />
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        {isReminded ? (
                          <span className="text-[10px] text-muted-foreground relative top-[1px]">Нагадано</span>
                        ) : null}
                        <button
                          onClick={() => openEditTaskModal(task)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-white hover:bg-white/10 rounded-md transition-all"
                          title="Редагувати"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteTask(task.id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-400/10 rounded-md transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        <form onSubmit={handleCreate} className="mt-4">
          <div className="relative group">
            <Input
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Додати нове завдання..."
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
                <h3 className="text-xl font-display font-bold text-white mb-4">Оберіть дату</h3>
                <div className="mb-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                    className="h-8 w-8 rounded-md text-white/80 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <p className="text-sm font-semibold text-white">
                    {`${UKR_MONTHS_NOMINATIVE[calendarMonth.getMonth()].charAt(0).toUpperCase()}${UKR_MONTHS_NOMINATIVE[calendarMonth.getMonth()].slice(1)} ${calendarMonth.getFullYear()}`}
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
                  {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"].map((d) => (
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
                    className="relative left-9 h-[58px] px-9 text-[17px] bg-transparent border-0 text-white hover:bg-transparent rounded-xl transition-none shadow-none hover:shadow-none focus-visible:ring-0"
                  >
                    Закрити
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-xl font-display font-bold text-white mb-5">Редагувати завдання</h3>
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!editingTaskId || !editingTaskTitle.trim() || !parsedReminder.isValid) return;
                    const nextRepeatRule = parsedReminder.value ? editingTaskRepeatRule : "never";
                    updateTask(
                      {
                        id: editingTaskId,
                        title: editingTaskTitle.trim(),
                        remindAt: parsedReminder.value,
                        repeatRule: nextRepeatRule,
                      },
                      { onSuccess: closeEditTaskModal }
                    );
                  }}
                >
                  <div className="space-y-2">
                    <p className="text-xs tracking-wider text-muted-foreground font-semibold">Назва</p>
                    <Input
                      value={editingTaskTitle}
                      onChange={(e) => setEditingTaskTitle(e.target.value)}
                      autoComplete="new-password"
                      className="bg-black/50 border-white/10 h-11 rounded-xl text-white"
                      placeholder="Введіть назву завдання"
                    />
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs tracking-wider text-muted-foreground font-semibold">Дата й час нагадування</p>
                    <div className="flex items-end justify-start gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          const parsedDate = parseDateTextToDate(editingTaskReminderDate);
                          const baseDate = parsedDate ?? new Date();
                          setCalendarSelectedDate(baseDate);
                          setCalendarMonth(new Date(baseDate.getFullYear(), baseDate.getMonth(), 1));
                          setIsCalendarMode(true);
                        }}
                        className="w-[170px] h-10 bg-transparent border-0 border-b border-white/30 text-center text-white/95 hover:border-white/60 transition-colors"
                      >
                        {editingTaskReminderDate || "Оберіть дату"}
                      </button>
                      <span className="text-white/70 text-sm pb-1">о</span>
                      <div className={cn("h-10 w-[100px] border-b flex items-center justify-center gap-1", isReminderInvalid ? "border-red-500" : "border-white/30")}>
                        <input
                          ref={hourInputRef}
                          value={editingTaskReminderHour}
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
                          placeholder="21"
                          inputMode="numeric"
                          autoComplete="new-password"
                        />
                        <span className="text-white/70">:</span>
                        <input
                          ref={minuteInputRef}
                          value={editingTaskReminderMinute}
                          onChange={(e) => setEditingTaskReminderMinute(normalizeMinuteInput(e.target.value))}
                          onKeyDown={(e) => {
                            if (e.key === "Backspace" && editingTaskReminderMinute.length === 0) {
                              hourInputRef.current?.focus();
                            }
                          }}
                          className="w-7 bg-transparent border-0 text-center text-white placeholder:text-white/40 focus:outline-none"
                          placeholder="08"
                          inputMode="numeric"
                          autoComplete="new-password"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-xs tracking-wider text-muted-foreground font-semibold">Повторювати:</span>
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
                          {REPEAT_OPTIONS.map((option) => (
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

                    {editingTaskOriginalRemindAt ? (
                      <div className="pt-1">
                        <p className="text-[11px] tracking-wider text-muted-foreground/80 text-center">Заплановано</p>
                        <div className="mt-1 flex items-center justify-between">
                          <span className="text-sm text-white/85">{formatReminderDisplayText(editingTaskOriginalRemindAt)}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTaskOriginalRemindAt(null);
                              setEditingTaskReminderDate("");
                              setEditingTaskReminderHour("");
                              setEditingTaskReminderMinute("");
                              setEditingTaskRepeatRule("never");
                            }}
                            className="h-7 px-2 rounded-md text-xs text-red-500 hover:text-red-400 hover:bg-red-500/15 transition-colors"
                          >
                            Видалити
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button
                      type="button"
                      onClick={closeEditTaskModal}
                      className="flex-1 h-11 bg-black/50 border border-white/10 text-white hover:bg-white/10 rounded-xl"
                    >
                      Скасувати
                    </Button>
                    <Button
                      type="submit"
                      disabled={!canSaveTaskEdit}
                      className="flex-1 h-12 bg-primary hover:bg-primary active:bg-primary/95 text-white border-0 shadow-none hover:shadow-none focus-visible:ring-0 rounded-xl transition-all duration-200"
                    >
                      Зберегти
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

