import { useEffect, useMemo, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useLocale } from "@/lib/i18n";
import { useAuth, type AppUserRole } from "@/lib/useAuth";
import { computeCapabilities, readCoachBadges, useCapabilities } from "@/lib/capabilities";
import { cn } from "@/lib/utils";
import { CalendarDays, BarChart3, Target, Heart, MapPin, Clock, BookOpen, Building2 } from "lucide-react";
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
    <div className="flex flex-col items-center justify-center px-2 md:px-3" style={{ minHeight: 64, paddingTop: 12, paddingBottom: 12 }}>
      <span data-scoreboard="" className={cn("text-2xl md:text-4xl font-black leading-none tabular-nums", colorClass)}>{value}</span>
      <span className="text-[9px] md:text-[11px] font-bold tracking-[1.5px] md:tracking-wide text-muted-foreground/80 uppercase mt-1.5">{label}</span>
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
        "group relative text-left rounded-xl border border-border bg-card p-3 md:p-6 flex flex-col gap-1 md:gap-3 h-full",
        "md:shadow-sm md:shadow-black/[0.04] md:ring-1 md:ring-border/50 dark:md:shadow-none dark:md:ring-border/40",
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
        <p className="text-sm md:text-base font-black text-foreground tracking-tight leading-tight">{props.title}</p>
        <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 md:mt-1 leading-snug line-clamp-2">{props.subtitle}</p>
      </div>
    </button>
  );
}

