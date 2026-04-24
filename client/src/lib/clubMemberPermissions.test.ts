import { describe, expect, it } from "vitest";
import { canBanMember, canRemoveMember } from "./clubMemberPermissions";

describe("club member permissions", () => {
  it("master can remove/ban non-owner non-self regardless of target role", () => {
    for (const targetRole of ["head_coach", "coach", "player", "weird"]) {
      expect(
        canRemoveMember({ meRole: "master", targetRole, isOwner: false, isSelf: false }),
      ).toBe(true);
      expect(
        canBanMember({ meRole: "master", targetRole, isOwner: false, isSelf: false }),
      ).toBe(true);
    }
  });

  it("master cannot act on self or owner", () => {
    expect(canRemoveMember({ meRole: "master", targetRole: "coach", isOwner: true, isSelf: false })).toBe(false);
    expect(canRemoveMember({ meRole: "master", targetRole: "coach", isOwner: false, isSelf: true })).toBe(false);
  });

  it("head coach cannot remove/ban owner, self, or another head coach", () => {
    expect(canRemoveMember({ meRole: "head_coach", targetRole: "head_coach", isOwner: false, isSelf: false })).toBe(false);
    expect(canBanMember({ meRole: "head_coach", targetRole: "head_coach", isOwner: false, isSelf: false })).toBe(false);
    expect(canRemoveMember({ meRole: "head_coach", targetRole: "coach", isOwner: true, isSelf: false })).toBe(false);
    expect(canRemoveMember({ meRole: "head_coach", targetRole: "coach", isOwner: false, isSelf: true })).toBe(false);
  });

  it("head coach can remove/ban coach and player", () => {
    expect(canRemoveMember({ meRole: "head_coach", targetRole: "coach", isOwner: false, isSelf: false })).toBe(true);
    expect(canRemoveMember({ meRole: "head_coach", targetRole: "player", isOwner: false, isSelf: false })).toBe(true);
  });

  it("coach can remove/ban players only (not staff)", () => {
    expect(canRemoveMember({ meRole: "coach", targetRole: "player", isOwner: false, isSelf: false })).toBe(true);
    expect(canRemoveMember({ meRole: "coach", targetRole: "coach", isOwner: false, isSelf: false })).toBe(false);
    expect(canRemoveMember({ meRole: "coach", targetRole: "head_coach", isOwner: false, isSelf: false })).toBe(false);
  });

  it("player cannot remove/ban anyone", () => {
    expect(canRemoveMember({ meRole: "player", targetRole: "player", isOwner: false, isSelf: false })).toBe(false);
    expect(canBanMember({ meRole: "player", targetRole: "coach", isOwner: false, isSelf: false })).toBe(false);
  });

  it("null actor role cannot remove/ban", () => {
    expect(canRemoveMember({ meRole: null, targetRole: "player", isOwner: false, isSelf: false })).toBe(false);
  });
});

