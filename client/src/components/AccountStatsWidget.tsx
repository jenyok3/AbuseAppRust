import { motion } from "framer-motion";
import { Activity, Contact, AppWindow } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";
import blockedGhostIcon from "@/assets/icons/blocked-ghost-custom.png";

interface AccountStatsWidgetProps {
  className?: string;
  stats?: {
    total: number;
    running: number;
    blocked: number;
  };
  isLoading?: boolean;
  activeFilter?: "all" | "активні" | "заблоковані";
  onFilterChange?: (filter: "all" | "активні" | "заблоковані") => void;
}

export function AccountStatsWidget({
  className,
  stats,
  isLoading = false,
  activeFilter = "all",
  onFilterChange,
}: AccountStatsWidgetProps) {
  const defaultStats = { total: 0, running: 0, blocked: 0 };
  const finalStats = stats || defaultStats;

  const chartData = [
    { name: "Запущено", value: finalStats.running, color: "#22c55e" },
    { name: "Заблоковано", value: finalStats.blocked, color: "#64748b" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.5 }}
      className={cn("bg-transparent border border-white/5 rounded-2xl p-3 sm:p-4 h-auto sm:h-56 min-h-56 flex flex-col relative overflow-hidden w-full", className)}
    >
      <div className="flex items-center gap-2 mb-3">
        <Activity className="text-primary w-5 h-5 shrink-0" />
        <h3 className="text-base sm:text-xl font-display font-bold text-white leading-tight">Статистика акаунтів</h3>
      </div>

      <div className="flex-1 min-w-0">
        <div className="grid gap-4 grid-cols-[minmax(0,260px),minmax(0,1fr)]">
          <div className="flex items-center justify-center relative min-h-[140px]">
            {chartData.length > 0 ? (
              <div className="w-28 h-28 sm:w-40 sm:h-40 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius="58%"
                      outerRadius="78%"
                      paddingAngle={0}
                      dataKey="value"
                      stroke="none"
                      strokeWidth={0}
                      startAngle={90}
                      endAngle={-270}
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="w-28 h-28 sm:w-40 sm:h-40 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-muted-foreground text-sm">Немає даних для відображення</p>
                </div>
              </div>
            )}

            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-3xl sm:text-4xl font-bold font-mono text-white leading-none tracking-tighter">
                {finalStats.total}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2 justify-center items-center w-full">
            <button
              type="button"
              onClick={() => onFilterChange?.("all")}
              className={cn(
                "flex items-center justify-between sm:justify-start gap-2 py-2 px-2 rounded-lg w-full transition-all duration-200 min-w-[9rem]",
                onFilterChange ? "cursor-pointer hover:bg-white/10" : "cursor-default"
              )}
            >
              <Contact className="text-primary w-5 h-5 flex-shrink-0" />
              <span className="text-lg sm:text-xl font-bold font-mono tabular-nums text-primary text-right w-[3ch]">{finalStats.total}</span>
            </button>

            <button
              type="button"
              onClick={() => onFilterChange?.("активні")}
              className={cn(
                "flex items-center justify-between sm:justify-start gap-2 py-2 px-2 rounded-lg w-full transition-all duration-200 min-w-[9rem]",
                onFilterChange ? "cursor-pointer hover:bg-white/10" : "cursor-default",
                activeFilter === "активні" && "bg-white/10"
              )}
            >
              <AppWindow className="text-green-500 w-5 h-5 flex-shrink-0" />
              <span className="text-lg sm:text-xl font-bold font-mono tabular-nums text-green-500 text-right w-[3ch]">{finalStats.running}</span>
            </button>

            <button
              type="button"
              onClick={() => onFilterChange?.("заблоковані")}
              className={cn(
                "flex items-center justify-between sm:justify-start gap-2 py-2 px-2 rounded-lg w-full transition-all duration-200 min-w-[9rem]",
                onFilterChange ? "cursor-pointer hover:bg-white/10" : "cursor-default",
                activeFilter === "заблоковані" && "bg-white/10"
              )}
            >
              <img src={blockedGhostIcon} alt="Blocked accounts" className="w-5 h-5 object-contain flex-shrink-0" />
              <span className="text-lg sm:text-xl font-bold font-mono tabular-nums text-gray-400 text-right w-[3ch]">{finalStats.blocked}</span>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
