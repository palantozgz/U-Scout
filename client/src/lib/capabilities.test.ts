import { describe, expect, it } from "vitest";
import { computeCapabilities } from "./capabilities";

describe("computeCapabilities", () => {
  it("master can manage/edit/invite without membership; UI uses effectiveRole", () => {
    const c = computeCapabilities({
      realRole: "master",
      effectiveRole: "player",
      membership: null,
    });
    expect(c.canManageClub).toBe(true);
    expect(c.canEditClub).toBe(true);
    expect(c.canInviteMembers).toBe(true);
    expect(c.canSeeAdminActions).toBe(true);
    expect(c.canUsePlayerUX).toBe(true);
    expect(c.canViewCoachUI).toBe(false);
    expect(c.canCreateEvent).toBe(false);
  });

  it("head_coach with active membership can manage/invite/edit (non-owner edit allowed by default)", () => {
    const c = computeCapabilities({
      realRole: "head_coach",
      effectiveRole: "head_coach",
      membership: { clubId: "c1", userId: "u1", role: "head_coach", status: "active", isOwner: false },
    });
    expect(c.canManageClub).toBe(true);
    expect(c.canInviteMembers).toBe(true);
    expect(c.canEditClub).toBe(true);
    expect(c.canUsePlayerUX).toBe(false);
    expect(c.canCreateEvent).toBe(true);
  });

  it("coach with active membership can manage/invite but cannot edit club unless owner/head coach", () => {
    const c = computeCapabilities({
      realRole: "coach",
      effectiveRole: "coach",
      membership: { clubId: "c1", userId: "u1", role: "coach", status: "active", isOwner: false },
    });
    expect(c.canManageClub).toBe(true);
    expect(c.canInviteMembers).toBe(true);
    expect(c.canEditClub).toBe(false);
    expect(c.canCreateEvent).toBe(true);
  });

  it("player cannot manage club even if membership present", () => {
    const c = computeCapabilities({
      realRole: "player",
      effectiveRole: "player",
      membership: { clubId: "c1", userId: "u1", role: "player", status: "active", isOwner: false },
    });
    expect(c.canManageClub).toBe(false);
    expect(c.canInviteMembers).toBe(false);
    expect(c.canEditClub).toBe(false);
    expect(c.canUsePlayerUX).toBe(true);
  });

  it("null membership prevents manage/edit for non-master roles", () => {
    const c = computeCapabilities({
      realRole: "head_coach",
      effectiveRole: "head_coach",
      membership: null,
    });
    expect(c.canManageClub).toBe(false);
    expect(c.canEditClub).toBe(false);
    expect(c.canInviteMembers).toBe(false);
  });

  it("unknown effectiveRole still yields safe booleans (null)", () => {
    const c = computeCapabilities({
      realRole: null,
      effectiveRole: null,
      membership: null,
    });
    expect(c.canUsePlayerUX).toBe(false);
    expect(c.canViewCoachUI).toBe(true);
    expect(c.canManageClub).toBe(false);
  });
});

