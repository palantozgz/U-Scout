import { describe, expect, it } from "vitest";
import { buildIcsCalendar, cleanNotesForExport, foldIcsLine, icsEscapeText, icsUtcStamp } from "./ics";

const NOW = new Date("2026-10-01T04:00:00.000Z");

/** Deshace el plegado RFC 5545 para comprobar que no se pierde ni se parte contenido. */
function unfold(s: string): string {
  return s.replace(/\r\n /g, "");
}

describe("icsUtcStamp / icsEscapeText / cleanNotesForExport", () => {
  it("formatea instantes UTC", () => {
    expect(icsUtcStamp(new Date("2026-09-30T23:30:00.000Z"))).toBe("20260930T233000Z");
  });
  it("escapa barra, punto y coma, coma y saltos de línea", () => {
    expect(icsEscapeText("a;b,c\\d\ne")).toBe("a\\;b\\,c\\\\d\\ne");
  });
  it("quita la configuración interna OPS: de las notas", () => {
    expect(cleanNotesForExport('Traer botella\nOPS:{"mode":"groups"}')).toBe("Traer botella");
    expect(cleanNotesForExport('\nOPS:{"x":1}')).toBeNull();
    expect(cleanNotesForExport(null)).toBeNull();
  });
});

describe("foldIcsLine", () => {
  it("no toca líneas de hasta 75 octetos", () => {
    const l = "SUMMARY:" + "a".repeat(67); // 75
    expect(foldIcsLine(l)).toBe(l);
  });
  it("pliega líneas largas: ninguna línea física supera 75 octetos y al desplegar queda igual", () => {
    const l = "DESCRIPTION:" + "palabra ".repeat(40);
    const folded = foldIcsLine(l);
    for (const phys of folded.split("\r\n")) expect(new TextEncoder().encode(phys).length).toBeLessThanOrEqual(75);
    expect(unfold(folded)).toBe(l);
  });
  it("no parte caracteres multibyte (chino) y conserva el texto", () => {
    const l = "DESCRIPTION:" + "训练前请到场热身并带好装备".repeat(8);
    const folded = foldIcsLine(l);
    for (const phys of folded.split("\r\n")) expect(new TextEncoder().encode(phys).length).toBeLessThanOrEqual(75);
    expect(unfold(folded)).toBe(l);
    expect(folded.includes("\uFFFD")).toBe(false);
  });
});

const EV = {
  id: "ev1",
  title: "Entrenamiento, tarde",
  session_type: "training",
  starts_at: "2026-10-02T09:30:00.000Z",
  ends_at: "2026-10-02T11:00:00.000Z",
  location: "Pabellón; pista 2",
  notes: 'Traer equipación\nOPS:{"mode":"all_team"}',
};

