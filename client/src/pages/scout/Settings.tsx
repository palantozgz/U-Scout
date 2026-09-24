import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Globe, Check, LogOut, Trash2, User, Monitor, GraduationCap, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLocale, type Locale } from "@/lib/i18n";
import { useAuth } from "@/lib/useAuth";
import { useTheme, type Theme } from "@/lib/theme";
import { resetOnboarding, resetModuleIntros } from "@/lib/onboarding-state";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";

const LANGUAGES: { code: Locale; label: string; native: string; flag: string }[] = [
  { code: "en", label: "English",  native: "English", flag: "🇬🇧" },
  { code: "es", label: "Spanish",  native: "Español",  flag: "🇪🇸" },
  { code: "zh", label: "Chinese",  native: "中文",     flag: "🇨🇳" },
];

const THEMES: { id: Theme; emoji: string; labelKey: string; previewBg: string; accent: string; muted: string }[] = [
  {
    id: "gamenight",
    emoji: "🌙",
    labelKey: "theme_gamenight",
    previewBg: "#0B0C0F",
    accent: "#F5A623",
    muted: "#6B6F85",
  },
  {
    id: "office",
    emoji: "☀️",
    labelKey: "theme_office",
    previewBg: "#F4F6FA",
    accent: "#4563E9",
    muted: "#C5CFE8",
  },
  {
    id: "oldschool",
    emoji: "🏀",
    labelKey: "theme_oldschool",
    previewBg: "#0C0800",
    accent: "#FF8C00",
    muted: "#5C4A1E",
  },
];

