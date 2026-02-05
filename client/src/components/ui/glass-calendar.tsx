import * as React from "react";
import { ChevronLeft, ChevronRight, Plus, Edit2 } from "lucide-react";
import { format, addDays, subDays, startOfDay, isSameDay, addMonths, subMonths, startOfMonth } from "date-fns";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// --- SCROLLBAR HIDE COMPONENT ---
const ScrollbarHide = () => (
  <style>{`
    .hide-scrollbar::-webkit-scrollbar {
      display: none;
    }
    .hide-scrollbar {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
  `}</style>
);

// --- TYPES ---
export interface GlassCalendarProps {
  className?: string;
  selectedDate?: Date;
  onDateSelect?: (date: Date) => void;
}

// --- MAIN COMPONENT ---
export const GlassCalendar = React.forwardRef<HTMLDivElement, GlassCalendarProps>(
  ({ className, selectedDate: propSelectedDate, onDateSelect, ...props }, ref) => {
    const today = startOfDay(new Date());
    const [selectedDate, setSelectedDate] = React.useState(propSelectedDate || today);
    const [currentMonth, setCurrentMonth] = React.useState(propSelectedDate || today);
    
    // Calculate initial index based on selected date
    const getInitialIndex = (date: Date) => {
      const dateArray = [];
      const referenceDate = startOfMonth(today);
      for (let i = -180; i <= 180; i++) {
        dateArray.push(addDays(referenceDate, i));
      }
      const indexInArray = dateArray.findIndex(d => isSameDay(d, date));
      return indexInArray >= 2 && indexInArray <= dateArray.length - 3 ? indexInArray : 180;
    };
    
    const [currentIndex, setCurrentIndex] = React.useState(() => getInitialIndex(propSelectedDate || today));

    // Initialize with propSelectedDate if provided
    React.useEffect(() => {
      if (propSelectedDate) {
        setSelectedDate(propSelectedDate);
        setCurrentMonth(propSelectedDate);
        const newIndex = getInitialIndex(propSelectedDate);
        setCurrentIndex(newIndex);
      }
    }, [propSelectedDate]);

    // Generate days array for current month with seamless transitions
    const dates = React.useMemo(() => {
      const dateArray = [];
      // Always generate from a fixed reference point to ensure continuity
      const referenceDate = startOfMonth(today);
      
      // Generate more days to allow seamless month transitions
      for (let i = -180; i <= 180; i++) {
        dateArray.push(addDays(referenceDate, i));
      }
      return dateArray;
    }, [today]);

    // Get visible 5 days
    const visibleDates = React.useMemo(() => {
      const startIndex = Math.max(0, Math.min(currentIndex - 2, dates.length - 5));
      return dates.slice(startIndex, startIndex + 5);
    }, [currentIndex, dates]);

    // Update selected date when currentIndex changes
    React.useEffect(() => {
      if (visibleDates.length > 0) {
        const centerDate = visibleDates[Math.floor(visibleDates.length / 2)];
        // Only update selectedDate if it's different from current
        if (!isSameDay(centerDate, selectedDate)) {
          setSelectedDate(centerDate);
          onDateSelect?.(centerDate);
        }
        
        // Auto-update month when scrolling to different months
        const centerMonth = startOfMonth(centerDate);
        if (!isSameDay(centerMonth, startOfMonth(currentMonth))) {
          setCurrentMonth(centerMonth);
        }
      }
    }, [currentIndex, visibleDates, onDateSelect, selectedDate, currentMonth]);

    // Global wheel listener to prevent page scroll
    React.useEffect(() => {
      let isScrolling = false;
      
      const handleWheel = (e: WheelEvent) => {
        const carousel = document.querySelector('[data-calendar-carousel="true"]');
        
        if (carousel && carousel.contains(e.target as Node)) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          
          if (!isScrolling) {
            isScrolling = true;
            
            setCurrentIndex(prev => {
              const newIndex = e.deltaY < 0 
                ? Math.min(dates.length - 3, prev + 1)
                : Math.max(2, prev - 1);
              return newIndex;
            });
            
            setTimeout(() => {
              isScrolling = false;
            }, 100);
          }
          
          return false;
        }
      };

      document.addEventListener('wheel', handleWheel, { passive: false, capture: true });
      
      return () => {
        document.removeEventListener('wheel', handleWheel, { capture: true });
      };
    }, [dates.length]);

    const handleDateClick = (date: Date) => {
      // Find the index of the clicked date and center it
      const clickedIndex = dates.findIndex(d => isSameDay(d, date));
      if (clickedIndex >= 2 && clickedIndex <= dates.length - 3) {
        setCurrentIndex(clickedIndex);
      }
      // Always call onDateSelect when a date is clicked
      onDateSelect?.(date);
    };

    const handlePrevMonth = () => {
      const newMonth = subMonths(currentMonth, 1);
      setCurrentMonth(newMonth);
      // Find the index of the same day in the new month
      const targetDate = new Date(selectedDate);
      targetDate.setMonth(newMonth.getMonth());
      targetDate.setFullYear(newMonth.getFullYear());
      const targetIndex = dates.findIndex(d => isSameDay(d, targetDate));
      console.log('Prev month target date:', format(targetDate, "MMM dd"), 'index:', targetIndex);
      if (targetIndex >= 2 && targetIndex <= dates.length - 3) {
        setCurrentIndex(targetIndex);
      } else {
        setCurrentIndex(180); // Fallback to center
      }
      // Don't call onDateSelect for month navigation
    };

    const handleNextMonth = () => {
      const newMonth = addMonths(currentMonth, 1);
      setCurrentMonth(newMonth);
      // Find the index of the same day in the new month
      const targetDate = new Date(selectedDate);
      targetDate.setMonth(newMonth.getMonth());
      targetDate.setFullYear(newMonth.getFullYear());
      const targetIndex = dates.findIndex(d => isSameDay(d, targetDate));
      console.log('Next month target date:', format(targetDate, "MMM dd"), 'index:', targetIndex);
      if (targetIndex >= 2 && targetIndex <= dates.length - 3) {
        setCurrentIndex(targetIndex);
      } else {
        setCurrentIndex(180); // Fallback to center
      }
      // Don't call onDateSelect for month navigation
    };

    // Format day name in Ukrainian
    const formatDayName = (date: Date) => {
      const dayNames = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
      return dayNames[date.getDay()];
    };

    // Format month name in Ukrainian
    const formatMonthName = (date: Date) => {
      const monthNames = [
        'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
        'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'
      ];
      return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
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
        <ScrollbarHide />
        
        {/* Month/Year Display */}
        <div className="flex items-center justify-center text-base h-4">
          <div className="flex items-center space-x-3">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={handlePrevMonth}
              className="p-1 rounded-full text-white/70 transition-colors hover:bg-white/10"
            >
              <ChevronLeft className="h-4 w-4" />
            </motion.button>
            
            <span className="text-xl font-display font-bold text-white min-w-[120px] text-center">
              {formatMonthName(currentMonth)}
            </span>
            
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleNextMonth}
              className="p-1 rounded-full text-white/70 transition-colors hover:bg-white/10"
            >
              <ChevronRight className="h-4 w-4" />
            </motion.button>
          </div>
        </div>
        
        {/* Calendar Carousel */}
        <div className="flex items-center justify-center flex-1 overflow-hidden">
          <div 
            className="flex items-center justify-center space-x-2 mx-4 py-6"
            data-calendar-carousel="true"
          >
            {visibleDates.map((date, index) => {
              const isToday = isSameDay(date, today);
              const isSelected = isSameDay(date, selectedDate);
              return (
                <div key={`date-container-${index}`} className="relative py-2">
                  <motion.button
                    key={format(date, "yyyy-MM-dd")}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleDateClick(date)}
                    className={cn(
                      "flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all duration-300 w-10 h-20 relative overflow-hidden",
                      {
                        "bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg shadow-primary/30 scale-105": isToday,
                        "bg-transparent text-white/30 hover:bg-white/5 hover:text-white border border-transparent": !isToday,
                      }
                    )}
                  >
                    <span className="text-xs font-display font-medium uppercase tracking-wide flex-1 flex items-start justify-center -mt-1 opacity-70">
                      {formatDayName(date)}
                    </span>
                    <span className="text-sm font-bold">
                      {format(date, "d")}
                    </span>
                  </motion.button>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Divider */}
        <div className="mt-3 h-px bg-white/20" />

        {/* Footer Actions */}
        <div className="mt-3 flex items-center justify-between space-x-4">
           <button className="flex items-center space-x-2 text-sm font-medium text-white/70 transition-colors hover:text-white">
             <Edit2 className="h-4 w-4" />
             <span>Add a note...</span>
           </button>
           <button className="flex items-center space-x-2 text-sm font-medium text-white/70 transition-colors hover:text-white">
             <Plus className="h-4 w-4" />
             <span>New Event</span>
           </button>
        </div>
      </div>
    );
  }
);

GlassCalendar.displayName = "GlassCalendar";
