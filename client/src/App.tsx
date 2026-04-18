import { useEffect, useRef, useState } from "react";
import { Switch, Route, useLocation, useRoute } from "wouter";
import { migrateLegacyOnboarding, shouldOfferOnboarding } from "@/lib/onboarding-state";
import OnboardingFlow from "@/pages/OnboardingFlow";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { ClubGenderProvider } from "@/lib/clubGenderContext";
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
import ReportViewV4 from "@/pages/coach/ReportViewV4";
import ReportSlidesV1 from "@/pages/coach/ReportSlidesV1";
import TestMode from "@/pages/coach/TestMode";
import Settings from "@/pages/coach/Settings";
import PlayerHome from "@/pages/player/PlayerHome";
import PlayerHomeSettingsStub from "@/pages/player/PlayerHomeSettingsStub";
import PlayerTeamList from "@/pages/player/PlayerTeamList";
import { PlayerTeamView } from "@/pages/player/Dashboard";
import PlayerProfileViewer from "@/pages/player/Profile";
import JoinPage from "@/pages/Join";

const SPLASH_SHOWN_KEY = "splashShown";
/** Duración máxima de la transición fade → off (ms). */
const SPLASH_FADE_MS = 600;

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

function CoachScoutReportPreview() {
  const [, params] = useRoute("/coach/scout/:id/preview");
  const [, setLocation] = useLocation();
  const id = params?.id;
  if (!id) return null;
  return (
    <ReportSlidesV1
      playerId={id}
      onBack={() => setLocation("/coach/editor")}
    />
  );
}

function CoachScoutReportReview() {
  const [, params] = useRoute("/coach/scout/:id/review");
  const [, setLocation] = useLocation();
  const id = params?.id;
  if (!id) return null;
  return (
    <ReportViewV4
      playerId={id}
      mode="coach_review"
      onBack={() => setLocation("/coach/editor")}
    />
  );
}

function PlayerReportV4Route() {
  const [, params] = useRoute("/player/report/:id");
  const [, setLocation] = useLocation();
  const id = params?.id;
  if (!id) return null;
  return <ReportSlidesV1 playerId={id} onBack={() => setLocation("/player")} />;
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
      <Route path="/coach/scout/:id/preview" component={CoachScoutReportPreview} />
      <Route path="/coach/scout/:id/review" component={CoachScoutReportReview} />
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

      {/* Player Mode — /player = equipos rivales primero; /player/reports = rejilla de informes */}
      <Route path="/player/reports" component={PlayerHome} />
      <Route path="/player/home-settings" component={PlayerHomeSettingsStub} />
      <Route path="/player/teams">
        <RootRedirect to="/player" />
      </Route>
      <Route path="/player/team/:teamId" component={PlayerTeamView} />
      <Route path="/player/report/:id" component={PlayerReportV4Route} />
      <Route path="/player/:id" component={PlayerProfileViewer} />
      <Route path="/player" component={PlayerTeamList} />

      <Route component={NotFound} />
    </Switch>
  );
}

function AuthGate() {
  const { user, profile } = useAuth();
  const [onboardingReady, setOnboardingReady] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    if (!user?.id || !profile) {
      setOnboardingReady(false);
      return;
    }
    migrateLegacyOnboarding(user.created_at, user.id);
    setNeedsOnboarding(shouldOfferOnboarding(user.created_at, user.id));
    setOnboardingReady(true);
  }, [user?.id, user?.created_at, profile?.id]);

  if (!user || !profile) return <Login />;
  if (!onboardingReady) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh] bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (needsOnboarding) {
    return <OnboardingFlow userId={user.id} onDone={() => setNeedsOnboarding(false)} />;
  }
  const defaultPath = profile.role === "player" ? "/player" : "/coach";
  return <AuthenticatedRoutes defaultPath={defaultPath} />;
}

function App() {
  const { loading, user, profile } = useAuth();
  const [loc] = useLocation();
  const isJoinRoute = loc.startsWith("/join/") || loc.startsWith("/join-club/");
  const [skipSplash, setSkipSplash] = useState(readSplashAlreadyShown);
  const [splashDone, setSplashDone] = useState(skipSplash);
  const [splashPhase, setSplashPhase] = useState<"on" | "fade" | "off">(
    skipSplash ? "off" : "on",
  );
  const wasAuthedRef = useRef<boolean>(false);
  const isAuthed = !!user && !!profile;

  // Show splash after login (unauthenticated -> authenticated).
  useEffect(() => {
    const wasAuthed = wasAuthedRef.current;
    wasAuthedRef.current = isAuthed;
    if (wasAuthed || !isAuthed) return;

    try {
      sessionStorage.removeItem(SPLASH_SHOWN_KEY);
    } catch {
      /* ignore */
    }
    setSkipSplash(false);
    setSplashDone(false);
    setSplashPhase("on");
  }, [isAuthed]);

  useEffect(() => {
    if (skipSplash) return;
    const id = window.setTimeout(() => setSplashDone(true), 2000);
    return () => window.clearTimeout(id);
  }, [skipSplash]);

  const showSplash = !skipSplash && !splashDone;

  useEffect(() => {
    if (skipSplash) return;
    if (showSplash || splashPhase !== "on") return;
    setSplashPhase("fade");
  }, [skipSplash, showSplash, splashPhase]);

  useEffect(() => {
    if (skipSplash) return;
    // Safety timeout: si después de 2 segundos la splash sigue activa, forzar el cierre
    const timeout = window.setTimeout(() => {
      setSplashPhase((prev) => (prev === "on" ? "fade" : prev));
    }, 2000);
    return () => window.clearTimeout(timeout);
  }, [skipSplash]);

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
    }, SPLASH_FADE_MS);
    return () => window.clearTimeout(id);
  }, [skipSplash, splashPhase]);

  if (!skipSplash && splashPhase !== "off") {
    return <NbaAuthSplash fadeOut={splashPhase === "fade"} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ClubGenderProvider>
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
      </ClubGenderProvider>
    </QueryClientProvider>
  );
}

export default App;
