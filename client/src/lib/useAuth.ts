// ─── client/src/lib/useAuth.ts ────────────────────────────────────────────────
// Shared auth state + DEV role preview (frontend-only).
//
// IMPORTANT:
// - This module intentionally uses a small in-memory store so all components
//   see the same auth/preview state (single source of truth).
// - Preview role NEVER changes Supabase auth, DB permissions, or backend behavior.

import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase, signOut as supabaseSignOut } from "./supabase";
import { clearAllLocalCache } from "./queryClient";

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
  /** DEV QA ONLY: the persisted preview role (null = disabled). */
  previewRole: AppUserRole | null;
  /** DEV QA ONLY: computed role used for frontend rendering. */
  effectiveRole: AppUserRole | null;
  /** DEV QA ONLY: whether preview is allowed to be used/visible. */
  canUseRolePreview: boolean;
  /** DEV QA ONLY: setter that persists to localStorage. */
  setPreviewRole: (role: AppUserRole | null) => void;
  loading: boolean;
  signOut: () => Promise<void>;
}

const VALID_ROLES: AppUserRole[] = ["master", "head_coach", "coach", "player"];
export const DEV_ROLE_KEY = "uscout-dev-role-preview";

function normalizeRole(raw: unknown): AppUserRole {
  if (typeof raw === "string" && (VALID_ROLES as string[]).includes(raw)) return raw as AppUserRole;
  return "coach";
}

function isLocalhost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function readPreviewRole(): AppUserRole | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DEV_ROLE_KEY);
    if (raw && (VALID_ROLES as string[]).includes(raw)) return raw as AppUserRole;
  } catch {
    // ignore
  }
  return null;
}

function writePreviewRole(role: AppUserRole | null) {
  if (typeof window === "undefined") return;
  try {
    if (!role) window.localStorage.removeItem(DEV_ROLE_KEY);
    else window.localStorage.setItem(DEV_ROLE_KEY, role);
  } catch {
    // ignore
  }
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

type StoreState = {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  previewRole: AppUserRole | null;
};

let store: StoreState = {
  user: null,
  profile: null,
  loading: true,
  previewRole: null,
};

const listeners = new Set<(s: StoreState) => void>();

function emit() {
  listeners.forEach((l) => l(store));
}

function setStore(patch: Partial<StoreState>) {
  store = { ...store, ...patch };
  emit();
}

let authSubscriptionStarted = false;

function ensureAuthSubscription() {
  if (authSubscriptionStarted) return;
  authSubscriptionStarted = true;

  const syncFromSession = async (session: { user: User } | null) => {
    if (!session?.user) {
      setStore({ user: null, profile: null, loading: false });
      return;
    }
    setStore({ loading: true });
    const u = session.user;
    const p = profileFromUser(u);
    setStore({ user: u, profile: p, loading: false });
  };

  // Initial session hydrate
  supabase.auth.getSession().then(({ data: { session } }) => {
    void syncFromSession(session);
  });

  // Auth change stream
  supabase.auth.onAuthStateChange((_event, session) => {
    void syncFromSession(session);
  });
}

function canUsePreviewForProfile(profile: UserProfile | null): boolean {
  if (!profile) return false;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const devBuild = (import.meta as any).env?.DEV === true;
  return devBuild || isLocalhost() || profile.role === "master";
}

function hydratePreviewRole(profile: UserProfile | null) {
  const allowed = canUsePreviewForProfile(profile);
  if (!allowed) {
    // Not eligible: remove persisted key
    writePreviewRole(null);
    setStore({ previewRole: null });
    return;
  }
  const stored = readPreviewRole();
  setStore({ previewRole: stored });
}

export function useAuth(): AuthState {
  // Ensure shared subscription (single source of truth)
  ensureAuthSubscription();

  const [state, setState] = useState<StoreState>(() => store);

  useEffect(() => {
    const listener = (s: StoreState) => setState(s);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  // Hydrate preview role after real profile is known, and keep it stable across navigation.
  useEffect(() => {
    hydratePreviewRole(state.profile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.profile?.id, state.profile?.role]);

  const canUseRolePreview = useMemo(() => canUsePreviewForProfile(state.profile), [state.profile]);

  // effectiveRole = previewRole ?? realRole
  const effectiveRole = useMemo<AppUserRole | null>(() => {
    const real = state.profile?.role ?? null;
    if (!real) return null;
    return state.previewRole ?? real;
  }, [state.previewRole, state.profile?.role]);

  const setPreviewRole = useCallback(
    (role: AppUserRole | null) => {
      const allowed = canUsePreviewForProfile(store.profile);
      if (!allowed) {
        writePreviewRole(null);
        setStore({ previewRole: null });
        return;
      }
      writePreviewRole(role);
      setStore({ previewRole: role });
    },
    [],
  );

  const handleSignOut = useCallback(async () => {
    await supabaseSignOut();
    clearAllLocalCache();
    writePreviewRole(null);
    setStore({ user: null, profile: null, loading: false, previewRole: null });
  }, []);

  return {
    user: state.user,
    profile: state.profile,
    previewRole: state.previewRole,
    effectiveRole,
    canUseRolePreview,
    setPreviewRole,
    loading: state.loading,
    signOut: handleSignOut,
  };
}
