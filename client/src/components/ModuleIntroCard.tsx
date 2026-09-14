import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/i18n";
import { useAuth } from "@/lib/useAuth";
import { hasSeenModuleIntro, markModuleIntroSeen, type ModuleIntroKey } from "@/lib/onboarding-state";

/**
 * "First time you open this module" card (spec sección 44) — independent of the
 * main OnboardingFlow (language/theme/role-tutorial, shown once right after
 * registration). A coach or player can finish that and still never have opened
 * e.g. Stats — this shows a single dismissible card the first real time they
 * land on a gated module, then never again unless replayed from Settings.
 *
 * Deliberately NOT a multi-slide wizard like the main onboarding: showing that
 * on every module's first visit (potentially 5 times back to back for a new
 * user clicking around) would be tutorial fatigue, not helpful. One glanceable
 * card, dismissible any time (X, backdrop click, or the button), never blocks
 * the real screen underneath.
 */
export function ModuleIntroCard({
  moduleKey,
  emoji,
  title,
  body,
}: {
  moduleKey: ModuleIntroKey;
  emoji: string;
  title: string;
  body: string;
}) {
  const { locale } = useLocale();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    if (!hasSeenModuleIntro(user.id, moduleKey)) setOpen(true);
  }, [user?.id, moduleKey]);

  const dismiss = () => {
    if (user?.id) markModuleIntroSeen(user.id, moduleKey);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) dismiss(); }}>
      <DialogContent className="max-w-[340px] rounded-2xl text-center gap-4" data-testid={`module-intro-${moduleKey}`}>
        <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-3xl">
          {emoji}
        </div>
        <div className="space-y-1.5">
          <DialogTitle className="text-lg font-black text-foreground text-center">{title}</DialogTitle>
          <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
        </div>
        <Button className="w-full h-11 rounded-xl font-bold" onClick={dismiss}>
          {locale === "es" ? "Entendido" : locale === "zh" ? "知道了" : "Got it"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
