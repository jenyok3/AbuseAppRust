import * as React from "react";
import { ChevronLeft, ChevronRight, Plus, Pencil } from "lucide-react";
import { format, addDays, startOfDay, isSameDay, addMonths, subMonths, startOfMonth } from "date-fns";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

export interface GlassCalendarProps {
  className?: string;
  selectedDate?: Date;
  onDateSelect?: (date: Date) => void;
}

export const GlassCalendar = React.forwardRef<HTMLDivElement, GlassCalendarProps>(
  ({ className, selectedDate: propSelectedDate, onDateSelect, ...props }, ref) => {
    const { language } = useI18n();
    const tr = (uk: string, en: string, ru: string) =>
      language === "en" ? en : language === "ru" ? ru : uk;

    const today = startOfDay(new Date());
    const [selectedDate, setSelectedDate] = React.useState(propSelectedDate || today);
    const [currentMonth, setCurrentMonth] = React.useState(startOfMonth(propSelectedDate || today));

    React.useEffect(() => {
      if (!propSelectedDate) return;
      setSelectedDate(startOfDay(propSelectedDate));
      setCurrentMonth(startOfMonth(propSelectedDate));
    }, [propSelectedDate]);

    const days = React.useMemo(() => {
      const start = addDays(startOfMonth(currentMonth), -2);
      return Array.from({ length: 5 }, (_, i) => addDays(start, i));
    }, [currentMonth]);

    const dayName = (d: Date) => {
      const names = [
        tr("Нд", "Su", "Вс"),
        tr("Пн", "Mo", "Пн"),
        tr("Вт", "Tu", "Вт"),
        tr("Ср", "We", "Ср"),
        tr("Чт", "Th", "Чт"),
        tr("Пт", "Fr", "Пт"),
        tr("Сб", "Sa", "Сб"),
      ];
      return names[d.getDay()];
    };

    const monthName = (d: Date) => {
      const names = [
        tr("Січень", "January", "Январь"),
        tr("Лютий", "February", "Февраль"),
        tr("Березень", "March", "Март"),
        tr("Квітень", "April", "Апрель"),
        tr("Травень", "May", "Май"),
        tr("Червень", "June", "Июнь"),
        tr("Липень", "July", "Июль"),
        tr("Серпень", "August", "Август"),
        tr("Вересень", "September", "Сентябрь"),
        tr("Жовтень", "October", "Октябрь"),
        tr("Листопад", "November", "Ноябрь"),
        tr("Грудень", "December", "Декабрь"),
      ];
      return `${names[d.getMonth()]} ${d.getFullYear()}`;
    };

    const handleDateClick = (date: Date) => {
      setSelectedDate(date);
      onDateSelect?.(date);
    };

    return (
      <div
        ref={ref}
        className={cn(
          "w-full rounded-3xl p-5 shadow-2xl",
          "bg-black/20 backdrop-blur-xl border border-white/10",
          "text-white font-sans",
          className
        )}
        {...props}
      >
        <div className="flex items-center justify-center text-base h-4">
          <div className="flex items-center space-x-3">
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }} onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1 rounded-full text-white/70 transition-colors hover:bg-white/10">
              <ChevronLeft className="h-4 w-4" />
            </motion.button>

            <span className="text-xl font-display font-bold text-white min-w-[150px] text-center">
              {monthName(currentMonth)}
            </span>

            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }} onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1 rounded-full text-white/70 transition-colors hover:bg-white/10">
              <ChevronRight className="h-4 w-4" />
            </motion.button>
          </div>
        </div>

        <div className="flex items-center justify-center flex-1 overflow-hidden">
          <div className="flex items-center justify-center space-x-2 mx-4 py-6" data-calendar-carousel="true">
            {days.map((date) => {
              const isToday = isSameDay(date, today);
              const isSelected = isSameDay(date, selectedDate);
              return (
                <div key={`date-container-${format(date, "yyyy-MM-dd")}`} className="relative py-2">
                  <motion.button
                    key={format(date, "yyyy-MM-dd")}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleDateClick(date)}
                    className={cn(
                      "flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all duration-300 w-10 h-20 relative overflow-hidden",
                      {
                        "bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg shadow-primary/30 scale-105": isToday || isSelected,
                        "bg-transparent text-white/30 hover:bg-white/5 hover:text-white border border-transparent": !isToday && !isSelected,
                      }
                    )}
                  >
                    <span className="text-xs font-display font-medium uppercase tracking-wide flex-1 flex items-start justify-center -mt-1 opacity-70">
                      {dayName(date)}
                    </span>
                    <span className="text-sm font-bold">{format(date, "d")}</span>
                  </motion.button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-3 h-px bg-white/20" />

        <div className="mt-5 flex items-center justify-between space-x-4">
          <button className="flex items-center space-x-2 text-sm font-medium text-white/70 transition-colors hover:text-white">
            <Pencil className="h-4 w-4" />
            <span>{tr("Додати нотатку...", "Add a note...", "Добавить заметку...")}</span>
          </button>
          <button className="flex items-center space-x-2 text-sm font-medium text-white/70 transition-colors hover:text-white">
            <Plus className="h-4 w-4" />
            <span>{tr("Нова подія", "New event", "Новое событие")}</span>
          </button>
        </div>
      </div>
    );
  }
);

GlassCalendar.displayName = "GlassCalendar";
