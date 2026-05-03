import { wcbaClient } from '../client';
import { config } from '../config';
import { ingest } from '../ingest';
import { logger } from '../logger';

export interface RosterPlayer {
  playerId: string;
  playerName: string;
  playerNameEn: string | null;
  photoUrl: string | null;
  teamId: string;
  position: string | null;
  jerseyNumber: string | null;
  heightCm: number | null;
  weightKg: number | null;
  birthday: string | null;
  veteranYears: number | null;
  country: string | null;
  ethnicity: string | null;
  isForeign: boolean;
}

export interface TeamRoster {
  teamId: number;
  teamName: string;
  seasonId: number;
  players: RosterPlayer[];
}

async function fetchTeamIds(seasonId: number, competitionId: number): Promise<Array<{ teamId: number; teamName: string }>> {
  const res = await wcbaClient.get('/datahub/cbamatch/rank/matchoutrank', {
    params: { competitionId, seasonId },
  });
  const rows: any[] = res.data?.data ?? [];
  return rows.filter(r => r.teamId).map(r => ({ teamId: Number(r.teamId), teamName: r.teamName ?? '' }));
}

async function fetchTeamRoster(seasonId: number, teamId: number): Promise<RosterPlayer[]> {
  const res = await wcbaClient.get('/datahub/cbamatch/team/teamplayers', {
    params: { seasonId, teamId },
  });

  const raw: any[] = res.data?.players ?? res.data?.data?.players ?? res.data?.data ?? [];
  if (!Array.isArray(raw) || raw.length === 0) {
    logger.warn('Roster: empty', { teamId, seasonId });
    return [];
  }

  return raw.map((p: any): RosterPlayer => ({
    playerId:     String(p.playerId),
    playerName:   p.playerName ?? '',
    playerNameEn: p.playerNameEn?.trim() || null,
    photoUrl:     p.playerLogo ?? null,
    teamId:       String(p.teamId ?? teamId),
    position:     p.position ?? null,
    jerseyNumber: p.number != null ? String(p.number) : null,
    heightCm:     p.height != null ? Number(p.height) : null,
    weightKg:     p.weight != null ? Number(p.weight) : null,
    birthday:     p.birthday ?? null,
    veteranYears: p.veteran != null ? Number(p.veteran) : null,
    country:      p.countryName ?? null,
    ethnicity:    p.ethnicity ?? null,
    isForeign:    !!p.countryName && p.countryName !== '中国' && p.countryName !== '',
  }));
}

export async function syncRosters(seasonId?: number): Promise<void> {
  const { competitionId, seasonId: defaultSeasonId } = config.wcba;
  const targetSeason = seasonId ?? defaultSeasonId;

  logger.info('Roster sync start', { seasonId: targetSeason });

  const teams = await fetchTeamIds(targetSeason, competitionId);
  if (teams.length === 0) { logger.warn('Roster: no teams in standings'); return; }

  const allRosters: TeamRoster[] = [];

  for (const team of teams) {
    try {
      const players = await fetchTeamRoster(targetSeason, team.teamId);
      allRosters.push({ teamId: team.teamId, teamName: team.teamName, seasonId: targetSeason, players });
      logger.info('Roster fetched', { teamId: team.teamId, name: team.teamName, players: players.length });
    } catch (err: any) {
      logger.error('Roster fetch failed', { teamId: team.teamId, error: err.message });
    }
  }

  if (allRosters.length === 0) return;

  await ingest({ type: 'roster', seasonId: targetSeason, competitionId, data: allRosters });
  logger.info('Roster sync done', {
    teams: allRosters.length,
    players: allRosters.reduce((s, r) => s + r.players.length, 0),
  });
}
