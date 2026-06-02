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

/** Entry cached by GET /api/stats/players/all-detail (same shape as usePlayerDetail). */
export type StatsPlayerDetailEntry = {
  player: PlayerDetail;
  gameLog: GameLogEntry[];
};

export type StatsPlayersAllDetailResponse = {
  players: Record<string, StatsPlayerDetailEntry>;
};

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
  avgPlayerPpg?: number | null;
  avgPlayerRpg?: number | null;
  avgPlayerApg?: number | null;
}

function normalizeLeagueAverages(raw: Record<string, unknown>): LeagueAverages {
  const num = (v: unknown): number | null =>
    v != null && v !== "" && !Number.isNaN(Number(v)) ? Number(v) : null;
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      if (raw[k] != null && raw[k] !== undefined) return raw[k];
    }
    return undefined;
  };
  return {
    ppg: Number(pick("ppg") ?? 0),
    rpg: Number(pick("rpg") ?? 0),
    apg: Number(pick("apg") ?? 0),
    spg: Number(pick("spg") ?? 0),
    bpg: Number(pick("bpg") ?? 0),
    fgPct: num(pick("fgPct", "fgpct")),
    fg3Pct: num(pick("fg3Pct", "fg3pct")),
    eFGPct: num(pick("eFGPct", "efgpct")),
    tsPct: num(pick("tsPct", "tspct")),
    tovPct: num(pick("tovPct", "tovpct")),
    ftRate: num(pick("ftRate", "ftrate")),
    orbPct: num(pick("orbPct", "orbpct")),
    orbPerGame: num(pick("orbPerGame", "orbpergame")),
    drbPerGame: num(pick("drbPerGame", "drbpergame")),
    ortg: num(pick("ortg")),
    drtg: num(pick("drtg")),
    pace: num(pick("pace")),
    ppp: num(pick("ppp")),
    drbPct: num(pick("drbPct", "drbpct")),
    avgPlayerPpg: num(pick("avgPlayerPpg", "avgplayerppg", "avg_player_ppg")),
    avgPlayerRpg: num(pick("avgPlayerRpg", "avgplayerrpg", "avg_player_rpg")),
    avgPlayerApg: num(pick("avgPlayerApg", "avgplayerapg", "avg_player_apg")),
  };
}

