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
  const res = await wcbaClient.get('/datahub/cbamatch/games/matchmenus', {
    params: { competitionId, seasonId },
  });

  const data = res.data?.data ?? {};

  // API returns a flat rounds array with no phaseId — treat as single phase
  const rounds: any[] = Array.isArray(data.rounds) ? data.rounds : [];
  const teams: any[] = Array.isArray(data.teams) ? data.teams : [];

  // Deduplicate roundIds (API returns duplicates for regular + playoff)
  const uniqueRoundIds = Array.from(new Set(rounds.map((r: any) => Number(r.roundId))));
  const maxRound = uniqueRoundIds.length > 0 ? Math.max(...uniqueRoundIds) : 1;

  // Single phase covering all rounds
  const phases: WCBAPhase[] = [{
    phaseId: 1,
    phaseName: 'Regular Season',
    rounds: uniqueRoundIds,
  }];

  logger.info('Phases fetched', {
    rounds: uniqueRoundIds.length,
    maxRound,
    teams: teams.length,
  });

  return { phases, maxRound, teams };
}
