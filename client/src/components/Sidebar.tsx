import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  Home, 
  Settings, 
  Send, 
  Chrome, 
  Users, 
  LogOut,
  Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Sidebar() {
  const [location] = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    // Load collapsed state from localStorage
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved === 'true';
  });

  // Save collapsed state to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', isCollapsed.toString());
  }, [isCollapsed]);

  const navItems = [
    { icon: Calendar, label: "Календар", href: "/calendar" },
    { icon: Settings, label: "Налаштування", href: "/settings" },
  ];

  // Determine current type based on location
  const getCurrentType = (): "telegram" | "chrome" => {
    if (location === "/chrome") return "chrome";
    return "telegram";
  };

  // Check if we should highlight the farm type buttons
  const shouldHighlightFarmType = location === "/" || location === "/chrome";

  const [type, setType] = useState<"telegram" | "chrome">(getCurrentType());

  // Update type when location changes
  useEffect(() => {
    setType(getCurrentType());
  }, [location]);

  const handleTelegramClick = () => {
    setType("telegram");
    window.location.href = "/";
  };

  const handleChromeClick = () => {
    setType("chrome");
    window.location.href = "/chrome";
  };

  return (
    <div className={cn(
      "h-screen border-r border-white/5 bg-black/95 flex flex-col shrink-0 transition-all duration-300 relative",
      isCollapsed ? "w-16" : "w-20 lg:w-64"
    )}>
      {/* Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={cn(
          "absolute -right-3 top-1/2 -translate-y-1/2 z-50",
          "w-6 h-6 bg-black/90 border border-white/10 rounded-full",
          "flex items-center justify-center text-white/60 hover:text-white/80",
          "transition-all duration-300 hover:bg-black/95 hover:border-white/20",
          "backdrop-blur-sm"
        )}
      >
        {isCollapsed ? (
          <ChevronRight className="w-3 h-3" />
        ) : (
          <ChevronLeft className="w-3 h-3" />
        )}
      </button>

      {/* Header / Logo Area */}
      <div className={cn(
        "h-20 flex items-center justify-center border-b border-white/5 transition-all duration-300",
        isCollapsed ? "lg:justify-center" : "lg:justify-start lg:px-6"
      )}>
        <div className="w-14 h-14 rounded-xl overflow-hidden">
          <img 
            src="/logo.png" 
            alt="AbuseApp Logo" 
            className="w-full h-full object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              target.nextElementSibling?.classList.remove('hidden');
            }}
          />
          <div className="w-full h-full bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center hidden">
            <span className="text-white font-bold text-lg">A</span>
          </div>
        </div>
        <span className={cn(
          "ml-3 font-display font-bold text-lg tracking-wide transition-all duration-300",
          isCollapsed ? "hidden" : "hidden lg:block"
        )}>
          Abuse<span className="text-primary">App</span>
        </span>
      </div>

      {/* Farm Type Switcher */}
      <div className={cn("space-y-2 transition-all duration-300", isCollapsed ? "px-2 py-2" : "p-4")}>
        <Button 
          variant="ghost" 
          onClick={handleTelegramClick}
          className={cn(
            "w-full h-12 rounded-xl transition-all relative overflow-hidden",
            isCollapsed ? "justify-center" : "justify-center lg:justify-start",
            "gap-3",
            shouldHighlightFarmType && type === "telegram"
              ? "bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20" 
              : "text-muted-foreground hover:bg-white/5 hover:text-white"
          )}
        >
          <div className="flex items-center justify-center w-5 h-5">
            <Send className="w-5 h-5" />
          </div>
          <span className={cn(
            "font-medium transition-all duration-300",
            isCollapsed ? "hidden" : "hidden lg:block"
          )}>
            Telegram
          </span>
          {shouldHighlightFarmType && type === "telegram" && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full" />
          )}
        </Button>
        
        <Button 
          variant="ghost" 
          onClick={handleChromeClick}
          className={cn(
            "w-full h-12 rounded-xl transition-all relative overflow-hidden",
            isCollapsed ? "justify-center" : "justify-center lg:justify-start",
            "gap-3",
            shouldHighlightFarmType && type === "chrome"
              ? "bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20" 
              : "text-muted-foreground hover:bg-white/5 hover:text-white"
          )}
        >
          <div className="flex items-center justify-center w-5 h-5">
            <Chrome className="w-5 h-5" />
          </div>
          <span className={cn(
            "font-medium transition-all duration-300",
            isCollapsed ? "hidden" : "hidden lg:block"
          )}>
            Chrome
          </span>
          {shouldHighlightFarmType && type === "chrome" && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full" />
          )}
        </Button>
      </div>

      <div className={cn(
        "bg-white/5 transition-all duration-300",
        isCollapsed ? "mx-2" : "mx-4"
      )}>
        <div className="h-px" />
      </div>

      {/* Navigation */}
      <nav className={cn(
        "flex-1 space-y-2 transition-all duration-300",
        isCollapsed ? "px-2 py-2" : "p-4"
      )}>
        {navItems.map((item) => (
          <Link key={item.href} href={item.href} className={cn(
            "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group relative overflow-hidden",
            isCollapsed ? "justify-center" : "justify-center lg:justify-start",
            location === item.href 
              ? "text-white bg-white/5 shadow-inner" 
              : "text-muted-foreground hover:text-white hover:bg-white/5"
          )}>
            <div className="flex items-center justify-center w-5 h-5">
              <item.icon className={cn(
                "w-5 h-5 transition-transform duration-300 group-hover:scale-110",
                location === item.href && "text-primary"
              )} />
            </div>
            <span className={cn(
              "font-medium transition-all duration-300",
              isCollapsed ? "hidden" : "hidden lg:block"
            )}>
              {item.label}
            </span>
            
            {location === item.href && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full" />
            )}
          </Link>
        ))}
      </nav>

      {/* Footer / User Profile */}
      <div className={cn(
        "border-t border-white/5 transition-all duration-300",
        isCollapsed ? "p-2" : "p-4"
      )}>
        <button className={cn(
          "flex items-center gap-3 w-full p-2 rounded-xl hover:bg-white/5 transition-colors group",
          isCollapsed ? "justify-center" : "justify-center lg:justify-start"
        )}>
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-tr from-zinc-700 to-zinc-600 border border-white/10">
            {/* Avatar placeholder - could add user icon here */}
          </div>
          <div className={cn(
            "flex flex-col items-start overflow-hidden transition-all duration-300",
            isCollapsed ? "hidden" : "hidden lg:flex"
          )}>
            <span className="text-sm font-medium text-white truncate w-full">Administrator</span>
            <span className="text-xs text-muted-foreground">admin@abuse.app</span>
          </div>
          <div className={cn(
            "flex items-center justify-center w-4 h-4 ml-auto transition-all duration-300",
            isCollapsed ? "hidden" : "hidden lg:block"
          )}>
            <LogOut className="w-4 h-4 text-muted-foreground group-hover:text-red-400" />
          </div>
        </button>
      </div>
    </div>
  );
}
