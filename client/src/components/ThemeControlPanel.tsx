import { localStore } from "@/lib/localStore";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { ThemeEffectPreview } from "@/components/ThemeEffectPreview";

type ThemeEffect = "none" | "sakura" | "rain" | "leaves" | "snow";

type ThemeControlPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const effects: Array<{ value: ThemeEffect; preview: "snow" | "sakura" | "rain" | "leaves" }> = [
  { value: "snow", preview: "snow" },
  { value: "sakura", preview: "sakura" },
  { value: "rain", preview: "rain" },
  { value: "leaves", preview: "leaves" },
];

export function ThemeControlPanel({ open, onOpenChange }: ThemeControlPanelProps) {
  const { language } = useI18n();
  const [activeTab, setActiveTab] = useState<"theme" | "effects">("effects");

  const tr = (uk: string, en: string, ru: string) =>
    language === "en" ? en : language === "ru" ? ru : uk;

  const resolveCurrentEffect = (): ThemeEffect => {
    const raw = localStore.getSettings().themeEffect;
    if (raw === "snow" || raw === "sakura" || raw === "rain" || raw === "leaves") {
      return raw;
    }
    return "none";
  };

  const [currentEffect, setCurrentEffect] = useState<ThemeEffect>(() => resolveCurrentEffect());
  const [lastEnabledEffect, setLastEnabledEffect] = useState<ThemeEffect>(() => {
    const initial = resolveCurrentEffect();
    return initial === "none" ? "snow" : initial;
  });

  useEffect(() => {
    if (!open) return;
    const next = resolveCurrentEffect();
    setCurrentEffect(next);
    if (next !== "none") {
      setLastEnabledEffect(next);
    }
  }, [open]);

  const applyEffect = (next: ThemeEffect) => {
    const prev = localStore.getSettings();
    const payload = {
      ...prev,
      themeEffect: next,
    };
    localStore.saveSettings(payload);
    window.dispatchEvent(new CustomEvent("themeSettingsUpdated", { detail: payload }));
    setCurrentEffect(next);
    if (next !== "none") {
      setLastEnabledEffect(next);
    }
    onOpenChange(false);
  };

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-[90] bg-black/30 backdrop-blur-sm transition-opacity duration-200",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={() => onOpenChange(false)}
      />
      <aside
        className={cn(
          "app-no-drag fixed right-0 top-0 z-[91] h-dvh w-[min(92vw,420px)] border-l border-white/10 bg-black/85 backdrop-blur-xl transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex h-full flex-col p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="inline-flex items-center bg-transparent px-2 py-1">
              <button
                type="button"
                onClick={() => setActiveTab("theme")}
                className={cn(
                  "px-2 py-1 text-xs font-semibold transition-colors",
                  activeTab === "theme" ? "text-white" : "text-white/60 hover:text-white/80"
                )}
              >
                {tr("Тема", "Theme", "Тема")}
              </button>
              <span className="mx-2 h-4 w-px bg-white/20" />
              <button
                type="button"
                onClick={() => setActiveTab("effects")}
                className={cn(
                  "px-2 py-1 text-xs font-semibold transition-colors",
                  activeTab === "effects" ? "text-white" : "text-white/60 hover:text-white/80"
                )}
              >
                {tr("Ефекти", "Effects", "Эффекты")}
              </button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 rounded-lg text-white/70 hover:text-white hover:bg-transparent active:bg-transparent focus-visible:ring-0"
              aria-label={tr("Закрити", "Close", "Закрыть")}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div
            className={cn(
              "overflow-y-auto pr-1",
              activeTab === "theme" ? "flex-1 flex" : "space-y-5"
            )}
          >
            {activeTab === "theme" ? (
              <section className="w-full h-full rounded-2xl bg-transparent p-3 flex items-center justify-center">
                <p className="text-sm text-white/70 text-center">Поки що немає тем</p>
              </section>
            ) : null}

            {activeTab === "effects" ? (
              <section className="rounded-2xl bg-transparent p-0">
                <div className="mb-3 flex items-center justify-between">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      applyEffect(currentEffect === "none" ? (lastEnabledEffect || "snow") : "none")
                    }
                    className="h-7 rounded-md px-2 text-xs text-white/70 hover:text-white hover:bg-white/10"
                  >
                    {currentEffect === "none" ? tr("Увімкнути", "Enable", "Включить") : tr("Вимкнути", "Disable", "Выключить")}
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {effects.map((effect) => {
                    const isActive = currentEffect === effect.value;
                    return (
                      <button
                        key={effect.value}
                        type="button"
                        disabled={currentEffect === "none"}
                        onClick={() => applyEffect(effect.value)}
                        className={cn(
                          "theme-preview-card rounded-xl border p-2 text-left transition-all",
                          currentEffect === "none" && "opacity-45 cursor-not-allowed pointer-events-none",
                          isActive
                            ? "border-primary/60 bg-primary/10 shadow-[inset_0_0_0_1px_rgba(157,0,255,0.45)]"
                            : "border-white/10 bg-black/35 hover:border-white/20 hover:bg-black/50"
                        )}
                      >
                        <div className="theme-preview-surface">
                          <div className="theme-preview-layout">
                            <div className="theme-preview-col-left">
                              <div className="theme-preview-widget theme-preview-main" />
                              <div className="theme-preview-left-bottom-row">
                                <div className="theme-preview-widget theme-preview-bottom-left" />
                                <div className="theme-preview-widget theme-preview-bottom-right" />
                              </div>
                            </div>
                            <div className="theme-preview-col-right">
                              <div className="theme-preview-widget theme-preview-side-top" />
                              <div className="theme-preview-widget theme-preview-side-bottom" />
                            </div>
                          </div>
                          <ThemeEffectPreview effect={effect.preview} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </aside>
    </>
  );
}

