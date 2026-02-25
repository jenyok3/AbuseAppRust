import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Sidebar } from "@/components/Sidebar";
import Telegram from "@/pages/Telegram";
import TestSimple from "./test-simple";
import Accounts from "@/pages/Accounts";
import Settings from "@/pages/Settings";
import Chrome from "@/pages/Chrome";
import Calendar from "@/pages/Calendar";
import NotFound from "@/pages/not-found";
import { GlobalWindowControls } from "@/components/GlobalWindowControls";
import { GlobalKeyboardControls } from "@/components/GlobalKeyboardControls";
import { DailyReminderScheduler } from "@/components/DailyReminderScheduler";
import { AuthOnboardingModal } from "@/components/AuthOnboardingModal";
import { ThemeEffects } from "@/components/ThemeEffects";
import { useEffect, useState } from "react";
import { localStore, type LocalUser } from "@/lib/localStore";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Telegram} />
      <Route path="/test" component={TestSimple} />
      <Route path="/accounts" component={Accounts} />
      <Route path="/projects" component={Telegram} />
      <Route path="/chrome" component={Chrome} />
      <Route path="/calendar" component={Calendar} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [authUser, setAuthUser] = useState<LocalUser | null>(null);
  const [showAuthOnboarding, setShowAuthOnboarding] = useState(false);

  useEffect(() => {
    const user = localStore.getAuthUser();
    setAuthUser(user);
    if (!user && !localStore.getAuthOnboardingSeen()) {
      setShowAuthOnboarding(true);
    }
  }, []);

  const handleTelegramLogin = (username: string) => {
    const normalized = username.trim().replace(/^@+/, "");
    if (!normalized) return;
    const user: LocalUser = {
      id: String(Date.now()),
      name: "Telegram User",
      username: normalized,
      provider: "telegram",
    };
    localStore.saveAuthUser(user);
    localStore.setAuthOnboardingSeen(true);
    setAuthUser(user);
    setShowAuthOnboarding(false);
  };

  const handleSkipAuth = () => {
    localStore.setAuthOnboardingSeen(true);
    setShowAuthOnboarding(false);
  };

  const handleLogout = () => {
    localStore.clearAuthUser();
    setAuthUser(null);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SidebarProvider>
          <div className="relative flex h-screen w-full overflow-hidden bg-black">
            <ThemeEffects />
            <div className="relative z-10 flex h-full w-full">
              <Sidebar user={authUser} onTelegramLogin={handleTelegramLogin} onLogout={handleLogout} />
              <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Black Title Bar */}
                <div className="title-bar app-draggable">
                  <div className="title-bar-content"></div>
                  <GlobalWindowControls />
                </div>
                <Router />
              </div>
            </div>
          </div>
          <GlobalKeyboardControls />
          <DailyReminderScheduler />
        </SidebarProvider>
        <AuthOnboardingModal
          open={showAuthOnboarding}
          onTelegramLogin={handleTelegramLogin}
          onSkip={handleSkipAuth}
        />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
