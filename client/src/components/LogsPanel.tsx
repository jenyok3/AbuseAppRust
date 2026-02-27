import { useState } from "react";
import { useLogs, useCreateProject } from "@/hooks/use-dashboard";
import { format } from "date-fns";
import { Terminal, Plus, FolderPlus, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";

export function LogsPanel({ hideAddProject = false }: { hideAddProject?: boolean }) {
  const { language } = useI18n();
  const tr = (uk: string, en: string, ru: string) =>
    language === "en" ? en : language === "ru" ? ru : uk;

  const { data: logs, isLoading } = useLogs();

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full w-full">
      <div className="flex-1 flex flex-col min-h-[300px] lg:min-h-0">
        <h2 className="text-lg font-display font-bold text-white mb-4 flex items-center gap-2">
          <Terminal className="text-muted-foreground w-5 h-5" />
          {tr("Останні дії", "Recent actions", "Последние действия")}
        </h2>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-3">
            {isLoading ? (
              <div className="text-muted-foreground text-sm font-mono">{tr("Завантаження логів...", "Loading logs...", "Загрузка логов...")}</div>
            ) : logs?.length === 0 ? (
              <div className="text-muted-foreground text-sm font-mono opacity-50">
                {tr("Система готова. Подій не зафіксовано.", "System ready. No activity logged.", "Система готова. Событий не зафиксировано.")}
              </div>
            ) : (
              logs?.map((log) => (
                <div key={log.id} className="flex gap-3 text-sm font-mono group hover:bg-white/5 p-2 rounded-lg transition-colors">
                  <span className="text-primary/70 shrink-0">
                    [{log.timestamp ? format(new Date(log.timestamp), "HH:mm:ss") : "--:--:--"}]
                  </span>
                  <span className="text-muted-foreground group-hover:text-white transition-colors break-all">
                    {log.message}
                  </span>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {!hideAddProject && (
        <div className="w-full lg:w-48 shrink-0 flex flex-col gap-4">
          <AddProjectDialog />
        </div>
      )}
    </div>
  );
}

export function AddProjectDialog({ variant = "dialog" }: { variant?: "dialog" | "widget" }) {
  const { language } = useI18n();
  const tr = (uk: string, en: string, ru: string) =>
    language === "en" ? en : language === "ru" ? ru : uk;

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [link, setLink] = useState("");
  const [type, setType] = useState<"telegram" | "chrome">("telegram");

  const { mutate: createProject, isPending } = useCreateProject();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    createProject(
      { name, link, type },
      {
        onSuccess: () => {
          setOpen(false);
          setName("");
          setLink("");
          setType("telegram");
          toast({ title: tr("Проєкт створено", "Project created", "Проект создан") });
        },
      }
    );
  };

  const renderForm = () => (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <FolderPlus className="w-5 h-5 text-primary" />
          {tr("Новий проєкт", "New project", "Новый проект")}
        </DialogTitle>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4 pt-4">
        <div className="space-y-2">
          <Label>{tr("Назва проєкту", "Project name", "Название проекта")}</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={tr("Мій крутий проєкт", "My cool project", "Мой крутой проект")}
            className="bg-black/50 border-white/10"
          />
        </div>

        <div className="space-y-2">
          <Label>{tr("Посилання (необов'язково)", "Link (optional)", "Ссылка (необязательно)")}</Label>
          <Input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://t.me/..."
            className="bg-black/50 border-white/10"
          />
        </div>

        <div className="space-y-2">
          <Label>{tr("Тип", "Type", "Тип")}</Label>
          <Select value={type} onValueChange={(value) => setType(value as "telegram" | "chrome")}> 
            <SelectTrigger className="bg-black/50 border-white/10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-black border-white/10 text-white">
              <SelectItem value="telegram">Telegram</SelectItem>
              <SelectItem value="chrome">Chrome</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DialogFooter className="pt-4">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="hover:bg-white/10 hover:text-white">
            {tr("Скасувати", "Cancel", "Отмена")}
          </Button>
          <Button type="submit" disabled={isPending} className="bg-primary text-white hover:bg-primary/90">
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {tr("Створити", "Create", "Создать")}
          </Button>
        </DialogFooter>
      </form>
    </>
  );

  if (variant === "widget") {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button className="h-full w-full border-2 border-dashed border-white/5 hover:border-primary/50 rounded-3xl flex flex-col items-center justify-center gap-3 text-muted-foreground hover:text-white transition-all hover:bg-white/5 group bg-card/20 backdrop-blur-sm stroke-dash-[10_15]">
            <div className="w-12 h-12 rounded-full bg-white/5 group-hover:bg-primary group-hover:text-white flex items-center justify-center transition-colors">
              <Plus className="w-6 h-6" />
            </div>
            <span className="font-medium text-lg">{tr("Додати проєкт", "Add project", "Добавить проект")}</span>
          </button>
        </DialogTrigger>
        <DialogContent className="bg-[#0a0a0a] border-white/10 text-white sm:max-w-md">{renderForm()}</DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="h-full min-h-[160px] w-full border-2 border-dashed border-white/10 hover:border-primary/50 rounded-3xl flex flex-col items-center justify-center gap-3 text-muted-foreground hover:text-white transition-all hover:bg-white/5 group">
          <div className="w-12 h-12 rounded-full bg-white/5 group-hover:bg-primary group-hover:text-white flex items-center justify-center transition-colors">
            <Plus className="w-6 h-6" />
          </div>
          <span className="font-medium">{tr("Додати проєкт", "Add project", "Добавить проект")}</span>
        </button>
      </DialogTrigger>
      <DialogContent className="bg-[#0a0a0a] border-white/10 text-white sm:max-w-md">{renderForm()}</DialogContent>
    </Dialog>
  );
}
