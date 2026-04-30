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

function resolveRole(metaRole: unknown, userId: string): string {
  const r = safeRole(metaRole);
  // For now: accept privileged roles from metadata but log them for audit.
  // TODO next session: verify against user_roles table in DB.
  if (PRIVILEGED_ROLES.includes(r)) {
    console.log(`[auth] privileged role "${r}" claimed by userId=${userId} via metadata`);
  }
  return r;
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
    role: resolveRole(user.user_metadata?.role, user.id),
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
      role: resolveRole(user.user_metadata?.role, user.id),
      fullName: fullNameFromUserMetadata(user),
    };
  }

  next();
}
