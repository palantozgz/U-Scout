import { wcbaClient } from '../client';
import { config } from '../config';
import { ingest } from '../ingest';
import { logger } from '../logger';
import { classifyShots, type ShotPoint } from './shotZones';

// ─── Action code map ──────────────────────────────────────────────────────────
const ACTION_CODE_MAP: Record<string, string> = {
  SUBOUT: 'sub_out', SUBIN: 'sub_in', JUMPBALL: 'jumpball',
  MADE2: 'shot_made', MISS2: 'shot_missed',
  MADE3: 'shot_made_3', MISS3: 'shot_missed_3',
  REBOUND: 'rebound', FOUL: 'foul',
  FT_MADE: 'ft_made', FT_MISS: 'ft_missed',
  TIMEOUT: 'timeout', TURNOVER: 'turnover',
  STEAL: 'steal', BLOCK: 'block', CHALLENGE: 'challenge',
};

const SHOT_CODES    = new Set(['MADE2', 'MISS2', 'MADE3', 'MISS3']);
const MADE_CODES    = new Set(['MADE2', 'MADE3', 'FT_MADE']);
const REBOUND_CODE  = 'REBOUND';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parse clock "MM:SS" → seconds remaining in quarter */
function clockToSeconds(clock: string): number {
  const [m, s] = clock.split(':').map(Number);
  if (isNaN(m) || isNaN(s)) return 0;
  return m * 60 + s;
}

/** Points scored by a made basket */
function pointsFromCode(code: string): number {
  if (code === 'MADE3') return 3;
  if (code === 'MADE2') return 2;
  if (code === 'FT_MADE') return 1;
  return 0;
}

// ─── Shot lookup map type ─────────────────────────────────────────────────────
interface ShotInfo {
  x: number; y: number; made: boolean;
  zone: string; bandSide: string; distM: number;
}

