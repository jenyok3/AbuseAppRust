import { motion } from "framer-motion";
import { useState, useEffect } from 'react';
import InteractiveCalendar from "@/components/ui/visualize-booking";

export default function Calendar() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    // Listen for sidebar state changes
    const handleStorageChange = () => {
      const saved = localStorage.getItem('sidebar-collapsed');
      setSidebarCollapsed(saved === 'true');
    };

    // Initial check
    handleStorageChange();

    // Listen for storage changes
    window.addEventListener('storage', handleStorageChange);
    
    // Also check periodically for local changes
    const interval = setInterval(handleStorageChange, 100);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  const marginLeft = sidebarCollapsed ? '16px' : '32px';

  return (
    <div className="flex-1 overflow-hidden relative font-body text-white">
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[10%] left-[20%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px]" />
      </div>

      <main className="relative z-10 max-w-6xl mx-auto h-full overflow-y-auto smooth-scroll custom-scrollbar">
        <div className="h-8"></div>
        
        <div className="flex items-center gap-3 mb-8 transition-all duration-300" style={{ marginLeft, marginTop: 'calc(50vh - 385px)' }}>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Календар</h1>
            <p className="text-muted-foreground">Управління зустрічами та подіями</p>
          </div>
        </div>

        <div className="transition-all duration-300" style={{ marginLeft }}>
          <InteractiveCalendar />
        </div>
      </main>
    </div>
  );
}
