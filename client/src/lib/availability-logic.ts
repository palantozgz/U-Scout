// Disponibilidad de las jugadoras (lógica pura, con tests). Sin fila en player_availability = disponibilidad completa.
// La fija quien gestiona el club (entrenador jefe o entrenador con acceso a operaciones, la misma regla que Wellness).
// Cada club decide quién es: si tiene fisio o médico, el jefe le da acceso de operaciones; si no, lo fija el cuerpo técnico.

export type AvailabilityStatus = "full" | "modified" | "unavailable";
export const AVAILABILITY_STATUSES: readonly AvailabilityStatus[] = ["full", "modified", "unavailable"];
export const AVAILABILITY_NOTE_MAX = 200;

export type AvailabilityRow = {
  user_id: string;
  status: AvailabilityStatus;
  note: string | null;
};

/** Recorta la nota (máx. 200 caracteres) y devuelve null si queda vacía. */
export function normalizeNote(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim().slice(0, AVAILABILITY_NOTE_MAX).trim();
  return s ? s : null;
}

export function isRestricted(status: AvailabilityStatus): boolean {
  return status !== "full";
}

export function availabilityOf(
  rows: AvailabilityRow[],
  userId: string,
): { status: AvailabilityStatus; note: string | null } {
  const r = rows.find((x) => x.user_id === userId);
  return r ? { status: r.status, note: r.note } : { status: "full", note: null };
}

export function summarizeAvailability(
  rows: AvailabilityRow[],
  userIds: string[],
): { full: number; modified: number; unavailable: number } {
  const out = { full: 0, modified: 0, unavailable: 0 };
  for (const uid of userIds) out[availabilityOf(rows, uid).status] += 1;
  return out;
}

/** Una fila solo hace falta si hay restricción o nota; "completa sin nota" equivale a no tener fila. */
export function needsRow(status: AvailabilityStatus, note: string | null): boolean {
  return status !== "full" || note !== null;
}
