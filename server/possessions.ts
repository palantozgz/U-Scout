/**
 * server/possessions.ts — Procesador de posesiones PBP v2
 *
 * Corre en Railway. Lee stats_pbp para un partido y genera:
 *   - pbp_possessions         (1 fila por posesión)
 *   - pbp_player_game_stats   (1 fila por jugadora por partido)
 *   - pbp_lineup_stats        (1 fila por quinteto por partido)
 *   - pbp_audit_log           (diff PBP vs boxscore)
 *
 * Eventos sin player_external_id (TOTLTO, TNO24S, team rebounds):
 *   → cuentan en pbp_possessions (stats de equipo) ✅
 *   → NO cuentan en pbp_player_game_stats ✅
 *
 * Algoritmo de posesiones:
 *   Una posesión es una secuencia continua de eventos del mismo equipo
 *   que termina cuando: (1) tiro anotado, (2) rebote defensivo del rival,
 *   (3) robo del rival, (4) TOV dead ball, (5) último FT convertido,
 *   (6) fin de período.
 *   Los rebotes ofensivos EXTIENDEN la posesión (no la terminan).
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
  const arr: number[] = [];
  players.forEach(p => arr.push(p));
  return arr.sort((a, b) => a - b).join('-');
}

function quarterDurationSec(q: number): number {
  return q <= 4 ? 600 : 300;
}

// Último FT de serie → cambia posesión
const LAST_FT_MADE_CODES = new Set(['FTH11M', 'FTH22M', 'FTH33M']);
const LAST_FT_MISS_CODES = new Set(['FTH11A', 'FTH22A', 'FTH33A']);

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

  // ── 1. Cargar datos del partido ─────────────────────────────────────────────
  const gameRes = await db.execute(sql`
    SELECT id, home_team_id, away_team_id FROM stats_games
    WHERE id = ${gameInternalId} LIMIT 1
  `);
  const gameRow = (gameRes as any).rows?.[0];
  if (!gameRow) {
    console.error(`[possessions] game not found: ${gameInternalId}`);
    return;
  }
  const homeTeamId = Number(gameRow.home_team_id);
  const awayTeamId = Number(gameRow.away_team_id);

  // ── 2. Cargar eventos PBP ordenados ────────────────────────────────────────
  const pbpRes = await db.execute(sql`
    SELECT id, quarter, clock, sequence, event_type, action_code,
           player_external_id, team_id,
           home_score, away_score, score_differential,
           rebound_type, assisted_by_external_id
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
    assisted_by_external_id: r.assisted_by_external_id != null ? Number(r.assisted_by_external_id) : null,
  }));

  if (events.length === 0) {
    console.warn(`[possessions] no events for game ${gameInternalId}`);
    return;
  }

  // ── 3. Boxscore para seed titulares + auditoría ────────────────────────────
  const boxRes = await db.execute(sql`
    SELECT player_external_id, team_external_id, is_start_lineup,
           pts, reb, ast, stl, blk, tov, off_reb, def_reb
    FROM stats_player_boxscores WHERE game_id = ${gameInternalId}
  `);
  const boxRows: any[] = (boxRes as any).rows ?? [];

  // Mapear external_id → internal team_id
  const homeExtRes = await db.execute(sql`SELECT external_id FROM stats_teams WHERE id = ${homeTeamId} LIMIT 1`);
  const awayExtRes = await db.execute(sql`SELECT external_id FROM stats_teams WHERE id = ${awayTeamId} LIMIT 1`);
  const homeExt = String((homeExtRes as any).rows?.[0]?.external_id ?? '');
  const awayExt = String((awayExtRes as any).rows?.[0]?.external_id ?? '');
  const extToInt: Record<string, number> = { [homeExt]: homeTeamId, [awayExt]: awayTeamId };

  // Titulares desde boxscore
  const startersByTeam: Map<number, Set<number>> = new Map([
    [homeTeamId, new Set<number>()], [awayTeamId, new Set<number>()],
  ]);
  for (const b of boxRows) {
    if (b.is_start_lineup && b.player_external_id) {
      const tid = extToInt[String(b.team_external_id)];
      if (tid) startersByTeam.get(tid)?.add(Number(b.player_external_id));
    }
  }

  // ── 4. Primera pasada: lineup tracking + stats individuales ───────────────
  // Quintetos en pista: team_id → Set<player_external_id>
  const lineups: Map<number, Set<number>> = new Map([
    [homeTeamId, new Set(startersByTeam.get(homeTeamId))],
    [awayTeamId, new Set(startersByTeam.get(awayTeamId))],
  ]);

  // Stats por jugadora
  const playerMap: Map<string, PlayerStats> = new Map();
  const onCourtSince: Map<string, { teamId: number; entrySec: number; quarter: number }> = new Map();

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
    const entrySec = entry.quarter === exitQuarter ? entry.entrySec : quarterDurationSec(entry.quarter);
    const secs = Math.max(0, entrySec - exitSec);
    const ps = playerMap.get(pkey);
    if (ps) ps.secondsPlayed += secs;
    onCourtSince.delete(pkey);
  }

  // Guardar lineup en cada evento (para saber qué quinteto estaba en cada momento)
  const eventLineupHome: string[] = new Array(events.length).fill('');
  const eventLineupAway: string[] = new Array(events.length).fill('');
  let currentQuarter = 1;

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const sec = clockToSec(ev.clock);
    const pid = ev.player_external_id;
    const tid = ev.team_id;
    const pkey = pid != null ? String(pid) : null;

    // Cambio de cuarto → cerrar stints del cuarto anterior
    if (ev.quarter !== currentQuarter) {
      for (const [pk, entry] of Array.from(onCourtSince.entries())) {
        if (entry.quarter < ev.quarter) {
          const ps = playerMap.get(pk);
          if (ps) ps.secondsPlayed += Math.max(0, entry.entrySec);
          onCourtSince.set(pk, { ...entry, entrySec: quarterDurationSec(ev.quarter), quarter: ev.quarter });
        }
      }
      currentQuarter = ev.quarter;
    }

    // Sub_in / Sub_out
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

    // Snapshot del lineup en este evento
    eventLineupHome[i] = lineupKey(lineups.get(homeTeamId) ?? new Set());
    eventLineupAway[i] = lineupKey(lineups.get(awayTeamId) ?? new Set());

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
    flushMinutes(pkey, 0, currentQuarter);
  }

  // ── 5. Segunda pasada: detectar posesiones ─────────────────────────────────
  // Estado de la máquina de posesiones
  const possessions: Possession[] = [];
  const lineupStatsMap: Map<string, LineupStats> = new Map();

  function ensureLineup(teamId: number, luId: string): LineupStats {
    const k = `${teamId}:${luId}`;
    if (!lineupStatsMap.has(k)) {
      lineupStatsMap.set(k, {
        gameId: gameInternalId, teamId, seasonId, lineupId: luId,
        secondsPlayed: 0, offPossessions: 0, defPossessions: 0,
        offPts: 0, defPts: 0, offReb: 0, defReb: 0, tov: 0, stl: 0,
      });
    }
    return lineupStatsMap.get(k)!;
  }

  // Una posesión se construye acumulando eventos hasta encontrar un fin
  let possTeamId: number | null = null;
  let possStartSec = 600;
  let possStartType = 'period_start';
  let possScoreMarginStart = 0;
  let possStartLineupId = '';
  let possStartOppLineupId = '';
  let possPoints = 0;
  let possFGA = 0;
  let possFTA = 0;
  let possTOV = 0;
  let possORB = 0;
  let possIsSecondChance = false;
  let possQuarter = 1;
  let possNumber = 0;

  function getLineupForTeam(teamId: number, evIdx: number): string {
    if (teamId === homeTeamId) return eventLineupHome[evIdx] ?? '';
    return eventLineupAway[evIdx] ?? '';
  }

  function openPossession(
    teamId: number, startSec: number, startType: string,
    quarter: number, scoreDiff: number, evIdx: number,
  ): void {
    possTeamId = teamId;
    possStartSec = startSec;
    possStartType = startType;
    possQuarter = quarter;
    possScoreMarginStart = teamId === homeTeamId ? scoreDiff : -scoreDiff;
    possPoints = possFGA = possFTA = possTOV = possORB = 0;
    possIsSecondChance = false;
    possStartLineupId    = getLineupForTeam(teamId, evIdx);
    const opp            = teamId === homeTeamId ? awayTeamId : homeTeamId;
    possStartOppLineupId = getLineupForTeam(opp, evIdx);
  }

  function closePossession(endSec: number, endType: string, quarter: number): void {
    if (possTeamId === null) return;
    const dur = Math.max(0, possStartSec - endSec);
    possNumber++;

    const p: Possession = {
      gameId: gameInternalId, seasonId,
      teamId: possTeamId,
      opponentTeamId: possTeamId === homeTeamId ? awayTeamId : homeTeamId,
      possessionNumber: possNumber,
      quarter,
      startTimeSec: possStartSec,
      endTimeSec: endSec,
      durationSec: dur,
      startType: possStartType,
      endType,
      points: possPoints,
      shotAttempts: possFGA,
      ftAttempts: possFTA,
      turnovers: possTOV,
      offensiveRebounds: possORB,
      isTransition:   dur <= 8,
      isEarlyOffense: dur > 8 && dur <= 14,
      isHalfcourt:    dur > 14,
      isSecondChance: possIsSecondChance,
      scoreMarginStart: possScoreMarginStart,
      lineupId: possStartLineupId,
      opponentLineupId: possStartOppLineupId,
    };
    possessions.push(p);

    // Lineup stats ofensivas
    const offLu = ensureLineup(possTeamId, possStartLineupId);
    offLu.offPossessions++;
    offLu.offPts += possPoints;
    offLu.secondsPlayed += dur;
    offLu.offReb += possORB;
    offLu.tov += possTOV;

    // Lineup stats defensivas
    const defTeamId = possTeamId === homeTeamId ? awayTeamId : homeTeamId;
    const defLu = ensureLineup(defTeamId, possStartOppLineupId);
    defLu.defPossessions++;
    defLu.defPts += possPoints;

    possTeamId = null;
  }

  // Bucle principal de detección de posesiones
  currentQuarter = 0;

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const sec = clockToSec(ev.clock);
    const tid = ev.team_id;
    const code = ev.action_code ?? '';

    // Nuevo cuarto → cerrar posesión abierta
    if (ev.quarter !== currentQuarter) {
      if (possTeamId !== null) {
        closePossession(0, 'period_end', currentQuarter || ev.quarter);
      }
      currentQuarter = ev.quarter;
      // La primera posesión del cuarto se abrirá con el primer evento con team_id
    }

    // Saltar eventos sin team_id (jumpballs genéricos, etc.)
    if (!tid) continue;

    // Si no hay posesión abierta, abrir con este equipo
    if (possTeamId === null) {
      // Determinar start_type según el evento anterior
      let startType = 'period_start';
      if (i > 0) {
        const prev = events[i - 1];
        if (prev.event_type === 'rebound' && prev.rebound_type === 'defensive') startType = 'def_rebound';
        else if (prev.event_type === 'steal') startType = 'steal';
        else if (prev.event_type === 'shot_made' || prev.event_type === 'shot_made_3') startType = 'made_basket';
        else if (prev.event_type === 'ft_made' && LAST_FT_MADE_CODES.has(prev.action_code ?? '')) startType = 'made_basket';
        else if (prev.event_type === 'turnover') startType = 'dead_ball';
      }
      openPossession(tid, sec, startType, ev.quarter, ev.score_differential, i);
    }

    // Acumular stats de posesión solo si es el equipo atacante
    if (tid === possTeamId) {
      if (ev.event_type === 'shot_made' || ev.event_type === 'shot_made_3') {
        possPoints += ev.event_type === 'shot_made_3' ? 3 : 2;
        possFGA++;
      }
      if (ev.event_type === 'shot_missed' || ev.event_type === 'shot_missed_3') {
        possFGA++;
      }
      if (ev.event_type === 'ft_made') { possPoints++; possFTA++; }
      if (ev.event_type === 'ft_missed') { possFTA++; }
      if (ev.event_type === 'turnover') { possTOV++; }
      if (ev.event_type === 'rebound' && ev.rebound_type === 'offensive') {
        possORB++;
        possIsSecondChance = true;
      }
    }

    // Lineup stl/reb stats
    if (ev.event_type === 'steal' && tid) {
      ensureLineup(tid, getLineupForTeam(tid, i)).stl++;
    }
    if (ev.event_type === 'rebound' && ev.rebound_type === 'defensive' && tid) {
      ensureLineup(tid, getLineupForTeam(tid, i)).defReb++;
    }
    if (ev.event_type === 'rebound' && ev.rebound_type === 'offensive' && tid) {
      ensureLineup(tid, getLineupForTeam(tid, i)).offReb++;
    }

    // ── Fin de posesión ──────────────────────────────────────────────────────

    // Tiro anotado → cierra posesión del atacante
    if ((ev.event_type === 'shot_made' || ev.event_type === 'shot_made_3') && tid === possTeamId) {
      closePossession(sec, 'shot_made', ev.quarter);
      // La siguiente posesión se abrirá automáticamente con el rival en el próximo evento
    }

    // Rebote defensivo → cierra posesión del rival (si está abierta para el rival)
    if (ev.event_type === 'rebound' && ev.rebound_type === 'defensive' && tid) {
      if (possTeamId !== null && possTeamId !== tid) {
        closePossession(sec, 'shot_missed', ev.quarter);
      }
      // Abre posesión para el equipo reboteador
      openPossession(tid, sec, 'def_rebound', ev.quarter, ev.score_differential, i);
    }

    // Robo → cierra posesión del rival
    if (ev.event_type === 'steal' && tid) {
      if (possTeamId !== null && possTeamId !== tid) {
        closePossession(sec, 'turnover', ev.quarter);
      }
      openPossession(tid, sec, 'steal', ev.quarter, ev.score_differential, i);
    }

    // TOV sin robo (dead ball) → cierra posesión del atacante
    if (ev.event_type === 'turnover' && tid === possTeamId) {
      const isDeadBall = code !== 'STEAL' && !code.startsWith('STEAL');
      if (isDeadBall) {
        closePossession(sec, 'turnover', ev.quarter);
        // La siguiente posesión se abrirá con el rival en el próximo evento
      }
    }

    // Último FT convertido → cierra posesión
    if (ev.event_type === 'ft_made' && LAST_FT_MADE_CODES.has(code) && tid === possTeamId) {
      closePossession(sec, 'ft_made', ev.quarter);
    }

    // Último FT fallado → el rebote siguiente manejará el cambio de posesión
    // (no hacemos nada aquí — el rebound event lo cierra)
  }

  // Cerrar posesión al final del partido
  if (possTeamId !== null) {
    closePossession(0, 'period_end', currentQuarter);
  }

  // ── 6. Limpiar datos previos e insertar ────────────────────────────────────
  await db.execute(sql`DELETE FROM pbp_possessions       WHERE game_id = ${gameInternalId}`);
  await db.execute(sql`DELETE FROM pbp_player_game_stats WHERE game_id = ${gameInternalId}`);
  await db.execute(sql`DELETE FROM pbp_lineup_stats       WHERE game_id = ${gameInternalId}`);
  await db.execute(sql`DELETE FROM pbp_audit_log          WHERE game_id = ${gameInternalId}`);

  // Insertar possessions (en lotes para evitar timeouts)
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

  // Insertar player game stats
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

  // Insertar lineup stats
  for (const [, ls] of Array.from(lineupStatsMap.entries())) {
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
        seconds_played = EXCLUDED.seconds_played,
        off_possessions = EXCLUDED.off_possessions,
        def_possessions = EXCLUDED.def_possessions,
        off_pts = EXCLUDED.off_pts, def_pts = EXCLUDED.def_pts,
        off_ppp = EXCLUDED.off_ppp, def_ppp = EXCLUDED.def_ppp, net_ppp = EXCLUDED.net_ppp,
        off_reb = EXCLUDED.off_reb, def_reb = EXCLUDED.def_reb,
        tov = EXCLUDED.tov, stl = EXCLUDED.stl
    `);
  }

  // ── 7. Auditoría ──────────────────────────────────────────────────────────
  for (const [teamInternalId, extStr] of [[homeTeamId, homeExt], [awayTeamId, awayExt]] as [number, string][]) {
    const pbpPts = possessions
      .filter(p => p.teamId === teamInternalId)
      .reduce((s, p) => s + p.points, 0);
    const boxForTeam = boxRows.filter((b: any) => String(b.team_external_id) === extStr);
    const boxPts = boxForTeam.reduce((s: number, b: any) => s + (Number(b.pts) || 0), 0);
    const boxReb = boxForTeam.reduce((s: number, b: any) => s + (Number(b.reb) || 0), 0);
    const boxAst = boxForTeam.reduce((s: number, b: any) => s + (Number(b.ast) || 0), 0);
    const boxTov = boxForTeam.reduce((s: number, b: any) => s + (Number(b.tov) || 0), 0);
    const teamPlayers = Array.from(playerMap.values()).filter(p => p.teamId === teamInternalId);
    const pbpReb = teamPlayers.reduce((s, p) => s + p.offReb + p.defReb, 0);
    const pbpAst = teamPlayers.reduce((s, p) => s + p.ast, 0);
    const pbpTov = teamPlayers.reduce((s, p) => s + p.tov, 0);
    const diffPts = boxPts - pbpPts;
    const status = Math.abs(diffPts) <= 3 ? 'ok' : Math.abs(diffPts) <= 10 ? 'warning' : 'error';
    await db.execute(sql`
      INSERT INTO pbp_audit_log (
        game_id, team_external_id, season_id,
        box_pts, pbp_pts, diff_pts,
        box_reb, pbp_reb, diff_reb,
        box_ast, pbp_ast, diff_ast,
        box_tov, pbp_tov, diff_tov, status
      ) VALUES (
        ${gameInternalId}, ${extStr}, ${seasonId},
        ${boxPts}, ${pbpPts}, ${diffPts},
        ${boxReb}, ${pbpReb}, ${boxReb - pbpReb},
        ${boxAst}, ${pbpAst}, ${boxAst - pbpAst},
        ${boxTov}, ${pbpTov}, ${boxTov - pbpTov},
        ${status}
      )
    `);
  }

  console.log(`[possessions] game ${gameInternalId}: ${possessions.length} poss, ${playerMap.size} players, ${lineupStatsMap.size} lineups`);
}

// ─── Procesar todos los partidos pendientes ───────────────────────────────────

export async function processAllPendingPossessions(seasonId: number): Promise<void> {
  const res = await db.execute(sql`
    SELECT sg.id, sg.season_id
    FROM stats_games sg
    WHERE sg.status = 4
      AND sg.season_id = ${seasonId}
      AND EXISTS (SELECT 1 FROM stats_pbp WHERE game_id = sg.id LIMIT 1)
      AND NOT EXISTS (SELECT 1 FROM pbp_possessions WHERE game_id = sg.id LIMIT 1)
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
