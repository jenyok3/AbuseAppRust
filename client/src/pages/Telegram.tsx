import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { Rocket, Loader2, ExternalLink, Plus, Edit, Trash2, Terminal, Activity, Circle, Wifi, Layers, GhostIcon as Ghost, Calendar, AppWindow, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { DailyTasksPanel } from "@/components/DailyTasksPanel";
import { GlassCalendar } from "@/components/ui/glass-calendar";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, isToday, isSameYear } from "date-fns";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { GhostIcon } from "@/components/ui/ghost-icon";

export default function Telegram() {
  const { toast } = useToast();
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [startRange, setStartRange] = useState("");
  const [endRange, setEndRange] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isMix, setIsMix] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [accountFilter, setAccountFilter] = useState<string>("all"); // all, активні, заблоковані
  const [showPlansModal, setShowPlansModal] = useState(false);

  // Filter accounts based on selected filter
  const filteredAccounts = [
    { id: 1, name: 'user1@example.com', status: 'активні', proxy: '', notes: '' },
    { id: 2, name: 'user2@example.com', status: 'заблоковані', proxy: '', notes: '' },
    { id: 3, name: 'user3@example.com', status: 'активні', proxy: '', notes: '' },
    { id: 4, name: 'user4@example.com', status: 'заблоковані', proxy: '', notes: '' },
    { id: 5, name: 'user5@example.com', status: 'активні', proxy: '', notes: '' },
    { id: 6, name: 'user6@example.com', status: 'активні', proxy: '', notes: '' },
    { id: 7, name: 'user7@example.com', status: 'заблоковані', proxy: '', notes: '' },
    { id: 8, name: 'user8@example.com', status: 'активні', proxy: '', notes: '' },
    { id: 9, name: 'user9@example.com', status: 'заблоковані', proxy: '', notes: '' },
    { id: 10, name: 'user10@example.com', status: 'активні', proxy: '', notes: '' },
    { id: 11, name: 'user11@example.com', status: 'активні', proxy: '', notes: '' },
    { id: 12, name: 'user12@example.com', status: 'заблоковані', proxy: '', notes: '' },
    { id: 13, name: 'user13@example.com', status: 'активні', proxy: '', notes: '' },
    { id: 14, name: 'user14@example.com', status: 'заблоковані', proxy: '', notes: '' },
    { id: 15, name: 'user15@example.com', status: 'активні', proxy: '', notes: '' },
    { id: 16, name: 'user16@example.com', status: 'активні', proxy: '', notes: '' },
    { id: 17, name: 'user17@example.com', status: 'заблоковані', proxy: '', notes: '' },
    { id: 18, name: 'user18@example.com', status: 'активні', proxy: '', notes: '' },
    { id: 19, name: 'user19@example.com', status: 'заблоковані', proxy: '', notes: '' },
    { id: 20, name: 'user20@example.com', status: 'активні', proxy: '', notes: '' },
  ].filter(account => {
    if (accountFilter === "all") return true;
    return account.status === accountFilter;
  });

  // Calculate stats based on filter
  const stats = {
    total: filteredAccounts.length,
    active: filteredAccounts.filter(a => a.status === 'активні').length,
    blocked: filteredAccounts.filter(a => a.status === 'заблоковані').length
  };

  // Force black background
  useEffect(() => {
    document.body.style.backgroundColor = '#000000';
    document.body.style.backgroundImage = 'none';
    document.body.style.background = '#000000';
    
    return () => {
      document.body.style.backgroundColor = '';
      document.body.style.backgroundImage = '';
      document.body.style.background = '';
    };
  }, []);

  const handleLaunch = () => {
    if (!selectedProject) {
      toast({
        title: "Error",
        description: "Please select a project first",
        variant: "destructive",
      });
      return;
    }

    setIsLaunching(true);
    setTimeout(() => {
      setIsLaunching(false);
      toast({
        title: "Launched Successfully",
        description: `Campaign started for project`,
      });
    }, 2000);
  };

  return (
    <div 
      className="min-h-screen bg-black text-white overflow-y-auto !bg-black" 
      style={{ backgroundColor: '#000000' }}
    >
      {/* Ambient background effects - removed for pure black background */}
      {/* <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 right-0 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl" />
      </div> */}

      <main className="relative z-10 max-w-7xl mx-auto min-h-screen pt-6 px-6 pr-6 pb-20">
        {/* Main content area */}
        <div className="flex flex-col gap-6">
          {/* Top row - Mass Launch, Stats and Recent Actions */}
          <div className="grid grid-cols-[3.6fr_1.4fr] gap-6">
            {/* Left column - Mass Launch, Stats and Recent Actions */}
            <div className="flex flex-col gap-6">
              {/* Mass Launch Panel */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
                className="bg-card/40 backdrop-blur-sm border border-white/5 rounded-3xl p-6 lg:p-8 flex flex-col relative overflow-hidden group h-full w-full"
                style={{ height: '460px' }}
              >
                {/* Decorative background glow */}
                <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary/20 rounded-full blur-3xl group-hover:bg-primary/30 transition-all duration-700 pointer-events-none" />

                <h2 className="text-2xl font-display font-bold text-white mb-6 flex items-center gap-3">
                  <Rocket className="text-primary w-6 h-6" />
                  Масовий запуск
                </h2>

                <div className="space-y-4 flex-1">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs uppercase tracking-wider font-bold">Проект</Label>
                    <div className="flex items-center gap-2">
                      <Select value={selectedProject} onValueChange={setSelectedProject}>
                        <SelectTrigger className="bg-black/50 border-white/10 h-10 rounded-xl focus:ring-0 focus:ring-offset-0 focus:border-white/20 text-white flex-1">
                          <SelectValue placeholder="Виберіть проект" />
                        </SelectTrigger>
                        <SelectContent className="bg-black border-white/10 text-white min-w-[300px]">
                          <SelectItem value="1" className="focus:bg-primary/20 focus:text-white relative group/item">
                            <div className="flex items-center w-full">
                              <span className="flex-1">Test Project 1</span>
                            </div>
                            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                              <Button size="icon" variant="ghost" className="h-6 w-6 hover:bg-white/10">
                                <Edit className="w-3 h-3" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-6 w-6 hover:bg-red-500/20">
                                <Trash2 className="w-3 h-3 text-red-400" />
                              </Button>
                            </div>
                          </SelectItem>
                          <SelectItem value="2" className="focus:bg-primary/20 focus:text-white relative group/item">
                            <div className="flex items-center w-full">
                              <span className="flex-1">Test Project 2</span>
                            </div>
                            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                              <Button size="icon" variant="ghost" className="h-6 w-6 hover:bg-white/10">
                                <Edit className="w-3 h-3" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-6 w-6 hover:bg-red-500/20">
                                <Trash2 className="w-3 h-3 text-red-400" />
                              </Button>
                            </div>
                          </SelectItem>
                          <SelectItem value="3" className="focus:bg-primary/20 focus:text-white relative group/item">
                            <div className="flex items-center w-full">
                              <span className="flex-1">Test Project 3</span>
                            </div>
                            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                              <Button size="icon" variant="ghost" className="h-6 w-6 hover:bg-white/10">
                                <Edit className="w-3 h-3" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-6 w-6 hover:bg-red-500/20">
                                <Trash2 className="w-3 h-3 text-red-400" />
                              </Button>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 border border-white/10 bg-transparent hover:bg-white/10 hover:text-white transition-all duration-200 flex-shrink-0"
                        onClick={() => {
                          toast({
                            title: "Додавання проекту",
                            description: "Функція додавання нових проектів",
                          });
                        }}
                      >
                        <Plus className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="space-y-2 w-32 shrink-0">
                      <Label className="text-muted-foreground text-xs uppercase tracking-wider font-bold">Початок</Label>
                      <Input 
                        type="number" 
                        placeholder="1" 
                        value={startRange}
                        onChange={(e) => setStartRange(e.target.value)}
                        className="bg-black/50 border-white/10 h-10 rounded-xl focus:border-primary/50 text-white font-mono" 
                      />
                    </div>
                    <div className="space-y-2 w-32 shrink-0">
                      <Label className="text-muted-foreground text-xs uppercase tracking-wider font-bold">Кінець</Label>
                      <Input 
                        type="number" 
                        placeholder="100" 
                        value={endRange}
                        onChange={(e) => setEndRange(e.target.value)}
                        className="bg-black/50 border-white/10 h-10 rounded-xl focus:border-primary/50 text-white font-mono" 
                      />
                    </div>
                    <div className="flex-1" />
                  </div>

                  <div className="flex items-center space-x-3 pt-1">
                    <Checkbox 
                      id="mix" 
                      checked={isMix}
                      onCheckedChange={(checked) => setIsMix(checked as boolean)}
                      className="border-white/20 data-[state=checked]:bg-primary data-[state=checked]:text-white w-5 h-5 rounded-md" 
                    />
                    <Label htmlFor="mix" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer text-muted-foreground">
                      Увімкнути режим "Мікс"
                    </Label>
                  </div>
                </div>

                <div className="mt-6">
                  <Button 
                    onClick={handleLaunch}
                    disabled={isLaunching || !selectedProject}
                    className="w-full h-12 text-base font-bold bg-primary hover:bg-primary/90 text-white shadow-[0_0_20px_rgba(157,0,255,0.4)] hover:shadow-[0_0_30px_rgba(157,0,255,0.6)] hover:-translate-y-0.5 transition-all duration-300 rounded-xl uppercase tracking-widest"
                  >
                    {isLaunching ? (
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    ) : (
                      "ЗАПУСТИТИ"
                    )}
                  </Button>
                </div>
              </motion.div>

              {/* Stats and Recent Actions row - 2 columns */}
              <div className="grid grid-cols-2 gap-6">
                {/* Widget 1 - Останні дії */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.6 }}
                  className="bg-card/40 backdrop-blur-sm border border-white/5 rounded-2xl p-4 h-56 flex flex-col"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="text-primary w-5 h-5 shrink-0" />
                    <h3 className="text-xl font-display font-bold text-white">Останні дії</h3>
                  </div>
                  
                  <ScrollArea className="flex-1">
                    <div className="space-y-2">
                      <div className="flex gap-3 text-sm font-mono group hover:bg-white/5 p-2 rounded-lg transition-colors">
                        <span className="text-primary/70 shrink-0">[10:42:27]</span>
                        <span className="text-muted-foreground group-hover:text-white transition-colors break-all">
                          Запустив Stellar
                        </span>
                      </div>
                    </div>
                  </ScrollArea>
                </motion.div>

                {/* Widget 2 - Статистика акаунтів */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.5 }}
                  className="bg-card/40 backdrop-blur-sm border border-white/5 rounded-2xl p-4 h-56 flex flex-col"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Activity className="text-primary w-5 h-5 shrink-0" />
                    <h3 className="text-xl font-display font-bold text-white">Статистика акаунтів</h3>
                  </div>
                  
                  <div className="flex-1 flex">
                    {/* Left side - Chart */}
                    <div className="flex-1 flex items-center justify-center">
                      <div className="w-full h-40 relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={[
                                { name: "Активні", value: stats.active, color: "#22c55e" },
                                { name: "Заблоковані", value: stats.blocked, color: "#64748b" },
                              ]}
                              cx="50%"
                              cy="50%"
                              innerRadius={30}
                              outerRadius={50}
                              paddingAngle={2}
                              dataKey="value"
                              stroke="none"
                            >
                              {[
                                { name: "Активні", value: stats.active, color: "#22c55e" },
                                { name: "Заблоковані", value: stats.blocked, color: "#64748b" },
                              ].map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                        
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <span className="text-3xl font-bold font-mono text-white">{stats.total}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Right column - Calendar and Daily Tasks stacked */}
            <div className="flex flex-col gap-6 h-[436px]">
              {/* Calendar Widget */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.4 }}
                className="h-64 flex items-center justify-center"
              >
                <div className="w-full h-full flex items-center justify-center">
                  <GlassCalendar 
                    selectedDate={selectedDate}
                    className="w-full h-full"
                  />
                </div>
              </motion.div>

              {/* Daily Tasks Widget */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.5 }}
                className="flex flex-col h-full"
              >
                <DailyTasksPanel />
              </motion.div>
            </div>
          </div>

          {/* Bottom row - Accounts List - Full width */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.5 }}
          >
            <h3 className="text-xl font-bold text-white mb-4">Список акаунтів</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <AnimatePresence mode="popLayout">
                {filteredAccounts.length > 0 ? (
                  filteredAccounts.map((account, index) => (
                    <motion.div
                      key={account.id}
                      layout
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ 
                        duration: 0.3,
                        ease: "easeInOut"
                      }}
                    />
                  ))
                ) : (
                  <motion.div
                    key="empty-state"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ 
                      duration: 0.3,
                      ease: "easeInOut"
                    }}
                    className="col-span-full flex flex-col items-center justify-center py-16 text-center"
                  >
                    <Ghost className="w-16 h-16 text-slate-400 mb-4" />
                    <p className="text-xl font-medium text-slate-300 mb-2">
                      {accountFilter === "заблоковані" ? "Чисто! Жодного бану" : "Немає акаунтів"}
                    </p>
                    <p className="text-sm text-slate-500">
                      {accountFilter === "заблоковані" 
                        ? "Усі акаунти в порядку" 
                        : "Спробуйте змінити фільтр"
                      }
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
