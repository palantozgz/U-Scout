import { describe, expect, it } from "vitest";
import { computeWaitlistState } from "./schedule";

describe("computeWaitlistState", () => {
  it("returns joined when cap is null/0", () => {
    expect(computeWaitlistState({ cap: null, joinedCount: 999 })).toBe("joined");
    expect(computeWaitlistState({ cap: 0, joinedCount: 999 })).toBe("joined");
  });

  it("returns waitlisted when joinedCount >= cap", () => {
    expect(computeWaitlistState({ cap: 5, joinedCount: 5 })).toBe("waitlisted");
    expect(computeWaitlistState({ cap: 5, joinedCount: 999 })).toBe("waitlisted");
  });

  it("returns joined when joinedCount < cap", () => {
    expect(computeWaitlistState({ cap: 5, joinedCount: 0 })).toBe("joined");
    expect(computeWaitlistState({ cap: 5, joinedCount: 4 })).toBe("joined");
  });

  it("normalizes negative/float inputs", () => {
    expect(computeWaitlistState({ cap: -1, joinedCount: 10 })).toBe("joined");
    expect(computeWaitlistState({ cap: 2.9, joinedCount: 2.1 })).toBe("waitlisted");
  });
});

