import type { ClubMemberDto } from "@/lib/club-api";

const LS_PREFIX = "uscout-club-roster-sig";

function storageKey(userId: string, clubId: string): string {
  return `${LS_PREFIX}:${userId}:${clubId}`;
}

/** Stable fingerprint of staff + roster rows (join/leave/role/status). */
export function rosterSignature(members: ClubMemberDto[]): string {
  return [...members]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((m) => `${m.id}:${m.userId}:${m.role}:${m.status}`)
    .join("|");
}

export function getStoredRosterSignature(userId: string, clubId: string): string | null {
  try {
    return localStorage.getItem(storageKey(userId, clubId));
  } catch {
    return null;
  }
}

export function setStoredRosterSignature(userId: string, clubId: string, signature: string): void {
  try {
    localStorage.setItem(storageKey(userId, clubId), signature);
  } catch {
    /* ignore quota / private mode */
  }
}
