import type { ScheduleEvent, ScheduleParticipant } from "@/lib/schedule";
import type { StaffRole } from "@/lib/homeSmartActions";
import { computeHomeSmartActions, type ComputeHomeSmartActionsResult } from "@/lib/homeSmartActions";

export type HomeKpiSignals = {
  nextSession: ScheduleEvent | null;
  sessionsTodayCount: number;
  pendingAttendanceCount: number;
  wellnessPct: number | null;
  wellnessSubmittedToday: boolean;
  noSessionsToday: boolean;
};

export type HomeSmartActionsInput = {
  staffRole: StaffRole;
  isPhysicalTrainer: boolean;
  canCreateSession: boolean;
  canManageWellness: boolean;
  pendingAttendanceCount: number;
  noSessionsToday: boolean;
  showClubChanges: boolean;
  rosterCount: number;
  wellnessPct: number | null;
};

export type HomeSignals = {
  kpis: HomeKpiSignals;
  smartActionsInput: HomeSmartActionsInput;
  smartActionsRanking: ComputeHomeSmartActionsResult;
};

export function computeNextSession(params: {
  today: ScheduleEvent[];
  tomorrow: ScheduleEvent[];
  week: ScheduleEvent[];
  nowMs?: number;
}): ScheduleEvent | null {
  const now = params.nowMs ?? Date.now();
  const all = [...params.today, ...params.tomorrow, ...params.week];
  const upcoming = all
    .filter((s) => new Date(s.starts_at).getTime() >= now)
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  return upcoming[0] ?? null;
}

/**
 * MVP: roster-wide pending count for today's sessions that require attendance.
 * (Not per-session; avoids heavy aggregation until we add a dedicated endpoint.)
 */
export function computePendingAttendanceCount(params: {
  rosterPlayerUserIds: string[];
  todaySessions: ScheduleEvent[];
  todayParticipants: ScheduleParticipant[];
}): number {
  const sessionsRequiring = (params.todaySessions ?? []).filter((s) => s.attendance_required !== false);
  if (sessionsRequiring.length === 0) return 0;
  const totalRoster = params.rosterPlayerUserIds.length;
  if (totalRoster === 0) return 0;
  const respondedUserIds = new Set((params.todayParticipants ?? []).map((p) => p.user_id));
  const responded = Math.min(totalRoster, respondedUserIds.size);
  return Math.max(0, totalRoster - responded);
}

export function buildHomeSignals(params: {
  // Inputs derived from data/hooks (Home.tsx should own fetching only)
  todaySessions: ScheduleEvent[];
  tomorrowSessions: ScheduleEvent[];
  weekSessions: ScheduleEvent[];
  todaySessionsIsSuccess: boolean;
  rosterPlayerUserIds: string[];
  todayParticipants: ScheduleParticipant[];
  wellnessPct: number | null;
  wellnessSubmittedToday: boolean;
  showClubChanges: boolean;

  // Capabilities (real-role based)
  staffRole: StaffRole;
  isPhysicalTrainer: boolean;
  canCreateSession: boolean;
  canManageWellness: boolean;
}): HomeSignals {
  const nextSession = computeNextSession({
    today: params.todaySessions ?? [],
    tomorrow: params.tomorrowSessions ?? [],
    week: params.weekSessions ?? [],
  });

  const sessionsTodayCount = (params.todaySessions ?? []).length;
  const noSessionsToday = sessionsTodayCount === 0 && params.todaySessionsIsSuccess;

  const pendingAttendanceCount = computePendingAttendanceCount({
    rosterPlayerUserIds: params.rosterPlayerUserIds ?? [],
    todaySessions: params.todaySessions ?? [],
    todayParticipants: params.todayParticipants ?? [],
  });

  const smartActionsInput: HomeSmartActionsInput = {
    staffRole: params.staffRole,
    isPhysicalTrainer: params.isPhysicalTrainer,
    canCreateSession: params.canCreateSession,
    canManageWellness: params.canManageWellness,
    pendingAttendanceCount,
    noSessionsToday,
    showClubChanges: params.showClubChanges,
    rosterCount: params.rosterPlayerUserIds.length,
    wellnessPct: params.wellnessPct,
  };

  return {
    kpis: {
      nextSession,
      sessionsTodayCount,
      pendingAttendanceCount,
      wellnessPct: params.wellnessPct,
      wellnessSubmittedToday: params.wellnessSubmittedToday,
      noSessionsToday,
    },
    smartActionsInput,
    smartActionsRanking: computeHomeSmartActions(smartActionsInput),
  };
}

