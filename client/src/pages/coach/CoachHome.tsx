import { useLocation } from "wouter";
import { useLocale } from "@/lib/i18n";
import { useAuth } from "@/lib/useAuth";
import { Button } from "@/components/ui/button";
import { Pencil, FileText, Settings, LogOut, ChevronRight } from "lucide-react";
import { UScoutLogoStatic } from "@/components/branding/UScoutBrand";

function formatRole(role: string): string {
  return role
    .split("_")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function CoachHome() {
  const { t } = useLocale();
  const [, setLocation] = useLocation();
  const { signOut, profile } = useAuth();

  const displayName = profile?.username?.trim() || profile?.email || "Coach";
  const roleLabel = profile?.role ? formatRole(profile.role) : "";

  return (
    <div
      className="flex flex-col min-h-[100dvh] text-foreground overflow-hidden"
      style={{ backgroundColor: "#060a14" }}
    >
      <button
        type="button"
        onClick={() => setLocation("/settings")}
        className="absolute top-4 right-4 z-20 p-2 rounded-lg text-[#64748b] hover:text-[#93c5fd] hover:bg-[#1e2d4a]/50 transition-colors"
        title={t("settings_title")}
        data-testid="coach-home-settings"
        aria-label={t("settings_title")}
      >
        <Settings className="w-5 h-5" />
      </button>

      <main className="relative z-10 flex flex-col flex-1 px-5 pt-10 pb-6 max-w-md mx-auto w-full">
        <div className="flex flex-col items-center pt-4">
          <UScoutLogoStatic />
          <p className="mt-4 text-[10px] sm:text-[11px] font-semibold tracking-[0.45em] text-[#334155] uppercase">
            SCOUTING PLATFORM
          </p>
        </div>

        <div
          className="mt-8 mb-8 h-px w-full max-w-[280px] mx-auto"
          style={{ backgroundColor: "#1e2d4a" }}
        />

        <div className="flex flex-col gap-4 flex-1 justify-center">
          <button
            type="button"
            onClick={() => setLocation("/coach/editor")}
            className="group w-full text-left rounded-lg border border-[#1e2d4a] bg-[#0d1526] p-4 flex items-stretch gap-4 transition-all duration-200 hover:border-[hsl(var(--primary))] hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.35)]"
            data-testid="coach-home-editor"
          >
            <div className="flex items-center justify-center w-14 shrink-0 text-[hsl(var(--primary))]">
              <Pencil className="w-9 h-9" strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0 py-0.5">
              <p className="text-lg font-black text-[#f1f5f9] tracking-tight">SCOUT</p>
              <p className="text-xs text-[#64748b] mt-1 font-medium">Build scouting reports</p>
            </div>
            <div className="flex items-center pr-1 text-[#64748b] group-hover:text-[hsl(var(--primary))] transition-transform duration-200 group-hover:translate-x-1">
              <ChevronRight className="w-6 h-6" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => setLocation("/coach/reports")}
            className="group w-full text-left rounded-lg border border-[#1e2d4a] bg-[#0d1526] p-4 flex items-stretch gap-4 transition-all duration-200 hover:border-[hsl(var(--primary))] hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.35)]"
            data-testid="coach-home-reports"
          >
            <div className="flex items-center justify-center w-14 shrink-0 text-[#93c5fd]">
              <FileText className="w-9 h-9" strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0 py-0.5">
              <p className="text-lg font-black text-[#f1f5f9] tracking-tight">REPORTS</p>
              <p className="text-xs text-[#64748b] mt-1 font-medium">Game preparation</p>
            </div>
            <div className="flex items-center pr-1 text-[#64748b] group-hover:text-[hsl(var(--primary))] transition-transform duration-200 group-hover:translate-x-1">
              <ChevronRight className="w-6 h-6" />
            </div>
          </button>
        </div>

        <div className="mt-auto pt-8 flex flex-col items-center gap-3 border-t border-[#1e2d4a]/80">
          <div className="text-center">
            <p className="text-sm font-semibold text-[#f1f5f9]">{displayName}</p>
            {roleLabel && (
              <p className="text-[11px] text-[#64748b] mt-0.5 tracking-wide">{roleLabel}</p>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void signOut()}
            className="text-[#64748b] hover:text-[#f1f5f9] hover:bg-[#1e2d4a]/40 rounded-lg h-9 px-4 text-xs font-semibold"
            data-testid="coach-home-logout"
          >
            <LogOut className="w-3.5 h-3.5 mr-2" />
            {t("settings_sign_out")}
          </Button>
        </div>
      </main>
    </div>
  );
}
