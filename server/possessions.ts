/**
 * server/possessions.ts — Procesador de posesiones PBP v4
 *
 * FIBA standard:
 *   - Rebote ofensivo NO crea nueva posesión (extiende la actual)
 *   - And-1: shot_made + foul defensivo inmediato = el FT pertenece a la misma posesión
 *   - Último FT: FTH11M, FTH22M, FTH33M (made) o FTH11A, FTH22A, FTH33A (missed)
 *   - FTs intermedios: FTH21M, FTH31M, FTH32M — acumulan pero no cierran posesión
 *
 * Algoritmo: pasada única hacia adelante con look-ahead de 1 evento para and-1.
 * Lineup state se construye en primera pasada, posesiones en segunda.
 *
 * Eventos sin player_external_id (TOTLTO, REBDEF sin player, etc.):
 *   → cuentan para stats de equipo en pbp_possessions
 *   → NO aparecen en pbp_player_game_stats (correcto por diseño)
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
  startType: string;
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

// Último FT de la serie → cambia posesión si anotado
const LAST_FT_MADE = new Set(['FTH11M', 'FTH22M', 'FTH33M']);
// Último FT de la serie → fallado, rebote decide
const LAST_FT_MISS = new Set(['FTH11A', 'FTH22A', 'FTH33A']);
// FTs intermedios (no cierran posesión)
const MID_FT_MADE  = new Set(['FTH21M', 'FTH31M', 'FTH32M']);
const MID_FT_MISS  = new Set(['FTH21A', 'FTH31A', 'FTH32A']);

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
  return q <= 4 ? 600 : 300; // FIBA: 10min cuartos, 5min OT
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
    SELECT id, home_team_id, away_team_id FROM stats_games
    WHERE id = ${gameInternalId} LIMIT 1
  `);
  const gameRow = (gameRes as any).rows?.[0];
  if (!gameRow) { console.error(`[possessions] game not found: ${gameInternalId}`); return; }
  const homeTeamId = Number(gameRow.home_team_id);
  const awayTeamId = Number(gameRow.away_team_id);

  // ── 2. Eventos PBP ────────────────────────────────────────────────────────
  const pbpRes = await db.execute(sql`
    SELECT id, quarter, clock, sequence, event_type, action_code,
           player_external_id, team_id,
           home_score, away_score, score_differential, rebound_type
    FROM stats_pbp
    WHERE game_id = ${gameInternalId}
    ORDER BY quarter ASC, sequence ASC
  `);
  const events: PbpRow[] = ((pbpRes as any).rows ?? []).map((r: any) => ({
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

  if (events.length === 0) { console.warn(`[possessions] no events for game ${gameInternalId}`); return; }

  // ── 3. Boxscore para seed titulares + auditoría ────────────────────────────
  const boxRes = await db.execute(sql`
    SELECT player_external_id, team_external_id, is_start_lineup,
           pts, reb, ast, stl, blk, tov, off_reb, def_reb
    FROM stats_player_boxscores WHERE game_id = ${gameInternalId}
  `);
  const boxRows: any[] = (boxRes as any).rows ?? [];

  const homeExtRes = await db.execute(sql`SELECT external_id FROM stats_teams WHERE id = ${homeTeamId} LIMIT 1`);
  const awayExtRes = await db.execute(sql`SELECT external_id FROM stats_teams WHERE id = ${awayTeamId} LIMIT 1`);
  const homeExt = String((homeExtRes as any).rows?.[0]?.external_id ?? '');
  const awayExt = String((awayExtRes as any).rows?.[0]?.external_id ?? '');
  const extToInt: Record<string, number> = { [homeExt]: homeTeamId, [awayExt]: awayTeamId };

  const startersByTeam: Map<number, Set<number>> = new Map([
    [homeTeamId, new Set<number>()], [awayTeamId, new Set<number>()],
  ]);
  for (const b of boxRows) {
    if (b.is_start_lineup && b.player_external_id) {
      const tid = extToInt[String(b.team_external_id)];
      if (tid) startersByTeam.get(tid)?.add(Number(b.player_external_id));
    }
  }

  // ── 4. Primera pasada: lineup tracking + stats individuales ────────────────
  const lineups: Map<number, Set<number>> = new Map([
    [homeTeamId, new Set<number>(startersByTeam.get(homeTeamId))],
    [awayTeamId, new Set<number>(startersByTeam.get(awayTeamId))],
  ]);

  const playerMap: Map<string, PlayerStats> = new Map();
  const onCourtSince: Map<string, { teamId: number; entrySec: number; quarter: number }> = new Map();

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
    const entrySec = entry.quarter === exitQuarter ? entry.entrySec : quarterDurationSec(entry.quarter);
    const ps = playerMap.get(pkey);
    if (ps) ps.secondsPlayed += Math.max(0, entrySec - exitSec);
    onCourtSince.delete(pkey);
  }

  // Snapshot de lineup por evento (para usar en pasada de posesiones)
  const snapHome: string[] = new Array(events.length).fill('');
  const snapAway: string[] = new Array(events.length).fill('');
  let currentQ = 1;

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const sec = clockToSec(ev.clock);
    const pid = ev.player_external_id;
    const tid = ev.team_id;
    const pkey = pid != null ? String(pid) : null;

    // Cambio de cuarto: cerrar stints abiertos
    if (ev.quarter !== currentQ) {
      for (const [pk, entry] of Array.from(onCourtSince.entries())) {
        if (entry.quarter < ev.quarter) {
          const ps = playerMap.get(pk);
          if (ps) ps.secondsPlayed += Math.max(0, entry.entrySec);
          onCourtSince.set(pk, { ...entry, entrySec: quarterDurationSec(ev.quarter), quarter: ev.quarter });
        }
      }
      currentQ = ev.quarter;
    }

    if (ev.event_type === 'sub_in' && tid && pid && pkey) {
      if (!lineups.has(tid)) lineups.set(tid, new Set<number>());
      lineups.get(tid)!.add(pid);
      onCourtSince.set(pkey, { teamId: tid, entrySec: sec, quarter: ev.quarter });
      if (!playerMap.has(pkey)) playerMap.set(pkey, emptyPlayer(gameInternalId, pkey, tid, seasonId, false));
    }
    if (ev.event_type === 'sub_out' && tid && pid && pkey) {
      lineups.get(tid)?.delete(pid);
      flushMinutes(pkey, sec, ev.quarter);
    }

    // Snapshot lineup en este evento
    snapHome[i] = lineupKey(lineups.get(homeTeamId) ?? new Set<number>());
    snapAway[i] = lineupKey(lineups.get(awayTeamId) ?? new Set<number>());

    // Stats individuales
    if (pkey && tid) {
      if (!playerMap.has(pkey)) playerMap.set(pkey, emptyPlayer(gameInternalId, pkey, tid, seasonId, false));
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
  for (const [pkey] of Array.from(onCourtSince.entries())) flushMinutes(pkey, 0, currentQ);

  // ── 5. Segunda pasada: posesiones ─────────────────────────────────────────
  const possessions: Possession[] = [];
  const lineupMap: Map<string, LineupStats> = new Map();

  function getSnap(teamId: number, idx: number): string {
    return teamId === homeTeamId ? snapHome[idx] : snapAway[idx];
  }

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

  // Estado posesión actual
  let possTid: number | null = null;   // equipo en ataque
  let possStart  = 600;
  let possType   = 'period_start';
  let possMargin = 0;
  let possLuOff  = '';
  let possLuDef  = '';
  let possPts    = 0;
  let possFGA    = 0;
  let possFTA    = 0;
  let possTOV    = 0;
  let possORB    = 0;
  let possSecond = false;
  let possQ      = 1;
  let possNum    = 0;

  // and1Pending: si el siguiente evento es un FT del mismo equipo tras shot_made+foul
  // se guarda el team_id del equipo que va a tirar el FT
  let and1Pending: number | null = null;

  function open(tid: number, startSec: number, startType: string, q: number, scoreDiff: number, idx: number): void {
    possTid    = tid;
    possStart  = startSec;
    possType   = startType;
    possQ      = q;
    possMargin = tid === homeTeamId ? scoreDiff : -scoreDiff;
    possPts = possFGA = possFTA = possTOV = possORB = 0;
    possSecond = false;
    possLuOff  = getSnap(tid, idx);
    const opp  = tid === homeTeamId ? awayTeamId : homeTeamId;
    possLuDef  = getSnap(opp, idx);
  }

  function close(endSec: number, endType: string, q: number): void {
    if (possTid === null) return;
    const dur = Math.max(0, possStart - endSec);
    possNum++;
    const p: Possession = {
      gameId: gameInternalId, seasonId,
      teamId: possTid,
      opponentTeamId: possTid === homeTeamId ? awayTeamId : homeTeamId,
      possessionNumber: possNum,
      quarter: q,
      startTimeSec: possStart,
      endTimeSec: endSec,
      durationSec: dur,
      startType: possType,
      endType,
      points: possPts,
      shotAttempts: possFGA,
      ftAttempts: possFTA,
      turnovers: possTOV,
      offensiveRebounds: possORB,
      isTransition:   dur <= 8,
      isEarlyOffense: dur > 8 && dur <= 14,
      isHalfcourt:    dur > 14,
      isSecondChance: possSecond,
      scoreMarginStart: possMargin,
      lineupId: possLuOff,
      opponentLineupId: possLuDef,
    };
    possessions.push(p);

    // Lineup stats
    const offLu = ensureLineup(possTid, possLuOff);
    offLu.offPossessions++;
    offLu.offPts += possPts;
    offLu.secondsPlayed += dur;
    offLu.offReb += possORB;
    offLu.tov += possTOV;

    const defTid = possTid === homeTeamId ? awayTeamId : homeTeamId;
    const defLu  = ensureLineup(defTid, possLuDef);
    defLu.defPossessions++;
    defLu.defPts += possPts;

    possTid = null;
  }

  currentQ = 0;

  for (let i = 0; i < events.length; i++) {
    const ev   = events[i];
    const sec  = clockToSec(ev.clock);
    const tid  = ev.team_id;
    const code = ev.action_code ?? '';
    const next = events[i + 1] ?? null;

    // Cambio de cuarto → cerrar posesión abierta
    if (ev.quarter !== currentQ) {
      if (possTid !== null) close(0, 'period_end', currentQ || ev.quarter);
      and1Pending = null;
      currentQ = ev.quarter;
    }

    if (!tid) continue;

    // ── DETECCIÓN DE FIN DE POSESIÓN ─────────────────────────────────────────

    // 1. SHOT MADE
    if ((ev.event_type === 'shot_made' || ev.event_type === 'shot_made_3') && tid === possTid) {
      possPts += ev.event_type === 'shot_made_3' ? 3 : 2;
      possFGA++;

      // And-1: si el siguiente evento es una falta del rival (FOLDEF) sobre este mismo equipo
      // el FT pertenece a esta posesión — NO cerrar todavía
      const isAnd1 = next !== null
        && next.event_type === 'foul'
        && next.team_id !== tid;

      if (isAnd1) {
        and1Pending = tid; // marcar que hay un FT pendiente en esta posesión
        // No cerrar — continuar acumulando
      } else {
        close(sec, 'shot_made', ev.quarter);
        and1Pending = null;
      }
      continue;
    }

    // 2. REBOTE DEFENSIVO → cierra posesión del atacante, abre para el reboteador
    if (ev.event_type === 'rebound' && ev.rebound_type === 'defensive' && tid) {
      if (possTid !== null && possTid !== tid) close(sec, 'shot_missed', ev.quarter);
      open(tid, sec, 'def_rebound', ev.quarter, ev.score_differential, i);
      and1Pending = null;
      if (ev.player_external_id) ensureLineup(tid, getSnap(tid, i)).defReb++;
      continue;
    }

    // 3. ROBO → cierra posesión del rival, abre para el que roba
    if (ev.event_type === 'steal' && tid) {
      if (possTid !== null && possTid !== tid) close(sec, 'turnover', ev.quarter);
      open(tid, sec, 'steal', ev.quarter, ev.score_differential, i);
      and1Pending = null;
      if (ev.player_external_id) ensureLineup(tid, getSnap(tid, i)).stl++;
      continue;
    }

    // 4. TURNOVER dead ball → cierra posesión del atacante
    if (ev.event_type === 'turnover' && tid === possTid) {
      possTOV++;
      close(sec, 'turnover', ev.quarter);
      and1Pending = null;
      continue;
    }

    // 5. ÚLTIMO FT ANOTADO
    if (ev.event_type === 'ft_made' && LAST_FT_MADE.has(code)) {
      if (tid === possTid || tid === and1Pending) {
        possPts++;
        possFTA++;
        close(sec, 'ft_made', ev.quarter);
        and1Pending = null;
      }
      continue;
    }

    // 6. ÚLTIMO FT FALLADO → rebote decide, no cerrar aquí
    if (ev.event_type === 'ft_missed' && LAST_FT_MISS.has(code)) {
      if (tid === possTid || tid === and1Pending) possFTA++;
      // No cerrar — el rebote siguiente lo gestiona
      continue;
    }

    // ── ABRIR POSESIÓN SI NO HAY UNA ABIERTA ─────────────────────────────────
    if (possTid === null) {
      // Inferir start_type desde el evento anterior
      let startType = 'period_start';
      if (i > 0) {
        const prev = events[i - 1];
        if (prev.event_type === 'turnover')                                   startType = 'dead_ball';
        else if (prev.event_type === 'ft_made' && LAST_FT_MADE.has(prev.action_code ?? '')) startType = 'made_basket';
        else if (prev.event_type === 'ft_missed' && LAST_FT_MISS.has(prev.action_code ?? '')) startType = 'def_rebound';
        else if (prev.event_type === 'shot_made' || prev.event_type === 'shot_made_3') startType = 'made_basket';
      }
      open(tid, sec, startType, ev.quarter, ev.score_differential, i);
    }

    // ── ACUMULAR EN POSESIÓN ACTUAL ───────────────────────────────────────────
    if (tid === possTid || (and1Pending !== null && tid === and1Pending)) {
      const isAttacker = tid === possTid || tid === and1Pending;
      if (!isAttacker) continue;

      // Tiros fallados (los anotados tienen continue arriba)
      if (ev.event_type === 'shot_missed' || ev.event_type === 'shot_missed_3') possFGA++;

      // FTs intermedios: acumular sin cerrar
      if (ev.event_type === 'ft_made'   && (MID_FT_MADE.has(code) || and1Pending === tid)) {
        possPts++; possFTA++;
      }
      if (ev.event_type === 'ft_missed' && MID_FT_MISS.has(code)) possFTA++;

      // Rebote ofensivo → extiende posesión (FIBA standard, NO nueva posesión)
      if (ev.event_type === 'rebound' && ev.rebound_type === 'offensive') {
        possORB++;
        possSecond = true;
        if (ev.player_external_id) ensureLineup(tid, getSnap(tid, i)).offReb++;
      }

      // And-1 resuelto: tras el FT del and-1, la posesión se cerró arriba
      // Si and1Pending está activo y este evento no es FT, simplemente acumulamos
      if (and1Pending !== null && ev.event_type !== 'ft_made' && ev.event_type !== 'ft_missed') {
        // Foul, foul_drawn, sub — no acumular nada especial
      }
    }
  }

  // Cerrar posesión al final del partido
  if (possTid !== null) close(0, 'period_end', currentQ);

  // ── 6. Insertar en DB ─────────────────────────────────────────────────────
  await db.execute(sql`DELETE FROM pbp_possessions       WHERE game_id = ${gameInternalId}`);
  await db.execute(sql`DELETE FROM pbp_player_game_stats WHERE game_id = ${gameInternalId}`);
  await db.execute(sql`DELETE FROM pbp_lineup_stats       WHERE game_id = ${gameInternalId}`);
  await db.execute(sql`DELETE FROM pbp_audit_log          WHERE game_id = ${gameInternalId}`);

  for (const p of possessions) {
    await db.execute(sql`
      INSERT INTO pbp_possessions (
        game_id, team_id, opponent_team_id, season_id, possession_number,
        quarter, start_time_sec, end_time_sec, duration_sec,
        start_type, end_type, points, shot_attempts, ft_attempts,
        turnovers, offensive_rebounds,
        is_transition, is_early_offense, is_halfcourt, is_second_chance,
        score_margin_start, lineup_id, opponent_lineup_id
      ) VALUES (
        ${p.gameId}, ${p.teamId}, ${p.opponentTeamId}, ${p.seasonId},
        ${p.possessionNumber}, ${p.quarter},
        ${p.startTimeSec}, ${p.endTimeSec}, ${p.durationSec},
        ${p.startType}, ${p.endType}, ${p.points},
        ${p.shotAttempts}, ${p.ftAttempts}, ${p.turnovers}, ${p.offensiveRebounds},
        ${p.isTransition}, ${p.isEarlyOffense}, ${p.isHalfcourt}, ${p.isSecondChance},
        ${p.scoreMarginStart}, ${p.lineupId}, ${p.opponentLineupId}
      )
    `);
  }

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

  for (const [, ls] of Array.from(lineupMap.entries())) {
    if (ls.offPossessions === 0 && ls.defPossessions === 0) continue;
    const offPpp = ls.offPossessions > 0 ? Math.round(ls.offPts / ls.offPossessions * 1000) / 1000 : null;
    const defPpp = ls.defPossessions > 0 ? Math.round(ls.defPts / ls.defPossessions * 1000) / 1000 : null;
    const netPpp = offPpp !== null && defPpp !== null ? Math.round((offPpp - defPpp) * 1000) / 1000 : null;
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
        off_ppp = EXCLUDED.off_ppp, def_ppp = EXCLUDED.def_ppp, net_ppp = EXCLUDED.net_ppp,
        off_reb = EXCLUDED.off_reb, def_reb = EXCLUDED.def_reb,
        tov = EXCLUDED.tov, stl = EXCLUDED.stl
    `);
  }

  // ── 7. Auditoría PBP vs Boxscore ──────────────────────────────────────────
  for (const [, extStr] of [[homeTeamId, homeExt], [awayTeamId, awayExt]] as [number, string][]) {
    const teamExtNum = Number(extStr);
    const pbpPts = possessions.filter(p => p.teamId === teamExtNum).reduce((s, p) => s + p.points, 0);
    const box    = boxRows.filter((b: any) => String(b.team_external_id) === extStr);
    const boxPts = box.reduce((s: number, b: any) => s + (Number(b.pts) || 0), 0);
    const boxReb = box.reduce((s: number, b: any) => s + (Number(b.reb) || 0), 0);
    const boxAst = box.reduce((s: number, b: any) => s + (Number(b.ast) || 0), 0);
    const boxTov = box.reduce((s: number, b: any) => s + (Number(b.tov) || 0), 0);
    const pls    = Array.from(playerMap.values()).filter(p => String(p.teamId) === extStr);
    const pbpReb = pls.reduce((s, p) => s + p.offReb + p.defReb, 0);
    const pbpAst = pls.reduce((s, p) => s + p.ast, 0);
    const pbpTov = pls.reduce((s, p) => s + p.tov, 0);
    const diff   = boxPts - pbpPts;
    const status = Math.abs(diff) <= 3 ? 'ok' : Math.abs(diff) <= 10 ? 'warning' : 'error';
    await db.execute(sql`
      INSERT INTO pbp_audit_log (
        game_id, team_external_id, season_id,
        box_pts, pbp_pts, diff_pts,
        box_reb, pbp_reb, diff_reb,
        box_ast, pbp_ast, diff_ast,
        box_tov, pbp_tov, diff_tov, status
      ) VALUES (
        ${gameInternalId}, ${extStr}, ${seasonId},
        ${boxPts}, ${pbpPts}, ${diff},
        ${boxReb}, ${pbpReb}, ${boxReb - pbpReb},
        ${boxAst}, ${pbpAst}, ${boxAst - pbpAst},
        ${boxTov}, ${pbpTov}, ${boxTov - pbpTov},
        ${status}
      )
    `);
  }

  console.log(`[possessions] game ${gameInternalId}: ${possessions.length} poss, ${playerMap.size} players, ${lineupMap.size} lineups`);
}

// ─── Procesar todos los partidos pendientes ───────────────────────────────────

export async function processAllPendingPossessions(seasonId: number): Promise<void> {
  const res = await db.execute(sql`
    SELECT sg.id, sg.season_id
    FROM stats_games sg
    WHERE sg.status = 4
      AND sg.season_id = ${seasonId}
      AND EXISTS     (SELECT 1 FROM stats_pbp        WHERE game_id = sg.id LIMIT 1)
      AND NOT EXISTS (SELECT 1 FROM pbp_possessions  WHERE game_id = sg.id LIMIT 1)
    ORDER BY sg.id ASC
  `);
  const pending: any[] = (res as any).rows ?? [];
  console.log(`[possessions] ${pending.length} games pending`);
  for (const g of pending) {
    try {
      await processPossessions(Number(g.id), Number(g.season_id ?? seasonId));
    } catch (err: any) {
      console.error(`[possessions] failed game ${g.id}:`, err.message);
    }
  }
  console.log(`[possessions] all done`);
}
