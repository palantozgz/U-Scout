import type { Request } from "express";
import { getSupabaseAdmin } from "./supabaseAdmin";

export type AuthBasics = { fullName: string | null; email: string | null };

/** For the signed-in user row, fill from JWT when Admin lookup is empty (no service role). */
export function mergeAuthWithSession(
  memberUserId: string,
  session: NonNullable<Request["user"]>,
  fromAdmin: AuthBasics,
): AuthBasics {
  if (memberUserId !== session.id) return fromAdmin;
  const sFn = session.fullName?.trim();
  const sEm = session.email?.trim();
  return {
    fullName: (sFn && sFn.length > 0 ? sFn : null) ?? fromAdmin.fullName,
    email: (sEm && sEm.length > 0 ? sEm : null) ?? fromAdmin.email,
  };
}

/**
 * Loads full_name (user_metadata) and email for each auth user id.
 * No-op when service role is unavailable.
 * Capped at BATCH_SIZE concurrent requests + per-call timeout to avoid hanging.
 */
export async function lookupAuthBasicsByUserIds(userIds: string[]): Promise<Map<string, AuthBasics>> {
  const unique = Array.from(new Set(userIds));
  const map = new Map<string, AuthBasics>();
  for (const id of unique) {
    map.set(id, { fullName: null, email: null });
  }

  const admin = getSupabaseAdmin();
  if (!admin || unique.length === 0) return map;

  // Max concurrent Admin API calls — avoids rate limiting on Railway
  const BATCH_SIZE = 5;
  const TIMEOUT_MS = 4000;

  async function fetchOne(id: string): Promise<void> {
    try {
      const result = await Promise.race([
        admin!.auth.admin.getUserById(id),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS),
        ),
      ]);
      if ("error" in result && result.error) return;
      if (!("data" in result) || !result.data.user) return;
      const u = result.data.user;
      const meta = u.user_metadata as Record<string, unknown> | undefined;
      const fnRaw = meta?.full_name ?? meta?.fullName ?? meta?.name;
      const fullName = typeof fnRaw === "string" && fnRaw.trim() ? fnRaw.trim() : null;
      const email = u.email?.trim() || null;
      map.set(id, { fullName, email });
    } catch {
      /* keep nulls — timeout or network error */
    }
  }

  // Process in batches
  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const batch = unique.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(fetchOne));
  }

  return map;
}
