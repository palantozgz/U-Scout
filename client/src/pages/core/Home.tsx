import { useEffect, useMemo, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useLocale } from "@/lib/i18n";
import { useAuth, type AppUserRole } from "@/lib/useAuth";
import { computeCapabilities, readCoachBadges, useCapabilities } from "@/lib/capabilities";
import { cn } from "@/lib/utils";
import { CalendarDays, BarChart3, Users, Target, BellDot, Activity, ClipboardList, Heart, MapPin, Clock, BookOpen, Building2 } from "lucide-react";
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
import { ModuleHeader } from "@/components/branding/ModuleHeader";

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
  const { t, locale } = useLocale();
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

        {/* ── Brand header — mismo componente que el resto de módulos ── */}
        <ModuleHeader
          module="core"
          tagline={
            locale === "zh" ? "球队管理中心" :
            locale === "es" ? "Centro de gestión del equipo" :
            "Team management hub"
          }
        />

        {/* ── Greeting ──────────────────────────────── */}
        <div className="px-5 md:px-0 pb-4">
          <p className="text-[10px] font-bold tracking-[2px] uppercase text-muted-foreground mb-1 truncate">
            {dateStr}
          </p>
          <h1 className="text-[26px] font-black tracking-tight leading-tight">
            {t("home_greeting_hi")}, <span className="text-primary">{firstName}</span> 👋
          </h1>
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

