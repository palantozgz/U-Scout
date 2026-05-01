import { useLocation, useRoute } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/i18n";
import { usePlayerTeamDetail } from "@/lib/player-home";
import { BasketballPlaceholderAvatar } from "@/components/BasketballPlaceholderAvatar";
import { isRealPhoto } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { ModuleNav } from "@/pages/core/ModuleNav";

export function PlayerTeamView() {
  const { locale } = useLocale();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/player/team/:teamId");
  const teamId = params?.teamId;
  const { data, isLoading, isError } = usePlayerTeamDetail(teamId);

  const es = locale === "es";
  const zh = locale === "zh";

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
        <Button variant="ghost" size="icon" onClick={() => setLocation("/player")} className="mb-4 w-10 h-10">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <p className="text-sm text-destructive text-center">
          {es ? "Error al cargar el equipo" : "Failed to load team"}
        </p>
      </div>
    );
  }

  const { team, players } = data;

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background text-foreground pb-16">
      <header className="sticky top-0 z-10 bg-card/90 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/player")}
          className="text-muted-foreground hover:text-foreground shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <span className="text-xl shrink-0">{team.logo}</span>
        <h1 className="text-base font-black tracking-tight uppercase truncate">{team.name}</h1>
      </header>

      <main className="flex-1 px-3 pb-10 pt-4 max-w-md mx-auto w-full">
        {players.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-muted-foreground">
              {es ? "Sin informes publicados" : zh ? "暂无已发布报告" : "No published reports"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {players.map((p) => {
              const badgeConfig = {
                complete: {
                  label: es ? "Visto ✓" : zh ? "已看 ✓" : "Seen ✓",
                  cls: "bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300",
                },
                partial: {
                  label: es ? "A medias" : zh ? "部分" : "Partial",
                  cls: "bg-amber-500/15 border-amber-500/30 text-amber-800 dark:text-amber-300",
                },
                none: {
                  label: es ? "Nuevo" : zh ? "新" : "New",
                  cls: "bg-primary/15 border-primary/30 text-primary",
                },
              }[p.viewStatus];

              return (
                <button
                  key={p.playerId}
                  type="button"
                  onClick={() => setLocation(`/player/report/${p.playerId}`, { state: { fromTeamId: teamId } })}
                  className={cn(
                    "bg-card border border-border rounded-2xl overflow-hidden",
                    "transition-all active:scale-[0.97] hover:border-primary/40 text-left",
                    "flex flex-col",
                  )}
                >
                  {/* Photo / avatar */}
                  <div className="relative w-full aspect-[3/4]">
                    {isRealPhoto(p.imageUrl) ? (
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-muted">
                        <BasketballPlaceholderAvatar size={120} />
                      </div>
                    )}
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />

                    {/* Jersey number */}
                    <span className="absolute top-2 right-2 min-w-[1.75rem] h-6 flex items-center justify-center px-1.5 text-[11px] font-black text-foreground bg-background/80 border border-border rounded-md backdrop-blur-sm">
                      {p.number || "—"}
                    </span>

                    {/* View status badge */}
                    <span className={cn(
                      "absolute bottom-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-black border",
                      badgeConfig.cls,
                    )}>
                      {badgeConfig.label}
                    </span>
                  </div>

                  {/* Name + position */}
                  <div className="px-3 py-2.5">
                    <p className="font-extrabold text-sm text-foreground truncate leading-tight">
                      {p.name || "—"}
                    </p>
                    {p.position && (
                      <p className="text-[10px] font-bold text-primary uppercase tracking-wider mt-0.5 truncate">
                        {p.position}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>
      <ModuleNav />
    </div>
  );
}
