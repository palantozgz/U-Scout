import { useEffect, useMemo, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useLocale } from "@/lib/i18n";
import { useAuth, type AppUserRole } from "@/lib/useAuth";
import { computeCapabilities, readCoachBadges, useCapabilities } from "@/lib/capabilities";
import { cn } from "@/lib/utils";
import { ChevronRight, CalendarDays, BarChart3, Users, ClipboardList, BellDot, Activity } from "lucide-react";
import { useClub } from "@/lib/club-api";
import { getStoredRosterSignature, rosterSignature, setStoredRosterSignature } from "@/lib/clubRosterSeen";
import { usePlayerTeams } from "@/lib/player-home";
import { ModuleHeader } from "@/components/branding/ModuleHeader";
import {
  useScheduleParticipantsForEvents,
  useThisWeekScheduleEvents,
  useTodayScheduleEvents,
  useTomorrowScheduleEvents,
  useTodayWellnessSubmissionPct,
} from "@/lib/schedule";
import { useWellnessEntryToday, todayKey } from "@/lib/wellness";
import { buildHomeSignals } from "@/lib/homeSignals";

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

function HomeCard(props: {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  onClick: () => void;
  showDot?: boolean;
  testId?: string;
  className?: string;
}) {
  const { title, subtitle, icon, onClick, showDot, testId, className } = props;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        // Match legacy U Scout card material (beige card, crisp border, primary accent on hover)
        "group w-full text-left rounded-lg border border-border bg-card p-4 flex items-stretch gap-4",
        "transition-all duration-200 hover:border-primary hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.35)]",
        "active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/10",
        className,
      )}
      data-testid={testId}
    >
      <div className="relative flex items-center justify-center w-14 shrink-0 text-primary">
        {icon}
        {showDot ? (
          <span
            className="absolute top-0 right-0 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-card"
            aria-hidden
          />
        ) : null}
      </div>
      <div className="flex-1 min-w-0 py-0.5">
        <p className="text-lg font-black text-foreground tracking-tight uppercase">{title}</p>
        {subtitle ? (
          <p className="text-xs text-muted-foreground mt-1 font-medium">{subtitle}</p>
        ) : null}
      </div>
      <div className="flex items-center pr-1 text-muted-foreground group-hover:text-primary transition-transform duration-200 group-hover:translate-x-1">
        <ChevronRight className="w-6 h-6" />
      </div>
    </button>
  );
}

type SmartSlot = {
  key: string;
  title: string;
  subtitle?: string;
  icon: ReactNode;
  href: string;
  tone: "neutral" | "amber" | "blue" | "emerald";
};

