import { wcbaClient } from '../client';
import { config } from '../config';
import { ingest } from '../ingest';
import { logger } from '../logger';
import { fetchPhases } from './phases';

export interface WCBAGame {
  gameId: number; matchId: number;
  phaseId: number; phaseIdNew: number; phaseName: string;
  roundId: number;
  homeTeamId: number; homeTeamName: string; homeLogo: string;
  awayTeamId: number; awayTeamName: string; awayLogo: string;
  homeScore: number | null; awayScore: number | null;
  scheduledAt: string | null; gameDate: string | null;
  status: number; fieldOrder: number;
  seasonId: number;
}

const CHUNK_SIZE = 50;

async function ingestChunked(type: string, seasonId: number, competitionId: number, rows: any[]): Promise<void> {
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    await ingest({ type: type as any, seasonId, competitionId, data: chunk });
  }
}

export async function syncSchedule(): Promise<WCBAGame[]> {
  const { competitionId, seasonId } = config.wcba;
  const { phases } = await fetchPhases();
  const all: WCBAGame[] = [];

  for (const phase of phases) {
    for (const roundId of phase.rounds) {
      try {
        const res = await wcbaClient.get('/datahub/cbamatch/games/matchschedules', {
          params: {
            competitionId,
            seasonId,
            phaseId: phase.phaseId,
            roundId,
            teamId: '',
          },
        });

        const dates: any[] = res.data?.data ?? [];
        for (const dateGroup of dates) {
          const games: any[] = dateGroup.games ?? [];
          for (const g of games) {
            all.push({
              gameId:       Number(g.gameId),
              matchId:      Number(g.matchId ?? 0),
              phaseId:      phase.phaseId,
              phaseIdNew:   Number(g.phaseIdNew ?? phase.phaseId),
              phaseName:    g.phaseNameNew ?? phase.phaseName,
              roundId,
              homeTeamId:   Number(g.homeId ?? 0),
              homeTeamName: g.homeName ?? '',
              homeLogo:     g.homeLogo ?? '',
              awayTeamId:   Number(g.awayId ?? 0),
              awayTeamName: g.awayName ?? '',
              awayLogo:     g.awayLogo ?? '',
              homeScore:    g.homeScore != null ? Number(g.homeScore) : null,
              awayScore:    g.awayScore != null ? Number(g.awayScore) : null,
              scheduledAt:  g.gameTime ? `${g.gameDate}T${g.gameTime}` : null,
              gameDate:     g.gameDate ?? null,
              status:       Number(g.gameStatus ?? 0),
              fieldOrder:   Number(g.fieldOrder ?? 0),
              seasonId,
            });
          }
        }

        if (dates.length > 0) {
          const gamesInRound = dates.reduce((s: number, d: any) => s + (d.games?.length ?? 0), 0);
          if (gamesInRound > 0) {
            logger.info('Round fetched', { phaseId: phase.phaseId, roundId, games: gamesInRound });
          }
        }
      } catch (err: any) {
        if (err.response?.status === 500) continue;
        logger.warn('Round failed', { phaseId: phase.phaseId, roundId, error: err.message });
      }
    }
  }

  logger.info('Schedule complete', { totalGames: all.length });
  if (all.length > 0) {
    await ingestChunked('schedule', seasonId, competitionId, all);
  }
  return all;
}

export async function checkActiveGame(): Promise<{ gameId: number } | null> {
  try {
    const res = await wcbaClient.get('/datahub/cbamatch/games/lastlymatchschedule', {
      params: { competitionId: config.wcba.competitionId, seasonId: config.wcba.seasonId },
    });
    const g = res.data?.data;
    if (!g?.gameId) return null;
    const status = Number(g.gameStatus ?? 0);
    if (status === 2 || status === 3) return { gameId: Number(g.gameId) };
  } catch { /* no active game */ }
  return null;
}
