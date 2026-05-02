import { wcbaClient } from '../client';
import { config } from '../config';
import { logger } from '../logger';

export interface WCBAPhase { phaseId: number; phaseName: string; rounds: number[]; }

export async function fetchPhases(): Promise<WCBAPhase[]> {
  const { competitionId, seasonId } = config.wcba;
  const res = await wcbaClient.get('/datahub/cbamatch/games/matchmenus', { params: { competitionId, seasonId } });
  const rounds: any[] = res.data?.data?.rounds ?? [];
  const map = new Map<number, WCBAPhase>();
  for (const r of rounds) {
    if (!map.has(r.phaseId)) map.set(r.phaseId, { phaseId: r.phaseId, phaseName: r.phaseName, rounds: [] });
    map.get(r.phaseId)!.rounds.push(r.roundId);
  }
  logger.info('Phases fetched', { phases: map.size });
  return Array.from(map.values());
}
