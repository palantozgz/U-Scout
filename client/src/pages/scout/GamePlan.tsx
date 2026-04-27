import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileText, ChevronRight, RotateCcw, CheckCircle2 } from "lucide-react";
import { ModuleNav } from "@/pages/core/ModuleNav";
import { useLocale } from "@/lib/i18n";
import { useAuth } from "@/lib/useAuth";
import { usePlayers, useTeams } from "@/lib/mock-data";
import { BasketballPlaceholderAvatar } from "@/components/BasketballPlaceholderAvatar";
import { isRealPhoto } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";

export default function GamePlan() {
  const [, setLocation] = useLocation();
  const { locale } = useLocale();
  const { profile } = useAuth();
  const qc = useQueryClient();

  const isHeadCoach = profile?.role === "head_coach" || profile?.role === "master";

  const { data: allPlayers = [], isLoading } = usePlayers();
  const { data: teams = [] } = useTeams();

  const [retiringId, setRetiringId] = useState<string | null>(null);
  const [confirmRetireId, setConfirmRetireId] = useState<string | null>(null);

  const publishedPlayers = allPlayers.filter((p) => p.published === true);

  const teamName = (teamId: string) => teams.find((t) => t.id === teamId)?.name ?? "";
  const teamLogo = (teamId: string) => teams.find((t) => t.id === teamId)?.logo ?? "";
  const teamColor = (teamId: string) => teams.find((t) => t.id === teamId)?.primaryColor ?? "";

  const es = locale === "es";
  const zh = locale === "zh";

  const handleRetire = async (playerId: string) => {
    setRetiringId(playerId);
    try {
      await apiRequest("POST", `/api/players/${playerId}/unpublish`);
      await qc.invalidateQueries({ queryKey: ["/api/players"] });
      await qc.invalidateQueries({ queryKey: ["/api/film-room"] });
    } finally {
      setRetiringId(null);
      setConfirmRetireId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-[100dvh] bg-background pb-16">
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background pb-16">
      <header className="sticky top-0 z-10 bg-background border-b border-border px-4 py-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setLocation("/coach")}
          className="-ml-1 p-1 rounded-lg text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-black text-foreground tracking-tight">
            {zh ? "比赛方案" : es ? "Plan de juego" : "Game Plan"}
          </h1>
          <p className="text-[10px] text-muted-foreground font-medium">
            {zh ? "已发布给球员" : es ? "Publicados a jugadoras" : "Published to players"}
          </p>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 space-y-3 max-w-md mx-auto w-full">

        {publishedPlayers.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto" />
            <p className="text-sm text-muted-foreground font-semibold">
              {es
                ? "Sin informes publicados todavía"
                : zh
                ? "暂无已发布的报告"
                : "No published reports yet"}
            </p>
            <p className="text-xs text-muted-foreground/60">
              {es
                ? "Publica informes desde la Sala de análisis para que aparezcan aquí"
                : zh
                ? "从集体分析中发布报告，报告将显示在此处"
                : "Publish reports from Film Room to see them here"}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-4 rounded-lg text-xs font-bold"
              onClick={() => setLocation("/coach/film-room")}
            >
              {es ? "Ir a Sala de análisis" : zh ? "前往集体分析" : "Go to Film Room"}
            </Button>
          </div>
        ) : (
          <>
            {/* Summary badge */}
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/8 px-3 py-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <p className="text-[11px] font-black text-emerald-700 dark:text-emerald-400">
                {publishedPlayers.length}{" "}
                {es
                  ? `informe${publishedPlayers.length > 1 ? "s" : ""} publicado${publishedPlayers.length > 1 ? "s" : ""} al roster`
                  : zh
                  ? `份报告已发布给球员`
                  : `report${publishedPlayers.length > 1 ? "s" : ""} published to roster`}
              </p>
            </div>

            {/* Player list */}
            {publishedPlayers.map((player) => {
              const isPendingConfirm = confirmRetireId === player.id;
              const isRetiring = retiringId === player.id;
              const color = teamColor(player.teamId);
              const ringClass = color.startsWith("bg-")
                ? color.replace(/^bg-/, "ring-")
                : "ring-primary";

              return (
                <div
                  key={player.id}
                  className="rounded-xl border border-border bg-card overflow-hidden"
                >
                  {/* Main row */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    {/* Avatar */}
                    <div className="shrink-0">
                      {isRealPhoto(player.imageUrl)
                        ? <img
                            src={player.imageUrl}
                            alt={player.name}
                            className={cn("w-11 h-11 rounded-full object-cover ring-2 ring-offset-1 ring-offset-background", ringClass)}
                          />
                        : <div className={cn("w-11 h-11 rounded-full overflow-hidden ring-2 ring-offset-1 ring-offset-background", ringClass)}>
                            <BasketballPlaceholderAvatar size={44} />
                          </div>
                      }
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-extrabold text-foreground truncate">
                        {player.name || "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        #{player.number || "—"} · {teamLogo(player.teamId)} {teamName(player.teamId)}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          {es ? "Visible a jugadoras" : zh ? "球员可见" : "Visible to players"}
                        </span>
                      </div>
                    </div>

                    {/* View report */}
                    <button
                      type="button"
                      onClick={() => setLocation(`/coach/scout/${player.id}/review`)}
                      className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Retire action — head coach only */}
                  {isHeadCoach && (
                    <div className="border-t border-border px-4 py-2.5 flex items-center justify-between bg-background/40">
                      {isPendingConfirm ? (
                        <div className="flex items-center gap-2 w-full">
                          <p className="text-[11px] text-muted-foreground flex-1">
                            {es ? "¿Retirar del roster?" : zh ? "确认撤回？" : "Retire from roster?"}
                          </p>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-[11px] rounded-lg"
                            onClick={() => setConfirmRetireId(null)}
                          >
                            {es ? "Cancelar" : zh ? "取消" : "Cancel"}
                          </Button>
                          <Button
                            size="sm"
                            className="h-7 px-2 text-[11px] font-bold rounded-lg bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                            disabled={isRetiring}
                            onClick={() => void handleRetire(player.id)}
                          >
                            <RotateCcw className="w-3 h-3 mr-1" />
                            {isRetiring
                              ? (es ? "Retirando..." : zh ? "撤回中..." : "Retiring...")
                              : (es ? "Retirar" : zh ? "撤回" : "Retire")}
                          </Button>
                        </div>
                      ) : (
                        <>
                          <span className="text-[10px] text-muted-foreground/50 font-semibold">
                            {es ? "Publicado al roster" : zh ? "已发布给球员" : "Published to roster"}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-[11px] font-bold rounded-lg text-muted-foreground hover:text-destructive"
                            onClick={() => setConfirmRetireId(player.id)}
                          >
                            <RotateCcw className="w-3 h-3 mr-1" />
                            {es ? "↩ Retirar" : zh ? "↩ 撤回" : "↩ Retire"}
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </main>
      <ModuleNav />
    </div>
  );
}

