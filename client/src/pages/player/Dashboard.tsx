import { Link, useLocation } from "wouter";
import { ArrowLeft, Search, Target } from "lucide-react";
import { useTeams, usePlayers } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useLocale } from "@/lib/i18n";

export default function PlayerModeDashboard() {
  const { t } = useLocale();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const { data: teams = [], isLoading: teamsLoading } = useTeams();
  const { data: allPlayers = [], isLoading: playersLoading } = usePlayers();

  const isLoading = teamsLoading || playersLoading;

  const filteredTeams = teams.filter(team => {
    const teamPlayers = allPlayers.filter(p => p.teamId === team.id);
    return teamPlayers.some(
      p => p.name.toLowerCase().includes(search.toLowerCase()) ||
           team.name.toLowerCase().includes(search.toLowerCase())
    );
  });

  const teamsToShow = search ? filteredTeams : teams;

  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#f8fafc] dark:bg-slate-950">
      <header className="bg-slate-900 text-white pt-12 pb-6 px-5 rounded-b-[2rem] shadow-lg sticky top-0 z-10">
        <div className="flex justify-between items-center mb-6">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/")} className="text-white hover:bg-white/20 -ml-2 rounded-full" data-testid="button-back">
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-md">
            <Target className="text-primary w-5 h-5" />
          </div>
        </div>
        
        <h1 className="text-3xl font-extrabold tracking-tight mb-2">{t("scouting_reports")}</h1>
        <p className="text-slate-400 text-sm font-medium">{t("scouting_reports_subtitle")}</p>
        
        <div className="mt-6 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search players or teams..." 
            className="w-full bg-white/10 border-white/5 rounded-2xl py-3 pl-12 pr-4 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary backdrop-blur-sm"
            data-testid="input-search"
          />
        </div>
      </header>

      <main className="flex-1 p-5 space-y-8 -mt-2">
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!isLoading && teamsToShow.length === 0 && (
          <div className="text-center py-20">
            <p className="text-slate-500 font-medium">No players found.</p>
          </div>
        )}

        {teamsToShow.map(team => {
          const teamPlayers = allPlayers.filter(p => p.teamId === team.id &&
            (search === "" || p.name.toLowerCase().includes(search.toLowerCase()) || team.name.toLowerCase().includes(search.toLowerCase()))
          );
          if (teamPlayers.length === 0) return null;
          
          return (
            <div key={team.id} className="space-y-4" data-testid={`section-team-${team.id}`}>
              <div className="flex items-center gap-3 px-1">
                <span className="text-2xl">{team.logo}</span>
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">{team.name}</h2>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                {teamPlayers.map(player => (
                  <Link key={player.id} href={`/player/${player.id}`}>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 shadow-sm border border-slate-100 dark:border-slate-800 cursor-pointer active:scale-95 transition-transform" data-testid={`card-player-${player.id}`}>
                      <div className="flex flex-col items-center text-center gap-2">
                        <div className="relative">
                          <img 
                            src={player.imageUrl} 
                            alt={player.name} 
                            className="w-20 h-20 rounded-full object-cover border-[3px] border-slate-50 shadow-inner"
                          />
                          <div className={`absolute -bottom-2 right-0 left-0 mx-auto w-8 h-8 rounded-full border-[3px] border-white flex items-center justify-center text-white font-black text-xs ${team.primaryColor}`}>
                            {player.number}
                          </div>
                        </div>
                        <div className="mt-1">
                          <h3 className="font-bold text-sm leading-tight text-slate-900 dark:text-white line-clamp-1">{player.name}</h3>
                          <p className="text-[10px] text-muted-foreground font-semibold mt-0.5 uppercase tracking-wider">
                            {(player.inputs)?.position ?? "—"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
}
