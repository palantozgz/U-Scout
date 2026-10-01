// Lógica pura del esfuerzo percibido de sesión (RPE 0-10). Sin dependencias de React ni de Supabase
// para poder probarla con vitest.
//
// Carga de una sesión para una jugadora = RPE x minutos de la sesión (método sRPE de Foster).
// Solo se pide RPE en entrenamientos y partidos que tengan hora de fin (sin hora de fin no se pueden
// calcular los minutos, y no se inventan).
import type { ScheduleEvent } from "@/lib/schedule";

export const RPE_SESSION_TYPES: ReadonlyArray<ScheduleEvent["session_type"]> = ["training", "match"];
/** Ventana en la que se sigue pidiendo el RPE tras terminar la sesión (permite contestar al día siguiente). */
export const RPE_WINDOW_HOURS = 24;

export function isRpeSessionType(sessionType: string): boolean {
  return (RPE_SESSION_TYPES as ReadonlyArray<string>).includes(sessionType);
}

/** Minutos entre inicio y fin; null si falta el fin o el intervalo no es válido. */
export function sessionMinutes(startsAt: string, endsAt: string | null | undefined): number | null {
  if (!endsAt) return null;
  const ms = new Date(endsAt).getTime() - new Date(startsAt).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.round(ms / 60000);
}

/** RPE x minutos; null si no se conocen los minutos. */
export function sessionLoad(rpe: number, minutes: number | null): number | null {
  if (minutes == null) return null;
  return Math.round(rpe * minutes);
}

type PendingCandidate = Pick<ScheduleEvent, "id" | "session_type" | "ends_at">;

/**
 * La sesión más reciente (ya terminada, dentro de la ventana) de la que esta jugadora aún no ha dado
 * RPE y a la que no dijo que no iba a ir. null si no hay ninguna pendiente.
 */
export function pickPendingRpeEvent<T extends PendingCandidate>(
  events: T[],
  answeredEventIds: ReadonlySet<string>,
  declinedEventIds: ReadonlySet<string>,
  nowMs: number,
  windowHours: number = RPE_WINDOW_HOURS,
): T | null {
  let best: T | null = null;
  let bestEnd = -Infinity;
  for (const e of events) {
    if (!isRpeSessionType(e.session_type) || !e.ends_at) continue;
    if (answeredEventIds.has(e.id) || declinedEventIds.has(e.id)) continue;
    const end = new Date(e.ends_at).getTime();
    if (!Number.isFinite(end) || end > nowMs || end < nowMs - windowHours * 3_600_000) continue;
    if (end > bestEnd) {
      best = e;
      bestEnd = end;
    }
  }
  return best;
}

export type SessionRpeSummary = {
  responses: number;
  total: number;
  meanRpe: number | null;
  maxRpe: number | null;
  /** RPE medio x minutos; null si no hay respuestas o no se conocen los minutos. */
  load: number | null;
};

export function summarizeSessionRpe(rpes: number[], total: number, minutes: number | null): SessionRpeSummary {
  const n = rpes.length;
  if (n === 0) return { responses: 0, total, meanRpe: null, maxRpe: null, load: null };
  const mean = rpes.reduce((a, b) => a + b, 0) / n;
  return {
    responses: n,
    total,
    meanRpe: Math.round(mean * 10) / 10,
    maxRpe: Math.max(...rpes),
    load: minutes == null ? null : Math.round(mean * minutes),
  };
}
