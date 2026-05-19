import { wcbaClient } from '../client';
import { config } from '../config';
import { fetchSyncStatus, ingest } from '../ingest';
import { logger } from '../logger';

export async function syncBoxscore(gameId: number, matchId: number): Promise<void> {
  const res = await wcbaClient.get('/datahub/cbamatch/games/matchinfoscores', { params: { matchId, gameId } });
  const d = res.data?.data ?? res.data;
  if (!d) { logger.warn('Boxscore: empty', { gameId }); return; }

  const homeScore = Number(d.home?.teamScore ?? d.homeScore ?? d.homeTeamScore ?? 0);
  const awayScore = Number(d.away?.teamScore ?? d.awayScore ?? d.guestTeamScore ?? 0);

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

// Parse "made-attempted (pct%)" → [made, attempted]
// e.g. "6-17 (35.3%)" → [6, 17]
function parseShotStr(s: string | null | undefined): [number, number] {
  if (!s) return [0, 0];
  const m = String(s).match(/^(\d+)-(\d+)/);
  if (!m) return [0, 0];
  return [Number(m[1]), Number(m[2])];
}

export async function syncPlayerBoxscore(gameId: number): Promise<void> {
  const res = await wcbaClient.get('/datahub/cbamatch/games/player/playerdata', { params: { gameId } });
  const d = res.data?.data ?? res.data;
  if (!d) { logger.warn('PlayerBoxscore: empty', { gameId }); return; }

  // API real field names (confirmed from live response):
  // points, assists, steals, blocks, turnover, rebound, offensiveRebound, defensiveRebound
  // shot / twoPoints / threePoints / foulShot → "made-attempted (pct%)" strings
  // shotOn / twoPointsOn / threePointsOn / foulShotOn → made count as string
  const mapPlayers = (players: any[], teamType: 'Home' | 'Away', teamExternalId: string) =>
    (Array.isArray(players) ? players : []).map((p: any) => {
      const [fgm, fga] = parseShotStr(p.shot ?? p.twoPoints);
      const [tpm, tpa] = parseShotStr(p.threePoints);
      const [ftm, fta] = parseShotStr(p.foulShot);
      return {
        gameId,
        playerExternalId: String(p.playerId ?? p.userId ?? p.playerid ?? ''),
        teamExternalId,
        teamType,
        isStartLineUp:    Boolean(p.isStartLineUp ?? false),
        minutes:          String(p.minutes ?? p.playTime ?? p.playtime ?? '00:00'),
        pts:              Number(p.points ?? p.pts ?? p.score ?? p.point ?? 0),
        offReb:           Number(p.offensiveRebound ?? p.offReb ?? 0),
        defReb:           Number(p.defensiveRebound ?? p.defReb ?? 0),
        reb:              Number(p.rebound ?? p.totalReb ?? p.reb ?? 0),
        ast:              Number(p.assists ?? p.ast ?? 0),
        stl:              Number(p.steals ?? p.stl ?? 0),
        blk:              Number(p.blocks ?? p.blk ?? 0),
        tov:              Number(p.turnover ?? p.tov ?? p.to ?? 0),
        fouls:            Number(p.fouls ?? p.pf ?? 0),
        fgm,
        fga,
        tpm,
        tpa,
        ftm,
        fta,
        plusMinus:        Number(p.positiveNegativeValue ?? p.plusMinus ?? 0),
      };
    });

  const homeTeam = Array.isArray(d)
    ? d.find((t: any) => t.teamType === 'Home')
    : (d.home ?? null);
  const awayTeam = Array.isArray(d)
    ? d.find((t: any) => t.teamType === 'Away')
    : (d.away ?? null);
  const homeTeamExtId = String(homeTeam?.teamId ?? homeTeam?.id ?? '');
  const awayTeamExtId = String(awayTeam?.teamId ?? awayTeam?.id ?? '');
  const homePlayers = mapPlayers(
    homeTeam?.teamPlayerData ?? homeTeam?.players ?? [],
    'Home',
    homeTeamExtId
  );
  const awayPlayers = mapPlayers(
    awayTeam?.teamPlayerData ?? awayTeam?.players ?? [],
    'Away',
    awayTeamExtId
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
  const { boxDone } = await fetchSyncStatus();
  const boxDoneSet = new Set(boxDone);
  const pending = gameIds.filter(id => !boxDoneSet.has(id));
  logger.info('Syncing player boxscores', { total: gameIds.length, pending: pending.length, skipped: gameIds.length - pending.length });
  if (pending.length === 0) { logger.info('Player boxscores: all up to date'); return; }
  let synced = 0;
  for (const id of pending) {
    try { await syncPlayerBoxscore(id); synced++; }
    catch (err: any) { logger.error('PlayerBoxscore failed', { gameId: id, error: err.message }); }
  }
  logger.info('Player boxscores done', { synced, total: pending.length });
}
