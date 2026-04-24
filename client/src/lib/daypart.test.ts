import { describe, expect, it } from "vitest";

function daypartFromHour(hour: number): "morning" | "midday" | "evening" {
  if (hour >= 0 && hour < 12) return "morning";
  if (hour < 17) return "midday";
  return "evening";
}

describe("create flow daypart mapping", () => {
  it("maps hours into fixed dayparts without flipping", () => {
    expect(daypartFromHour(9)).toBe("morning");
    expect(daypartFromHour(10)).toBe("morning");
    expect(daypartFromHour(12)).toBe("midday");
    expect(daypartFromHour(16)).toBe("midday");
    expect(daypartFromHour(17)).toBe("evening");
    expect(daypartFromHour(23)).toBe("evening");
  });
});

