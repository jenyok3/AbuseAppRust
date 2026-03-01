import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  Settings,
  Send,
  Chrome,
  LogOut,
  Calendar,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { LocalUser } from "@/lib/localStore";
import { useI18n } from "@/lib/i18n";

type SidebarProps = {
  user: LocalUser | null;
  onTelegramLogin: (username: string) => void;
  onLogout: () => void;
};

export function Sidebar({ user, onTelegramLogin, onLogout }: SidebarProps) {
  const { t } = useI18n();
  const [location, setLocation] = useLocation();
  const [isHovered, setIsHovered] = useState(false);
  const [isAppFocused, setIsAppFocused] = useState(true);
  const closeTimerRef = useRef<number | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNarrowViewport, setIsNarrowViewport] = useState(false);
  const [pendingUsername, setPendingUsername] = useState("");
  const normalizedUsername = pendingUsername.trim().replace(/^@+/, "");
  const isValidUsername =
    normalizedUsername.length >= 5 &&
    normalizedUsername.length <= 32 &&
    /^[a-zA-Z0-9_]+$/.test(normalizedUsername);
  const canSubmitUsername = isValidUsername;

  const navItems = [
    { icon: Calendar, label: t("sidebar.calendar"), href: "/calendar" },
    { icon: Settings, label: t("sidebar.settings"), href: "/settings" },
  ];

  const getCurrentType = (): "telegram" | "chrome" => {
    if (location === "/chrome") return "chrome";
    return "telegram";
  };

  const shouldHighlightFarmType = location === "/" || location === "/chrome";

  const [type, setType] = useState<"telegram" | "chrome">(getCurrentType());

  useEffect(() => {
    setType(getCurrentType());
  }, [location]);

  useEffect(() => {
    const handleFocus = () => setIsAppFocused(true);
    const handleBlur = () => {
      setIsAppFocused(false);
      setIsHovered(false);
    };
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1024px)");
    const sync = () => setIsNarrowViewport(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const handleTelegramClick = () => {
    setType("telegram");
    setLocation("/");
  };

  const handleChromeClick = () => {
    setType("chrome");
    setLocation("/chrome");
  };

  const isExpanded = isHovered && !isNarrowViewport;

  return (
    <div className="relative h-dvh shrink-0">
      <div className="h-dvh w-16 shrink-0" />
      <div
        className={cn(
          "fixed left-0 top-0 z-50 h-dvh bg-black border-r border-white/5 flex flex-col overflow-hidden transition-[width] duration-300 ease-smooth-sidebar",
          isExpanded ? "w-64" : "w-16"
        )}
        onMouseEnter={() => {
          if (!isAppFocused || !document.hasFocus()) return;
          if (closeTimerRef.current) {
            window.clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
          }
          setIsHovered(true);
        }}
        onMouseLeave={() => {
          if (closeTimerRef.current) {
            window.clearTimeout(closeTimerRef.current);
          }
          closeTimerRef.current = window.setTimeout(() => {
            setIsHovered(false);
            closeTimerRef.current = null;
          }, 200);
        }}
      >
        <div
          className={cn(
            "h-20 flex items-center border-b border-white/5",
            isExpanded ? "px-4 justify-start" : "px-0 justify-center"
          )}
        >
          <div
            className={cn(
              "rounded-xl overflow-hidden",
              isExpanded ? "w-14 h-14" : "w-12 h-12"
            )}
          >
            <img
              src="/logo.png"
              alt="AbuseApp Logo"
              className={cn(
                "w-full h-full object-contain",
                isExpanded ? "translate-x-0" : "-translate-x-[1px]"
              )}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = "none";
                target.nextElementSibling?.classList.remove("hidden");
              }}
            />
            <div className="w-full h-full bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center hidden">
              <span className={cn("text-white font-bold", isExpanded ? "text-lg" : "text-sm")}>A</span>
            </div>
          </div>
          {isExpanded ? (
            <span className="ml-3 font-display font-bold text-lg tracking-wide whitespace-nowrap">
              Abuse<span className="text-primary">App</span>
            </span>
          ) : null}
        </div>

        <div className={cn("space-y-2", isExpanded ? "p-4" : "px-2 py-2")}>
          <Button
            variant="ghost"
            onClick={handleTelegramClick}
            className={cn(
              "w-full h-12 rounded-xl transition-[color,background-color,border-color] duration-300 relative overflow-hidden",
              isExpanded ? "justify-start gap-3 px-3" : "justify-center px-0",
              shouldHighlightFarmType && type === "telegram"
                ? "bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
                : "text-muted-foreground hover:bg-white/5 hover:text-white"
            )}
          >
            <div className="flex items-center justify-center w-5 h-5">
              <Send className="w-5 h-5" />
            </div>
            {isExpanded ? <span className="font-medium whitespace-nowrap">Telegram</span> : null}
            {shouldHighlightFarmType && type === "telegram" ? (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full" />
            ) : null}
          </Button>

          <Button
            variant="ghost"
            onClick={handleChromeClick}
            className={cn(
              "w-full h-12 rounded-xl transition-[color,background-color,border-color] duration-300 relative overflow-hidden",
              isExpanded ? "justify-start gap-3 px-3" : "justify-center px-0",
              shouldHighlightFarmType && type === "chrome"
                ? "bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
                : "text-muted-foreground hover:bg-white/5 hover:text-white"
            )}
          >
            <div className="flex items-center justify-center w-5 h-5">
              <Chrome className="w-5 h-5" />
            </div>
            {isExpanded ? <span className="font-medium whitespace-nowrap">Chrome</span> : null}
            {shouldHighlightFarmType && type === "chrome" ? (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full" />
            ) : null}
          </Button>
        </div>

        <div className={cn("mx-2 bg-white/5", isExpanded ? "mx-4" : "mx-2")}>
          <div className="h-px" />
        </div>

        <nav className={cn("flex-1 space-y-2", isExpanded ? "p-4" : "px-2 py-2")}>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center rounded-xl transition-[color,background-color] duration-300 group relative overflow-hidden",
                isExpanded ? "justify-start gap-3 px-3 py-3" : "justify-center px-0 py-3",
                location === item.href
                  ? "text-white bg-white/5 shadow-inner"
                  : "text-muted-foreground hover:text-white hover:bg-white/5"
              )}
            >
              <div className="flex items-center justify-center w-5 h-5">
                <item.icon className={cn("w-5 h-5", location === item.href && "text-primary")} />
              </div>
              {isExpanded ? (
                <span className="font-medium whitespace-nowrap">{item.label}</span>
              ) : null}
              {location === item.href ? (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full" />
              ) : null}
            </Link>
          ))}
        </nav>

        <div className={cn("border-t border-white/5", isExpanded ? "p-4" : "p-2")}>
          <button
            className={cn(
              "flex items-center w-full rounded-xl hover:bg-white/5 transition-[color,background-color] duration-300 group",
              isExpanded ? "p-2 justify-start gap-3" : "p-2 justify-center"
            )}
            onClick={() => setIsProfileOpen(true)}
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-tr from-zinc-700 to-zinc-600 border border-white/10">
              <UserRound className="w-4 h-4 text-white/70" />
            </div>
            {isExpanded ? (
              <div className="flex flex-col items-start">
                <span className="text-sm font-medium text-white truncate w-full">
                  {user?.name || t("sidebar.guest")}
                </span>
                <span className="text-xs text-muted-foreground">
                  {user?.username ? `@${user.username}` : t("sidebar.notLoggedIn")}
                </span>
              </div>
            ) : null}
            {isExpanded ? (
              <div className="flex items-center justify-center w-4 h-4 ml-auto">
                <LogOut className="w-4 h-4 text-muted-foreground group-hover:text-red-400" />
              </div>
            ) : null}
          </button>
        </div>
      </div>
      <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <DialogContent className="bg-black/50 border-white/10 text-white max-w-md rounded-3xl backdrop-blur-md">
          <DialogHeader className="text-left">
            <DialogTitle className="text-2xl font-display">{t("sidebar.profile.title")}</DialogTitle>
            <DialogDescription className="text-white/60">
              {t("sidebar.profile.description")}
            </DialogDescription>
          </DialogHeader>
          {user ? (
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white/5 border border-white/10">
                  <UserRound className="w-5 h-5 text-white/70" />
                </div>
                <div>
                  <div className="text-lg font-semibold">{user.name}</div>
                  <div className="text-sm text-white/60">{user.username ? `@${user.username}` : "Telegram"}</div>
                </div>
              </div>
              <Button
                onClick={() => {
                  onLogout();
                  setIsProfileOpen(false);
                }}
                variant="ghost"
                className="w-full h-10 text-red-300 hover:text-red-200 hover:bg-red-500/10"
              >
                {t("sidebar.logout")}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 pt-2">
              <div className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-black/50 px-3 h-11">
                <span className="text-white/40 text-sm">@</span>
                <Input
                  value={pendingUsername}
                  onChange={(e) => setPendingUsername(e.target.value.replace(/^@+/, ""))}
                  placeholder="telegram_user"
                  className="h-9 border-0 bg-transparent px-0 text-white placeholder:text-white/30 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>
              {!canSubmitUsername && normalizedUsername.length > 0 ? (
                <div className="text-xs text-red-300">
                  {t("sidebar.usernameHint")}
                </div>
              ) : null}
              <Button
                onClick={() => {
                  if (!canSubmitUsername) return;
                  onTelegramLogin(normalizedUsername);
                  setIsProfileOpen(false);
                  setPendingUsername("");
                }}
                disabled={!canSubmitUsername}
                className="h-11 px-5 border-0 bg-[#1f88c9] hover:bg-[#1a76ad] text-white font-semibold disabled:opacity-40 disabled:hover:bg-[#1f88c9] shadow-[0_0_0_1px_rgba(255,255,255,0.04)]"
              >
                <Send className="w-4 h-4 mr-2" />
                {t("sidebar.saveUsername")}
              </Button>
              <button
                type="button"
                onClick={() => setIsProfileOpen(false)}
                className="text-xs text-white/50 hover:text-white/80 transition-colors"
              >
                {t("sidebar.skip")}
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {isExpanded && !isNarrowViewport ? (
        <div className="fixed inset-y-0 left-16 right-0 z-40 bg-black/25 backdrop-blur-sm" />
      ) : null}
    </div>
  );
}
