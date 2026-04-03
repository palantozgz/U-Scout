import { useEffect, useState } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { useAuth } from "@/lib/useAuth";
import Login from "@/pages/Login";

import { NbaAuthSplash } from "@/components/branding/UScoutBrand";
import CoachHome from "@/pages/coach/CoachHome";
import CoachDashboard from "@/pages/coach/Dashboard";
import PlayerEditor from "@/pages/coach/PlayerEditor";
import TestMode from "@/pages/coach/TestMode";
import Settings from "@/pages/coach/Settings";
import PlayerModeDashboard from "@/pages/player/Dashboard";
import PlayerProfileViewer from "@/pages/player/Profile";

function RootRedirect({ to }: { to: string }) {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation(to);
  }, [to, setLocation]);
  return null;
}

function Router({
  defaultPath,
  signOut,
}: {
  defaultPath: string;
  signOut: () => Promise<void>;
}) {
  void signOut;
  return (
    <Switch>
      <Route path="/">
        <RootRedirect to={defaultPath} />
      </Route>
      <Route path="/login">
        <RootRedirect to={defaultPath} />
      </Route>

      {/* Coach Mode — specific paths before /coach */}
      <Route path="/coach/player/:id/profile" component={PlayerProfileViewer} />
      <Route path="/coach/player/:id" component={PlayerEditor} />
      <Route path="/coach/team/:id">
        <CoachDashboard mode="editor" />
      </Route>
      <Route path="/coach/test" component={TestMode} />
      <Route path="/coach/editor">
        <CoachDashboard mode="editor" />
      </Route>
      <Route path="/coach/reports">
        <CoachDashboard mode="reports" />
      </Route>
      <Route path="/coach" component={CoachHome} />
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
  const { user, profile, loading, signOut } = useAuth();
  const [splashPhase, setSplashPhase] = useState<"on" | "fade" | "off">("on");

  useEffect(() => {
    if (!loading && splashPhase === "on") setSplashPhase("fade");
  }, [loading, splashPhase]);

  useEffect(() => {
    if (splashPhase !== "fade") return;
    const id = window.setTimeout(() => setSplashPhase("off"), 400);
    return () => clearTimeout(id);
  }, [splashPhase]);

  if (splashPhase !== "off") {
    return <NbaAuthSplash fadeOut={splashPhase === "fade"} />;
  }

  if (!user || !profile) return <Login />;

  const defaultPath = profile.role === "player" ? "/player" : "/coach";

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <div className="min-h-[100dvh] bg-background max-w-md mx-auto relative shadow-2xl overflow-hidden overflow-y-auto border-x border-border">
          <Router defaultPath={defaultPath} signOut={signOut} />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
