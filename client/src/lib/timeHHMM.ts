export function formatTimeHHMMFromParts(h: number, m: number): string {
  const hh = Math.max(0, Math.min(23, Math.floor(h)));
  const mm = Math.max(0, Math.min(59, Math.floor(m)));
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function formatTimeHHMMFromTotalMinutes(totalMinutes: number): string {
  const t = Math.max(0, Math.min(1439, Math.floor(totalMinutes)));
  const hh = Math.floor(t / 60);
  const mm = t % 60;
  return formatTimeHHMMFromParts(hh, mm);
}

export function formatTimeHHMMFromString(raw: string): string {
  const t = (raw ?? "").trim();
  const m = /^(\d{1,2}):(\d{1,2})$/.exec(t);
  if (!m) return raw;
  return formatTimeHHMMFromParts(Number(m[1]) || 0, Number(m[2]) || 0);
}

export function parseTimeHHMMToTotalMinutes(raw: string): number | null {
  const t = (raw ?? "").trim();
  const m = /^(\d{1,2}):(\d{1,2})$/.exec(t);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23) return null;
  if (mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

