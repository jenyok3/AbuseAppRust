import { useState } from "react";
import { useDailyTasks, useCreateDailyTask, useToggleDailyTask, useDeleteDailyTask } from "@/hooks/use-dashboard";
import { CheckSquare, Plus, Trash2, Check, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DailyTasksPanel() {
  const { data: tasks, isLoading } = useDailyTasks();
  const { mutate: createTask, isPending: isCreating } = useCreateDailyTask();
  const { mutate: toggleTask } = useToggleDailyTask();
  const { mutate: deleteTask } = useDeleteDailyTask();
  
  const [newTaskTitle, setNewTaskTitle] = useState("");
  
  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    
    createTask({ title: newTaskTitle }, {
      onSuccess: () => setNewTaskTitle("")
    });
  };

  return (
    <div className="bg-card/40 backdrop-blur-sm border border-white/5 rounded-3xl p-6 flex flex-col h-full w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
          <CheckSquare className="text-primary w-5 h-5" />
          Daily
        </h2>
        <span className="text-xs font-mono text-muted-foreground bg-white/5 px-2 py-1 rounded">
          {tasks?.filter(t => t.isCompleted).length || 0} / {tasks?.length || 0}
        </span>
      </div>
      
      <ScrollArea className="flex-1 -mx-2 px-2">
        <div className="space-y-2 pb-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Loading tasks...</div>
          ) : tasks?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm opacity-50">No daily tasks set.</div>
          ) : (
            tasks?.map((task) => (
              <div 
                key={task.id} 
                className="group flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-all border border-transparent hover:border-white/5"
              >
                <label className="checkbox-container">
                  <input 
                    type="checkbox"
                    checked={task.isCompleted || false}
                    onChange={(e) => toggleTask({ id: task.id, isCompleted: e.target.checked })}
                  />
                  <svg viewBox="0 0 64 64" height="20" width="20">
                    <path d="M 0 16 V 56 A 8 8 90 0 0 8 64 H 56 A 8 8 90 0 0 64 56 V 8 A 8 8 90 0 0 56 0 H 8 A 8 8 90 0 0 0 8 V 16 L 32 48 L 64 16 V 8 A 8 8 90 0 0 56 0 H 8 A 8 8 90 0 0 0 8 V 56 A 8 8 90 0 0 8 64 H 56 A 8 8 90 0 0 64 56 V 16" className="checkbox-path"></path>
                  </svg>
                </label>
                <span className={cn(
                  "flex-1 text-sm transition-all duration-300",
                  task.isCompleted ? "text-muted-foreground" : "text-white"
                )}>
                  {task.title}
                </span>
                <button 
                  onClick={() => deleteTask(task.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-400/10 rounded-md transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
      
      <form onSubmit={handleCreate} className="mt-4">
        <div className="relative group">
          <Input 
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="Додати нове завдання..."
            className="daily-tasks-input !bg-black/50 !border-white/10 text-sm h-10 rounded-xl pr-12 w-full transition-all duration-300 !focus:outline-none !focus:border-primary/50 !focus:bg-black/60 !focus:ring-2 !focus:ring-primary/20 !focus-visible:outline-none !focus-visible:border-primary/50 !focus-visible:bg-black/60 !focus-visible:ring-2 !focus-visible:ring-primary/20 !focus-visible:ring-offset-0"
          />
          <Button 
            type="submit" 
            disabled={isCreating || !newTaskTitle.trim()}
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 shrink-0 bg-transparent/20 backdrop-blur-sm border border-white/10 rounded-lg hover:bg-primary/20 hover:text-white hover:border-primary/30 transition-all duration-300 group-hover:bg-primary/10"
          >
            {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          </Button>
        </div>
      </form>
    </div>
  );
}
