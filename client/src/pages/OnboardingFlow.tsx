import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Check, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale, type Locale } from "@/lib/i18n";
import { applyThemeToDocument, type Theme } from "@/lib/theme";
import { completeOnboarding } from "@/lib/onboarding-state";
import { cn } from "@/lib/utils";

const THEMES: { id: Theme; emoji: string; labelKey: "theme_gamenight" | "theme_office" | "theme_oldschool"; previewBg: string; dot1: string; dot2: string }[] = [
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

const LANGS: { code: Locale; native: string; flag: string }[] = [
  { code: "en", native: "English", flag: "🇬🇧" },
  { code: "es", native: "Español", flag: "🇪🇸" },
  { code: "zh", native: "中文", flag: "🇨🇳" },
];

const TUTORIAL_SLIDES = ["scout", "club", "reports", "settings"] as const;

type Step = "language" | "theme" | "tutorial";

function FakePhoneFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[220px] rounded-[1.25rem] border-4 border-foreground/20 bg-muted/40 shadow-xl overflow-hidden",
        className,
      )}
    >
      <div className="h-2 bg-foreground/10 flex items-center justify-center">
        <span className="h-1 w-8 rounded-full bg-foreground/20" />
      </div>
      <div className="aspect-[9/14] bg-gradient-to-b from-card to-muted/80 p-3 flex flex-col gap-2">{children}</div>
    </div>
  );
}

