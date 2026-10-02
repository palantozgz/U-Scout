// Feed iCalendar (.ics) del club. Movido desde routes.ts (2026-10-01) para poder probarlo con vitest.
//
// Mejoras respecto a la versión anterior, con la evidencia que las justifica:
//  - VALARM: en iOS las sesiones de un calendario suscrito NO traen alerta si el feed no la incluye, y no se
//    puede poner una alerta por defecto a una suscripción. Sin alarma, el aviso "del calendario del móvil" no existía.
//  - REFRESH-INTERVAL / X-PUBLISHED-TTL de 1 hora: pista para los clientes que la respetan. Apple Calendar consulta
//    cada ~hora, Outlook cada 1-4 h; Google consulta cada 8-24 h e ignora el TTL. Las suscripciones se consultan,
//    no se empujan: un cambio de última hora no llega al instante.
//  - Plegado de líneas a 75 octetos (RFC 5545 §3.1), sin partir caracteres multibyte (nombres y notas en chino).
//  - CRLF final tras END:VCALENDAR (RFC 5545).

/** Formato de fecha exigido por RFC5545 para instantes UTC: YYYYMMDDTHHMMSSZ. */
export function icsUtcStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

/** Escapado de texto libre según RFC5545 (backslash, punto y coma, coma, salto de línea). */
export function icsEscapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * `notes` guarda "<texto visible>\nOPS:<json de configuracion interna>" (ver readConstraintsFromNotes en
 * useSessionForm.ts); sin esto el JSON interno (asistencia, subgrupos, etc.) se filtraba tal cual a la
 * descripción del evento que ve el usuario en su calendario.
 */
export function cleanNotesForExport(notes: string | null): string | null {
  if (!notes) return null;
  const marker = "\nOPS:";
  const idx = notes.lastIndexOf(marker);
  const clean = (idx === -1 ? notes : notes.slice(0, idx)).trim();
  return clean || null;
}

/** RFC 5545 §3.1: una línea de más de 75 octetos se pliega con CRLF + espacio. No parte caracteres multibyte. */
export function foldIcsLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const chunks: string[] = [];
  let cur = "";
  let curBytes = 0;
  let limit = 75; // la primera línea admite 75 octetos; las de continuación, 74 + el espacio inicial
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (curBytes + b > limit) {
      chunks.push(cur);
      cur = ch;
      curBytes = b;
      limit = 74;
    } else {
      cur += ch;
      curBytes += b;
    }
  }
  chunks.push(cur);
  return chunks.join("\r\n ");
}

export type IcsEvent = {
  id: string;
  title: string;
  session_type: string;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  notes: string | null;
  /** Control de cambios (schedule_events.revision / updated_at): permite a los calendarios detectar ediciones. */
  revision?: number | null;
  updated_at?: string | Date | null;
};

/** Sesión borrada hace poco (lápida de schedule_event_cancellations): se emite como STATUS:CANCELLED. */
export type IcsCancelledEvent = {
  id: string;
  title: string;
  session_type: string;
  starts_at: string | Date;
  ends_at: string | Date | null;
  location: string | null;
  revision: number;
  cancelled_at: string | Date;
};

/** Minutos antes del inicio a los que avisa el calendario del móvil. */
export const ICS_ALARM_MINUTES = 60;

export function buildIcsCalendar(
  clubName: string,
  events: IcsEvent[],
  opts: { now?: Date; alarmMinutes?: number; cancelled?: IcsCancelledEvent[] } = {},
): string {
  const now = icsUtcStamp(opts.now ?? new Date());
  const alarmMinutes = opts.alarmMinutes ?? ICS_ALARM_MINUTES;
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//U Core//Schedule Export//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    `X-WR-CALNAME:${icsEscapeText(clubName)} \u2014 U Core`,
  ];
  for (const ev of events) {
    const start = new Date(ev.starts_at);
    const end = ev.ends_at ? new Date(ev.ends_at) : new Date(start.getTime() + 60 * 60000);
    const summary = icsEscapeText(ev.title || ev.session_type);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${ev.id}@ucore.app`,
      `DTSTAMP:${now}`,
      `DTSTART:${icsUtcStamp(start)}`,
      `DTEND:${icsUtcStamp(end)}`,
      `SUMMARY:${summary}`,
    );
    if (ev.revision != null) lines.push(`SEQUENCE:${ev.revision}`);
    if (ev.updated_at) lines.push(`LAST-MODIFIED:${icsUtcStamp(new Date(ev.updated_at))}`);
    if (ev.location) lines.push(`LOCATION:${icsEscapeText(ev.location)}`);
    const cleanNotes = cleanNotesForExport(ev.notes);
    if (cleanNotes) lines.push(`DESCRIPTION:${icsEscapeText(cleanNotes)}`);
    lines.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${summary}`,
      `TRIGGER:-PT${alarmMinutes}M`,
      "END:VALARM",
      "END:VEVENT",
    );
  }
  // Sesiones canceladas (borradas) hace poco. Los calendarios suscritos no están obligados a quitar un evento que
  // desaparece del feed; con STATUS:CANCELLED y un SEQUENCE mayor se ve como cancelada. El texto del título lo
  // dice también en claro porque no todos los clientes dibujan el estado.
  for (const c of opts.cancelled ?? []) {
    const start = new Date(c.starts_at);
    const end = c.ends_at ? new Date(c.ends_at) : new Date(start.getTime() + 60 * 60000);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${c.id}@ucore.app`,
      `DTSTAMP:${now}`,
      `DTSTART:${icsUtcStamp(start)}`,
      `DTEND:${icsUtcStamp(end)}`,
      `SUMMARY:${icsEscapeText(`已取消 / Cancelada: ${c.title || c.session_type}`)}`,
      "STATUS:CANCELLED",
      `SEQUENCE:${c.revision + 1}`,
      `LAST-MODIFIED:${icsUtcStamp(new Date(c.cancelled_at))}`,
    );
    if (c.location) lines.push(`LOCATION:${icsEscapeText(c.location)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}
