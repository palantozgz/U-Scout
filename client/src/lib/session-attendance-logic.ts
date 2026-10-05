// Asistencia REAL por sesión (lógica pura, con tests): lo que ocurrió, distinto de schedule_participants (la intención).
// La marca el staff que gestiona el club. Sirve para saber quién debía responder al RPE y qué carga recibió cada jugadora.

export type AttendanceStatus = "present" | "partial" | "absent";
export type AttendanceReason = "injury" | "illness" | "personal" | "other";
export const ATTENDANCE_STATUSES: readonly AttendanceStatus[] = ["present", "partial", "absent"];
export const ATTENDANCE_REASONS: readonly AttendanceReason[] = ["injury", "illness", "personal", "other"];

export type AttendanceRow = {
  event_id: string;
  user_id: string;
  status: AttendanceStatus;
  reason: AttendanceReason | null;
};

/** "present" nunca lleva motivo (la base de datos también lo exige con un CHECK). */
export function normalizeAttendance(
  status: AttendanceStatus,
  reason: AttendanceReason | null | undefined,
): { status: AttendanceStatus; reason: AttendanceReason | null } {
  if (status === "present") return { status, reason: null };
  return { status, reason: reason ?? null };
}

export function summarizeAttendance(
  rows: AttendanceRow[],
  playerIds: string[],
): { present: number; partial: number; absent: number; unmarked: number } {
  const byUser = new Map(rows.map((r) => [r.user_id, r.status] as const));
  const out = { present: 0, partial: 0, absent: 0, unmarked: 0 };
  for (const id of playerIds) {
    const s = byUser.get(id);
    if (!s) out.unmarked += 1;
    else out[s] += 1;
  }
  return out;
}

/** Pista visual: lo que la jugadora dijo que haría (schedule_participants). No marca nada por sí sola. */
export function rsvpHint(status: string | null | undefined): "confirmed" | "declined" | null {
  if (status === "confirmed") return "confirmed";
  if (status === "declined") return "declined";
  return null;
}

/** Debe responder al RPE de la sesión quien no fue marcada como ausente (sin marca = se asume que participó). */
export function shouldAnswerRpe(attendance: Pick<AttendanceRow, "status"> | null | undefined): boolean {
  return attendance?.status !== "absent";
}

/** Se puede marcar la asistencia de una sesión una vez que ha empezado. */
export function canMarkAttendance(startsAtIso: string, now: Date = new Date()): boolean {
  const t = new Date(startsAtIso).getTime();
  return Number.isFinite(t) && t <= now.getTime();
}

/**
 * Cuántas jugadoras deben responder al RPE de una sesión y cuántas fueron marcadas ausentes.
 * Una jugadora marcada ausente que aun así respondió cuenta como esperada (su respuesta existe y no se descarta).
 */
export function expectedRpeRespondents(
  playerIds: string[],
  attendance: Pick<AttendanceRow, "user_id" | "status">[],
  answeredUserIds: ReadonlySet<string>,
): { expected: number; absent: number } {
  const absentIds = new Set(attendance.filter((a) => !shouldAnswerRpe(a)).map((a) => a.user_id));
  let absent = 0;
  for (const id of playerIds) {
    if (absentIds.has(id) && !answeredUserIds.has(id)) absent += 1;
  }
  return { expected: playerIds.length - absent, absent };
}
