import { useEffect, useMemo, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useLocale } from "@/lib/i18n";
import { useAuth, type AppUserRole } from "@/lib/useAuth";
import { computeCapabilities, readCoachBadges, useCapabilities } from "@/lib/capabilities";
import { cn } from "@/lib/utils";
import { CalendarDays, BarChart3, Users, Target, BellDot, Activity, ClipboardList, Settings, Heart, MapPin, Clock, BookOpen, Building2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { clubQueryKey } from "@/lib/club-api";
import { useClub } from "@/lib/club-api";
import { getStoredRosterSignature, rosterSignature, setStoredRosterSignature } from "@/lib/clubRosterSeen";
import { usePlayerTeams } from "@/lib/player-home";
import { apiRequest } from "@/lib/queryClient";
import {
  useScheduleParticipantsForEvents,
  useThisWeekScheduleEvents,
  useTodayScheduleEvents,
  useTomorrowScheduleEvents,
  useTodayWellnessSubmissionPct,
} from "@/lib/schedule";
import { useWellnessEntryToday, todayKey } from "@/lib/wellness";
import { buildHomeSignals } from "@/lib/homeSignals";
import { ModuleNav } from "./ModuleNav";

type HomeMode = "staff" | "player";

function useHomeMode(): HomeMode {
  const caps = useCapabilities();
  return caps.canUsePlayerUX ? "player" : "staff";
}

const ROLE_LABEL_KEY: Record<AppUserRole, "role_master" | "role_head_coach" | "role_coach" | "role_player"> = {
  master: "role_master",
  head_coach: "role_head_coach",
  coach: "role_coach",
  player: "role_player",
};

/** KPI chip in the stats bar */
function KpiCell({ value, label, color }: { value: string | number; label: string; color?: "primary" | "green" | "default" }) {
  const colorClass =
    color === "primary" ? "text-primary" :
    color === "green"   ? "text-emerald-500" :
    "text-foreground";
  return (
    <div className="flex flex-col items-center justify-center py-3 px-2">
      <span data-scoreboard="" className={cn("text-2xl font-black leading-none tabular-nums", colorClass)}>{value}</span>
      <span className="text-[8px] font-bold tracking-[1.5px] text-muted-foreground uppercase mt-1">{label}</span>
    </div>
  );
}

/** 2×2 module card */
function ModCard(props: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  badge?: string;
  dot?: boolean;
  comingSoon?: boolean;
  onClick: () => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={props.comingSoon ? undefined : props.onClick}
      disabled={props.comingSoon}
      data-testid={props.testId}
      className={cn(
        "group relative text-left rounded-xl border border-border bg-card p-4 flex flex-col gap-2",
        "transition-all duration-200",
        props.comingSoon
          ? "opacity-50 cursor-default"
          : "active:scale-[0.97] hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
      )}
    >
      {props.dot && (
        <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-destructive ring-2 ring-card" />
      )}
      {props.badge && !props.comingSoon && (
        <span className="absolute top-3 right-3 text-[8px] font-black tracking-wide bg-primary text-primary-foreground rounded px-1.5 py-0.5">
          {props.badge}
        </span>
      )}
      {props.comingSoon && (
        <span className="absolute top-3 right-3 text-[8px] font-black tracking-wide bg-muted text-muted-foreground rounded px-1.5 py-0.5">
          SOON
        </span>
      )}
      <span className={cn("opacity-70 transition-opacity", props.comingSoon ? "text-muted-foreground" : "text-primary group-hover:opacity-100")}>{props.icon}</span>
      <div>
        <p className="text-sm font-black text-foreground tracking-tight leading-tight">{props.title}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">{props.subtitle}</p>
      </div>
    </button>
  );
}

