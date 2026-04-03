import { t } from "@/lib/i18n";
import { useState } from "react";
import { useLocation } from "wouter";
import { useLocale } from "@/lib/i18n";
import { ArrowLeft, Users, Plus, UserPlus, Trash2, Check, X, Pencil, FlaskConical, Settings } from "lucide-react";
import { useTeams, usePlayers, useCreateTeam, useUpdateTeam, useDeleteTeam, useDeletePlayer, type Team, type PlayerProfile } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function CoachDashboard() {
  const [, setLocation] = useLocation();
  const { t } = useLocale();  const { data: teams = [], isLoading: teamsLoading } = useTeams();
  const { data: allPlayers = [] } = usePlayers();
  const createTeamMutation = useCreateTeam();
  const updateTeamMutation = useUpdateTeam();
  const deleteTeamMutation = useDeleteTeam();
  const deletePlayerMutation = useDeletePlayer();

  const [showAddTeam, setShowAddTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [pendingDeleteTeam, setPendingDeleteTeam] = useState<string | null>(null);
  const [pendingDeletePlayer, setPendingDeletePlayer] = useState<string | null>(null);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editingTeamName, setEditingTeamName] = useState("");

  const playersByTeam = (teamId: string) => allPlayers.filter(p => p.teamId === teamId);

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
      <div className="flex flex-col min-h-[100dvh] bg-slate-50 dark:bg-slate-950 items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (teams.length === 0 && !showAddTeam) {
    return (
      <div className="flex flex-col min-h-[100dvh] bg-slate-50 dark:bg-slate-950 items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
          <Users className="w-8 h-8 text-slate-400" />
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-2">{t("coach_mode")}</h2>
        <p className="text-slate-500 mb-8 max-w-[250px] mx-auto text-sm">Create your first team to start building scouting reports.</p>
        <Button
          onClick={() => setShowAddTeam(true)}
          className="rounded-full px-8 py-6 font-bold bg-primary hover:bg-primary/90 text-white shadow-lg text-lg"
          data-testid="button-create-team"
        >
          <Plus className="w-5 h-5 mr-2" /> Create Team
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[100dvh] bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/")} className="-ml-2 hover:bg-slate-100 dark:hover:bg-slate-800" data-testid="button-back">
            <ArrowLeft className="w-5 h-5 text-slate-700 dark:text-slate-300" />
          </Button>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{t("coach_mode")}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/settings")}
            className="w-9 h-9 text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/coach/test")}
            className="w-9 h-9 text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Engine Test Mode"
            data-testid="button-test-mode"
          >
            <FlaskConical className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setShowAddTeam(true); setPendingDeleteTeam(null); setPendingDeletePlayer(null); }}
            disabled={createTeamMutation.isPending}
            className="text-xs h-9 font-bold bg-white dark:bg-slate-900"
            data-testid="button-add-team"
          >
            <Plus className="w-3 h-3 mr-1" />{`+ ${t("team")}`}
          </Button>
        </div>
      </header>

      <main className="flex-1 p-4 space-y-6 pb-10">

        {showAddTeam && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{t("new_team_name")}</p>
            <Input
              autoFocus
              value={newTeamName}
              onChange={e => setNewTeamName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleCreateTeam(); if (e.key === "Escape") setShowAddTeam(false); }}
              placeholder="e.g. Rival A"
              className="h-11 rounded-xl bg-slate-50 dark:bg-slate-950/50 dark:border-slate-700"
              data-testid="input-team-name"
            />
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowAddTeam(false)} className="flex-1 rounded-xl" data-testid="button-cancel-team">
                Cancel
              </Button>
              <Button size="sm" onClick={handleCreateTeam} className="flex-1 rounded-xl font-bold" data-testid="button-confirm-team">
                <Check className="w-3.5 h-3.5 mr-1" /> Create
              </Button>
            </div>
          </div>
        )}

        {teams.map(team => {
          const players = playersByTeam(team.id);
          const isDeleting = pendingDeleteTeam === team.id;

          const isEditing = editingTeamId === team.id;

          return (
            <div key={team.id} className="space-y-3">
              <div className="flex items-center justify-between px-1">
                {isEditing ? (
                  <div className="flex items-center gap-2 flex-1 mr-2">
                    <span className="text-xl">{team.logo}</span>
                    <Input
                      autoFocus
                      value={editingTeamName}
                      onChange={e => setEditingTeamName(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") handleSaveTeamName(); if (e.key === "Escape") setEditingTeamId(null); }}
                      className="h-9 rounded-xl text-sm font-bold bg-white dark:bg-slate-900 dark:border-slate-700 flex-1"
                      data-testid={`input-edit-team-${team.id}`}
                    />
                    <Button size="icon" variant="ghost" onClick={() => setEditingTeamId(null)} className="w-8 h-8 text-slate-400 shrink-0" data-testid={`button-cancel-edit-team-${team.id}`}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" onClick={handleSaveTeamName} className="w-8 h-8 rounded-full bg-primary text-white shrink-0" data-testid={`button-save-team-${team.id}`}>
                      <Check className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{team.logo}</span>
                    <div>
                      <h2 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white" data-testid={`text-team-name-${team.id}`}>{team.name}</h2>
                      <p className="text-xs text-muted-foreground font-medium" data-testid={`text-player-count-${team.id}`}>{players.length} {players.length === 1 ? "player" : "players"}</p>
                    </div>
                  </div>
                )}
                {!isEditing && (
                  <div className="flex items-center gap-1.5">
                    {isDeleting ? (
                      <>
                        <span className="text-xs font-semibold text-slate-500 mr-1">{t("delete_team")}</span>
                        <Button size="icon" variant="ghost" onClick={() => setPendingDeleteTeam(null)} className="w-8 h-8 text-slate-400" data-testid={`button-cancel-delete-team-${team.id}`}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" onClick={() => handleDeleteTeam(team.id)} className="w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full" data-testid={`button-confirm-delete-team-${team.id}`}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="icon" variant="ghost" onClick={() => startEditTeam(team)} className="w-8 h-8 text-slate-300 dark:text-slate-600 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800" data-testid={`button-edit-team-${team.id}`}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDeleteTeam(team.id)} className="w-8 h-8 text-slate-300 dark:text-slate-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30" data-testid={`button-delete-team-${team.id}`}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" onClick={() => setLocation(`/coach/player/new?team=${team.id}`)} className="w-8 h-8 rounded-full bg-primary hover:bg-primary/90 text-white shadow-sm" data-testid={`button-add-player-${team.id}`}>
                          <UserPlus className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {players.length === 0 ? (
                <div className="text-center py-8 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800">
                  <p className="text-muted-foreground text-sm font-medium">{t("no_players")}</p>
                  <Button variant="link" onClick={() => setLocation(`/coach/player/new?team=${team.id}`)} className="mt-1 text-primary text-sm">
                    Add first player
                  </Button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {players.map(player => (
                    <PlayerRow
                      key={player.id}
                      player={player}
                      team={team}
                      isPendingDelete={pendingDeletePlayer === player.id}
                      onDelete={() => handleDeletePlayer(player.id)}
                      onCancelDelete={() => setPendingDeletePlayer(null)}
                      onEdit={() => setLocation(`/coach/player/${player.id}`)}
                    />
                  ))}
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
  player,
  team,
  isPendingDelete,
  onDelete,
  onCancelDelete,
  onEdit,
}: {
  player: PlayerProfile;
  team: Team;
  isPendingDelete: boolean;
  onDelete: () => void;
  onCancelDelete: () => void;
  onEdit: () => void;
}) {
  if (isPendingDelete) {
    return (
      <div className="bg-red-50 dark:bg-red-950/20 rounded-2xl p-4 flex items-center justify-between border border-red-200 dark:border-red-900/40" data-testid={`card-player-delete-${player.id}`}>
        <span className="text-sm font-semibold text-red-600 dark:text-red-400">Delete {player.name || "this player"}?</span>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={onCancelDelete} className="h-8 px-3 text-xs text-slate-500" data-testid={`button-cancel-delete-player-${player.id}`}>{t("cancel")}</Button>
          <Button size="sm" onClick={onDelete} className="h-8 px-3 text-xs font-bold bg-red-500 hover:bg-red-600 text-white rounded-full" data-testid={`button-confirm-delete-player-${player.id}`}>{t("delete")}</Button>
        </div>
      </div>
    );
  }

  const inp = player.inputs;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 flex items-center gap-3 shadow-sm border border-slate-100 dark:border-slate-800/60 hover:shadow-md transition-shadow" data-testid={`card-player-${player.id}`}>
      <div className="flex-1 flex items-center gap-4 min-w-0">
        <div className="relative shrink-0">
          <img src={player.imageUrl} alt={player.name} className="w-12 h-12 rounded-full object-cover border-2 border-slate-100 dark:border-slate-800 shadow-sm" />
          <div className={`absolute -bottom-1 -right-1 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-sm ${team.primaryColor}`}>
            {player.number || "-"}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-base truncate text-slate-900 dark:text-slate-100">{player.name || "Unnamed"}</h3>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <span className="text-primary">{inp?.position ?? "—"}</span>
            <span>·</span>
            <span>{inp?.height ?? "—"}</span>
          </div>
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={onEdit}
        className="h-9 px-3 shrink-0 rounded-xl text-xs font-bold border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
        data-testid={`button-edit-player-${player.id}`}
      >
        <Pencil className="w-3.5 h-3.5 mr-1.5" /> {t("edit")}
      </Button>
      <Button
        size="icon"
        variant="ghost"
        onClick={onDelete}
        className="w-8 h-8 shrink-0 text-slate-300 dark:text-slate-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
        data-testid={`button-delete-player-${player.id}`}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}
