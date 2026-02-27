import * as React from "react";
import { format, addDays, startOfDay, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

interface DatePickerStripProps {
  selectedDate?: Date;
  onDateSelect?: (date: Date) => void;
  className?: string;
}

export const DatePickerStrip = React.forwardRef<HTMLDivElement, DatePickerStripProps>(
  ({ className, selectedDate: propSelectedDate, onDateSelect, ...props }, ref) => {
    const { language } = useI18n();
    const tr = (uk: string, en: string, ru: string) =>
      language === "en" ? en : language === "ru" ? ru : uk;

    const [selectedDate, setSelectedDate] = React.useState(propSelectedDate || new Date());
    const [startIndex, setStartIndex] = React.useState(0);

    const dates = React.useMemo(() => {
      const today = startOfDay(new Date());
      const dateArray = [];
      for (let i = -10; i <= 20; i++) dateArray.push(addDays(today, i));
      return dateArray;
    }, []);

    const visibleDates = dates.slice(startIndex, startIndex + 5);

    const handleDateClick = (date: Date) => {
      setSelectedDate(date);
      onDateSelect?.(date);
    };

    React.useEffect(() => {
      if (!propSelectedDate) {
        const today = startOfDay(new Date());
        setSelectedDate(today);
        onDateSelect?.(today);
      }
    }, [propSelectedDate, onDateSelect]);

    const dayName = (date: Date) => {
      const dayNames = [
        tr("Íä", "Su", "Âñ"),
        tr("Ïí", "Mo", "Ïí"),
        tr("Âò", "Tu", "Âò"),
        tr("Ñð", "We", "Ñð"),
        tr("×ò", "Th", "×ò"),
        tr("Ïò", "Fr", "Ïò"),
        tr("Ñá", "Sa", "Ñá"),
      ];
      return dayNames[date.getDay()];
    };

    return (
      <div ref={ref} className={cn("w-full bg-black/20 backdrop-blur-xl rounded-2xl p-4", className)} {...props}>
        <div className="flex items-center justify-between">
          <button
            onClick={() => setStartIndex(Math.max(0, startIndex - 1))}
            disabled={startIndex === 0}
            className={cn(
              "p-2 rounded-full transition-all duration-200 flex-shrink-0",
              startIndex === 0 ? "text-white/20 cursor-not-allowed" : "text-white/70 hover:bg-white/10"
            )}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="flex-1 flex items-center justify-center min-w-0">
            <div className="flex items-center justify-center space-x-2">
              {visibleDates.map((date) => {
                const isSelected = isSameDay(date, selectedDate);
                const isToday = isSameDay(date, startOfDay(new Date()));
                return (
                  <button
                    key={format(date, "yyyy-MM-dd")}
                    onClick={() => handleDateClick(date)}
                    className={cn(
                      "flex flex-col items-center justify-center py-3 px-3 rounded-lg transition-all duration-200 w-14 flex-shrink-0",
                      {
                        "bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg shadow-purple-500/30": isSelected,
                        "bg-white/20 text-white border border-white/30": !isSelected && isToday,
                        "bg-white/10 text-white/80 hover:bg-white/20 hover:text-white": !isSelected && !isToday,
                      }
                    )}
                  >
                    <span className="text-xs font-medium mb-0.5">{dayName(date)}</span>
                    <span className="text-sm font-bold">{format(date, "d")}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={() => setStartIndex(Math.min(dates.length - 5, startIndex + 1))}
            disabled={startIndex >= dates.length - 5}
            className={cn(
              "p-2 rounded-full transition-all duration-200 flex-shrink-0",
              startIndex >= dates.length - 5 ? "text-white/20 cursor-not-allowed" : "text-white/70 hover:bg-white/10"
            )}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    );
  }
);

DatePickerStrip.displayName = "DatePickerStrip";
