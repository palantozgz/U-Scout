import { useEffect, useRef, useState, type ReactNode } from "react";
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
import { useLocale } from "@/lib/i18n";
import Login from "@/pages/Login";
import { useClub } from "@/lib/club-api";

import { lazy, Suspense } from "react";

import { UCoreBootSplash } from "@/components/branding/UScoutBrand";
import JoinClub from "@/pages/JoinClub";
import JoinPage from "@/pages/Join";

const CoachHome = lazy(() => import("@/pages/scout/CoachHome"));
const ClubManagement = lazy(() => import("@/pages/scout/ClubManagement"));
const CoachDashboard = lazy(() =>
  import("@/pages/scout/Dashboard").then(m => ({ default: m.default })),
);
const PlayerEditor = lazy(() => import("@/pages/scout/PlayerEditor"));
const ReportViewV4 = lazy(() => import("@/pages/scout/ReportViewV4"));
const ReportSlidesV1 = lazy(() => import("@/pages/scout/ReportSlidesV1"));
const TestMode = lazy(() => import("@/pages/scout/TestMode"));
const Settings = lazy(() => import("@/pages/scout/Settings"));
const PlayerHome = lazy(() => import("@/pages/player/PlayerHome"));
const PlayerHomeSettingsStub = lazy(() => import("@/pages/player/PlayerHomeSettingsStub"));
const PlayerTeamList = lazy(() => import("@/pages/player/PlayerTeamList"));
const PlayerTeamView = lazy(() =>
  import("@/pages/player/Dashboard").then(m => ({ default: m.PlayerTeamView })),
);
const PlayerProfileViewer = lazy(() => import("@/pages/player/Profile"));
const UCoreHome = lazy(() => import("@/pages/core/Home"));
const UCoreScout = lazy(() => import("@/pages/core/Scout"));
const UCoreSchedule = lazy(() => import("@/pages/core/Schedule"));
const UCoreStats = lazy(() => import("@/pages/core/Stats"));

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
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[100dvh] bg-background">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
    <Switch>
      <Route path="/">
        <RootRedirect to={defaultPath} />
      </Route>
      <Route path="/login">
        <RootRedirect to={defaultPath} />
      </Route>

      {/* U Core shell routes */}
      <Route path="/home" component={UCoreHome} />
      <Route path="/scout" component={UCoreScout} />
      <Route path="/schedule" component={UCoreSchedule} />
      <Route path="/stats" component={UCoreStats} />
      <Route path="/more">
        <RootRedirect to="/home" />
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
    </Suspense>
  );
}

function AuthGate() {
  const { user, profile, loading } = useAuth();
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh] bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
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
  const defaultPath = "/home";
  return (
    <ClubSecurityGate>
      <AuthenticatedRoutes defaultPath={defaultPath} />
    </ClubSecurityGate>
  );
}

function ClubSecurityGate(props: { children: ReactNode }) {
  const { user, profile, signOut } = useAuth();
  const clubQ = useClub({ enabled: Boolean(user && profile) });

  useEffect(() => {
    if (!user?.id || !profile) return;
    if (!clubQ.isError) return;
    const msg = String((clubQ.error as any)?.message ?? clubQ.error ?? "");
    const isBanned = msg.includes("403") && msg.includes("banned");
    if (!isBanned) return;

    // Hard offboarding: clear local club/device state so next login is clean.
    try {
      const keys = Object.keys(window.localStorage);
      for (const k of keys) {
        if (k.startsWith("uscout-")) window.localStorage.removeItem(k);
      }
    } catch {
      // ignore
    }

    // Clear all cached queries (persisted + in-memory).
    try {
      queryClient.clear();
    } catch {
      // ignore
    }

    void signOut();
  }, [clubQ.error, clubQ.isError, profile, signOut, user?.id]);

  return <>{props.children}</>;
}

function App() {
  const { t } = useLocale();
  const { loading, user, profile, effectiveRole, previewRole, setPreviewRole } = useAuth();
  const [loc] = useLocation();
  const isJoinRoute = loc.startsWith("/join/") || loc.startsWith("/join-club/");
  const isAuthed = !!user && !!profile;
  const [showSplash, setShowSplash] = useState(false);
  const [splashFadeOut, setSplashFadeOut] = useState(false);
  const splashTimersRef = useRef<{ fade?: number; hard?: number } | null>(null);
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isAuthed) return;
    if (effectiveRole === "player" && loc.startsWith("/coach")) {
      setLocation("/home");
    }
  }, [effectiveRole, isAuthed, loc, setLocation]);

  useEffect(() => {
    // Join routes should never show the boot splash.
    if (isJoinRoute) {
      setShowSplash(false);
      setSplashFadeOut(false);
      if (splashTimersRef.current?.fade) window.clearTimeout(splashTimersRef.current.fade);
      if (splashTimersRef.current?.hard) window.clearTimeout(splashTimersRef.current.hard);
      splashTimersRef.current = null;
      return;
    }

    // Auth ready -> exit instantly.
    if (!loading) {
      setShowSplash(false);
      setSplashFadeOut(false);
      if (splashTimersRef.current?.fade) window.clearTimeout(splashTimersRef.current.fade);
      if (splashTimersRef.current?.hard) window.clearTimeout(splashTimersRef.current.hard);
      splashTimersRef.current = null;
      return;
    }

    // Auth still loading: show splash, but never block the app.
    setShowSplash(true);
    setSplashFadeOut(false);

    if (splashTimersRef.current?.fade) window.clearTimeout(splashTimersRef.current.fade);
    if (splashTimersRef.current?.hard) window.clearTimeout(splashTimersRef.current.hard);

    // Max visible time: 800ms (then fade fast).
    const fade = window.setTimeout(() => setSplashFadeOut(true), 800);
    // Hard timeout: remove splash at 1200ms even if auth still loading.
    const hard = window.setTimeout(() => {
      setShowSplash(false);
      setSplashFadeOut(false);
    }, 1200);

    splashTimersRef.current = { fade, hard };

    return () => {
      if (fade) window.clearTimeout(fade);
      if (hard) window.clearTimeout(hard);
    };
  }, [isJoinRoute, loading]);

  return (
    <QueryClientProvider client={queryClient}>
      <ClubGenderProvider>
      <TooltipProvider>
        <Toaster />
        <div className="min-h-[100dvh] bg-background max-w-md mx-auto relative shadow-2xl overflow-hidden overflow-y-auto border-x border-border">
          {showSplash ? <UCoreBootSplash fadeOut={splashFadeOut} /> : null}
          {previewRole && previewRole !== profile?.role ? (
            <button
              type="button"
              className="absolute top-2 right-2 z-[95] inline-flex items-center gap-2 rounded-full border border-border bg-card/90 backdrop-blur px-2.5 py-1 text-[10px] font-bold tracking-wide text-muted-foreground hover:text-foreground"
              data-testid="dev-role-preview-badge"
              onClick={() => setPreviewRole(null)}
              title={t("dev_badge_clear_title")}
              aria-label={t("dev_badge_clear_title")}
            >
              <span>
                {previewRole === "player"
                  ? t("dev_badge_preview_player")
                  : t("dev_badge_preview_staff")}
              </span>
              <span className="text-xs leading-none opacity-80">×</span>
            </button>
          ) : null}
          <Switch>
            <Route path="/join/:token" component={JoinPage} />
            <Route path="/join-club/:token" component={JoinClub} />
            <Route component={AuthGate} />
          </Switch>
        </div>
      </TooltipProvider>
      </ClubGenderProvider>
    </QueryClientProvider>
  );
}

export default App;
