import { describe, expect, test } from "vitest";
import { buildHomeSignals, computeNextSession, computePendingAttendanceCount } from "./homeSignals";
import type { ScheduleEvent, ScheduleParticipant } from "./schedule";

function mkSession(partial: Partial<ScheduleEvent> & { id: string; starts_at: string }): ScheduleEvent {
  return {
    id: partial.id,
    club_id: partial.club_id ?? "club-1",
    session_type: partial.session_type ?? "training",
    title: partial.title ?? partial.id,
    starts_at: partial.starts_at,
    ends_at: partial.ends_at ?? null,
    location: partial.location ?? null,
    notes: partial.notes ?? null,
    attendance_required: partial.attendance_required ?? true,
    created_by: partial.created_by ?? "u-1",
    created_at: partial.created_at ?? new Date(0).toISOString(),
  };
}

function mkParticipant(partial: Partial<ScheduleParticipant> & { event_id: string; user_id: string }): ScheduleParticipant {
  return {
    id: partial.id ?? `p-${partial.user_id}-${partial.event_id}`,
    club_id: partial.club_id ?? "club-1",
    event_id: partial.event_id,
    user_id: partial.user_id,
    status: partial.status ?? "confirmed",
    responded_at: partial.responded_at ?? new Date(0).toISOString(),
  };
}

describe("homeSignals helpers", () => {
  test("computeNextSession picks earliest upcoming across today/tomorrow/week", () => {
    const now = new Date("2026-01-01T10:00:00.000Z").getTime();
    const today = [mkSession({ id: "t1", starts_at: "2026-01-01T09:00:00.000Z" })]; // past
    const tomorrow = [mkSession({ id: "tm1", starts_at: "2026-01-02T08:00:00.000Z" })];
    const week = [
      mkSession({ id: "w1", starts_at: "2026-01-03T08:00:00.000Z" }),
      mkSession({ id: "w0", starts_at: "2026-01-01T11:00:00.000Z" }), // soonest
    ];

    const next = computeNextSession({ today, tomorrow, week, nowMs: now });
    expect(next?.id).toBe("w0");
  });

  test("computePendingAttendanceCount returns 0 when no sessions require attendance", () => {
    expect(
      computePendingAttendanceCount({
        rosterPlayerUserIds: ["p1", "p2"],
        todaySessions: [mkSession({ id: "s1", starts_at: "2026-01-01T12:00:00.000Z", attendance_required: false })],
        todayParticipants: [],
      }),
    ).toBe(0);
  });

  test("computePendingAttendanceCount is roster-wide unique users responded", () => {
    // 3 roster players, 2 responded (even if multiple rows exist)
    const roster = ["p1", "p2", "p3"];
    const todaySessions = [mkSession({ id: "s1", starts_at: "2026-01-01T12:00:00.000Z", attendance_required: true })];
    const todayParticipants = [
      mkParticipant({ event_id: "s1", user_id: "p1", status: "confirmed" }),
      mkParticipant({ event_id: "s1", user_id: "p2", status: "declined" }),
      mkParticipant({ event_id: "s1", user_id: "p2", status: "maybe" }), // duplicated user shouldn't change unique
    ];
    expect(computePendingAttendanceCount({ rosterPlayerUserIds: roster, todaySessions, todayParticipants })).toBe(1);
  });
});

describe("buildHomeSignals (integration)", () => {
  test("head_coach priority includes wellness below createSession and above club", () => {
    const res = buildHomeSignals({
      todaySessions: [],
      tomorrowSessions: [],
      weekSessions: [],
      todaySessionsIsSuccess: true,
      rosterPlayerUserIds: ["p1", "p2", "p3", "p4", "p5"],
      todayParticipants: [],
      wellnessPct: 62,
      wellnessSubmittedToday: false,
      showClubChanges: true,
      staffRole: "head_coach",
      isPhysicalTrainer: false,
      canCreateSession: true,
      canManageWellness: true,
    });

    // no sessions today -> createSession is highest trigger
    expect(res.smartActionsRanking?.primary.kind).toBe("createSession");
    // secondary should be wellness (since <80), not club
    expect(res.smartActionsRanking?.secondary?.kind).toBe("wellness");
  });

  test("coach+physical_trainer prioritizes wellness over attendance", () => {
    const res = buildHomeSignals({
      todaySessions: [mkSession({ id: "s1", starts_at: "2026-01-01T12:00:00.000Z" })],
      tomorrowSessions: [],
      weekSessions: [],
      todaySessionsIsSuccess: true,
      rosterPlayerUserIds: ["p1", "p2", "p3"],
      todayParticipants: [mkParticipant({ event_id: "s1", user_id: "p1" })],
      wellnessPct: 79,
      wellnessSubmittedToday: false,
      showClubChanges: true,
      staffRole: "coach",
      isPhysicalTrainer: true,
      canCreateSession: true,
      canManageWellness: true,
    });

    expect(res.kpis.pendingAttendanceCount).toBe(2);
    expect(res.smartActionsRanking?.primary.kind).toBe("wellness");
    expect(res.smartActionsRanking?.secondary?.kind).toBe("attendance");
  });

  test("normal coach ignores wellness and club in ranking", () => {
    const res = buildHomeSignals({
      todaySessions: [],
      tomorrowSessions: [],
      weekSessions: [],
      todaySessionsIsSuccess: true,
      rosterPlayerUserIds: ["p1", "p2"],
      todayParticipants: [],
      wellnessPct: 10,
      wellnessSubmittedToday: false,
      showClubChanges: true,
      staffRole: "coach",
      isPhysicalTrainer: false,
      canCreateSession: true,
      canManageWellness: true,
    });

    expect(res.smartActionsRanking?.primary.kind).toBe("createSession");
    expect(res.smartActionsRanking?.secondary).toBeNull();
  });

  test("wellness CTA suppressed when roster missing or pct >= 80", () => {
    const noRoster = buildHomeSignals({
      todaySessions: [],
      tomorrowSessions: [],
      weekSessions: [],
      todaySessionsIsSuccess: true,
      rosterPlayerUserIds: [],
      todayParticipants: [],
      wellnessPct: 10,
      wellnessSubmittedToday: false,
      showClubChanges: true,
      staffRole: "head_coach",
      isPhysicalTrainer: false,
      canCreateSession: false,
      canManageWellness: true,
    });
    expect(noRoster.smartActionsRanking?.primary.kind).toBe("club");

    const okPct = buildHomeSignals({
      todaySessions: [],
      tomorrowSessions: [],
      weekSessions: [],
      todaySessionsIsSuccess: true,
      rosterPlayerUserIds: ["p1"],
      todayParticipants: [],
      wellnessPct: 80,
      wellnessSubmittedToday: false,
      showClubChanges: true,
      staffRole: "head_coach",
      isPhysicalTrainer: false,
      canCreateSession: false,
      canManageWellness: true,
    });
    expect(okPct.smartActionsRanking?.primary.kind).toBe("club");
  });
});