export default function OnboardingFlow({
  userId,
  onDone,
}: {
  userId: string;
  onDone: () => void;
}) {
  const { t, changeLocale, locale } = useLocale();
  const [step, setStep] = useState<Step>("language");
  const [theme, setThemeLocal] = useState<Theme>(() => {
    try {
      const raw = localStorage.getItem("uscout-theme");
      if (raw === "gamenight" || raw === "office" || raw === "oldschool") return raw;
    } catch {
      /* ignore */
    }
    return "gamenight";
  });
  const [tutorialIdx, setTutorialIdx] = useState(0);

  const applyTheme = useCallback((next: Theme) => {
    setThemeLocal(next);
    try {
      localStorage.setItem("uscout-theme", next);
    } catch {
      /* ignore */
    }
    applyThemeToDocument(next);
  }, []);

  const pickLanguage = (code: Locale) => {
    changeLocale(code);
    setStep("theme");
  };

  const finish = useCallback(() => {
    completeOnboarding(userId);
    onDone();
  }, [userId, onDone]);

  const slides = useMemo(
    () =>
      TUTORIAL_SLIDES.map((id) => ({
        id,
        title: t(`onboarding_slide_${id}_title` as never),
        body: t(`onboarding_slide_${id}_body` as never),
      })),
    [t],
  );

  const slideVisual = (id: (typeof TUTORIAL_SLIDES)[number]) => {
    switch (id) {
      case "scout":
        return (
          <FakePhoneFrame>
            <div className="h-2 w-1/3 rounded bg-primary/80" />
            <div className="flex-1 rounded-lg border border-border bg-background/80 p-2 space-y-1.5">
              <div className="h-2 w-2/3 rounded bg-primary/30" />
              <div className="h-2 w-full rounded bg-muted" />
              <div className="h-2 w-5/6 rounded bg-muted" />
            </div>
            <div className="h-8 rounded-md bg-primary/20 border border-primary/30" />
          </FakePhoneFrame>
        );
      case "club":
        return (
          <FakePhoneFrame>
            <div className="flex gap-1">
              <div className="h-6 flex-1 rounded bg-primary/25" />
              <div className="h-6 flex-1 rounded bg-muted" />
            </div>
            <div className="flex-1 rounded-lg border border-dashed border-border flex items-center justify-center text-2xl">
              🛡️
            </div>
          </FakePhoneFrame>
        );
      case "reports":
        return (
          <FakePhoneFrame>
            <div className="grid grid-cols-2 gap-1 flex-1">
              <div className="rounded bg-card border border-border p-1 space-y-1">
                <div className="h-6 rounded bg-destructive/20" />
                <div className="h-2 w-full rounded bg-muted" />
              </div>
              <div className="rounded bg-card border border-border p-1 space-y-1">
                <div className="h-6 rounded bg-blue-500/20" />
                <div className="h-2 w-full rounded bg-muted" />
              </div>
            </div>
          </FakePhoneFrame>
        );
      case "settings":
        return (
          <FakePhoneFrame>
            <div className="space-y-2 flex-1 flex flex-col justify-center">
              <div className="h-8 rounded-lg bg-muted border border-border flex items-center px-2 gap-2">
                <span className="text-xs">🌐</span>
                <div className="h-2 flex-1 rounded bg-foreground/10" />
              </div>
              <div className="h-8 rounded-lg bg-muted border border-border flex items-center px-2 gap-2">
                <span className="text-xs">🎨</span>
                <div className="h-2 flex-1 rounded bg-foreground/10" />
              </div>
            </div>
          </FakePhoneFrame>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background text-foreground px-5 pt-10 pb-8 max-w-md mx-auto w-full">
      {step === "language" && (
        <>
          <p className="text-center text-xs text-muted-foreground mb-6 leading-relaxed">{t("onboarding_lang_prompt_trilingual")}</p>
          <h1 className="text-2xl font-black text-center tracking-tight mb-2">{t("onboarding_pick_language_title")}</h1>
          <p className="text-sm text-muted-foreground text-center mb-8">{t("onboarding_pick_language_sub")}</p>
          <div className="flex flex-col gap-3">
            {LANGS.map((L) => (
              <button
                key={L.code}
                type="button"
                onClick={() => pickLanguage(L.code)}
                className="flex items-center gap-4 w-full rounded-2xl border-2 border-border bg-card p-4 text-left transition-all hover:border-primary hover:bg-primary/5"
              >
                <span className="text-2xl">{L.flag}</span>
                <span className="text-lg font-bold flex-1">{L.native}</span>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </button>
            ))}
          </div>
        </>
      )}

      {step === "theme" && (
        <>
          <h1 className="text-2xl font-black text-center tracking-tight mb-2">{t("onboarding_pick_theme_title")}</h1>
          <p className="text-sm text-muted-foreground text-center mb-8">{t("onboarding_pick_theme_sub")}</p>
          <div className="grid grid-cols-3 gap-3 mb-auto">
            {THEMES.map((th) => (
              <button
                key={th.id}
                type="button"
                onClick={() => applyTheme(th.id)}
                className={cn(
                  "flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all",
                  theme === th.id ? "border-primary bg-primary/10 scale-[1.02]" : "border-border hover:border-primary/40",
                )}
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
                <span className="text-[11px] font-semibold text-center leading-tight">{t(th.labelKey)}</span>
                {theme === th.id && (
                  <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-primary-foreground" />
                  </div>
                )}
              </button>
            ))}
          </div>
          <Button className="w-full h-12 rounded-xl font-bold mt-8" onClick={() => setStep("tutorial")}>
            {t("onboarding_tutorial_next")}
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </>
      )}

      {step === "tutorial" && (
        <>
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t("coach_mode")}</span>
            <button
              type="button"
              onClick={finish}
              className="text-sm font-semibold text-primary underline underline-offset-2"
            >
              {t("onboarding_tutorial_skip")}
            </button>
          </div>
          <div className="flex-1 flex flex-col min-h-0">
            {slideVisual(TUTORIAL_SLIDES[tutorialIdx])}
            <h2 className="text-xl font-black text-center mt-6 mb-2">{slides[tutorialIdx]?.title}</h2>
            <p className="text-sm text-muted-foreground text-center leading-relaxed mb-6">{slides[tutorialIdx]?.body}</p>
            <div className="flex justify-center gap-1.5 mb-6">
              {TUTORIAL_SLIDES.map((_, i) => (
                <span
                  key={i}
                  className={cn("h-1.5 rounded-full transition-all", i === tutorialIdx ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30")}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2 mt-auto">
            {tutorialIdx > 0 && (
              <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setTutorialIdx((i) => i - 1)}>
                {t("back")}
              </Button>
            )}
            <Button
              className="flex-1 h-12 rounded-xl font-bold"
              onClick={() => {
                if (tutorialIdx >= TUTORIAL_SLIDES.length - 1) finish();
                else setTutorialIdx((i) => i + 1);
              }}
            >
              {tutorialIdx >= TUTORIAL_SLIDES.length - 1 ? t("onboarding_tutorial_done") : t("onboarding_tutorial_next")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
