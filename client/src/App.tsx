import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Sidebar } from "@/components/Sidebar";
import Dashboard from "@/pages/Dashboard";
import TestSimple from "./test-simple";
import Accounts from "@/pages/Accounts";
import Settings from "@/pages/Settings";
import Chrome from "@/pages/Chrome";
import Calendar from "@/pages/Calendar";
import NotFound from "@/pages/not-found";
import { GlobalWindowControls } from "@/components/GlobalWindowControls";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/test" component={TestSimple} />
      <Route path="/accounts" component={Accounts} />
      <Route path="/projects" component={Dashboard} />
      <Route path="/chrome" component={Chrome} />
      <Route path="/calendar" component={Calendar} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SidebarProvider>
          <div className="flex h-screen w-full overflow-hidden bg-black">
            {/* Black Title Bar */}
            <div className="title-bar">
              <div className="title-bar-content">AbuseApp</div>
            </div>
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden pt-2">
              <Router />
            </div>
          </div>
          <GlobalWindowControls />
        </SidebarProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
