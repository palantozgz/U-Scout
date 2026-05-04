import { wcbaClient } from '../client';
import { config } from '../config';
import { ingest } from '../ingest';
import { logger } from '../logger';
import { classifyShots, type ShotPoint } from './shotZones';

// ─── Action code map (WCBA real codes) ───────────────────────────────────────
const ACTION_CODE_MAP: Record<string, string> = {
  // Substitutions
  SUBONC: 'sub_in',
  SUBOFF: 'sub_out',
  SUBIN:  'sub_in',    // legacy fallback
  SUBOUT: 'sub_out',   // legacy fallback

  // 2P shots
  '2PMJMP': 'shot_made',    // 2P made jump
  '2PMLAY': 'shot_made',    // 2P made layup
  '2PMDLA': 'shot_made',    // 2P made driving layup
  '2PMHOK': 'shot_made',    // 2P made hook
  '2PMTIP': 'shot_made',    // 2P made tip
  '2PMFLO': 'shot_made',    // 2P made floater
  '2PAJMP': 'shot_missed',  // 2P attempt jump
  '2PALAY': 'shot_missed',  // 2P attempt layup
  '2PADLA': 'shot_missed',  // 2P attempt driving layup
  '2PAHOK': 'shot_missed',  // 2P attempt hook
  '2PATIP': 'shot_missed',  // 2P attempt tip
  '2PAFLO': 'shot_missed',  // 2P attempt floater
  MADE2:    'shot_made',     // legacy fallback
  MISS2:    'shot_missed',   // legacy fallback

  // 3P shots
  '3PMJMP': 'shot_made_3',    // 3P made jump
  '3PMCOR': 'shot_made_3',    // 3P made corner
  '3PMSBK': 'shot_made_3',    // 3P made step-back
  '3PMFAD': 'shot_made_3',    // 3P made fadeaway
  '3PMPUL': 'shot_made_3',    // 3P made pull-up
  '3PAJMP': 'shot_missed_3',  // 3P attempt jump
  '3PACOR': 'shot_missed_3',  // 3P attempt corner
  '3PASBK': 'shot_missed_3',  // 3P attempt step-back
  '3PAFAD': 'shot_missed_3',  // 3P attempt fadeaway
  '3PAPUL': 'shot_missed_3',  // 3P attempt pull-up
  MADE3:    'shot_made_3',    // legacy fallback
  MISS3:    'shot_missed_3',  // legacy fallback

  // Free throws
  FTH11M:  'ft_made',    // FT 1of1 made
  FTH11A:  'ft_missed',  // FT 1of1 attempt
  FTH21M:  'ft_made',    // FT 1of2 made
  FTH21A:  'ft_missed',  // FT 1of2 attempt (missed)
  FTH22M:  'ft_made',    // FT 2of2 made
  FTH22A:  'ft_missed',  // FT 2of2 attempt (missed)
  FTH31M:  'ft_made',    // FT 1of3 made
  FTH31A:  'ft_missed',
  FTH32M:  'ft_made',    // FT 2of3 made
  FTH32A:  'ft_missed',
  FTH33M:  'ft_made',    // FT 3of3 made
  FTH33A:  'ft_missed',
  FT_MADE: 'ft_made',    // legacy fallback
  FT_MISS: 'ft_missed',  // legacy fallback

  // Rebounds
  REBDEF:  'rebound',   // defensive rebound
  REBOFN:  'rebound',   // offensive rebound
  REBOUND: 'rebound',   // legacy fallback

  // Assists, steals, blocks
  ASSIST:  'assist',
  STEBAL:  'steal',
  BLKBAL:  'block',
  STEAL:   'steal',   // legacy fallback
  BLOCK:   'block',   // legacy fallback

  // Fouls
  FOLDEF:  'foul',        // foul defense (committed)
  FOLOFF:  'foul',        // foul offense
  FDRAWN:  'foul_drawn',  // foul drawn
  FOUL:    'foul',        // legacy fallback

  // Turnovers
  TNOPAS:  'turnover',   // bad pass
  TNOBHD:  'turnover',   // bad handle
  TNOOFF:  'turnover',   // offensive foul turnover
  TNOSTL:  'turnover',   // stolen
  TOTLTO:  'turnover',   // team timeout? (check — could be team turnover)
  TURNOVER:'turnover',   // legacy fallback

  // Timeouts
  TMOLEG:  'timeout',   // legal timeout
  TMOILL:  'timeout',   // illegal timeout
  TIMEOUT: 'timeout',   // legacy fallback

  // Blocks
  BLKSHT:  'block',     // block shot

  // More 2P variants
  '2PMTLA': 'shot_made',    // 2P made turnaround layup
  '2PATLA': 'shot_missed',  // 2P attempt turnaround layup
  '2PMSBK': 'shot_made',    // 2P made step-back
  '2PASBK': 'shot_missed',  // 2P attempt step-back
  '2PMPUL': 'shot_made',    // 2P made pull-up
  '2PAPUL': 'shot_missed',  // 2P attempt pull-up
  '2PMTRN': 'shot_made',    // 2P made turnaround
  '2PATRN': 'shot_missed',  // 2P attempt turnaround
  '2PMFAD': 'shot_made',    // 2P made fadeaway
  '2PAFAD': 'shot_missed',  // 2P attempt fadeaway
  '2PMFLT': 'shot_made',    // 2P made flat
  '2PAFLT': 'shot_missed',  // 2P attempt flat

  // More turnovers
  TNODDR:  'turnover',  // double dribble
  TNOTRV:  'turnover',  // travelling
  TNO3SC:  'turnover',  // 3 second violation
  TNO24S:  'turnover',  // 24 second violation
  TNOBCT:  'turnover',  // backcourt
  TNOOTH:  'turnover',  // other turnover
  TNOOBD:  'turnover',  // out of bounds

  // More fouls
  FOLUSM:  'foul',      // unsportsmanlike
  FOLTEC:  'foul',      // technical foul
  FOLOFN:  'foul',      // offensive foul no turnover

  // Jump ball results
  JUBSUC:  'jumpball',  // jump ball success
  JUBFAL:  'jumpball',  // jump ball fail

  // Other
  JUMPBALL:  'jumpball',
  CHALLENGE: 'challenge',
  STRTPD:    'period_start',
  ENDPD:     'period_end',
};

