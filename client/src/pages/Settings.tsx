import { useEffect, useState } from "react";
import { useRef, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save, FolderOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { openDirectoryDialog, saveSettings as saveSettingsTauri } from "@/lib/tauri-api";
import { localStore } from "@/lib/localStore";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export default function Settings() {
  const { toast } = useToast();
  const [telegramThreads, setTelegramThreads] = useState<string>("");
  const [telegramFolderPath, setTelegramFolderPath] = useState<string>("");
  const [chromeThreads, setChromeThreads] = useState<string>("");
  const [chromeFolderPath, setChromeFolderPath] = useState<string>("");
  const [themeEffect, setThemeEffect] = useState<"none" | "winter" | "autumn" | "spring" | "summer">("none");
  const [themeSnowSpeed, setThemeSnowSpeed] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<"general" | "themes">("general");
  const [initialSettings, setInitialSettings] = useState({
    telegramThreads: "",
    telegramFolderPath: "",
    chromeThreads: "",
    chromeFolderPath: "",
    themeEffect: "none" as "none" | "winter" | "autumn" | "spring" | "summer",
    themeSnowSpeed: 1,
  });
  const snowTrackRef = useRef<HTMLDivElement | null>(null);
  const [isDraggingSnow, setIsDraggingSnow] = useState(false);
  const [snowDragValue, setSnowDragValue] = useState<number | null>(null);
  const snowMin = 0.5;
  const snowMax = 2;
  const snowStep = 0.1;

  useEffect(() => {
    const settings = localStore.getSettings();
    setTelegramThreads(settings.telegramThreads || "");
    setTelegramFolderPath(settings.telegramFolderPath || "");
    setChromeThreads(settings.chromeThreads || "");
    setChromeFolderPath(settings.chromeFolderPath || "");
    setThemeEffect(settings.themeEffect || "none");
    setThemeSnowSpeed(typeof settings.themeSnowSpeed === "number" ? settings.themeSnowSpeed : 1);
    setInitialSettings({
      telegramThreads: settings.telegramThreads || "",
      telegramFolderPath: settings.telegramFolderPath || "",
      chromeThreads: settings.chromeThreads || "",
      chromeFolderPath: settings.chromeFolderPath || "",
      themeEffect: settings.themeEffect || "none",
      themeSnowSpeed: typeof settings.themeSnowSpeed === "number" ? settings.themeSnowSpeed : 1,
    });
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

  const handleSave = async (section: "telegram" | "chrome") => {
    const persisted = localStore.getSettings();
    const settings =
      section === "telegram"
        ? {
            ...persisted,
            telegramThreads,
            telegramFolderPath,
          }
        : {
            ...persisted,
            chromeThreads,
            chromeFolderPath,
          };
    localStore.saveSettings(settings);

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
    setInitialSettings((prev) => ({
      telegramThreads: section === "telegram" ? telegramThreads : prev.telegramThreads,
      telegramFolderPath: section === "telegram" ? telegramFolderPath : prev.telegramFolderPath,
      chromeThreads: section === "chrome" ? chromeThreads : prev.chromeThreads,
      chromeFolderPath: section === "chrome" ? chromeFolderPath : prev.chromeFolderPath,
      themeEffect: prev.themeEffect,
      themeSnowSpeed: prev.themeSnowSpeed,
    }));
  };

  const handleThemeChange = async (next: "none" | "winter" | "autumn" | "spring" | "summer") => {
    setThemeEffect(next);
    const persisted = localStore.getSettings();
    const settings = { ...persisted, themeEffect: next, themeSnowSpeed };
    localStore.saveSettings(settings);
    try {
      await saveSettingsTauri(settings);
    } catch (error) {
      console.error("Failed to persist theme settings to Tauri backend:", error);
    }
    window.dispatchEvent(new CustomEvent("settingsUpdated", { detail: settings }));
    setInitialSettings((prev) => ({
      ...prev,
      themeEffect: next,
    }));
  };

  const handleSnowSpeedChange = async (next: number) => {
    setThemeSnowSpeed(next);
    const persisted = localStore.getSettings();
    const settings = { ...persisted, themeSnowSpeed: next };
    localStore.saveSettings(settings);
    try {
      await saveSettingsTauri(settings);
    } catch (error) {
      console.error("Failed to persist theme settings to Tauri backend:", error);
    }
    window.dispatchEvent(new CustomEvent("settingsUpdated", { detail: settings }));
    setInitialSettings((prev) => ({
      ...prev,
      themeSnowSpeed: next,
    }));
  };

  const clampSnow = (value: number) => Math.min(snowMax, Math.max(snowMin, value));

  const snapSnow = (value: number) => {
    const snapped = Math.round((value - snowMin) / snowStep) * snowStep + snowMin;
    return Number(clampSnow(snapped).toFixed(1));
  };

  const updateSnowFromClientX = (clientX: number) => {
    const track = snowTrackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    if (!rect.width) return;
    const ratio = (clientX - rect.left) / rect.width;
    const raw = snowMin + ratio * (snowMax - snowMin);
    const preview = clampSnow(raw);
    setSnowDragValue(preview);
    setThemeSnowSpeed(preview);
    const persisted = localStore.getSettings();
    window.dispatchEvent(
      new CustomEvent("settingsUpdated", {
        detail: { ...persisted, themeSnowSpeed: preview },
      })
    );
  };

  useEffect(() => {
    if (!isDraggingSnow) return;
    const handleMove = (event: PointerEvent) => updateSnowFromClientX(event.clientX);
    const handleUp = () => {
      setIsDraggingSnow(false);
      if (snowDragValue !== null) {
        handleSnowSpeedChange(snapSnow(snowDragValue));
        setSnowDragValue(null);
      }
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [isDraggingSnow, snowDragValue]);

  const handleSnowKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = themeSnowSpeed + (event.key === "ArrowRight" ? snowStep : -snowStep);
    handleSnowSpeedChange(snapSnow(next));
  };

  const handleSelectTelegramFolder = async () => {
    try {
      const selectedPath = await openDirectoryDialog() as string;
      if (selectedPath) {
        setTelegramFolderPath(selectedPath);
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
      <main className="max-w-2xl mx-auto pt-8 lg:pt-12 px-6 pb-20">
        <div className="flex items-center gap-3 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Налаштування</h1>
            <p className="text-muted-foreground">Керування параметрами системи</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-6">
          <button
            type="button"
            onClick={() => setActiveTab("general")}
            className={cn(
              "px-4 h-10 rounded-xl text-sm font-medium transition-colors",
              activeTab === "general"
                ? "bg-white/10 text-white border border-white/10"
                : "text-white/60 hover:text-white hover:bg-white/5 border border-transparent"
            )}
          >
            Налаштування
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("themes")}
            className={cn(
              "px-4 h-10 rounded-xl text-sm font-medium transition-colors",
              activeTab === "themes"
                ? "bg-white/10 text-white border border-white/10"
                : "text-white/60 hover:text-white hover:bg-white/5 border border-transparent"
            )}
          >
            Теми
          </button>
        </div>

        <div className="space-y-6">
          {activeTab === "themes" ? (
            <div className="bg-card/40 backdrop-blur-sm border border-white/5 rounded-3xl p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Ефект</h2>
                  <p className="text-sm text-white/50">Візуальні ефекти фону</p>
                </div>
              </div>
              <div className="rounded-2xl border border-white/5 bg-black/40 px-4 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">Зима</div>
                  </div>
                  <Switch
                    checked={themeEffect === "winter"}
                    onCheckedChange={(checked) => handleThemeChange(checked ? "winter" : "none")}
                  />
                </div>
                {themeEffect === "winter" ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-white/50">{(isDraggingSnow && snowDragValue !== null ? snowDragValue : themeSnowSpeed).toFixed(1)}x</div>
                    </div>
                    <div className="py-2">
                      <div
                        ref={snowTrackRef}
                        role="slider"
                        aria-label="Snow speed"
                        aria-valuemin={snowMin}
                        aria-valuemax={snowMax}
                        aria-valuenow={isDraggingSnow && snowDragValue !== null ? snowDragValue : themeSnowSpeed}
                        tabIndex={0}
                        onKeyDown={handleSnowKeyDown}
                        onPointerDown={(event) => {
                          event.preventDefault();
                          setIsDraggingSnow(true);
                          updateSnowFromClientX(event.clientX);
                        }}
                        className="relative h-2 w-full rounded-full bg-white/10 cursor-pointer"
                      >
                        <div
                          className={`h-full rounded-full ${isDraggingSnow ? "transition-none" : "transition-[width] duration-150 ease-out"}`}
                          style={{
                            width: `${(((isDraggingSnow && snowDragValue !== null ? snowDragValue : themeSnowSpeed) - snowMin) / (snowMax - snowMin)) * 100}%`,
                            background:
                              "linear-gradient(90deg, rgba(255,255,255,0.2), rgba(255,255,255,0.7))",
                          }}
                        />
                        <div
                          className={`absolute top-1/2 -translate-y-1/2 ${isDraggingSnow ? "transition-none" : "transition-[left] duration-150 ease-out"}`}
                          style={{
                            left: `calc(${(((isDraggingSnow && snowDragValue !== null ? snowDragValue : themeSnowSpeed) - snowMin) / (snowMax - snowMin)) * 100}% - 9px)`,
                          }}
                        >
                          <div className="h-5 w-5 rounded-full bg-[#e6f3ff] border border-white/50 shadow-[0_0_10px_rgba(230,243,255,0.45)] transition-transform duration-150 ease-out hover:scale-105" />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="rounded-2xl border border-white/5 bg-black/40 px-4 py-4 space-y-3 opacity-50">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">Весна</div>
                  </div>
                  <Switch checked={false} disabled />
                </div>
              </div>
              <div className="rounded-2xl border border-white/5 bg-black/40 px-4 py-4 space-y-3 opacity-50">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">Літо</div>
                  </div>
                  <Switch checked={false} disabled />
                </div>
              </div>
              <div className="rounded-2xl border border-white/5 bg-black/40 px-4 py-4 space-y-3 opacity-50">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">Осінь</div>
                  </div>
                  <Switch checked={false} disabled />
                </div>
              </div>
            </div>
          ) : (
            <>
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
                      name="settings_telegram_threads"
                      autoComplete="new-password"
                      value={telegramThreads}
                      onChange={(e) => {
                        setTelegramThreads(e.target.value);
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
                        name="settings_telegram_folder"
                        autoComplete="new-password"
                        value={telegramFolderPath}
                        onChange={(e) => {
                          setTelegramFolderPath(e.target.value);
                        }}
                        className="bg-black/40 border-white/5 h-12 rounded-xl pl-4 focus:outline-none flex-1"
                        placeholder="C:\\Users\\Admin\\Documents\\TelegramAccounts"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handleSelectTelegramFolder}
                        className="bg-black/40 border border-white/5 h-12 w-12 rounded-xl focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                      >
                        <FolderOpen className="w-4 h-4 text-white/80" />
                      </Button>
                    </div>
                  </div>
                </div>
                {(telegramThreads !== initialSettings.telegramThreads ||
                  telegramFolderPath !== initialSettings.telegramFolderPath) && (
                  <div className="flex justify-end pt-2">
                    <Button 
                      onClick={() => handleSave("telegram")}
                      className="bg-gradient-to-r from-primary via-primary/90 to-primary/80 text-white px-6 py-2.5 rounded-xl transition-all shadow-[0_10px_25px_-15px_rgba(157,0,255,0.8)] hover:shadow-[0_14px_28px_-16px_rgba(157,0,255,0.95)] hover:scale-[1.01] border border-white/10"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Зберегти
                    </Button>
                  </div>
                )}
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
                      name="settings_chrome_threads"
                      autoComplete="new-password"
                      value={chromeThreads}
                      onChange={(e) => {
                        setChromeThreads(e.target.value);
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
                        name="settings_chrome_folder"
                        autoComplete="new-password"
                        value={chromeFolderPath}
                        onChange={(e) => {
                          setChromeFolderPath(e.target.value);
                        }}
                        className="bg-black/40 border-white/5 h-12 rounded-xl pl-4 focus:outline-none flex-1"
                        placeholder="C:\\Users\\Admin\\Documents\\ChromeAccounts"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handleSelectChromeFolder}
                        className="bg-black/40 border border-white/5 h-12 w-12 rounded-xl focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                      >
                        <FolderOpen className="w-4 h-4 text-white/80" />
                      </Button>
                    </div>
                  </div>
                </div>
                {(chromeThreads !== initialSettings.chromeThreads ||
                  chromeFolderPath !== initialSettings.chromeFolderPath) && (
                  <div className="flex justify-end pt-2">
                    <Button 
                      onClick={() => handleSave("chrome")}
                      className="bg-gradient-to-r from-primary via-primary/90 to-primary/80 text-white px-6 py-2.5 rounded-xl transition-all shadow-[0_10px_25px_-15px_rgba(157,0,255,0.8)] hover:shadow-[0_14px_28px_-16px_rgba(157,0,255,0.95)] hover:scale-[1.01] border border-white/10"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Зберегти
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

