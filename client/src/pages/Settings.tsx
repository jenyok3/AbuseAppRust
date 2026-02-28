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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { type AppLanguage, useI18n } from "@/lib/i18n";

const normalizeThemeEffect = (value?: string) => {
  switch (value) {
    case "winter":
      return "snow";
    case "spring":
      return "sakura";
    case "summer":
      return "rain";
    case "autumn":
      return "leaves";
    case "sakura":
    case "rain":
    case "leaves":
    case "snow":
      return value;
    default:
      return "none";
  }
};

export default function Settings() {
  const { toast } = useToast();
  const { t } = useI18n();
  const [telegramThreads, setTelegramThreads] = useState<string>("");
  const [telegramFolderPath, setTelegramFolderPath] = useState<string>("");
  const [chromeThreads, setChromeThreads] = useState<string>("");
  const [chromeFolderPath, setChromeFolderPath] = useState<string>("");
  const [language, setLanguage] = useState<AppLanguage>("uk");
  const [themeEffect, setThemeEffect] = useState<"none" | "sakura" | "rain" | "leaves" | "snow">("none");
  const [themeSnowSpeed, setThemeSnowSpeed] = useState<number>(1);
  const [themeSakuraIntensity, setThemeSakuraIntensity] = useState<number>(1);
  const [themeRainIntensity, setThemeRainIntensity] = useState<number>(1);
  const [themeLeavesIntensity, setThemeLeavesIntensity] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<"general" | "themes">("general");
  const [initialSettings, setInitialSettings] = useState({
    telegramThreads: "",
    telegramFolderPath: "",
    chromeThreads: "",
    chromeFolderPath: "",
    language: "uk" as AppLanguage,
    themeEffect: "none" as "none" | "sakura" | "rain" | "leaves" | "snow",
    themeSnowSpeed: 1,
    themeSakuraIntensity: 1,
    themeRainIntensity: 1,
    themeLeavesIntensity: 1,
  });
  const snowTrackRef = useRef<HTMLDivElement | null>(null);
  const [isDraggingSnow, setIsDraggingSnow] = useState(false);
  const [snowDragValue, setSnowDragValue] = useState<number | null>(null);
  const sakuraTrackRef = useRef<HTMLDivElement | null>(null);
  const [isDraggingSakura, setIsDraggingSakura] = useState(false);
  const [sakuraDragValue, setSakuraDragValue] = useState<number | null>(null);
  const rainTrackRef = useRef<HTMLDivElement | null>(null);
  const [isDraggingRain, setIsDraggingRain] = useState(false);
  const [rainDragValue, setRainDragValue] = useState<number | null>(null);
  const leavesTrackRef = useRef<HTMLDivElement | null>(null);
  const [isDraggingLeaves, setIsDraggingLeaves] = useState(false);
  const [leavesDragValue, setLeavesDragValue] = useState<number | null>(null);
  const snowMin = 0.5;
  const snowMax = 2;
  const snowStep = 0.1;
  const intensityMin = 0.5;
  const intensityMax = 2;
  const intensityStep = 0.1;
  const normalizeWindowsPath = (value: string) => {
    if (!value) return "";
    const hasUncPrefix = value.startsWith("\\\\");
    const normalized = value.replace(/\\{2,}/g, "\\");
    return hasUncPrefix ? `\\${normalized}` : normalized;
  };

  useEffect(() => {
    const settings = localStore.getSettings();
    const normalizedThemeEffect = normalizeThemeEffect(settings.themeEffect);
    setTelegramThreads(settings.telegramThreads || "");
    setTelegramFolderPath(normalizeWindowsPath(settings.telegramFolderPath || ""));
    setChromeThreads(settings.chromeThreads || "");
    setChromeFolderPath(normalizeWindowsPath(settings.chromeFolderPath || ""));
    setLanguage(settings.language === "en" || settings.language === "ru" ? settings.language : "uk");
    setThemeEffect(normalizedThemeEffect);
    setThemeSnowSpeed(typeof settings.themeSnowSpeed === "number" ? settings.themeSnowSpeed : 1);
    setThemeSakuraIntensity(typeof settings.themeSakuraIntensity === "number" ? settings.themeSakuraIntensity : 1);
    setThemeRainIntensity(typeof settings.themeRainIntensity === "number" ? settings.themeRainIntensity : 1);
    setThemeLeavesIntensity(typeof settings.themeLeavesIntensity === "number" ? settings.themeLeavesIntensity : 1);
    setInitialSettings({
      telegramThreads: settings.telegramThreads || "",
      telegramFolderPath: normalizeWindowsPath(settings.telegramFolderPath || ""),
      chromeThreads: settings.chromeThreads || "",
      chromeFolderPath: normalizeWindowsPath(settings.chromeFolderPath || ""),
      language: settings.language === "en" || settings.language === "ru" ? settings.language : "uk",
      themeEffect: normalizedThemeEffect,
      themeSnowSpeed: typeof settings.themeSnowSpeed === "number" ? settings.themeSnowSpeed : 1,
      themeSakuraIntensity: typeof settings.themeSakuraIntensity === "number" ? settings.themeSakuraIntensity : 1,
      themeRainIntensity: typeof settings.themeRainIntensity === "number" ? settings.themeRainIntensity : 1,
      themeLeavesIntensity: typeof settings.themeLeavesIntensity === "number" ? settings.themeLeavesIntensity : 1,
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
    const normalizedTelegramFolderPath = normalizeWindowsPath(telegramFolderPath);
    const normalizedChromeFolderPath = normalizeWindowsPath(chromeFolderPath);
    const settings =
      section === "telegram"
        ? {
            ...persisted,
            telegramThreads,
            telegramFolderPath: normalizedTelegramFolderPath,
          }
        : {
            ...persisted,
            chromeThreads,
            chromeFolderPath: normalizedChromeFolderPath,
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
      title: t("settings.saved.title"),
      description: t("settings.saved.description"),
    });
    setInitialSettings((prev) => ({
      telegramThreads: section === "telegram" ? telegramThreads : prev.telegramThreads,
      telegramFolderPath: section === "telegram" ? telegramFolderPath : prev.telegramFolderPath,
      chromeThreads: section === "chrome" ? chromeThreads : prev.chromeThreads,
      chromeFolderPath: section === "chrome" ? chromeFolderPath : prev.chromeFolderPath,
      language: prev.language,
      themeEffect: prev.themeEffect,
      themeSnowSpeed: prev.themeSnowSpeed,
      themeSakuraIntensity: prev.themeSakuraIntensity,
      themeRainIntensity: prev.themeRainIntensity,
      themeLeavesIntensity: prev.themeLeavesIntensity,
    }));
  };

  const handleThemeChange = async (next: "none" | "sakura" | "rain" | "leaves" | "snow") => {
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

  const handleLanguageChange = async (next: AppLanguage) => {
    setLanguage(next);
    const persisted = localStore.getSettings();
    const settings = { ...persisted, language: next };
    localStore.saveSettings(settings);
    try {
      await saveSettingsTauri(settings);
    } catch (error) {
      console.error("Failed to persist language settings to Tauri backend:", error);
    }
    window.dispatchEvent(new CustomEvent("settingsUpdated", { detail: settings }));
    setInitialSettings((prev) => ({
      ...prev,
      language: next,
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

  const handleSakuraIntensityChange = async (next: number) => {
    setThemeSakuraIntensity(next);
    const persisted = localStore.getSettings();
    const settings = { ...persisted, themeSakuraIntensity: next };
    localStore.saveSettings(settings);
    try {
      await saveSettingsTauri(settings);
    } catch (error) {
      console.error("Failed to persist theme settings to Tauri backend:", error);
    }
    window.dispatchEvent(new CustomEvent("settingsUpdated", { detail: settings }));
    setInitialSettings((prev) => ({
      ...prev,
      themeSakuraIntensity: next,
    }));
  };

  const handleRainIntensityChange = async (next: number) => {
    setThemeRainIntensity(next);
    const persisted = localStore.getSettings();
    const settings = { ...persisted, themeRainIntensity: next };
    localStore.saveSettings(settings);
    try {
      await saveSettingsTauri(settings);
    } catch (error) {
      console.error("Failed to persist theme settings to Tauri backend:", error);
    }
    window.dispatchEvent(new CustomEvent("settingsUpdated", { detail: settings }));
    setInitialSettings((prev) => ({
      ...prev,
      themeRainIntensity: next,
    }));
  };

  const handleLeavesIntensityChange = async (next: number) => {
    setThemeLeavesIntensity(next);
    const persisted = localStore.getSettings();
    const settings = { ...persisted, themeLeavesIntensity: next };
    localStore.saveSettings(settings);
    try {
      await saveSettingsTauri(settings);
    } catch (error) {
      console.error("Failed to persist theme settings to Tauri backend:", error);
    }
    window.dispatchEvent(new CustomEvent("settingsUpdated", { detail: settings }));
    setInitialSettings((prev) => ({
      ...prev,
      themeLeavesIntensity: next,
    }));
  };


  const clampSnow = (value: number) => Math.min(snowMax, Math.max(snowMin, value));

  const snapSnow = (value: number) => {
    const snapped = Math.round((value - snowMin) / snowStep) * snowStep + snowMin;
    return Number(clampSnow(snapped).toFixed(1));
  };

  const clampIntensity = (value: number) => Math.min(intensityMax, Math.max(intensityMin, value));

  const snapIntensity = (value: number) => {
    const snapped = Math.round((value - intensityMin) / intensityStep) * intensityStep + intensityMin;
    return Number(clampIntensity(snapped).toFixed(1));
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

  const updateSakuraFromClientX = (clientX: number) => {
    const track = sakuraTrackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    if (!rect.width) return;
    const ratio = (clientX - rect.left) / rect.width;
    const raw = intensityMin + ratio * (intensityMax - intensityMin);
    const preview = clampIntensity(raw);
    setSakuraDragValue(preview);
    setThemeSakuraIntensity(preview);
    const persisted = localStore.getSettings();
    window.dispatchEvent(
      new CustomEvent("settingsUpdated", {
        detail: { ...persisted, themeSakuraIntensity: preview },
      })
    );
  };

  const updateRainFromClientX = (clientX: number) => {
    const track = rainTrackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    if (!rect.width) return;
    const ratio = (clientX - rect.left) / rect.width;
    const raw = intensityMin + ratio * (intensityMax - intensityMin);
    const preview = clampIntensity(raw);
    setRainDragValue(preview);
    setThemeRainIntensity(preview);
    const persisted = localStore.getSettings();
    window.dispatchEvent(
      new CustomEvent("settingsUpdated", {
        detail: { ...persisted, themeRainIntensity: preview },
      })
    );
  };

  const updateLeavesFromClientX = (clientX: number) => {
    const track = leavesTrackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    if (!rect.width) return;
    const ratio = (clientX - rect.left) / rect.width;
    const raw = intensityMin + ratio * (intensityMax - intensityMin);
    const preview = clampIntensity(raw);
    setLeavesDragValue(preview);
    setThemeLeavesIntensity(preview);
    const persisted = localStore.getSettings();
    window.dispatchEvent(
      new CustomEvent("settingsUpdated", {
        detail: { ...persisted, themeLeavesIntensity: preview },
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

  useEffect(() => {
    if (!isDraggingSakura) return;
    const handleMove = (event: PointerEvent) => updateSakuraFromClientX(event.clientX);
    const handleUp = () => {
      setIsDraggingSakura(false);
      if (sakuraDragValue !== null) {
        handleSakuraIntensityChange(snapIntensity(sakuraDragValue));
        setSakuraDragValue(null);
      }
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [isDraggingSakura, sakuraDragValue]);

  useEffect(() => {
    if (!isDraggingRain) return;
    const handleMove = (event: PointerEvent) => updateRainFromClientX(event.clientX);
    const handleUp = () => {
      setIsDraggingRain(false);
      if (rainDragValue !== null) {
        handleRainIntensityChange(snapIntensity(rainDragValue));
        setRainDragValue(null);
      }
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [isDraggingRain, rainDragValue]);

  useEffect(() => {
    if (!isDraggingLeaves) return;
    const handleMove = (event: PointerEvent) => updateLeavesFromClientX(event.clientX);
    const handleUp = () => {
      setIsDraggingLeaves(false);
      if (leavesDragValue !== null) {
        handleLeavesIntensityChange(snapIntensity(leavesDragValue));
        setLeavesDragValue(null);
      }
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [isDraggingLeaves, leavesDragValue]);

  const handleSnowKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = themeSnowSpeed + (event.key === "ArrowRight" ? snowStep : -snowStep);
    handleSnowSpeedChange(snapSnow(next));
  };

  const handleSakuraKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = themeSakuraIntensity + (event.key === "ArrowRight" ? intensityStep : -intensityStep);
    handleSakuraIntensityChange(snapIntensity(next));
  };

  const handleRainKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = themeRainIntensity + (event.key === "ArrowRight" ? intensityStep : -intensityStep);
    handleRainIntensityChange(snapIntensity(next));
  };

  const handleLeavesKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = themeLeavesIntensity + (event.key === "ArrowRight" ? intensityStep : -intensityStep);
    handleLeavesIntensityChange(snapIntensity(next));
  };

  const handleSelectTelegramFolder = async () => {
    try {
      const selectedPath = await openDirectoryDialog() as string;
      if (selectedPath) {
        const normalizedPath = normalizeWindowsPath(selectedPath);
        setTelegramFolderPath(normalizedPath);
        toast({
          title: t("settings.folder.selected.title"),
          description: t("settings.folder.selected.description", { path: normalizedPath }),
        });
      }
    } catch (error) {
      toast({
        title: t("settings.folder.error.title"),
        description: t("settings.folder.error.description"),
        variant: "destructive",
      });
    }
  };

  const handleSelectChromeFolder = async () => {
    try {
      const selectedPath = await openDirectoryDialog() as string;
      if (selectedPath) {
        const normalizedPath = normalizeWindowsPath(selectedPath);
        setChromeFolderPath(normalizedPath);
        toast({
          title: t("settings.folder.selected.title"),
          description: t("settings.folder.selected.description", { path: normalizedPath }),
        });
      }
    } catch (error) {
      toast({
        title: t("settings.folder.error.title"),
        description: t("settings.folder.error.description"),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="h-full min-h-0 bg-transparent text-white overflow-y-auto">
      <main className="max-w-2xl mx-auto pt-6 lg:pt-10 px-4 sm:px-6 pb-16 sm:pb-20">
        <div className="flex items-center gap-3 mb-8">
	          <div>
	            <h1 className="text-3xl font-bold tracking-tight">{t("settings.title")}</h1>
	          </div>
	        </div>

        <div className="flex flex-wrap items-center gap-2 mb-6">
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
            {t("settings.tab.general")}
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
            {t("settings.tab.themes")}
          </button>
        </div>

        <div className="space-y-6">
          {activeTab === "themes" ? (
            <div className="bg-card/40 backdrop-blur-sm border border-white/5 rounded-3xl p-5 sm:p-8 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">{t("settings.theme.title")}</h2>
                  <p className="text-sm text-white/50">{t("settings.theme.description")}</p>
                </div>
              </div>
              <div className="rounded-2xl border border-white/5 bg-black/40 px-4 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">{t("settings.theme.snow")}</div>
                  </div>
                  <Switch
                    checked={themeEffect === "snow"}
                    onCheckedChange={(checked) => handleThemeChange(checked ? "snow" : "none")}
                  />
                </div>
                {themeEffect === "snow" ? (
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
              <div className="rounded-2xl border border-white/5 bg-black/40 px-4 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">{t("settings.theme.sakura")}</div>
                  </div>
                  <Switch
                    checked={themeEffect === "sakura"}
                    onCheckedChange={(checked) => handleThemeChange(checked ? "sakura" : "none")}
                  />
                </div>
                {themeEffect === "sakura" ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-white/50">
                        {(isDraggingSakura && sakuraDragValue !== null ? sakuraDragValue : themeSakuraIntensity).toFixed(1)}x
                      </div>
                    </div>
                    <div className="py-2">
                      <div
                        ref={sakuraTrackRef}
                        role="slider"
                        aria-label="Sakura intensity"
                        aria-valuemin={intensityMin}
                        aria-valuemax={intensityMax}
                        aria-valuenow={isDraggingSakura && sakuraDragValue !== null ? sakuraDragValue : themeSakuraIntensity}
                        tabIndex={0}
                        onKeyDown={handleSakuraKeyDown}
                        onPointerDown={(event) => {
                          event.preventDefault();
                          setIsDraggingSakura(true);
                          updateSakuraFromClientX(event.clientX);
                        }}
                        className="relative h-2 w-full rounded-full bg-white/10 cursor-pointer"
                      >
                        <div
                          className={`h-full rounded-full ${isDraggingSakura ? "transition-none" : "transition-[width] duration-150 ease-out"}`}
                          style={{
                            width: `${(((isDraggingSakura && sakuraDragValue !== null ? sakuraDragValue : themeSakuraIntensity) - intensityMin) / (intensityMax - intensityMin)) * 100}%`,
                            background:
                              "linear-gradient(90deg, rgba(255,192,203,0.35), rgba(255,182,193,0.9))",
                          }}
                        />
                        <div
                          className={`absolute top-1/2 -translate-y-1/2 ${isDraggingSakura ? "transition-none" : "transition-[left] duration-150 ease-out"}`}
                          style={{
                            left: `calc(${(((isDraggingSakura && sakuraDragValue !== null ? sakuraDragValue : themeSakuraIntensity) - intensityMin) / (intensityMax - intensityMin)) * 100}% - 9px)`,
                          }}
                        >
                          <div className="h-5 w-5 rounded-full bg-[#ffd1dc] border border-white/50 shadow-[0_0_10px_rgba(255,209,220,0.45)] transition-transform duration-150 ease-out hover:scale-105" />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="rounded-2xl border border-white/5 bg-black/40 px-4 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">{t("settings.theme.rain")}</div>
                  </div>
                  <Switch
                    checked={themeEffect === "rain"}
                    onCheckedChange={(checked) => handleThemeChange(checked ? "rain" : "none")}
                  />
                </div>
                {themeEffect === "rain" ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-white/50">
                        {(isDraggingRain && rainDragValue !== null ? rainDragValue : themeRainIntensity).toFixed(1)}x
                      </div>
                    </div>
                    <div className="py-2">
                      <div
                        ref={rainTrackRef}
                        role="slider"
                        aria-label="Rain intensity"
                        aria-valuemin={intensityMin}
                        aria-valuemax={intensityMax}
                        aria-valuenow={isDraggingRain && rainDragValue !== null ? rainDragValue : themeRainIntensity}
                        tabIndex={0}
                        onKeyDown={handleRainKeyDown}
                        onPointerDown={(event) => {
                          event.preventDefault();
                          setIsDraggingRain(true);
                          updateRainFromClientX(event.clientX);
                        }}
                        className="relative h-2 w-full rounded-full bg-white/10 cursor-pointer"
                      >
                        <div
                          className={`h-full rounded-full ${isDraggingRain ? "transition-none" : "transition-[width] duration-150 ease-out"}`}
                          style={{
                            width: `${(((isDraggingRain && rainDragValue !== null ? rainDragValue : themeRainIntensity) - intensityMin) / (intensityMax - intensityMin)) * 100}%`,
                            background:
                              "linear-gradient(90deg, rgba(147,197,253,0.25), rgba(125,211,252,0.9))",
                          }}
                        />
                        <div
                          className={`absolute top-1/2 -translate-y-1/2 ${isDraggingRain ? "transition-none" : "transition-[left] duration-150 ease-out"}`}
                          style={{
                            left: `calc(${(((isDraggingRain && rainDragValue !== null ? rainDragValue : themeRainIntensity) - intensityMin) / (intensityMax - intensityMin)) * 100}% - 9px)`,
                          }}
                        >
                          <div className="h-5 w-5 rounded-full bg-[#bfe3ff] border border-white/50 shadow-[0_0_10px_rgba(191,227,255,0.45)] transition-transform duration-150 ease-out hover:scale-105" />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="rounded-2xl border border-white/5 bg-black/40 px-4 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">{t("settings.theme.leaves")}</div>
                  </div>
                  <Switch
                    checked={themeEffect === "leaves"}
                    onCheckedChange={(checked) => handleThemeChange(checked ? "leaves" : "none")}
                  />
                </div>
                {themeEffect === "leaves" ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-white/50">
                        {(isDraggingLeaves && leavesDragValue !== null ? leavesDragValue : themeLeavesIntensity).toFixed(1)}x
                      </div>
                    </div>
                    <div className="py-2">
                      <div
                        ref={leavesTrackRef}
                        role="slider"
                        aria-label="Leaves intensity"
                        aria-valuemin={intensityMin}
                        aria-valuemax={intensityMax}
                        aria-valuenow={isDraggingLeaves && leavesDragValue !== null ? leavesDragValue : themeLeavesIntensity}
                        tabIndex={0}
                        onKeyDown={handleLeavesKeyDown}
                        onPointerDown={(event) => {
                          event.preventDefault();
                          setIsDraggingLeaves(true);
                          updateLeavesFromClientX(event.clientX);
                        }}
                        className="relative h-2 w-full rounded-full bg-white/10 cursor-pointer"
                      >
                        <div
                          className={`h-full rounded-full ${isDraggingLeaves ? "transition-none" : "transition-[width] duration-150 ease-out"}`}
                          style={{
                            width: `${(((isDraggingLeaves && leavesDragValue !== null ? leavesDragValue : themeLeavesIntensity) - intensityMin) / (intensityMax - intensityMin)) * 100}%`,
                            background:
                              "linear-gradient(90deg, rgba(251,146,60,0.3), rgba(245,158,11,0.95))",
                          }}
                        />
                        <div
                          className={`absolute top-1/2 -translate-y-1/2 ${isDraggingLeaves ? "transition-none" : "transition-[left] duration-150 ease-out"}`}
                          style={{
                            left: `calc(${(((isDraggingLeaves && leavesDragValue !== null ? leavesDragValue : themeLeavesIntensity) - intensityMin) / (intensityMax - intensityMin)) * 100}% - 9px)`,
                          }}
                        >
                          <div className="h-5 w-5 rounded-full bg-[#fbbf24] border border-white/50 shadow-[0_0_10px_rgba(251,191,36,0.45)] transition-transform duration-150 ease-out hover:scale-105" />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <>
              {/* Telegram Settings */}
              <div className="bg-card/40 backdrop-blur-sm border border-white/5 rounded-3xl p-5 sm:p-8 space-y-6">
                <h2 className="text-xl font-semibold">
                  Telegram
                </h2>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="telegramThreads" className="text-sm font-medium text-zinc-400">
                      {t("settings.telegram.threads.label")}
                    </Label>
                    <Input
                      id="telegramThreads"
                      type="number"
                      autoComplete="off"
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
                      {t("settings.telegram.folder.label")}
                    </Label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input
                        id="telegramFolderPath"
                        autoComplete="off"
                        value={telegramFolderPath}
                        onChange={(e) => {
                          setTelegramFolderPath(normalizeWindowsPath(e.target.value));
                        }}
                        className="bg-black/40 border-white/5 h-12 rounded-xl pl-4 focus:outline-none flex-1"
                        placeholder={String.raw`C:\Users\Admin\Documents\TelegramAccounts`}
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
                      {t("common.save")}
                    </Button>
                  </div>
                )}
              </div>

              {/* Chrome Settings */}
              <div className="bg-card/40 backdrop-blur-sm border border-white/5 rounded-3xl p-5 sm:p-8 space-y-6">
                <h2 className="text-xl font-semibold">
                  Chrome
                </h2>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="chromeThreads" className="text-sm font-medium text-zinc-400">
                      {t("settings.chrome.threads.label")}
                    </Label>
                    <Input
                      id="chromeThreads"
                      type="number"
                      autoComplete="off"
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
                      {t("settings.chrome.folder.label")}
                    </Label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input
                        id="chromeFolderPath"
                        autoComplete="off"
                        value={chromeFolderPath}
                        onChange={(e) => {
                          setChromeFolderPath(normalizeWindowsPath(e.target.value));
                        }}
                        className="bg-black/40 border-white/5 h-12 rounded-xl pl-4 focus:outline-none flex-1"
                        placeholder={String.raw`C:\Users\Admin\Documents\ChromeAccounts`}
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
                      {t("common.save")}
                    </Button>
                  </div>
                )}
              </div>

              <div className="bg-card/40 backdrop-blur-sm border border-white/5 rounded-3xl p-5 sm:p-8 space-y-6">
                <h2 className="text-xl font-semibold">{t("settings.language.title")}</h2>
                <div className="space-y-2">
                  <Select value={language} onValueChange={(value) => handleLanguageChange(value as AppLanguage)}>
                    <SelectTrigger
                      id="appLanguage"
                      className="w-full bg-black/40 border-white/5 h-12 rounded-xl text-white focus:ring-0 focus:ring-offset-0 focus:border-white/20"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-black border-white/10 text-white">
                      <SelectItem value="uk" className="focus:bg-white/10 focus:text-white">
                        {t("settings.language.uk")}
                      </SelectItem>
                      <SelectItem value="en" className="focus:bg-white/10 focus:text-white">
                        {t("settings.language.en")}
                      </SelectItem>
                      <SelectItem value="ru" className="focus:bg-white/10 focus:text-white">
                        {t("settings.language.ru")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

