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

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string; role: string };
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
    id:    user.id,
    email: user.email ?? "",
    role:  user.user_metadata?.role ?? "coach",
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
      id:    user.id,
      email: user.email ?? "",
      role:  user.user_metadata?.role ?? "coach",
    };
  }

  next();
}
