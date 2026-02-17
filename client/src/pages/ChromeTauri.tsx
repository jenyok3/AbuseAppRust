import { motion } from "framer-motion";
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  getAccounts, 
  launchAccounts, 
  getAccountStats, 
  getRecentActions, 
  getDailyTasks 
} from "@/lib/tauri-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Clock, Users, Send, Chrome, Play, Pause, Settings, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { GlassCalendar } from "@/components/ui/glass-calendar";
import { DailyTasksPanel } from "@/components/ui/daily-tasks-panel";

export default function ChromeTauri() {
  const [selectedProject, setSelectedProject] = useState("chrome");
  const [startRange, setStartRange] = useState("1");
  const [endRange, setEndRange] = useState("10");
  const [mixMode, setMixMode] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);

  const queryClient = useQueryClient();

  // Queries for data from Tauri backend
  const { data: accounts = [], isLoading: accountsLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts
  });

  const { data: stats = { active: 0, blocked: 0, total: 0 } } = useQuery<{
    active: number;
    blocked: number;
    total: number;
  }>({
    queryKey: ['account-stats'],
    queryFn: () => getAccountStats()
  });

  const { data: recentActions = [] } = useQuery({
    queryKey: ['recent-actions'],
    queryFn: getRecentActions
  });

  const { data: dailyTasks = [] } = useQuery({
    queryKey: ['daily-tasks'],
    queryFn: getDailyTasks
  });

  // Mutation for launching accounts
  const launchMutation = useMutation({
    mutationFn: launchAccounts,
    onSuccess: (data) => {
      console.log("Launch success:", data);
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['recent-actions'] });
    },
    onError: (error) => {
      console.error("Launch error:", error);
    }
  });

  const handleLaunch = () => {
    const accountsToLaunch = selectedAccounts.length > 0 
      ? selectedAccounts 
      : accounts.slice(0, parseInt(endRange)).map((acc: any) => acc.id);
    
    launchMutation.mutate(accountsToLaunch);
  };

  const filteredAccounts = accounts.filter((account: any) => {
    if (filterStatus === "all") return true;
    return account.status === filterStatus;
  });

  const chartData = [
    { name: "Активні", value: stats.active, color: "#10b981" },
    { name: "Заблоковані", value: stats.blocked, color: "#ef4444" }
  ];

  useEffect(() => {
    document.body.style.backgroundColor = '#000000';
    return () => {
      document.body.style.backgroundColor = '';
    };
  }, []);

  return (
    <div className="flex-1 overflow-hidden relative font-body text-white">
      {/* Background ambient effects */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[10%] left-[20%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-[10%] right-[10%] w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[100px]" />
      </div>

      <main className="relative z-10 max-w-7xl mx-auto min-h-screen pt-6 px-6 pr-6 pb-20">
        <div className="flex flex-col gap-6">
          {/* Top row - Mass Launch and Calendar/Daily side by side */}
          <div className="grid grid-cols-[3.6fr_1.4fr] gap-6">
            {/* Left column - Mass Launch */}
            <div className="flex flex-col gap-6">
              {/* Mass Launch Panel */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
                className="bg-card/40 backdrop-blur-sm border border-white/5 rounded-3xl p-6 lg:p-8 flex flex-col relative overflow-hidden group h-full w-full"
                style={{ height: '460px' }}
              >
                {/* Ambient glow effect */}
                <div className="absolute -inset-px bg-gradient-to-r from-primary/20 to-blue-500/20 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                      <Chrome className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold tracking-tight">Масовий запуск</h2>
                      <p className="text-muted-foreground text-sm">Chrome акаунти</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {/* Project Selection */}
                    <div className="space-y-2">
                      <Label htmlFor="project" className="text-sm font-medium text-zinc-400">Проект</Label>
                      <Select value={selectedProject} onValueChange={setSelectedProject}>
                        <SelectTrigger className="bg-black/40 border-white/5 h-12 rounded-xl focus:border-primary/50 transition-all">
                          <SelectValue placeholder="Оберіть проект" />
                        </SelectTrigger>
                        <SelectContent className="bg-black/90 border-white/10 backdrop-blur-sm">
                          <SelectItem value="chrome">Chrome</SelectItem>
                          <SelectItem value="telegram">Telegram</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Range Input */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="start" className="text-sm font-medium text-zinc-400">Від</Label>
                        <Input
                          id="start"
                          type="number"
                          value={startRange}
                          onChange={(e) => setStartRange(e.target.value)}
                          className="bg-black/40 border-white/5 h-12 rounded-xl focus:border-primary/50 transition-all"
                          placeholder="1"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="end" className="text-sm font-medium text-zinc-400">До</Label>
                        <Input
                          id="end"
                          type="number"
                          value={endRange}
                          onChange={(e) => setEndRange(e.target.value)}
                          className="bg-black/40 border-white/5 h-12 rounded-xl focus:border-primary/50 transition-all"
                          placeholder="10"
                        />
                      </div>
                    </div>

                    {/* Mix Mode */}
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        id="mix"
                        checked={mixMode}
                        onCheckedChange={(checked) => setMixMode(checked === true)}
                        className="border-white/20 bg-black/40 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      />
                      <Label htmlFor="mix" className="text-sm font-medium text-zinc-300 cursor-pointer">
                        Мікс (рандомний порядок)
                      </Label>
                    </div>

                    {/* Launch Button */}
                    <Button
                      onClick={handleLaunch}
                      disabled={launchMutation.isPending}
                      className="w-full h-14 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-semibold transition-all duration-300 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {launchMutation.isPending ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Запуск...</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Play className="w-5 h-5" />
                          <span>ЗАПУСТИТИ</span>
                        </div>
                      )}
                    </Button>
                  </div>
                </div>
              </motion.div>

              {/* Recent Actions and Stats Row */}
              <div className="grid grid-cols-2 gap-6">
                {/* Recent Actions */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.4 }}
                  className="bg-card/40 backdrop-blur-sm border border-white/5 rounded-3xl p-6"
                >
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-primary" />
                    Останні дії
                  </h3>
                  <ScrollArea className="h-48">
                    <div className="space-y-3">
                      {recentActions.slice(0, 5).map((action: any) => (
                        <div key={action.id} className="flex items-center gap-3 p-3 rounded-xl bg-black/20 border border-white/5">
                          <div className={`w-2 h-2 rounded-full ${
                            action.status === 'success' ? 'bg-green-500' : 
                            action.status === 'pending' ? 'bg-yellow-500' : 'bg-red-500'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{action.action}</p>
                            <p className="text-xs text-muted-foreground">{action.account}</p>
                          </div>
                          <span className="text-xs text-muted-foreground">{action.time}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </motion.div>

                {/* Account Stats */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.5 }}
                  className="bg-card/40 backdrop-blur-sm border border-white/5 rounded-3xl p-6"
                >
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />
                    Статистика акаунтів
                  </h3>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'rgba(0, 0, 0, 0.9)', 
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '8px'
                          }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-500">{stats.active}</p>
                      <p className="text-xs text-muted-foreground">Активні</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-500">{stats.blocked}</p>
                      <p className="text-xs text-muted-foreground">Заблоковані</p>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Right column - Calendar and Daily Tasks */}
            <div className="flex flex-col gap-6">
              {/* Calendar */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.6 }}
                className="bg-card/40 backdrop-blur-sm border border-white/5 rounded-3xl p-6"
                style={{ height: '220px' }}
              >
                <h3 className="text-lg font-semibold mb-4">Календар</h3>
                <GlassCalendar />
              </motion.div>

              {/* Daily Tasks */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.7 }}
                className="bg-card/40 backdrop-blur-sm border border-white/5 rounded-3xl p-6 flex-1"
                style={{ minHeight: '220px' }}
              >
                <h3 className="text-lg font-semibold mb-4">Daily Tasks</h3>
                <DailyTasksPanel tasks={dailyTasks} />
              </motion.div>
            </div>
          </div>

          {/* Accounts List - Full width at bottom */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.8 }}
            className="bg-card/40 backdrop-blur-sm border border-white/5 rounded-3xl p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold flex items-center gap-2">
                <Users className="w-6 h-6 text-primary" />
                Список акаунтів
              </h3>
              <div className="flex items-center gap-4">
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-32 bg-black/40 border-white/5 h-10 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-black/90 border-white/10">
                    <SelectItem value="all">Всі</SelectItem>
                    <SelectItem value="active">Активні</SelectItem>
                    <SelectItem value="blocked">Заблоковані</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">
                  {filteredAccounts.length} з {accounts.length}
                </span>
              </div>
            </div>

            {filteredAccounts.length > 0 ? (
              <ScrollArea className="h-96">
                <div className="grid gap-3">
                  {filteredAccounts.map((account: any) => (
                    <motion.div
                      key={account.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-4 p-4 rounded-xl bg-black/20 border border-white/5 hover:bg-black/30 transition-all cursor-pointer"
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        account.type === 'telegram' ? 'bg-blue-500/20' : 'bg-green-500/20'
                      }`}>
                        {account.type === 'telegram' ? 
                          <Send className="w-5 h-5 text-blue-500" /> : 
                          <Chrome className="w-5 h-5 text-green-500" />
                        }
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{account.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {account.type} • {account.lastActive}
                        </p>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                        account.status === 'active' 
                          ? 'bg-green-500/20 text-green-500' 
                          : 'bg-red-500/20 text-red-500'
                      }`}>
                        {account.status === 'active' ? 'Активний' : 'Заблокований'}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex flex-col items-center justify-center h-96 text-center">
                <div className="w-16 h-16 rounded-full bg-muted/20 flex items-center justify-center mb-4">
                  <Users className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Немає акаунтів</h3>
                <p className="text-muted-foreground max-w-md">
                  Немає акаунтів для відображення. Спробуйте змінити фільтр або додайте нові акаунти.
                </p>
              </div>
            )}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