// Shot codes for shot chart lookup (made + missed 2P and 3P)
const SHOT_CODES = new Set([
  '2PMJMP','2PMLAY','2PMDLA','2PMHOK','2PMTIP','2PMFLO',
  '2PMTLA','2PMSBK','2PMTRN','2PMFAD','2PMFLT',
  '2PAJMP','2PALAY','2PADLA','2PAHOK','2PATIP','2PAFLO',
  '2PATLA','2PASBK','2PATRN','2PAFAD','2PAFLT','2PAPUL',
  '3PMJMP','3PMCOR','3PMSBK','3PMFAD','3PMPUL',
  '3PAJMP','3PACOR','3PASBK','3PAFAD','3PAPUL',
  'MADE2','MISS2','MADE3','MISS3',
]);

const MADE_SHOT_CODES = new Set([
  '2PMJMP','2PMLAY','2PMDLA','2PMHOK','2PMTIP','2PMFLO',
  '2PMTLA','2PMSBK','2PMTRN','2PMFAD','2PMFLT','2PMPUL','MADE2',
  '3PMJMP','3PMCOR','3PMSBK','3PMFAD','3PMPUL','MADE3',
]);

const MADE3_CODES = new Set(['3PMJMP','3PMCOR','MADE3']);
const FT_MADE_CODES = new Set(['FTH11M','FTH21M','FTH22M','FTH31M','FTH32M','FTH33M','FT_MADE']);

const REBOUND_CODES = new Set(['REBDEF','REBOFN','REBOUND']);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clockToSeconds(clock: string): number {
  const [m, s] = clock.split(':').map(Number);
  if (isNaN(m) || isNaN(s)) return 0;
  return m * 60 + s;
}

function pointsFromCode(code: string): number {
  if (MADE3_CODES.has(code)) return 3;
  if (MADE_SHOT_CODES.has(code)) return 2;
  if (FT_MADE_CODES.has(code)) return 1;
  return 0;
}

interface ShotInfo {
  x: number; y: number; made: boolean;
  zone: string; bandSide: string; distM: number;
}