describe("buildIcsCalendar", () => {
  const ics = buildIcsCalendar("Jiangxi", [EV], { now: NOW });
  const flat = unfold(ics);

  it("termina con CRLF y usa CRLF entre líneas", () => {
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(/[^\r]\n/.test(ics)).toBe(false);
  });

  it("incluye las pistas de refresco de una hora", () => {
    expect(flat).toContain("REFRESH-INTERVAL;VALUE=DURATION:PT1H");
    expect(flat).toContain("X-PUBLISHED-TTL:PT1H");
  });

  it("cada sesión lleva una alarma 60 minutos antes", () => {
    expect(flat).toContain("BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:Entrenamiento\\, tarde\r\nTRIGGER:-PT60M\r\nEND:VALARM");
  });

  it("UID estable, fechas en UTC y texto escapado", () => {
    expect(flat).toContain("UID:ev1@ucore.app");
    expect(flat).toContain("DTSTART:20261002T093000Z");
    expect(flat).toContain("DTEND:20261002T110000Z");
    expect(flat).toContain("SUMMARY:Entrenamiento\\, tarde");
    expect(flat).toContain("LOCATION:Pabellón\\; pista 2");
  });

  it("no filtra la configuración interna OPS: a la descripción", () => {
    expect(flat).toContain("DESCRIPTION:Traer equipación");
    expect(flat).not.toContain("OPS:");
  });

  it("sin hora de fin dura una hora", () => {
    const out = unfold(buildIcsCalendar("C", [{ ...EV, ends_at: null }], { now: NOW }));
    expect(out).toContain("DTEND:20261002T103000Z");
  });

  it("la alarma es configurable y sin título usa el tipo de sesión", () => {
    const out = unfold(buildIcsCalendar("C", [{ ...EV, title: "" }], { now: NOW, alarmMinutes: 30 }));
    expect(out).toContain("SUMMARY:training");
    expect(out).toContain("TRIGGER:-PT30M");
  });

  it("ninguna línea física supera 75 octetos aunque la nota sea larga y en chino", () => {
    const long = buildIcsCalendar("Jiangxi", [{ ...EV, notes: "请提前十分钟到场，带好护具和水。".repeat(12) }], { now: NOW });
    for (const phys of long.split("\r\n")) expect(new TextEncoder().encode(phys).length).toBeLessThanOrEqual(75);
  });

  it("un club sin sesiones devuelve un calendario válido y vacío", () => {
    const out = buildIcsCalendar("Vacío", [], { now: NOW });
    expect(out.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(out).not.toContain("BEGIN:VEVENT");
    expect(out.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
});


describe("buildIcsCalendar: control de cambios y cancelaciones", () => {
  const upd = "2026-10-01T12:00:00.000Z";
  const base = { ...EV, revision: 3, updated_at: upd };
  const cancelled = {
    id: "ev9",
    title: "Entreno cancelado",
    session_type: "training",
    starts_at: "2026-10-03T09:30:00.000Z",
    ends_at: "2026-10-03T11:00:00.000Z",
    location: "Pabellon",
    revision: 2,
    cancelled_at: "2026-10-02T01:00:00.000Z",
  };

  it("las sesiones con revisión llevan SEQUENCE y LAST-MODIFIED", () => {
    const out = unfold(buildIcsCalendar("C", [base], { now: NOW }));
    expect(out).toContain("SEQUENCE:3");
    expect(out).toContain("LAST-MODIFIED:20261001T120000Z");
  });

  it("sin datos de revisión no se inventa SEQUENCE", () => {
    const out = unfold(buildIcsCalendar("C", [EV], { now: NOW }));
    expect(out).not.toContain("SEQUENCE:");
    expect(out).not.toContain("LAST-MODIFIED:");
  });

  it("una sesión cancelada se emite como STATUS:CANCELLED con SEQUENCE mayor, mismo UID y título legible", () => {
    const out = unfold(buildIcsCalendar("C", [], { now: NOW, cancelled: [cancelled] }));
    expect(out).toContain("UID:ev9@ucore.app");
    expect(out).toContain("STATUS:CANCELLED");
    expect(out).toContain("SEQUENCE:3");
    expect(out).toContain("LAST-MODIFIED:20261002T010000Z");
    expect(out).toContain("SUMMARY:已取消 / Cancelada: Entreno cancelado");
    expect(out).toContain("DTSTART:20261003T093000Z");
    expect(out).toContain("LOCATION:Pabellon");
  });

  it("una sesión cancelada no lleva alarma", () => {
    const out = unfold(buildIcsCalendar("C", [], { now: NOW, cancelled: [cancelled] }));
    expect(out).not.toContain("BEGIN:VALARM");
  });

  it("conviven sesiones activas y canceladas, y el calendario sigue siendo válido", () => {
    const out = buildIcsCalendar("C", [base], { now: NOW, cancelled: [cancelled] });
    expect((out.match(/BEGIN:VEVENT/g) ?? []).length).toBe(2);
    expect((out.match(/END:VEVENT/g) ?? []).length).toBe(2);
    expect(out.endsWith("END:VCALENDAR\r\n")).toBe(true);
    for (const phys of out.split("\r\n")) expect(new TextEncoder().encode(phys).length).toBeLessThanOrEqual(75);
  });

  it("acepta fechas como objeto Date (el driver de la base de datos las devuelve así)", () => {
    const out = unfold(
      buildIcsCalendar("C", [], {
        now: NOW,
        cancelled: [{ ...cancelled, starts_at: new Date(cancelled.starts_at), ends_at: null, cancelled_at: new Date(cancelled.cancelled_at) }],
      }),
    );
    expect(out).toContain("DTEND:20261003T103000Z");
  });
});
