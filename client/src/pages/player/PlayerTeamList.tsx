import { useLocation } from "wouter";
import { LayoutGrid, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/i18n";
import { usePlayerTeams } from "@/lib/player-home";
import { UScoutLogo } from "@/components/UScoutLogo";
import { cn } from "@/lib/utils";

export default function PlayerTeamList() {
  const { t } = useLocale();
  const [, setLocation] = useLocation();
  const { data, isLoading, isError } = usePlayerTeams();

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background text-foreground">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: "2rem",
          paddingBottom: "1.5rem",
          gap: "0.5rem",
        }}
        className="text-foreground"
      >
        <UScoutLogo size={52} animated={true} />
        <span
          style={{
            fontSize: "11px",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            opacity: 0.45,
            fontWeight: 500,
          }}
        >
          {t("app.tagline") ?? "Scouting Platform"}
        </span>
      </div>
      <header className="sticky top-0 z-20 bg-card/90 backdrop-blur-md border-b border-border px-3 py-3 flex items-center justify-between gap-2">
        <h1 className="text-lg font-bold tracking-tight truncate min-w-0">{t("player_teams_title")}</h1>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="h-9 px-2.5 text-xs font-bold border-border"
            onClick={() => setLocation("/player/reports")}
            data-testid="player-home-all-reports"
          >
            <LayoutGrid className="w-3.5 h-3.5 mr-1" />
            {t("player_all_reports")}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => setLocation("/player/home-settings")}
            aria-label={t("player_settings_aria")}
            data-testid="player-teams-settings"
          >
            <Settings className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="flex-1 px-3 pb-10 pt-4 space-y-3">
        {isLoading && (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {isError && (
          <p className="text-sm text-destructive text-center py-8">{t("player_teams_load_error")}</p>
        )}

        {!isLoading && !isError && data?.teams.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
            <p className="text-sm font-medium text-muted-foreground">{t("player_teams_empty")}</p>
          </div>
        )}

        {!isLoading && !isError && data && data.teams.length > 0 && (
          <ul className="space-y-2">
            {data.teams.map((row) => (
              <li key={row.team.id}>
                <button
                  type="button"
                  onClick={() => setLocation(`/player/team/${row.team.id}`)}
                  className={cn(
                    "w-full text-left rounded-xl border border-border bg-card p-4 flex items-center gap-3",
                    "transition-colors hover:border-primary/50 hover:bg-muted/40 active:scale-[0.99]",
                  )}
                  data-testid={`player-team-row-${row.team.id}`}
                >
                  <span className="text-2xl shrink-0" aria-hidden>
                    {row.team.logo}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-foreground truncate">{row.team.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      <span className="font-semibold text-foreground tabular-nums">{row.totalReports}</span>{" "}
                      {t("player_teams_card_reports")}
                      {(row.reportsPending ?? row.unseenCount) > 0 && (
                        <>
                          <span className="mx-1.5 text-border">·</span>
                          <span className="font-semibold text-primary tabular-nums">
                            {row.reportsPending ?? row.unseenCount}
                          </span>{" "}
                          {t("player_teams_card_pending")}
                        </>
                      )}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
