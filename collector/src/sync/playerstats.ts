import { wcbaClient } from '../client';
import { config } from '../config';
import { ingest } from '../ingest';
import { logger } from '../logger';

export async function syncPlayerStats(phaseId: number, roundEnd: number): Promise<void> {
  const { competitionId, seasonId } = config.wcba;
  const all: unknown[] = [];
  let page = 1;
  while (true) {
    const res = await wcbaClient.get('/datahub/cbamatch/dc/playerbasicpage', {
      params: { competitionId, seasonId, phaseId, teamId: 0, roundSta: 1, roundEnd, countType: 1, page, size: 50, sort: 'pts' },
    });
    const rows: any[] = res.data?.data?.list ?? res.data?.data ?? [];
    if (rows.length === 0) break;
    for (const r of rows) {
      all.push({
        playerId: Number(r.playerId ?? r.userId), playerName: r.playerName ?? r.name ?? '',
        teamId: Number(r.teamId), teamName: r.teamName ?? '', isForeign: Boolean(r.isForeign ?? false),
        jersey: r.jerseyNumber ? Number(r.jerseyNumber) : null, position: r.position ?? null,
        games: Number(r.gp ?? 0), minutes: Number(r.min ?? 0),
        pts: Number(r.pts ?? 0), reb: Number(r.reb ?? 0), ast: Number(r.ast ?? 0),
        stl: Number(r.stl ?? 0), blk: Number(r.blk ?? 0), tov: Number(r.tov ?? r.to ?? 0),
        fgm: Number(r.fgm ?? 0), fga: Number(r.fga ?? 0),
        tpm: Number(r.tpm ?? r.fg3m ?? 0), tpa: Number(r.tpa ?? r.fg3a ?? 0),
        ftm: Number(r.ftm ?? 0), fta: Number(r.fta ?? 0), eff: Number(r.eff ?? 0),
        fgPct: r.fgPct != null ? Number(r.fgPct) : null,
        tpPct: r.tpPct != null ? Number(r.tpPct) : null,
        ftPct: r.ftPct != null ? Number(r.ftPct) : null,
        phaseId, seasonId,
      });
    }
    logger.info('Player stats page', { page, rows: rows.length });
    if (rows.length < 50) break;
    page++;
  }
  if (all.length === 0) { logger.warn('Player stats: no data', { phaseId }); return; }
  await ingest({ type: 'player_stats', seasonId, competitionId, data: all });
  logger.info('Player stats synced', { count: all.length, phaseId });
}