// ─── Main PBP sync ────────────────────────────────────────────────────────────
export async function syncPBP(gameId: number): Promise<void> {
  const pbpRes = await wcbaClient.get(`/api/v2/game/${gameId}/actions`);
  const actions: any[] = Array.isArray(pbpRes.data) ? pbpRes.data : (pbpRes.data?.data ?? []);
  if (actions.length === 0) { logger.warn('PBP: empty', { gameId }); return; }

  // Shot chart (non-fatal)
  const shotLookup = new Map<string, ShotInfo>();
  try {
    const params = new URLSearchParams();
    params.append('gameId', String(gameId));
    ['1', '2', '3', '4'].forEach(p => params.append('periods', p));
    const shotRes = await wcbaClient.get(`/datahub/cbamatch/games/hotspot/hotspotdata?${params}`);
    const rawShots: any[] = Array.isArray(shotRes.data?.data) ? shotRes.data.data
      : Array.isArray(shotRes.data) ? shotRes.data : [];

    const shotPoints: ShotPoint[] = rawShots
      .filter((s: any) => SHOT_CODES.has(s.actionCode ?? ''))
      .map((s: any) => ({
        pointX: Number(s.pointX ?? 0), pointY: Number(s.pointY ?? 0),
        fgTypeStatus: MADE_SHOT_CODES.has(s.actionCode ?? ''),
        playerId: Number(s.playerId ?? s.userId ?? 0),
        teamId: Number(s.teamId ?? 0),
        teamType: (s.teamType ?? 'Home') as 'Home' | 'Away',
        period: Number(s.period ?? 0),
        isStartLineUp: Boolean(s.isStartLineUp),
      }));

    for (const c of classifyShots(shotPoints)) {
      const key = `${c.playerId}_${c.period}_${c.pointX.toFixed(5)}`;
      shotLookup.set(key, {
        x: c.normalizedX, y: c.normalizedY,
        made: MADE_SHOT_CODES.has(c as any) || c.fgTypeStatus,
        zone: c.zone, bandSide: c.bandSide, distM: c.distToAroM,
      });
    }
    logger.info('Shot chart fetched', { gameId, shots: shotLookup.size });
  } catch (err: any) {
    logger.warn('Shot chart failed (non-fatal)', { gameId, error: err.message });
  }

  // State machine
  const playersOnCourt: Map<number, Set<number>> = new Map();
  let stintId = 0;
  let lastSubOrStart = 0;
  let momentumTeamId: number | null = null;
  let momentumRun = 0;
  const recentEvents: Array<{ teamId: number; userId: number; code: string }> = [];
  const unmappedCodes = new Set<string>();

  const pbpRows = actions.map((a: any, idx: number) => {
    const actionCode: string    = a.action_code ?? a.actionCode ?? '';
    const eventType             = ACTION_CODE_MAP[actionCode] ?? 'unknown';
    const userId: number | null = a.user_id ? Number(a.user_id) : null;
    const teamId: number | null = a.team_id ? Number(a.team_id) : null;
    const period                = Number(a.current_period ?? a.period ?? 0);
    const clock                 = String(a.start_time ?? a.clock ?? '');
    const homeScore             = Number(a.home_score ?? 0);
    const awayScore             = Number(a.away_score ?? 0);
    const scoreDiff             = homeScore - awayScore;

    // Shot enrichment
    const isShot = SHOT_CODES.has(actionCode);
    const pointX = isShot ? Number(a.pointX ?? 0) : null;
    let shotX: number | null = null, shotY: number | null = null;
    let shotMade: boolean | null = null, shotZone: string | null = null;
    let shotBandSide: string | null = null, shotDistM: number | null = null;

    if (isShot && userId != null && pointX != null) {
      const key = `${userId}_${period}_${pointX.toFixed(5)}`;
      const info = shotLookup.get(key);
      if (info) {
        shotX = info.x; shotY = info.y; shotMade = info.made;
        shotZone = info.zone; shotBandSide = info.bandSide; shotDistM = info.distM;
      }
      // Fallback: derive made from action code
      if (shotMade === null) shotMade = MADE_SHOT_CODES.has(actionCode);
    }

    // Rebound type
    let reboundType: string | null = null;
    if (REBOUND_CODES.has(actionCode)) {
      reboundType = actionCode === 'REBOFN' ? 'offensive' : 'defensive';
    } else if (actionCode === 'REBOUND' && teamId != null && recentEvents.length > 0) {
      const lastShot = [...recentEvents].reverse().find(e => SHOT_CODES.has(e.code));
      if (lastShot) reboundType = lastShot.teamId === teamId ? 'offensive' : 'defensive';
    }

    // Assist inference
    let assistedByExternalId: number | null = null;
    if (MADE_SHOT_CODES.has(actionCode) && teamId != null && userId != null) {
      const prev = recentEvents[recentEvents.length - 1];
      if (prev && prev.teamId === teamId && prev.userId !== userId &&
          !SHOT_CODES.has(prev.code) && !REBOUND_CODES.has(prev.code)) {
        assistedByExternalId = prev.userId;
      }
    }

    // Stint tracking
    if (actionCode === 'SUBONC' || actionCode === 'SUBOFF' || actionCode === 'SUBIN' || actionCode === 'SUBOUT') {
      if (idx !== lastSubOrStart) { stintId++; lastSubOrStart = idx; }
      if (teamId != null && userId != null) {
        if (!playersOnCourt.has(teamId)) playersOnCourt.set(teamId, new Set());
        if (actionCode === 'SUBONC' || actionCode === 'SUBIN') playersOnCourt.get(teamId)!.add(userId);
        else playersOnCourt.get(teamId)!.delete(userId);
      }
    }

    // Momentum
    const pts = pointsFromCode(actionCode);
    if (pts > 0 && teamId != null) {
      if (momentumTeamId === teamId) momentumRun += pts;
      else { momentumTeamId = teamId; momentumRun = pts; }
    }
    const currentRun = (teamId === momentumTeamId) ? momentumRun : 0;

    // Lead change / tie
    const prevDiff = idx > 0
      ? (Number(actions[idx - 1]?.home_score ?? 0) - Number(actions[idx - 1]?.away_score ?? 0))
      : 0;
    const leadChange = idx > 0 && Math.sign(scoreDiff) !== 0 && Math.sign(prevDiff) !== 0
      && Math.sign(scoreDiff) !== Math.sign(prevDiff);
    const tie = scoreDiff === 0;

    // Collect unmapped (deduplicated, log once at end)
    if (actionCode && eventType === 'unknown') unmappedCodes.add(actionCode);

    if (userId != null && teamId != null) {
      recentEvents.push({ teamId, userId, code: actionCode });
      if (recentEvents.length > 3) recentEvents.shift();
    }

    return {
      gameId, quarter: period, clock, sequence: idx,
      eventType, actionCode, eventZh: a.action_title ?? a.action_zh ?? '',
      playerExternalId: userId, teamId,
      homeScore, awayScore, scoreDifferential: scoreDiff,
      actionOwnerTeam: a.action_owner_team ?? null,
      stintId, currentMomentumRun: currentRun,
      leadChange, tie,
      shotX, shotY, shotMade, shotZone, shotBandSide, shotDistM,
      reboundType, assistedByExternalId,
    };
  });

  if (unmappedCodes.size > 0) {
    logger.warn('Unmapped action_codes in game', { gameId, codes: Array.from(unmappedCodes) });
  }

  await ingest({
    type: 'pbp',
    seasonId: config.wcba.seasonId,
    competitionId: config.wcba.competitionId,
    data: pbpRows,
  });

  logger.info('PBP synced', {
    gameId, events: pbpRows.length, shots: shotLookup.size,
    assists_inferred: pbpRows.filter(r => r.assistedByExternalId).length,
    rebounds_typed: pbpRows.filter(r => r.reboundType).length,
    unmapped: unmappedCodes.size,
  });
}

export async function syncNewPBP(gameIds: number[]): Promise<void> {
  logger.info('Syncing PBP batch', { count: gameIds.length });
  let synced = 0;
  for (const id of gameIds) {
    try { await syncPBP(id); synced++; }
    catch (err: any) { logger.error('PBP sync failed', { gameId: id, error: err.message }); }
  }
  logger.info('PBP batch done', { synced, total: gameIds.length });
}
