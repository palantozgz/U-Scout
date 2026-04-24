import { useLocation } from "wouter";
import { ArrowLeft, Globe, Check, LogOut, User, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale, type Locale } from "@/lib/i18n";
import { useAuth } from "@/lib/useAuth";
import { useTheme, type Theme } from "@/lib/theme";

const LANGUAGES: { code: Locale; label: string; native: string; flag: string }[] = [
  { code: "en", label: "English",  native: "English", flag: "🇬🇧" },
  { code: "es", label: "Spanish",  native: "Español",  flag: "🇪🇸" },
  { code: "zh", label: "Chinese",  native: "中文",     flag: "🇨🇳" },
];

const THEMES: { id: Theme; emoji: string; labelKey: string; previewBg: string; dot1: string; dot2: string }[] = [
  {
    id: "gamenight",
    emoji: "🌙",
    labelKey: "theme_gamenight",
    previewBg: "hsl(222, 47%, 5%)",
    dot1: "#3b82f6",
    dot2: "#f97316",
  },
  {
    id: "office",
    emoji: "📋",
    labelKey: "theme_office",
    previewBg: "#ffffff",
    dot1: "#1d4ed8",
    dot2: "#94a3b8",
  },
  {
    id: "oldschool",
    emoji: "🏀",
    labelKey: "theme_oldschool",
    previewBg: "hsl(35,28%,91%)",
    dot1: "#92400e",
    dot2: "#b45309",
  },
];

export default function Settings() {
  const [, setLocation] = useLocation();
  const { locale, changeLocale, t } = useLocale();
  const { profile, signOut, canUseRolePreview, previewRole, setPreviewRole } = useAuth();
  const { theme, setTheme } = useTheme();

  const handleSignOut = async () => {
    await signOut();
    setLocation("/login");
  };

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-card/80 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3 shadow-sm">
        <Button variant="ghost" size="icon" onClick={() => window.history.back()} className="-ml-2">
          <ArrowLeft className="w-5 h-5 text-foreground/70" />
        </Button>
        <div>
          <h1 className="font-bold text-foreground">{t("settings_title")}</h1>
          <p className="text-xs text-muted-foreground">U Scout</p>
        </div>
      </header>

      <main className="flex-1 p-4 space-y-4 max-w-lg mx-auto w-full">

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
                  "flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all",
                  theme === th.id
                    ? "border-primary bg-primary/10 scale-[1.03]"
                    : "border-border hover:border-primary/40",
                ].join(" ")}
              >
                <div
                  className="w-full h-10 rounded-lg flex items-end justify-center gap-1 pb-1.5"
                  style={{ backgroundColor: th.previewBg }}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: th.dot1 }} />
                  <span className="w-2 h-4 rounded-full" style={{ backgroundColor: th.dot2 }} />
                  <span className="w-2 h-3 rounded-full" style={{ backgroundColor: th.dot1 }} />
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
          {locale === "zh" && (
            <div className="px-5 py-3 bg-amber-50 dark:bg-amber-950/20 border-t border-amber-100 dark:border-amber-900">
              <p className="text-xs text-amber-700 dark:text-amber-400">
                ⚠️ {t("settings_zh_warning")}
              </p>
            </div>
          )}
        </div>

        {/* App info */}
        <div className="bg-card rounded-2xl border border-border shadow-sm px-5 py-4 space-y-3">
          <p className="font-bold text-foreground text-sm">{t("settings_about")}</p>
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>U Scout</span>
              <span className="font-semibold text-foreground">v0.1</span>
            </div>
            <div className="flex justify-between">
              <span>{t("settings_motor")}</span>
              <span className="font-semibold text-foreground">v3 — Archetypal</span>
            </div>
            <div className="flex justify-between">
              <span>{t("settings_archetypes")}</span>
              <span className="font-semibold text-foreground">18</span>
            </div>
          </div>
        </div>

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
              <p className="text-[11px] text-muted-foreground">
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
        </div>

      </main>
    </div>
  );
}
