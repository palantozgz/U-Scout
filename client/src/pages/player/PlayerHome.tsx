import { useLocation } from "wouter";
import { ArrowLeft, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/i18n";
import { useAuth } from "@/lib/useAuth";
import { usePlayerHome } from "@/lib/player-home";
import { BasketballPlaceholderAvatar } from "@/components/BasketballPlaceholderAvatar";
import { isRealPhoto } from "@/lib/utils";

export default function PlayerHome() {
  const { t } = useLocale();
  const [, setLocation] = useLocation();
  const { profile } = useAuth();
  const { data, isLoading, isError } = usePlayerHome();

  const displayName =
    data?.membership?.displayName?.trim() ||
    profile?.username ||
    profile?.email ||
    "—";
  const jersey = data?.membership?.jerseyNumber?.trim() || "—";
  const position = data?.membership?.position?.trim() || "—";
  const avatarUrl = profile?.avatar_url ?? "";
  const real = isRealPhoto(avatarUrl);

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-20 bg-card/90 backdrop-blur-md border-b border-border px-3 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => setLocation("/player")}
            aria-label={t("player_back_to_teams")}
            data-testid="player-reports-back-teams"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold text-foreground tracking-widest uppercase truncate min-w-0">
            {t("player_home_title")}
          </h1>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => setLocation("/player/home-settings")}
          aria-label={t("player_settings_aria")}
          data-testid="player-home-settings"
        >
          <Settings className="w-5 h-5" />
        </Button>
      </header>

      <main className="flex-1 px-3 pb-10 space-y-4 pt-4">
        <div className="bg-card rounded-2xl border border-border p-4 flex items-center gap-4 shadow-sm">
          <div className="relati shrink-0">
            {real ? (
              <img src={avatarUrl} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-border" />
            ) : (
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-border">
                <BasketballPlaceholderAvatar size={64} />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-extrabold text-foreground truncate">{displayName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              <span className="font-bold text-foreground">#{jersey}</span>
              <span className="mx-2 opacity-40">·</span>
              <span>{position}</span>
            </p>
            {data?.membership?.team && (
              <p className="text-xs font-bold text-primary mt-1 truncate">
                {data.membership.team.logo} {data.membership.team.name}
              </p>
            )}
          </div>
        </div>

       <p className="text-[10px] font-black tracking-widest uppercase text-muted-foreground px-1">
          {t("player_reports_section")}
        </p>

        {isLoading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {isError && (
          <p className="text-sm text-destructive text-center py-8">{t("player_home_load_error")}</p>
        )}

        {!isLoading && !isError && data && data.reports.length === 0 && (
          <div className="bg-muted/40 rounded-2xl border border-dashed border-border px-6 py-12 text-center">
            <p className="text-sm font-medium text-muted-foreground">{t("player_no_reports")}</p>
          </div>
        )}

        {!isLoading && !isError && data && data.reports.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {data.reports.map((r) => (
              <button
                key={r.assignmentId}
                onClick={() => setLocation(`/player/${r.opponentPlayerId}`)}
                className="bg-card border border-border hover:border-primary/60 rounded-xl overflow-hidden transition-all active:scale-95 text-left"
                data-testid={`player-report-open-${r.opponentPlayerId}`}
              >
                <div className="relative w-full aspect-square">
                  {isRealPhoto(r.opponentImageUrl ?? "") ? (
                    <img src={r.opponentImageUrl} alt={r.opponentName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="relative w-full aspect-square flex items-center justify-center overflow-hidden bg-muted">
                      <BasketballPlaceholderAvatar size={200} />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
                  <span
                    className="absolute top-2 right-2 inline-flex min-w-[2.25rem] h-7 items-center justify-center px-2 text-sm font-black text-primary bg-card/80 border border-border -skew-x-12 backdrop-blur-sm"
                    style={{ clipPath: "polygon(8% 0, 100% 0, 100% 100%, 0 100%, 0 28%)" }}
                  >
                    <span className="skew-x-12">{r.opponentNumber || "—"}</span>
                  </span>
                </div>
                <div className="px-3 py-2.5">
                  <p className="font-extrabold text-sm text-foreground truncate">{r.opponentName || "—"}</p>
                  <p className="text-[10px] font-bold text-primary uppercase tracking-wider mt-0.5 truncate">{r.opponentTeamName}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
