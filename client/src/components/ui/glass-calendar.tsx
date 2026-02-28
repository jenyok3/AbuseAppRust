import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, addMonths, differenceInCalendarDays, format, isSameDay, startOfDay, startOfMonth, subMonths } from "date-fns";
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
    const RECENTER_ON_LEAVE_THRESHOLD_DAYS = 5;
    const { language } = useI18n();
    const tr = (uk: string, en: string, ru: string) =>
      language === "en" ? en : language === "ru" ? ru : uk;

    const today = startOfDay(new Date());
    const [selectedDate, setSelectedDate] = React.useState(startOfDay(propSelectedDate ?? today));
    const [currentMonth, setCurrentMonth] = React.useState(startOfMonth(propSelectedDate ?? today));
    const [isCarouselHovered, setIsCarouselHovered] = React.useState(false);
    const carouselRef = React.useRef<HTMLDivElement | null>(null);

    React.useEffect(() => {
      if (!propSelectedDate) return;
      setSelectedDate(startOfDay(propSelectedDate));
      setCurrentMonth(startOfMonth(propSelectedDate));
    }, [propSelectedDate]);

    const days = React.useMemo(() => {
      const center = startOfDay(selectedDate);
      const start = addDays(center, -2);
      return Array.from({ length: 5 }, (_, i) => addDays(start, i));
    }, [selectedDate]);

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

    const monthLabel = (d: Date) => {
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
      return names[d.getMonth()];
    };

    const shouldShowYear = (d: Date) => {
      const currentYear = new Date().getFullYear();
      return d.getFullYear() !== currentYear;
    };

    const handleDateClick = (date: Date) => {
      const normalized = startOfDay(date);
      setSelectedDate(normalized);
      setCurrentMonth(startOfMonth(normalized));
      onDateSelect?.(normalized);
    };

    const navigateMonth = (direction: "prev" | "next") => {
      const nextMonth = direction === "prev" ? subMonths(currentMonth, 1) : addMonths(currentMonth, 1);
      setCurrentMonth(nextMonth);
      const nextSelected = startOfDay(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), selectedDate.getDate()));
      setSelectedDate(nextSelected);
      onDateSelect?.(nextSelected);
    };

    const shiftByWheel = React.useCallback((deltaX: number, deltaY: number) => {
      const dominantDelta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
      if (dominantDelta === 0) return;
      const nextDate = addDays(selectedDate, dominantDelta > 0 ? 1 : -1);
      handleDateClick(nextDate);
    }, [selectedDate]);

    const maybeRecenterToToday = React.useCallback(() => {
      const distanceDays = Math.abs(differenceInCalendarDays(selectedDate, today));
      if (distanceDays < RECENTER_ON_LEAVE_THRESHOLD_DAYS) return;
      setSelectedDate(today);
      setCurrentMonth(startOfMonth(today));
      onDateSelect?.(today);
    }, [selectedDate, today, onDateSelect]);

    const handleCarouselWheel: React.WheelEventHandler<HTMLDivElement> = (event) => {
      event.preventDefault();
      event.stopPropagation();
      shiftByWheel(event.deltaX, event.deltaY);
    };

    React.useEffect(() => {
      const node = carouselRef.current;
      if (!node) return;

      const nativeWheelHandler = (event: WheelEvent) => {
        event.preventDefault();
        event.stopPropagation();
        shiftByWheel(event.deltaX, event.deltaY);
      };

      node.addEventListener("wheel", nativeWheelHandler, { passive: false });
      return () => {
        node.removeEventListener("wheel", nativeWheelHandler);
      };
    }, [shiftByWheel]);

    React.useEffect(() => {
      if (!isCarouselHovered) return;

      const windowWheelHandler = (event: WheelEvent) => {
        const node = carouselRef.current;
        if (!node) return;
        const target = event.target as Node | null;
        if (!target || !node.contains(target)) return;

        event.preventDefault();
        event.stopPropagation();
        shiftByWheel(event.deltaX, event.deltaY);
      };

      window.addEventListener("wheel", windowWheelHandler, { passive: false, capture: true });
      return () => {
        window.removeEventListener("wheel", windowWheelHandler, true);
      };
    }, [isCarouselHovered, shiftByWheel]);

    return (
      <div
        ref={ref}
        className={cn(
          "w-full h-full rounded-3xl border border-white/10 bg-black/20 p-4 backdrop-blur-xl shadow-2xl text-white",
          "flex flex-col",
          className
        )}
        {...props}
      >
        <div className="flex items-center justify-between px-1">
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => navigateMonth("prev")}
            className="h-7 w-7 rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ChevronLeft className="mx-auto h-4 w-4" />
          </motion.button>

          <span className="text-lg font-display font-bold leading-tight text-white text-center">
            {monthLabel(currentMonth)}
            {shouldShowYear(currentMonth) ? (
              <span className="ml-1.5 text-white/85">{currentMonth.getFullYear()}</span>
            ) : null}
          </span>

          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => navigateMonth("next")}
            className="h-7 w-7 rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ChevronRight className="mx-auto h-4 w-4" />
          </motion.button>
        </div>

        <div className="flex-1 flex items-center pt-2">
          <div
            ref={carouselRef}
            className="w-full grid grid-cols-5 gap-2 overscroll-contain"
            onMouseEnter={() => {
              setIsCarouselHovered(true);
            }}
            onMouseLeave={() => {
              setIsCarouselHovered(false);
              maybeRecenterToToday();
            }}
            onWheelCapture={handleCarouselWheel}
            onWheel={handleCarouselWheel}
          >
            {days.map((date) => {
              const isToday = isSameDay(date, today);
              return (
                <motion.button
                  key={format(date, "yyyy-MM-dd")}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleDateClick(date)}
                  className={cn(
                    "h-20 w-10 justify-self-center rounded-xl border transition-all duration-200",
                    "flex flex-col items-center justify-between py-2",
                    isToday
                      ? "border-primary/70 bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg shadow-primary/25"
                      : "border-transparent bg-transparent text-white/40 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <span className="text-[10px] font-medium uppercase tracking-wide opacity-80 leading-none">
                    {dayName(date)}
                  </span>
                  <span className="text-sm font-bold leading-none">{format(date, "d")}</span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }
);

GlassCalendar.displayName = "GlassCalendar";
