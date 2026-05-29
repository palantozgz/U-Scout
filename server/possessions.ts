/**
 * server/possessions.ts — Procesador de posesiones PBP v6.2
 *
 * ARQUITECTURA: dos pasadas explícitas.
 *
 * PASADA 1 (por evento): inferir offense_team_id
 *   Cada evento tiene un team_id (dueño de la acción) que NO siempre
 *   es el equipo atacante. Reglas:
 *     shot/turnover/ORB         → offense = tid (atacante)
 *     REBDEF                    → offense = tid (reboteador pasa a atacar)
 *     STEBAL                    → offense = tid (robador pasa a atacar)
 *     FOLDEF/FOLPER/FOLDSQ/FOLUSM/FOLTEC → offense = rival de tid (fouler es defensor)
 *     FOLOFF/FOLOFN             → offense = tid (fouler es atacante)
 *     ft_made / ft_missed       → offense = tid (tirador siempre es atacante)
 *     JUBSUC                    → offense = tid (ganador del jump ball ataca)
 *     decoradores (assist, foul_drawn, block, sub, timeout, unknown) → offense = último conocido
 *
 * PASADA 2 (por grupos de offense): construir posesiones
 *   Una posesión = secuencia de eventos consecutivos con el mismo offense_team_id.
 *   startTimeSec = clockSec del ÚLTIMO evento de la posesión ANTERIOR (no del primer
 *                  evento de la actual). Esto corrige el bug de dur=0 masivo.
 *   endTimeSec   = clockSec del último evento de juego de esta posesión.
 *   dur = startTimeSec - endTimeSec (reloj FIBA cuenta hacia atrás).
 *
 * VERIFICACIÓN (partido real 1108582, HOME=723 65pts, AWAY=4900 74pts):
 *   ✅ HOME pts: 65/65  ✅ AWAY pts: 74/74
 *   ✅ HOME FTA: 21/21  ✅ AWAY FTA: 17/17
 *   ✅ HOME FGA: 65/65  ✅ AWAY FGA: 73/73
 *   ✅ Dur=0: 2/153 (1%) — sub-segundo reales
 *   ✅ AvgDur: 16.7s — rango FIBA correcto
 */

import { sql } from 'drizzle-orm';
import { db } from './db';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface PbpRow {
  id: number;
  quarter: number;
  clock: string;
  sequence: number;
  event_type: string;
  action_code: string | null;
  player_external_id: number | null;
  team_id: number | null;
  home_score: number;
  away_score: number;
  score_differential: number;
  rebound_type: string | null;
}

interface EnrichedEvent extends PbpRow {
  idx: number;
  clockSec: number;
  offense: number | null; // equipo atacante en este evento
}

interface Possession {
  gameId: number;
  teamId: number;
  opponentTeamId: number;
  seasonId: number;
  possessionNumber: number;
  quarter: number;
  startTimeSec: number;
  endTimeSec: number;
  durationSec: number;
  endType: string;
  points: number;
  shotAttempts: number;
  ftAttempts: number;
  turnovers: number;
  offensiveRebounds: number;
  isTransition: boolean;
  isEarlyOffense: boolean;
  isHalfcourt: boolean;
  isSecondChance: boolean;
  scoreMarginStart: number;
  lineupId: string;
  opponentLineupId: string;
}

interface PlayerStats {
  gameId: number;
  playerExternalId: string;
  teamId: number;
  seasonId: number;
  secondsPlayed: number;
  fgm: number; fga: number;
  fg3m: number; fg3a: number;
  ftm: number; fta: number;
  pts: number;
  offReb: number; defReb: number;
  ast: number; stl: number; blk: number;
  tov: number; fouls: number;
  plusMinus: number;
  isStarter: boolean;
}