function SmartSlots(props: { slots: SmartSlot[]; onNavigate: (href: string) => void }) {
  const toneClass = (tone: SmartSlot["tone"]) => {
    // Home should share the same neutral "card" material as U Scout.
    // Keep the slot semantics via icons/text, not via colored backgrounds.
    if (tone === "amber") return "border-border bg-card hover:border-primary/40";
    if (tone === "blue") return "border-border bg-card hover:border-primary/40";
    if (tone === "emerald") return "border-border bg-card hover:border-primary/40";
    return "border-border bg-card hover:border-primary/40";
  };

  const iconTone = (tone: SmartSlot["tone"]) => {
    // Use primary accent similar to U Scout icon style.
    if (tone === "neutral") return "text-muted-foreground";
    return "text-primary";
  };

  return (
    <div className="grid grid-cols-3 gap-2 min-h-[4.25rem]">
      {props.slots.map((s) => (
        <button
          key={s.key}
          type="button"
          onClick={() => props.onNavigate(s.href)}
          className={cn(
            "rounded-xl border px-2.5 py-2 text-left transition-colors select-none",
            "active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/10",
            toneClass(s.tone),
          )}
          data-testid={`ucore-slot-${s.key}`}
        >
          <div className="flex items-start gap-2">
            <span
              className={cn(
                "mt-0.5 shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-background/40",
                iconTone(s.tone),
              )}
            >
              {s.icon}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-black leading-snug tracking-tight text-foreground line-clamp-2">{s.title}</p>
              {s.subtitle ? (
                <p className="mt-0.5 text-[10px] font-semibold leading-snug text-muted-foreground line-clamp-2">{s.subtitle}</p>
              ) : null}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

export default function Home() {
  const { t } = useLocale();
  const [, setLocation] = useLocation();
  const mode = useHomeMode();
  const { profile, effectiveRole, previewRole } = useAuth();
  const caps = useCapabilities();
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

  const clubId = clubData?.club.id;
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
    const prev = getStoredRosterSignature(profile.id, clubData.club.id);
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
    const clubId = clubData.club.id;
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

  const smartSlots = useMemo((): SmartSlot[] => {
    const scheduleSubtitle = (() => {
      if (!homeSignals.kpis.nextSession) return t("schedule_empty_next_sessions");
      try {
        const time = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(
          new Date(homeSignals.kpis.nextSession.starts_at),
        );
        return `${time}${homeSignals.kpis.nextSession.location ? ` · ${homeSignals.kpis.nextSession.location}` : ""}`;
      } catch {
        return homeSignals.kpis.nextSession.starts_at;
      }
    })();

    const scheduleSlot: SmartSlot = {
      key: "schedule",
      title: mode === "player" ? t("home_next_session") : t("home_sessions_today"),
      subtitle:
        mode === "player"
          ? scheduleSubtitle
          : todaySessionsQ.isLoading
            ? t("schedule_loading_today")
            : t("home_sessions_today_count").replace("{count}", String(homeSignals.kpis.sessionsTodayCount)),
      icon: <CalendarDays className="h-3.5 w-3.5" />,
      href: "/schedule",
      tone: "neutral",
    };

    if (mode === "player") {
      const pendingCount = playerPending ?? 0;
      const reportsCount = newReportsCount ?? 0;

      const wellnessSlot: SmartSlot = {
        key: "wellness",
        title: t("home_wellness_today"),
        subtitle: wellnessSubmittedToday ? t("schedule_wellness_submitted") : t("schedule_wellness_pending"),
        icon: <Activity className="h-3.5 w-3.5" />,
        href: "/schedule",
        tone: wellnessSubmittedToday ? "emerald" : "amber",
      };

      const distinctNewReports = reportsCount > 0 && reportsCount !== pendingCount;

      const reportsSlot: SmartSlot = distinctNewReports
        ? {
            key: "reports",
            title: t("ucore_slot_reports_count").replace("{count}", String(reportsCount)),
            subtitle: undefined,
            icon: <BellDot className="h-3.5 w-3.5" />,
            href: "/scout",
            tone: "blue",
          }
        : pendingCount > 0
          ? {
              key: "scout",
              title: t("ucore_card_scout_title"),
              subtitle: t("ucore_card_scout_sub_player"),
              icon: <ClipboardList className="h-3.5 w-3.5" />,
              href: "/scout",
              tone: "neutral",
            }
          : {
              key: "updates",
              title: t("ucore_slot_no_updates"),
              subtitle: undefined,
              icon: <BellDot className="h-3.5 w-3.5" />,
              href: "/scout",
              tone: "emerald",
            };

      return [scheduleSlot, wellnessSlot, reportsSlot];
    }

    const attendanceSlot: SmartSlot = {
      key: "attendance",
      title: t("home_pending_attendance"),
      subtitle:
        todaySessionsQ.isLoading || todayParticipantsQ.isLoading ? t("schedule_placeholder_kpi") : String(homeSignals.kpis.pendingAttendanceCount),
      icon: <Activity className="h-3.5 w-3.5" />,
      href: "/schedule",
      tone: homeSignals.kpis.pendingAttendanceCount > 0 ? "amber" : "emerald",
    };

    const wellnessSlot: SmartSlot = {
      key: "wellness",
      title: t("home_wellness_submitted"),
      subtitle: wellnessPctQ.isLoading
        ? t("schedule_placeholder_kpi")
        : t("home_wellness_submitted_pct")
            .replace("{pct}", String(wellnessPctQ.data?.pct ?? 0))
            .replace("{submitted}", String(wellnessPctQ.data?.submitted ?? 0))
            .replace("{total}", String(wellnessPctQ.data?.total ?? 0)),
      icon: <BellDot className="h-3.5 w-3.5" />,
      href: "/schedule",
      tone: (wellnessPctQ.data?.pct ?? 0) >= 80 ? "emerald" : "blue",
    };

    return [scheduleSlot, attendanceSlot, wellnessSlot];
  }, [
    mode,
    newReportsCount,
    homeSignals.kpis.nextSession,
    homeSignals.kpis.pendingAttendanceCount,
    playerPending,
    t,
    todayParticipantsQ.isLoading,
    todaySessionsQ.data?.length,
    todaySessionsQ.isLoading,
    wellnessPctQ.data,
    wellnessPctQ.isLoading,
    wellnessSubmittedToday,
  ]);

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background text-foreground overflow-hidden">
      <main className="relative z-10 flex flex-col flex-1 px-4 pt-6 pb-4 max-w-md mx-auto w-full">
        <ModuleHeader module="core" tagline={t("tagline_core")} />

        <div className="mt-3.5">
          <SmartSlots slots={smartSlots} onNavigate={setLocation} />
        </div>

        <div
          className={cn(
            "mt-4 h-px w-full max-w-[280px] mx-auto bg-border",
            // Player mode felt top-heavy: give a touch more air before cards.
            mode === "player" ? "mb-5" : "mb-3.5",
          )}
        />

        <div className="flex flex-col gap-3 flex-1">
          {mode === "staff" ? (
            <>
              {(() => {
                const res = homeSignals.smartActionsRanking;
                if (!res) return null;
                const primary = res.primary;
                const secondary = res.secondary;
                const wellnessPct = homeSignals.kpis.wellnessPct;

                return (
                  <div className="rounded-lg border border-border bg-card p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] font-black tracking-widest uppercase text-muted-foreground">
                        {t("home_priorities_today")}
                      </p>
                      {secondary ? (
                        <button
                          type="button"
                          className="text-[11px] font-bold text-primary hover:underline"
                          onClick={() => {
                            if (secondary.kind === "club") setLocation("/coach/club");
                            else setLocation("/schedule");
                          }}
                          data-testid={`ucore-home-action-secondary-${secondary.kind}`}
                        >
                          {secondary.kind === "attendance"
                            ? t("home_action_review_attendance")
                            : secondary.kind === "createSession"
                              ? t("home_action_create_session")
                              : secondary.kind === "wellness"
                                ? t("home_action_review_wellness")
                                : t("home_action_review_club")}
                        </button>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      onClick={() => setLocation(primary.kind === "club" ? "/coach/club" : "/schedule")}
                      className={cn(
                        "mt-2 w-full rounded-lg border border-border bg-background/40 p-3 text-left",
                        "transition-all duration-200 hover:border-primary hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.25)]",
                        "active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/10",
                      )}
                      data-testid={`ucore-home-action-primary-${primary.kind}`}
                    >
                      <div className="flex items-center gap-2 text-primary">
                        {primary.kind === "club" ? <Users className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
                        <p className="text-sm font-black tracking-tight text-foreground">
                          {primary.kind === "attendance"
                            ? t("home_action_review_attendance")
                            : primary.kind === "createSession"
                              ? t("home_action_create_session")
                              : primary.kind === "wellness"
                                ? t("home_action_review_wellness")
                                : t("home_action_review_club")}
                        </p>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground font-medium">
                        {primary.kind === "attendance"
                            ? t("home_action_pending_count").replace("{count}", String(homeSignals.kpis.pendingAttendanceCount))
                          : primary.kind === "createSession"
                            ? t("home_action_create_session_sub")
                            : primary.kind === "wellness"
                              ? t("home_action_low_wellness_sub").replace("{pct}", String(wellnessPct ?? 0))
                            : t("home_action_review_club_sub")}
                      </p>
                    </button>
                  </div>
                );
              })()}
              <HomeCard
                title={t("ucore_card_scout_title")}
                subtitle={t("ucore_card_scout_sub_staff")}
                icon={<ClipboardList className="w-9 h-9" strokeWidth={2} />}
                onClick={() => setLocation("/scout")}
                testId="ucore-home-card-scout"
              />
              <HomeCard
                title={t("ucore_card_schedule_title")}
                subtitle={
                  homeSignals.kpis.nextSession
                    ? t("home_next_session_sub")
                        .replace(
                          "{time}",
                          new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(
                            new Date(homeSignals.kpis.nextSession.starts_at),
                          ),
                        )
                        .replace("{title}", homeSignals.kpis.nextSession.title)
                    : t("schedule_empty_next_sessions")
                }
                icon={<CalendarDays className="w-9 h-9" strokeWidth={2} />}
                onClick={() => setLocation("/schedule")}
                testId="ucore-home-card-schedule"
              />
              <HomeCard
                title={t("ucore_card_stats_title")}
                subtitle={t("ucore_card_stats_sub")}
                icon={<BarChart3 className="w-9 h-9" strokeWidth={2} />}
                onClick={() => setLocation("/stats")}
                testId="ucore-home-card-stats"
              />
              <HomeCard
                title={t("menu_team")}
                subtitle={t("menu_team_sub")}
                icon={<Users className="w-9 h-9" strokeWidth={2} />}
                onClick={() => setLocation("/coach/club")}
                showDot={showClubActivityDot}
                testId="ucore-home-card-club"
              />
            </>
          ) : (
            <>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-[10px] font-black tracking-widest uppercase text-muted-foreground">{t("home_next_session")}</p>
                <p className="mt-2 text-sm font-extrabold text-foreground">
                  {todaySessionsQ.isLoading || tomorrowSessionsQ.isLoading || weekSessionsQ.isLoading
                    ? t("schedule_loading_today")
                    : homeSignals.kpis.nextSession
                      ? homeSignals.kpis.nextSession.title
                      : t("schedule_empty_next_sessions")}
                </p>
                {homeSignals.kpis.nextSession?.starts_at ? (
                  <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
                    {t("schedule_player_time")}:{" "}
                    {new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(
                      new Date(homeSignals.kpis.nextSession.starts_at),
                    )}
                    {" · "}
                    {t("schedule_player_location")}:{" "}
                    {homeSignals.kpis.nextSession.location?.trim()
                      ? homeSignals.kpis.nextSession.location
                      : t("schedule_location_tbd")}
                  </p>
                ) : null}
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="inline-flex items-center rounded-full border border-border bg-background/40 px-2.5 py-1 text-[11px] font-bold text-foreground">
                    {t("home_wellness_today")}:{" "}
                    {wellnessSubmittedToday ? t("schedule_wellness_submitted") : t("schedule_wellness_pending")}
                  </span>
                  <button
                    type="button"
                    className="text-xs font-bold text-primary hover:underline"
                    onClick={() => setLocation("/schedule")}
                    data-testid="ucore-home-go-schedule"
                  >
                    {t("home_open_schedule")}
                  </button>
                </div>
              </div>
              <HomeCard
                title={t("ucore_card_schedule_title")}
                subtitle={t("home_go_schedule_sub").replace("{date}", wellnessDateKey)}
                icon={<CalendarDays className="w-9 h-9" strokeWidth={2} />}
                onClick={() => setLocation("/schedule")}
                testId="ucore-home-card-schedule"
                className="py-5"
              />
              <HomeCard
                title={t("ucore_card_scout_title")}
                subtitle={
                  (newReportsCount ?? 0) > 0
                    ? t("ucore_slot_reports_count").replace("{count}", String(newReportsCount ?? 0))
                    : t("ucore_card_scout_sub_player")
                }
                icon={<ClipboardList className="w-9 h-9" strokeWidth={2} />}
                onClick={() => setLocation("/scout")}
                testId="ucore-home-card-scout"
                className="py-5"
              />
              <HomeCard
                title={t("ucore_card_stats_title")}
                subtitle={t("ucore_card_stats_sub")}
                icon={<BarChart3 className="w-9 h-9" strokeWidth={2} />}
                onClick={() => setLocation("/stats")}
                testId="ucore-home-card-stats"
                className="py-5"
              />
            </>
          )}
        </div>

        <div
          className={cn(
            "mt-auto text-center border-t border-border/70",
            mode === "player" ? "pt-7 pb-3" : "pt-6 pb-2",
          )}
        >
          <p className="text-sm font-semibold text-foreground">{displayName}</p>
          {roleLabel ? <p className="text-[11px] text-muted-foreground mt-0.5 tracking-wide">{roleLabel}</p> : null}
        </div>
      </main>
    </div>
  );
}

