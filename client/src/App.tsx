import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Sidebar } from "@/components/Sidebar";
import Telegram from "@/pages/Telegram";
import TestSimple from "./test-simple";
import Settings from "@/pages/Settings";
import Chrome from "@/pages/Chrome";
import Calendar from "@/pages/Calendar";
import NotFound from "@/pages/not-found";
import { GlobalWindowControls } from "@/components/GlobalWindowControls";
import { GlobalKeyboardControls } from "@/components/GlobalKeyboardControls";
import { DailyReminderScheduler } from "@/components/DailyReminderScheduler";
import { ThemeEffects } from "@/components/ThemeEffects";
import { ThemeControlPanel } from "@/components/ThemeControlPanel";
import { useCallback, useEffect, useMemo, useState } from "react";
import { localStore } from "@/lib/localStore";
import { useI18n } from "@/lib/i18n";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ChevronsLeft, ChevronsRight, Palette, RotateCw } from "lucide-react";

const RELOAD_SPIN_MS = 240;
const RELOAD_DELAY_MS = 280;
const SKIP_POST_RELOAD_SPIN_KEY = "abuseapp_skip_post_reload_spin";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Telegram} />
      <Route path="/test" component={TestSimple} />
      <Route path="/projects" component={Telegram} />
      <Route path="/chrome" component={Chrome} />
      <Route path="/calendar" component={Calendar} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const { language, t } = useI18n();
  const [location] = useLocation();
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [isThemePanelOpen, setIsThemePanelOpen] = useState(false);

  const triggerReloadWithAnimation = useCallback(() => {
    if (isReloading) return;
    setIsReloading(true);
    window.setTimeout(() => {
      sessionStorage.setItem(SKIP_POST_RELOAD_SPIN_KEY, "1");
      window.location.reload();
    }, RELOAD_DELAY_MS);
  }, [isReloading]);

  const pageTitle = useMemo(() => {
    if (location === "/" || location === "/projects") return "Telegram";
    if (location === "/chrome") return "Chrome";
    if (location === "/calendar") return t("sidebar.calendar");
    if (location === "/settings") return t("sidebar.settings");
    return "AbuseApp";
  }, [location, t]);

  useEffect(() => {
    const settings = localStore.getSettings();
    if (settings.languageManuallySet || settings.languageAutoDetected) return;

    const rawLocale = (navigator.languages?.[0] ?? navigator.language ?? "").toLowerCase();
    const detectedLanguage: "uk" | "en" | "ru" = rawLocale.startsWith("uk")
      ? "uk"
      : rawLocale.startsWith("ru")
      ? "ru"
      : "en";

    const nextSettings = {
      ...settings,
      language: detectedLanguage,
      languageAutoDetected: true,
    };
    localStore.saveSettings(nextSettings);
    window.dispatchEvent(new CustomEvent("settingsUpdated", { detail: nextSettings }));
  }, []);

  useEffect(() => {
    document.body.style.backgroundColor = "#000000";
    document.body.style.backgroundImage = "none";
    document.body.style.background = "#000000";
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    let hideTimer: number | null = null;

    const syncScrolledState = () => {
      const scrollers = document.querySelectorAll<HTMLElement>(
        ".telegram-content, [data-scroll-root='true']"
      );
      const documentScrolled =
        window.scrollY > 0 ||
        document.documentElement.scrollTop > 0 ||
        document.body.scrollTop > 0;
      const hasOffset = documentScrolled || Array.from(scrollers).some((el) => el.scrollTop > 0);
      document.documentElement.classList.toggle("is-scrolled", hasOffset);
    };

    const showScrollingState = () => {
      document.documentElement.classList.add("is-scrolling");
      syncScrolledState();
      if (hideTimer !== null) {
        window.clearTimeout(hideTimer);
      }
      hideTimer = window.setTimeout(() => {
        document.documentElement.classList.remove("is-scrolling");
        syncScrolledState();
        hideTimer = null;
      }, 700);
    };

    syncScrolledState();
    window.addEventListener("wheel", showScrollingState, { passive: true });
    window.addEventListener("scroll", showScrollingState, { passive: true, capture: true });
    window.addEventListener("touchmove", showScrollingState, { passive: true });

    return () => {
      window.removeEventListener("wheel", showScrollingState);
      window.removeEventListener("scroll", showScrollingState, true);
      window.removeEventListener("touchmove", showScrollingState);
      if (hideTimer !== null) {
        window.clearTimeout(hideTimer);
      }
      document.documentElement.classList.remove("is-scrolling");
      document.documentElement.classList.remove("is-scrolled");
    };
  }, []);

  useEffect(() => {
    const skipPostReloadSpin = sessionStorage.getItem(SKIP_POST_RELOAD_SPIN_KEY) === "1";
    if (skipPostReloadSpin) {
      sessionStorage.removeItem(SKIP_POST_RELOAD_SPIN_KEY);
      return;
    }

    const navigationEntry = performance
      .getEntriesByType("navigation")
      .find((entry) => entry instanceof PerformanceNavigationTiming) as PerformanceNavigationTiming | undefined;
    if (navigationEntry?.type !== "reload") return;
    setIsReloading(true);
    const timer = window.setTimeout(() => {
      setIsReloading(false);
    }, RELOAD_SPIN_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleReloadHotkey = (event: KeyboardEvent) => {
      const isF5 = event.key === "F5";
      const isCmdOrCtrlReload =
        (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "r";

      if (!isF5 && !isCmdOrCtrlReload) return;

      event.preventDefault();
      triggerReloadWithAnimation();
    };

    window.addEventListener("keydown", handleReloadHotkey);
    return () => window.removeEventListener("keydown", handleReloadHotkey);
  }, [triggerReloadWithAnimation]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SidebarProvider>
          <div className="relative flex h-dvh min-h-0 w-full overflow-hidden">
            <ThemeEffects />
            <div className="relative z-10 flex h-full w-full flex-col">
              <div className="title-bar app-draggable">
                <div className="title-bar-layout">
                  <div className="title-bar-left title-bar-capsule app-no-drag">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-full bg-transparent text-white/80 hover:text-white hover:bg-transparent active:bg-transparent focus-visible:ring-0"
                      onClick={() => setIsSidebarExpanded((prev) => !prev)}
                      aria-label={isSidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
                    >
                      {isSidebarExpanded ? <ChevronsLeft className="h-4 w-4" /> : <ChevronsRight className="h-4 w-4" />}
                    </Button>
                  </div>
                  <div className="title-bar-center title-bar-capsule app-no-drag">
                    <span className="title-bar-page-title truncate text-sm font-semibold tracking-wide text-white/90">{pageTitle}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="title-bar-reload h-7 w-7 shrink-0 rounded-full p-0 text-white/80 hover:text-white hover:bg-transparent active:bg-transparent focus-visible:ring-0 app-no-drag [&_svg]:!size-3.5"
                      onClick={triggerReloadWithAnimation}
                      aria-label="Reload page"
                      disabled={isReloading}
                    >
                      <RotateCw className={isReloading ? "reload-spin-once" : ""} />
                    </Button>
                  </div>
                  <div className="title-bar-right-group">
                    <div className="title-bar-capsule title-bar-controls app-no-drag">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-full p-0 text-white/80 hover:text-white hover:bg-transparent active:bg-transparent focus-visible:ring-0"
                        onClick={() => setIsThemePanelOpen(true)}
                        aria-label="Theme panel"
                      >
                        <Palette className="h-4 w-4" />
                      </Button>
                      <GlobalWindowControls className="static inset-auto right-auto z-auto h-full gap-0.5 pr-0" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex min-h-0 flex-1">
                <Sidebar isExpanded={isSidebarExpanded} onExpandedChange={setIsSidebarExpanded} />
                <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                  <Router />
                </div>
              </div>
            </div>
            <ThemeControlPanel open={isThemePanelOpen} onOpenChange={setIsThemePanelOpen} />
          </div>
          <GlobalKeyboardControls />
          <DailyReminderScheduler />
        </SidebarProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
