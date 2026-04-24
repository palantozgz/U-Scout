import { useLocation } from "wouter";
import { ArrowLeft, Check, Globe, LogOut, User, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale, type Locale } from "@/lib/i18n";
import { useAuth, type AppUserRole } from "@/lib/useAuth";

const LANGUAGES: { code: Locale; label: string; native: string; flag: string }[] = [
  { code: "en", label: "English", native: "English", flag: "🇬🇧" },
  { code: "es", label: "Spanish", native: "Español", flag: "🇪🇸" },
  { code: "zh", label: "Chinese", native: "中文", flag: "🇨🇳" },
];

const ROLE_LABEL: Record<AppUserRole, "role_master" | "role_head_coach" | "role_coach" | "role_player"> = {
  master: "role_master",
  head_coach: "role_head_coach",
  coach: "role_coach",
  player: "role_player",
};

/** Player-facing settings (minimal): profile, language, help, sign out. */
export default function PlayerHomeSettingsStub() {
  const { t, locale, changeLocale } = useLocale();
  const [, setLocation] = useLocation();
  const { profile, previewRole, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    setLocation("/login");
  };

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-20 bg-card/90 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/home")} className="-ml-2">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </Button>
        <h1 className="font-bold text-foreground">{t("player_settings_page_title")}</h1>
      </header>

      <main className="flex-1 p-4 space-y-4 max-w-lg mx-auto w-full pb-10">
        {previewRole ? (
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-bold text-foreground">{t("dev_preview_active_banner_title")}</p>
            <p className="mt-1 text-xs font-medium text-muted-foreground">{t("dev_preview_active_banner_body")}</p>
            <Button className="mt-3 w-full" variant="secondary" onClick={() => setLocation("/settings")}>
              {t("dev_preview_open_settings")}
            </Button>
          </div>
        ) : null}

        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            <p className="font-bold text-foreground text-sm">{t("player_settings_profile_section")}</p>
          </div>
          {profile ? (
            <div className="px-5 py-4 space-y-2">
              <p className="text-sm font-semibold text-foreground">{profile.username}</p>
              <p className="text-xs text-muted-foreground">{profile.email}</p>
              <p className="text-xs font-medium text-muted-foreground capitalize">{t(ROLE_LABEL[profile.role])}</p>
            </div>
          ) : (
            <p className="px-5 py-4 text-sm text-muted-foreground">{t("player_settings_profile_missing")}</p>
          )}
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            <p className="font-bold text-foreground text-sm">{t("settings_language")}</p>
          </div>
          <div className="divide-y divide-border">
            {LANGUAGES.map((lang) => (
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
                {locale === lang.code ? (
                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-3 h-3 text-primary-foreground" />
                  </div>
                ) : null}
              </button>
            ))}
          </div>
        </div>

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

        <button
          type="button"
          className="w-full flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4 shadow-sm hover:bg-destructive/10 transition-colors text-left"
          onClick={() => void handleSignOut()}
        >
          <LogOut className="w-4 h-4 text-destructive shrink-0" />
          <span className="text-sm font-semibold text-destructive">{t("settings_sign_out")}</span>
        </button>
      </main>
    </div>
  );
}