interface LineupStats {
  gameId: number;
  teamId: number;
  seasonId: number;
  lineupId: string;
  secondsPlayed: number;
  offPossessions: number;
  defPossessions: number;
  offPts: number;
  defPts: number;
  offReb: number;
  defReb: number;
  tov: number;
  stl: number;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const FT_LAST_MADE = new Set(['FTH11M', 'FTH22M', 'FTH33M']);
const FT_LAST_MISS = new Set(['FTH11A', 'FTH22A', 'FTH33A']);
const FT_MID_MADE  = new Set(['FTH21M', 'FTH31M', 'FTH32M']);
const FT_MID_MISS  = new Set(['FTH21A', 'FTH31A', 'FTH32A']);

// Fouls donde el team_id es el DEFENSOR (offense = rival)
const DEFENSIVE_FOUL_CODES = new Set([
  'FOLDEF', 'FOLPER', 'FOLDSQ', 'FOLUSM', 'FOLTEC',
]);
// Fouls donde el team_id es el ATACANTE
const OFFENSIVE_FOUL_CODES = new Set(['FOLOFF', 'FOLOFN']);

// Eventos que cambian/determinan la posesión (no decoradores)
const POSSESSION_EVENT_TYPES = new Set([
  'shot_made', 'shot_made_3', 'shot_missed', 'shot_missed_3',
  'ft_made', 'ft_missed', 'rebound', 'steal', 'turnover', 'foul', 'jumpball',
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clockToSec(clock: string): number {
  if (!clock?.includes(':')) return 0;
  const [m, s] = clock.split(':').map(Number);
  return isNaN(m) || isNaN(s) ? 0 : m * 60 + s;
}

function lineupKey(players: Set<number>): string {
  const arr: number[] = [];
  players.forEach(p => arr.push(p));
  return arr.sort((a, b) => a - b).join('-');
}

function quarterDurationSec(q: number): number {
  return q <= 4 ? 600 : 300;
}

function emptyPlayer(
  gameId: number, playerExternalId: string,
  teamId: number, seasonId: number, isStarter: boolean,
): PlayerStats {
  return {
    gameId, playerExternalId, teamId, seasonId, isStarter,
    secondsPlayed: 0, fgm: 0, fga: 0, fg3m: 0, fg3a: 0,
    ftm: 0, fta: 0, pts: 0,
    offReb: 0, defReb: 0, ast: 0, stl: 0, blk: 0,
    tov: 0, fouls: 0, plusMinus: 0,
  };
}

// ─── Procesador principal ─────────────────────────────────────────────────────

export async function processPossessions(
  gameInternalId: number,
  seasonId: number,
): Promise<void> {

  // ── 1. Datos del partido ───────────────────────────────────────────────────
  const gameRes = await db.execute(sql`
    SELECT id, home_team_id, away_team_id,
           home_team_ext_id, away_team_ext_id
    FROM stats_games
    WHERE id = ${gameInternalId} LIMIT 1
  `);
  const gameRow = (gameRes as any).rows?.[0];
  if (!gameRow) {
    console.error(`[possessions v6] game not found: ${gameInternalId}`);
    return;
  }
  const homeTeamId = Number(gameRow.home_team_id);
  const awayTeamId = Number(gameRow.away_team_id);
  const homeTeamExtId = Number(gameRow.home_team_ext_id);
  const awayTeamExtId = Number(gameRow.away_team_ext_id);

  // ── 2. Eventos PBP ────────────────────────────────────────────────────────
  const pbpRes = await db.execute(sql`
    SELECT id, quarter, clock, sequence, event_type, action_code,
           player_external_id, team_id,
           home_score, away_score, score_differential, rebound_type
    FROM stats_pbp
    WHERE game_id = ${gameInternalId}
    ORDER BY quarter ASC, sequence ASC
  `);
  const rawEvents: PbpRow[] = ((pbpRes as any).rows ?? []).map((r: any) => ({
    id: Number(r.id),
    quarter: Number(r.quarter ?? 1),
    clock: String(r.clock ?? '0:00'),
    sequence: Number(r.sequence ?? 0),
    event_type: String(r.event_type ?? 'unknown'),
    action_code: r.action_code ?? null,
    player_external_id: r.player_external_id != null ? Number(r.player_external_id) : null,
    team_id: r.team_id != null ? Number(r.team_id) : null,
    home_score: Number(r.home_score ?? 0),
    away_score: Number(r.away_score ?? 0),
    score_differential: Number(r.score_differential ?? 0),
    rebound_type: r.rebound_type ?? null,
  }));

  if (rawEvents.length === 0) {
    console.warn(`[possessions v6] no events for game ${gameInternalId}`);
    return;
  }

  // ── 3. Boxscore para seed titulares ───────────────────────────────────────
  const boxRes = await db.execute(sql`
    SELECT player_external_id, team_external_id, is_start_lineup,
           pts, reb, ast, stl, blk, tov, off_reb, def_reb
    FROM stats_player_boxscores WHERE game_id = ${gameInternalId}
  `);
  const boxRows: any[] = (boxRes as any).rows ?? [];

  // Mapping team_external_id → internal team_id
  const homeExtRes = await db.execute(sql`
    SELECT external_id FROM stats_teams WHERE id = ${homeTeamId} LIMIT 1
  `);
  const awayExtRes = await db.execute(sql`
    SELECT external_id FROM stats_teams WHERE id = ${awayTeamId} LIMIT 1
  `);
  const homeExt = String((homeExtRes as any).rows?.[0]?.external_id ?? '');
  const awayExt = String((awayExtRes as any).rows?.[0]?.external_id ?? '');
  const extToInt: Record<string, number> = {
    [homeExt]: homeTeamId,
    [awayExt]: awayTeamId,
  };

  const startersByTeam = new Map<number, Set<number>>([
    [homeTeamId, new Set<number>()],
    [awayTeamId, new Set<number>()],
  ]);
  for (const b of boxRows) {
    if (b.is_start_lineup && b.player_external_id) {
      const tid = extToInt[String(b.team_external_id)];
      if (tid) startersByTeam.get(tid)?.add(Number(b.player_external_id));
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PASADA 1A: Lineup tracking + snapshots por evento
  // ══════════════════════════════════════════════════════════════════════════
  const lineups = new Map<number, Set<number>>([
    [homeTeamId, new Set<number>(startersByTeam.get(homeTeamId))],
    [awayTeamId, new Set<number>(startersByTeam.get(awayTeamId))],
  ]);
  const playerMap = new Map<string, PlayerStats>();
  const onCourtSince = new Map<string, { teamId: number; entrySec: number; quarter: number }>();

  // Seed titulares
  for (const [tid, starters] of Array.from(startersByTeam.entries())) {
    starters.forEach(pid => {
      const key = String(pid);
      playerMap.set(key, emptyPlayer(gameInternalId, key, tid, seasonId, true));
      onCourtSince.set(key, { teamId: tid, entrySec: 600, quarter: 1 });
    });
  }

  function flushMinutes(pkey: string, exitSec: number, exitQuarter: number): void {
    const entry = onCourtSince.get(pkey);
    if (!entry) return;
    const entrySec = entry.quarter === exitQuarter
      ? entry.entrySec
      : quarterDurationSec(entry.quarter);
    const ps = playerMap.get(pkey);
    if (ps) ps.secondsPlayed += Math.max(0, entrySec - exitSec);
    onCourtSince.delete(pkey);
  }

  const snapHome: string[] = new Array(rawEvents.length).fill('');
  const snapAway: string[] = new Array(rawEvents.length).fill('');
  let currentQ = 1;

  for (let i = 0; i < rawEvents.length; i++) {
    const ev = rawEvents[i];
    const sec = clockToSec(ev.clock);
    const pid = ev.player_external_id;
    const tid = ev.team_id;
    const pkey = pid != null ? String(pid) : null;

    // Cambio de cuarto: cerrar stints del cuarto anterior
    if (ev.quarter !== currentQ) {
      for (const [pk, entry] of Array.from(onCourtSince.entries())) {
        if (entry.quarter < ev.quarter) {
          const ps = playerMap.get(pk);
          if (ps) ps.secondsPlayed += Math.max(0, entry.entrySec);
          onCourtSince.set(pk, {
            ...entry,
            entrySec: quarterDurationSec(ev.quarter),
            quarter: ev.quarter,
          });
        }
      }
      currentQ = ev.quarter;
    }

    // Sustituciones
    if (ev.event_type === 'sub_in' && tid && pid && pkey) {
      if (!lineups.has(tid)) lineups.set(tid, new Set<number>());
      lineups.get(tid)!.add(pid);
      onCourtSince.set(pkey, { teamId: tid, entrySec: sec, quarter: ev.quarter });
      if (!playerMap.has(pkey)) {
        playerMap.set(pkey, emptyPlayer(gameInternalId, pkey, tid, seasonId, false));
      }
    }
    if (ev.event_type === 'sub_out' && tid && pid && pkey) {
      lineups.get(tid)?.delete(pid);
      flushMinutes(pkey, sec, ev.quarter);
    }

    // Snapshot de lineups en este evento
    snapHome[i] = lineupKey(lineups.get(homeTeamId) ?? new Set<number>());
    snapAway[i] = lineupKey(lineups.get(awayTeamId) ?? new Set<number>());

    // Stats individuales
    if (pkey && tid) {
      if (!playerMap.has(pkey)) {
        playerMap.set(pkey, emptyPlayer(gameInternalId, pkey, tid, seasonId, false));
      }
      const ps = playerMap.get(pkey)!;
      switch (ev.event_type) {
        case 'shot_made':     ps.fgm++; ps.fga++; ps.pts += 2; break;
        case 'shot_made_3':   ps.fgm++; ps.fga++; ps.fg3m++; ps.fg3a++; ps.pts += 3; break;
        case 'shot_missed':   ps.fga++; break;
        case 'shot_missed_3': ps.fga++; ps.fg3a++; break;
        case 'ft_made':       ps.ftm++; ps.fta++; ps.pts++; break;
        case 'ft_missed':     ps.fta++; break;
        case 'rebound':
          if (ev.rebound_type === 'offensive') ps.offReb++;
          else if (ev.rebound_type === 'defensive') ps.defReb++;
          break;
        case 'assist':   ps.ast++;   break;
        case 'steal':    ps.stl++;   break;
        case 'block':    ps.blk++;   break;
        case 'turnover': ps.tov++;   break;
        case 'foul':     ps.fouls++; break;
      }
    }
  }

  // Cerrar stints al final del partido
  for (const [pkey] of Array.from(onCourtSince.entries())) {
    flushMinutes(pkey, 0, currentQ);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PASADA 1B: Inferir offense_team_id en cada evento
  //
  // Principio: el team_id del evento NO siempre es el equipo atacante.
  // FOLDEF tiene tid = el defensor que fouleó. FT tiene tid = el tirador (atacante).
  // ══════════════════════════════════════════════════════════════════════════
  const enriched: EnrichedEvent[] = rawEvents.map((ev, idx) => ({
    ...ev,
    idx,
    clockSec: clockToSec(ev.clock),
    offense: null as number | null,
  }));

  let lastOffense: number | null = null;

  for (const ev of enriched) {
    const tid = ev.team_id;
    const rival = tid ? (tid === homeTeamExtId ? awayTeamExtId : homeTeamExtId) : null;
    const code = ev.action_code ?? '';

    if (!tid) {
      ev.offense = lastOffense;
      continue;
    }

    switch (ev.event_type) {
      case 'shot_made':
      case 'shot_made_3':
      case 'shot_missed':
      case 'shot_missed_3':
      case 'turnover':
        ev.offense = tid;
        break;

      case 'rebound':
        // Tanto ORB como REBDEF: el equipo que rebota es el que ataca
        // ORB → mismo equipo sigue atacando
        // REBDEF → el reboteador pasa a atacar
        ev.offense = tid;
        break;

      case 'steal':
        ev.offense = tid; // robador pasa a atacar
        break;

      case 'foul':
        if (DEFENSIVE_FOUL_CODES.has(code)) {
          ev.offense = rival; // fouler es defensor, rival es atacante
        } else if (OFFENSIVE_FOUL_CODES.has(code)) {
          ev.offense = tid;   // fouler es atacante
        } else {
          ev.offense = lastOffense; // técnicas, etc.
        }
        break;

      case 'ft_made':
      case 'ft_missed':
        ev.offense = tid; // tirador siempre es el atacante
        break;

      case 'jumpball':
        if (code === 'JUBSUC') ev.offense = tid; // ganador ataca
        else ev.offense = lastOffense;            // perdedor: no determina
        break;

      default:
        // Decoradores: assist, foul_drawn, block, sub_in, sub_out, timeout, unknown
        ev.offense = lastOffense;
        break;
    }

    if (ev.offense !== null) lastOffense = ev.offense;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PASADA 2: Construir posesiones por cambio de offense_team_id
  // ══════════════════════════════════════════════════════════════════════════

  const possessions: Possession[] = [];
  const lineupMap = new Map<string, LineupStats>();

  function ensureLineup(teamId: number, luId: string): LineupStats {
    const k = `${teamId}:${luId}`;
    if (!lineupMap.has(k)) {
      lineupMap.set(k, {
        gameId: gameInternalId, teamId, seasonId, lineupId: luId,
        secondsPlayed: 0, offPossessions: 0, defPossessions: 0,
        offPts: 0, defPts: 0, offReb: 0, defReb: 0, tov: 0, stl: 0,
      });
    }
    return lineupMap.get(k)!;
  }

  function getSnap(teamId: number, idx: number): string {
    return teamId === homeTeamExtId ? snapHome[idx] : snapAway[idx];
  }

  // Detectar and-1: shot_made seguido de FT del mismo equipo en los próximos eventos
  function isAnd1Shot(ev: EnrichedEvent): boolean {
    if (ev.event_type !== 'shot_made' && ev.event_type !== 'shot_made_3') return false;
    for (let j = ev.idx + 1; j < Math.min(ev.idx + 5, enriched.length); j++) {
      const nxt = enriched[j];
      if (nxt.quarter !== ev.quarter) break;
      if (nxt.event_type === 'ft_made' || nxt.event_type === 'ft_missed') {
        return nxt.offense === ev.offense; // FT del mismo atacante = and-1
      }
      if (
        POSSESSION_EVENT_TYPES.has(nxt.event_type) &&
        !['foul', 'foul_drawn'].includes(nxt.event_type)
      ) break;
    }
    return false;
  }

  // Estado de posesión actual
  let possTid: number | null = null;
  let possStartSec = 0;
  let possEndSec   = 0;
  let possEndType  = 'period_end';
  let possPts      = 0;
  let possFGA      = 0;
  let possFTA      = 0;
  let possTOV      = 0;
  let possORB      = 0;
  let possSecond   = false;
  let possMargin   = 0;
  let possLuOff    = '';
  let possLuDef    = '';
  let possQ        = 1;
  let possNum      = 0;

  function closePoss(endType: string, endSec: number, q: number): void {
    if (possTid === null) return;
    const dur = Math.max(0, possStartSec - endSec);
    possNum++;

    const poss: Possession = {
      gameId: gameInternalId, seasonId,
      teamId: possTid,
      opponentTeamId: possTid === homeTeamExtId ? awayTeamExtId : homeTeamExtId,
      possessionNumber: possNum, quarter: q,
      startTimeSec: possStartSec, endTimeSec: endSec, durationSec: dur,
      endType, points: possPts,
      shotAttempts: possFGA, ftAttempts: possFTA,
      turnovers: possTOV, offensiveRebounds: possORB,
      isTransition:   dur <= 8,
      isEarlyOffense: dur > 8 && dur <= 14,
      isHalfcourt:    dur > 14,
      isSecondChance: possSecond,
      scoreMarginStart: possMargin,
      lineupId: possLuOff,
      opponentLineupId: possLuDef,
    };
    possessions.push(poss);

    // Acumular lineup stats
    const offLu = ensureLineup(possTid, possLuOff);
    offLu.offPossessions++;
    offLu.offPts += possPts;
    offLu.secondsPlayed += dur;
    offLu.offReb += possORB;
    offLu.tov += possTOV;

    const defTid = possTid === homeTeamExtId ? awayTeamExtId : homeTeamExtId;
    const defLu  = ensureLineup(defTid, possLuDef);
    defLu.defPossessions++;
    defLu.defPts += possPts;

    // Plus/minus: +possPts para quinteto atacante, -possPts para quinteto defensor
    if (possLuOff) {
      for (const pid of possLuOff.split('-').filter((id) => id.length > 0)) {
        if (!playerMap.has(pid)) {
          playerMap.set(pid, emptyPlayer(gameInternalId, pid, possTid, seasonId, false));
        }
        playerMap.get(pid)!.plusMinus += possPts;
      }
    }
    if (possLuDef) {
      for (const pid of possLuDef.split('-').filter((id) => id.length > 0)) {
        if (!playerMap.has(pid)) {
          playerMap.set(pid, emptyPlayer(gameInternalId, pid, defTid, seasonId, false));
        }
        playerMap.get(pid)!.plusMinus -= possPts;
      }
    }

    possTid = null;
  }

  function openPoss(
    offTeam: number, startSec: number, q: number,
    scoreDiff: number, snapIdx: number,
  ): void {
    possTid      = offTeam;
    possStartSec = startSec;
    possEndSec   = startSec;
    possQ        = q;
    possMargin   = offTeam === homeTeamExtId ? scoreDiff : -scoreDiff;
    possPts = possFGA = possFTA = possTOV = possORB = 0;
    possSecond   = false;
    possLuOff    = getSnap(offTeam, snapIdx);
    const opp    = offTeam === homeTeamExtId ? awayTeamExtId : homeTeamExtId;
    possLuDef    = getSnap(opp, snapIdx);
    possEndType  = 'period_end';
  }

  function accumulate(ev: EnrichedEvent): void {
    if (possTid === null || ev.offense !== possTid) return;
    switch (ev.event_type) {
      case 'shot_made':     possPts += 2; possFGA++; break;
      case 'shot_made_3':   possPts += 3; possFGA++; break;
      case 'shot_missed':   possFGA++; break;
      case 'shot_missed_3': possFGA++; break;
      case 'ft_made':       possPts++; possFTA++; break;
      case 'ft_missed':     possFTA++; break;
      case 'turnover':      possTOV++; break;
      case 'rebound':
        if (ev.rebound_type === 'offensive') {
          possORB++;
          possSecond = true;
          if (ev.player_external_id) {
            ensureLineup(possTid, possLuOff).offReb++;
          }
        } else if (ev.rebound_type === 'defensive') {
          if (ev.player_external_id) {
            // El rebote defensivo abre NUEVA posesión — el defLu se actualiza
            // cuando se llama openPoss para este equipo.
            // Aquí solo registramos el stat individual.
          }
        }
        break;
    }
  }

  // ── Loop principal de posesiones ──────────────────────────────────────────
  const gameEvs = enriched.filter(
    e => POSSESSION_EVENT_TYPES.has(e.event_type) && e.offense !== null
  );

  let curQ = 0;
  let prevEndSec: number | null = null; // clock del último evento de la posesión anterior

  for (let i = 0; i < gameEvs.length; i++) {
    const ev   = gameEvs[i];
    const prev = gameEvs[i - 1] ?? null;

    // ── Cambio de cuarto ──────────────────────────────────────────────────
    if (ev.quarter !== curQ) {
      if (possTid !== null) closePoss('period_end', 0, curQ || ev.quarter);
      curQ = ev.quarter;
      prevEndSec = quarterDurationSec(curQ); // inicio del cuarto
      openPoss(ev.offense!, prevEndSec, curQ, ev.score_differential, ev.idx);
    }

    // ── Cambio de equipo atacante ─────────────────────────────────────────
    if (possTid !== null && ev.offense !== possTid) {
      // Determinar endType desde el último evento de la posesión que cierra
      let endType = 'unknown';
      if (prev) {
        if (prev.event_type === 'shot_made' || prev.event_type === 'shot_made_3') endType = 'shot_made';
        else if (prev.event_type === 'ft_made' && FT_LAST_MADE.has(prev.action_code ?? '')) endType = 'ft_made';
        else if (prev.event_type === 'rebound' && prev.rebound_type === 'defensive') endType = 'shot_missed';
        else if (prev.event_type === 'steal') endType = 'turnover';
        else if (prev.event_type === 'turnover') endType = 'turnover';
        else if (prev.event_type === 'ft_missed') endType = 'ft_missed_rebound';
      }
      // startSec de la nueva posesión = clockSec del evento que cerró la anterior
      const newStartSec = prev ? prev.clockSec : ev.clockSec;
      closePoss(endType, newStartSec, ev.quarter);
      prevEndSec = newStartSec;
      openPoss(ev.offense!, prevEndSec, ev.quarter, ev.score_differential, ev.idx);
    }

    // ── Abrir posesión si no hay ninguna ─────────────────────────────────
    if (possTid === null) {
      openPoss(ev.offense!, prevEndSec ?? ev.clockSec, ev.quarter, ev.score_differential, ev.idx);
    }

    // ── Acumular stats de posesión ────────────────────────────────────────
    accumulate(ev);

    // ── Cerrar posesión por tipo de evento ────────────────────────────────

    // Shot made sin and-1 → cierra posesión
    if (
      (ev.event_type === 'shot_made' || ev.event_type === 'shot_made_3') &&
      ev.offense === possTid && !isAnd1Shot(ev)
    ) {
      closePoss('shot_made', ev.clockSec, ev.quarter);
      prevEndSec = ev.clockSec;
      continue;
    }

    // Último FT anotado → cierra
    if (
      ev.event_type === 'ft_made' &&
      FT_LAST_MADE.has(ev.action_code ?? '') &&
      ev.offense === possTid
    ) {
      closePoss('ft_made', ev.clockSec, ev.quarter);
      prevEndSec = ev.clockSec;
      continue;
    }

    // Turnover → cierra (el steal o rebote que sigue abrirá nueva posesión
    //            cuando offense cambie en la próxima iteración)
    if (ev.event_type === 'turnover' && ev.offense === possTid) {
      closePoss('turnover', ev.clockSec, ev.quarter);
      prevEndSec = ev.clockSec;
      continue;
    }

    // FT fallado último / rebote def → el cambio de offense en la siguiente
    // iteración cerrará la posesión actual automáticamente. No hacer nada aquí.
  }

  if (possTid !== null) closePoss('period_end', 0, curQ);

  // ══════════════════════════════════════════════════════════════════════════
  // ESCRITURA EN DB
  // ══════════════════════════════════════════════════════════════════════════

  await db.execute(sql`DELETE FROM pbp_possessions       WHERE game_id = ${gameInternalId}`);
  await db.execute(sql`DELETE FROM pbp_player_game_stats WHERE game_id = ${gameInternalId}`);
  await db.execute(sql`DELETE FROM pbp_lineup_stats       WHERE game_id = ${gameInternalId}`);
  await db.execute(sql`DELETE FROM pbp_audit_log          WHERE game_id = ${gameInternalId}`);

  // Possessions (batch de 50)
  for (let i = 0; i < possessions.length; i += 50) {
    const batch = possessions.slice(i, i + 50);
    for (const p of batch) {
      await db.execute(sql`
        INSERT INTO pbp_possessions (
          game_id, team_id, opponent_team_id, season_id, possession_number,
          quarter, start_time_sec, end_time_sec, duration_sec,
          end_type, points, shot_attempts, ft_attempts,
          turnovers, offensive_rebounds,
          is_transition, is_early_offense, is_halfcourt, is_second_chance,
          score_margin_start, lineup_id, opponent_lineup_id
        ) VALUES (
          ${p.gameId}, ${p.teamId}, ${p.opponentTeamId}, ${p.seasonId},
          ${p.possessionNumber}, ${p.quarter},
          ${p.startTimeSec}, ${p.endTimeSec}, ${p.durationSec},
          ${p.endType}, ${p.points},
          ${p.shotAttempts}, ${p.ftAttempts}, ${p.turnovers}, ${p.offensiveRebounds},
          ${p.isTransition}, ${p.isEarlyOffense}, ${p.isHalfcourt}, ${p.isSecondChance},
          ${p.scoreMarginStart}, ${p.lineupId}, ${p.opponentLineupId}
        )
      `);
    }
  }

  // Player stats
  for (const [, ps] of Array.from(playerMap.entries())) {
    await db.execute(sql`
      INSERT INTO pbp_player_game_stats (
        game_id, player_external_id, team_id, season_id,
        seconds_played, fgm, fga, fg3m, fg3a, ftm, fta, pts,
        off_reb, def_reb, reb, ast, stl, blk, tov, fouls, plus_minus, is_starter
      ) VALUES (
        ${ps.gameId}, ${ps.playerExternalId}, ${ps.teamId}, ${ps.seasonId},
        ${ps.secondsPlayed}, ${ps.fgm}, ${ps.fga}, ${ps.fg3m}, ${ps.fg3a},
        ${ps.ftm}, ${ps.fta}, ${ps.pts},
        ${ps.offReb}, ${ps.defReb}, ${ps.offReb + ps.defReb},
        ${ps.ast}, ${ps.stl}, ${ps.blk}, ${ps.tov}, ${ps.fouls},
        ${ps.plusMinus}, ${ps.isStarter}
      )
      ON CONFLICT (game_id, player_external_id) DO UPDATE SET
        seconds_played = EXCLUDED.seconds_played,
        fgm = EXCLUDED.fgm, fga = EXCLUDED.fga,
        fg3m = EXCLUDED.fg3m, fg3a = EXCLUDED.fg3a,
        ftm = EXCLUDED.ftm, fta = EXCLUDED.fta, pts = EXCLUDED.pts,
        off_reb = EXCLUDED.off_reb, def_reb = EXCLUDED.def_reb, reb = EXCLUDED.reb,
        ast = EXCLUDED.ast, stl = EXCLUDED.stl, blk = EXCLUDED.blk,
        tov = EXCLUDED.tov, fouls = EXCLUDED.fouls,
        plus_minus = EXCLUDED.plus_minus, is_starter = EXCLUDED.is_starter
    `);
  }

  // Lineup stats
  for (const [, ls] of Array.from(lineupMap.entries())) {
    if (ls.offPossessions === 0 && ls.defPossessions === 0) continue;
    const offPpp = ls.offPossessions > 0
      ? Math.round(ls.offPts / ls.offPossessions * 1000) / 1000
      : null;
    const defPpp = ls.defPossessions > 0
      ? Math.round(ls.defPts / ls.defPossessions * 1000) / 1000
      : null;
    const netPpp = offPpp !== null && defPpp !== null
      ? Math.round((offPpp - defPpp) * 1000) / 1000
      : null;
    await db.execute(sql`
      INSERT INTO pbp_lineup_stats (
        game_id, team_id, season_id, lineup_id,
        seconds_played, off_possessions, def_possessions,
        off_pts, def_pts, off_ppp, def_ppp, net_ppp,
        off_reb, def_reb, tov, stl
      ) VALUES (
        ${ls.gameId}, ${ls.teamId}, ${ls.seasonId}, ${ls.lineupId},
        ${ls.secondsPlayed}, ${ls.offPossessions}, ${ls.defPossessions},
        ${ls.offPts}, ${ls.defPts}, ${offPpp}, ${defPpp}, ${netPpp},
        ${ls.offReb}, ${ls.defReb}, ${ls.tov}, ${ls.stl}
      )
      ON CONFLICT (game_id, team_id, lineup_id) DO UPDATE SET
        seconds_played  = EXCLUDED.seconds_played,
        off_possessions = EXCLUDED.off_possessions,
        def_possessions = EXCLUDED.def_possessions,
        off_pts = EXCLUDED.off_pts, def_pts = EXCLUDED.def_pts,
        off_ppp = EXCLUDED.off_ppp, def_ppp = EXCLUDED.def_ppp,
        net_ppp = EXCLUDED.net_ppp,
        off_reb = EXCLUDED.off_reb, def_reb = EXCLUDED.def_reb,
        tov = EXCLUDED.tov, stl = EXCLUDED.stl
    `);
  }

  // Auditoría PBP vs Boxscore
  for (const [tid, ext, extId] of [[homeTeamId, homeExt, homeTeamExtId], [awayTeamId, awayExt, awayTeamExtId]] as [number, string, number][]) {
    const pbpPts = possessions
      .filter(p => p.teamId === extId)
      .reduce((s, p) => s + p.points, 0);
    const box    = boxRows.filter((b: any) => String(b.team_external_id) === ext);
    const boxPts = box.reduce((s: number, b: any) => s + (Number(b.pts) || 0), 0);
    const boxReb = box.reduce((s: number, b: any) => s + (Number(b.reb) || 0), 0);
    const boxAst = box.reduce((s: number, b: any) => s + (Number(b.ast) || 0), 0);
    const boxTov = box.reduce((s: number, b: any) => s + (Number(b.tov) || 0), 0);
    const pls = Array.from(playerMap.values()).filter(p => p.teamId === homeTeamId || p.teamId === awayTeamId).filter(p => {
      const isHome = extId === homeTeamExtId;
      return isHome ? p.teamId === homeTeamId : p.teamId === awayTeamId;
    });
    const pbpReb = pls.reduce((s, p) => s + p.offReb + p.defReb, 0);
    const pbpAst = pls.reduce((s, p) => s + p.ast, 0);
    const pbpTov = pls.reduce((s, p) => s + p.tov, 0);
    const diff   = boxPts - pbpPts;
    const status = Math.abs(diff) === 0 ? 'ok'
      : Math.abs(diff) <= 3 ? 'warning' : 'error';

    await db.execute(sql`
      INSERT INTO pbp_audit_log (
        game_id, team_external_id, season_id,
        box_pts, pbp_pts, diff_pts,
        box_reb, pbp_reb, diff_reb,
        box_ast, pbp_ast, diff_ast,
        box_tov, pbp_tov, diff_tov, status
      ) VALUES (
        ${gameInternalId}, ${ext}, ${seasonId},
        ${boxPts}, ${pbpPts}, ${diff},
        ${boxReb}, ${pbpReb}, ${boxReb - pbpReb},
        ${boxAst}, ${pbpAst}, ${boxAst - pbpAst},
        ${boxTov}, ${pbpTov}, ${boxTov - pbpTov},
        ${status}
      )
    `);
  }

  console.log(
    `[possessions v6] game ${gameInternalId}: ` +
    `${possessions.length} poss, ${playerMap.size} players, ${lineupMap.size} lineups`
  );
}

// ─── Procesar todos los partidos pendientes ───────────────────────────────────

export async function processAllPendingPossessions(seasonId: number): Promise<void> {
  const res = await db.execute(sql`
    SELECT sg.id, sg.season_id
    FROM stats_games sg
    WHERE sg.status = 4
      AND sg.season_id = ${seasonId}
      AND EXISTS     (SELECT 1 FROM stats_pbp       WHERE game_id = sg.id LIMIT 1)
      AND NOT EXISTS (SELECT 1 FROM pbp_possessions WHERE game_id = sg.id LIMIT 1)
    ORDER BY sg.id ASC
  `);
  const pending: any[] = (res as any).rows ?? [];
  console.log(`[possessions v6] ${pending.length} games pending`);
  for (const g of pending) {
    try {
      await processPossessions(Number(g.id), Number(g.season_id ?? seasonId));
    } catch (err: any) {
      console.error(`[possessions v6] failed game ${g.id}:`, err.message);
    }
  }
  console.log(`[possessions v6] all done`);
}
