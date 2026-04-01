import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Home from "@/pages/Home";
import CoachDashboard from "@/pages/coach/Dashboard";
import PlayerEditor from "@/pages/coach/PlayerEditor";
import TestMode from "@/pages/coach/TestMode";
import Settings from "@/pages/coach/Settings";
import PlayerModeDashboard from "@/pages/player/Dashboard";
import PlayerProfileViewer from "@/pages/player/Profile";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />

      {/* Coach Mode */}
      <Route path="/coach" component={CoachDashboard} />
      <Route path="/coach/player/:id" component={PlayerEditor} />
      <Route path="/coach/team/:id" component={CoachDashboard} />
      <Route path="/coach/test" component={TestMode} />
      <Route path="/settings" component={Settings} />
      <Route path="/player/settings" component={Settings} />

      {/* Player Mode */}
      <Route path="/player" component={PlayerModeDashboard} />
      <Route path="/player/:id" component={PlayerProfileViewer} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <div className="min-h-[100dvh] bg-background max-w-md mx-auto relative shadow-2xl overflow-hidden overflow-y-auto">
          <Router />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
