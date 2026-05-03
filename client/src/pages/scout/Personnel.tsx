import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Plus, Star, FlaskConical, ChevronRight, Trash2, X } from "lucide-react";
import { ModuleNav } from "@/pages/core/ModuleNav";
import { useLocale } from "@/lib/i18n";
import { useAuth } from "@/lib/useAuth";
import { useClub } from "@/lib/club-api";
import { useCapabilities } from "@/lib/capabilities";
import { useTeams, usePlayers, useCreatePlayer, useDeletePlayer, useCreateTeam, useDeleteTeam, createDefaultPlayer, type PlayerProfile, type Team } from "@/lib/mock-data";
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
  const clubQ = useClub();
  const myMembership = useMemo(() => {
    const members = clubQ.data?.members ?? [];
    const mine = members.find((m) => m.userId === profile?.id);
    if (!mine) return null;
    return {
      clubId: mine.clubId,
      userId: mine.userId,
      role: mine.role as "head_coach" | "coach" | "player",
      status: mine.status as "active" | "pending" | "banned",
      operationsAccess: Boolean((mine as any).operationsAccess),
    };
  }, [clubQ.data?.members, profile?.id]);

  const caps = useCapabilities({ membership: myMembership });
  const canCreateCanonical = caps.canCreateCanonical;
  const qc = useQueryClient();

  const isHeadCoach = profile?.role === "head_coach" || profile?.role === "master";

  // operationsAccess viene de la membresía del club, no del perfil auth.
  // Solo head_coach y master pueden gestionar el roster desde el perfil.
  const canManageRoster = caps.canAccessPersonnel;

  useEffect(() => {
    if (canManageRoster) return;
    setLocation("/coach");
  }, [canManageRoster, setLocation]);

  if (!canManageRoster) return null;

  const { data: teams = [], isLoading: teamsLoading } = useTeams();

  // Ensure there's always a valid default team — use first team or create Free Agents
  const freeAgentsTeam = teams.find(t => Boolean((t as any).is_system));
  const defaultTeamId = freeAgentsTeam?.id ?? teams[0]?.id ?? "";
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
  const [canonicalError, setCanonicalError] = useState<string | null>(null);

  const createTeamMutation = useCreateTeam();
  const deleteTeamMutation = useDeleteTeam();
  const [showNewTeam, setShowNewTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [pendingDeleteTeam, setPendingDeleteTeam] = useState<string | null>(null);

  const [deletePlayerInfo, setDeletePlayerInfo] = useState<{
    playerId: string;
    playerName: string;
    published: boolean;
    isCanonical: boolean;
  } | null>(null);

  const [deleteTeamInfo, setDeleteTeamInfo] = useState<{
    teamId: string;
    teamName: string;
    playerCount: number;
    publishedCount: number;
    loading: boolean;
  } | null>(null);

  const [showImportTeam, setShowImportTeam] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; skipped: number } | null>(null);
  const [statsTeams, setStatsTeams] = useState<Array<{ id: number; name: string; season: string; updatedAt: string }>>([]);
  const [selectedStatsTeamId, setSelectedStatsTeamId] = useState<number | null>(null);
  const [importTargetTeamId, setImportTargetTeamId] = useState<string>("");

  const L = {
    en: {
      title: "Personnel",
      headCoachSub: "Official rival roster — canonical profiles only",
      sandboxTitle: "⚗️ Sandbox mode",
      sandboxSub: "Profiles you create here are private and cannot be sent to Film Room. Only head coaches can create canonical profiles.",
      newTeam: "+ New team",
      deleteTeam: "Delete team",
      confirmDelete: "Confirm",
      promoteLabel: "Make official",
      promoteTip: "Official profiles can be sent to Film Room",
      sandboxLabel: "Practice only",
      addCanonical: "+ New official profile",
      addSandbox: "+ Add practice profile",
      noTeams: "No teams yet. Create a team first from the editor.",
      canonical: "Official",
      sandbox: "Sandbox",
      promote: "Make official",
      promoting: "Promoting...",
      delete: "Delete",
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
      newTeam: "+ Nuevo equipo",
      deleteTeam: "Eliminar equipo",
      confirmDelete: "Confirmar",
      promoteLabel: "Hacer oficial",
      promoteTip: "Las fichas oficiales pueden enviarse a la Sala de análisis",
      sandboxLabel: "Solo práctica",
      addCanonical: "+ Nueva ficha oficial",
      addSandbox: "+ Añadir ficha de prueba",
      noTeams: "Sin equipos. Crea un equipo primero desde el editor.",
      canonical: "Oficial",
      sandbox: "Prueba",
      promote: "Hacer oficial",
      promoting: "Procesando...",
      delete: "Eliminar",
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
      newTeam: "+ 新建队伍",
      deleteTeam: "删除队伍",
      confirmDelete: "确认",
      promoteLabel: "设为官方",
      promoteTip: "官方档案可发送至集体分析",
      sandboxLabel: "仅练习",
      addCanonical: "+ 新建官方档案",
      addSandbox: "+ 添加练习档案",
      noTeams: "暂无球队，请先在编辑器中创建球队。",
      canonical: "官方",
      sandbox: "测试",
      promote: "设为官方",
      promoting: "处理中...",
      delete: "删除",
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
    newTeam: "+ New team",
    deleteTeam: "Delete team",
    confirmDelete: "Confirm",
    promoteLabel: "Make official",
    promoteTip: "Official profiles can be sent to Film Room",
    sandboxLabel: "Practice only",
    addCanonical: "+ New official profile",
    addSandbox: "+ Add practice profile",
    noTeams: "No teams yet.",
    canonical: "Official",
    sandbox: "Sandbox",
    promote: "Make official",
    promoting: "Promoting...",
    delete: "Delete",
    cancel: "Cancel",
    name: "Name",
    number: "#",
    team: "Team",
    save: "Save",
  };

  const playersByTeam = (teamId: string) =>
    allPlayers.filter((p) => {
      if (p.teamId !== teamId) return false;
      // Head coach sees everything. Regular coaches see only canonical + their own sandbox.
      // Head coach sees canonical profiles from all coaches, but NOT other coaches' sandbox
      if (isHeadCoach) {
        const isCanonical = (p as any).isCanonical ?? (p as any).is_canonical ?? false;
        if (isCanonical) return true;
        return p.createdByCoachId === profile?.id;
      }
      const isCanonical = (p as any).isCanonical ?? (p as any).is_canonical ?? false;
      if (isCanonical) return true;
      return p.createdByCoachId === profile?.id;
    });

  // Auto-create Free Agents team if no teams exist and head_coach creates a player
  const ensureFreeAgentsTeam = async (): Promise<string | null> => {
    const freeAgents = teams.find(t => Boolean((t as any).is_system));
    if (freeAgents) return freeAgents.id;
    if (!canManageRoster) return null;
    try {
      const res = await apiRequest("POST", "/api/teams", {
        name: locale === "es" ? "Agentes Libres" : locale === "zh" ? "自由球员" : "Free Agents",
        logo: "📋",
        primaryColor: "bg-slate-500",
      });
      const created = await res.json();
      await qc.invalidateQueries({ queryKey: ["/api/teams"] });
      return created.id as string;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (!isHeadCoach || teamsLoading || teams.length > 0) return;
    void ensureFreeAgentsTeam();
  }, [isHeadCoach, teamsLoading, teams.length]);

  const handleCreatePlayer = async () => {
    setCanonicalError(null);
    let tid = newPlayerTeamId || defaultTeamId;
    if (!tid) {
      const freeAgentsId = await ensureFreeAgentsTeam();
      if (!freeAgentsId) return;
      tid = freeAgentsId;
    }
    const def = createDefaultPlayer(tid);
    const payload = {
      ...def,
      name: newPlayerName.trim() || "New Player",
      number: newPlayerNumber.trim(),
    };
    createPlayerMutation.mutate(payload as any, {
      onSuccess: async (created: PlayerProfile) => {
        if (isHeadCoach) {
          try {
            await apiRequest("POST", `/api/players/${created.id}/canonical`);
          } catch (e) {
            console.error("canonical promotion error", e);
            setCanonicalError(
              locale === "es"
                ? "Error al hacer la ficha oficial. Inténtalo de nuevo."
                : "Failed to make profile official. Please retry.",
            );
          }
          await qc.invalidateQueries({ queryKey: ["/api/players"] });
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

  const fetchDeletePlayerInfo = async (player: PlayerProfile) => {
    try {
      const res = await apiRequest("GET", `/api/players/${player.id}/delete-info`);
      const info = await res.json();
      setDeletePlayerInfo({
        playerId: player.id,
        playerName: player.name || "—",
        published: info.published,
        isCanonical: info.isCanonical,
      });
    } catch {
      // fallback: show simple confirm
      setDeletePlayerInfo({
        playerId: player.id,
        playerName: player.name || "—",
        published: false,
        isCanonical: false,
      });
    }
  };

  const fetchDeleteTeamInfo = async (team: Team) => {
    setDeleteTeamInfo({ teamId: team.id, teamName: team.name, playerCount: 0, publishedCount: 0, loading: true });
    try {
      const res = await apiRequest("GET", `/api/teams/${team.id}/delete-info`);
      const info = await res.json();
      setDeleteTeamInfo({
        teamId: team.id,
        teamName: team.name,
        playerCount: info.playerCount,
        publishedCount: info.publishedCount,
        loading: false,
      });
    } catch {
      setDeleteTeamInfo(prev => prev ? { ...prev, loading: false } : null);
    }
  };

  const confirmDeletePlayer = async () => {
    if (!deletePlayerInfo) return;
    deletePlayerMutation.mutate(deletePlayerInfo.playerId);
    setDeletePlayerInfo(null);
    setPendingDelete(null);
  };

  const confirmDeleteTeam = async (action: "move" | "delete") => {
    if (!deleteTeamInfo) return;
    const { teamId } = deleteTeamInfo;

    // Optimistic: remove team from cache immediately
    if (action === "delete") {
      qc.setQueryData<PlayerProfile[]>(["/api/players"], (old) =>
        old ? old.filter((p) => p.teamId !== teamId) : [],
      );
    }
    qc.setQueryData<Team[]>(["/api/teams"], (old) =>
      old ? old.filter((t) => t.id !== teamId) : [],
    );
    setDeleteTeamInfo(null);
    setPendingDeleteTeam(null);

    try {
      await apiRequest("DELETE", `/api/teams/${teamId}?action=${action}`);
    } catch (err) {
      console.error("delete team failed", err);
    } finally {
      qc.invalidateQueries({ queryKey: ["/api/teams"] });
      qc.invalidateQueries({ queryKey: ["/api/players"] });
    }
  };

  const handleCreateTeam = () => {
    const name = newTeamName.trim();
    if (!name) return;
    createTeamMutation.mutate(
      { name, logo: "🏀", primaryColor: "bg-orange-500" },
      { onSuccess: () => { setShowNewTeam(false); setNewTeamName(""); } }
    );
  };

  const handleDeleteTeam = (teamId: string) => {
    const team = teams.find(t => t.id === teamId);
    const isFreeAgents = Boolean((team as any)?.is_system);
    if (isFreeAgents) return; // protected
    if (pendingDeleteTeam !== teamId) { setPendingDeleteTeam(teamId); return; }
    deleteTeamMutation.mutate(teamId);
    setPendingDeleteTeam(null);
  };

  const handleFetchStatsTeams = async () => {
    try {
      const res = await apiRequest("GET", "/api/stats/teams");
      const data = await res.json();
      setStatsTeams(data.teams ?? []);
    } catch (err) {
      console.error("Failed to fetch stats teams", err);
    }
  };

  const handleImportTeam = async () => {
    if (!selectedStatsTeamId || !importTargetTeamId || !profile?.id) return;
    setImportLoading(true);
    setImportResult(null);
    try {
      const res = await apiRequest("POST", "/api/stats/import-team", {
        statsTeamExternalId: selectedStatsTeamId,
        targetTeamId: importTargetTeamId,
        coachUserId: profile.id,
      });
      const data = await res.json();
      setImportResult({ created: data.created, skipped: data.skipped });
      await qc.invalidateQueries({ queryKey: ["/api/players"] });
    } catch (err) {
      console.error("Import failed", err);
    } finally {
      setImportLoading(false);
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
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="text-xs font-bold h-9 rounded-lg"
              onClick={() => setShowNewTeam(true)}
            >
              {L.newTeam}
            </Button>
            {canCreateCanonical && (
              <Button
                size="sm"
                variant="outline"
                className="text-xs font-bold h-9 rounded-lg"
                onClick={() => {
                  setShowNewPlayer(true);
                  setNewPlayerTeamId(freeAgentsTeam?.id ?? defaultTeamId);
                  setExpandedTeamId((freeAgentsTeam?.id ?? defaultTeamId) || null);
                }}
              >
                {L.addCanonical}
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="text-xs font-bold h-9 rounded-lg"
              onClick={() => {
                setShowImportTeam(true);
                setImportResult(null);
                void handleFetchStatsTeams();
              }}
            >
              {locale === "es" ? "⬇ Importar WCBA" : locale === "zh" ? "⬇ 导入WCBA" : "⬇ Import WCBA"}
            </Button>
          </div>
        )}
      </header>

      <main className="flex-1 px-4 py-4 landscape:py-2 space-y-4 max-w-md mx-auto w-full">

        {!canCreateCanonical && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/8 px-4 py-3 space-y-1">
            <p className="text-[11px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
              {locale === "es" ? "Modo de consulta" : locale === "zh" ? "查看模式" : "View mode"}
            </p>
            <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 leading-snug">
              {locale === "es"
                ? "Puedes ver y editar fichas canónicas. Solo el head coach puede crear nuevas fichas oficiales."
                : locale === "zh"
                ? "您可以查看和编辑标准档案。只有主教练可以创建新的官方档案。"
                : "You can view and edit canonical profiles. Only the head coach can create new official profiles."}
            </p>
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
            {teams.length >= 1 && (
              <select
                value={newPlayerTeamId}
                onChange={(e) => setNewPlayerTeamId(e.target.value)}
                className="w-full h-10 rounded-lg border border-border bg-background text-sm px-3"
              >
                {[...teams].sort((a, b) => {
                  const aFA = Boolean((a as any).is_system);
                  const bFA = Boolean((b as any).is_system);
                  if (aFA && !bFA) return 1;
                  if (!aFA && bFA) return -1;
                  return a.name.localeCompare(b.name);
                }).map((t) => (
                  <option key={t.id} value={t.id}>{t.logo} {t.name}</option>
                ))}
              </select>
            )}
            {canonicalError && (
              <p className="text-xs text-destructive font-semibold">{canonicalError}</p>
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

        {showNewTeam && isHeadCoach && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-black text-foreground">{L.newTeam}</p>
              <button type="button" onClick={() => setShowNewTeam(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <Input
              placeholder={locale === "es" ? "Nombre del equipo" : locale === "zh" ? "队伍名称" : "Team name"}
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              className="h-10 rounded-lg text-sm"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleCreateTeam()}
            />
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="flex-1 rounded-lg" onClick={() => setShowNewTeam(false)}>
                {locale === "es" ? "Cancelar" : locale === "zh" ? "取消" : "Cancel"}
              </Button>
              <Button size="sm" className="flex-1 rounded-lg font-bold" onClick={handleCreateTeam} disabled={!newTeamName.trim() || createTeamMutation.isPending}>
                {locale === "es" ? "Crear" : locale === "zh" ? "创建" : "Create"}
              </Button>
            </div>
          </div>
        )}

        {showImportTeam && isHeadCoach && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-black text-foreground">
                  {locale === "es" ? "⬇ Importar equipo WCBA" : locale === "zh" ? "⬇ 导入WCBA球队" : "⬇ Import WCBA team"}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {locale === "es"
                    ? "Solo importa nombre y dorsal. Los datos de scouting se añaden manualmente."
                    : locale === "zh"
                    ? "仅导入姓名和号码，球探数据需手动添加。"
                    : "Imports name and jersey number only. Scouting data added manually."}
                </p>
              </div>
              <button type="button" onClick={() => setShowImportTeam(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {statsTeams.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">
                {locale === "es" ? "Cargando equipos…" : locale === "zh" ? "加载中…" : "Loading teams…"}
              </p>
            ) : (
              <>
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/8 px-3 py-2 space-y-0.5">
                  <p className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                    {locale === "es" ? "Temporada 2024-25" : locale === "zh" ? "2024-25赛季" : "Season 2024-25"}
                  </p>
                  <p className="text-[10px] text-amber-700/80 dark:text-amber-400/80">
                    {locale === "es"
                      ? `Datos sincronizados el ${new Date(statsTeams[0]?.updatedAt ?? Date.now()).toLocaleDateString("es-ES")}`
                      : `Data synced ${new Date(statsTeams[0]?.updatedAt ?? Date.now()).toLocaleDateString("en-GB")}`}
                    {" · "}
                    {locale === "es"
                      ? "Los nombres en chino se muestran en pinyin en vistas EN/ES."
                      : "Chinese names shown in pinyin in EN/ES views."}
                  </p>
                </div>

                <select
                  value={selectedStatsTeamId ?? ""}
                  onChange={(e) => setSelectedStatsTeamId(Number(e.target.value) || null)}
                  className="w-full h-10 rounded-lg border border-border bg-background text-sm px-3"
                >
                  <option value="">
                    {locale === "es" ? "Selecciona equipo WCBA…" : locale === "zh" ? "选择WCBA球队…" : "Select WCBA team…"}
                  </option>
                  {statsTeams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>

                <select
                  value={importTargetTeamId}
                  onChange={(e) => setImportTargetTeamId(e.target.value)}
                  className="w-full h-10 rounded-lg border border-border bg-background text-sm px-3"
                >
                  <option value="">
                    {locale === "es" ? "Importar en equipo…" : locale === "zh" ? "导入至球队…" : "Import into team…"}
                  </option>
                  {teams.filter(t => !Boolean((t as any).is_system)).map((t) => (
                    <option key={t.id} value={t.id}>{t.logo} {t.name}</option>
                  ))}
                  <option value={freeAgentsTeam?.id ?? ""}>
                    {locale === "es" ? "📋 Free Agents" : locale === "zh" ? "📋 自由球员" : "📋 Free Agents"}
                  </option>
                </select>

                {importResult && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-[11px] font-semibold text-primary">
                    {locale === "es"
                      ? `✓ ${importResult.created} jugadoras importadas, ${importResult.skipped} ya existían`
                      : `✓ ${importResult.created} players imported, ${importResult.skipped} already existed`}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="flex-1 rounded-lg" onClick={() => setShowImportTeam(false)}>
                    {locale === "es" ? "Cerrar" : locale === "zh" ? "关闭" : "Close"}
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 rounded-lg font-bold"
                    disabled={!selectedStatsTeamId || !importTargetTeamId || importLoading}
                    onClick={() => void handleImportTeam()}
                  >
                    {importLoading
                      ? (locale === "es" ? "Importando…" : locale === "zh" ? "导入中…" : "Importing…")
                      : (locale === "es" ? "Importar jugadoras" : locale === "zh" ? "导入球员" : "Import players")}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Teams + players */}
        {teams.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center space-y-3">
            <p className="text-sm font-semibold text-muted-foreground">
              {locale === "es"
                ? "Sin equipos — crea uno para organizar las fichas"
                : locale === "zh"
                ? "暂无球队，请先创建一个"
                : "No teams yet — create one to organise profiles"}
            </p>
            {canManageRoster && (
              <Button
                size="sm"
                variant="outline"
                className="rounded-lg text-xs font-bold"
                onClick={() => setShowNewTeam(true)}
              >
                {locale === "es" ? "+ Crear equipo rival" : locale === "zh" ? "+ 创建队伍" : "+ Create rival team"}
              </Button>
            )}
          </div>
        ) : (
          [...teams].sort((a, b) => {
            const aFA = Boolean((a as any).is_system);
            const bFA = Boolean((b as any).is_system);
            if (aFA && !bFA) return 1;
            if (!aFA && bFA) return -1;
            return a.name.localeCompare(b.name);
          }).map((team) => {
            const players = playersByTeam(team.id);
            const isExpanded = expandedTeamId === team.id;
            const isSystemTeam = Boolean((team as any).is_system);
            return (
              <div key={team.id} className="rounded-xl border border-border overflow-hidden">
                <div className="flex items-center">
                  <button
                    type="button"
                    className="flex-1 flex items-center justify-between px-4 py-3 bg-card hover:bg-muted/50 transition-colors"
                    onClick={() => setExpandedTeamId(isExpanded ? null : team.id)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{team.logo}</span>
                      <div className="text-left">
                        <p className="text-sm font-black text-foreground">{team.name}</p>
                        {isSystemTeam && (
                          <p className="text-[10px] text-muted-foreground/50 leading-tight">
                            {locale === "es"
                              ? "Contenedor — sin equipo asignado"
                              : locale === "zh"
                              ? "未分配容器"
                              : "Container — unassigned"}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {players.length} {locale === "zh" ? "名球员" : locale === "es" ? "jugadoras" : "players"}
                          {" · "}
                          {players.filter((p) => (p as any).isCanonical ?? (p as any).is_canonical).length}{" "}
                          {locale === "zh" ? "官方" : locale === "es" ? "oficiales" : "official"}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className={cn("w-4 h-4 text-muted-foreground transition-transform", isExpanded && "rotate-90")} />
                  </button>
                  {isHeadCoach && !Boolean((team as any).is_system) && (
                    <button
                      type="button"
                      className="pr-4 pl-2 py-3 text-muted-foreground hover:text-destructive transition-colors"
                      onClick={(e) => { e.stopPropagation(); void fetchDeleteTeamInfo(team); }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {isExpanded && (
                  <div className="border-t border-border divide-y divide-border">
                    {players.length === 0 ? (
                      <p className="text-xs text-muted-foreground px-4 py-4 text-center">
                        {locale === "zh" ? "暂无球员" : locale === "es" ? "Sin jugadoras" : "No players yet"}
                      </p>
                    ) : (
                      players.map((player) => {
                        const isCanonical = (player as any).isCanonical ?? (player as any).is_canonical ?? false;
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
                                {isCanonical ? (
                                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                                    {L.canonical}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[9px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 mt-0.5">
                                    ⚗ {L.sandboxLabel}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                #{player.number || "—"} · {(player.inputs as any)?.position || "—"}
                                {!player.teamId && (
                                  <span className="ml-1 text-amber-600 dark:text-amber-400 font-semibold">
                                    · {locale === "es" ? "Sin equipo" : locale === "zh" ? "无队伍" : "No team"}
                                  </span>
                                )}
                              </p>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1 shrink-0">
                              {!isCanonical && isHeadCoach && (
                                <div className="flex flex-col items-end gap-0.5">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-[10px] font-bold rounded-lg border-primary/30 text-primary hover:bg-primary/5"
                                    disabled={promotingId === player.id}
                                    onClick={() => handlePromote(player.id)}
                                    title={L.promoteTip}
                                  >
                                    <Star className="w-3 h-3 mr-1" />
                                    {promotingId === player.id ? L.promoting : L.promoteLabel}
                                  </Button>
                                  <p className="text-[9px] text-muted-foreground/60 max-w-[100px] text-right leading-tight">
                                    {L.promoteTip}
                                  </p>
                                </div>
                              )}
                              {Boolean((team as any).is_system) && canManageRoster && teams.filter(t => !Boolean((t as any).is_system)).length > 0 && (
                                <select
                                  className="h-7 rounded-lg border border-border bg-background text-[11px] px-2 font-semibold text-foreground"
                                  defaultValue=""
                                  onChange={async (e) => {
                                    const newTeamId = e.target.value;
                                    if (!newTeamId) return;
                                    try {
                                      await apiRequest("PATCH", `/api/players/${player.id}`, { teamId: newTeamId });
                                      await qc.invalidateQueries({ queryKey: ["/api/players"] });
                                    } catch (err) {
                                      console.error("assign team failed", err);
                                    }
                                  }}
                                >
                                  <option value="">
                                    {locale === "es" ? "Mover a equipo" : locale === "zh" ? "移至队伍" : "Move to team"}
                                  </option>
                                  {teams.filter(t => !Boolean((t as any).is_system)).map(t => (
                                    <option key={t.id} value={t.id}>{t.logo} {t.name}</option>
                                  ))}
                                </select>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground"
                                onClick={() => setLocation(`/coach/player/${player.id}`, { state: { from: "/coach/personnel" } })}
                              >
                                <ChevronRight className="w-4 h-4" />
                              </Button>
                              {canManageRoster ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-destructive"
                                  onClick={() => void fetchDeletePlayerInfo(player)}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              ) : null}
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

      {/* ── Delete player modal ── */}
      {deletePlayerInfo && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-4 pb-6 sm:pb-0">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 space-y-4 shadow-xl">
            <div className="space-y-1">
              <p className="text-sm font-black text-foreground">
                {locale === "es" ? "¿Borrar ficha?" : locale === "zh" ? "删除档案？" : "Delete profile?"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                <span className="font-bold text-foreground">{deletePlayerInfo.playerName}</span>
                {" — "}
                {locale === "es" ? "esta acción no se puede deshacer." : locale === "zh" ? "此操作无法撤销。" : "this action cannot be undone."}
              </p>
            </div>

            {deletePlayerInfo.published && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/8 px-3 py-2.5 space-y-0.5">
                <p className="text-[11px] font-black text-amber-700 dark:text-amber-400">
                  ⚠ {locale === "es" ? "Informe publicado" : locale === "zh" ? "报告已发布" : "Published report"}
                </p>
                <p className="text-[10px] text-amber-700/80 dark:text-amber-400/80">
                  {locale === "es"
                    ? "Esta ficha tiene un informe visible para las jugadoras. Al borrarla se retirará automáticamente del Game Plan."
                    : locale === "zh"
                    ? "该档案有一份对球员可见的报告。删除时将自动从比赛方案中撤回。"
                    : "This profile has a report visible to players. Deleting it will automatically retire it from Game Plan."}
                </p>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 rounded-xl"
                onClick={() => setDeletePlayerInfo(null)}
              >
                {locale === "es" ? "Cancelar" : locale === "zh" ? "取消" : "Cancel"}
              </Button>
              <Button
                size="sm"
                className="flex-1 rounded-xl font-bold bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                disabled={deletePlayerMutation.isPending}
                onClick={() => void confirmDeletePlayer()}
              >
                {locale === "es" ? "Borrar ficha" : locale === "zh" ? "删除档案" : "Delete profile"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete team modal ── */}
      {deleteTeamInfo && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-4 pb-6 sm:pb-0">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 space-y-4 shadow-xl">
            {deleteTeamInfo.loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <p className="text-sm font-black text-foreground">
                    {locale === "es" ? "¿Borrar equipo?" : locale === "zh" ? "删除队伍？" : "Delete team?"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    <span className="font-bold text-foreground">{deleteTeamInfo.teamName}</span>
                    {" · "}
                    {deleteTeamInfo.playerCount}{" "}
                    {locale === "es" ? "jugadoras" : locale === "zh" ? "名球员" : "players"}
                  </p>
                </div>

                {deleteTeamInfo.publishedCount > 0 && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/8 px-3 py-2.5 space-y-0.5">
                    <p className="text-[11px] font-black text-amber-700 dark:text-amber-400">
                      ⚠ {deleteTeamInfo.publishedCount}{" "}
                      {locale === "es" ? "informe(s) publicado(s)" : locale === "zh" ? "份报告已发布" : "published report(s)"}
                    </p>
                    <p className="text-[10px] text-amber-700/80 dark:text-amber-400/80">
                      {locale === "es"
                        ? "Se retirarán automáticamente del Game Plan al confirmar."
                        : locale === "zh"
                        ? "确认后将自动从比赛方案中撤回。"
                        : "They will be automatically retired from Game Plan on confirm."}
                    </p>
                  </div>
                )}

                {deleteTeamInfo.playerCount > 0 ? (
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold text-muted-foreground">
                      {locale === "es" ? "¿Qué hacemos con las jugadoras?" : locale === "zh" ? "如何处理球员？" : "What should happen to the players?"}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full rounded-xl text-xs font-bold justify-start gap-2"
                      onClick={() => void confirmDeleteTeam("move")}
                    >
                      📋 {locale === "es" ? "Mover a Free Agents y borrar equipo" : locale === "zh" ? "移至自由球员并删除队伍" : "Move players to Free Agents, delete team"}
                    </Button>
                    <Button
                      size="sm"
                      className="w-full rounded-xl text-xs font-bold bg-destructive hover:bg-destructive/90 text-destructive-foreground justify-start gap-2"
                      onClick={() => void confirmDeleteTeam("delete")}
                    >
                      🗑 {locale === "es" ? "Borrar equipo y todas sus fichas" : locale === "zh" ? "删除队伍及所有档案" : "Delete team and all its profiles"}
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    className="w-full rounded-xl font-bold bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                    onClick={() => void confirmDeleteTeam("delete")}
                  >
                    {locale === "es" ? "Borrar equipo" : locale === "zh" ? "删除队伍" : "Delete team"}
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full rounded-xl"
                  onClick={() => setDeleteTeamInfo(null)}
                >
                  {locale === "es" ? "Cancelar" : locale === "zh" ? "取消" : "Cancel"}
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

