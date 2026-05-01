import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "./queryClient";

export type PlayerSeasonStats = {
  playerName: string;
  teamName: string;
  season: string;
  games: number;
  mpg: number;
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  topg: number;
  fgPct: number | null;
  fg3Pct: number | null;
  ftPct: number | null;
};

export type GameLog = {
  id: string;
  playerName: string;
  teamName: string;
  season: string;
  gameDate: string | null;
  rivalName: string | null;
  minutes: number | null;
  points: number | null;
  reboundsTotal: number | null;
  assists: number | null;
  steals: number | null;
  blocks: number | null;
  turnovers: number | null;
  plusMinus: number | null;
};

export function usePlayerSeasonStats() {
  return useQuery({
    queryKey: ["/api/stats/players"],
    queryFn: async (): Promise<{ players: PlayerSeasonStats[] }> =>
      (await apiRequest("GET", "/api/stats/players")).json(),
    networkMode: "offlineFirst",
    staleTime: 60_000,
  });
}

export function useGameLog(playerName: string | null | undefined, season?: string | null) {
  return useQuery({
    queryKey: ["/api/stats/games", playerName, season ?? ""],
    queryFn: async (): Promise<{ games: GameLog[] }> => {
      const qs = new URLSearchParams();
      qs.set("playerName", String(playerName ?? ""));
      if (season) qs.set("season", season);
      return (await apiRequest("GET", `/api/stats/games?${qs.toString()}`)).json();
    },
    enabled: Boolean(playerName && String(playerName).trim().length > 0),
    networkMode: "offlineFirst",
    staleTime: 30_000,
  });
}

