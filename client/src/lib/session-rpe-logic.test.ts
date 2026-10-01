import { describe, expect, it } from "vitest";
import {
  RPE_WINDOW_HOURS,
  isRpeSessionType,
  pickPendingRpeEvent,
  sessionLoad,
  sessionMinutes,
  summarizeSessionRpe,
} from "./session-rpe-logic";

const NOW = new Date("2026-10-01T10:00:00.000Z").getTime();
const H = 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString();

function ev(id: string, type: string, endsHoursAgo: number | null) {
  return {
    id,
    session_type: type as "training" | "match" | "travel" | "meeting" | "recovery" | "other",
    ends_at: endsHoursAgo == null ? null : iso(NOW - endsHoursAgo * H),
  };
}

describe("sessionMinutes / sessionLoad", () => {
  it("calcula los minutos entre inicio y fin", () => {
    expect(sessionMinutes("2026-10-01T09:00:00Z", "2026-10-01T10:30:00Z")).toBe(90);
  });
  it("null si falta el fin o el intervalo no es válido", () => {
    expect(sessionMinutes("2026-10-01T09:00:00Z", null)).toBeNull();
    expect(sessionMinutes("2026-10-01T09:00:00Z", undefined)).toBeNull();
    expect(sessionMinutes("2026-10-01T09:00:00Z", "2026-10-01T09:00:00Z")).toBeNull();
    expect(sessionMinutes("2026-10-01T10:00:00Z", "2026-10-01T09:00:00Z")).toBeNull();
    expect(sessionMinutes("no-fecha", "2026-10-01T09:00:00Z")).toBeNull();
  });
  it("carga = RPE x minutos, y null sin minutos", () => {
    expect(sessionLoad(7, 90)).toBe(630);
    expect(sessionLoad(0, 90)).toBe(0);
    expect(sessionLoad(7, null)).toBeNull();
  });
});

describe("isRpeSessionType", () => {
  it("solo entrenamientos y partidos", () => {
    expect(isRpeSessionType("training")).toBe(true);
    expect(isRpeSessionType("match")).toBe(true);
    for (const t of ["recovery", "travel", "meeting", "other"]) expect(isRpeSessionType(t)).toBe(false);
  });
});

describe("pickPendingRpeEvent", () => {
  const none = new Set<string>();

  it("elige la sesión terminada más reciente", () => {
    const events = [ev("a", "training", 10), ev("b", "match", 2), ev("c", "training", 6)];
    expect(pickPendingRpeEvent(events, none, none, NOW)?.id).toBe("b");
  });
  it("ignora las que aún no han terminado", () => {
    expect(pickPendingRpeEvent([ev("a", "training", -1)], none, none, NOW)).toBeNull();
  });
  it("ignora las que terminaron fuera de la ventana", () => {
    expect(pickPendingRpeEvent([ev("a", "training", RPE_WINDOW_HOURS + 1)], none, none, NOW)).toBeNull();
    expect(pickPendingRpeEvent([ev("a", "training", RPE_WINDOW_HOURS - 1)], none, none, NOW)?.id).toBe("a");
  });
  it("ignora tipos que no son entrenamiento ni partido y sesiones sin hora de fin", () => {
    const events = [ev("a", "recovery", 1), ev("b", "travel", 1), ev("c", "training", null)];
    expect(pickPendingRpeEvent(events, none, none, NOW)).toBeNull();
  });
  it("salta las ya contestadas y las que la jugadora rechazó", () => {
    const events = [ev("a", "training", 1), ev("b", "training", 3), ev("c", "match", 5)];
    expect(pickPendingRpeEvent(events, new Set(["a"]), new Set(["b"]), NOW)?.id).toBe("c");
  });
  it("null si no queda ninguna pendiente", () => {
    expect(pickPendingRpeEvent([ev("a", "training", 1)], new Set(["a"]), none, NOW)).toBeNull();
    expect(pickPendingRpeEvent([], none, none, NOW)).toBeNull();
  });
});

describe("summarizeSessionRpe", () => {
  it("sin respuestas no inventa nada", () => {
    expect(summarizeSessionRpe([], 12, 90)).toEqual({ responses: 0, total: 12, meanRpe: null, maxRpe: null, load: null });
  });
  it("media redondeada a un decimal, máximo y carga", () => {
    expect(summarizeSessionRpe([6, 7, 8], 12, 90)).toEqual({ responses: 3, total: 12, meanRpe: 7, maxRpe: 8, load: 630 });
    expect(summarizeSessionRpe([5, 6], 10, 60)).toEqual({ responses: 2, total: 10, meanRpe: 5.5, maxRpe: 6, load: 330 });
  });
  it("sin minutos conocidos, la carga es null pero la media se mantiene", () => {
    expect(summarizeSessionRpe([4, 6], 10, null)).toMatchObject({ meanRpe: 5, load: null });
  });
});
