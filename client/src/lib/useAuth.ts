// ─── client/src/lib/useAuth.ts ────────────────────────────────────────────────
// React hook for auth state. Use this in any component that needs
// to know if the user is logged in.
//
// Usage:
//   const { user, loading, signOut } = useAuth()
//   if (loading) return <Spinner />
//   if (!user) return <Redirect to="/login" />

import { useState, useEffect } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase, signOut as supabaseSignOut } from "./supabase";

export interface AuthState {
  user:    User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [user,    setUser]    = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabaseSignOut();
    setUser(null);
  };

  return { user, loading, signOut: handleSignOut };
}
