import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Plus, Star, FlaskConical, ChevronRight, Trash2, X } from "lucide-react";
import { ModuleNav } from "@/pages/core/ModuleNav";
import { useLocale } from "@/lib/i18n";
import { useAuth } from "@/lib/useAuth";
import { useTeams, usePlayers, useCreatePlayer, useDeletePlayer, createDefaultPlayer, type PlayerProfile, type Team } from "@/lib/mock-data";
import { BasketballPlaceholderAvatar } from "@/components/BasketballPlaceholderAvatar";
import { isRealPhoto } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";

function teamAvatarRingClass(primaryColor: string): string {
  const ring = primaryColor.startsWith("bg-") ? primaryColor.replace(/^bg-/, "ring-") : "ring-primary";
  return cn("ring-2 ring-offset-2 ring-offset-background", ring);
}

export default function Personnel() {
  const [, setLocation] = useLocation();
  const { locale } = useLocale();
  const { profile } = useAuth();
  const qc = useQueryClient();

  const isHeadCoach = profile?.role === "head_coach" || profile?.role === "master";

  const { data: teams = [], isLoading: teamsLoading } = useTeams();
  const { data: allPlayers = [] } = usePlayers();
  const createPlayerMutation = useCreatePlayer();
  const deletePlayerMutation = useDeletePlayer();

  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [showNewPlayer, setShowNewPlayer] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerNumber, setNewPlayerNumber] = useState("");
  const [newPlayerTeamId, setNewPlayerTeamId] = useState<string>("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [promotingId, setPromotingId] = useState<string | null>(null);

  const L = {
    en: {
      title: "Personnel",
      headCoachSub: "Official rival roster — canonical profiles only",
      sandboxTitle: "⚗️ Sandbox mode",
      sandboxSub: "Profiles you create here are private and cannot be sent to Film Room. Only head coaches can create canonical profiles.",
      addCanonical: "+ Add canonical profile",
      addSandbox: "+ Add practice profile",
      noTeams: "No teams yet. Create a team first from the editor.",
      canonical: "Official",
      sandbox: "Sandbox",
      promote: "Make official",
      promoting: "Promoting...",
      delete: "Delete",
      confirmDelete: "Confirm delete",
      cancel: "Cancel",
      name: "Name",
      number: "#",
      team: "Team",
      save: "Save",
    },
    es: {
      title: "Plantilla",
      headCoachSub: "Roster rival oficial — solo fichas canónicas",
      sandboxTitle: "⚗️ Modo campo de pruebas",
      sandboxSub: "Las fichas que crees aquí son privadas y no pueden enviarse a la Sala de análisis. Solo los head coaches pueden crear fichas canónicas.",
      addCanonical: "+ Añadir ficha canónica",
      addSandbox: "+ Añadir ficha de prueba",
      noTeams: "Sin equipos. Crea un equipo primero desde el editor.",
      canonical: "Oficial",
      sandbox: "Prueba",
      promote: "Hacer oficial",
      promoting: "Procesando...",
      delete: "Eliminar",
      confirmDelete: "Confirmar",
      cancel: "Cancelar",
      name: "Nombre",
      number: "#",
      team: "Equipo",
      save: "Guardar",
    },
    zh: {
      title: "球员档案",
      headCoachSub: "官方对手名单 — 仅限标准档案",
      sandboxTitle: "⚗️ 测试模式",
      sandboxSub: "此处创建的档案为私人档案，无法发送至集体分析。只有主教练可以创建标准档案。",
      addCanonical: "+ 添加标准档案",
      addSandbox: "+ 添加练习档案",
      noTeams: "暂无球队，请先在编辑器中创建球队。",
      canonical: "官方",
      sandbox: "测试",
      promote: "设为官方",
      promoting: "处理中...",
      delete: "删除",
      confirmDelete: "确认删除",
      cancel: "取消",
      name: "姓名",
      number: "#",
      team: "球队",
      save: "保存",
    },
  }[locale as "en" | "es" | "zh"] ?? {
    title: "Personnel",
    headCoachSub: "Official rival roster — canonical profiles only",
    sandboxTitle: "⚗️ Sandbox mode",
    sandboxSub: "Profiles you create here are private and cannot be sent to Film Room. Only head coaches can create canonical profiles.",
    addCanonical: "+ Add canonical profile",
    addSandbox: "+ Add practice profile",
    noTeams: "No teams yet.",
    canonical: "Official",
    sandbox: "Sandbox",
    promote: "Make official",
    promoting: "Promoting...",
    delete: "Delete",
    confirmDelete: "Confirm delete",
    cancel: "Cancel",
    name: "Name",
    number: "#",
    team: "Team",
    save: "Save",
  };

  const playersByTeam = (teamId: string) =>
    allPlayers.filter((p) => p.teamId === teamId);

  const handleCreatePlayer = () => {
    const tid = newPlayerTeamId || teams[0]?.id;
    if (!tid) return;
    const def = createDefaultPlayer(tid);
    const payload = {
      ...def,
      name: newPlayerName.trim() || "New Player",
      number: newPlayerNumber.trim(),
      // is_canonical set server-side after promotion; new players start as sandbox
    };
    createPlayerMutation.mutate(payload as any, {
      onSuccess: (created: PlayerProfile) => {
        // If head coach, auto-promote to canonical
        if (isHeadCoach) {
          void apiRequest("POST", `/api/players/${created.id}/canonical`).then(() => {
            void qc.invalidateQueries({ queryKey: ["/api/players"] });
          });
        }
        setShowNewPlayer(false);
        setNewPlayerName("");
        setNewPlayerNumber("");
      },
    });
  };

  const handlePromote = async (playerId: string) => {
    setPromotingId(playerId);
    try {
      await apiRequest("POST", `/api/players/${playerId}/canonical`);
      await qc.invalidateQueries({ queryKey: ["/api/players"] });
    } finally {
      setPromotingId(null);
    }
  };

  if (teamsLoading) {
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
      <header className="sticky top-0 z-10 bg-background border-b border-border px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setLocation("/coach")}
            className="-ml-1 p-1 rounded-lg text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-black text-foreground tracking-tight">{L.title}</h1>
        </div>
        {isHeadCoach && (
          <Button
            size="sm"
            variant="outline"
            className="text-xs font-bold h-9 rounded-lg"
            onClick={() => { setShowNewPlayer(true); setNewPlayerTeamId(teams[0]?.id ?? ""); }}
          >
            <Plus className="w-3 h-3 mr-1" /> {L.addCanonical}
          </Button>
        )}
      </header>

      <main className="flex-1 px-4 py-4 space-y-4 max-w-md mx-auto w-full">

        {/* Sandbox banner for non-head-coaches */}
        {!isHeadCoach && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/8 px-4 py-3 space-y-1">
            <p className="text-[11px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
              {L.sandboxTitle}
            </p>
            <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 leading-snug">
              {L.sandboxSub}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2 text-xs font-bold h-8 rounded-lg border-amber-500/40 text-amber-700 dark:text-amber-400"
              onClick={() => { setShowNewPlayer(true); setNewPlayerTeamId(teams[0]?.id ?? ""); }}
            >
              <FlaskConical className="w-3 h-3 mr-1" /> {L.addSandbox}
            </Button>
          </div>
        )}

        {/* New player form */}
        {showNewPlayer && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-black text-foreground">
                {isHeadCoach ? L.addCanonical : L.addSandbox}
              </p>
              <button type="button" onClick={() => setShowNewPlayer(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder={L.name}
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                className="flex-1 h-10 rounded-lg text-sm"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleCreatePlayer()}
              />
              <Input
                placeholder={L.number}
                value={newPlayerNumber}
                onChange={(e) => setNewPlayerNumber(e.target.value)}
                className="w-16 h-10 rounded-lg text-sm text-center"
                onKeyDown={(e) => e.key === "Enter" && handleCreatePlayer()}
              />
            </div>
            {teams.length > 1 && (
              <select
                value={newPlayerTeamId}
                onChange={(e) => setNewPlayerTeamId(e.target.value)}
                className="w-full h-10 rounded-lg border border-border bg-background text-sm px-3"
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.logo} {t.name}</option>
                ))}
              </select>
            )}
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="flex-1 rounded-lg" onClick={() => setShowNewPlayer(false)}>
                {L.cancel}
              </Button>
              <Button size="sm" className="flex-1 rounded-lg font-bold" onClick={handleCreatePlayer} disabled={createPlayerMutation.isPending}>
                {L.save}
              </Button>
            </div>
          </div>
        )}

        {/* Teams + players */}
        {teams.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">{L.noTeams}</p>
        ) : (
          teams.map((team) => {
            const players = playersByTeam(team.id);
            const isExpanded = expandedTeamId === team.id;
            return (
              <div key={team.id} className="rounded-xl border border-border overflow-hidden">
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-4 py-3 bg-card hover:bg-muted/50 transition-colors"
                  onClick={() => setExpandedTeamId(isExpanded ? null : team.id)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{team.logo}</span>
                    <div className="text-left">
                      <p className="text-sm font-black text-foreground">{team.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {players.length} {locale === "zh" ? "名球员" : locale === "es" ? "jugadoras" : "players"}
                        {" · "}
                        {players.filter((p) => (p as any).isCanonical).length}{" "}
                        {locale === "zh" ? "官方" : locale === "es" ? "oficiales" : "official"}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className={cn("w-4 h-4 text-muted-foreground transition-transform", isExpanded && "rotate-90")} />
                </button>

                {isExpanded && (
                  <div className="border-t border-border divide-y divide-border">
                    {players.length === 0 ? (
                      <p className="text-xs text-muted-foreground px-4 py-4 text-center">
                        {locale === "zh" ? "暂无球员" : locale === "es" ? "Sin jugadoras" : "No players yet"}
                      </p>
                    ) : (
                      players.map((player) => {
                        const isCanonical = (player as any).isCanonical ?? false;
                        const isPendingDel = pendingDelete === player.id;
                        return (
                          <div key={player.id} className="px-4 py-3 flex items-center gap-3 bg-background">
                            {/* Avatar */}
                            <div className="relative shrink-0">
                              {isRealPhoto(player.imageUrl)
                                ? <img src={player.imageUrl} alt={player.name} className={cn("w-10 h-10 rounded-full object-cover", teamAvatarRingClass(team.primaryColor))} />
                                : <div className={cn("w-10 h-10 rounded-full overflow-hidden", teamAvatarRingClass(team.primaryColor))}><BasketballPlaceholderAvatar size={40} /></div>
                              }
                              {isCanonical && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                                  <Star className="w-2.5 h-2.5 text-primary-foreground" />
                                </span>
                              )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-sm font-extrabold text-foreground truncate">{player.name || "—"}</p>
                                <span className={cn(
                                  "text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full",
                                  isCanonical
                                    ? "bg-primary/10 text-primary"
                                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                )}>
                                  {isCanonical ? L.canonical : L.sandbox}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                #{player.number || "—"} · {(player.inputs as any)?.position || "—"}
                              </p>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1 shrink-0">
                              {!isCanonical && isHeadCoach && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-[10px] font-bold rounded-lg"
                                  disabled={promotingId === player.id}
                                  onClick={() => handlePromote(player.id)}
                                >
                                  <Star className="w-3 h-3 mr-1" />
                                  {promotingId === player.id ? L.promoting : L.promote}
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground"
                                onClick={() => setLocation(`/coach/player/${player.id}`)}
                              >
                                <ChevronRight className="w-4 h-4" />
                              </Button>
                              {isPendingDel ? (
                                <div className="flex items-center gap-1">
                                  <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px] rounded-lg" onClick={() => setPendingDelete(null)}>
                                    {L.cancel}
                                  </Button>
                                  <Button size="sm" className="h-7 px-2 text-[10px] font-bold rounded-lg bg-destructive hover:bg-destructive/90 text-destructive-foreground" onClick={() => { deletePlayerMutation.mutate(player.id); setPendingDelete(null); }}>
                                    {L.confirmDelete}
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-destructive"
                                  onClick={() => setPendingDelete(player.id)}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </main>
      <ModuleNav />
    </div>
  );
}

