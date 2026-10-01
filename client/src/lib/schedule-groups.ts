// Resumen de quién ha elegido qué grupo en las sesiones con grupos y auto-apuntarse (lógica pura, con tests).
// El grupo vive en schedule_participants.group_label (A..F); solo cuentan las jugadoras con estado "confirmed".

export type GroupSignupRow = {
  user_id: string;
  status: string;
  group_label?: string | null;
};

/** "A".."F" -> 0..5; null si no es una letra válida o queda fuera de los grupos de la sesión. */
export function groupIndexFromLabel(label: string | null | undefined, groupsCount: number): number | null {
  if (!label || label.length !== 1) return null;
  const idx = label.charCodeAt(0) - 65;
  if (idx < 0 || idx >= groupsCount) return null;
  return idx;
}

export function summarizeGroupSignups(
  rows: GroupSignupRow[],
  groupsCount: number,
): { groups: string[][]; noGroup: string[] } {
  const n = Math.max(1, Math.min(6, Math.floor(groupsCount) || 1));
  const groups: string[][] = Array.from({ length: n }, () => []);
  const noGroup: string[] = [];
  for (const r of rows) {
    if (r.status !== "confirmed") continue;
    const idx = groupIndexFromLabel(r.group_label, n);
    if (idx == null) noGroup.push(r.user_id);
    else groups[idx].push(r.user_id);
  }
  return { groups, noGroup };
}
