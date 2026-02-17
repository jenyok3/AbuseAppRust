import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save, FolderOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { openDirectoryDialog, saveSettings as saveSettingsTauri } from "@/lib/tauri-api";

export default function Settings() {
  const { toast } = useToast();
  const [telegramThreads, setTelegramThreads] = useState<string>("");
  const [telegramFolderPath, setTelegramFolderPath] = useState<string>("");
  const [chromeThreads, setChromeThreads] = useState<string>("");
  const [chromeFolderPath, setChromeFolderPath] = useState<string>("");
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    // Load settings from localStorage on mount
    const savedSettings = localStorage.getItem('appSettings');
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setTelegramThreads(settings.telegramThreads || "");
      setTelegramFolderPath(settings.telegramFolderPath || "");
      setChromeThreads(settings.chromeThreads || "");
      setChromeFolderPath(settings.chromeFolderPath || "");
    }
  }, []);

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

  const handleSave = async () => {
    // Save settings to localStorage
    const settings = {
      telegramThreads,
      telegramFolderPath,
      chromeThreads,
      chromeFolderPath
    };
    localStorage.setItem('appSettings', JSON.stringify(settings));

    try {
      // Keep native (Rust) settings in sync for backend stats and commands
      await saveSettingsTauri(settings);
    } catch (error) {
      console.error("Failed to persist settings to Tauri backend:", error);
    }
    
    // Dispatch custom event to notify other components
    window.dispatchEvent(new CustomEvent('settingsUpdated', { detail: settings }));
    
    toast({
      title: "Налаштування збережено",
      description: "Ваші зміни успішно застосовані.",
    });
    setHasChanges(false);
  };

  const handleSelectTelegramFolder = async () => {
    try {
      const selectedPath = await openDirectoryDialog() as string;
      if (selectedPath) {
        setTelegramFolderPath(selectedPath);
        setHasChanges(true);
        toast({
          title: "Папку вибрано",
          description: `Обрано папку: ${selectedPath}`,
        });
      }
    } catch (error) {
      toast({
        title: "Помилка вибору папки",
        description: "Не вдалося відкрити діалог вибору папки",
        variant: "destructive",
      });
    }
  };

  const handleSelectChromeFolder = async () => {
    try {
      const selectedPath = await openDirectoryDialog() as string;
      if (selectedPath) {
        setChromeFolderPath(selectedPath);
        setHasChanges(true);
        toast({
          title: "Папку вибрано",
          description: `Обрано папку: ${selectedPath}`,
        });
      }
    } catch (error) {
      toast({
        title: "Помилка вибору папки",
        description: "Не вдалося відкрити діалог вибору папки",
        variant: "destructive",
      });
    }
  };

  return (
    <div 
      className="min-h-screen bg-black text-white overflow-y-auto" 
      style={{ backgroundColor: '#000000' }}
    >
      <main className="max-w-2xl mx-auto pt-16 px-6 pb-20">
        <div className="flex items-center gap-3 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Налаштування</h1>
            <p className="text-muted-foreground">Керування параметрами системи</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Telegram Settings */}
          <div className="bg-card/40 backdrop-blur-sm border border-white/5 rounded-3xl p-8 space-y-6">
            <h2 className="text-xl font-semibold">
              Telegram
            </h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="telegramThreads" className="text-sm font-medium text-zinc-400">
                  Кількість потоків
                </Label>
                <div className="text-xs text-zinc-500">
                  Вкажіть кількість одночасних потоків для Telegram
                </div>
                <Input
                  id="telegramThreads"
                  type="number"
                  value={telegramThreads}
                  onChange={(e) => {
                    setTelegramThreads(e.target.value);
                    setHasChanges(true);
                  }}
                  className="bg-black/40 border-white/5 h-12 rounded-xl pl-4 focus:outline-none"
                  placeholder="1"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="telegramFolderPath" className="text-sm font-medium text-zinc-400">
                  Шлях до папки з акаунтами
                </Label>
                <div className="text-xs text-zinc-500">
                  Вкажіть повний шлях до папки з акаунтами Telegram
                </div>
                <div className="flex gap-2">
                  <Input
                    id="telegramFolderPath"
                    value={telegramFolderPath}
                    onChange={(e) => {
                      setTelegramFolderPath(e.target.value);
                      setHasChanges(true);
                    }}
                    className="bg-black/40 border-white/5 h-12 rounded-xl pl-4 focus:outline-none flex-1"
                    placeholder="C:\Users\Admin\Documents\TelegramAccounts"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleSelectTelegramFolder}
                    className="bg-black/40 border-white/5 h-12 w-12 rounded-xl hover:bg-white/10 transition-all"
                  >
                    <FolderOpen className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Chrome Settings */}
          <div className="bg-card/40 backdrop-blur-sm border border-white/5 rounded-3xl p-8 space-y-6">
            <h2 className="text-xl font-semibold">
              Chrome
            </h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="chromeThreads" className="text-sm font-medium text-zinc-400">
                  Кількість потоків
                </Label>
                <div className="text-xs text-zinc-500">
                  Вкажіть кількість одночасних потоків для Chrome
                </div>
                <Input
                  id="chromeThreads"
                  type="number"
                  value={chromeThreads}
                  onChange={(e) => {
                    setChromeThreads(e.target.value);
                    setHasChanges(true);
                  }}
                  className="bg-black/40 border-white/5 h-12 rounded-xl pl-4 focus:outline-none"
                  placeholder="1"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="chromeFolderPath" className="text-sm font-medium text-zinc-400">
                  Шлях до папки з акаунтами
                </Label>
                <div className="text-xs text-zinc-500">
                  Вкажіть повний шлях до папки з акаунтами Chrome
                </div>
                <div className="flex gap-2">
                  <Input
                    id="chromeFolderPath"
                    value={chromeFolderPath}
                    onChange={(e) => {
                      setChromeFolderPath(e.target.value);
                      setHasChanges(true);
                    }}
                    className="bg-black/40 border-white/5 h-12 rounded-xl pl-4 focus:outline-none flex-1"
                    placeholder="C:\Users\Admin\Documents\ChromeAccounts"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleSelectChromeFolder}
                    className="bg-black/40 border-white/5 h-12 w-12 rounded-xl hover:bg-white/10 transition-all"
                  >
                    <FolderOpen className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-8 pb-8">
            <Button 
              onClick={handleSave}
              disabled={!hasChanges}
              className="bg-primary hover:bg-primary/90 text-white px-8 py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4 mr-2" />
              Зберегти
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
