/**
 * server/possessions.ts — Procesador de posesiones PBP
 *
 * Corre en Railway. Lee stats_pbp para un partido y genera:
 *   - pbp_possessions         (1 fila por posesión)
 *   - pbp_player_game_stats   (1 fila por jugadora por partido)
 *   - pbp_lineup_stats        (1 fila por quinteto por partido)
 *   - pbp_audit_log           (diff PBP vs boxscore)
 *
 * Se invoca desde stats-ingest.ts al terminar de procesar el PBP de un partido.
 *
 * Eventos sin player_external_id (TOTLTO, TNO24S, team rebounds):
 *   → cuentan en pbp_possessions (stats de equipo) ✅
 *   → NO cuentan en pbp_player_game_stats (no hay jugadora) ✅
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
  assisted_by_external_id: number | null;
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clockToSec(clock: string): number {
  if (!clock || !clock.includes(':')) return 0;
  const parts = clock.split(':');
  const m = parseInt(parts[0], 10);
  const s = parseInt(parts[1], 10);
  return isNaN(m) || isNaN(s) ? 0 : m * 60 + s;
}

function lineupKey(players: Set<number>): string {
  return Array.from(players).sort((a, b) => a - b).join('-');
}

function quarterDurationSec(q: number): number {
  return q <= 4 ? 600 : 300; // FIBA: 10min cuartos, 5min OT
}

// Códigos de último tiro libre de la serie → cambian posesión
const LAST_FT_CODES = new Set([
  'FTH11M', 'FTH11A',
  'FTH22M', 'FTH22A',
  'FTH33M', 'FTH33A',
]);

// Códigos de tiro fallado (todos los tipos)
const SHOT_MISSED_TYPES = new Set(['shot_missed', 'shot_missed_3']);
const SHOT_MADE_TYPES   = new Set(['shot_made',   'shot_made_3']);

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

  // ── 1. Cargar datos del partido ────────────────────────────────────────────
  const gameRes = await db.execute(sql`
    SELECT id, home_team_id, away_team_id, home_score, away_score
    FROM stats_games WHERE id = ${gameInternalId} LIMIT 1
  `);
  const game = (gameRes as any).rows?.[0];
  if (!game) {
    console.error(`[possessions] game not found: ${gameInternalId}`);
    return;
  }
  const homeTeamId = Number(game.home_team_id);
  const awayTeamId = Number(game.away_team_id);

  // ── 2. Cargar eventos PBP ordenados ───────────────────────────────────────
  const pbpRes = await db.execute(sql`
    SELECT
      id, quarter, clock, sequence, event_type, action_code,
      player_external_id, team_id,
      home_score, away_score, score_differential,
      rebound_type, assisted_by_external_id
    FROM stats_pbp
    WHERE game_id = ${gameInternalId}
    ORDER BY quarter ASC, sequence ASC
  `);
  const events: PbpRow[] = ((pbpRes as any).rows ?? []).map((r: any) => ({
    id: Number(r.id),
    quarter: Number(r.quarter ?? 0),
    clock: String(r.clock ?? '0:00'),
    sequence: Number(r.sequence),
    event_type: String(r.event_type ?? 'unknown'),
    action_code: r.action_code ?? null,
    player_external_id: r.player_external_id != null ? Number(r.player_external_id) : null,
    team_id: r.team_id != null ? Number(r.team_id) : null,
    home_score: Number(r.home_score ?? 0),
    away_score: Number(r.away_score ?? 0),
    score_differential: Number(r.score_differential ?? 0),
    rebound_type: r.rebound_type ?? null,
    assisted_by_external_id: r.assisted_by_external_id != null ? Number(r.assisted_by_external_id) : null,
  }));

  if (events.length === 0) {
    console.warn(`[possessions] no events for game ${gameInternalId}`);
    return;
  }

  // ── 3. Cargar boxscore para seed de titulares y auditoría ──────────────────
  const boxRes = await db.execute(sql`
    SELECT player_external_id, team_external_id, is_start_lineup,
           pts, reb, ast, stl, blk, tov, off_reb, def_reb
    FROM stats_player_boxscores
    WHERE game_id = ${gameInternalId}
  `);
  const boxRows = (boxRes as any).rows ?? [];

  // Seed de titulares desde boxscore (is_start_lineup = true)
  // Mapeamos team_external_id → internal team_id
  const teamExtToInt: Record<string, number> = {};
  const homeExtRes = await db.execute(sql`
    SELECT external_id FROM stats_teams WHERE id = ${homeTeamId} LIMIT 1
  `);
  const awayExtRes = await db.execute(sql`
    SELECT external_id FROM stats_teams WHERE id = ${awayTeamId} LIMIT 1
  `);
  const homeExt = String((homeExtRes as any).rows?.[0]?.external_id ?? '');
  const awayExt = String((awayExtRes as any).rows?.[0]?.external_id ?? '');
  teamExtToInt[homeExt] = homeTeamId;
  teamExtToInt[awayExt] = awayTeamId;

  // Quintetos iniciales desde boxscore
  const startersByTeam: Map<number, Set<number>> = new Map([
    [homeTeamId, new Set<number>()],
    [awayTeamId, new Set<number>()],
  ]);
  for (const b of boxRows) {
    if (b.is_start_lineup && b.player_external_id) {
      const tid = teamExtToInt[String(b.team_external_id)];
      if (tid) startersByTeam.get(tid)?.add(Number(b.player_external_id));
    }
  }

  // ── 4. Estado del procesador ───────────────────────────────────────────────

  // Quintetos en pista actualmente
  const lineups: Map<number, Set<number>> = new Map([
    [homeTeamId, new Set(startersByTeam.get(homeTeamId))],
    [awayTeamId, new Set(startersByTeam.get(awayTeamId))],
  ]);

  // Stats por jugadora
  const playerMap: Map<string, PlayerStats> = new Map();
  // Inicializar titulares
  startersByTeam.forEach((starters, tid) => {
    Array.from(starters).forEach((pid) => {
      const key = String(pid);
      playerMap.set(key, emptyPlayer(gameInternalId, key, tid, seasonId, true));
    });
  });

  // Tiempo en pista por jugadora: key → { teamId, entrySec, quarter }
  const onCourtSince: Map<string, { teamId: number; entrySec: number; quarter: number }> = new Map();
  // Seed: titulares desde inicio del Q1 (600s)
  startersByTeam.forEach((starters, tid) => {
    Array.from(starters).forEach((pid) => {
      onCourtSince.set(String(pid), { teamId: tid, entrySec: 600, quarter: 1 });
    });
  });

  // Lineup stats
  const lineupMap: Map<string, LineupStats> = new Map();
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
  const possessions: Possession[] = [];
  let possNumber = 0;
  let curTeamId: number | null = null;
  let possStartSec = 600;
  let possStartType = 'period_start';
  let possScoreMarginStart = 0;
  let possStartLineupId = '';
  let possStartOppLineupId = '';
  let possPoints = 0;
  let possShotAttempts = 0;
  let possFtAttempts = 0;
  let possTurnovers = 0;
  let possOffReb = 0;
  let isSecondChance = false;
  let currentQuarter = 1;

  // ── Helpers de posesión ───────────────────────────────────────────────────
  function closePoss(endSec: number, endType: string, quarter: number): void {
    if (curTeamId === null) return;
    const dur = Math.max(0, possStartSec - endSec);
    possNumber++;
    const p: Possession = {
      gameId: gameInternalId, seasonId,
      teamId: curTeamId,
      opponentTeamId: curTeamId === homeTeamId ? awayTeamId : homeTeamId,
      possessionNumber: possNumber,
      quarter,
      startTimeSec: possStartSec,
      endTimeSec: endSec,
      durationSec: dur,
      startType: possStartType,
      endType,
      points: possPoints,
      shotAttempts: possShotAttempts,
      ftAttempts: possFtAttempts,
      turnovers: possTurnovers,
      offensiveRebounds: possOffReb,
      isTransition:   dur <= 8,
      isEarlyOffense: dur > 8 && dur <= 14,
      isHalfcourt:    dur > 14,
      isSecondChance,
      scoreMarginStart: possScoreMarginStart,
      lineupId: possStartLineupId,
      opponentLineupId: possStartOppLineupId,
    };
    possessions.push(p);

    // Lineup stats
    const offLu = ensureLineup(curTeamId, possStartLineupId);
    offLu.offPossessions++;
    offLu.offPts += possPoints;
    offLu.secondsPlayed += dur;
    offLu.offReb += possOffReb;
    offLu.tov += possTurnovers;

    const defTeamId = curTeamId === homeTeamId ? awayTeamId : homeTeamId;
    const defLu = ensureLineup(defTeamId, possStartOppLineupId);
    defLu.defPossessions++;
    defLu.defPts += possPoints;
  }

  function startPoss(
    teamId: number, startSec: number, startType: string,
    quarter: number, scoreDiff: number,
  ): void {
    curTeamId = teamId;
    possStartSec = startSec;
    possStartType = startType;
    possScoreMarginStart = teamId === homeTeamId ? scoreDiff : -scoreDiff;
    possPoints = possShotAttempts = possFtAttempts = possTurnovers = possOffReb = 0;
    isSecondChance = false;
    possStartLineupId    = lineupKey(lineups.get(teamId)   ?? new Set());
    const opp            = teamId === homeTeamId ? awayTeamId : homeTeamId;
    possStartOppLineupId = lineupKey(lineups.get(opp)      ?? new Set());
  }

  function flushMinutes(pkey: string, exitSec: number, exitQuarter: number): void {
    const entry = onCourtSince.get(pkey);
    if (!entry) return;
    const entrySec = entry.quarter === exitQuarter
      ? entry.entrySec
      : quarterDurationSec(entry.quarter);
    const secs = Math.max(0, entrySec - exitSec);
    const ps = playerMap.get(pkey);
    if (ps) ps.secondsPlayed += secs;
    onCourtSince.delete(pkey);
  }

  // ── 5. Bucle principal ────────────────────────────────────────────────────
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const sec = clockToSec(ev.clock);
    const pid = ev.player_external_id;
    const tid = ev.team_id;
    const pkey = pid != null ? String(pid) : null;

    // Cambio de cuarto
    if (ev.quarter !== currentQuarter) {
      // Cerrar stints abiertos del cuarto anterior
      Array.from(onCourtSince.entries()).forEach(([pk, entry]) => {
        if (entry.quarter < ev.quarter) {
          const ps = playerMap.get(pk);
          if (ps) ps.secondsPlayed += Math.max(0, entry.entrySec);
          onCourtSince.set(pk, {
            ...entry,
            entrySec: quarterDurationSec(ev.quarter),
            quarter: ev.quarter,
          });
        }
      });
      // Cerrar posesión abierta
      if (curTeamId !== null) {
        closePoss(0, 'period_end', currentQuarter);
        curTeamId = null;
      }
      currentQuarter = ev.quarter;
    }

    // ── Sub_in / Sub_out ──────────────────────────────────────────────────
    if (ev.event_type === 'sub_in' && tid && pid && pkey) {
      if (!lineups.has(tid)) lineups.set(tid, new Set());
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

    // ── Stats individuales (solo si hay player_external_id) ───────────────
    if (pkey && tid) {
      if (!playerMap.has(pkey)) {
        playerMap.set(pkey, emptyPlayer(gameInternalId, pkey, tid, seasonId, false));
      }
      const ps = playerMap.get(pkey)!;
      switch (ev.event_type) {
        case 'shot_made':    ps.fgm++; ps.fga++; ps.pts += 2; break;
        case 'shot_made_3':  ps.fgm++; ps.fga++; ps.fg3m++; ps.fg3a++; ps.pts += 3; break;
        case 'shot_missed':  ps.fga++; break;
        case 'shot_missed_3': ps.fga++; ps.fg3a++; break;
        case 'ft_made':      ps.ftm++; ps.fta++; ps.pts++; break;
        case 'ft_missed':    ps.fta++; break;
        case 'rebound':
          if (ev.rebound_type === 'offensive') { ps.offReb++; }
          else if (ev.rebound_type === 'defensive') { ps.defReb++; }
          break;
        case 'assist':   ps.ast++; break;
        case 'steal':    ps.stl++; break;
        case 'block':    ps.blk++; break;
        case 'turnover': ps.tov++; break;
        case 'foul':     ps.fouls++; break;
      }
    }

    // ── Acumular en posesión actual ────────────────────────────────────────
    if (curTeamId !== null && tid === curTeamId) {
      if (SHOT_MADE_TYPES.has(ev.event_type)) {
        possPoints += ev.event_type === 'shot_made_3' ? 3 : 2;
        possShotAttempts++;
      }
      if (SHOT_MISSED_TYPES.has(ev.event_type)) { possShotAttempts++; }
      if (ev.event_type === 'ft_made')   { possPoints++; possFtAttempts++; }
      if (ev.event_type === 'ft_missed') { possFtAttempts++; }
      if (ev.event_type === 'turnover')  { possTurnovers++; }
      if (ev.event_type === 'rebound' && ev.rebound_type === 'offensive') {
        possOffReb++;
        isSecondChance = true;
      }
    }

    // Steal stats de equipo en lineup
    if (ev.event_type === 'steal' && tid) {
      const luId = lineupKey(lineups.get(tid) ?? new Set());
      ensureLineup(tid, luId).stl++;
    }
    // Def rebound en lineup
    if (ev.event_type === 'rebound' && ev.rebound_type === 'defensive' && tid) {
      const luId = lineupKey(lineups.get(tid) ?? new Set());
      ensureLineup(tid, luId).defReb++;
    }
    // Off rebound en lineup
    if (ev.event_type === 'rebound' && ev.rebound_type === 'offensive' && tid) {
      const luId = lineupKey(lineups.get(tid) ?? new Set());
      ensureLineup(tid, luId).offReb++;
    }

    // ── Lógica de cambio de posesión ──────────────────────────────────────

    // Tiro anotado → cierra posesión del atacante, inicia rival
    if (SHOT_MADE_TYPES.has(ev.event_type) && tid) {
      if (curTeamId === tid) closePoss(sec, 'shot_made', ev.quarter);
      const rival = tid === homeTeamId ? awayTeamId : homeTeamId;
      startPoss(rival, sec, 'made_basket', ev.quarter, ev.score_differential);
    }

    // Rebote defensivo → cierra posesión del rival, inicia equipo reboteador
    if (ev.event_type === 'rebound' && ev.rebound_type === 'defensive' && tid) {
      if (curTeamId !== null && curTeamId !== tid) closePoss(sec, 'shot_missed', ev.quarter);
      startPoss(tid, sec, 'def_rebound', ev.quarter, ev.score_differential);
    }

    // Robo → cierra posesión del rival, inicia equipo que roba
    if (ev.event_type === 'steal' && tid) {
      if (curTeamId !== null && curTeamId !== tid) closePoss(sec, 'turnover', ev.quarter);
      startPoss(tid, sec, 'steal', ev.quarter, ev.score_differential);
    }

    // TOV sin robo (dead ball: 24s, equipo, etc.) → cierra, inicia rival
    if (ev.event_type === 'turnover' && tid && curTeamId === tid) {
      const code = ev.action_code ?? '';
      const isDeadBall = !code.startsWith('STEAL');
      if (isDeadBall) {
        closePoss(sec, 'turnover', ev.quarter);
        const rival = tid === homeTeamId ? awayTeamId : homeTeamId;
        startPoss(rival, sec, 'dead_ball', ev.quarter, ev.score_differential);
      }
    }

    // Último FT → cambia posesión
    if (LAST_FT_CODES.has(ev.action_code ?? '') && tid) {
      if (ev.event_type === 'ft_made') {
        if (curTeamId === tid) closePoss(sec, 'ft_made', ev.quarter);
        const rival = tid === homeTeamId ? awayTeamId : homeTeamId;
        startPoss(rival, sec, 'made_basket', ev.quarter, ev.score_differential);
      }
      // ft_missed → el rebote (siguiente evento) inicia la siguiente posesión
    }

    // Inicio del partido o cuarto sin posesión abierta
    if (curTeamId === null && tid && ev.event_type !== 'sub_in' && ev.event_type !== 'sub_out') {
      startPoss(tid, sec, 'period_start', ev.quarter, ev.score_differential);
    }
  }

  // Cerrar al final del partido
  if (curTeamId !== null) closePoss(0, 'period_end', currentQuarter);
  Array.from(onCourtSince.keys()).forEach((pkey) => flushMinutes(pkey, 0, currentQuarter));

  // ── 6. Materializar en Supabase ───────────────────────────────────────────

  // Limpiar datos previos si los hay (re-procesamiento)
  await db.execute(sql`DELETE FROM pbp_possessions      WHERE game_id = ${gameInternalId}`);
  await db.execute(sql`DELETE FROM pbp_player_game_stats WHERE game_id = ${gameInternalId}`);
  await db.execute(sql`DELETE FROM pbp_lineup_stats      WHERE game_id = ${gameInternalId}`);
  await db.execute(sql`DELETE FROM pbp_audit_log         WHERE game_id = ${gameInternalId}`);

  // Insertar possessions en lotes de 100
  const BATCH = 100;
  for (let i = 0; i < possessions.length; i += BATCH) {
    const batch = possessions.slice(i, i + BATCH);
    for (const p of batch) {
      await db.execute(sql`
        INSERT INTO pbp_possessions (
          game_id, team_id, opponent_team_id, season_id, possession_number,
          quarter, start_time_sec, end_time_sec, duration_sec,
          start_type, end_type,
          points, shot_attempts, ft_attempts, turnovers, offensive_rebounds,
          is_transition, is_early_offense, is_halfcourt, is_second_chance,
          score_margin_start, lineup_id, opponent_lineup_id
        ) VALUES (
          ${p.gameId}, ${p.teamId}, ${p.opponentTeamId}, ${p.seasonId},
          ${p.possessionNumber}, ${p.quarter},
          ${p.startTimeSec}, ${p.endTimeSec}, ${p.durationSec},
          ${p.startType}, ${p.endType},
          ${p.points}, ${p.shotAttempts}, ${p.ftAttempts},
          ${p.turnovers}, ${p.offensiveRebounds},
          ${p.isTransition}, ${p.isEarlyOffense}, ${p.isHalfcourt}, ${p.isSecondChance},
          ${p.scoreMarginStart}, ${p.lineupId}, ${p.opponentLineupId}
        )
      `);
    }
  }

  // Insertar player game stats
  for (const ps of Array.from(playerMap.values())) {
    await db.execute(sql`
      INSERT INTO pbp_player_game_stats (
        game_id, player_external_id, team_id, season_id,
        seconds_played, fgm, fga, fg3m, fg3a, ftm, fta, pts,
        off_reb, def_reb, reb, ast, stl, blk, tov, fouls,
        plus_minus, is_starter
      ) VALUES (
        ${ps.gameId}, ${ps.playerExternalId}, ${ps.teamId}, ${ps.seasonId},
        ${ps.secondsPlayed}, ${ps.fgm}, ${ps.fga},
        ${ps.fg3m}, ${ps.fg3a}, ${ps.ftm}, ${ps.fta}, ${ps.pts},
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

  // Insertar lineup stats
  for (const ls of Array.from(lineupMap.values())) {
    if (ls.offPossessions === 0 && ls.defPossessions === 0) continue;
    const offPpp = ls.offPossessions > 0
      ? Math.round(ls.offPts / ls.offPossessions * 1000) / 1000 : null;
    const defPpp = ls.defPossessions > 0
      ? Math.round(ls.defPts / ls.defPossessions * 1000) / 1000 : null;
    const netPpp = offPpp !== null && defPpp !== null
      ? Math.round((offPpp - defPpp) * 1000) / 1000 : null;

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
        seconds_played   = EXCLUDED.seconds_played,
        off_possessions  = EXCLUDED.off_possessions,
        def_possessions  = EXCLUDED.def_possessions,
        off_pts = EXCLUDED.off_pts, def_pts = EXCLUDED.def_pts,
        off_ppp = EXCLUDED.off_ppp, def_ppp = EXCLUDED.def_ppp,
        net_ppp = EXCLUDED.net_ppp,
        off_reb = EXCLUDED.off_reb, def_reb = EXCLUDED.def_reb,
        tov = EXCLUDED.tov, stl = EXCLUDED.stl
    `);
  }

  // ── 7. Auditoría PBP vs Boxscore ──────────────────────────────────────────
  const teamIds = [homeTeamId, awayTeamId];
  for (const tid of teamIds) {
    const extRes = await db.execute(sql`
      SELECT external_id FROM stats_teams WHERE id = ${tid} LIMIT 1
    `);
    const ext = String((extRes as any).rows?.[0]?.external_id ?? '');

    // PBP pts = suma de posesiones del equipo
    const pbpPts = possessions
      .filter(p => p.teamId === tid)
      .reduce((s, p) => s + p.points, 0);

    // Box pts = suma del boxscore
    const boxForTeam = boxRows.filter((b: any) => String(b.team_external_id) === ext);
    const boxPts = boxForTeam.reduce((s: number, b: any) => s + (Number(b.pts) || 0), 0);
    const boxReb = boxForTeam.reduce((s: number, b: any) => s + (Number(b.reb) || 0), 0);
    const boxAst = boxForTeam.reduce((s: number, b: any) => s + (Number(b.ast) || 0), 0);
    const boxTov = boxForTeam.reduce((s: number, b: any) => s + (Number(b.tov) || 0), 0);

    // PBP stats individuales del equipo
    const teamPlayers = Array.from(playerMap.values()).filter(p => p.teamId === tid);
    const pbpReb = teamPlayers.reduce((s, p) => s + p.offReb + p.defReb, 0);
    const pbpAst = teamPlayers.reduce((s, p) => s + p.ast, 0);
    const pbpTov = teamPlayers.reduce((s, p) => s + p.tov, 0);

    const diffPts = boxPts - pbpPts;
    const status  = Math.abs(diffPts) <= 3 ? 'ok'
                  : Math.abs(diffPts) <= 10 ? 'warning' : 'error';

    await db.execute(sql`
      INSERT INTO pbp_audit_log (
        game_id, team_external_id, season_id,
        box_pts, pbp_pts, diff_pts,
        box_reb, pbp_reb, diff_reb,
        box_ast, pbp_ast, diff_ast,
        box_tov, pbp_tov, diff_tov,
        status
      ) VALUES (
        ${gameInternalId}, ${ext}, ${seasonId},
        ${boxPts}, ${pbpPts}, ${diffPts},
        ${boxReb}, ${pbpReb}, ${boxReb - pbpReb},
        ${boxAst}, ${pbpAst}, ${boxAst - pbpAst},
        ${boxTov}, ${pbpTov}, ${boxTov - pbpTov},
        ${status}
      )
    `);
  }

  console.log(`[possessions] game ${gameInternalId}: ${possessions.length} poss, ${playerMap.size} players, ${lineupMap.size} lineups`);
}

// ─── Procesar todos los partidos pendientes ────────────────────────────────────

export async function processAllPendingPossessions(seasonId: number): Promise<void> {
  // Partidos con PBP pero sin possessions procesadas
  const res = await db.execute(sql`
    SELECT DISTINCT sg.id, sg.season_id
    FROM stats_games sg
    WHERE sg.status = 4
      AND sg.season_id = ${seasonId}
      AND EXISTS (
        SELECT 1 FROM stats_pbp WHERE game_id = sg.id LIMIT 1
      )
      AND NOT EXISTS (
        SELECT 1 FROM pbp_possessions WHERE game_id = sg.id LIMIT 1
      )
    ORDER BY sg.id ASC
  `);
  const pending = (res as any).rows ?? [];
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
