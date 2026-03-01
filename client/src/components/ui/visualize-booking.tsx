import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { useDailyTasks } from "@/hooks/use-dashboard";
import type { LocalDailyTask } from "@/lib/localStore";

export type DayType = {
  id: string;
  day: string;
  classNames: string;
  plannedCount?: number;
};

interface DayProps {
  classNames: string;
  day: DayType;
}

const toDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const buildPlannedCountsByDate = (tasks: LocalDailyTask[], nowTs: number): Map<string, number> => {
  const counts = new Map<string, number>();

  for (const task of tasks) {
    const reminders = Array.isArray(task.reminders) ? task.reminders : [];
    for (const reminder of reminders) {
      if (!reminder) continue;
      if (reminder.remindedAt) continue;

      const remindAt = Number(reminder.remindAt);
      if (!Number.isFinite(remindAt)) continue;
      if (remindAt <= nowTs) continue;

      const key = toDateKey(new Date(remindAt));
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return counts;
};

const Day: React.FC<DayProps> = ({ classNames, day }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      className={`relative aspect-square w-full flex items-center justify-center py-0.5 ${classNames}`}
      style={{ borderRadius: 16 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      id={`day-${day.id}`}
    >
      <motion.div className="flex flex-col items-center justify-center">
        <span className="text-xs sm:text-sm text-current">{day.day}</span>
      </motion.div>

      {day.plannedCount && (
        <motion.div
          className="pointer-events-none absolute grid place-items-center rounded-full bg-primary text-white"
          style={{ borderRadius: 999 }}
          initial={false}
          animate={
            isHovered
              ? {
                  left: "calc(50% - 14px)",
                  top: "calc(50% - 14px)",
                  x: 0,
                  y: 0,
                  width: "28px",
                  height: "28px",
                }
              : {
                  left: "calc(100% - 24px)",
                  top: "calc(100% - 24px)",
                  x: 0,
                  y: 0,
                  width: "20px",
                  height: "20px",
                }
          }
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="block w-full text-center font-mono text-[10px] font-bold leading-none tabular-nums">
            {day.plannedCount}
          </span>
        </motion.div>
      )}
    </motion.div>
  );
};

const CalendarGrid: React.FC<{ days: DayType[] }> = ({ days }) => {
  return (
    <div className="w-full">
      <div className="grid w-full grid-cols-7 gap-0.5 sm:gap-1">
        {days.map((day, index) => (
          <Day key={`${day.id}-${index}`} classNames={day.classNames} day={day} />
        ))}
      </div>
    </div>
  );
};

const buildDays = (
  year: number,
  month: number,
  plannedCountsByDate: Map<string, number>,
): DayType[] => {
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const firstWeekdayMondayBased = (firstDay.getDay() + 6) % 7;
  const totalCells = Math.ceil((firstWeekdayMondayBased + daysInMonth) / 7) * 7;
  const days: DayType[] = [];

  for (let i = 0; i < firstWeekdayMondayBased; i += 1) {
    const dayNum = daysInPrevMonth - firstWeekdayMondayBased + i + 1;
    const cellDate = new Date(year, month - 1, dayNum);
    const count = plannedCountsByDate.get(toDateKey(cellDate)) ?? 0;
    days.push({
      id: toDateKey(cellDate),
      day: String(dayNum),
      classNames: "bg-card/20 text-white/45 backdrop-blur-sm border border-white/5",
      plannedCount: count > 0 ? count : undefined,
    });
  }

  for (let i = 1; i <= daysInMonth; i += 1) {
    const cellDate = new Date(year, month, i);
    const count = plannedCountsByDate.get(toDateKey(cellDate)) ?? 0;
    days.push({
      id: toDateKey(cellDate),
      day: String(i),
      classNames: count > 0
        ? "bg-card/40 text-white backdrop-blur-sm border border-white/10 cursor-pointer"
        : "bg-card/40 text-white backdrop-blur-sm border border-white/10",
      plannedCount: count > 0 ? count : undefined,
    });
  }

  const trailingCount = totalCells - days.length;
  for (let i = 1; i <= trailingCount; i += 1) {
    const cellDate = new Date(year, month + 1, i);
    const count = plannedCountsByDate.get(toDateKey(cellDate)) ?? 0;
    days.push({
      id: toDateKey(cellDate),
      day: String(i),
      classNames: "bg-card/20 text-white/45 backdrop-blur-sm border border-white/5",
      plannedCount: count > 0 ? count : undefined,
    });
  }

  return days;
};

const InteractiveCalendar = React.forwardRef<
  HTMLDivElement,
  Omit<React.ComponentPropsWithoutRef<typeof motion.div>, "ref">
>(({ ...props }, ref) => {
  const { language } = useI18n();
  const { data: tasks = [] } = useDailyTasks();
  const [nowTs, setNowTs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowTs(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const tr = (uk: string, en: string, ru: string) =>
    language === "en" ? en : language === "ru" ? ru : uk;

  const weekdays = [
    tr("ПН", "MO", "ПН"),
    tr("ВТ", "TU", "ВТ"),
    tr("СР", "WE", "СР"),
    tr("ЧТ", "TH", "ЧТ"),
    tr("ПТ", "FR", "ПТ"),
    tr("СБ", "SA", "СБ"),
    tr("НД", "SU", "ВС"),
  ];

  const locale = language === "en" ? "en-US" : language === "ru" ? "ru-RU" : "uk-UA";
  const now = new Date(nowTs);
  const monthIndex = now.getMonth();
  const rawMonthTitle = new Intl.DateTimeFormat(locale, { month: "long" }).format(now);
  const monthTitle = `${rawMonthTitle.charAt(0).toUpperCase()}${rawMonthTitle.slice(1)}`;
  const monthYear = now.getFullYear();

  const plannedCountsByDate = React.useMemo(
    () => buildPlannedCountsByDate(tasks, nowTs),
    [tasks, nowTs],
  );

  const days = React.useMemo(
    () => buildDays(monthYear, monthIndex, plannedCountsByDate),
    [monthYear, monthIndex, plannedCountsByDate],
  );

  return (
    <motion.div ref={ref} className="relative flex w-full flex-col" {...props}>
      <motion.div layout className="w-full">
        <motion.div key="calendar-view" className="flex w-full flex-col gap-2 sm:gap-3">
          <div className="sticky top-0 z-20 -mx-3 sm:-mx-4 lg:-mx-6 px-3 sm:px-4 lg:px-6 pb-1 sm:pb-2 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
            <div className="flex w-full items-center justify-between">
              <motion.h2 className="mb-2 text-2xl font-bold tracking-tight text-white flex items-center pt-1">
                {monthTitle}
              </motion.h2>
            </div>

            <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
              {weekdays.map((day) => (
                <div
                  key={day}
                  className="rounded-lg bg-card/40 backdrop-blur-sm border border-white/5 py-1 text-center text-[10px] sm:text-xs font-medium text-white/60"
                >
                  {day}
                </div>
              ))}
            </div>
          </div>

          <CalendarGrid days={days} />
        </motion.div>
      </motion.div>
    </motion.div>
  );
});

InteractiveCalendar.displayName = "InteractiveCalendar";

export default InteractiveCalendar;
