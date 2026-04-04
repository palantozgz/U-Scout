import { useLocation, useRoute } from "wouter";
import { ArrowLeft } from "lucide-react";
import { useTeams, usePlayers } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/i18n";
import { BasketballPlaceholderAvatar } from "@/components/BasketballPlaceholderAvatar";
import { isRealPhoto } from "@/lib/utils";

// ── Team drill-down (optional browse by team) ────────────────────────────────
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