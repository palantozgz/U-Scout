import { wcbaClient } from '../client';
import { config } from '../config';
import { ingest } from '../ingest';
import { logger } from '../logger';

export async function syncStandings(): Promise<void> {
  const { competitionId, seasonId } = config.wcba;
  const res = await wcbaClient.get('/datahub/cbamatch/rank/teamrankfirst', { params: { competitionId, seasonId } });
  const rows: any[] = res.data?.data ?? [];
  if (rows.length === 0) { logger.warn('Standings: empty'); return; }
  const standings = rows.map((r: any) => ({
    teamId:    Number(r.teamId), teamName: r.teamName ?? '', teamLogo: r.teamLogo ?? '',
    phaseId:   r.phaseId != null ? String(r.phaseId) : null, phaseName: r.phaseName ?? '',
    rank:      Number(r.rank ?? 0), wins: Number(r.wins ?? 0), losses: Number(r.loses ?? 0),
    winPct:    Number(r.wins ?? 0) / Math.max(Number(r.wins ?? 0) + Number(r.loses ?? 0), 1),
    ptsPerGame:       Number(r.pts ?? 0), ptsAgainstPerGame: Number(r.losePts ?? 0),
    goalDiff:  Number(r.goalDifference ?? 0), streak: Number(r.winLoss ?? 0),
    last10Wins: Math.round(Number(r.last10Win ?? 0)), last10Losses: Math.round(Number(r.last10Loses ?? 0)),
    homeWins:  Number(r.homeWin ?? 0), homeLosses: Number(r.homeLoses ?? 0),
    awayWins:  Number(r.awayWin ?? 0), awayLosses: Number(r.awayLoses ?? 0),
  }));
  await ingest({ type: 'standings', seasonId, competitionId, data: standings });
  logger.info('Standings synced', { count: standings.length });
}
