// Exportación de asistencia a CSV (lógica pura, probada con vitest). Una fila por sesión y jugadora.
// "status" sale tal cual de schedule_participants (la intención): confirmed | declined | maybe; sin respuesta = pending.
// "actual" y "reason" salen de session_attendance (lo que ocurrió, marcado por el staff): present | partial | absent;
// sin marca = unmarked. Las dos columnas nuevas van al final para no romper hojas de cálculo que ya usen el formato.
// Fechas y horas en la zona horaria del club (Asia/Shanghai), no en la del dispositivo.

export type AttendanceEvent = {
  id: string;
  starts_at: string;
  session_type: string;
  title: string;
  attendance_required: boolean;
};
export type AttendancePlayer = { userId: string; name: string };
export type AttendanceResponse = { event_id: string; user_id: string; status: string };
export type AttendanceActual = { event_id: string; user_id: string; status: string; reason: string | null };

const CLUB_TZ = "Asia/Shanghai";

export const ATTENDANCE_CSV_HEADER = [
  "date",
  "time",
  "type",
  "title",
  "attendance_required",
  "player",
  "status",
  "actual",
  "reason",
];

/** Celda CSV segura: comillas dobles escapadas y neutraliza fórmulas (=, +, -, @) que Excel ejecutaría. */
export function csvCell(value: string): string {
  let v = value ?? "";
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  if (/[",\n\r]/.test(v)) v = `"${v.replace(/"/g, '""')}"`;
  return v;
}

function dateInClubTz(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CLUB_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function timeInClubTz(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: CLUB_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export function buildAttendanceCsv(params: {
  events: AttendanceEvent[];
  players: AttendancePlayer[];
  responses: AttendanceResponse[];
  /** Asistencia real (opcional): si no se pasa, todas salen como unmarked. */
  actual?: AttendanceActual[];
}): string {
  const statusByKey = new Map<string, string>();
  for (const r of params.responses) statusByKey.set(`${r.event_id}::${r.user_id}`, r.status);
  const actualByKey = new Map<string, AttendanceActual>();
  for (const a of params.actual ?? []) actualByKey.set(`${a.event_id}::${a.user_id}`, a);

  const events = [...params.events].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  const players = [...params.players].sort((a, b) => a.name.localeCompare(b.name));

  const lines: string[] = [ATTENDANCE_CSV_HEADER.join(",")];
  for (const ev of events) {
    for (const p of players) {
      const status = statusByKey.get(`${ev.id}::${p.userId}`) ?? "pending";
      const real = actualByKey.get(`${ev.id}::${p.userId}`);
      lines.push(
        [
          dateInClubTz(ev.starts_at),
          timeInClubTz(ev.starts_at),
          ev.session_type,
          ev.title,
          ev.attendance_required ? "yes" : "no",
          p.name,
          status,
          real?.status ?? "unmarked",
          real?.reason ?? "",
        ]
          .map(csvCell)
          .join(","),
      );
    }
  }
  // BOM para que Excel abra bien los nombres en chino.
  return `\ufeff${lines.join("\r\n")}\r\n`;
}
