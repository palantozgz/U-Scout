import { useLocation, useRoute } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocale } from "@/lib/i18n";
import { usePlayerTeamDetail } from "@/lib/player-home";
import { BasketballPlaceholderAvatar } from "@/components/BasketballPlaceholderAvatar";
import { isRealPhoto } from "@/lib/utils";

export function PlayerTeamView() {
  const { t } = useLocale();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/player/team/:teamId");
  const teamId = params?.teamId;
  const { data, isLoading, isError } = usePlayerTeamDetail(teamId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh] bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col min-h-[100dvh] bg-background px-4 pt-10">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/player")} className="mb-4 w-10 h-10 shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <p className="text-sm text-destructive text-center">{t("player_team_load_error")}</p>
      </div>
    );
  }

  const { team, players } = data;

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background text-foreground">
      <header className="sticky top-0 z-10 bg-card/90 backdrop-blur-md border-b border-border px-3 py-3 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/player")}
          className="text-muted-foreground hover:text-foreground shrink-0"
          data-testid="button-back"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl shrink-0" aria-hidden>
            {team.logo}
          </span>
          <h1 className="text-lg font-extrabold tracking-tight uppercase truncate">{team.name}</h1>
        </div>
      </header>

      <main className="flex-1 px-3 pb-10 pt-4">
        <div className="grid grid-cols-2 gap-3">
          {players.map((p) => (
            <button
              key={p.playerId}
              type="button"
              onClick={() => setLocation(`/player/${p.playerId}`)}
              className="bg-card border border-border hover:border-primary/60 rounded-xl overflow-hidden transition-all active:scale-[0.98] text-left relative"
              data-testid={`card-player-${p.playerId}`}
            >
              <div className="relative w-full aspect-square">
                {isRealPhoto(p.imageUrl) ? (
                  <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="relative w-full aspect-square flex items-center justify-center overflow-hidden bg-muted">
                    <BasketballPlaceholderAvatar size={200} />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
                <span
                  className="absolute top-2 right-2 inline-flex min-w-[1.75rem] h-6 items-center justify-center px-1.5 text-[10px] font-black text-primary bg-card/80 border border-border -skew-x-12 backdrop-blur-sm"
                  style={{ clipPath: "polygon(8% 0, 100% 0, 100% 100%, 0 100%, 0 28%)" }}
                >
                  <span className="skew-x-12">{p.number || "—"}</span>
                </span>
                {p.viewStatus === "complete" && (
                  <Badge
                    className="absolute bottom-2 left-2 text-[10px] font-bold border-emerald-500/40 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
                    variant="outline"
                  >
                    {t("player_view_badge_seen")}
                  </Badge>
                )}
                {p.viewStatus === "partial" && (
                  <Badge
                    className="absolute bottom-2 left-2 text-[10px] font-bold border-amber-500/40 bg-amber-500/15 text-amber-900 dark:text-amber-200"
                    variant="outline"
                  >
                    {t("player_view_badge_partial")}
                  </Badge>
                )}
              </div>
              <div className="px-3 py-2.5 text-left">
                <p className="font-extrabold text-sm text-foreground truncate">{p.name || t("dashboard_unnamed_player")}</p>
                <p className="text-[10px] font-bold text-primary uppercase tracking-wider mt-0.5 truncate">{p.position}</p>
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