// v3 — separate player-avg query + normalized keys
export function useLeagueAverages(seasonId?: number, position?: string | null) {
  return useQuery({
    queryKey: ["stats-league-averages-v3", seasonId ?? 2092, position ?? "all"],
    queryFn: async () => {
      const pos = position ? `&position=${encodeURIComponent(position)}` : "";
      const r = await apiRequest("GET", `/api/stats/league-averages?seasonId=${seasonId ?? 2092}${pos}`);
      const raw = (await r.json()) as Record<string, unknown>;
      return normalizeLeagueAverages(raw);
    },
    staleTime: 1000 * 60 * 5,
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

export interface GameBoxscorePlayer {
  externalId: string;
  nameZh: string;
  nameEn: string | null;
  jerseyNumber: string | null;
  position: string | null;
  photoUrl: string | null;
  teamExtId: string;
  isStart: boolean;
  minutes: string;
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
  offReb: number;
  defReb: number;
  plusMinus: number;
  fouls: number;
}

export interface GameBoxscoreData {
  game: {
    gameId: string;
    date: string | null;
    homeScore: number;
    awayScore: number;
    homeQ1: number | null; homeQ2: number | null; homeQ3: number | null; homeQ4: number | null;
    awayQ1: number | null; awayQ2: number | null; awayQ3: number | null; awayQ4: number | null;
    home: { nameZh: string; nameEn: string | null; logo: string | null; extId: string };
    away: { nameZh: string; nameEn: string | null; logo: string | null; extId: string };
  };
  players: GameBoxscorePlayer[];
}

export function useGameBoxscore(gameId: string | number | null | undefined) {
  return useQuery({
    queryKey: ["stats-game-boxscore", String(gameId ?? "")],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/stats/game/${gameId}/boxscore`);
      return r.json() as Promise<GameBoxscoreData>;
    },
    enabled: Boolean(gameId),
    staleTime: 1000 * 60 * 60,
    retry: 0,
  });
}

export interface PaceSegmentBucket {
  poss: number;
  pts: number;
  pct: number;
  ppp: number | null;
  avgDur: number | null;
}

export interface PaceSegments {
  insufficient_data: boolean;
  possessions: number;
  min_required?: number;
  avg_possession_time?: number;
  transition?: PaceSegmentBucket;
  early?: PaceSegmentBucket;
  halfcourt?: PaceSegmentBucket;
  totalPoss?: number;
  lg?: {
    transition: PaceSegmentBucket;
    early: PaceSegmentBucket;
    halfcourt: PaceSegmentBucket;
    totalPoss: number;
    avg_possession_time: number;
  };
}

export function usePaceSegments(externalId: string | null | undefined, seasonId?: number) {
  return useQuery({
    queryKey: ["stats-pace-segments", externalId, seasonId ?? 2092],
    queryFn: async () => {
      const r = await apiRequest(
        "GET",
        `/api/stats/team/${externalId}/pace-segments?seasonId=${seasonId ?? 2092}`,
      );
      return r.json() as Promise<PaceSegments>;
    },
    enabled: Boolean(externalId),
    staleTime: 1000 * 60 * 30,
    retry: 0,
  });
}

export interface LineupRow {
  lineupId: string;
  playerIds: string[];
  playerNames: string[];
  playerNamesZh: string[];
  playerNamesEn: string[];
  gamesPlayed: number;
  offPossessions: number;
  defPossessions: number;
  offPpp: number | null;
  defPpp: number | null;
  netPpp: number | null;
  ortg: number | null;
  drtg: number | null;
  netRtg: number | null;
  plusMinus: number | null;   // off_pts - def_pts (bruto, sin normalizar)
  minutesPlayed: number | null;
  tov: number;
  offReb: number;
  defReb: number;
  stl: number;
  offFg3m: number;
  offFga: number;
  offFta: number;
  tovPct: number | null;
}

export interface OnOffRow {
  playerId: string;
  playerName: string;
  onOffPpp: number | null;
  offOffPpp: number | null;
  impact: number | null;
  possessionsOn: number;
  possessionsOff: number;
}

type LineupApiRow = {
  lineupId?: string;
  playerIds?: string[];
  playerNames?: string[];
  playerNamesZh?: string[];
  playerNamesEn?: string[];
  gamesPlayed?: number;
  offPossessions?: number;
  defPossessions?: number;
  offPpp?: number | null;
  defPpp?: number | null;
  netPpp?: number | null;
  ortg?: number | null;
  drtg?: number | null;
  netRtg?: number | null;
  offPts?: number;
  defPts?: number;
  minutesPlayed?: number | null;
  tov?: number;
  offReb?: number;
  defReb?: number;
  stl?: number;
  offFg3m?: number;
  offFga?: number;
  offFta?: number;
  tovPct?: number | null;
};

function normalizeLineupRow(row: LineupApiRow): LineupRow {
  const offPoss = Number(row.offPossessions ?? 0);
  const defPoss = Number(row.defPossessions ?? 0);
  const offPts  = Number(row.offPts ?? 0);
  const defPts  = Number(row.defPts ?? 0);
  return {
    lineupId:       row.lineupId ?? '',
    playerIds:      row.playerIds ?? [],
    playerNames:    row.playerNames ?? [],
    playerNamesZh:  row.playerNamesZh ?? row.playerNames ?? [],
    playerNamesEn:  row.playerNamesEn ?? row.playerNames ?? [],
    gamesPlayed:    Number(row.gamesPlayed ?? 0),
    offPossessions: offPoss,
    defPossessions: defPoss,
    offPpp:  row.offPpp  != null ? Number(row.offPpp)  : offPoss > 0 ? offPts / offPoss : null,
    defPpp:  row.defPpp  != null ? Number(row.defPpp)  : defPoss > 0 ? defPts / defPoss : null,
    netPpp:  row.netPpp  != null ? Number(row.netPpp)  : (offPoss > 0 && defPoss > 0) ? (offPts/offPoss - defPts/defPoss) : null,
    ortg:    row.ortg    != null ? Number(row.ortg)    : offPoss > 0 ? Math.round(offPts / offPoss * 1000) / 10 : null,
    drtg:    row.drtg    != null ? Number(row.drtg)    : defPoss > 0 ? Math.round(defPts / defPoss * 1000) / 10 : null,
    netRtg:  row.netRtg  != null ? Number(row.netRtg)  : null,
    plusMinus: (offPts || defPts) ? offPts - defPts : null,
    minutesPlayed: row.minutesPlayed != null ? Number(row.minutesPlayed) : null,
    tov:     Number(row.tov    ?? 0),
    offReb:  Number(row.offReb ?? 0),
    defReb:  Number(row.defReb ?? 0),
    stl:     Number(row.stl    ?? 0),
    offFg3m: row.offFg3m ?? 0,
    offFga:  row.offFga ?? 0,
    offFta:  row.offFta ?? 0,
    tovPct:  row.tovPct ?? null,
  };
}
function netPppFromSplit(split: {
  netRtg?: number | null;
  offPts?: number;
  defPts?: number;
  offPossessions?: number;
  defPossessions?: number;
}): number | null {
  if (split.netRtg != null) return Math.round((Number(split.netRtg) / 100) * 1000) / 1000;
  const offPoss = Number(split.offPossessions ?? 0);
  const defPoss = Number(split.defPossessions ?? 0);
  if (offPoss <= 0 || defPoss <= 0) return null;
  return (
    Math.round(
      (Number(split.offPts ?? 0) / offPoss - Number(split.defPts ?? 0) / defPoss) * 1000,
    ) / 1000
  );
}

export function useTeamLineups(teamExternalId: string | null | undefined, seasonId?: number) {
  return useQuery({
    queryKey: ["stats-team-lineups", teamExternalId, seasonId ?? 2092],
    queryFn: async () => {
      const r = await apiRequest(
        "GET",
        `/api/stats/team/${teamExternalId}/lineups?seasonId=${seasonId ?? 2092}`,
      );
      const raw = await r.json();
      const arr: LineupApiRow[] = Array.isArray(raw)
        ? raw
        : ((raw as { lineups?: LineupApiRow[] }).lineups ?? []);
      return { lineups: arr.map(normalizeLineupRow) };
    },
    enabled: Boolean(teamExternalId),
    staleTime: 1000 * 60 * 30,
    retry: 0,
  });
}

export function usePlayerOnOff(
  teamExternalId: string | null | undefined,
  playerId: string | null | undefined,
  seasonId?: number,
) {
  return useQuery({
    queryKey: ["stats-player-on-off", teamExternalId, playerId, seasonId ?? 2092],
    queryFn: async () => {
      const r = await apiRequest(
        "GET",
        `/api/stats/team/${teamExternalId}/on-off/${playerId}?seasonId=${seasonId ?? 2092}`,
      );
      const raw = (await r.json()) as {
        playerExternalId?: string;
        on?: {
          offPossessions?: number;
          defPossessions?: number;
          offPts?: number;
          defPts?: number;
          netRtg?: number | null;
        };
        off?: {
          offPossessions?: number;
          defPossessions?: number;
          offPts?: number;
          defPts?: number;
          netRtg?: number | null;
        };
        netRtgDiff?: number | null;
      };
      const onSplit = raw.on ?? {};
      const offSplit = raw.off ?? {};
      const onOffPpp = netPppFromSplit(onSplit);
      const offOffPpp = netPppFromSplit(offSplit);
      const onOff: OnOffRow = {
        playerId: String(raw.playerExternalId ?? playerId ?? ""),
        playerName: "",
        onOffPpp,
        offOffPpp,
        impact:
          raw.netRtgDiff != null
            ? Math.round((Number(raw.netRtgDiff) / 100) * 1000) / 1000
            : onOffPpp != null && offOffPpp != null
              ? Math.round((onOffPpp - offOffPpp) * 1000) / 1000
              : null,
        possessionsOn:
          Number(onSplit.offPossessions ?? 0) + Number(onSplit.defPossessions ?? 0),
        possessionsOff:
          Number(offSplit.offPossessions ?? 0) + Number(offSplit.defPossessions ?? 0),
      };
      return { onOff };
    },
    enabled: Boolean(teamExternalId && playerId),
    staleTime: 1000 * 60 * 30,
    retry: 0,
  });
}

export interface CombinedLineupsResult {
  playerIds: string[];
  teamId: number;
  seasonId: number;
  lineupsFound: number;
  offPossessions: number;
  defPossessions: number;
  ortg: number | null;
  drtg: number | null;
  netRtg: number | null;
  offPpp: number | null;
  defPpp: number | null;
}

export function usePlayersCombinedLineups(
  teamExternalId: string | null | undefined,
  playerIds: string[] | null | undefined,
  seasonId?: number,
) {
  return useQuery({
    queryKey: ["stats-players-combined", teamExternalId, playerIds?.join(","), seasonId ?? 2092],
    queryFn: async () => {
      const qs = new URLSearchParams({
        teamId: String(teamExternalId),
        seasonId: String(seasonId ?? 2092),
        playerIds: playerIds!.join(","),
      });
      const r = await apiRequest("GET", `/api/stats/players/combined?${qs.toString()}`);
      return r.json() as Promise<CombinedLineupsResult>;
    },
    enabled: Boolean(teamExternalId && playerIds && playerIds.length >= 2),
    staleTime: 1000 * 60 * 30,
    retry: 0,
  });
}
