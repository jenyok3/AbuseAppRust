import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Columns3, Grid } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export type DayType = {
  day: string;
  classNames: string;
  meetingInfo?: {
    date: string;
    time: string;
    title: string;
    participants: string[];
    location: string;
  }[];
};

interface DayProps {
  classNames: string;
  day: DayType;
  onHover: (day: string | null) => void;
}

const Day: React.FC<DayProps> = ({ classNames, day, onHover }) => {
  const [isHovered, setIsHovered] = useState(false);
  return (
    <motion.div
      className={`relative flex items-center justify-center py-1 ${classNames}`}
      style={{ height: "4rem", borderRadius: 16 }}
      onMouseEnter={() => {
        setIsHovered(true);
        onHover(day.day);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        onHover(null);
      }}
      id={`day-${day.day}`}
    >
      <motion.div className="flex flex-col items-center justify-center">
        {!(day.day[0] === "+" || day.day[0] === "-") && (
          <span className="text-sm text-white">{day.day}</span>
        )}
      </motion.div>

      {day.meetingInfo && (
        <motion.div
          className="absolute bottom-1 right-1 flex size-5 items-center justify-center rounded-full bg-primary/80 p-1 text-[10px] font-bold text-white"
          layoutId={`day-${day.day}-meeting-count`}
          style={{ borderRadius: 999 }}
        >
          {day.meetingInfo.length}
        </motion.div>
      )}

      <AnimatePresence>
        {day.meetingInfo && isHovered && (
          <div className="absolute inset-0 flex size-full items-center justify-center">
            <motion.div
              className="flex size-10 items-center justify-center bg-primary/90 p-1 text-xs font-bold text-white"
              layoutId={`day-${day.day}-meeting-count`}
              style={{ borderRadius: 999 }}
            >
              {day.meetingInfo.length}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const CalendarGrid: React.FC<{ onHover: (day: string | null) => void; days: DayType[] }> = ({ onHover, days }) => {
  return (
    <div className="grid grid-cols-7 gap-1 sm:gap-2">
      {days.map((day, index) => (
        <Day key={`${day.day}-${index}`} classNames={day.classNames} day={day} onHover={onHover} />
      ))}
    </div>
  );
};

const buildDays = (meetingData: DayType["meetingInfo"]): DayType[] => {
  const base: DayType[] = [
    { day: "-3", classNames: "bg-card/20 backdrop-blur-sm border border-white/5" },
    { day: "-2", classNames: "bg-card/20 backdrop-blur-sm border border-white/5" },
    { day: "-1", classNames: "bg-card/20 backdrop-blur-sm border border-white/5" },
  ];

  for (let i = 1; i <= 30; i += 1) {
    const day = String(i).padStart(2, "0");
    const hasMeetings = i === 2 || i === 8 || i === 17 || i === 24;
    base.push({
      day,
      classNames: hasMeetings
        ? "bg-card/40 backdrop-blur-sm border border-white/10 cursor-pointer hover:bg-card/60 hover:border-primary/30 transition-all duration-200"
        : "bg-card/40 backdrop-blur-sm border border-white/10",
      meetingInfo: hasMeetings ? meetingData : undefined,
    });
  }

  base.push({ day: "+1", classNames: "bg-card/20 backdrop-blur-sm border border-white/5" });
  base.push({ day: "+2", classNames: "bg-card/20 backdrop-blur-sm border border-white/5" });
  return base;
};

const InteractiveCalendar = React.forwardRef<
  HTMLDivElement,
  Omit<React.ComponentPropsWithoutRef<typeof motion.div>, "ref">
>(({ ...props }, ref) => {
  const { language } = useI18n();
  const tr = (uk: string, en: string, ru: string) =>
    language === "en" ? en : language === "ru" ? ru : uk;

  const [moreView, setMoreView] = useState(false);
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);

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
  const now = new Date();
  const rawMonthTitle = new Intl.DateTimeFormat(locale, { month: "long" }).format(now);
  const monthTitle = `${rawMonthTitle.charAt(0).toUpperCase()}${rawMonthTitle.slice(1)}`;
  const monthYear = now.getFullYear();

  const sampleMeetings = [
    {
      date: tr("Ср, 8 Лис", "Wed, Nov 8", "Ср, 8 Ноя"),
      time: "14:00 - 15:00",
      title: tr("Планування спринту", "Sprint planning", "Планирование спринта"),
      participants: ["Alice Johnson", "Mark Lee"],
      location: "Google Meet",
    },
    {
      date: tr("Ср, 8 Лис", "Wed, Nov 8", "Ср, 8 Ноя"),
      time: "16:00 - 17:00",
      title: tr("Сесія Q&A", "Q&A session", "Сессия Q&A"),
      participants: ["Bob Smith", "Emma Stone"],
      location: tr("Офіс", "In person", "Офис"),
    },
  ];

  const days = React.useMemo(() => buildDays(sampleMeetings), [language]);

  const sortedDays = React.useMemo(() => {
    if (!hoveredDay) return days;
    return [...days].sort((a, b) => {
      if (a.day === hoveredDay) return -1;
      if (b.day === hoveredDay) return 1;
      return 0;
    });
  }, [hoveredDay, days]);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        ref={ref}
        className="relative mx-auto my-4 sm:my-6 lg:my-10 flex w-full flex-col items-center justify-center gap-6 lg:gap-8 lg:flex-row"
        {...props}
      >
        <motion.div layout className="w-full max-w-lg">
          <motion.div key="calendar-view" className="flex w-full flex-col gap-4">
            <div className="flex w-full items-center justify-between">
              <motion.h2 className="mb-2 text-2xl font-bold tracking-tight text-white flex items-center pt-1">
                {monthTitle} <span className="text-primary/60">{monthYear}</span>
              </motion.h2>
              <motion.button
                className="relative flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white/80 backdrop-blur-sm transition-all hover:bg-white/10 hover:border-white/20"
                onClick={() => setMoreView(!moreView)}
                onDrag={(e) => e.preventDefault()}
              >
                <div className="relative">
                  <Columns3 className="h-4 w-4" />
                  <div className={`absolute -top-1 -left-1 h-6 w-6 rounded-md bg-primary/20 transition-opacity duration-300 ${moreView ? "opacity-0" : "opacity-100"}`}></div>
                </div>
                <div className="relative">
                  <Grid className="h-4 w-4" />
                  <div className={`absolute -top-1 -left-1 h-6 w-6 rounded-md bg-primary/20 transition-opacity duration-300 ${moreView ? "opacity-100" : "opacity-0"}`}></div>
                </div>
              </motion.button>
            </div>

            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {weekdays.map((day) => (
                <div key={day} className="rounded-xl bg-card/40 backdrop-blur-sm border border-white/5 py-2 text-center text-xs font-medium text-white/60">
                  {day}
                </div>
              ))}
            </div>
            <CalendarGrid onHover={setHoveredDay} days={days} />
          </motion.div>
        </motion.div>

        {moreView && (
          <motion.div className="w-full max-w-lg" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} transition={{ duration: 0.3 }}>
            <motion.div key="more-view" className="mt-4 flex w-full flex-col gap-4">
              <div className="flex w-full flex-col items-start justify-between">
                <motion.h2 className="mb-2 text-2xl font-bold tracking-tight text-white">
                  {tr("Зустрічі", "Meetings", "Встречи")}
                </motion.h2>
                <p className="font-medium text-white/50">
                  {tr(
                    "Майбутні та минулі події, заплановані через ваші посилання.",
                    "Upcoming and past events booked via your links.",
                    "Будущие и прошлые события, запланированные по вашим ссылкам."
                  )}
                </p>
              </div>

              <motion.div className="flex min-h-[320px] max-h-[65dvh] sm:max-h-[620px] flex-col items-start justify-start overflow-hidden overflow-y-scroll rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm shadow-md" layout>
                <AnimatePresence>
                  {sortedDays
                    .filter((day) => day.meetingInfo)
                    .map((day) => (
                      <motion.div key={day.day} className="w-full border-b border-white/10 py-0 last:border-b-0" layout>
                        {day.meetingInfo?.map((meeting, mIndex) => (
                          <motion.div key={mIndex} className="border-b border-white/5 p-3 last:border-b-0" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2, delay: mIndex * 0.05 }}>
                            <div className="mb-2 flex items-center justify-between">
                              <span className="text-sm text-white">{meeting.date}</span>
                              <span className="text-sm text-white">{meeting.time}</span>
                            </div>
                            <h3 className="mb-1 text-lg font-semibold text-white">{meeting.title}</h3>
                            <p className="mb-1 text-sm text-zinc-600">{meeting.participants.join(", ")}</p>
                            <div className="flex items-center text-blue-500">
                              <span className="text-sm">{meeting.location}</span>
                            </div>
                          </motion.div>
                        ))}
                      </motion.div>
                    ))}
                </AnimatePresence>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
});

InteractiveCalendar.displayName = "InteractiveCalendar";

export default InteractiveCalendar;
