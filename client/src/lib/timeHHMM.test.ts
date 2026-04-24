import { describe, expect, it } from "vitest";
import { formatTimeHHMMFromTotalMinutes, parseTimeHHMMToTotalMinutes } from "./timeHHMM";

describe("formatTimeHHMMFromTotalMinutes", () => {
  it("formats total minutes as HH:MM with zero padding", () => {
    expect(formatTimeHHMMFromTotalMinutes(0)).toBe("00:00");
    expect(formatTimeHHMMFromTotalMinutes(540)).toBe("09:00");
    expect(formatTimeHHMMFromTotalMinutes(545)).toBe("09:05");
    expect(formatTimeHHMMFromTotalMinutes(790)).toBe("13:10");
    expect(formatTimeHHMMFromTotalMinutes(1439)).toBe("23:59");
  });
});

describe("parseTimeHHMMToTotalMinutes", () => {
  it("parses HH:MM into total minutes", () => {
    expect(parseTimeHHMMToTotalMinutes("00:00")).toBe(0);
    expect(parseTimeHHMMToTotalMinutes("09:00")).toBe(540);
    expect(parseTimeHHMMToTotalMinutes("09:05")).toBe(545);
    expect(parseTimeHHMMToTotalMinutes("13:10")).toBe(790);
    expect(parseTimeHHMMToTotalMinutes("23:59")).toBe(1439);
  });
});

