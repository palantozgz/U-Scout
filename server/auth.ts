// ─── server/middleware/auth.ts ────────────────────────────────────────────────
// Verifies Supabase JWT on every protected route.
// Extracts user_id and attaches it to req.user.
//
// Usage in routes:
//   app.get("/api/teams", requireAuth, async (req, res) => {
//     const userId = req.user.id;
//   })

import type { Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "./supabaseAdmin";

const supabaseUrl     = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

function fullNameFromUserMetadata(user: { user_metadata?: Record<string, unknown> | null }): string | null {
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const fnRaw = meta?.full_name ?? meta?.fullName ?? meta?.name;
  return typeof fnRaw === "string" && fnRaw.trim() ? fnRaw.trim() : null;
}

function safeRole(raw: unknown): string {
  // Only "player" and "coach" can come from user_metadata.
  // "head_coach" and "master" must be set by an admin — we accept them
  // from metadata ONLY if SUPABASE_SERVICE_ROLE_KEY is present (i.e. we
  // control the server), never from a user-writable token.
  const allowed = ["player", "coach", "head_coach", "master"];
  const r = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return allowed.includes(r) ? r : "coach";
}

// Privileged roles that require server-side verification (future: DB lookup).
const PRIVILEGED_ROLES = ["head_coach", "master"];

async function fetchPrivilegedRoleFromDb(userId: string): Promise<string | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const { data, error } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.log(`[auth] user_roles lookup error for userId=${userId}: ${error.message}`);
    return null;
  }
  const r = safeRole((data as any)?.role);
  return PRIVILEGED_ROLES.includes(r) ? r : null;
}

async function resolveRole(metaRole: unknown, userId: string): Promise<string> {
  const meta = safeRole(metaRole);

  // "head_coach" / "master" can ONLY come from user_roles (server-controlled).
  const dbPriv = await fetchPrivilegedRoleFromDb(userId);
  if (dbPriv) return dbPriv;

  // If metadata claims privileged but DB doesn't, downgrade + log attempt.
  if (PRIVILEGED_ROLES.includes(meta)) {
    console.log(`[auth] privileged role "${meta}" claimed by userId=${userId} via metadata but no user_roles row`);
    return "coach";
  }

  // "player" / "coach" may come from user_metadata.
  return meta;
}

export async function grantRole(userId: string, role: string, grantedBy: string) {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("supabase_admin_unavailable");
  const r = safeRole(role);
  const { data, error } = await admin
    .from("user_roles")
    .upsert({ user_id: userId, role: r, granted_by: grantedBy }, { onConflict: "user_id" })
    .select("user_id, role")
    .single();
  if (error) throw error;
  return data as { user_id: string; role: string };
}

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string; role: string; fullName: string | null };
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization token" });
  }

  const token = authHeader.replace("Bearer ", "");

  // Create a Supabase client with the user's token
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  // Attach user to request
  req.user = {
    id: user.id,
    email: user.email ?? "",
    role: await resolveRole(user.user_metadata?.role, user.id),
    fullName: fullNameFromUserMetadata(user),
  };

  next();
}

// Optional auth — attaches user if token present, continues without if not
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.replace("Bearer ", "");
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    req.user = {
      id: user.id,
      email: user.email ?? "",
      role: await resolveRole(user.user_metadata?.role, user.id),
      fullName: fullNameFromUserMetadata(user),
    };
  }

  next();
}
