import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  Settings,
  Send,
  Chrome,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";

type SidebarProps = {
  isExpanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
};

export function Sidebar({ isExpanded, onExpandedChange }: SidebarProps) {
  const { t } = useI18n();
  const [location, setLocation] = useLocation();

  const navItems = [
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

  const handleTelegramClick = () => {
    setType("telegram");
    setLocation("/");
  };

  const handleChromeClick = () => {
    setType("chrome");
    setLocation("/chrome");
  };

  return (
    <div className="relative h-full shrink-0">
      <div className="h-full w-16 shrink-0" />
      <div
        className={cn(
          "fixed left-0 top-12 z-50 h-[calc(100dvh-48px)] bg-transparent flex flex-col overflow-hidden transition-[width] duration-300 ease-smooth-sidebar",
          isExpanded ? "w-64" : "w-16"
        )}
      >
        <div
          className={cn(
            "h-14 flex items-center",
            isExpanded ? "px-4 justify-start" : "px-0 justify-center"
          )}
        >
          <div
            className={cn(
              "-mt-2 w-[58px] h-[58px] rounded-xl overflow-hidden shrink-0",
              isExpanded ? "-ml-1.5" : "-ml-1"
            )}
          >
            <img
              src="/logo.png"
              alt="AbuseApp Logo"
              className="w-full h-full object-contain"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = "none";
                target.nextElementSibling?.classList.remove("hidden");
              }}
            />
            <div className="w-full h-full bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center hidden">
              <span className="text-white font-bold text-sm">A</span>
            </div>
          </div>
          {isExpanded ? (
            <span className="ml-3 font-display font-bold text-lg tracking-wide whitespace-nowrap leading-none">
              Abuse<span className="text-primary">App</span>
            </span>
          ) : null}
        </div>

        <div className={cn("space-y-2", isExpanded ? "px-4 pb-4 pt-2" : "px-2 py-2")}>
          <Button
            variant="ghost"
            onClick={handleTelegramClick}
            className={cn(
              "w-full h-12 rounded-xl transition-[color,background-color,border-color] duration-300 relative overflow-hidden",
              isExpanded ? "justify-start gap-3 px-3" : "justify-center px-0",
              shouldHighlightFarmType && type === "telegram"
                ? "text-white bg-white/5 shadow-inner"
                : "text-muted-foreground hover:bg-white/5 hover:text-white"
            )}
          >
            <div className="flex items-center justify-center w-5 h-5">
              <Send className={cn("w-5 h-5", shouldHighlightFarmType && type === "telegram" && "text-primary")} />
            </div>
            {isExpanded ? <span className="font-medium whitespace-nowrap">Telegram</span> : null}
          </Button>

          <Button
            variant="ghost"
            onClick={handleChromeClick}
            className={cn(
              "w-full h-12 rounded-xl transition-[color,background-color,border-color] duration-300 relative overflow-hidden",
              isExpanded ? "justify-start gap-3 px-3" : "justify-center px-0",
              shouldHighlightFarmType && type === "chrome"
                ? "text-white bg-white/5 shadow-inner"
                : "text-muted-foreground hover:bg-white/5 hover:text-white"
            )}
          >
            <div className="flex items-center justify-center w-5 h-5">
              <Chrome className={cn("w-5 h-5", shouldHighlightFarmType && type === "chrome" && "text-primary")} />
            </div>
            {isExpanded ? <span className="font-medium whitespace-nowrap">Chrome</span> : null}
          </Button>

          <div
            className={cn("bg-transparent", isExpanded ? "mx-0.5" : "mx-0")}
            style={{ backgroundColor: "rgba(255, 255, 255, 0.08)" }}
          >
            <div className="h-px" />
          </div>

          <Link
            href="/calendar"
            className={cn(
              "w-full h-12 flex items-center rounded-xl transition-[color,background-color,border-color] duration-300 group relative overflow-hidden",
              isExpanded ? "justify-start gap-3 px-3" : "justify-center px-0",
              location === "/calendar"
                ? "text-white bg-white/5 shadow-inner"
                : "text-muted-foreground hover:text-white hover:bg-white/5"
            )}
          >
            <div className="flex items-center justify-center w-5 h-5">
              <Calendar className={cn("w-5 h-5", location === "/calendar" && "text-primary")} />
            </div>
            {isExpanded ? <span className="font-medium whitespace-nowrap">{t("sidebar.calendar")}</span> : null}
          </Link>
        </div>

        <nav className={cn("mt-auto space-y-2", isExpanded ? "p-4" : "px-2 py-2")}>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "w-full h-12 flex items-center rounded-xl transition-[color,background-color,border-color] duration-300 group relative overflow-hidden",
                isExpanded ? "justify-start gap-3 px-3" : "justify-center px-0",
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
            </Link>
          ))}
        </nav>

      </div>
      {isExpanded ? (
        <button
          type="button"
          aria-label="Collapse sidebar"
          className="fixed left-16 right-0 top-12 bottom-0 z-40 bg-black/35 backdrop-blur-md"
          onClick={() => onExpandedChange(false)}
        />
      ) : null}
    </div>
  );
}
