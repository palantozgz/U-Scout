import { useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useLocale } from "@/lib/i18n";
import { useAuth, type AppUserRole } from "@/lib/useAuth";
import { computeCapabilities, readCoachBadges, useCapabilities } from "@/lib/capabilities";
import { useQueryClient } from "@tanstack/react-query";
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
  CLUB_TIME_ZONE,
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
  const { profile, effectiveRole, previewRole } = useAuth();
  const queryClient = useQueryClient();

  // Club data — se pide SIEMPRE, para todos los roles (CORREGIDO 2026-09-25).
  // Antes: useClub({ enabled: watchesClubActivity }) donde watchesClubActivity
  // dependía de realCaps.staffRole, que a su vez necesitaba la membresía real
  // del club para no depender del metadato de auth (profile.role)
  // desincronizable -- dependencia circular real: para decidir si pedir el
  // club hacía falta saber si era head_coach, y para saberlo de forma fiable
  // hacía falta el club. Mismo patrón ya aplicado en GamePlan.tsx (commit
  // 7a44bcf): se quita el gate, se deriva la membresía real de members, y
  // capabilities la consume. El coste de red no es nuevo -- el prefetch que
  // había aquí antes ya llamaba a /api/club en cada mount de Home para TODOS
  // los roles (staff y jugadora), solo que escribía en una query key
  // (clubQueryKey a secas) distinta de la que useClub() lee
  // ([...clubQueryKey, userId]) -- el mismo mismatch que ya advertía el
  // comentario de cabecera de club-api.ts -- así que esa llamada de red no
  // beneficiaba a nadie. Se elimina el prefetch duplicado.
  const clubQuery = useClub();
  const clubData = clubQuery.data;
  const clubId = clubData?.club?.id;
  const userId = profile?.id;

  const myMembership = useMemo(() => {
    const members = clubData?.members ?? [];
    const mine = members.find((m) => m.userId === profile?.id);
    if (!mine) return null;
    return {
      clubId: mine.clubId,
      userId: mine.userId,
      role: mine.role as "head_coach" | "coach" | "player",
      status: mine.status as "active" | "pending" | "banned",
      operationsAccess: Boolean((mine as any).operationsAccess),
    };
  }, [clubData?.members, profile?.id]);

  const caps = useCapabilities({ membership: myMembership });
  const mode: HomeMode = caps.canUsePlayerUX ? "player" : "staff";

  // Background prefetch on mount — scope heavy imports to staff only
  useEffect(() => {
    if (mode === "staff") {
      void import("@/lib/mock-data");
      // CORREGIDO 2026-09-14 (limpieza de arqueología, sección 24/25 de
      // motor-1.0-spec.md): motor-v4 ya no tiene ningún importador real de
      // producción desde PR-B (spec 23.8) -- este prefetch cargaba un
      // módulo que nadie monta, puro peso muerto en el bundle del cliente.
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
    }
  }, [queryClient, mode]);

  const realCaps = useMemo(
    () => computeCapabilities({
      realRole: profile?.role ?? null,
      effectiveRole: profile?.role ?? null,
      membership: myMembership,
      badges: readCoachBadges(profile ?? null),
    }),
    [profile?.id, profile?.role, myMembership],
  );

  const displayName = profile?.username?.trim() || profile?.email || t("coach_home_name_fallback");
  const rawName = profile?.username?.trim() || profile?.email || "";
  const firstName = (rawName.includes("@")
    ? rawName.split("@")[0]
    : rawName.split(" ")[0]
  ) || t("coach_home_name_fallback");
  const roleLabel = effectiveRole ? t(ROLE_LABEL_KEY[effectiveRole]) : "";

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
      return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", timeZone: CLUB_TIME_ZONE }).format(
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
