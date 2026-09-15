// ─── client/src/lib/supabase.ts ───────────────────────────────────────────────
// Single Supabase client instance for the entire app.
// Import this wherever you need auth or direct Supabase access.
//
// Usage:
//   import { supabase } from "@/lib/supabase"
//   const { data, error } = await supabase.auth.signInWithPassword(...)

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env"
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession:    true,   // survives page refresh
    autoRefreshToken:  true,   // keeps session alive
    detectSessionInUrl: true,  // handles magic link / OAuth callbacks
  },
});

// ─── Auth helpers ─────────────────────────────────────────────────────────────

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUp(email: string, password: string, fullName: string, role: "head_coach" | "coach" | "player") {
  return supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, role },
    },
  });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function getSession() {
  return supabase.auth.getSession();
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// AÑADIDOS 2026-09-15 (pasada de fricción/cosmética): no existía ninguna
// forma de recuperar el acceso a la cuenta -- un usuario nuevo que se
// equivocaba de contraseña quedaba bloqueado sin salida dentro de la app.
// `redirectTo` apunta a la propia raíz de la app -- Supabase adjunta el
// token de recuperación como fragmento de URL, `detectSessionInUrl: true`
// (ya activo arriba) lo consume solo y dispara el evento
// "PASSWORD_RECOVERY" que escucha App.tsx.
export async function resetPasswordForEmail(email: string) {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });
}

export async function updatePassword(newPassword: string) {
  return supabase.auth.updateUser({ password: newPassword });
}
