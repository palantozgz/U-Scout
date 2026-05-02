import { wcbaClient } from '../client';
import { config } from '../config';
import { logger } from '../logger';

export interface WCBAPhase {
  phaseId: number;
  phaseName: string;
  rounds: number[];
}

export interface WCBAMenuData {
  phases: WCBAPhase[];
  maxRound: number;
  teams: Array<{ teamId: number; teamName: string }>;
}

export async function fetchPhases(): Promise<WCBAMenuData> {
  const { competitionId, seasonId } = config.wcba;

  // Step 1: get phases list from phasemenus
  const menuRes = await wcbaClient.get('/datahub/cbamatch/games/phasemenus', {
    params: { seasonId },
  });
  const phases: any[] = menuRes.data?.data ?? [];

  const result: WCBAPhase[] = [];
  let maxRound = 1;

  // Step 2: for each phase, get its rounds from matchmenusschedule
  for (const phase of phases) {
    const phaseId = Number(phase.phaseId);
    try {
      const schedRes = await wcbaClient.get('/datahub/cbamatch/games/matchmenusschedule', {
        params: { competitionId, seasonId, phaseId },
      });
      const rounds: any[] = schedRes.data?.data?.rounds ?? schedRes.data?.data ?? [];
      const roundIds = rounds.map((r: any) => Number(r.roundId)).filter(Boolean);
      const phaseMax = roundIds.length > 0 ? Math.max(...roundIds) : 1;
      if (phaseMax > maxRound) maxRound = phaseMax;

      result.push({
        phaseId,
        phaseName: phase.phaseName ?? String(phaseId),
        rounds: roundIds,
      });

      logger.info('Phase rounds fetched', { phaseId, rounds: roundIds.length });
    } catch (err: any) {
      logger.warn('Phase rounds failed', { phaseId, error: err.message });
    }
  }

  // Fallback: if phasemenus returns nothing, use lastlymatch to get current phase
  if (result.length === 0) {
    const lastRes = await wcbaClient.get('/datahub/cbamatch/games/lastlymatch', {
      params: { competitionId, seasonId },
    });
    const currentPhaseId = Number(lastRes.data?.data?.currentPhaseId ?? 0);
    const currentRoundId = Number(lastRes.data?.data?.currentRoundId ?? 1);
    if (currentPhaseId) {
      const rounds = Array.from({ length: currentRoundId }, (_, i) => i + 1);
      result.push({ phaseId: currentPhaseId, phaseName: 'Current', rounds });
      maxRound = currentRoundId;
      logger.info('Phases fallback via lastlymatch', { phaseId: currentPhaseId, maxRound });
    }
  }

  logger.info('Phases fetched', { phases: result.length, maxRound });
  return { phases: result, maxRound, teams: [] };
}