/** Chip de alerta contextual — aparece solo cuando hay algo que mostrar */
function HomeAlertChip({
  icon,
  label,
  sub,
  tone,
  onClick,
}: {
  icon: string;
  label: string;
  sub?: string;
  tone: "amber" | "emerald" | "blue" | "neutral";
  onClick?: () => void;
}) {
  const toneClass = {
    amber:   "border-amber-500/30 bg-amber-500/8",
    emerald: "border-emerald-500/30 bg-emerald-500/8",
    blue:    "border-blue-500/30 bg-blue-500/8",
    neutral: "border-border bg-card",
  }[tone];
  const textClass = {
    amber:   "text-amber-700 dark:text-amber-300",
    emerald: "text-emerald-700 dark:text-emerald-300",
    blue:    "text-blue-700 dark:text-blue-300",
    neutral: "text-foreground",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "flex-1 min-w-[220px] rounded-xl border px-3 py-2.5 text-left transition-colors",
        toneClass,
        onClick ? "active:scale-[0.99] hover:brightness-95" : "cursor-default",
      )}
    >
      <div className="flex items-start gap-2">
        <span className="text-base leading-none mt-0.5 shrink-0">{icon}</span>
        <div className="min-w-0">
          <p className={cn("text-[11px] md:text-xs font-black leading-snug tracking-tight", textClass)}>{label}</p>
          {sub && <p className="mt-0.5 text-[10px] md:text-xs font-semibold text-muted-foreground leading-snug">{sub}</p>}
        </div>
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
    <div className="flex flex-col h-[100dvh] bg-background text-foreground overflow-hidden">
      <main className="relative z-10 flex flex-col flex-1 w-full max-w-5xl mx-auto overflow-y-auto pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-10 md:pt-2 px-3 md:px-8 bg-background">

        {/* ── Brand header — visible siempre ── */}
        <ModuleHeader
          module="core"
          tagline={
            locale === "zh" ? "球队管理中心" :
            locale === "es" ? "Centro de gestión del equipo" :
            "Team management hub"
          }
          className="md:py-4"
        />

        {/* ── Greeting ── */}
        <div className="pb-2 md:pb-8 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] md:text-xs font-bold tracking-[2px] md:tracking-wide uppercase text-muted-foreground mb-1 truncate">
              {dateStr}
            </p>
            <h1 className="text-[24px] md:text-[42px] font-black tracking-tight leading-tight">
              {t("home_greeting_hi")}, <span className="text-primary">{firstName}</span> 👋
            </h1>
          </div>
        </div>

        {/* ── Smart alerts ── */}
        {mode === "staff" ? (() => {
          const ranking = homeSignals.smartActionsRanking;
          if (!ranking) return null;
          const items = [ranking.primary, ranking.secondary].filter(Boolean) as typeof ranking.primary[];
          const L = {
            attendance: locale === "zh"
              ? `${homeSignals.kpis.pendingAttendanceCount} 人未确认今日出勤`
              : locale === "es"
              ? `${homeSignals.kpis.pendingAttendanceCount} confirmaciones de asistencia pendientes`
              : `${homeSignals.kpis.pendingAttendanceCount} attendance responses pending today`,
            wellness: locale === "zh"
              ? `Wellness ${kpiWellnessPct}% · 部分队员未提交`
              : locale === "es"
              ? `Wellness al ${kpiWellnessPct}% — revisar antes del entreno`
              : `Team wellness at ${kpiWellnessPct}% — check before training`,
            createSession: locale === "zh"
              ? "今天没有安排训练 — 规划本周"
              : locale === "es"
              ? "Sin sesiones hoy — planifica la semana"
              : "No sessions today — plan the week",
            club: locale === "zh"
              ? "球队名单有变动"
              : locale === "es"
              ? "Cambios en la plantilla"
              : "Roster changes to review",
          };
          const cfg = {
            attendance: { icon: "⚠️", tone: "amber" as const, route: "/schedule" },
            wellness:   { icon: "🫀", tone: "amber" as const, route: "/schedule" },
            createSession: { icon: "📅", tone: "neutral" as const, route: "/schedule" },
            club:       { icon: "👥", tone: "blue" as const, route: "/coach/club" },
          };
          return (
            <div className="mb-3 md:mb-8 flex flex-wrap gap-2 md:gap-4">
              {items.map((action) => {
                const c = cfg[action.kind];
                return (
                  <HomeAlertChip
                    key={action.kind}
                    icon={c.icon}
                    label={L[action.kind]}
                    tone={c.tone}
                    onClick={() => setLocation(c.route)}
                  />
                );
              })}
            </div>
          );
        })() : (() => {
          const entry = wellnessEntryQ.data;
          const chips: ReactNode[] = [];

          if (!wellnessSubmittedToday) {
            const label = locale === "zh" ? "记得发送今日健康状态"
              : locale === "es" ? "Pendiente: envía tu wellness de hoy"
              : "Don't forget to log your wellness today";
            chips.push(
              <HomeAlertChip key="wellness-pending" icon="🫀" label={label} tone="amber"
                onClick={() => setLocation("/schedule")} />
            );
          } else if (entry) {
            const sleep = entry.sleep_quality;
            const readiness = entry.mental_readiness;
            const energy = entry.energy_level;
            let label: string;
            let sub: string | undefined;
            if (sleep <= 2) {
              label = locale === "zh" ? "今天睡眠不足 — 注意休息"
                : locale === "es" ? "Parece que el descanso está costando"
                : "Looks like rest has been tough lately";
              sub = locale === "zh" ? "睡眠好才能表现好 ✓"
                : locale === "es" ? "Wellness enviado · cuídate esta noche"
                : "Wellness logged · take care tonight";
            } else if (readiness >= 4 && energy >= 4) {
              label = locale === "zh" ? "今天感觉很好 💪"
                : locale === "es" ? "Te sientes bien hoy · sigue así"
                : "You're feeling strong today · keep it up";
              sub = locale === "zh" ? "健康状态已提交 ✓"
                : locale === "es" ? "Wellness enviado ✓"
                : "Wellness logged ✓";
            } else {
              label = locale === "zh" ? "健康状态已提交 ✓"
                : locale === "es" ? "Wellness de hoy enviado ✓"
                : "Today's wellness logged ✓";
            }
            chips.push(
              <HomeAlertChip key="wellness-done" icon="✅" label={label} sub={sub} tone="emerald" />
            );
          }

          if ((newReportsCount ?? 0) > 0) {
            const label = locale === "zh"
              ? `${newReportsCount} 份新球探报告`
              : locale === "es"
              ? `${newReportsCount} informe${(newReportsCount ?? 0) > 1 ? "s" : ""} nuevo${(newReportsCount ?? 0) > 1 ? "s" : ""} en Scout`
              : `${newReportsCount} new report${(newReportsCount ?? 0) > 1 ? "s" : ""} in Scout`;
            chips.push(
              <HomeAlertChip key="reports" icon="📋" label={label} tone="blue"
                onClick={() => setLocation("/scout")} />
            );
          }

          if (!chips.length) return null;
          return <div className="mb-3 md:mb-8 flex flex-wrap gap-2 md:gap-4">{chips}</div>;
        })()}

        {/* ── KPI bar — horizontal, siempre visible ── */}
        {mode === "staff" ? (
          <div className="mb-3 md:mb-8 grid grid-cols-3 divide-x divide-border rounded-xl border-2 border-primary/20 bg-card">
            <KpiCell value={kpiPlayers}           label={t("home_kpi_players")}   color="default" />
            <KpiCell value={kpiWeekSessions}      label={t("home_kpi_week")}       color="primary" />
            <KpiCell value={`${kpiWellnessPct}%`} label={t("home_kpi_wellness")}  color="green"   />
          </div>
        ) : (
          <div className="mb-3 md:mb-8 grid grid-cols-3 divide-x divide-border rounded-xl border-2 border-primary/20 bg-card">
            <KpiCell value={daysUntilNext ?? "—"} label={t("home_kpi_next_session")} color="default" />
            <KpiCell value={newReportsCount ?? 0} label={t("home_kpi_reports")}       color="primary" />
            <KpiCell
              value={wellnessSubmittedToday ? "✓" : "!"}
              label={t("home_kpi_wellness")}
              color={wellnessSubmittedToday ? "green" : "primary"}
            />
          </div>
        )}

        {/* ── Próximo evento ── */}
        {nextSession ? (
          <button
            type="button"
            onClick={() => setLocation("/schedule")}
            className="mb-6 md:mb-8 w-full text-left rounded-xl border border-border bg-card p-4 md:p-5 hover:border-primary/50 md:shadow-sm md:shadow-black/[0.04] md:ring-1 md:ring-border/40 dark:md:shadow-none dark:md:ring-border/35 transition-colors active:scale-[0.99]"
            data-testid="ucore-home-next-event"
          >
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span className="text-[9px] md:text-[11px] font-black tracking-[1.5px] uppercase text-primary">{t("home_next_event_label")}</span>
            </div>
            <p className="text-base md:text-lg font-black text-foreground tracking-tight leading-snug">{nextSession.title}</p>
            <div className="flex items-center gap-3 mt-2 text-[10px] md:text-xs text-muted-foreground font-semibold">
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
                  <p className="text-[8px] md:text-[10px] uppercase tracking-[1px] text-muted-foreground">{t("home_event_days")}</p>
                </div>
                {mode === "staff" && homeSignals.kpis.pendingAttendanceCount > 0 && (
                  <div>
                    <p className="text-sm font-black text-foreground">{homeSignals.kpis.pendingAttendanceCount}</p>
                    <p className="text-[8px] md:text-[10px] uppercase tracking-[1px] text-muted-foreground">{t("home_event_pending")}</p>
                  </div>
                )}
                <div className="ml-auto">
                  <span className="text-[9px] font-bold text-emerald-500">● {t("home_event_ok")}</span>
                </div>
              </div>
            )}
          </button>
        ) : null}

        {/* ── Module grid 2×2 — flex-1 ocupa el espacio disponible ── */}
        <div className="flex-1 min-h-0 flex flex-col md:mb-0 md:pb-2">
          <p className="text-[9px] md:text-[11px] font-black tracking-[2px] md:tracking-wide uppercase text-muted-foreground mb-2">{t("home_modules_label")}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 grid-rows-2 md:grid-rows-1 gap-2 md:gap-4 flex-1 min-h-0">
            {mode === "staff" ? (
              <>
                <ModCard
                  icon={<CalendarDays className="w-6 h-6 md:w-7 md:h-7" />}
                  title={t("ucore_card_schedule_title")}
                  subtitle={homeSignals.kpis.sessionsTodayCount > 0
                    ? t("home_sessions_today_count").replace("{count}", String(homeSignals.kpis.sessionsTodayCount))
                    : t("schedule_empty_next_sessions")}
                  badge={homeSignals.kpis.sessionsTodayCount > 0 ? t("home_badge_today") : undefined}
                  onClick={() => setLocation("/schedule")}
                  testId="ucore-home-card-schedule"
                />
                <ModCard
                  icon={<Target className="w-6 h-6 md:w-7 md:h-7" />}
                  title={t("ucore_card_scout_title")}
                  subtitle={t("ucore_card_scout_sub_staff")}
                  onClick={() => setLocation("/scout")}
                  testId="ucore-home-card-scout"
                />
                <ModCard
                  icon={<BarChart3 className="w-6 h-6 md:w-7 md:h-7" />}
                  title={t("ucore_card_stats_title")}
                  subtitle={t("ucore_card_stats_sub")}
                  onClick={() => setLocation("/stats")}
                  testId="ucore-home-card-stats"
                />
                <ModCard
                  icon={<BookOpen className="w-6 h-6 md:w-7 md:h-7" />}
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
                  icon={<CalendarDays className="w-6 h-6 md:w-7 md:h-7" />}
                  title={t("ucore_card_schedule_title")}
                  subtitle={nextSession ? nextSession.title : t("schedule_empty_next_sessions")}
                  onClick={() => setLocation("/schedule")}
                  testId="ucore-home-card-schedule"
                />
                <ModCard
                  icon={<Heart className="w-6 h-6 md:w-7 md:h-7" />}
                  title={t("home_wellness_today")}
                  subtitle={wellnessSubmittedToday ? t("schedule_wellness_submitted") : t("schedule_wellness_pending")}
                  onClick={() => setLocation("/player/wellness")}
                  testId="ucore-home-card-wellness"
                />
                <ModCard
                  icon={<Target className="w-6 h-6 md:w-7 md:h-7" />}
                  title={t("ucore_card_scout_title")}
                  subtitle={(newReportsCount ?? 0) > 0
                    ? t("ucore_slot_reports_count").replace("{count}", String(newReportsCount ?? 0))
                    : t("ucore_card_scout_sub_player")}
                  onClick={() => setLocation("/scout")}
                  testId="ucore-home-card-scout"
                />
                <ModCard
                  icon={<BarChart3 className="w-6 h-6 md:w-7 md:h-7" />}
                  title={t("ucore_card_stats_title")}
                  subtitle={t("ucore_card_stats_sub")}
                  onClick={() => setLocation("/stats")}
                  testId="ucore-home-card-stats"
                />
              </>
            )}
          </div>
        </div>

        {/* ── Mi Club — staff only ── */}
        {mode === "staff" && (
          <div className="mb-2">
            <button
              type="button"
              onClick={() => setLocation("/coach/club")}
              data-testid="ucore-home-mi-club"
              className={cn(
                "w-full flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-card/60 px-4 py-2.5 md:py-4",
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

        {/* ── User footer — solo desktop ── */}
        <div className="hidden md:flex pt-4 pb-2 md:pb-6 border-t border-border/50 items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-foreground">{displayName}</p>
            {roleLabel ? <p className="text-[10px] text-muted-foreground tracking-wide">{roleLabel}</p> : null}
          </div>
          <span className="text-[9px] font-bold text-muted-foreground/50 tracking-widest uppercase">U CORE</span>
        </div>

      </main>
      <ModuleNav />
    </div>
  );
}

