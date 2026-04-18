import { useState } from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n";
import { ArrowLeft, Users, Plus, UserPlus, Trash2, Check, X, Pencil, FlaskConical, Settings, FileText, ChevronDown } from "lucide-react";
import { useTeams, usePlayers, useCreateTeam, useUpdateTeam, useDeleteTeam, useDeletePlayer, type Team, type PlayerProfile } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UScoutWatermark } from "@/components/branding/UScoutBrand";
import { BasketballPlaceholderAvatar } from "@/components/BasketballPlaceholderAvatar";
import { isRealPhoto } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useApprovalStatus, useUnpublishReport } from "@/lib/approval-api";
import { toast } from "@/hooks/use-toast";

export type CoachDashboardMode = "editor" | "reports";

function teamAvatarRingClass(primaryColor: string): string {
  const ring = primaryColor.startsWith("bg-") ? primaryColor.replace(/^bg-/, "ring-") : "ring-primary";
  return cn("ring-2 ring-offset-2 ring-offset-background", ring);
}

export default function CoachDashboard({ mode }: { mode: CoachDashboardMode }) {
  const [, setLocation] = useLocation();
  const { t } = useLocale();
  const { data: teams = [], isLoading: teamsLoading } = useTeams();
  const { data: allPlayers = [] } = usePlayers();
  const createTeamMutation = useCreateTeam();
  const updateTeamMutation = useUpdateTeam();
  const deleteTeamMutation = useDeleteTeam();
  const deletePlayerMutation = useDeletePlayer();

  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [pendingDeleteTeam, setPendingDeleteTeam] = useState<string | null>(null);
  const [pendingDeletePlayer, setPendingDeletePlayer] = useState<string | null>(null);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editingTeamName, setEditingTeamName] = useState("");
  const isEditor = mode === "editor";
  const playersByTeam = (teamId: string) => allPlayers.filter(p => p.teamId === teamId);

  const toggleTeam = (teamId: string) => {
    setExpandedTeamId(prev => prev === teamId ? null : teamId);
    setPendingDeleteTeam(null);
    setPendingDeletePlayer(null);
  };

  const handleCreateTeam = () => {
    const name = newTeamName.trim() || "New Team";
    createTeamMutation.mutate({ name, logo: "🏀", primaryColor: "bg-orange-500" });
    setNewTeamName("");
    setShowAddTeam(false);
  };

  const handleDeleteTeam = (teamId: string) => {
    if (pendingDeleteTeam !== teamId) { setPendingDeleteTeam(teamId); return; }
    deleteTeamMutation.mutate(teamId);
    setPendingDeleteTeam(null);
  };

  const startEditTeam = (team: Team) => {
    setEditingTeamId(team.id);
    setEditingTeamName(team.name);
    setPendingDeleteTeam(null);
  };

  const handleSaveTeamName = () => {
    if (!editingTeamId) return;
    const name = editingTeamName.trim();
    if (name) updateTeamMutation.mutate({ id: editingTeamId, updates: { name } });
    setEditingTeamId(null);
    setEditingTeamName("");
  };

  const handleDeletePlayer = (playerId: string) => {
    if (pendingDeletePlayer !== playerId) { setPendingDeletePlayer(playerId); return; }
    deletePlayerMutation.mutate(playerId);
    setPendingDeletePlayer(null);
  };

  if (teamsLoading) {
    return (
      <div className="relative flex flex-col min-h-[100dvh] bg-background items-center justify-center overflow-hidden">
        <UScoutWatermark position="bottom-right" />
        <div className="relative z-10 w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (teams.length === 0 && !showAddTeam) {
    if (isEditor) {
      return (
        <div className="relative flex flex-col min-h-[100dvh] bg-background items-center justify-center p-6 text-center overflow-hidden">
          <UScoutWatermark position="bottom-right" />
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-16 h-16 bg-card border border-border rounded-lg flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-foreground mb-2">{t("coach_mode")}</h2>
            <p className="text-muted-foreground mb-8 max-w-[250px] mx-auto text-sm">{t("dashboard_empty_teams_hint")}</p>
            <Button
              onClick={() => setShowAddTeam(true)}
              className="rounded-lg px-8 py-6 font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg text-lg border-0"
              data-testid="button-create-team"
            >
              <Plus className="w-5 h-5 mr-2" /> {t("create_team")}
            </Button>
          </div>
        </div>
      );
    }
    return (
      <div className="relative flex flex-col min-h-[100dvh] bg-background overflow-hidden">
        <UScoutWatermark position="bottom-right" />
        <header className="sticky top-0 z-10 bg-background border-b border-border px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/coach")} className="-ml-2 hover:bg-muted rounded-lg" data-testid="button-back">
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </Button>
            <h1 className="text-xl font-bold text-foreground">{t("coach_mode")}</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setLocation("/settings")} className="w-9 h-9 text-muted-foreground hover:text-primary hover:bg-muted rounded-lg">
            <Settings className="w-4 h-4" />
          </Button>
        </header>
        <div className="relative z-10 flex flex-col flex-1 items-center justify-center p-6 text-center">
          <div className="w-16 h-16 bg-card border border-border rounded-lg flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground text-sm max-w-[260px]">{t("no_players")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col min-h-[100dvh] bg-background overflow-hidden">
      <UScoutWatermark position="bottom-right" />
      <header className="sticky top-0 z-10 bg-background border-b border-border px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/coach")} className="-ml-2 hover:bg-muted rounded-lg" data-testid="button-back">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </Button>
          <h1 className="text-xl font-bold text-foreground">{t("coach_mode")}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/settings")} className="w-9 h-9 text-muted-foreground hover:text-primary hover:bg-muted rounded-lg">
            <Settings className="w-4 h-4" />
          </Button>
          {isEditor && (
            <>
              <Button variant="ghost" size="icon" onClick={() => setLocation("/coach/test")} className="w-9 h-9 text-muted-foreground hover:text-primary hover:bg-muted rounded-lg" data-testid="button-test-mode">
                <FlaskConical className="w-4 h-4" />
              </Button>
              <Button
                variant="outline" size="sm"
                onClick={() => { setShowAddTeam(true); setPendingDeleteTeam(null); setPendingDeletePlayer(null); }}
                disabled={createTeamMutation.isPending}
                className="text-xs h-9 font-bold bg-card border-border rounded-lg"
                data-testid="button-add-team"
              >
                <Plus className="w-3 h-3 mr-1" />{`+ ${t("team")}`}
              </Button>
            </>
          )}
        </div>
      </header>

      <main className="relative z-10 flex-1 p-4 space-y-2 pb-10">

        {isEditor && showAddTeam && (
          <div className="bg-card rounded-lg p-4 border border-border shadow-sm space-y-3 mb-4">
            <p className="text-sm font-bold text-foreground">{t("new_team_name")}</p>
            <Input
              autoFocus
              value={newTeamName}
              onChange={e => setNewTeamName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleCreateTeam(); if (e.key === "Escape") setShowAddTeam(false); }}
              placeholder={t("team_name_placeholder")}
              className="h-11 rounded-lg bg-background border-border"
              data-testid="input-team-name"
            />
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowAddTeam(false)} className="flex-1 rounded-lg" data-testid="button-cancel-team">{t("cancel")}</Button>
              <Button size="sm" onClick={handleCreateTeam} className="flex-1 rounded-lg font-bold bg-primary text-primary-foreground" data-testid="button-confirm-team">
                <Check className="w-3.5 h-3.5 mr-1" /> {t("create")}
              </Button>
            </div>
          </div>
        )}

        {teams.map(team => {
          const players = playersByTeam(team.id);
          const isExpanded = expandedTeamId === team.id;
          const isDeleting = pendingDeleteTeam === team.id;
          const isEditing = editingTeamId === team.id;

          return (
            <div key={team.id} className="rounded-lg border border-border overflow-hidden">

              {/* Team header row — clickable to expand */}
              <div
                className={cn(
                  "flex items-center justify-between px-4 py-3 bg-card cursor-pointer select-none transition-colors",
                  isExpanded ? "border-b border-border" : "",
                  !isEditing && "hover:bg-muted/60"
                )}
                onClick={() => !isEditing && !isDeleting && toggleTeam(team.id)}
                data-testid={`row-team-${team.id}`}
              >
                {isEditing ? (
                  <div className="flex items-center gap-2 flex-1 mr-2" onClick={e => e.stopPropagation()}>
                    <span className="text-xl">{team.logo}</span>
                    <Input
                      autoFocus
                      value={editingTeamName}
                      onChange={e => setEditingTeamName(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") handleSaveTeamName(); if (e.key === "Escape") setEditingTeamId(null); }}
                      className="h-9 rounded-lg text-sm font-bold bg-background border-border flex-1"
                      data-testid={`input-edit-team-${team.id}`}
                    />
                    <Button size="icon" variant="ghost" onClick={e => { e.stopPropagation(); setEditingTeamId(null); }} className="w-8 h-8 text-muted-foreground shrink-0 rounded-lg" data-testid={`button-cancel-edit-team-${team.id}`}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" onClick={e => { e.stopPropagation(); handleSaveTeamName(); }} className="w-8 h-8 rounded-lg bg-primary text-primary-foreground shrink-0" data-testid={`button-save-team-${team.id}`}>
                      <Check className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-lg">{team.logo}</span>
                    <div className="min-w-0">
                      <h2 className="text-sm font-extrabold tracking-tight text-foreground truncate" data-testid={`text-team-name-${team.id}`}>{team.name}</h2>
                      <p className="text-xs text-muted-foreground font-medium" data-testid={`text-player-count-${team.id}`}>
                        {players.length} {players.length === 1 ? t("dashboard_player_singular") : t("dashboard_player_plural")}
                      </p>
                    </div>
                  </div>
                )}

                {!isEditing && (
                  <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    {isDeleting ? (
                      <>
                        <span className="text-xs font-semibold text-muted-foreground mr-1">{t("delete_team")}</span>
                        <Button size="icon" variant="ghost" onClick={() => setPendingDeleteTeam(null)} className="w-8 h-8 text-muted-foreground rounded-lg" data-testid={`button-cancel-delete-team-${team.id}`}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" onClick={() => handleDeleteTeam(team.id)} className="w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-lg" data-testid={`button-confirm-delete-team-${team.id}`}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    ) : (
                      <>
                        {isEditor && (
                          <>
                            <Button size="icon" variant="ghost" onClick={() => startEditTeam(team)} className="w-8 h-8 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg" data-testid={`button-edit-team-${team.id}`}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => handleDeleteTeam(team.id)} className="w-8 h-8 text-muted-foreground hover:text-red-400 hover:bg-red-950/30 rounded-lg" data-testid={`button-delete-team-${team.id}`}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" onClick={() => setLocation(`/coach/player/new?team=${team.id}`)} className="w-8 h-8 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm" data-testid={`button-add-player-${team.id}`}>
                              <UserPlus className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200 ml-1", isExpanded && "rotate-180")} />
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Players list — only when expanded */}
              {isExpanded && (
                <div className="bg-background p-3 space-y-2">
                  {players.length === 0 ? (
                    <div className="text-center py-6">
                      <p className="text-muted-foreground text-sm font-medium">{t("no_players")}</p>
                      {isEditor && (
                        <Button variant="link" onClick={() => setLocation(`/coach/player/new?team=${team.id}`)} className="mt-1 text-primary text-sm">
                          {t("add_first_player")}
                        </Button>
                      )}
                    </div>
                  ) : (
                    players.map(player => (
                      <PlayerRow
                        key={player.id}
                        player={player}
                        team={team}
                        mode={mode}
                        isPendingDelete={pendingDeletePlayer === player.id}
                        onDelete={() => handleDeletePlayer(player.id)}
                        onCancelDelete={() => setPendingDeletePlayer(null)}
                        onEdit={() => setLocation(`/coach/player/${player.id}`)}
                        onViewReport={() => setLocation(`/coach/scout/${player.id}/preview`)}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </main>
    </div>
  );
}

function PlayerRow({
  player, team, mode, isPendingDelete, onDelete, onCancelDelete, onEdit, onViewReport,
}: {
  player: PlayerProfile; team: Team; mode: CoachDashboardMode;
  isPendingDelete: boolean; onDelete: () => void; onCancelDelete: () => void;
  onEdit: () => void; onViewReport: () => void;
}) {
  const { t } = useLocale();
  const [, setLocation] = useLocation();
  const { data: approvalStatus, isLoading: approvalLoading } = useApprovalStatus(player.id, {
    enabled: mode === "editor",
  });
  const unpublishMut = useUnpublishReport(player.id);

  const published = Boolean(approvalStatus?.isPublished ?? player.published);
  const approvalCount = approvalStatus?.approvals.length ?? 0;
  const staffTotal = Math.max(approvalStatus?.totalStaff ?? 0, 1);
  const approvalFraction = `${approvalCount}/${staffTotal}`;

  if (isPendingDelete) {
    return (
      <div className="bg-card rounded-lg p-4 flex items-center justify-between border border-red-500/35" data-testid={`card-player-delete-${player.id}`}>
        <span className="text-sm font-semibold text-red-400">
          {player.name?.trim()
            ? t("dashboard_delete_player_named").replace("{name}", player.name.trim())
            : t("dashboard_delete_player_anon")}
        </span>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={onCancelDelete} className="h-8 px-3 text-xs text-muted-foreground rounded-lg" data-testid={`button-cancel-delete-player-${player.id}`}>{t("cancel")}</Button>
          <Button size="sm" onClick={onDelete} className="h-8 px-3 text-xs font-bold bg-red-500 hover:bg-red-600 text-white rounded-lg" data-testid={`button-confirm-delete-player-${player.id}`}>{t("delete")}</Button>
        </div>
      </div>
    );
  }

  const inp = player.inputs;
  const num = player.number || "—";

  return (
    <div className="relative bg-card rounded-lg p-3 flex items-center gap-3 border border-border hover:border-primary/55 transition-colors" data-testid={`card-player-${player.id}`}>
      <div className="relative shrink-0">
        {isRealPhoto(player.imageUrl)
          ? <img src={player.imageUrl} alt={player.name} className={cn("w-12 h-12 rounded-full object-cover shadow-md", teamAvatarRingClass(team.primaryColor))} />
          : <div className={cn("w-12 h-12 rounded-full overflow-hidden shadow-md", teamAvatarRingClass(team.primaryColor))}><BasketballPlaceholderAvatar size={48} /></div>
        }
        {/* Badge: bottom-left of image, no overlap with buttons */}
        <span
          className="absolute -bottom-1 -left-1 z-10 inline-flex min-w-[1.5rem] h-5 items-center justify-center px-1 text-[9px] font-black tracking-tight text-primary bg-secondary border border-border -skew-x-12 shadow-md"
          style={{ clipPath: "polygon(8% 0, 100% 0, 100% 100%, 0 100%, 0 28%)" }}
        >
          <span className="skew-x-12">{num}</span>
        </span>
      </div>
      <div
        className={cn(
          "flex-1 min-w-0",
          mode === "editor" && "cursor-pointer rounded-md -m-1 p-1 hover:bg-muted/60",
        )}
        onClick={
          mode === "editor"
            ? () => setLocation(`/coach/scout/${player.id}/review`)
            : undefined
        }
        role={mode === "editor" ? "button" : undefined}
        tabIndex={mode === "editor" ? 0 : undefined}
        onKeyDown={
          mode === "editor"
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setLocation(`/coach/scout/${player.id}/review`);
                }
              }
            : undefined
        }
        data-testid={mode === "editor" ? `player-row-open-review-${player.id}` : undefined}
      >
        <h3 className="font-extrabold text-sm truncate text-foreground">{player.name?.trim() || t("dashboard_unnamed_player")}</h3>
        {mode === "editor" && approvalStatus?.hasDiscrepancy && (
          <div className="flex flex-wrap items-center gap-1 mt-1">
            <span
              className="inline-flex items-center justify-center min-w-6 h-5 px-1 rounded-md border border-destructive/40 bg-destructive/10 text-destructive text-xs font-black"
              title={t("approval_discrepancy")}
            >
              ⚠
            </span>
          </div>
        )}
        <div className="flex items-center gap-1 text-xs font-bold text-primary mt-0.5">
          <span>{inp?.position ?? "—"}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-primary/90">{inp?.height ?? "—"}</span>
        </div>
      </div>

      {mode === "editor" ? (
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <div className="flex items-center gap-1 flex-wrap justify-end">
            <Badge
              variant="secondary"
              className="text-[10px] font-bold px-1.5 py-0.5 h-auto min-h-6 max-w-[9rem] sm:max-w-none justify-center tabular-nums border-border text-center leading-tight"
              data-testid={`badge-approval-fraction-${player.id}`}
            >
              {approvalLoading ? "—" : `${approvalFraction} ${t("dashboard_player_coaches_label")}`}
            </Badge>
            {published && (
              <>
                <Badge
                  variant="outline"
                  className="text-[10px] font-bold h-7 px-2 border-primary/40 bg-primary/10 text-primary gap-1 shrink-0"
                  data-testid={`badge-published-${player.id}`}
                >
                  <Check className="w-3 h-3" />
                  {t("dashboard_player_published_badge")}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-[10px] font-bold rounded-lg border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0"
                  disabled={unpublishMut.isPending}
                  data-testid={`button-unpublish-player-${player.id}`}
                  onClick={() => {
                    if (!window.confirm(t("approval_unpublish_confirm"))) return;
                    unpublishMut.mutate(undefined, {
                      onSuccess: () => {
                        toast({ title: t("approval_unpublish_success") });
                      },
                      onError: (err) => {
                        toast({
                          variant: "destructive",
                          title: t("approval_unpublish_error"),
                          description: (err as Error)?.message ?? "",
                        });
                      },
                    });
                  }}
                >
                  {unpublishMut.isPending ? t("saving") : t("approval_unpublish")}
                </Button>
              </>
            )}
          </div>
          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setLocation(`/coach/scout/${player.id}/review`)}
              className="h-8 shrink-0 gap-1 px-2 text-primary hover:bg-primary/10 rounded-lg text-xs font-bold"
              title={t("editor_review_report")}
              data-testid={`button-review-report-${player.id}`}
            >
              <Check className="w-4 h-4" />
              {t("editor_review_report")}
            </Button>
            <Button size="sm" variant="outline" onClick={onEdit} className="h-8 px-3 shrink-0 rounded-lg text-xs font-bold border-border bg-transparent text-foreground hover:bg-muted" data-testid={`button-edit-player-${player.id}`}>
              <Pencil className="w-3 h-3 mr-1" /> {t("edit")}
            </Button>
            <Button size="icon" variant="ghost" onClick={onDelete} className="w-7 h-7 shrink-0 text-muted-foreground hover:text-red-400 hover:bg-red-950/30 rounded-lg" data-testid={`button-delete-player-${player.id}`}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" onClick={onViewReport} className="h-8 px-3 shrink-0 rounded-lg text-xs font-black bg-primary text-primary-foreground border-0 shadow-[0_0_18px_hsl(var(--primary)/0.35)] hover:bg-primary/90" data-testid={`button-report-player-${player.id}`}>
          <FileText className="w-3 h-3 mr-1" /> {t("dashboard_view_report")}
        </Button>
      )}
    </div>
  );
}