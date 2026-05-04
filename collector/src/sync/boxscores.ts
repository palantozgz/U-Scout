import { wcbaClient } from '../client';
import { config } from '../config';
import { ingest } from '../ingest';
import { logger } from '../logger';

export async function syncBoxscore(gameId: number, matchId: number): Promise<void> {
  const res = await wcbaClient.get('/datahub/cbamatch/games/matchinfoscores', { params: { matchId, gameId } });
  const d = res.data?.data ?? res.data;
  if (!d) { logger.warn('Boxscore: empty', { gameId }); return; }

  // API returns scores nested under home/away objects
  const homeScore = Number(d.home?.teamScore ?? d.homeScore ?? d.homeTeamScore ?? 0);
  const awayScore = Number(d.away?.teamScore ?? d.awayScore ?? d.guestTeamScore ?? 0);

  // Quarter scores: "17;12;28;11" format under home.periodScores
  const homeQs = String(d.home?.periodScores ?? '').split(';').map(Number);
  const awayQs = String(d.away?.periodScores ?? '').split(';').map(Number);

  await ingest({
    type: 'boxscores',
    seasonId: config.wcba.seasonId,
    competitionId: config.wcba.competitionId,
    data: [{
      gameId, matchId,
      homeScore, awayScore,
      homeQ1: homeQs[0] ?? 0, homeQ2: homeQs[1] ?? 0,
      homeQ3: homeQs[2] ?? 0, homeQ4: homeQs[3] ?? 0,
      awayQ1: awayQs[0] ?? 0, awayQ2: awayQs[1] ?? 0,
      awayQ3: awayQs[2] ?? 0, awayQ4: awayQs[3] ?? 0,
      status: Number(d.gameStatus ?? d.home?.gameStatus ?? 4),
    }],
  });
}

export async function syncNewBoxscores(gameIds: number[], matchIds: Map<number, number>): Promise<void> {
  logger.info('Syncing boxscores', { count: gameIds.length });
  let synced = 0;
  for (const id of gameIds) {
    try { await syncBoxscore(id, matchIds.get(id) ?? 0); synced++; }
    catch (err: any) { logger.error('Boxscore failed', { gameId: id, error: err.message }); }
  }
  logger.info('Boxscores done', { synced, total: gameIds.length });
}

export async function syncPlayerBoxscore(gameId: number): Promise<void> {
  const res = await wcbaClient.get('/datahub/cbamatch/games/player/playerdata', { params: { gameId } });
  const d = res.data?.data ?? res.data;
  if (!d) { logger.warn('PlayerBoxscore: empty', { gameId }); return; }

  // API returns { home: { players: [...] }, away: { players: [...] } }
  const mapPlayers = (players: any[], teamType: 'Home' | 'Away') =>
    (Array.isArray(players) ? players : []).map((p: any) => ({
      gameId,
      playerExternalId: String(p.playerId ?? p.userId ?? p.playerid ?? ''),
      teamExternalId:   String(p.teamId ?? ''),
      teamType,
      isStartLineUp:    Boolean(p.isStartLineUp ?? false),
      minutes:          String(p.minutes ?? p.playTime ?? p.playtime ?? '00:00'),
      pts:              Number(p.pts ?? p.score ?? p.point ?? 0),
      offReb:           Number(p.offensiveRebound ?? p.offReb ?? 0),
      defReb:           Number(p.defensiveRebound ?? p.defReb ?? 0),
      reb:              Number(p.totalReb ?? p.reb ?? p.rebound ?? 0),
      ast:              Number(p.ast ?? 0),
      stl:              Number(p.stl ?? 0),
      blk:              Number(p.blk ?? 0),
      tov:              Number(p.tov ?? p.to ?? 0),
      fouls:            Number(p.fouls ?? p.pf ?? 0),
      fgm:              Number(p.fgm ?? 0),
      fga:              Number(p.fga ?? 0),
      tpm:              Number(p.tpm ?? p.fg3m ?? 0),
      tpa:              Number(p.tpa ?? p.fg3a ?? 0),
      ftm:              Number(p.ftm ?? 0),
      fta:              Number(p.fta ?? 0),
      plusMinus:        Number(p.positiveNegativeValue ?? p.plusMinus ?? 0),
    }));

  // API returns an array: [{ teamType: 'Home', teamPlayerData: [...] }, { teamType: 'Away', ... }]
  const homeTeam = Array.isArray(d)
    ? d.find((t: any) => t.teamType === 'Home')
    : (d.home ?? null);
  const awayTeam = Array.isArray(d)
    ? d.find((t: any) => t.teamType === 'Away')
    : (d.away ?? null);
  const homePlayers = mapPlayers(
    homeTeam?.teamPlayerData ?? homeTeam?.players ?? [],
    'Home'
  );
  const awayPlayers = mapPlayers(
    awayTeam?.teamPlayerData ?? awayTeam?.players ?? [],
    'Away'
  );
  const allPlayers = [...homePlayers, ...awayPlayers];

  if (allPlayers.length === 0) { logger.warn('PlayerBoxscore: no players', { gameId }); return; }

  await ingest({
    type: 'player_boxscores',
    seasonId: config.wcba.seasonId,
    competitionId: config.wcba.competitionId,
    data: allPlayers,
  });
  logger.info('PlayerBoxscore synced', { gameId, players: allPlayers.length });
}

export async function syncNewPlayerBoxscores(gameIds: number[]): Promise<void> {
  logger.info('Syncing player boxscores', { count: gameIds.length });
  let synced = 0;
  for (const id of gameIds) {
    try { await syncPlayerBoxscore(id); synced++; }
    catch (err: any) { logger.error('PlayerBoxscore failed', { gameId: id, error: err.message }); }
  }
  logger.info('Player boxscores done', { synced, total: gameIds.length });
}
