import { useLocation } from "wouter";
import { ArrowLeft, Globe, Check, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale, type Locale } from "@/lib/i18n";
import { useAuth } from "@/lib/useAuth";

const LANGUAGES: { code: Locale; label: string; native: string; flag: string }[] = [
  { code: "en", label: "English",  native: "English", flag: "🇬🇧" },
  { code: "es", label: "Spanish",  native: "Español",  flag: "🇪🇸" },
  { code: "zh", label: "Chinese",  native: "中文",     flag: "🇨🇳" },
];

export default function Settings() {
  const [, setLocation] = useLocation();
  const { locale, changeLocale, t } = useLocale();
  const { profile, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    setLocation("/login");
  };

  return (
    <div className="flex flex-col min-h-[100dvh] bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center gap-3 shadow-sm">
        <Button variant="ghost" size="icon" onClick={() => window.history.back()} className="-ml-2">
          <ArrowLeft className="w-5 h-5 text-slate-700 dark:text-slate-300" />
        </Button>
        <div>
          <h1 className="font-bold text-slate-900 dark:text-white">{t("settings_title")}</h1>
          <p className="text-xs text-slate-400">U Scout</p>
        </div>
      </header>

      <main className="flex-1 p-4 space-y-4 max-w-lg mx-auto w-full">

        {/* Language */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            <p className="font-bold text-slate-900 dark:text-white text-sm">{t("settings_language")}</p>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {LANGUAGES.map(lang => (
              <button
                key={lang.code}
                type="button"
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
                onClick={() => changeLocale(lang.code)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{lang.flag}</span>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white text-sm">{lang.native}</p>
                    <p className="text-xs text-slate-400">{lang.label}</p>
                  </div>
                </div>
                {locale === lang.code && (
                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
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
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm px-5 py-4 space-y-3">
          <p className="font-bold text-slate-900 dark:text-white text-sm">{t("settings_about")}</p>
          <div className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex justify-between">
              <span>U Scout</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">v0.1</span>
            </div>
        <div className="flex justify-between">
              <span>{t("settings_motor")}</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">v3 — Archetypal</span>
            </div>
            <div className="flex justify-between">
              <span>{t("settings_archetypes")}</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">18</span>
            </div>
          </div>
        </div>

        {/* Account */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            <p className="font-bold text-slate-900 dark:text-white text-sm">{t("settings_account")}</p>
          </div>
          {profile && (
            <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-80space-y-1">
              <p className="text-xs text-slate-400">{t("settings_email")}</p>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{profile.email}</p>
              <p className="text-xs text-slate-400 capitalize">{profile.role}</p>
            </div>
          )}
          <button
            type="button"
            className="w-full flex items-center gap-3 px-5 py-4 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors text-left"
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4 text-red-500" />
            <span className="text-sm font-semibold text-red-500">{t("settings_sign_out")}</span>
          </button>
        </div>

      </main>
    </div>
  );
}
