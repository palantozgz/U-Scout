import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "./queryClient";

export function toTitleCase(str: string | null | undefined): string | null {
  if (!str?.trim()) return null;
  return str
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export type PlayerSeasonStats = {
  externalId: string;
  playerName: string;
  playerNameEn?: string | null;
  position?: string | null;
  photoUrl?: string | null;
  teamName: string;
  teamNameEn?: string | null;
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
  tsPct: number | null;
  eFGPct: number | null;
  astTovRatio: number | null;
  ftRate: number | null;
  usagePct: number | null;
  orbPerGame: number | null;
  drbPerGame: number | null;
  pie: number | null;
  homeSplit: { pts: number; reb: number; ast: number };
  awaySplit: { pts: number; reb: number; ast: number };
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
    networkMode: "online",
    staleTime: 60_000,
    retry: 0,
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

export interface StandingsRow {
  teamExternalId: string;
  teamName: string;
  teamNameEn?: string | null;
  logoUrl: string | null;
  rank: number;
  wins: number;
  losses: number;
  winPct: number | null;
  ppg: number | null;
  oppg: number | null;
  phaseName: string | null;
  streak?: number | null;
  eFGPct?: number | null;
}

export interface LeaderRow {
  externalId: string;
  playerName: string;
  playerNameEn: string | null;
  teamName: string | null;
  value: number | null;
  games: number;
}

export function useSeasons() {
  return useQuery({
    queryKey: ["stats-seasons"],
    queryFn: async () => {
      const r = await apiRequest("GET", "/api/stats/seasons");
      return r.json() as Promise<{ seasons: { seasonId: number; label: string }[] }>;
    },
    staleTime: 1000 * 60 * 60,
    retry: 0,
  });
}

export function useStandings(seasonId: number) {
  return useQuery({
    queryKey: ["stats-standings", seasonId],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/stats/standings?seasonId=${seasonId}`);
      return r.json() as Promise<{ standings: StandingsRow[] }>;
    },
    networkMode: "online",
    staleTime: 300_000,
    retry: 0,
  });
}

export function useLeaders(seasonId: number, stat: string) {
  return useQuery({
    queryKey: ["stats-leaders", seasonId, stat],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/stats/leaders?seasonId=${seasonId}&stat=${encodeURIComponent(stat)}`);
      return r.json() as Promise<{ leaders: LeaderRow[]; stat: string }>;
    },
    networkMode: "online",
    staleTime: 300_000,
    retry: 0,
  });
}

export interface PlayerDetail {
  externalId: string;
  nameZh: string;
  nameEn: string | null;
  jerseyNumber: string | number | null;
  photoUrl?: string | null;
  position: string | null;
  teamName: string | null;
  teamNameEn?: string | null;
  teamLogo: string | null;
  teamExternalId: string | null;
  games: number;
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  topg: number;
  mpg: number;
  fgPct: number | null;
  fg3Pct: number | null;
  ftPct: number | null;
  tsPct: number | null;
  eFGPct: number | null;
  astTovRatio: number | null;
  ftRate: number | null;
  usagePct: number | null;
  orbPerGame: number | null;
  drbPerGame: number | null;
  pie: number | null;
  homeSplit: { pts: number; reb: number; ast: number };
  awaySplit: { pts: number; reb: number; ast: number };
}

export interface GameLogEntry {
  gameId: number;
  gameDate: string | null;
  rivalName: string | null;
  rivalNameEn?: string | null;
  score: string | null;
  minutes: string | null;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
  ftm: number;
  fta: number;
  plusMinus: number;
  isStart: boolean;
  isHome?: boolean;
}

export interface TeamRosterPlayer {
  externalId: string;
  nameZh: string;
  nameEn: string | null;
  jerseyNumber: string | number | null;
  position: string | null;
  games: number;
  ppg: number;
  rpg: number;
  apg: number;
}

