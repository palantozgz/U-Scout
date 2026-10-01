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
