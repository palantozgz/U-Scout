import { useState } from "react";
import { useLocation } from "wouter";
import { Settings, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/i18n";
import { usePlayerTeams } from "@/lib/player-home";
import { UScoutLogo } from "@/components/UScoutLogo";
import { cn } from "@/lib/utils";
import { ModuleNav } from "@/pages/core/ModuleNav";

export default function PlayerTeamList() {
  const { locale } = useLocale();
  const [, setLocation] = useLocation();
  const { data, isLoading, isError } = usePlayerTeams();
  const [expandedTeams, setExpandedTeams] = useState<Record<string, boolean>>({});

  const es = locale === "es";
  const zh = locale === "zh";

  const toggleTeam = (teamId: string) => {
    setExpandedTeams(prev => ({ ...prev, [teamId]: !prev[teamId] }));
  };

  const title = es ? "Informes" : zh ? "报告" : "Reports";
  const tagline = es ? "Plataforma de scouting" : zh ? "球探平台" : "Scouting Platform";
  const emptyMsg = es
    ? "Sin informes publicados todavía"
    : zh ? "暂无已发布的报告"
    : "No reports published yet";
  const emptySubMsg = es
    ? "Tu cuerpo técnico publicará los informes aquí antes del partido"
    : zh ? "教练团队将在比赛前在此发布报告"
    : "Your coaching staff will publish reports here before the game";

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background text-foreground pb-16">
      {/* Logo */}
      <div className="flex flex-col items-center pt-5 pb-4 gap-1.5">
        <UScoutLogo size={100} animated={false} />
        <span className="text-[11px] tracking-[0.2em] uppercase opacity-40 font-medium">
          {tagline}
        </span>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-20 bg-card/90 backdrop-blur-md border-b border-border px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-black tracking-tight">{title}</h1>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => setLocation("/player/home-settings")}
        >
          <Settings className="w-5 h-5" />
        </Button>
      </header>

      <main className="flex-1 px-4 py-4 space-y-3 max-w-md mx-auto w-full">
        {isLoading && (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {isError && (
          <p className="text-sm text-destructive text-center py-8">
            {es ? "Error al cargar los informes" : "Failed to load reports"}
          </p>
        )}

        {!isLoading && !isError && (data?.teams.length ?? 0) === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-14 text-center space-y-2 mt-4">
            <p className="text-sm font-bold text-muted-foreground">{emptyMsg}</p>
            <p className="text-xs text-muted-foreground/60 leading-relaxed">{emptySubMsg}</p>
          </div>
        )}

        {!isLoading && !isError && data && data.teams.map((row, idx) => {
          const isExpanded = expandedTeams[row.team.id] ?? idx === 0;
          const pendingCount = row.reportsPending ?? row.unseenCount ?? 0;

          return (
            <div key={row.team.id} className="rounded-2xl border border-border bg-card overflow-hidden">
              {/* Team header — tappable */}
              <button
                type="button"
                onClick={() => toggleTeam(row.team.id)}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/30 transition-colors"
              >
                <span className="text-2xl shrink-0">{row.team.logo}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sm text-foreground truncate">{row.team.name}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    <span className="font-bold text-foreground">{row.totalReports}</span>{" "}
                    {es ? "informes" : zh ? "份报告" : "reports"}
                    {pendingCount > 0 && (
                      <>
                        <span className="mx-1.5 opacity-30">·</span>
                        <span className="font-bold text-primary">{pendingCount}</span>{" "}
                        {es ? "pendientes" : zh ? "待看" : "pending"}
                      </>
                    )}
                  </p>
                </div>
                {pendingCount > 0 && (
                  <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-black flex items-center justify-center shrink-0">
                    {pendingCount}
                  </span>
                )}
                <ChevronRight className={cn(
                  "w-4 h-4 text-muted-foreground shrink-0 transition-transform",
                  isExpanded && "rotate-90"
                )} />
              </button>

              {/* Player grid — shown when expanded */}
              {isExpanded && (
                <div className="border-t border-border px-3 pb-3 pt-2">
                  <div className="grid grid-cols-2 gap-2">
                    {/* We navigate to team detail page which shows the grid */}
                    <button
                      type="button"
                      onClick={() => setLocation(`/player/team/${row.team.id}`)}
                      className="col-span-2 text-center py-2 text-xs font-bold text-primary hover:underline"
                    >
                      {es ? "Ver todos los informes →" : zh ? "查看所有报告 →" : "View all reports →"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </main>
      <ModuleNav />
    </div>
  );
}