export interface TeamGameLogEntry {
  gameId: string;
  date: string;
  isHome: boolean;
  opponentId: string;
  opponentName: string;
  opponentNameEn: string | null;
  teamScore: number;
  oppScore: number;
  result: "W" | "L";
  margin: number;
}

export interface TeamDetail {
  externalId: string;
  nameZh: string;
  nameEn?: string | null;
  logoUrl: string | null;
  wins: number;
  losses: number;
  ppg: number | null;
  oppg: number | null;
  net: number | null;
  rank: number;
  winPct?: number | null;
  streak?: number | null;
  last10W?: number | null;
  last10L?: number | null;
  homeW?: number | null;
  homeL?: number | null;
  awayW?: number | null;
  awayL?: number | null;
  teamFgPct?: number | null;
  eFGPct: number | null;
  tovPct: number | null;
  ftRate: number | null;
  orbPct: number | null;
  drbPct: number | null;
  paceEst: number | null;
  ortg?: number | null;
  drtg?: number | null;
  netRtg?: number | null;
  pppOf?: number | null;
  pppDef?: number | null;
  pointsByZone?: { paint: number; mid: number; fg3: number; ft: number } | null;
  gameLog?: TeamGameLogEntry[];
}

export function useTeamDetail(externalId: string | null | undefined, seasonId?: number) {
  return useQuery({
    queryKey: ["stats-team-detail", externalId, seasonId ?? 2092],
    queryFn: async () => {
      const qs = seasonId ? `?seasonId=${seasonId}` : "";
      const r = await apiRequest("GET", `/api/stats/team/${externalId}${qs}`);
      return r.json() as Promise<{ team: TeamDetail; players: TeamRosterPlayer[] }>;
    },
    enabled: Boolean(externalId),
    staleTime: 1000 * 60 * 30,
    retry: 0,
  });
}

export function usePlayerDetail(externalId: string | null | undefined) {
  return useQuery({
    queryKey: ["stats-player-detail", externalId],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/stats/player/${externalId}`);
      return r.json() as Promise<{ player: PlayerDetail; gameLog: GameLogEntry[] }>;
    },
    enabled: Boolean(externalId),
    staleTime: 1000 * 60 * 30,
    retry: 0,
  });
}

export interface LeagueAverages {
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  fgPct: number | null;
  fg3Pct: number | null;
  eFGPct: number | null;
  tsPct: number | null;
  tovPct: number | null;
  ftRate: number | null;
  orbPct: number | null;
  orbPerGame: number | null;
  drbPerGame: number | null;
  ortg?: number | null;
  drtg?: number | null;
  pace?: number | null;
  ppp?: number | null;
  drbPct?: number | null;
}

export function useLeagueAverages(seasonId?: number, position?: string | null) {
  return useQuery({
    queryKey: ["stats-league-averages", seasonId ?? 2092, position ?? "all"],
    queryFn: async () => {
      const pos = position ? `&position=${encodeURIComponent(position)}` : "";
      const r = await apiRequest("GET", `/api/stats/league-averages?seasonId=${seasonId ?? 2092}${pos}`);
      return r.json() as Promise<LeagueAverages>;
    },
    staleTime: 1000 * 60 * 60,
    retry: 0,
  });
}

export function usePlayerPercentiles(seasonId?: number, position?: string | null) {
  return useQuery({
    queryKey: ["stats-player-percentiles", seasonId ?? 2092, position ?? "all"],
    queryFn: async () => {
      const pos = position ? `&position=${encodeURIComponent(position)}` : "";
      const r = await apiRequest("GET", `/api/stats/player-percentiles?seasonId=${seasonId ?? 2092}${pos}`);
      return r.json() as Promise<{
        p95Ppg: number;
        p95Rpg: number;
        p95Apg: number;
        p95Spg: number;
        p95Bpg: number;
        p95TsPct: number;
        p95EFGPct: number;
        p20Tpa: number;
        p40Tpa: number;
        p50Tpa: number;
        p75Tpa: number;
        p90Tpa: number;
      }>;
    },
    staleTime: 1000 * 60 * 60,
    retry: 0,
  });
}

