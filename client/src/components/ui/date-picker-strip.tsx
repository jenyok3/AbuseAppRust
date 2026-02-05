import * as React from "react";
import { format, addDays, subDays, startOfDay, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";

interface DatePickerStripProps {
  selectedDate?: Date;
  onDateSelect?: (date: Date) => void;
  className?: string;
}

export const DatePickerStrip = React.forwardRef<HTMLDivElement, DatePickerStripProps>(
  ({ className, selectedDate: propSelectedDate, onDateSelect, ...props }, ref) => {
    const [selectedDate, setSelectedDate] = React.useState(propSelectedDate || new Date());
    
    // Generate dates for the strip (showing 5 days at a time)
    const [startIndex, setStartIndex] = React.useState(0);
    
    // Generate array of dates (30 days total for scrolling)
    const dates = React.useMemo(() => {
      const today = startOfDay(new Date());
      const dateArray = [];
      for (let i = -10; i <= 20; i++) {
        dateArray.push(addDays(today, i));
      }
      return dateArray;
    }, []);

    // Get visible dates (5 at a time)
    const visibleDates = dates.slice(startIndex, startIndex + 5);

    const handleDateClick = (date: Date) => {
      setSelectedDate(date);
      onDateSelect?.(date);
    };

    // Auto-select today's date if no date is selected
    React.useEffect(() => {
      if (!propSelectedDate) {
        const today = startOfDay(new Date());
        setSelectedDate(today);
        onDateSelect?.(today);
      }
    }, [propSelectedDate, onDateSelect]);

    const scrollLeft = () => {
      setStartIndex(Math.max(0, startIndex - 1));
    };

    const scrollRight = () => {
      setStartIndex(Math.min(dates.length - 5, startIndex + 1));
    };

    // Format day name in Ukrainian (shortened)
    const formatDayName = (date: Date) => {
      const dayNames = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
      return dayNames[date.getDay()];
    };

    return (
      <div
        ref={ref}
        className={cn(
          "w-full bg-black/20 backdrop-blur-xl rounded-2xl p-4",
          className
        )}
        {...props}
      >
        <div className="flex items-center justify-between">
          {/* Left scroll button */}
          <button
            onClick={scrollLeft}
            disabled={startIndex === 0}
            className={cn(
              "p-2 rounded-full transition-all duration-200 flex-shrink-0",
              startIndex === 0 
                ? "text-white/20 cursor-not-allowed" 
                : "text-white/70 hover:bg-white/10"
            )}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Date capsules - perfectly centered */}
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
                    <span className="text-xs font-medium mb-0.5">
                      {formatDayName(date)}
                    </span>
                    <span className="text-sm font-bold">
                      {format(date, "d")}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right scroll button */}
          <button
            onClick={scrollRight}
            disabled={startIndex >= dates.length - 5}
            className={cn(
              "p-2 rounded-full transition-all duration-200 flex-shrink-0",
              startIndex >= dates.length - 5 
                ? "text-white/20 cursor-not-allowed" 
                : "text-white/70 hover:bg-white/10"
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
