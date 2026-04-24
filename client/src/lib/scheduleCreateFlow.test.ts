import { describe, expect, it } from "vitest";

function locationPlaceholderKeyForType(sessionType: string) {
  if (sessionType === "training") return "schedule_session_location_placeholder_training";
  if (sessionType === "recovery") return "schedule_session_location_placeholder_recovery";
  if (sessionType === "match") return "schedule_session_location_placeholder_match";
  if (sessionType === "travel") return "schedule_session_location_placeholder_travel";
  if (sessionType === "meeting") return "schedule_session_location_placeholder_meeting";
  return "schedule_session_location_placeholder_other";
}

function nextStepperValue(prev: string, delta: number, max: number) {
  const n = Math.max(0, Number(prev) || 0);
  const next = Math.max(0, Math.min(max, n + delta));
  return String(next);
}

describe("Schedule create flow micro polish", () => {
  it("uses contextual location placeholder keys by session type", () => {
    expect(locationPlaceholderKeyForType("training")).toBe("schedule_session_location_placeholder_training");
    expect(locationPlaceholderKeyForType("travel")).toBe("schedule_session_location_placeholder_travel");
    expect(locationPlaceholderKeyForType("meeting")).toBe("schedule_session_location_placeholder_meeting");
    expect(locationPlaceholderKeyForType("match")).toBe("schedule_session_location_placeholder_match");
    expect(locationPlaceholderKeyForType("recovery")).toBe("schedule_session_location_placeholder_recovery");
    expect(locationPlaceholderKeyForType("other")).toBe("schedule_session_location_placeholder_other");
  });

  it("duration chips render with minute tick format", () => {
    const mins = [60, 90, 120];
    const labels = mins.map((m) => `${m}′`);
    expect(labels).toEqual(["60′", "90′", "120′"]);
  });

  it("attendance steppers increment/decrement with boundaries", () => {
    expect(nextStepperValue("", +1, 99)).toBe("1");
    expect(nextStepperValue("0", -1, 99)).toBe("0");
    expect(nextStepperValue("98", +1, 99)).toBe("99");
    expect(nextStepperValue("99", +1, 99)).toBe("99");
  });
});

