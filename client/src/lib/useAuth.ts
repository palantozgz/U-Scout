// ─── client/src/lib/useAuth.ts ────────────────────────────────────────────────
// React hook for auth state. Use this in any component that needs
// to know if the user is logged in and their app profile.
//
// Usage:
//   const { user, profile, loading, signOut } = useAuth()
//   if (loading) return <Spinner />
//   if (!user || !profile) return <Redirect to="/login" />

import { useState, useEffect, useCallback } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase, signOut as supabaseSignOut } from "./supabase";

export type AppUserRole = "master" | "head_coach" | "coach" | "player";

export interface UserProfile {
  id: string;
  email: string;
  role: AppUserRole;
  username: string;
  avatar_url: string | null;
}

export interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const VALID_ROLES: AppUserRole[] = ["master", "head_coach", "coach", "player"];

function normalizeRole(raw: unknown): AppUserRole {
  if (typeof raw === "string" && (VALID_ROLES as string[]).includes(raw))
    return raw as AppUserRole;
  return "coach";
}

function profileFromUser(user: User): UserProfile {
  const md = user.user_metadata ?? {};
  const fullName = typeof md.full_name === "string" ? md.full_name.trim() : "";
  const email = user.email ?? "";
  return {
    id: user.id,
    email,
    role: normalizeRole(md.role),
    username: fullName || email.split("@")[0] || "user",
    avatar_url: typeof md.avatar_url === "string" ? md.avatar_url : null,
  };
}

async function loadProfile(user: User): Promise<UserProfile> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, role, username, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) return profileFromUser(user);

  return {
    id: data.id as string,
    email: (data.email as string) ?? user.email ?? "",
    role: normalizeRole(data.role),
    username: typeof data.username === "string" && data.username
      ? data.username
      : profileFromUser(user).username,
    avatar_url: typeof data.avatar_url === "string" ? data.avatar_url : null,
  };
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function syncFromSession(session: { user: User } | null) {
      if (!session?.user) {
        if (!cancelled) {
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
        return;
      }
      const u = session.user;
      if (!cancelled) setLoading(true);
      try {
        const p = await loadProfile(u);
        if (!cancelled) {
          setUser(u);
          setProfile(p);
        }
      } catch {
        if (!cancelled) {
          setUser(u);
          setProfile(profileFromUser(u));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled) void syncFromSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        void syncFromSession(session);
      }
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = useCallback(async () => {
    await supabaseSignOut();
    setUser(null);
    setProfile(null);
  }, []);

  return { user, profile, loading, signOut: handleSignOut };
}
