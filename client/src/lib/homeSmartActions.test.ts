import { describe, expect, test } from "vitest";
import { computeHomeSmartActions } from "./homeSmartActions";

describe("computeHomeSmartActions", () => {
  test("returns null when no triggers", () => {
    expect(
      computeHomeSmartActions({
        staffRole: "head_coach",
        isPhysicalTrainer: false,
        canCreateSession: true,
        canManageWellness: true,
        pendingAttendanceCount: 0,
        noSessionsToday: false,
        showClubChanges: false,
        rosterCount: 10,
        wellnessPct: 100,
      }),
    ).toBeNull();
  });

  test("head_coach priority: attendance > create > wellness > club", () => {
    const base = {
      staffRole: "head_coach" as const,
      isPhysicalTrainer: false,
      canCreateSession: true,
      canManageWellness: true,
      rosterCount: 10,
      wellnessPct: 62,
    };

    expect(
      computeHomeSmartActions({
        ...base,
        pendingAttendanceCount: 5,
        noSessionsToday: true,
        showClubChanges: true,
      })?.primary.kind,
    ).toBe("attendance");

    expect(
      computeHomeSmartActions({
        ...base,
        pendingAttendanceCount: 0,
        noSessionsToday: true,
        showClubChanges: true,
      })?.primary.kind,
    ).toBe("createSession");

    expect(
      computeHomeSmartActions({
        ...base,
        pendingAttendanceCount: 0,
        noSessionsToday: false,
        showClubChanges: true,
      })?.primary.kind,
    ).toBe("wellness");

    expect(
      computeHomeSmartActions({
        ...base,
        pendingAttendanceCount: 0,
        noSessionsToday: false,
        showClubChanges: true,
        wellnessPct: 80,
      })?.primary.kind,
    ).toBe("club");
  });

  test("coach + physical_trainer: wellness > attendance > create", () => {
    const res = computeHomeSmartActions({
      staffRole: "coach",
      isPhysicalTrainer: true,
      canCreateSession: true,
      canManageWellness: true,
      pendingAttendanceCount: 2,
      noSessionsToday: true,
      showClubChanges: true, // should be ignored for coach+PT allowed list
      rosterCount: 10,
      wellnessPct: 79,
    });
    expect(res?.primary.kind).toBe("wellness");
    expect(res?.secondary?.kind).toBe("attendance");
  });

  test("normal coach: attendance > create; wellness/club ignored", () => {
    const res = computeHomeSmartActions({
      staffRole: "coach",
      isPhysicalTrainer: false,
      canCreateSession: true,
      canManageWellness: true,
      pendingAttendanceCount: 0,
      noSessionsToday: true,
      showClubChanges: true,
      rosterCount: 10,
      wellnessPct: 10,
    });
    expect(res?.primary.kind).toBe("createSession");
    expect(res?.secondary).toBeNull();
  });

  test("wellness threshold: roster required and pct < 80", () => {
    expect(
      computeHomeSmartActions({
        staffRole: "head_coach",
        isPhysicalTrainer: false,
        canCreateSession: false,
        canManageWellness: true,
        pendingAttendanceCount: 0,
        noSessionsToday: false,
        showClubChanges: true,
        rosterCount: 0,
        wellnessPct: 10,
      })?.primary.kind,
    ).toBe("club");

    expect(
      computeHomeSmartActions({
        staffRole: "head_coach",
        isPhysicalTrainer: false,
        canCreateSession: false,
        canManageWellness: true,
        pendingAttendanceCount: 0,
        noSessionsToday: false,
        showClubChanges: true,
        rosterCount: 10,
        wellnessPct: 80,
      })?.primary.kind,
    ).toBe("club");
  });
});

