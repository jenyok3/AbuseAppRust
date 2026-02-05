import { useState } from "react";
import { useProjects, useCreateLog } from "@/hooks/use-dashboard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Rocket, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function LaunchPanel() {
  const { data: projects, isLoading: projectsLoading } = useProjects();
  const { mutate: createLog, isPending: isLaunching } = useCreateLog();
  const { toast } = useToast();

  const [selectedProject, setSelectedProject] = useState<string>("");
  const [startRange, setStartRange] = useState("");
  const [endRange, setEndRange] = useState("");
  const [isMix, setIsMix] = useState(false);

  const handleLaunch = () => {
    if (!selectedProject) {
      toast({
        title: "Error",
        description: "Please select a project first",
        variant: "destructive",
      });
      return;
    }

    const project = projects?.find(p => p.id.toString() === selectedProject);
    const projectName = project ? project.name : "Unknown Project";

    createLog({
      message: `Launched ${projectName} (Range: ${startRange || 'All'}-${endRange || 'All'}, Mix: ${isMix ? 'Yes' : 'No'})`,
    }, {
      onSuccess: () => {
        toast({
          title: "Launched Successfully",
          description: `Campaign started for ${projectName}`,
        });
      }
    });
  };

  return (
    <div className="bg-card/40 backdrop-blur-sm border border-white/5 rounded-3xl p-6 lg:p-8 flex flex-col relative overflow-hidden group h-full w-full">
      {/* Decorative background glow */}
      <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary/20 rounded-full blur-3xl group-hover:bg-primary/30 transition-all duration-700 pointer-events-none" />

      <h2 className="text-2xl font-display font-bold text-white mb-6 flex items-center gap-3">
        <Rocket className="text-primary w-6 h-6" />
        Масовий запуск
      </h2>

      <div className="space-y-4 flex-1">
        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs uppercase tracking-wider font-bold">Проект</Label>
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="bg-black/50 border-white/10 h-10 rounded-xl focus:ring-primary/50 text-white">
              <SelectValue placeholder="Виберіть проект" />
            </SelectTrigger>
            <SelectContent className="bg-black border-white/10 text-white">
              {projectsLoading ? (
                <div className="p-2 text-center text-xs text-muted-foreground">Loading...</div>
              ) : projects?.length === 0 ? (
                <div className="p-2 text-center text-xs text-muted-foreground">No projects found</div>
              ) : (
                projects?.map((project) => (
                  <SelectItem key={project.id} value={project.id.toString()} className="focus:bg-primary/20 focus:text-white">
                    {project.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
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
          <Label htmlFor="mix" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
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
    </div>
  );
}
