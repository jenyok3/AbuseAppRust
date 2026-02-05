import { motion } from "framer-motion";
import { LaunchPanel } from "@/components/LaunchPanel";
import { StatsPanel } from "@/components/StatsPanel";
import { DailyTasksPanel } from "@/components/DailyTasksPanel";
import { LogsPanel, AddProjectDialog } from "@/components/LogsPanel";
import { useState, useEffect } from "react";
// Electron API types are declared in client/src/types/electron.d.ts

export default function Dashboard() {
  const [layoutMode, setLayoutMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [containerWidth, setContainerWidth] = useState(0);

  // Monitor container width to determine layout mode
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      console.log('🪟 Window width changed to:', width);
      setContainerWidth(width);
      
      // Determine layout mode based on width
      let newLayoutMode: 'desktop' | 'tablet' | 'mobile';
      if (width >= 1400) { // Increased to account for sidebar
        newLayoutMode = 'desktop';
      } else if (width >= 900) { // Increased tablet breakpoint
        newLayoutMode = 'tablet';
      } else {
        newLayoutMode = 'mobile';
      }
      
      console.log('🎯 Determined layout mode:', newLayoutMode);
      setLayoutMode(newLayoutMode);
    };

    // Set initial layout mode
    handleResize();
    
    // Add resize listener for responsive behavior
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className="flex-1 overflow-hidden relative font-body text-white">
      {/* Background ambient effects */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[10%] left-[20%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-[10%] right-[10%] w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[100px]" />
      </div>

      <main className="relative z-10 max-w-[1920px] mx-auto h-full pt-12 px-4 md:px-6 lg:px-8 pb-4 md:pb-6 lg:pb-8 responsive-container main-container prevent-overflow">
        {/* Layout Mode Indicator - for testing */}
        <div className="absolute top-2 left-2 right-2 z-50 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-1 text-xs text-white/70 flex items-center justify-between">
          <span>
            {layoutMode === 'desktop' ? '🖥️ Desktop' : layoutMode === 'tablet' ? '📱 Tablet' : '📱 Mobile'} ({containerWidth}px)
          </span>
        </div>
        
        {layoutMode === 'desktop' ? (
          // Desktop Layout - original 2-column layout
          <div className="h-full grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 content-stretch items-stretch layout-transition grid-container">
            
            {/* Left Main Column */}
            <div className="flex flex-col gap-6 h-full min-h-0">
              {/* Main Top Widget - Full Width (Launch Panel) */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="flex-none widget-hover w-full"
                style={{ aspectRatio: '1.92 / 1' }}
              >
                <LaunchPanel />
              </motion.div>

              {/* Bottom Row - 2 Widgets - Natural height without pressure */}
              <div className="grid grid-cols-1 md:grid-cols-[1.93fr_1fr] gap-6 items-stretch">
                {/* Logs Widget - Natural height based on content */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.1 }}
                  className="flex flex-col w-full"
                  data-logs-widget
                  style={{ aspectRatio: '1.93 / 1' }}
                >
                  <div className="bg-card/40 backdrop-blur-sm border border-white/5 rounded-3xl p-6 flex flex-col overflow-hidden h-full">
                    <LogsPanel hideAddProject />
                  </div>
                </motion.div>
                
                {/* Square Widget (Add Project) - True square */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.2 }}
                  className="widget-hover w-full"
                  data-add-project-widget
                  style={{ aspectRatio: '1 / 1' }}
                >
                  <AddProjectDialog variant="widget" />
                </motion.div>
              </div>
            </div>

            {/* Right Sidebar Column - Stats & Daily */}
            <div className="flex flex-col gap-6 items-stretch h-full min-h-0">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.4 }}
                className="flex-none widget-hover w-full"
                style={{ aspectRatio: '1.22 / 1' }}
              >
                <StatsPanel />
              </motion.div>

              {/* Daily Widget - Fixed height */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
                className="widget-hover overflow-hidden w-full"
                data-daily-widget
                style={{ aspectRatio: '3 / 4' }}
              >
                <DailyTasksPanel />
              </motion.div>
            </div>
          </div>
        ) : layoutMode === 'tablet' ? (
          // Tablet Layout - Launch Panel full width, Stats & Daily side by side below, then Logs & Add Project
          <div className="h-full overflow-y-auto smooth-scroll custom-scrollbar pr-4">
            <div className="flex flex-col gap-6 min-h-full grid-container">
              
              {/* Launch Panel - Full width */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="w-full flex-shrink-0 widget-hover"
                style={{ aspectRatio: '1.92 / 1' }}
              >
                <LaunchPanel />
              </motion.div>

              {/* Stats & Daily Panels - Side by side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full grid-container">
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.1 }}
                  className="w-full widget-hover widget-responsive"
                  style={{ aspectRatio: '1.22 / 1' }}
                >
                  <StatsPanel />
                </motion.div>

                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.2 }}
                  className="w-full widget-hover widget-responsive"
                  style={{ aspectRatio: '3 / 4' }}
                >
                  <DailyTasksPanel />
                </motion.div>
              </div>

              {/* Logs & Add Project - Side by side */}
              <div className="grid grid-cols-1 md:grid-cols-[1.93fr_1fr] gap-6 w-full grid-container items-end">
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.3 }}
                  className="w-full widget-hover"
                  style={{ aspectRatio: '1.93 / 1' }}
                >
                  <div className="bg-card/40 backdrop-blur-sm border border-white/5 rounded-3xl p-6 h-full custom-scrollbar overflow-hidden">
                    <LogsPanel hideAddProject />
                  </div>
                </motion.div>

                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.4 }}
                  className="w-full widget-hover"
                  style={{ aspectRatio: '1 / 1' }}
                  data-add-project-widget
                >
                  <AddProjectDialog variant="widget" />
                </motion.div>
              </div>
            </div>
          </div>
        ) : (
          // Mobile Layout - Everything stacked vertically
          <div className="h-full overflow-y-auto smooth-scroll custom-scrollbar pr-4">
            <div className="flex flex-col gap-4 min-h-full grid-container">
              
              {/* Launch Panel - Full width */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="w-full flex-shrink-0 widget-hover"
                style={{ aspectRatio: '1.92 / 1' }}
              >
                <LaunchPanel />
              </motion.div>

              {/* Stats Panel - Full width */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="w-full widget-hover widget-responsive"
                style={{ aspectRatio: '1.22 / 1' }}
              >
                <StatsPanel />
              </motion.div>

              {/* Daily Tasks Panel - Full width */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className="w-full widget-hover widget-responsive"
                style={{ aspectRatio: '3 / 4' }}
              >
                <DailyTasksPanel />
              </motion.div>

              {/* Add Project Widget - Full width */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
                className="w-full widget-hover"
                style={{ aspectRatio: '1 / 1' }}
                data-add-project-widget
              >
                <AddProjectDialog variant="widget" />
              </motion.div>

              {/* Logs Panel - Full width */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.4 }}
                className="w-full widget-hover"
                style={{ aspectRatio: '1.93 / 1' }}
              >
                <div className="bg-card/40 backdrop-blur-sm border border-white/5 rounded-3xl p-6 h-full custom-scrollbar overflow-hidden">
                  <LogsPanel hideAddProject />
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
