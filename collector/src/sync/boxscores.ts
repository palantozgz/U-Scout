import { wcbaClient } from '../client';
import { config } from '../config';
import { ingest } from '../ingest';
import { logger } from '../logger';

export async function syncBoxscore(gameId: number, matchId: number): Promise<void> {
  const res = await wcbaClient.get('/datahub/cbamatch/games/matchinfoscores', { params: { matchId, gameId } });
  const d = res.data?.data ?? res.data;
  if (!d) { logger.warn('Boxscore: empty', { gameId }); return; }
  await ingest({ type: 'boxscores', seasonId: config.wcba.seasonId, competitionId: config.wcba.competitionId, data: [{
    gameId, matchId,
    homeScore: Number(d.homeScore ?? d.homeTeamScore ?? 0), awayScore: Number(d.awayScore ?? d.guestTeamScore ?? 0),
    homeQ1: Number(d.homeQ1 ?? 0), homeQ2: Number(d.homeQ2 ?? 0), homeQ3: Number(d.homeQ3 ?? 0), homeQ4: Number(d.homeQ4 ?? 0),
    awayQ1: Number(d.awayQ1 ?? 0), awayQ2: Number(d.awayQ2 ?? 0), awayQ3: Number(d.awayQ3 ?? 0), awayQ4: Number(d.awayQ4 ?? 0),
    status: Number(d.gameStatus ?? 4),
  }]});
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
