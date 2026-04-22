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
  /** From user_metadata.avatar_url, or empty string when unset */
  avatar_url: string;
}

export interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  /** UI-only role used for previewing player shell. Never sent to backend. */
  effectiveRole: AppUserRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
  /** DEV-only: visible only for the admin account. */
  canUseRolePreview: boolean;
  /** DEV-only: current preview mode ("staff" = disabled). */
  rolePreviewMode: "staff" | "player";
  /** DEV-only: set preview mode (localStorage). */
  setRolePreviewMode: (mode: "staff" | "player") => void;
}

const VALID_ROLES: AppUserRole[] = ["master", "head_coach", "coach", "player"];
const DEV_ROLE_PREVIEW_KEY = "ucore_dev_role_preview";
// IMPORTANT: DEV-only allowlist. This must never include non-admin users.
const DEV_ROLE_PREVIEW_EMAIL_ALLOWLIST = new Set<string>(["pablomgz@hotmail.com"]);

function normalizeRole(raw: unknown): AppUserRole {
  if (typeof raw === "string" && (VALID_ROLES as string[]).includes(raw)) return raw as AppUserRole;
  return "coach";
}

function readRolePreviewMode(): "staff" | "player" {
  try {
    const v = localStorage.getItem(DEV_ROLE_PREVIEW_KEY);
    return v === "player" ? "player" : "staff";
  } catch {
    return "staff";
  }
}

function writeRolePreviewMode(mode: "staff" | "player") {
  try {
    localStorage.setItem(DEV_ROLE_PREVIEW_KEY, mode);
  } catch {
    /* ignore */
  }
}

function canUseRolePreview(profile: UserProfile | null): boolean {
  if (!profile?.email) return false;
  return DEV_ROLE_PREVIEW_EMAIL_ALLOWLIST.has(profile.email);
}

function profileFromUser(user: User): UserProfile {
  const md = user.user_metadata ?? {};
  const email = user.email ?? "";
  const fullName = typeof md.full_name === "string" ? md.full_name.trim() : "";
  const avatarRaw = md.avatar_url;
  return {
    id: user.id,
    email,
    role: normalizeRole(md.role ?? "coach"),
    username: fullName || email || "user",
    avatar_url: typeof avatarRaw === "string" ? avatarRaw : "",
  };
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [rolePreviewMode, setRolePreviewModeState] = useState<"staff" | "player">(() => readRolePreviewMode());

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
      const p = profileFromUser(u);
      if (!cancelled) {
        setUser(u);
        setProfile(p);
        setLoading(false);
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

  const canPreview = canUseRolePreview(profile);
  const effectiveRole: AppUserRole | null =
    profile ? (canPreview && rolePreviewMode === "player" ? "player" : profile.role) : null;

  const setRolePreviewMode = useCallback((mode: "staff" | "player") => {
    writeRolePreviewMode(mode);
    setRolePreviewModeState(mode);
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== DEV_ROLE_PREVIEW_KEY) return;
      setRolePreviewModeState(readRolePreviewMode());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return {
    user,
    profile,
    effectiveRole,
    loading,
    signOut: handleSignOut,
    canUseRolePreview: canPreview,
    rolePreviewMode,
    setRolePreviewMode,
  };
}