export default function Settings() {
  const [, setLocation] = useLocation();
  const { locale, changeLocale, t } = useLocale();
  const { user, profile, signOut, canUseRolePreview, previewRole, setPreviewRole } = useAuth();
  const { theme, setTheme } = useTheme();

  const handleSignOut = async () => {
    await signOut();
    setLocation("/login");
  };

  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      await apiRequest("DELETE", "/api/account");
      await signOut();
      setLocation("/login");
    } catch (err) {
      console.error("[settings] delete account failed:", err);
      toast({ variant: "destructive", description: t("settings_delete_account_error") });
      setDeletingAccount(false);
      setDeleteAccountOpen(false);
    }
  };

  const handleReplayTutorials = () => {
    if (!user?.id) return;
    resetOnboarding(user.id);
    resetModuleIntros(user.id);
    toast({
      description:
        locale === "es"
          ? "Listo. Verás el tutorial de bienvenida al volver al inicio, y cada módulo te mostrará su intro la próxima vez que lo abras."
          : locale === "zh"
            ? "已重置。返回首页会再次看到欢迎教程，每个模块下次打开也会再显示一次介绍。"
            : "Done. You'll see the welcome tutorial next time you go to Home, and each module will show its intro again the next time you open it.",
    });
    // Reload (not just navigate) so AuthGate re-runs its onboarding check on mount.
    window.location.href = "/home";
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-card/80 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3 shadow-sm">
        <Button variant="ghost" size="icon" onClick={() => window.history.back()} className="-ml-2">
          <ArrowLeft className="w-5 h-5 text-foreground/70" />
        </Button>
        <div>
          <h1 className="font-bold text-foreground">{t("settings_title")}</h1>
          <p className="text-xs text-muted-foreground">U Core</p>
        </div>
      </header>

      <main className="flex-1 p-4 space-y-4 max-w-lg mx-auto w-full overflow-y-auto min-h-0">

        {/* Visual Theme */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Monitor className="w-4 h-4 text-primary" />
            <p className="font-bold text-foreground text-sm">{t("settings_theme")}</p>
          </div>
          <div className="p-4 grid grid-cols-3 gap-3">
            {THEMES.map((th) => (
              <button
                key={th.id}
                type="button"
                onClick={() => setTheme(th.id)}
                className={[
                  "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                  theme === th.id
                    ? "border-primary bg-primary/10 scale-[1.03]"
                    : "border-border hover:border-primary/40",
                ].join(" ")}
              >
                <div
                  className="w-full h-10 rounded-lg overflow-hidden relative"
                  style={{ backgroundColor: th.previewBg }}
                >
                  {/* mini nav bar preview */}
                  <div className="absolute bottom-0 left-0 right-0 h-3 flex items-center justify-around px-1"
                    style={{ borderTop: `1px solid ${th.muted}40` }}>
                    {[0, 1, 2, 3].map(i => (
                      <span key={i} className="rounded-full"
                        style={{
                          width: i === 1 ? "12px" : "6px",
                          height: i === 1 ? "3px" : "3px",
                          backgroundColor: i === 1 ? th.accent : th.muted,
                        }} />
                    ))}
                  </div>
                  {/* accent bar at top */}
                  <div className="absolute top-0 left-0 w-8 h-0.5 rounded-full" style={{ backgroundColor: th.accent }} />
                </div>
                <span className="text-lg">{th.emoji}</span>
                <span className="text-xs font-semibold text-foreground text-center leading-tight">
                  {t(th.labelKey as any)}
                </span>
                {theme === th.id && (
                  <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-primary-foreground" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Language */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            <p className="font-bold text-foreground text-sm">{t("settings_language")}</p>
          </div>
          <div className="divide-y divide-border">
            {LANGUAGES.map(lang => (
              <button
                key={lang.code}
                type="button"
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/50 transition-colors text-left"
                onClick={() => changeLocale(lang.code)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{lang.flag}</span>
                  <div>
                    <p className="font-semibold text-foreground text-sm">{lang.native}</p>
                    <p className="text-xs text-muted-foreground">{lang.label}</p>
                  </div>
                </div>
                {locale === lang.code && (
                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-3 h-3 text-primary-foreground" />
                  </div>
                )}
              </button>
            ))}
          </div>
          {locale === "zh" && profile?.role !== "player" && (
            <div className="px-5 py-3 bg-amber-50 dark:bg-amber-950/20 border-t border-amber-100 dark:border-amber-900">
              <p className="text-xs text-amber-700 dark:text-amber-400">
                ⚠️ {t("settings_zh_warning")}
              </p>
            </div>
          )}
        </div>

        {/* Tutoriales */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-primary" />
            <p className="font-bold text-foreground text-sm">
              {locale === "es" ? "Tutoriales" : locale === "zh" ? "教程" : "Tutorials"}
            </p>
          </div>
          <button
            type="button"
            onClick={handleReplayTutorials}
            className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-muted/50 transition-colors text-left"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {locale === "es" ? "Ver los tutoriales otra vez" : locale === "zh" ? "重新查看教程" : "Watch the tutorials again"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {locale === "es"
                  ? "Bienvenida + la intro de cada módulo, la próxima vez que lo abras."
                  : locale === "zh"
                    ? "欢迎教程 + 下次打开各模块时再次显示介绍。"
                    : "Welcome tutorial + each module's intro, next time you open it."}
              </p>
            </div>
          </button>
        </div>

        {/* App info */}
        <div className="bg-card rounded-2xl border border-border shadow-sm px-5 py-4 space-y-3">
          <p className="font-bold text-foreground text-sm">{t("settings_about")}</p>
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>U Core</span>
              <span className="font-semibold text-foreground">v1.0</span>
            </div>
            <div className="flex justify-between">
              <span>{t("settings_motor")}</span>
              {/* CORREGIDO 2026-09-15 (pasada de fricción/cosmética): decía "v4"
                  desde antes de que ReportSlidesV1.tsx pasara a motor-v1 (spec
                  motor-1.0 sección 23/28) -- etiqueta visible a cualquier coach,
                  técnicamente incorrecta desde entonces. */}
              <span className="font-semibold text-foreground">Motor 1.0</span>
            </div>
            <div className="flex justify-between">
              <span>{t("settings_archetypes")}</span>
              {/* CORREGIDO 2026-09-15: decía "18", resto de la era motor-v4/legacy
                  -- el catálogo real de motor-v1 (ArchetypeKey, motor-v1-types.ts)
                  tiene 10 arquetipos, verificado contando el propio union type. */}
              <span className="font-semibold text-foreground">10</span>
            </div>
          </div>
        </div>

        {/* AÑADIDO 2026-09-15 (pasada de fricción/cosmética): PlayerHomeSettingsStub.tsx
            (jugadoras) ya tenía este enlace de soporte -- Settings.tsx (staff) no
            tenía ninguno, pese a ser quien más probablemente necesite ayuda
            gestionando el club. Mismas claves i18n (el texto ya es genérico,
            no específico de jugadora). */}
        <a
          href="mailto:support@uscout.app?subject=U%20Core%20support"
          className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4 shadow-sm hover:bg-muted/40 transition-colors"
        >
          <LifeBuoy className="w-5 h-5 text-primary shrink-0" />
          <div className="min-w-0">
            <p className="font-bold text-foreground text-sm">{t("player_settings_help_title")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t("player_settings_help_sub")}</p>
          </div>
        </a>

        {/* Account */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            <p className="font-bold text-foreground text-sm">{t("settings_account")}</p>
          </div>
          {profile && (
            <div className="px-5 py-3 border-b border-border space-y-1">
              <p className="text-xs text-muted-foreground">{t("settings_email")}</p>
              <p className="text-sm font-medium text-foreground">{profile.email}</p>
              <p className="text-xs text-muted-foreground capitalize">{profile.role}</p>
            </div>
          )}
          {canUseRolePreview ? (
            <div className="px-5 py-4 border-b border-border space-y-2">
              <p className="text-xs font-bold tracking-widest uppercase text-muted-foreground">
                {t("dev_role_preview_title")}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={previewRole ? "outline" : "secondary"}
                  className="flex-1"
                  onClick={() => setPreviewRole(null)}
                  data-testid="dev-role-real"
                >
                  {t("dev_role_use_real")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={previewRole === "player" ? "secondary" : "outline"}
                  className="flex-1"
                  onClick={() => setPreviewRole("player")}
                  data-testid="dev-role-player"
                >
                  {t("dev_role_preview_player")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={previewRole && previewRole !== "player" ? "secondary" : "outline"}
                  className="flex-1"
                  onClick={() => setPreviewRole("coach")}
                  data-testid="dev-role-staff"
                >
                  {t("dev_role_preview_staff")}
                </Button>
              </div>
              <p className="text-[11px] md:text-sm text-muted-foreground">
                {t("dev_role_preview_note")}
              </p>
            </div>
          ) : null}
          <button
            type="button"
            className="w-full flex items-center gap-3 px-5 py-4 hover:bg-destructive/10 transition-colors text-left"
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4 text-destructive" />
            <span className="text-sm font-semibold text-destructive">{t("settings_sign_out")}</span>
          </button>
          <button
            type="button"
            className="w-full flex items-center gap-3 px-5 py-4 border-t border-border hover:bg-destructive/10 transition-colors text-left"
            onClick={() => setDeleteAccountOpen(true)}
            data-testid="settings-delete-account"
          >
            <Trash2 className="w-4 h-4 text-destructive" />
            <span className="text-sm font-semibold text-destructive">{t("settings_delete_account")}</span>
          </button>
        </div>

        <AlertDialog open={deleteAccountOpen} onOpenChange={(o) => { if (!deletingAccount) setDeleteAccountOpen(o); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("settings_delete_account_confirm_title")}</AlertDialogTitle>
              <AlertDialogDescription>{t("settings_delete_account_confirm_body")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deletingAccount}>{t("cancel")}</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deletingAccount}
                onClick={(e) => { e.preventDefault(); void handleDeleteAccount(); }}
              >
                {t("settings_delete_account_confirm_ok")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </main>
    </div>
  );
}
