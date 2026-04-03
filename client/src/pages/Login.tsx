// ─── client/src/pages/Login.tsx ──────────────────────────────────────────────
// Login + Register screen. Simple, clean.
// After login → redirects to Home (role-based routing handled there).

import { useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { useLocale } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield } from "lucide-react";

type Mode = "login" | "register";

export default function Login() {
  const { t } = useLocale();
  const [, setLocation] = useLocation();
  const [mode,     setMode]     = useState<Mode>("login");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role,     setRole]     = useState<"head_coach" | "coach" | "player">("head_coach");
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [success,  setSuccess]  = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
      } else {
        setLocation("/");
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName, role } },
      });
      if (error) {
        setError(error.message);
      } else {
        setSuccess(true);
      }
    }

    setLoading(false);
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] px-6 gap-6 bg-background">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Shield className="w-8 h-8 text-primary" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">Check your email</h2>
          <p className="text-muted-foreground text-sm">
            We sent a confirmation link to <strong>{email}</strong>.
            Click it to activate your account.
          </p>
        </div>
        <Button variant="outline" onClick={() => setMode("login")}>
          Back to login
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] px-6 gap-6 bg-background">

      {/* Logo */}
      <div className="flex flex-col items-center gap-3">
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
          <Shield className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight">U Scout</h1>
        <p className="text-muted-foreground text-sm">
          {mode === "login" ? t("sign_in") : t("sign_up")}
        </p>
      </div>

      {/* Form */}
      <div className="w-full max-w-sm space-y-3">
        {mode === "register" && (
          <Input
            placeholder={t("full_name")}
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            className="h-12 rounded-xl"
          />
        )}

        <Input
          type="email"
          placeholder={t("email")}
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="h-12 rounded-xl"
          autoCapitalize="none"
        />

        <Input
          type="password"
          placeholder={t("password")}
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="h-12 rounded-xl"
          onKeyDown={e => e.key === "Enter" && handleSubmit()}
        />

        {mode === "register" && (
          <div className="grid grid-cols-2 gap-2">
            {(["head_coach", "coach"] as const).map(r => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`h-10 rounded-xl border text-sm font-semibold transition-all ${
                  role === r
                    ? "bg-primary text-white border-primary"
                    : "bg-background border-border text-muted-foreground"
                }`}
              >
                {r === "head_coach" ? "Head Coach" : t("role_coach")}
              </button>
            ))}
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}

        <Button
          className="w-full h-12 rounded-xl font-bold text-base"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? "..." : mode === "login" ? t("sign_in") : t("sign_up")}
        </Button>
      </div>

      {/* Toggle */}
      <p className="text-sm text-muted-foreground">
        {mode === "login" ? t("no_account") : t("already_have_account")}
        {" "}
        <button
          className="text-primary font-semibold underline underline-offset-2"
          onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }}
        >
          {mode === "login" ? t("sign_up") : t("sign_in")}
        </button>
      </p>

    </div>
  );
}
