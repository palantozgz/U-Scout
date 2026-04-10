/**
 * Prefer Supabase Auth full_name, then account email, then stored club/team display data, then first 8 chars of user id.
 */
export function userDisplayLabel(opts: {
  userId: string;
  authFullName?: string | null;
  authEmail?: string | null;
  displayName?: string | null;
  invitedEmail?: string | null;
}): string {
  const n = opts.authFullName?.trim();
  if (n) return n;
  const ae = opts.authEmail?.trim();
  if (ae) return ae;
  const d = opts.displayName?.trim();
  if (d) return d;
  const inv = opts.invitedEmail?.trim();
  if (inv) return inv;
  const id = opts.userId;
  return id.length >= 8 ? id.slice(0, 8) : id;
}

export function isShortUserIdFallback(label: string, userId: string): boolean {
  return userId.length > 8 && label === userId.slice(0, 8);
}
