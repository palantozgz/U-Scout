import { wcbaClient } from '../client';
import { config } from '../config';
import { ingest } from '../ingest';
import { logger } from '../logger';
import { fetchPhases } from './phases';

export interface WCBAGame {
  gameId: number; matchId: number;
  roundId: number;
  homeTeamId: number; homeTeamName: string;
  awayTeamId: number; awayTeamName: string;
  scheduledAt: string | null; status: number;
}

export async function syncSchedule(): Promise<WCBAGame[]> {
  const { competitionId, seasonId } = config.wcba;
  const { phases, maxRound } = await fetchPhases();
  const all: WCBAGame[] = [];

  // Try each roundId individually — API returns 500 for rounds with no games
  const { rounds } = phases[0];
  for (const roundId of rounds) {
    try {
      const res = await wcbaClient.get('/datahub/cbamatch/games/matchschedules', {
        params: { competitionId, seasonId, roundId },
      });
      const rows: any[] = res.data?.data ?? [];
      for (const r of rows) {
        all.push({
          gameId:       Number(r.gameId),
          matchId:      Number(r.matchId ?? r.id ?? 0),
          roundId,
          homeTeamId:   Number(r.homeTeamId),
          homeTeamName: r.homeTeamName ?? '',
          awayTeamId:   Number(r.awayTeamId ?? r.guestTeamId ?? 0),
          awayTeamName: r.awayTeamName ?? r.guestTeamName ?? '',
          scheduledAt:  r.gameTime ?? r.scheduledAt ?? null,
          status:       Number(r.gameStatus ?? r.status ?? 0),
        });
      }
      if (rows.length > 0) {
        logger.info('Schedule round fetched', { roundId, games: rows.length });
      }
    } catch (err: any) {
      // 500 = round has no games yet — skip silently
      if (err.response?.status === 500) continue;
      logger.warn('Schedule round failed', { roundId, error: err.message });
    }
  }

  logger.info('Schedule complete', { totalGames: all.length, maxRound });

  if (all.length > 0) {
    await ingest({ type: 'schedule', seasonId, competitionId, data: all });
  }
  return all;
}

export async function checkActiveGame(): Promise<{ gameId: number } | null> {
  try {
    const res = await wcbaClient.get('/datahub/cbamatch/games/lastlymatch', {
      params: { competitionId: config.wcba.competitionId, seasonId: config.wcba.seasonId },
    });
    const g = res.data?.data;
    if (!g?.gameId) return null;
    const status = Number(g.gameStatus ?? 0);
    if (status === 2 || status === 3) return { gameId: Number(g.gameId) };
  } catch { /* no active game */ }
  return null;
}
