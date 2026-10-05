import { describe, expect, it } from "vitest";
import { ATTENDANCE_CSV_HEADER, buildAttendanceCsv, csvCell } from "./attendance-csv";

describe("csvCell", () => {
  it("texto simple sin cambios", () => {
    expect(csvCell("Entrenamiento")).toBe("Entrenamiento");
  });
  it("entrecomilla y escapa comas, comillas y saltos de línea", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('di "hola"')).toBe('"di ""hola"""');
    expect(csvCell("l1\nl2")).toBe('"l1\nl2"');
  });
  it("neutraliza fórmulas que Excel ejecutaría", () => {
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("@x")).toBe("'@x");
    expect(csvCell("-2")).toBe("'-2");
  });
  it("conserva caracteres chinos", () => {
    expect(csvCell("王芳")).toBe("王芳");
  });
});

const EVENTS = [
  { id: "e2", starts_at: "2026-10-02T01:00:00.000Z", session_type: "match", title: "Partido", attendance_required: true },
  { id: "e1", starts_at: "2026-09-30T23:30:00.000Z", session_type: "training", title: "Entreno, tarde", attendance_required: false },
];
const PLAYERS = [
  { userId: "u2", name: "Zhang" },
  { userId: "u1", name: "Aiyana" },
];

describe("buildAttendanceCsv", () => {
  const csv = buildAttendanceCsv({
    events: EVENTS,
    players: PLAYERS,
    responses: [
      { event_id: "e1", user_id: "u1", status: "confirmed" },
      { event_id: "e1", user_id: "u2", status: "declined" },
    ],
  });
  const lines = csv.replace("\ufeff", "").trimEnd().split("\r\n");

  it("empieza con BOM y la cabecera", () => {
    expect(csv.startsWith("\ufeff")).toBe(true);
    expect(lines[0]).toBe(ATTENDANCE_CSV_HEADER.join(","));
  });

  it("una fila por sesión y jugadora (2 x 2 + cabecera)", () => {
    expect(lines).toHaveLength(5);
  });

  it("ordena por fecha y luego por nombre", () => {
    expect(lines[1]).toContain("Aiyana");
    expect(lines[2]).toContain("Zhang");
    expect(lines[1]).toContain("Entreno");
    expect(lines[3]).toContain("Partido");
  });

  it("usa la zona horaria del club: 23:30 UTC del 30 sept es 07:30 del 1 oct en Shanghai", () => {
    expect(lines[1].startsWith("2026-10-01,07:30,training,")).toBe(true);
  });

  it("sin respuesta = pending, y respeta el estado guardado", () => {
    expect(lines[1]).toContain(",Aiyana,confirmed,");
    expect(lines[2]).toContain(",Zhang,declined,");
    expect(lines[3]).toContain(",Aiyana,pending,");
  });

  it("escapa el título con coma y marca asistencia requerida", () => {
    expect(lines[1]).toContain('"Entreno, tarde",no,');
    expect(lines[3]).toContain(",Partido,yes,");
  });

  it("sin sesiones solo devuelve la cabecera", () => {
    const empty = buildAttendanceCsv({ events: [], players: PLAYERS, responses: [] });
    expect(empty.replace("\ufeff", "").trimEnd()).toBe(ATTENDANCE_CSV_HEADER.join(","));
  });
});

describe("buildAttendanceCsv: asistencia real", () => {
  const withActual = buildAttendanceCsv({
    events: EVENTS,
    players: PLAYERS,
    responses: [{ event_id: "e1", user_id: "u1", status: "confirmed" }],
    actual: [
      { event_id: "e1", user_id: "u1", status: "partial", reason: "injury" },
      { event_id: "e1", user_id: "u2", status: "absent", reason: null },
      { event_id: "e2", user_id: "u1", status: "present", reason: null },
    ],
  });
  const lines = withActual.replace("\ufeff", "").trimEnd().split("\r\n");

  it("la cabecera termina en actual,reason (columnas nuevas al final)", () => {
    expect(lines[0].endsWith(",status,actual,reason")).toBe(true);
    expect(ATTENDANCE_CSV_HEADER.slice(0, 7)).toEqual(["date", "time", "type", "title", "attendance_required", "player", "status"]);
  });
  it("incluye lo que ocurrió y el motivo junto a la intención", () => {
    expect(lines[1].endsWith(",Aiyana,confirmed,partial,injury")).toBe(true);
    expect(lines[2].endsWith(",Zhang,pending,absent,")).toBe(true);
    expect(lines[3].endsWith(",Aiyana,pending,present,")).toBe(true);
  });
  it("sin marca de asistencia = unmarked y motivo vacío", () => {
    expect(lines[4].endsWith(",Zhang,pending,unmarked,")).toBe(true);
  });
  it("sin pasar asistencia real todo sale unmarked", () => {
    const c = buildAttendanceCsv({ events: EVENTS, players: PLAYERS, responses: [] });
    expect(c.replace("\ufeff", "").trimEnd().split("\r\n")[1].endsWith(",unmarked,")).toBe(true);
  });
});
