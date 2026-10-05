import { describe, expect, it } from "vitest";
import {
  canMarkAttendance,
  normalizeAttendance,
  rsvpHint,
  shouldAnswerRpe,
  summarizeAttendance,
  type AttendanceRow,
} from "./session-attendance-logic";

describe("normalizeAttendance", () => {
  it("presente nunca lleva motivo", () => {
    expect(normalizeAttendance("present", "injury")).toEqual({ status: "present", reason: null });
  });
  it("parcial y ausente conservan el motivo, o null si no hay", () => {
    expect(normalizeAttendance("partial", "illness")).toEqual({ status: "partial", reason: "illness" });
    expect(normalizeAttendance("absent", undefined)).toEqual({ status: "absent", reason: null });
  });
});

const rows: AttendanceRow[] = [
  { event_id: "e1", user_id: "u1", status: "present", reason: null },
  { event_id: "e1", user_id: "u2", status: "partial", reason: "injury" },
  { event_id: "e1", user_id: "u3", status: "absent", reason: "personal" },
  { event_id: "e1", user_id: "u9", status: "present", reason: null }, // ya no está en la plantilla
];

describe("summarizeAttendance", () => {
  it("cuenta por estado y deja como sin marcar a quien no tiene fila", () => {
    expect(summarizeAttendance(rows, ["u1", "u2", "u3", "u4", "u5"])).toEqual({
      present: 1,
      partial: 1,
      absent: 1,
      unmarked: 2,
    });
  });
  it("ignora filas de jugadoras fuera de la plantilla", () => {
    expect(summarizeAttendance(rows, ["u4"])).toEqual({ present: 0, partial: 0, absent: 0, unmarked: 1 });
  });
});

describe("rsvpHint", () => {
  it("solo distingue confirmado y declinado", () => {
    expect(rsvpHint("confirmed")).toBe("confirmed");
    expect(rsvpHint("declined")).toBe("declined");
    expect(rsvpHint("maybe")).toBeNull();
    expect(rsvpHint(undefined)).toBeNull();
    expect(rsvpHint(null)).toBeNull();
  });
});

describe("shouldAnswerRpe", () => {
  it("quien estuvo ausente no debe responder al RPE", () => {
    expect(shouldAnswerRpe({ status: "absent" })).toBe(false);
  });
  it("presente, parcial o sin marca sí", () => {
    expect(shouldAnswerRpe({ status: "present" })).toBe(true);
    expect(shouldAnswerRpe({ status: "partial" })).toBe(true);
    expect(shouldAnswerRpe(undefined)).toBe(true);
    expect(shouldAnswerRpe(null)).toBe(true);
  });
});

describe("canMarkAttendance", () => {
  const now = new Date("2026-10-02T10:00:00.000Z");
  it("solo cuando la sesión ya ha empezado", () => {
    expect(canMarkAttendance("2026-10-02T09:30:00.000Z", now)).toBe(true);
    expect(canMarkAttendance("2026-10-02T10:00:00.000Z", now)).toBe(true);
    expect(canMarkAttendance("2026-10-02T10:00:01.000Z", now)).toBe(false);
  });
  it("una fecha inválida no se puede marcar", () => {
    expect(canMarkAttendance("no-es-fecha", now)).toBe(false);
  });
});
