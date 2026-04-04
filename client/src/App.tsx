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
import ClubManagement from "@/pages/coach/ClubManagement";
import JoinClub from "@/pages/JoinClub";
import CoachDashboard from "@/pages/coach/Dashboard";
import PlayerEditor from "@/pages/coach/PlayerEditor";
import TestMode from "@/pages/coach/TestMode";
import Settings from "@/pages/coach/Settings";
import PlayerHome from "@/pages/player/PlayerHome";
import PlayerHomeSettingsStub from "@/pages/player/PlayerHomeSettingsStub";
import { PlayerTeamView } from "@/pages/player/Dashboard";
import PlayerProfileViewer from "@/pages/player/Profile";
import JoinPage from "@/pages/Join";

const SPLASH_SHOWN_KEY = "splashShown";

function readSplashAlreadyShown(): boolean {
  try {
    return sessionStorage.getItem(SPLASH_SHOWN_KEY) === "true";
  } catch {
    return false;
  }
}

function RootRedirect({ to }: { to: string }) {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation(to);
  }, [to, setLocation]);
  return null;
}

function AuthenticatedRoutes({ defaultPath }: { defaultPath: string }) {
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
      <Route path="/coach/club" component={ClubManagement} />
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
      <Route path="/player" component={PlayerHome} />
      <Route path="/player/home-settings" component={PlayerHomeSettingsStub} />
      <Route path="/player/team/:teamId" component={PlayerTeamView} />
      <Route path="/player/:id" component={PlayerProfileViewer} />

      <Route component={NotFound} />
    </Switch>
  );
}

function AuthGate() {
  const { user, profile } = useAuth();
  if (!user || !profile) return <Login />;
  const defaultPath = profile.role === "player" ? "/player" : "/coach";
  return <AuthenticatedRoutes defaultPath={defaultPath} />;
}

function App() {
  const { loading } = useAuth();
  const [loc] = useLocation();
  const isJoinRoute = loc.startsWith("/join/") || loc.startsWith("/join-club/");
  const [skipSplash] = useState(readSplashAlreadyShown);
  const [splashDone, setSplashDone] = useState(skipSplash);
  const [splashPhase, setSplashPhase] = useState<"on" | "fade" | "off">(
    skipSplash ? "off" : "on",
  );

  useEffect(() => {
    if (skipSplash) return;
    const id = window.setTimeout(() => setSplashDone(true), 3500);
    return () => window.clearTimeout(id);
  }, [skipSplash]);

  const showSplash = !skipSplash && (loading || !splashDone);

  useEffect(() => {
    if (skipSplash) return;
    if (showSplash || splashPhase !== "on") return;
    setSplashPhase("fade");
  }, [skipSplash, showSplash, splashPhase]);

  useEffect(() => {
    if (skipSplash) return;
    if (splashPhase !== "fade") return;
    const id = window.setTimeout(() => {
      try {
        sessionStorage.setItem(SPLASH_SHOWN_KEY, "true");
      } catch {
        /* ignore quota / private mode */
      }
      setSplashPhase("off");
    }, 400);
    return () => window.clearTimeout(id);
  }, [skipSplash, splashPhase]);

  if (!skipSplash && splashPhase !== "off") {
    return <NbaAuthSplash fadeOut={splashPhase === "fade"} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <div className="min-h-[100dvh] bg-background max-w-md mx-auto relative shadow-2xl overflow-hidden overflow-y-auto border-x border-border">
          {loading && !isJoinRoute ? (
            <div className="flex items-center justify-center min-h-[100dvh] bg-background">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <Switch>
              <Route path="/join/:token" component={JoinPage} />
              <Route path="/join-club/:token" component={JoinClub} />
              <Route component={AuthGate} />
            </Switch>
          )}
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