// ─── Main PBP sync ────────────────────────────────────────────────────────────
export async function syncPBP(gameId: number): Promise<void> {
  // 1. Fetch play-by-play
  const pbpRes = await wcbaClient.get(`/api/v2/game/${gameId}/actions`);
  const actions: any[] = Array.isArray(pbpRes.data) ? pbpRes.data : (pbpRes.data?.data ?? []);
  if (actions.length === 0) { logger.warn('PBP: empty', { gameId }); return; }

  // 2. Fetch shot chart (non-fatal)
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
        fgTypeStatus: Boolean(s.fgTypeStatus),
        playerId: Number(s.playerId ?? s.userId ?? 0),
        teamId: Number(s.teamId ?? 0),
        teamType: (s.teamType ?? 'Home') as 'Home' | 'Away',
        period: Number(s.period ?? 0),
        isStartLineUp: Boolean(s.isStartLineUp),
      }));

    for (const c of classifyShots(shotPoints)) {
      const key = `${c.playerId}_${c.period}_${c.pointX.toFixed(5)}`;
      shotLookup.set(key, {
        x: c.normalizedX, y: c.normalizedY, made: c.fgTypeStatus,
        zone: c.zone, bandSide: c.bandSide, distM: c.distToAroM,
      });
    }
    logger.info('Shot chart fetched', { gameId, shots: shotLookup.size });
  } catch (err: any) {
    logger.warn('Shot chart failed (non-fatal)', { gameId, error: err.message });
  }

  // 3. Enrichment state machine
  // Tracks: players on court, stint id, momentum run, previous events for inference
  const playersOnCourt: Map<number, Set<number>> = new Map(); // teamId → Set<userId>
  let stintId = 0;
  let lastSubOrStart = 0;

  // Momentum: consecutive points by same team
  let momentumTeamId: number | null = null;
  let momentumRun = 0;

  // For assisted basket inference: keep last 2 events
  const recentEvents: Array<{ teamId: number; userId: number; code: string }> = [];

  // 4. Map PBP with all enrichment
  const pbpRows = actions.map((a: any, idx: number) => {
    const actionCode: string   = a.action_code ?? a.actionCode ?? '';
    const eventType            = ACTION_CODE_MAP[actionCode] ?? 'unknown';
    const userId: number | null = a.user_id ? Number(a.user_id) : null;
    const teamId: number | null = a.team_id ? Number(a.team_id) : null;
    const period               = Number(a.current_period ?? a.period ?? 0);
    const clock                = String(a.start_time ?? a.clock ?? '');
    const homeScore            = Number(a.home_score ?? 0);
    const awayScore            = Number(a.away_score ?? 0);
    const scoreDiff            = homeScore - awayScore;

    // Shots
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
    }

    // Rebound type inference
    let reboundType: string | null = null;
    if (actionCode === REBOUND_CODE && teamId != null && recentEvents.length > 0) {
      const lastShot = [...recentEvents].reverse().find(e => SHOT_CODES.has(e.code));
      if (lastShot) {
        reboundType = lastShot.teamId === teamId ? 'offensive' : 'defensive';
      }
    }

    // Assist inference: MADE2/MADE3 preceded by same-team different-player event
    let assistedByExternalId: number | null = null;
    if ((actionCode === 'MADE2' || actionCode === 'MADE3') && teamId != null && userId != null) {
      const prev = recentEvents[recentEvents.length - 1];
      if (prev && prev.teamId === teamId && prev.userId !== userId &&
          !SHOT_CODES.has(prev.code) && prev.code !== REBOUND_CODE) {
        assistedByExternalId = prev.userId;
      }
    }

    // Stint tracking (increments on each substitution)
    if (actionCode === 'SUBIN' || actionCode === 'SUBOUT') {
      if (idx !== lastSubOrStart) { stintId++; lastSubOrStart = idx; }
      // Update players on court
      if (teamId != null && userId != null) {
        if (!playersOnCourt.has(teamId)) playersOnCourt.set(teamId, new Set());
        if (actionCode === 'SUBIN')  playersOnCourt.get(teamId)!.add(userId);
        if (actionCode === 'SUBOUT') playersOnCourt.get(teamId)!.delete(userId);
      }
    }

    // Momentum run: consecutive points by same team
    const pts = pointsFromCode(actionCode);
    if (pts > 0 && teamId != null) {
      if (momentumTeamId === teamId) { momentumRun += pts; }
      else { momentumTeamId = teamId; momentumRun = pts; }
    } else if (MADE_CODES.has(actionCode) && pts === 0) {
      // Non-scoring made (shouldn't happen but reset just in case)
    }
    // When opponent scores, their run resets ours (tracked per-team via diff)
    const currentRun = (teamId === momentumTeamId) ? momentumRun : 0;

    // Lead change / tie
    const prevDiff = idx > 0 ? (Number(actions[idx - 1]?.home_score ?? 0) - Number(actions[idx - 1]?.away_score ?? 0)) : 0;
    const leadChange = idx > 0 && Math.sign(scoreDiff) !== 0 && Math.sign(prevDiff) !== 0 && Math.sign(scoreDiff) !== Math.sign(prevDiff);
    const tie = scoreDiff === 0;

    // Log unmapped codes
    if (actionCode && !ACTION_CODE_MAP[actionCode]) {
      logger.warn('Unmapped action_code', { actionCode, gameId });
    }

    // Update recent events buffer (keep last 3)
    if (userId != null && teamId != null) {
      recentEvents.push({ teamId, userId, code: actionCode });
      if (recentEvents.length > 3) recentEvents.shift();
    }

    return {
      gameId, quarter: period, clock, sequence: idx,
      eventType, actionCode, eventZh: a.action_title ?? '',
      playerExternalId: userId, teamId,
      homeScore, awayScore, scoreDifferential: scoreDiff,
      actionOwnerTeam: a.action_owner_team ?? null,
      stintId, currentMomentumRun: currentRun,
      leadChange, tie,
      // Shot data
      shotX, shotY, shotMade, shotZone, shotBandSide, shotDistM,
      // Inferred
      reboundType, assistedByExternalId,
    };
  });

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
