import { useState } from "react";
import { CheckCircle2, Circle, AlertCircle } from "lucide-react";
import { Button } from "./button";
import { ScrollArea } from "./scroll-area";
import { useI18n } from "@/lib/i18n";

interface Task {
  id: string;
  title: string;
  completed: boolean;
  priority: "high" | "medium" | "low";
}

interface DailyTasksPanelProps {
  tasks: Task[];
}

export function DailyTasksPanel({ tasks }: DailyTasksPanelProps) {
  const { language } = useI18n();
  const tr = (uk: string, en: string, ru: string) =>
    language === "en" ? en : language === "ru" ? ru : uk;

  const [taskStates, setTaskStates] = useState<Record<string, boolean>>(() =>
    tasks.reduce((acc, task) => ({ ...acc, [task.id]: task.completed }), {})
  );

  const toggleTask = (taskId: string) => {
    setTaskStates((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "text-red-500";
      case "medium":
        return "text-yellow-500";
      case "low":
        return "text-green-500";
      default:
        return "text-gray-500";
    }
  };

  const getPriorityBg = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-500/20";
      case "medium":
        return "bg-yellow-500/20";
      case "low":
        return "bg-green-500/20";
      default:
        return "bg-gray-500/20";
    }
  };

  return (
    <ScrollArea className="h-full">
      <div className="space-y-3">
        {tasks.map((task) => (
          <div key={task.id} className="flex items-center gap-3 p-3 rounded-xl bg-black/20 border border-white/5 hover:bg-black/30 transition-all">
            <Button variant="ghost" size="sm" onClick={() => toggleTask(task.id)} className="w-6 h-6 p-0 hover:bg-white/10">
              {taskStates[task.id] ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Circle className="w-4 h-4 text-muted-foreground" />}
            </Button>

            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium truncate ${taskStates[task.id] ? "line-through text-muted-foreground" : ""}`}>
                {task.title}
              </p>
            </div>

            <div className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityBg(task.priority)} ${getPriorityColor(task.priority)}`}>
              {task.priority === "high"
                ? tr("Високий", "High", "Высокий")
                : task.priority === "medium"
                  ? tr("Середній", "Medium", "Средний")
                  : tr("Низький", "Low", "Низкий")}
            </div>
          </div>
        ))}

        {tasks.length === 0 && (
          <div className="text-center py-8">
            <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {tr("Немає завдань на сьогодні", "No tasks for today", "Нет задач на сегодня")}
            </p>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
