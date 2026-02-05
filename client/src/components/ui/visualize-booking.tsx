// visualize-booking.tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Columns3, Grid } from 'lucide-react';

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
    <>
      <motion.div
        className={`relative flex items-center justify-center py-1 ${classNames}`}
        style={{ height: '4rem', borderRadius: 16 }}
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
          {!(day.day[0] === '+' || day.day[0] === '-') && (
            <span className="text-sm text-white">{day.day}</span>
          )}
        </motion.div>
        {day.meetingInfo && (
          <motion.div
            className="absolute bottom-1 right-1 flex size-5 items-center justify-center rounded-full bg-primary/80 p-1 text-[10px] font-bold text-white"
            layoutId={`day-${day.day}-meeting-count`}
            style={{
              borderRadius: 999,
            }}
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
                style={{
                  borderRadius: 999,
                }}
              >
                {day.meetingInfo.length}
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
};

const CalendarGrid: React.FC<{ onHover: (day: string | null) => void }> = ({
  onHover,
}) => {
  return (
    <div className="grid grid-cols-7 gap-2">
      {DAYS.map((day, index) => (
        <Day
          key={`${day.day}-${index}`}
          classNames={day.classNames}
          day={day}
          onHover={onHover}
        />
      ))}
    </div>
  );
};

const InteractiveCalendar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const [moreView, setMoreView] = useState(false);
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);

  const handleDayHover = (day: string | null) => {
    setHoveredDay(day);
  };

  const sortedDays = React.useMemo(() => {
    if (!hoveredDay) return DAYS;
    return [...DAYS].sort((a, b) => {
      if (a.day === hoveredDay) return -1;
      if (b.day === hoveredDay) return 1;
      return 0;
    });
  }, [hoveredDay]);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        ref={ref}
        className="relative mx-auto my-10 flex w-full flex-col items-center justify-center gap-8 lg:flex-row"
        {...props}
      >
        <motion.div layout className="w-full max-w-lg">
          <motion.div
            key="calendar-view"
            className="flex w-full flex-col gap-4"
          >
            <div className="flex w-full items-center justify-between">
              <motion.h2 className="mb-2 text-2xl font-bold tracking-tight text-white flex items-center pt-1">
                Листопад <span className="text-primary/60">2024</span>
              </motion.h2>
              <motion.button
                className="relative flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white/80 backdrop-blur-sm transition-all hover:bg-white/10 hover:border-white/20"
                onClick={() => setMoreView(!moreView)}
                onDrag={(e) => e.preventDefault()}
              >
                <div className="relative">
                  <Columns3 className="h-4 w-4" />
                  <div
                    className={`absolute -top-1 -left-1 h-6 w-6 rounded-md bg-primary/20 transition-opacity duration-300 ${moreView ? 'opacity-0' : 'opacity-100'}`}
                  ></div>
                </div>
                <div className="relative">
                  <Grid className="h-4 w-4" />
                  <div
                    className={`absolute -top-1 -left-1 h-6 w-6 rounded-md bg-primary/20 transition-opacity duration-300 ${moreView ? 'opacity-100' : 'opacity-0'}`}
                  ></div>
                </div>
              </motion.button>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {daysOfWeek.map((day) => (
                <div
                  key={day}
                  className="rounded-xl bg-card/40 backdrop-blur-sm border border-white/5 py-2 text-center text-xs font-medium text-white/60"
                >
                  {day}
                </div>
              ))}
            </div>
            <CalendarGrid onHover={handleDayHover} />
          </motion.div>
        </motion.div>
        {moreView && (
          <motion.div
            className="w-full max-w-lg"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              key="more-view"
              className="mt-4 flex w-full flex-col gap-4"
            >
              <div className="flex w-full flex-col items-start justify-between">
                <motion.h2 className="mb-2 text-2xl font-bold tracking-tight text-white">
                  Зустрічі
                </motion.h2>
                <p className="font-medium text-white/50">
                  Майбутні та минулі події, заброньовані через ваші посилання на типи подій.
                </p>
              </div>
              <motion.div
                className="flex h-[620px] flex-col items-start justify-start overflow-hidden overflow-y-scroll rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm shadow-md"
                layout
              >
                <AnimatePresence>
                  {sortedDays
                    .filter((day) => day.meetingInfo)
                    .map((day) => (
                      <motion.div
                        key={day.day}
                        className={`w-full border-b border-white/10 py-0 last:border-b-0`}
                        layout
                      >
                        {day.meetingInfo &&
                          day.meetingInfo.map((meeting, mIndex) => (
                            <motion.div
                              key={mIndex}
                              className="border-b border-white/5 p-3 last:border-b-0"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              transition={{
                                duration: 0.2,
                                delay: mIndex * 0.05,
                              }}
                            >
                              <div className="mb-2 flex items-center justify-between">
                                <span className="text-sm text-white">
                                  {meeting.date}
                                </span>
                                <span className="text-sm text-white">
                                  {meeting.time}
                                </span>
                              </div>
                              <h3 className="mb-1 text-lg font-semibold text-white">
                                {meeting.title}
                              </h3>
                              <p className="mb-1 text-sm text-zinc-600">
                                {meeting.participants.join(', ')}
                              </p>
                              <div className="flex items-center text-blue-500">
                                <svg
                                  className="mr-1 h-4 w-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                                  />
                                </svg>
                                <span className="text-sm">
                                  {meeting.location}
                                </span>
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
InteractiveCalendar.displayName = 'InteractiveCalendar';

export default InteractiveCalendar;

const DAYS: DayType[] = [
  { day: '-3', classNames: 'bg-card/20 backdrop-blur-sm border border-white/5' },
  { day: '-2', classNames: 'bg-card/20 backdrop-blur-sm border border-white/5' },
  { day: '-1', classNames: 'bg-card/20 backdrop-blur-sm border border-white/5' },
  { day: '01', classNames: 'bg-card/40 backdrop-blur-sm border border-white/10' },
  {
    day: '02',
    classNames: 'bg-card/40 backdrop-blur-sm border border-white/10 cursor-pointer hover:bg-card/60 hover:border-primary/30 transition-all duration-200',
    meetingInfo: [
      {
        date: 'Ср, 2 лист',
        time: '10:00 - 11:00',
        title: 'Обговорення дизайну',
        participants: ['Аліса Джонсон', 'Марк Лі'],
        location: 'Zoom',
      },
      {
        date: 'Ср, 2 лист',
        time: '13:00 - 14:00',
        title: 'Планування спринту',
        participants: ['Том Хенкс', 'Джесіка Вайт'],
        location: 'Google Meet',
      },
    ],
  },
  { day: '03', classNames: 'bg-card/40 backdrop-blur-sm border border-white/10' },
  {
    day: '04',
    classNames: 'bg-card/20 backdrop-blur-sm border border-white/5',
  },
  { day: '05', classNames: 'bg-card/20 backdrop-blur-sm border border-white/5' },
  {
    day: '06',
    classNames: 'bg-card/40 backdrop-blur-sm border border-white/10 cursor-pointer hover:bg-card/60 hover:border-primary/30 transition-all duration-200',
    meetingInfo: [
      {
        date: 'Пн, 6 лист',
        time: '10:00 - 11:00',
        title: 'Брейншторм',
        participants: ['Сара Паркер', 'Кумail Нанджі'],
        location: 'Zoom',
      },
    ],
  },
  { day: '07', classNames: 'bg-card/40 backdrop-blur-sm border border-white/10' },
  {
    day: '08',
    classNames: 'bg-card/40 backdrop-blur-sm border border-white/10 cursor-pointer hover:bg-card/60 hover:border-primary/30 transition-all duration-200',
    meetingInfo: [
      {
        date: 'Ср, 8 лист',
        time: '14:00 - 15:00',
        title: 'Стратегічна зустріч',
        participants: ['Роберт Грін', 'Девід Лі'],
        location: 'Google Meet',
      },
      {
        date: 'Ср, 8 лист',
        time: '16:00 - 17:00',
        title: 'Перегляд бюджету',
        participants: ['Джесіка Вайт', 'Том Хенкс'],
        location: 'Microsoft Teams',
      },
      {
        date: 'Ср, 8 лист',
        time: '17:30 - 18:30',
        title: 'Сесія Q&A',
        participants: ['Боб Сміт', 'Емма Стоун'],
        location: 'Очно',
      },
    ],
  },
  { day: '09', classNames: 'bg-card/40 backdrop-blur-sm border border-white/10' },
  {
    day: '10',
    classNames: 'bg-card/40 backdrop-blur-sm border border-white/10',
  },
  { day: '11', classNames: 'bg-card/20 backdrop-blur-sm border border-white/5' },
  {
    day: '12',
    classNames: 'bg-card/20 backdrop-blur-sm border border-white/5',
  },
  { day: '13', classNames: 'bg-card/40 backdrop-blur-sm border border-white/10' },
  { day: '14', classNames: 'bg-card/40 backdrop-blur-sm border border-white/10' },
  {
    day: '15',
    classNames: 'bg-card/40 backdrop-blur-sm border border-white/10 cursor-pointer hover:bg-card/60 hover:border-primary/30 transition-all duration-200',
    meetingInfo: [
      {
        date: 'Ср, 15 лист',
        time: '9:00 - 10:00',
        title: 'Зворотний зв\'язок від клієнта',
        participants: ['Сара Паркер', 'Кумail Нанджі'],
        location: 'Очно в офісі',
      },
    ],
  },
  { day: '16', classNames: 'bg-card/40 backdrop-blur-sm border border-white/10' },
  {
    day: '17',
    classNames: 'bg-card/40 backdrop-blur-sm border border-white/10 cursor-pointer hover:bg-card/60 hover:border-primary/30 transition-all duration-200',
    meetingInfo: [
      {
        date: 'Пт, 17 лист',
        time: '9:00 - 10:00',
        title: 'Щоденний стендап',
        participants: ['Девід Лі', 'Софія Янг'],
        location: 'Microsoft Teams',
      },
      {
        date: 'Пт, 17 лист',
        time: '11:00 - 12:00',
        title: 'Оновлення клієнта',
        participants: ['Сара Паркер', 'Кумail Нанджі'],
        location: 'Очно',
      },
      {
        date: 'Пт, 17 лист',
        time: '14:00 - 15:00',
        title: 'Демонстрація функцій',
        participants: ['Боб Сміт', 'Емма Стоун'],
        location: 'Zoom',
      },
      {
        date: 'Пт, 17 лист',
        time: '16:00 - 17:00',
        title: 'Сесія відгуків',
        participants: ['Марк Лі', 'Аліса Джонсон'],
        location: 'Google Meet',
      },
    ],
  },
  { day: '18', classNames: 'bg-card/20 backdrop-blur-sm border border-white/5' },
  { day: '19', classNames: 'bg-card/20 backdrop-blur-sm border border-white/5' },
  { day: '20', classNames: 'bg-card/40 backdrop-blur-sm border border-white/10' },
  { day: '21',
    classNames: 'bg-card/40 backdrop-blur-sm border border-white/10 cursor-pointer hover:bg-card/60 hover:border-primary/30 transition-all duration-200',
    meetingInfo: [
      {
        date: 'Вт, 21 лист',
        time: '11:00 - 12:00',
        title: 'Запуск продукту',
        participants: ['Аліса Джонсон', 'Марк Лі'],
        location: 'Zoom',
      },
      {
        date: 'Вт, 21 лист',
        time: '13:00 - 14:00',
        title: 'Відгуки клієнтів',
        participants: ['Сара Паркер', 'Кумail Нанджі'],
        location: 'Google Meet',
      },
      {
        date: 'Вт, 21 лист',
        time: '15:00 - 16:00',
        title: 'Дизайн ітерація',
        participants: ['Девід Лі', 'Софія Янг'],
        location: 'Очно',
      },
      {
        date: 'Вт, 21 лист',
        time: '17:00 - 18:00',
        title: 'Командна вечірка',
        participants: ['Боб Сміт', 'Джесіка Вайт'],
        location: 'Тераса офісу',
      },
      {
        date: 'Вт, 21 лист',
        time: '19:00 - 20:00',
        title: 'Happy Hour',
        participants: ['Том Хенкс', 'Емма Стоун'],
        location: 'Місцевий бар',
      },
    ],
  },
  { day: '22', classNames: 'bg-card/40 backdrop-blur-sm border border-white/10' },
  { day: '23', classNames: 'bg-card/40 backdrop-blur-sm border border-white/10' },
  { day: '24',
    classNames: 'bg-card/40 backdrop-blur-sm border border-white/10',
  },
  { day: '25', classNames: 'bg-card/20 backdrop-blur-sm border border-white/5' },
  { day: '26', classNames: 'bg-card/20 backdrop-blur-sm border border-white/5' },
  {
    day: '27',
    classNames: 'bg-card/40 backdrop-blur-sm border border-white/10',
  },
  { day: '28', classNames: 'bg-card/40 backdrop-blur-sm border border-white/10' },
  {
    day: '29',
    classNames: 'bg-card/40 backdrop-blur-sm border border-white/10',
  },
  {
    day: '30',
    classNames: 'bg-card/40 backdrop-blur-sm border border-white/10 cursor-pointer hover:bg-card/60 hover:border-primary/30 transition-all duration-200',
    meetingInfo: [
      {
        date: 'Чт, 30 лист',
        time: '11:00 - 12:00',
        title: 'Брейншторм',
        participants: ['Девід Лі', 'Софія Янг'],
        location: 'Zoom',
      },
    ],
  },
  { day: '+1', classNames: 'bg-card/20 backdrop-blur-sm border border-white/5' },
  { day: '+2', classNames: 'bg-card/20 backdrop-blur-sm border border-white/5' },
];

const daysOfWeek = ['НД', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];
