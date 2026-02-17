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
      className={cn("bg-transparent border border-white/5 rounded-2xl p-4 h-56 flex flex-col relative overflow-hidden max-w-md w-full", className)}
    >
      <div className="flex items-center gap-2 mb-3">
        <Activity className="text-primary w-5 h-5 shrink-0" />
        <h3 className="text-xl font-display font-bold text-white">Статистика акаунтів</h3>
      </div>

      <div className="flex-1 flex">
        <div className="flex-1 flex items-center justify-center relative">
          {chartData.length > 0 ? (
            <div className="w-40 h-40 relative mx-auto">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={66}
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
            <div className="w-40 h-40 flex items-center justify-center mx-auto">
              <div className="text-center">
                <p className="text-muted-foreground text-sm">Немає даних для відображення</p>
              </div>
            </div>
          )}

          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-4xl font-bold font-mono text-white leading-none tracking-tighter">
              {finalStats.total}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2 justify-center items-center flex-1 min-w-[120px]">
          <button
            type="button"
            onClick={() => onFilterChange?.("all")}
            className={cn(
              "flex items-center gap-2 py-2 px-2 rounded-lg w-fit transition-all duration-200",
              onFilterChange ? "cursor-pointer hover:bg-white/10" : "cursor-default"
            )}
          >
            <Contact className="text-primary w-5 h-5" />
            <span className="text-xl font-bold font-mono tabular-nums text-primary text-right w-[3ch]">{finalStats.total}</span>
          </button>

          <button
            type="button"
            onClick={() => onFilterChange?.("активні")}
            className={cn(
              "flex items-center gap-2 py-2 px-2 rounded-lg w-fit transition-all duration-200",
              onFilterChange ? "cursor-pointer hover:bg-white/10" : "cursor-default",
              activeFilter === "активні" && "bg-white/10"
            )}
          >
            <AppWindow className="text-green-500 w-5 h-5" />
            <span className="text-xl font-bold font-mono tabular-nums text-green-500 text-right w-[3ch]">{finalStats.running}</span>
          </button>

          <button
            type="button"
            onClick={() => onFilterChange?.("заблоковані")}
            className={cn(
              "flex items-center gap-2 py-2 px-2 rounded-lg w-fit transition-all duration-200",
              onFilterChange ? "cursor-pointer hover:bg-white/10" : "cursor-default",
              activeFilter === "заблоковані" && "bg-white/10"
            )}
          >
            <img src={blockedGhostIcon} alt="Blocked accounts" className="w-5 h-5 object-contain shrink-0" />
            <span className="text-xl font-bold font-mono tabular-nums text-gray-400 text-right w-[3ch]">{finalStats.blocked}</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
