import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { useLocale } from "@/lib/i18n";
import { supabase, updatePassword } from "@/lib/supabase";

/**
 * AÑADIDO 2026-09-15 (pasada de fricción/cosmética, spec 50) — cierra el
 * hueco real de "olvidé mi contraseña": ningún sitio de la app manejaba el
 * enlace de recuperación de Supabase. `detectSessionInUrl: true`
 * (client/src/lib/supabase.ts) ya consume el token del enlace solo y
 * dispara el evento "PASSWORD_RECOVERY" -- este componente, montado una
 * vez en la raíz de la app (App.tsx), lo escucha y pide la contraseña
 * nueva. No depende de ninguna ruta concreta: el enlace de recuperación
 * apunta a la raíz del sitio, así que funciona sin importar en qué
 * pantalla "aterrice" el usuario.
 */
export function PasswordRecoveryModal() {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setDone(false);
        setPassword("");
        setError(null);
        setOpen(true);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async () => {
    if (password.length < 6) {
      setError(t("auth_reset_password_too_short"));
      return;
    }
    setError(null);
    setLoading(true);
    const { error } = await updatePassword(password);
    setLoading(false);
    if (error) setError(error.message);
    else setDone(true);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm rounded-2xl gap-4" data-testid="password-recovery-modal">
        {done ? (
          <div className="text-center space-y-3 py-2">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <DialogTitle className="text-lg font-black text-foreground text-center">
              {t("auth_reset_done_title")}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">{t("auth_reset_done_body")}</p>
            <Button className="w-full h-11 rounded-xl font-bold" onClick={() => setOpen(false)}>
              {t("auth_reset_done_continue")}
            </Button>
          </div>
        ) : (
          <>
            <DialogTitle className="text-lg font-black text-foreground">
              {t("auth_forgot_password_title")}
            </DialogTitle>
            <p className="text-sm text-muted-foreground -mt-2">{t("auth_reset_new_password_prompt")}</p>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder={t("password")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 rounded-xl pr-11"
                autoComplete="new-password"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && void handleSubmit()}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-0 top-0 h-12 w-11 flex items-center justify-center text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? t("password_hide") : t("password_show")}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="w-full h-11 rounded-xl font-bold" onClick={() => void handleSubmit()} disabled={loading}>
              {loading ? "..." : t("auth_reset_password_submit")}
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
