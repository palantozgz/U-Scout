import { useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useLocale } from "@/lib/i18n";
import { useAuth, type AppUserRole } from "@/lib/useAuth";
import { computeCapabilities, readCoachBadges, useCapabilities } from "@/lib/capabilities";
import { useQueryClient } from "@tanstack/react-query";
import { clubQueryKey, useClub } from "@/lib/club-api";
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

export type HomeMode = "staff" | "player";

const ROLE_LABEL_KEY: Record<AppUserRole, "role_master" | "role_head_coach" | "role_coach" | "role_player"> = {
  master: "role_master",
  head_coach: "role_head_coach",
  coach: "role_coach",
  player: "role_player",
};

export function useHomeData() {
  const { t, locale } = useLocale();
  const intlLocale = locale === "es" ? "es" : locale === "zh" ? "zh-CN" : "en";
  const [, setLocation] = useLocation();
  const caps = useCapabilities();
  const mode: HomeMode = caps.canUsePlayerUX ? "player" : "staff";
  const { profile, effectiveRole, previewRole } = useAuth();
  const queryClient = useQueryClient();

  // Background prefetch on mount
  useEffect(() => {
    void queryClient.prefetchQuery({
      queryKey: clubQueryKey,
      queryFn: async () => { const r = await apiRequest("GET", "/api/club"); return r.json(); },
      staleTime: 5 * 60 * 1000,
    });
    void import("@/lib/mock-data");
    void import("@/lib/motor-v4");
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
    () => computeCapabilities({
      realRole: profile?.role ?? null,
      effectiveRole: profile?.role ?? null,
      badges: readCoachBadges(profile ?? null),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile?.id, profile?.role],
  );

  const displayName = profile?.username?.trim() || profile?.email || t("coach_home_name_fallback");
  const firstName = (profile?.username?.trim() || profile?.email || "").split(" ")[0] || t("coach_home_name_fallback");
  const roleLabel = effectiveRole ? t(ROLE_LABEL_KEY[effectiveRole]) : "";

  // Club data — staff head_coach only
  const watchesClubActivity = mode === "staff" && realCaps.staffRole === "head_coach";
  const clubQuery = useClub({ enabled: watchesClubActivity });
  const clubData = clubQuery.data;
  const clubId = clubData?.club?.id;
  const userId = profile?.id;

  // Schedule queries
  const todaySessionsQ    = useTodayScheduleEvents({ clubId });
  const tomorrowSessionsQ = useTomorrowScheduleEvents({ clubId });
  const weekSessionsQ     = useThisWeekScheduleEvents({ clubId });

  const rosterPlayerUserIds = useMemo(() => {
    const members = clubData?.members ?? [];
    return members
      .filter((m) => m.role === "player" && m.status === "active")
      .map((m) => m.userId);
  }, [clubData?.members]);

  const todayParticipantsQ = useScheduleParticipantsForEvents({
    clubId,
    eventIds: todaySessionsQ.data?.map((s) => s.id) ?? [],
  });

  const wellnessPctQ         = useTodayWellnessSubmissionPct({ clubId, playerUserIds: rosterPlayerUserIds });
  const wellnessEntryQ       = useWellnessEntryToday({ clubId, userId });
  const wellnessSubmittedToday = Boolean(wellnessEntryQ.data);
  const wellnessDateKey        = todayKey();

  const showClubActivityDot = useMemo(() => {
    if (!clubData || clubQuery.isError || !profile?.id) return false;
    if (realCaps.staffRole !== "head_coach") return false;
    const cId = clubData.club?.id;
    if (!cId) return false;
    const prev = getStoredRosterSignature(profile.id, cId);
    if (prev === null) return false;
    return prev !== rosterSignature(clubData.members);
  }, [clubData, clubQuery.isError, profile?.id, realCaps.staffRole]);

  const homeSignals = useMemo(
    () => buildHomeSignals({
      todaySessions:          todaySessionsQ.data ?? [],
      tomorrowSessions:       tomorrowSessionsQ.data ?? [],
      weekSessions:           weekSessionsQ.data ?? [],
      todaySessionsIsSuccess: todaySessionsQ.isSuccess,
      rosterPlayerUserIds,
      todayParticipants:      todayParticipantsQ.data ?? [],
      wellnessPct:            wellnessPctQ.data?.pct ?? null,
      wellnessSubmittedToday,
      showClubChanges:        showClubActivityDot,
      staffRole:              realCaps.staffRole,
      isPhysicalTrainer:      realCaps.isPhysicalTrainer,
      canCreateSession:       realCaps.canCreateEvent,
      canManageWellness:      realCaps.canManageWellness,
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

  // Init roster signature once (head_coach only)
  useEffect(() => {
    if (!clubData || clubQuery.isError || !profile?.id) return;
    const cId = clubData.club?.id;
    if (!cId) return;
    const sig = rosterSignature(clubData.members);
    const prev = getStoredRosterSignature(profile.id, cId);
    if (prev === null) setStoredRosterSignature(profile.id, cId, sig);
  }, [clubData, clubQuery.isError, profile?.id]);

  // Player-specific data
  const playerTeamsQ = usePlayerTeams();

  const newReportsCount = useMemo(() => {
    if (mode !== "player") return null;
    const teams = playerTeamsQ.data?.teams ?? [];
    return teams.reduce((sum, r) => sum + (r.unseenCount ?? 0), 0);
  }, [mode, playerTeamsQ.data?.teams]);

  // Derived display values
  const dateStr = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(intlLocale, {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
      }).format(new Date());
    } catch {
      return "";
    }
  }, [intlLocale]);

  const nextSession = homeSignals.kpis.nextSession;

  const nextSessionTimeStr = useMemo(() => {
    if (!nextSession?.starts_at) return null;
    try {
      return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(
        new Date(nextSession.starts_at),
      );
    } catch {
      return nextSession.starts_at;
    }
  }, [nextSession?.starts_at]);

  const daysUntilNext = useMemo(() => {
    if (!nextSession?.starts_at) return null;
    const diff = Math.ceil((new Date(nextSession.starts_at).getTime() - Date.now()) / 86_400_000);
    return Math.max(0, diff);
  }, [nextSession?.starts_at]);

  const kpiPlayers      = rosterPlayerUserIds.length;
  const kpiWeekSessions = weekSessionsQ.data?.length ?? 0;
  const kpiWellnessPct  = wellnessPctQ.data?.pct ?? 0;

  // Week strip: Mon–Sun of current week
  const weekDays = useMemo(() => {
    const now = new Date();
    const dow = now.getDay(); // 0=Sun
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((dow + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  }, []);

  const sessionDateSet = useMemo(() => {
    const set = new Set<string>();
    (weekSessionsQ.data ?? []).forEach((s) => set.add(new Date(s.starts_at).toDateString()));
    return set;
  }, [weekSessionsQ.data]);

  const todayDateKey = new Date().toDateString();

  return {
    // i18n
    t,
    locale,
    intlLocale,
    // navigation
    setLocation,
    // mode
    mode,
    // auth
    profile,
    effectiveRole,
    previewRole,
    displayName,
    firstName,
    roleLabel,
    // capabilities
    realCaps,
    // club
    clubData,
    clubQuery,
    clubId,
    userId,
    // schedule queries (raw — for components that need loading states)
    todaySessionsQ,
    tomorrowSessionsQ,
    weekSessionsQ,
    // roster
    rosterPlayerUserIds,
    // participants
    todayParticipantsQ,
    // wellness
    wellnessPctQ,
    wellnessEntryQ,
    wellnessSubmittedToday,
    wellnessDateKey,
    showClubActivityDot,
    // computed signals
    homeSignals,
    // player
    playerTeamsQ,
    newReportsCount,
    // display values
    dateStr,
    nextSession,
    nextSessionTimeStr,
    daysUntilNext,
    kpiPlayers,
    kpiWeekSessions,
    kpiWellnessPct,
    // week strip
    weekDays,
    sessionDateSet,
    todayDateKey,
  };
}
