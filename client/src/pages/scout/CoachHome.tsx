import { useLocation } from "wouter";
import { useLocale } from "@/lib/i18n";
import { useAuth } from "@/lib/useAuth";
import { Pencil, FileText, ChevronRight } from "lucide-react";
import type { AppUserRole } from "@/lib/useAuth";
import { ModuleNav } from "@/pages/core/ModuleNav";
import { ModuleHeader } from "@/components/branding/ModuleHeader";

const ROLE_LABEL_KEY: Record<AppUserRole, "role_master" | "role_head_coach" | "role_coach" | "role_player"> = {
  master: "role_master",
  head_coach: "role_head_coach",
  coach: "role_coach",
  player: "role_player",
};

export default function CoachHome() {
  const { t } = useLocale();
  const [, setLocation] = useLocation();
  const { profile } = useAuth();

  const displayName = profile?.username?.trim() || profile?.email || t("coach_home_name_fallback");
  const roleLabel = profile?.role ? t(ROLE_LABEL_KEY[profile.role]) : "";

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background text-foreground overflow-hidden pb-16">
      <main className="relative z-10 flex flex-col flex-1 px-5 pb-6 max-w-md mx-auto w-full">
        <ModuleHeader module="scout" tagline={t("tagline_scout")} />

        <div className="mb-4 h-px w-full max-w-[280px] mx-auto bg-border" />

        <div className="flex flex-col gap-4 flex-1 justify-center">
          <button
            type="button"
            onClick={() => setLocation("/coach/editor")}
            className="group w-full text-left rounded-lg border border-border bg-card p-4 flex items-stretch gap-4 transition-all duration-200 hover:border-primary hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.35)]"
            data-testid="coach-home-editor"
          >
            <div className="flex items-center justify-center w-14 shrink-0 text-primary">
              <Pencil className="w-9 h-9" strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0 py-0.5">
              <p className="text-lg font-black text-foreground tracking-tight">{t("coach_home_scout_title")}</p>
              <p className="text-xs text-muted-foreground mt-1 font-medium">{t("coach_home_scout_sub")}</p>
            </div>
            <div className="flex items-center pr-1 text-muted-foreground group-hover:text-primary transition-transform duration-200 group-hover:translate-x-1">
              <ChevronRight className="w-6 h-6" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => setLocation("/coach/reports")}
            className="group w-full text-left rounded-lg border border-border bg-card p-4 flex items-stretch gap-4 transition-all duration-200 hover:border-primary hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.35)]"
            data-testid="coach-home-reports"
          >
            <div className="flex items-center justify-center w-14 shrink-0 text-primary">
              <FileText className="w-9 h-9" strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0 py-0.5">
              <p className="text-lg font-black text-foreground tracking-tight">{t("coach_home_reports_title")}</p>
              <p className="text-xs text-muted-foreground mt-1 font-medium">{t("coach_home_reports_sub")}</p>
            </div>
            <div className="flex items-center pr-1 text-muted-foreground group-hover:text-primary transition-transform duration-200 group-hover:translate-x-1">
              <ChevronRight className="w-6 h-6" />
            </div>
          </button>
        </div>

        <div className="mt-auto pt-7 pb-1 flex flex-col items-center border-t border-border/80">
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground">{displayName}</p>
            {roleLabel && (
              <p className="text-[11px] text-muted-foreground mt-0.5 tracking-wide">{roleLabel}</p>
            )}
          </div>
        </div>
      </main>
      <ModuleNav />
    </div>
  );
}
