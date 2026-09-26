// ─── client/src/pages/Login.tsx ──────────────────────────────────────────────
// Login + Register screen. Simple, clean.
// After login → redirects to Home (role-based routing handled there).

import { useState } from "react";
import { useLocation } from "wouter";
import { supabase, resetPasswordForEmail } from "@/lib/supabase";
import { useLocale, type Locale } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, Eye, EyeOff } from "lucide-react";

const LANG_OPTIONS: { code: Locale; flag: string; label: string }[] = [
  { code: "en", flag: "🇬🇧", label: "EN" },
  { code: "es", flag: "🇪🇸", label: "ES" },
  { code: "zh", flag: "🇨🇳", label: "中文" },
];

type Mode = "login" | "register" | "forgot";

export default function Login() {
  const { t, locale, changeLocale } = useLocale();
  const [, setLocation] = useLocation();
  const [mode,     setMode]     = useState<Mode>("login");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  // AÑADIDO 2026-09-15 (pasada de fricción/cosmética): sin esto, un usuario
  // nuevo escribiendo su contraseña por primera vez en el móvil no tiene
  // forma de verificar que no se ha equivocado -- patrón estándar en
  // formularios de auth modernos.
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [role,     setRole]     = useState<"head_coach" | "coach" | "player">("head_coach");
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [success,  setSuccess]  = useState(false);
  // AÑADIDO 2026-09-15 (pasada de fricción/cosmética): no existía ninguna
  // forma de recuperar el acceso -- un usuario nuevo que se equivocaba de
  // contraseña quedaba bloqueado sin salida dentro de la app. El correo de
  // recuperación real lo maneja PasswordRecoveryModal (App.tsx), montado
  // en la raíz -- aquí solo se dispara el envío y se confirma.
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async () => {
    setError(null);

    // AÑADIDO 2026-09-15 (pasada de fricción/cosmética): estos campos no
    // están dentro de un <form> real (el botón es un <div>/onClick, no
    // type="submit") -- un `required` de HTML no dispararía nunca la
    // validación nativa del navegador aquí. Comprobación manual en su
    // lugar: evita un viaje de red innecesario y un mensaje crudo de
    // Supabase por dejar un campo vacío sin querer.
    const missingEmail = !email.trim();
    const missingPassword = mode !== "forgot" && !password.trim();
    const missingName = mode === "register" && !fullName.trim();
    if (missingEmail || missingPassword || missingName) {
      setError(t("auth_fill_required_fields"));
      return;
    }

    setLoading(true);

    if (mode === "forgot") {
      const { error } = await resetPasswordForEmail(email);
      if (error) setError(error.message);
      else setResetSent(true);
      setLoading(false);
      return;
    }

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
      } else {
        const pendingTeamInvite = localStorage.getItem("pending_team_invite");
        if (pendingTeamInvite) {
          localStorage.removeItem("pending_team_invite");
          setLocation(`/join/${pendingTeamInvite}`);
          return;
        }
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
      <div className="flex flex-col items-center justify-center h-app overflow-y-auto px-6 gap-6 bg-background">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Shield className="w-8 h-8 text-primary" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">{t("auth_check_email_title")}</h2>
          <p className="text-muted-foreground text-sm">
            {t("auth_check_email_body").replace("{email}", email)}
          </p>
        </div>
        <Button variant="outline" onClick={() => setMode("login")}>
          {t("auth_back_to_login")}
        </Button>
      </div>
    );
  }

  if (resetSent) {
    return (
      <div className="flex flex-col items-center justify-center h-app overflow-y-auto px-6 gap-6 bg-background">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Shield className="w-8 h-8 text-primary" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">{t("auth_reset_sent_title")}</h2>
          <p className="text-muted-foreground text-sm">
            {t("auth_reset_sent_body").replace("{email}", email)}
          </p>
        </div>
        <Button variant="outline" onClick={() => { setMode("login"); setResetSent(false); }}>
          {t("auth_back_to_login")}
        </Button>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col items-center justify-center h-app overflow-y-auto px-6 gap-6 bg-background">

      {/* Language picker */}
      <div className="absolute top-4 right-4 flex gap-1">
        {LANG_OPTIONS.map(l => (
          <button
            key={l.code}
            type="button"
            onClick={() => changeLocale(l.code)}
            className={`min-h-11 px-2.5 rounded-lg text-xs font-bold transition-all ${
              locale === l.code
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {l.flag} {l.label}
          </button>
        ))}
      </div>

      {/* Logo */}
      <div className="flex flex-col items-center gap-3">
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
          <Shield className="w-8 h-8 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight">U Core</h1>
        <p className="text-muted-foreground text-sm">
          {mode === "login" ? t("sign_in") : mode === "register" ? t("sign_up") : t("auth_forgot_password_title")}
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
            autoComplete="name"
          />
        )}

        <Input
          type="email"
          placeholder={t("email")}
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="h-12 rounded-xl"
          autoCapitalize="none"
          autoComplete="email"
          onKeyDown={e => mode === "forgot" && e.key === "Enter" && handleSubmit()}
        />

        {mode !== "forgot" && (
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              placeholder={t("password")}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="h-12 rounded-xl pr-11"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-0 top-0 h-12 w-11 flex items-center justify-center text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? t("password_hide") : t("password_show")}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        )}

        {mode === "login" && (
          <div className="text-right -mt-1">
            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2"
              onClick={() => { setMode("forgot"); setError(null); }}
            >
              {t("auth_forgot_password_link")}
            </button>
          </div>
        )}

        {mode === "register" && (
          <div className="grid grid-cols-2 gap-2">
            {(["head_coach", "coach"] as const).map(r => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`h-11 rounded-xl border text-sm font-semibold transition-all ${
                  role === r
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border text-muted-foreground"
                }`}
              >
                {r === "head_coach" ? t("role_head_coach") : t("role_coach")}
              </button>
            ))}
          </div>
        )}

        {/* AÑADIDO 2026-09-15 (pasada de fricción/cosmética): quien registra la
            primera cuenta de su club nunca ha usado la app -- sin esto no
            tenía forma de saber la diferencia real entre las 2 opciones, ni
            que "Coach" aquí (sin invitación previa) deja la cuenta sin club
            hasta que alguien la invite (ver ClubSecurityGate en App.tsx). */}
        {mode === "register" && (
          <p className="text-[11px] text-muted-foreground/70 text-center leading-relaxed -mt-1">
            {locale === "es"
              ? role === "head_coach"
                ? "Head Coach crea el club y puede invitar al resto del staff."
                : "Coach se une a un club ya existente — solo si tienes un enlace de invitación."
              : locale === "zh"
                ? role === "head_coach"
                  ? "主教练创建俱乐部，并可以邀请其他教练。"
                  : "教练需要加入已有的俱乐部 — 仅在你有邀请链接时选择此项。"
                : role === "head_coach"
                  ? "Head Coach creates the club and can invite the rest of the staff."
                  : "Coach joins an existing club — only pick this if you have an invite link."}
          </p>
        )}

        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}

        <Button
          className="w-full h-12 rounded-xl font-bold text-base"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading
            ? "..."
            : mode === "login"
              ? t("sign_in")
              : mode === "register"
                ? t("sign_up")
                : t("auth_forgot_password_submit")}
        </Button>
      </div>

      {/* Toggle */}
      {mode === "forgot" ? (
        <button
          type="button"
          className="text-sm text-primary font-semibold underline underline-offset-2"
          onClick={() => { setMode("login"); setError(null); }}
        >
          {t("auth_back_to_login")}
        </button>
      ) : (
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
      )}

    </div>
  );
}
