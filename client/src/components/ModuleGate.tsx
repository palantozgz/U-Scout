import type { ReactNode } from "react";
import { useLocation } from "wouter";
import { Lock } from "lucide-react";
import { useLocale } from "@/lib/i18n";
import { useIsModuleEnabled } from "@/lib/moduleAccess";
import type { ClubModuleKey } from "@shared/club-context";
import { ModuleNav } from "@/pages/core/ModuleNav";

/**
 * Gates one of the 4 disable-able U Core modules (schedule/scout/stats/playbook)
 * behind clubs.disabled_modules — see moduleAccess.ts. Head coach and master
 * always pass through. Everyone else sees a friendly "not available yet" screen
 * instead of the real page when the head coach has turned that module off
 * (e.g. preseason: only Schedule+Wellness active, Playbook added later).
 */
export function ModuleGate({ moduleKey, children }: { moduleKey: ClubModuleKey; children: ReactNode }) {
  const { enabled, loading } = useIsModuleEnabled(moduleKey);
  const { locale } = useLocale();
  const [, setLocation] = useLocation();

  // Avoid flashing the "disabled" screen before we actually know the club setting.
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh] bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (enabled) return <>{children}</>;

  const es = locale === "es";
  const zh = locale === "zh";
  return (
    <div className="flex flex-col h-[100dvh] bg-background pb-16 md:pb-0">
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="w-14 h-14 rounded-full bg-muted/40 flex items-center justify-center">
          <Lock className="w-6 h-6 text-muted-foreground" />
        </div>
        <p className="text-base font-black text-foreground">
          {es ? "Todavía no disponible" : zh ? "暂未开放" : "Not available yet"}
        </p>
        <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
          {es
            ? "Tu cuerpo técnico activará este módulo más adelante."
            : zh
              ? "教练组稍后会开放此功能。"
              : "Your coaching staff will turn this on later."}
        </p>
        <button
          type="button"
          onClick={() => setLocation("/home")}
          className="mt-2 h-11 px-6 rounded-xl bg-primary text-primary-foreground text-sm font-bold"
        >
          {es ? "Ir al inicio" : zh ? "返回首页" : "Back to Home"}
        </button>
      </div>
      <ModuleNav />
    </div>
  );
}
