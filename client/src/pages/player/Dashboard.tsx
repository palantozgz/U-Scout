import { useLocation, useRoute } from "wouter";
import { ArrowLeft, Target } from "lucide-react";
import { useTeams, usePlayers } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/i18n";
import { BasketballPlaceholderAvatar } from "@/components/BasketballPlaceholderAvatar";
import { isRealPhoto } from "@/lib/utils";

// ── Pantalla 1: lista de equipos ─────────────────────────────────────────────
export default function PlayerModeDashboard() {
  const { t } = useLocale();
  const [, setLocation] = useLocation();
  const { data: teams = [], isLoading: teamsLoading } = useTeams();
  const { data: allPlayers = [] } = usePlayers();

  if (teamsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh] bg-[#060a14]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const teamsWithPlayers = teams.filter(t => allPlayers.some(p => p.teamId === t.id));

  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#060a14]">
      <header className="px-5 pt-10 pb-6">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/")} className="text-slate-400 hover:bg-[#1e2d4a] rounded-full -ml-2" data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="w-9 h-9 rounded-full bg-[#1e2d4a] flex items-center justify-center">
            <Target className="text-primary w-4 h-4" />
          </div>
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#f1f5f9]">{t("scouting_reports")}</h1>
        <p className="text-[#475569] text-sm mt-1">{t("scouting_reports_subtitle")}</p>
      </header>

      <main className="flex-1 px-4 pb-10 space-y-3">
        {teamsWithPlayers.length === 0 && (
          <div className="text-center py-20">
            <p className="text-[#475569] font-medium">No teams available.</p>
          </div>
        )}
        {teamsWithPlayers.map(team => {
          const count = allPlayers.filter(p => p.teamId === team.id).length;
          return (
            <button
              key={team.id}
              onClick={() => setLocation(`/player/team/${team.id}`)}
              className="w-full flex items-center justify-between bg-[#0d1526] border border-[#1e2d4a] hover:border-primary/50 rounded-xl px-4 py-4 transition-colors active:scale-[0.98]"
              data-testid={`button-team-${team.id}`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{team.logo}</span>
                <div className="text-left">
                  <p className="font-extrabold text-sm tracking-widest uppercase text-[#f1f5f9]">{team.name}</p>
                  <p className="text-xs text-[#475569] font-medium mt-0.5">{count} {count === 1 ? "player" : "players"}</p>
                </div>
              </div>
              <svg className="w-4 h-4 text-[#334155]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          );
        })}
      </main>
    </div>
  );
}

// ── Pantalla 2: jugadoras del equipo, estilo gaming ──────────────────────────
export function PlayerTeamView() {
  const { t } = useLocale();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/player/team/:teamId");
  const { data: teams = [] } = useTeams();
  const { data: allPlayers = [], isLoading } = usePlayers();

  const team = teams.find(t => t.id === params?.teamId);
  const players = allPlayers.filter(p => p.teamId === params?.teamId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh] bg-[#060a14]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#060a14]">
      <header className="px-4 pt-10 pb-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/player")} className="text-slate-400 hover:bg-[#1e2d4a] rounded-full shrink-0" data-testid="button-back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl">{team?.logo}</span>
          <h1 className="text-lg font-extrabold tracking-widest uppercase text-[#f1f5f9] truncate">{team?.name}</h1>
        </div>
      </header>

      <main className="flex-1 px-3 pb-10">
        <div className="grid grid-cols-2 gap-3">
          {players.map(player => (
            <button
              key={player.id}
              onClick={() => setLocation(`/player/${player.id}`)}
              className="bg-[#0d1526] border border-[#1e2d4a] hover:border-primary/60 rounded-xl overflow-hidden transition-all active:scale-95 group"
              data-testid={`card-player-${player.id}`}
            >
              {/* Imagen full-width con overlay */}
              <div className="relative w-full aspect-square">
                {isRealPhoto(player.imageUrl) ? (
                  <img
                    src={player.imageUrl}
                    alt={player.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="relative w-full aspect-square flex items-center justify-center overflow-hidden bg-[#0d1526]">
                    <BasketballPlaceholderAvatar size={200} />
                  </div>
                )}
                {/* Overlay gradiente bottom */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#060a14] via-[#060a14]/40 to-transparent" />
                {/* Número badge top-right */}
                <span
                  className="absolute top-2 right-2 inline-flex min-w-[1.75rem] h-6 items-center justify-center px-1.5 text-[10px] font-black text-[#93c5fd] bg-[#060a14]/80 border border-[#1e2d4a] -skew-x-12 backdrop-blur-sm"
                  style={{ clipPath: "polygon(8% 0, 100% 0, 100% 100%, 0 100%, 0 28%)" }}
                >
                  <span className="skew-x-12">{player.number || "—"}</span>
                </span>
              </div>
              {/* Info */}
              <div className="px-3 py-2.5 text-left">
                <p className="font-extrabold text-sm text-[#f1f5f9] truncate">{player.name || "Unnamed"}</p>
                <p className="text-[10px] font-bold text-[#93c5fd] uppercase tracking-wider mt-0.5">
                  {player.inputs?.position ?? "—"}
                </p>
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}