export default function Home() {
  const { t } = useLocale();
  const [, setLocation] = useLocation();
  const mode = useHomeMode();
  const { profile, effectiveRole, previewRole } = useAuth();
  const caps = useCapabilities();
  const queryClient = useQueryClient();

  useEffect(() => {
    // Prefetch club data (existing)
    void queryClient.prefetchQuery({
      queryKey: clubQueryKey,
      queryFn: async () => { const r = await apiRequest("GET", "/api/club"); return r.json(); },
      staleTime: 5 * 60 * 1000,
    });

    // Prefetch U Scout JS chunks in background — motor loads before user navigates there
    void import("@/lib/mock-data");
    void import("@/lib/motor-v4");

    // Prefetch players + teams data in parallel — cache warm before entering U Scout
    void queryClient.prefetchQuery({
      queryKey: ["/api/players"],
      queryFn: async () => (await apiRequest("GET", "/api/players")).json(),
      staleTime: 10 * 60 * 1000,
    });
    void queryClient.prefetchQuery({
      queryKey: ["/api/teams"],
      queryFn: async () => (await apiRequest("GET", "/api/teams")).json(),
      staleTime: 10 * 60 * 1000,
    });
  }, [queryClient]);
  const realCaps = useMemo(
    () =>
      computeCapabilities({
        realRole: profile?.role ?? null,
        effectiveRole: profile?.role ?? null,
        badges: readCoachBadges(profile ?? null),
      }),
    [profile?.id, profile?.role],
  );
  const settingsHref = previewRole ? "/settings" : (caps.canUsePlayerUX ? "/player/home-settings" : "/settings");
  const displayName = profile?.username?.trim() || profile?.email || t("coach_home_name_fallback");
  const roleLabel = effectiveRole ? t(ROLE_LABEL_KEY[effectiveRole]) : "";

  // Staff: show Mi Club activity dot (same logic as previous CoachHome)
  const watchesClubActivity = mode === "staff" && realCaps.staffRole === "head_coach";
  const clubQuery = useClub({ enabled: watchesClubActivity });
  const clubData = clubQuery.data;

  const clubId = clubData?.club?.id;
  const userId = profile?.id;

  const todaySessionsQ = useTodayScheduleEvents({ clubId });
  const tomorrowSessionsQ = useTomorrowScheduleEvents({ clubId });
  const weekSessionsQ = useThisWeekScheduleEvents({ clubId });

  const rosterPlayerUserIds = useMemo(() => {
    const members = clubData?.members ?? [];
    return members.filter((m) => m.role === "player" && m.status === "active").map((m) => m.userId);
  }, [clubData?.members]);

  const todayParticipantsQ = useScheduleParticipantsForEvents({
    clubId,
    eventIds: todaySessionsQ.data?.map((s) => s.id) ?? [],
  });

  const wellnessPctQ = useTodayWellnessSubmissionPct({ clubId, playerUserIds: rosterPlayerUserIds });

  const wellnessEntryQ = useWellnessEntryToday({ clubId, userId });
  const wellnessSubmittedToday = Boolean(wellnessEntryQ.data);
  const wellnessDateKey = todayKey();

  const showClubActivityDot = useMemo(() => {
    if (!clubData || clubQuery.isError || !profile?.id) return false;
    if (realCaps.staffRole !== "head_coach") return false;
    const clubIdForDot = clubData.club?.id;
    if (!clubIdForDot) return false;
    const prev = getStoredRosterSignature(profile.id, clubIdForDot);
    if (prev === null) return false;
    return prev !== rosterSignature(clubData.members);
  }, [clubData, clubQuery.isError, profile?.id, realCaps.staffRole]);

  const homeSignals = useMemo(
    () =>
      buildHomeSignals({
        todaySessions: todaySessionsQ.data ?? [],
        tomorrowSessions: tomorrowSessionsQ.data ?? [],
        weekSessions: weekSessionsQ.data ?? [],
        todaySessionsIsSuccess: todaySessionsQ.isSuccess,
        rosterPlayerUserIds,
        todayParticipants: todayParticipantsQ.data ?? [],
        wellnessPct: wellnessPctQ.data?.pct ?? null,
        wellnessSubmittedToday,
        showClubChanges: showClubActivityDot,
        staffRole: realCaps.staffRole,
        isPhysicalTrainer: realCaps.isPhysicalTrainer,
        canCreateSession: realCaps.canCreateEvent,
        canManageWellness: realCaps.canManageWellness,
      }),
    [
      realCaps.canCreateEvent,
      realCaps.canManageWellness,
      realCaps.isPhysicalTrainer,
      realCaps.staffRole,
      rosterPlayerUserIds,
      showClubActivityDot,
      todayParticipantsQ.data,
      todaySessionsQ.data,
      todaySessionsQ.isSuccess,
      tomorrowSessionsQ.data,
      weekSessionsQ.data,
      wellnessPctQ.data?.pct,
      wellnessSubmittedToday,
    ],
  );

  // Keep roster signature initialized once, same as previous CoachHome.
  useEffect(() => {
    if (!clubData || clubQuery.isError || !profile?.id) return;
    const clubId = clubData.club?.id;
    if (!clubId) return;
    const sig = rosterSignature(clubData.members);
    const prev = getStoredRosterSignature(profile.id, clubId);
    if (prev === null) setStoredRosterSignature(profile.id, clubId, sig);
  }, [clubData, clubQuery.isError, profile?.id]);

  // Player chips: compute "new reports" aggregate if available.
  const playerTeamsQ = usePlayerTeams();
  const playerPending = useMemo(() => {
    if (mode !== "player") return null;
    const teams = playerTeamsQ.data?.teams ?? [];
    if (!teams.length) return 0;
    return teams.reduce((sum, r) => {
      const pending = typeof r.reportsPending === "number" ? r.reportsPending : r.unseenCount;
      return sum + pending;
    }, 0);
  }, [mode, playerTeamsQ.data?.teams]);

  const newReportsCount = useMemo(() => {
    if (mode !== "player") return null;
    const teams = playerTeamsQ.data?.teams ?? [];
    if (!teams.length) return 0;
    return teams.reduce((sum, r) => sum + (r.unseenCount ?? 0), 0);
  }, [mode, playerTeamsQ.data?.teams]);

  // smartSlots removed — replaced by KPI bar + module grid in new layout

  // ── Derived display values ────────────────────────────────
  const firstName = (profile?.username?.trim() || profile?.email || "").split(" ")[0] || t("coach_home_name_fallback");

  const dateStr = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());
    } catch {
      return "";
    }
  }, []);

  const nextSession = homeSignals.kpis.nextSession;

  const nextSessionTimeStr = useMemo(() => {
    if (!nextSession?.starts_at) return null;
    try {
      return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(nextSession.starts_at));
    } catch {
      return nextSession.starts_at;
    }
  }, [nextSession?.starts_at]);

  // Days until next session
  const daysUntilNext = useMemo(() => {
    if (!nextSession?.starts_at) return null;
    const diff = Math.ceil((new Date(nextSession.starts_at).getTime() - Date.now()) / 86_400_000);
    return Math.max(0, diff);
  }, [nextSession?.starts_at]);

  // KPI values
  const kpiPlayers = rosterPlayerUserIds.length;
  const kpiWeekSessions = weekSessionsQ.data?.length ?? 0;
  const kpiWellnessPct = wellnessPctQ.data?.pct ?? 0;

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background text-foreground overflow-hidden">
      <main className="relative z-10 flex flex-col flex-1 w-full max-w-5xl mx-auto overflow-y-auto pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-10 md:px-8">

        {/* ── Brand mark ───────────────────────────── */}
        <div className="flex flex-col items-center pt-6 pb-1 gap-0.5">
          <svg viewBox="0 0 1024 1024" style={{ height: 40, width: 40, color: "currentColor" }} aria-hidden>
            <defs>
              <clipPath id="home-horn-clip">
                <rect x={0} y={0} width={1024} height={427} />
              </clipPath>
            </defs>
            <g clipPath="url(#home-horn-clip)">
              <path fill="currentColor" fillRule="evenodd" clipRule="evenodd" d="M288.289 318.118C289.221 325.07 294.736 334.799 301.552 341.515C312.636 352.436 329.068 359.222 352.865 362.704C362.461 364.109 373.085 364.43 413.5 364.539C444.206 364.622 463.62 365.057 465.5 365.703C482.094 371.409 490.715 381.404 492.955 397.534C494.205 406.54 494.432 450.968 493.234 452.166C492.735 452.665 487.64 452.945 481.913 452.787L471.5 452.5L470.904 426.5C470.134 392.886 469.331 390.594 457.072 387.048C451.513 385.44 445.875 385.061 420.5 384.59C373.973 383.726 353.073 381.434 332.5 374.939C318.536 370.53 309.727 365.665 301.395 357.761C292.764 349.574 288.302 341.702 286.54 331.552C285.287 324.336 285.555 314 286.996 314C287.403 314 287.985 315.853 288.289 318.118Z M737.81 324.852C737.4 334.804 737.059 336.344 733.697 343.424C726.882 357.773 713.38 367.822 691.201 375.051C669.87 382.003 641.478 384.995 596.799 384.998C582.904 384.999 570.906 385.47 567.799 386.135C561.366 387.513 555.764 392.584 554.115 398.523C553.448 400.928 553.009 412.273 553.006 427.231L553 451.962L550.75 452.524C549.513 452.833 544.225 452.954 539 452.793L529.5 452.5L529.208 430C528.703 391.074 531.565 381.065 545.923 371.549C556.38 364.619 556.785 364.576 611.5 364.498C664.99 364.423 671.76 363.934 689.908 358.842C703.728 354.963 714.681 349.113 722.513 341.427C729.264 334.801 734.78 325.059 735.711 318.118C736.015 315.853 736.712 314 737.26 314C737.889 314 738.092 318.008 737.81 324.852Z" />
            </g>
            <g transform="translate(0,544) scale(1,1.32468) translate(0,-544)">
              <path fill="currentColor" fillRule="evenodd" clipRule="evenodd" d="M551.8 467.2C552.65 468.05 553 473.999 553 487.595C553 504.029 552.709 507.73 550.98 513.331C548.003 522.966 542.739 529.088 533.685 533.443C510.841 544.431 483.42 536.926 474.148 517.148C471.571 511.651 471.491 510.904 471.181 489.217L470.862 466.933L482.181 467.217L493.5 467.5L494 486.5C494.459 503.939 494.683 505.795 496.733 509.09C502.665 518.63 519.466 518.964 526.395 509.681C528.321 507.101 528.542 505.189 529 487.181L529.5 467.5L539.5 466.944C545 466.638 549.748 466.3 550.05 466.194C550.352 466.087 551.14 466.54 551.8 467.2Z" />
            </g>
          </svg>
          <span style={{ fontSize: "9px", letterSpacing: "0.22em", textTransform: "uppercase", opacity: 0.4, fontWeight: 600 }}>
            U CORE
          </span>
        </div>

        {/* ── Header: greeting ──────────────────────── */}
        <div className="px-5 md:px-0 pt-4 md:pt-3 pb-4 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold tracking-[2px] uppercase text-muted-foreground mb-1 truncate">
              {dateStr}
            </p>
            <h1 className="text-[26px] font-black tracking-tight leading-tight">
              {t("home_greeting_hi")}, <span className="text-primary">{firstName}</span> 👋
            </h1>
          </div>
          <button
            type="button"
            aria-label="Settings"
            onClick={() => setLocation(settingsHref)}
            className="mt-1 shrink-0 p-2 rounded-full border border-border bg-card text-muted-foreground hover:text-foreground transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        {/* ── KPI bar ───────────────────────────────── */}
        {mode === "staff" ? (
          <div className="mx-4 md:mx-0 mb-4 grid grid-cols-3 divide-x divide-border rounded-xl border border-border bg-card overflow-hidden">
            <KpiCell value={kpiPlayers}       label={t("home_kpi_players")}   color="default"  />
            <KpiCell value={kpiWeekSessions}  label={t("home_kpi_week")}      color="primary"  />
            <KpiCell value={`${kpiWellnessPct}%`} label={t("home_kpi_wellness")} color="green" />
          </div>
        ) : (
          <div className="mx-4 md:mx-0 mb-4 grid grid-cols-3 divide-x divide-border rounded-xl border border-border bg-card overflow-hidden">
            <KpiCell value={daysUntilNext ?? "—"} label={t("home_kpi_next_session")} color="default" />
            <KpiCell value={newReportsCount ?? 0} label={t("home_kpi_reports")}      color="primary" />
            <KpiCell
              value={wellnessSubmittedToday ? "✓" : "!"}
              label={t("home_kpi_wellness")}
              color={wellnessSubmittedToday ? "green" : "primary"}
            />
          </div>
        )}

        {/* ── Próximo evento ────────────────────────── */}
        {nextSession ? (
          <button
            type="button"
            onClick={() => setLocation("/schedule")}
            className="mx-4 md:mx-0 mb-4 text-left rounded-xl border border-border bg-card p-4 hover:border-primary/50 transition-colors active:scale-[0.99]"
            data-testid="ucore-home-next-event"
          >
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span className="text-[9px] font-black tracking-[1.5px] uppercase text-primary">{t("home_next_event_label")}</span>
            </div>
            <p className="text-base font-black text-foreground tracking-tight leading-snug">{nextSession.title}</p>
            <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground font-semibold">
              {nextSessionTimeStr && (
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{nextSessionTimeStr}</span>
              )}
              {nextSession.location?.trim() && (
                <span className="flex items-center gap-1 truncate"><MapPin className="w-3 h-3 shrink-0" />{nextSession.location}</span>
              )}
            </div>
            {daysUntilNext !== null && (
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/60">
                <div>
                  <p className="text-sm font-black text-foreground">{daysUntilNext}</p>
                  <p className="text-[8px] uppercase tracking-[1px] text-muted-foreground">{t("home_event_days")}</p>
                </div>
                {mode === "staff" && homeSignals.kpis.pendingAttendanceCount > 0 && (
                  <div>
                    <p className="text-sm font-black text-foreground">{homeSignals.kpis.pendingAttendanceCount}</p>
                    <p className="text-[8px] uppercase tracking-[1px] text-muted-foreground">{t("home_event_pending")}</p>
                  </div>
                )}
                <div className="ml-auto">
                  <span className="text-[9px] font-bold text-emerald-500">● {t("home_event_ok")}</span>
                </div>
              </div>
            )}
          </button>
        ) : null}

        {/* ── Module grid 2×2 ──────────────────────── */}
        <div className="mx-4 md:mx-0 mb-4">
          <p className="text-[9px] font-black tracking-[2px] uppercase text-muted-foreground mb-3">{t("home_modules_label")}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {mode === "staff" ? (
              <>
                {/* Schedule & Wellness — one module, two tabs inside */}
                <ModCard
                  icon={<CalendarDays className="w-6 h-6" />}
                  title={t("ucore_card_schedule_title")}
                  subtitle={homeSignals.kpis.sessionsTodayCount > 0
                    ? t("home_sessions_today_count").replace("{count}", String(homeSignals.kpis.sessionsTodayCount))
                    : t("schedule_empty_next_sessions")}
                  badge={homeSignals.kpis.sessionsTodayCount > 0 ? t("home_badge_today") : undefined}
                  onClick={() => setLocation("/schedule")}
                  testId="ucore-home-card-schedule"
                />
                <ModCard
                  icon={<Target className="w-6 h-6" />}
                  title={t("ucore_card_scout_title")}
                  subtitle={t("ucore_card_scout_sub_staff")}
                  onClick={() => setLocation("/scout")}
                  testId="ucore-home-card-scout"
                />
                <ModCard
                  icon={<BarChart3 className="w-6 h-6" />}
                  title={t("ucore_card_stats_title")}
                  subtitle={t("ucore_card_stats_sub")}
                  onClick={() => setLocation("/stats")}
                  testId="ucore-home-card-stats"
                />
                {/* U Playbook — coming soon */}
                <ModCard
                  icon={<BookOpen className="w-6 h-6" />}
                  title="U Playbook"
                  subtitle={t("home_playbook_sub")}
                  comingSoon
                  onClick={() => {}}
                  testId="ucore-home-card-playbook"
                />
              </>
            ) : (
              <>
                <ModCard
                  icon={<CalendarDays className="w-6 h-6" />}
                  title={t("ucore_card_schedule_title")}
                  subtitle={nextSession ? nextSession.title : t("schedule_empty_next_sessions")}
                  onClick={() => setLocation("/schedule")}
                  testId="ucore-home-card-schedule"
                />
                <ModCard
                  icon={<Heart className="w-6 h-6" />}
                  title={t("home_wellness_today")}
                  subtitle={wellnessSubmittedToday ? t("schedule_wellness_submitted") : t("schedule_wellness_pending")}
                  onClick={() => setLocation("/player/wellness")}
                  testId="ucore-home-card-wellness"
                />
                <ModCard
                  icon={<Target className="w-6 h-6" />}
                  title={t("ucore_card_scout_title")}
                  subtitle={(newReportsCount ?? 0) > 0
                    ? t("ucore_slot_reports_count").replace("{count}", String(newReportsCount ?? 0))
                    : t("ucore_card_scout_sub_player")}
                  onClick={() => setLocation("/scout")}
                  testId="ucore-home-card-scout"
                />
                <ModCard
                  icon={<BarChart3 className="w-6 h-6" />}
                  title={t("ucore_card_stats_title")}
                  subtitle={t("ucore_card_stats_sub")}
                  onClick={() => setLocation("/stats")}
                  testId="ucore-home-card-stats"
                />
              </>
            )}
          </div>
        </div>

        {/* ── Mi Club — staff only, compact centered ── */}
        {mode === "staff" && (
          <div className="mx-4 md:mx-0 mt-3">
            <button
              type="button"
              onClick={() => setLocation("/coach/club")}
              data-testid="ucore-home-mi-club"
              className={cn(
                "w-full flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-card/60 px-4 py-3",
                "text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-card transition-colors",
              )}
            >
              <Building2 className="w-4 h-4" />
              <span>{t("ucore_nav_club")}</span>
              {showClubActivityDot && (
                <span className="w-2 h-2 rounded-full bg-destructive ml-1" />
              )}
            </button>
          </div>
        )}

        {/* ── User footer ──────────────────────────── */}
        <div className="mt-auto mx-5 md:mx-0 pt-4 pb-2 md:pb-4 border-t border-border/50 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-foreground">{displayName}</p>
            {roleLabel ? <p className="text-[10px] text-muted-foreground tracking-wide">{roleLabel}</p> : null}
          </div>
          <span className="text-[9px] font-bold text-muted-foreground/50 tracking-widest uppercase">U SCOUT</span>
        </div>

      </main>
      <ModuleNav />
    </div>
  );
}

