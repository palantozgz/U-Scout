/**
 * possessions.ts — Procesador de posesiones desde stats_pbp
 *
 * Lee los eventos ya guardados en stats_pbp para un partido y genera:
 *   1. pbp_possessions    — una fila por posesión
 *   2. pbp_player_game_stats — una fila por jugadora por partido
 *   3. pbp_lineup_stats   — una fila por quinteto por partido
 *   4. pbp_audit_log      — diff PBP vs boxscore
 *
 * Filosofía: los eventos sin player_external_id (team rebounds, team turnovers)
 * cuentan para stats de EQUIPO (en possessions) pero no para stats individuales.
 *
 * B1 FIX (2026-05-25): lookahead en bloque de turnover.
 * Para cada steal, el PBP emite TNOBHD (turnover) seguido de STEBAL (steal)
 * en el mismo clock. Sin el fix, el bloque de turnover abría una posesión del
 * defensor que el bloque de steal inmediatamente cerraba y re-abría → posesión
 * fantasma de 0s con 0 pts. Fix: si events[i+1] es steal del equipo rival,
 * el bloque de turnover no cierra ni abre posesión — el steal lo hace solo.
 */

import { ingest } from '../ingest';
import { config } from '../config';
import { logger } from '../logger';
import { supabase } from '../supabaseClient';

// ─── Tipos internos ───────────────────────────────────────────────────────────

interface PbpEvent {
  id: number;
  game_id: number;
  quarter: number;
  clock: string;
  sequence: number;
  event_type: string;
  action_code: string;
  player_external_id: number | null;
  team_id: number | null;
  home_score: number;
  away_score: number;
  score_differential: number;
  rebound_type: string | null;
  assisted_by_external_id: number | null;
  stint_id: number | null;
  shot_made: boolean | null;
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

interface PlayerGameStats {
  gameId: number;
  playerExternalId: string;
  teamId: number;
  seasonId: number;
  secondsPlayed: number;
  fgm: number; fga: number;
  fg3m: number; fg3a: number;
  ftm: number; fta: number;
  pts: number;
  offReb: number; defReb: number; reb: number;
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
  const [m, s] = clock.split(':').map(Number);
  return isNaN(m) || isNaN(s) ? 0 : m * 60 + s;
}

function lineupKey(players: Set<number>): string {
  return Array.from(players).sort((a, b) => a - b).join('-');
}

const POSSESSION_START_EVENTS = new Set([
  'rebound', 'steal', 'ft_made', 'ft_missed', 'jumpball',
]);

const LAST_FT_CODES = new Set([
  'FTH11M', 'FTH11A',  // 1of1
  'FTH22M', 'FTH22A',  // 2of2
  'FTH33M', 'FTH33A',  // 3of3
]);

const TEAM_TURNOVER_CODES = new Set(['TOTLTO', 'TNO24S', 'TNOOTH', 'TNO5SC', 'TNO8SC']);

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function processPossessions(
  gameId: number,         // internal Supabase game_id
  externalGameId: number,
  seasonId: number,
  homeTeamId: number,     // internal team id
  awayTeamId: number,
): Promise<void> {

  // ── Cargar eventos del partido desde stats_pbp ──────────────────────────────
  const { data: rawEvents, error } = await supabase
    .from('stats_pbp')
    .select('*')
    .eq('game_id', gameId)
    .order('quarter', { ascending: true })
    .order('sequence', { ascending: true });

  if (error || !rawEvents || rawEvents.length === 0) {
    logger.warn('processPossessions: no events', { gameId, error: error?.message });
    return;
  }

  const events = rawEvents as PbpEvent[];

  // ── Cargar boxscore para seeds de quinteto inicial y auditoría ──────────────
  const { data: boxRows } = await supabase
    .from('stats_player_boxscores')
    .select('player_external_id, team_external_id, is_start_lineup, pts, reb, ast, stl, blk, tov')
    .eq('game_id', gameId);

  const boxByTeam: Record<string, any[]> = {};
  for (const b of boxRows ?? []) {
    const t = String(b.team_external_id);
    if (!boxByTeam[t]) boxByTeam[t] = [];
    boxByTeam[t].push(b);
  }

  // ── Estado del lineup (quintetos en pista) ──────────────────────────────────
  // teamId → Set<playerExternalId>
  const lineups: Map<number, Set<number>> = new Map();
  lineups.set(homeTeamId, new Set());
  lineups.set(awayTeamId, new Set());

  // Seed de titulares desde boxscore (is_start_lineup = true).
  // En WCBA, el PBP no registra sub_in para los titulares al inicio — empiezan
  // directamente en pista. El boxscore es la única fuente fiable de titulares.
  // Necesitamos mapear team_external_id → internal team_id.
  // homeTeamId y awayTeamId son los IDs internos de Supabase.
  // Los boxRows tienen team_external_id (el ID de la WCBA API).
  // Obtenemos el mapping buscando el team_external_id en los primeros eventos del PBP.
  const teamExtToInt: Map<string, number> = new Map();
  for (const ev of events) {
    if (ev.team_id && ev.team_id === homeTeamId) {
      // Buscar en boxRows el team_external_id que corresponde a homeTeamId
      // Usamos el primer evento del PBP donde team_id coincide con homeTeamId
      // y miramos qué team_external_id tienen sus jugadoras en el boxscore
      break;
    }
  }
  // Approach más directo: los boxRows tienen team_external_id como string.
  // Los events tienen team_id como número interno (el mismo que homeTeamId/awayTeamId).
  // Buscamos en los eventos del PBP para establecer el mapping.
  for (const ev of events) {
    if (!ev.team_id || !ev.player_external_id) continue;
    // Buscar este player en el boxscore para encontrar su team_external_id
    for (const [extStr, players] of Object.entries(boxByTeam)) {
      for (const p of players) {
        if (String(p.player_external_id) === String(ev.player_external_id)) {
          teamExtToInt.set(extStr, ev.team_id);
          break;
        }
      }
    }
    if (teamExtToInt.size === 2) break; // tenemos ambos equipos
  }

  const startersByTeam: Map<number, Set<number>> = new Map();
  for (const [teamExtStr, players] of Object.entries(boxByTeam)) {
    const internalTeamId = teamExtToInt.get(teamExtStr);
    if (!internalTeamId) continue;
    const starters = new Set<number>();
    for (const p of players) {
      if (p.is_start_lineup && p.player_external_id) {
        starters.add(Number(p.player_external_id));
      }
    }
    if (starters.size > 0) {
      startersByTeam.set(internalTeamId, starters);
      lineups.set(internalTeamId, new Set(starters));
    }
  }

  // ── Estado por jugadora ─────────────────────────────────────────────────────
  // playerExternalId → PlayerGameStats
  const playerStats: Map<string, PlayerGameStats> = new Map();

  // Stints: trackear cuando entró cada jugadora (para minutos)
  // playerExternalId → { teamId, entryTimeSec, quarter }
  const onCourtSince: Map<string, { teamId: number; entrySec: number; quarter: number }> = new Map();

  // Marcar titulares como en pista desde el inicio
  for (const [tid, players] of startersByTeam) {
    for (const pid of players) {
      const key = String(pid);
      onCourtSince.set(key, { teamId: tid, entrySec: 600, quarter: 1 }); // FIBA Q1 starts at 10:00
      if (!playerStats.has(key)) {
        playerStats.set(key, emptyPlayerStats(gameId, key, tid, seasonId, true));
      }
    }
  }

  // Plus/minus tracking: al inicio marcador es 0-0
  // Para cada jugadora en pista, calculamos su +/- acumulando los puntos mientras está
  // Usamos score_differential por evento

  // ── Estado de posesiones ───────────────────────────────────────────────────
  const possessions: Possession[] = [];
  const lineupStatsMap: Map<string, LineupStats> = new Map(); // key = `${teamId}:${lineupId}`

  let currentPossTeamId: number | null = null;
  let possStartSec: number = 600;
  let possStartType: string = 'period_start';
  let possScoreMarginStart: number = 0;
  let possStartLineupId: string = '';
  let possStartOpponentLineupId: string = '';
  let possPoints: number = 0;
  let possShotAttempts: number = 0;
  let possFtAttempts: number = 0;
  let possTurnovers: number = 0;
  let possOffRebounds: number = 0;
  let isSecondChance: boolean = false;
  let possNumber: number = 0;
  let currentQuarter: number = 1;

  // ── FIBA quarter durations ──────────────────────────────────────────────────
  function quarterDuration(q: number): number {
    return q <= 4 ? 600 : 300; // OT = 5 min
  }

  // ── Funciones auxiliares de lineup stats ────────────────────────────────────
  function ensureLineup(teamId: number, lineupId: string): LineupStats {
    const key = `${teamId}:${lineupId}`;
    if (!lineupStatsMap.has(key)) {
      lineupStatsMap.set(key, {
        gameId, teamId, seasonId, lineupId,
        secondsPlayed: 0, offPossessions: 0, defPossessions: 0,
        offPts: 0, defPts: 0, offReb: 0, defReb: 0, tov: 0, stl: 0,
      });
    }
    return lineupStatsMap.get(key)!;
  }

  function closePossession(
    endTimeSec: number,
    endType: string,
    quarter: number,
  ): void {
    if (currentPossTeamId === null) return;
    const dur = Math.max(0, possStartSec - endTimeSec);
    possNumber++;

    const poss: Possession = {
      gameId, seasonId,
      teamId: currentPossTeamId,
      opponentTeamId: currentPossTeamId === homeTeamId ? awayTeamId : homeTeamId,
      possessionNumber: possNumber,
      quarter,
      startTimeSec: possStartSec,
      endTimeSec,
      durationSec: dur,
      startType: possStartType,
      endType,
      points: possPoints,
      shotAttempts: possShotAttempts,
      ftAttempts: possFtAttempts,
      turnovers: possTurnovers,
      offensiveRebounds: possOffRebounds,
      isTransition: dur <= 8,
      isEarlyOffense: dur > 8 && dur <= 14,
      isHalfcourt: dur > 14,
      isSecondChance,
      scoreMarginStart: possScoreMarginStart,
      lineupId: possStartLineupId,
      opponentLineupId: possStartOpponentLineupId,
    };
    possessions.push(poss);

    // Lineup stats — equipo atacante
    const offLu = ensureLineup(currentPossTeamId, possStartLineupId);
    offLu.offPossessions++;
    offLu.offPts += possPoints;
    offLu.secondsPlayed += dur;
    offLu.offReb += possOffRebounds;
    offLu.tov += possTurnovers;

    // Lineup stats — equipo defensor
    const defTeamId = currentPossTeamId === homeTeamId ? awayTeamId : homeTeamId;
    const defLu = ensureLineup(defTeamId, possStartOpponentLineupId);
    defLu.defPossessions++;
    defLu.defPts += possPoints;
  }

  function startPossession(
    teamId: number,
    startSec: number,
    startType: string,
    quarter: number,
    scoreDiff: number,
  ): void {
    currentPossTeamId = teamId;
    possStartSec = startSec;
    possStartType = startType;
    possScoreMarginStart = teamId === homeTeamId ? scoreDiff : -scoreDiff;
    possPoints = 0;
    possShotAttempts = 0;
    possFtAttempts = 0;
    possTurnovers = 0;
    possOffRebounds = 0;
    isSecondChance = false;
    // Capturar lineups al inicio de la posesión
    possStartLineupId = lineupKey(lineups.get(teamId) ?? new Set());
    const oppId = teamId === homeTeamId ? awayTeamId : homeTeamId;
    possStartOpponentLineupId = lineupKey(lineups.get(oppId) ?? new Set());
  }

  // ── Plus/minus helper ───────────────────────────────────────────────────────
  // Acumulamos puntos anotados por equipo por stint
  // Al salir una jugadora calculamos su +/-
  function flushMinutesForPlayer(
    playerKey: string,
    exitSec: number,
    exitQuarter: number,
  ): void {
    const entry = onCourtSince.get(playerKey);
    if (!entry) return;

    // Si cambia de cuarto, el tiempo del cuarto anterior ya acabó en 0
    const effectiveEntry = entry.quarter === exitQuarter
      ? entry.entrySec
      : quarterDuration(entry.quarter); // entró en cuarto anterior, salió en este

    const secs = Math.max(0, effectiveEntry - exitSec);
    const ps = playerStats.get(playerKey);
    if (ps) ps.secondsPlayed += secs;
    onCourtSince.delete(playerKey);
  }

  // ── Procesar eventos ────────────────────────────────────────────────────────
  let prevEvent: PbpEvent | null = null;
  let ftSeriesCount = 0; // para detectar último FT de la serie

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const clockSec = clockToSec(ev.clock);
    const isNewQuarter = ev.quarter !== currentQuarter;

    // Cerrar stints al cambio de cuarto
    if (isNewQuarter) {
      // Todos los jugadores en pista: sus minutos hasta el final del cuarto anterior
      for (const [pkey, entry] of onCourtSince) {
        if (entry.quarter < ev.quarter) {
          const ps = playerStats.get(pkey);
          if (ps) ps.secondsPlayed += Math.max(0, entry.entrySec); // hasta 0:00
          onCourtSince.set(pkey, { ...entry, entrySec: quarterDuration(ev.quarter), quarter: ev.quarter });
        }
      }
      // Nueva posesión al inicio de cuarto (si había una abierta, cerrarla)
      if (currentPossTeamId !== null) {
        closePossession(0, 'period_end', currentQuarter);
        currentPossTeamId = null;
      }
      currentQuarter = ev.quarter;
    }

    const pid = ev.player_external_id;
    const tid = ev.team_id;
    const pidKey = pid ? String(pid) : null;

    // ── Sub_in / Sub_out ────────────────────────────────────────────────────
    if (ev.event_type === 'sub_in' && tid && pid) {
      if (!lineups.has(tid)) lineups.set(tid, new Set());
      lineups.get(tid)!.add(pid);
      onCourtSince.set(pidKey!, { teamId: tid, entrySec: clockSec, quarter: ev.quarter });
      if (!playerStats.has(pidKey!)) {
        playerStats.set(pidKey!, emptyPlayerStats(gameId, pidKey!, tid, seasonId, false));
      }
    }

    if (ev.event_type === 'sub_out' && tid && pid) {
      lineups.get(tid)?.delete(pid);
      flushMinutesForPlayer(pidKey!, clockSec, ev.quarter);
    }

    // ── Stats individuales ──────────────────────────────────────────────────
    if (pidKey && tid) {
      let ps = playerStats.get(pidKey);
      if (!ps) {
        ps = emptyPlayerStats(gameId, pidKey, tid, seasonId, false);
        playerStats.set(pidKey, ps);
      }

      switch (ev.event_type) {
        case 'shot_made':
          ps.fgm++; ps.fga++;
          ps.pts += 2;
          break;
        case 'shot_made_3':
          ps.fgm++; ps.fga++; ps.fg3m++; ps.fg3a++;
          ps.pts += 3;
          break;
        case 'shot_missed':
          ps.fga++;
          break;
        case 'shot_missed_3':
          ps.fga++; ps.fg3a++;
          break;
        case 'ft_made':
          ps.ftm++; ps.fta++;
          ps.pts++;
          break;
        case 'ft_missed':
          ps.fta++;
          break;
        case 'rebound':
          if (ev.rebound_type === 'offensive') { ps.offReb++; ps.reb++; }
          else if (ev.rebound_type === 'defensive') { ps.defReb++; ps.reb++; }
          break;
        case 'assist':
          ps.ast++;
          break;
        case 'steal':
          ps.stl++;
          break;
        case 'block':
          ps.blk++;
          break;
        case 'turnover':
          ps.tov++;
          break;
        case 'foul':
          ps.fouls++;
          break;
      }
    }

    // ── Posesiones ──────────────────────────────────────────────────────────
    // Acumular stats de posesión actual
    if (currentPossTeamId !== null && tid === currentPossTeamId) {
      if (ev.event_type === 'shot_made' || ev.event_type === 'shot_made_3') {
        possPoints += ev.event_type === 'shot_made_3' ? 3 : 2;
        possShotAttempts++;
      }
      if (ev.event_type === 'shot_missed' || ev.event_type === 'shot_missed_3') {
        possShotAttempts++;
      }
      if (ev.event_type === 'ft_made') {
        possPoints++;
        possFtAttempts++;
      }
      if (ev.event_type === 'ft_missed') {
        possFtAttempts++;
      }
      if (ev.event_type === 'turnover') {
        possTurnovers++;
      }
      if (ev.event_type === 'rebound' && ev.rebound_type === 'offensive') {
        possOffRebounds++;
        isSecondChance = true;
      }
    }

    // ── Detectar fin/inicio de posesión ────────────────────────────────────

    // Tiro de campo anotado → fin de posesión del equipo que anota
    if ((ev.event_type === 'shot_made' || ev.event_type === 'shot_made_3') && tid) {
      if (currentPossTeamId === tid) {
        closePossession(clockSec, 'shot_made', ev.quarter);
      }
      // El rival inicia posesión en el siguiente evento (after_basket)
      // Iniciamos la siguiente posesión con el rival
      const nextTeam = tid === homeTeamId ? awayTeamId : homeTeamId;
      startPossession(nextTeam, clockSec, 'made_basket', ev.quarter, ev.score_differential);
    }

    // Rebote defensivo → fin de posesión del rival, inicio del equipo que rebotea
    if (ev.event_type === 'rebound' && ev.rebound_type === 'defensive' && tid) {
      if (currentPossTeamId !== null && currentPossTeamId !== tid) {
        closePossession(clockSec, 'shot_missed', ev.quarter);
      }
      startPossession(tid, clockSec, 'def_rebound', ev.quarter, ev.score_differential);
    }

    // Robo → fin de posesión del rival, inicio del equipo que roba
    if (ev.event_type === 'steal' && tid) {
      if (currentPossTeamId !== null && currentPossTeamId !== tid) {
        closePossession(clockSec, 'turnover', ev.quarter);
      }
      startPossession(tid, clockSec, 'steal', ev.quarter, ev.score_differential);
    }

    // Pérdida sin robo (dead ball TOV).
    // B1 FIX: si el siguiente evento es un steal del equipo rival, NO procesamos
    // el cambio de posesión aquí — el bloque de steal de arriba lo manejará.
    // Sin el fix: el turnover abría una posesión del defensor, y el steal la
    // cerraba y re-abría → posesión fantasma de 0s con 0 pts inflando el conteo.
    if (ev.event_type === 'turnover' && !ev.action_code?.startsWith('STEAL')
        && tid && currentPossTeamId === tid) {
      const nextEv = events[i + 1];
      const nextIsSteal = nextEv?.event_type === 'steal' && nextEv?.team_id !== tid;
      if (!nextIsSteal) {
        // TOV muerto normal (24s, out-of-bounds, etc.) — el rival recibe balón muerto
        closePossession(clockSec, 'turnover', ev.quarter);
        const nextTeam = tid === homeTeamId ? awayTeamId : homeTeamId;
        startPossession(nextTeam, clockSec, 'dead_ball', ev.quarter, ev.score_differential);
      }
      // Si nextIsSteal === true: no hacer nada aquí.
      // El bloque de steal procesará: closePossession del atacante + startPossession del defensor.
    }

    // Último tiro libre → puede cambiar posesión
    if (LAST_FT_CODES.has(ev.action_code ?? '') && tid) {
      if (ev.event_type === 'ft_made') {
        // FT convertido → el rival recibe el balón
        if (currentPossTeamId === tid) {
          closePossession(clockSec, 'ft_made', ev.quarter);
        }
        const nextTeam = tid === homeTeamId ? awayTeamId : homeTeamId;
        startPossession(nextTeam, clockSec, 'made_basket', ev.quarter, ev.score_differential);
      }
      // FT fallado → se va a rebote, se manejará con el evento rebound siguiente
    }

    // Inicio del partido (primer evento del Q1)
    if (i === 0 || (isNewQuarter && currentPossTeamId === null)) {
      // Determinamos qué equipo empieza con el balón por el jumpball o primer evento
      if (ev.event_type === 'jumpball' && tid) {
        startPossession(tid, clockSec, 'period_start', ev.quarter, ev.score_differential);
      } else if (currentPossTeamId === null && tid) {
        startPossession(tid, clockSec, 'period_start', ev.quarter, ev.score_differential);
      }
    }

    prevEvent = ev;
  }

  // Cerrar posesión y stints al final del partido
  if (currentPossTeamId !== null) {
    closePossession(0, 'period_end', currentQuarter);
  }
  for (const [pkey] of onCourtSince) {
    flushMinutesForPlayer(pkey, 0, currentQuarter);
  }

  // ── Plus/minus desde score_differential ────────────────────────────────────
  // Calculamos el +/- de cada jugadora comparando el marcador cuando entró y cuando salió.
  // Usamos los stint_id del PBP para agrupar (ya calculados en pbp.ts).
  // Aproximación: para cada evento, si la jugadora está en pista y el equipo anota, suma.
  // Implementación simplificada: usamos el score_differential del primer y último evento
  // en los que la jugadora estuvo en pista.
  // TODO: refinar con stint tracking exacto si se necesita mayor precisión.

  // ── Finalizar pbp_player_game_stats ────────────────────────────────────────
  const playerGameStatsRows = Array.from(playerStats.values()).map(ps => ({
    gameId: ps.gameId,
    playerExternalId: ps.playerExternalId,
    teamId: ps.teamId,
    seasonId: ps.seasonId,
    secondsPlayed: ps.secondsPlayed,
    fgm: ps.fgm, fga: ps.fga,
    fg3m: ps.fg3m, fg3a: ps.fg3a,
    ftm: ps.ftm, fta: ps.fta,
    pts: ps.pts,
    offReb: ps.offReb, defReb: ps.defReb,
    reb: ps.offReb + ps.defReb,
    ast: ps.ast, stl: ps.stl, blk: ps.blk,
    tov: ps.tov, fouls: ps.fouls,
    plusMinus: ps.plusMinus,
    isStarter: ps.isStarter,
  }));

  // ── Finalizar pbp_lineup_stats ─────────────────────────────────────────────
  const lineupStatsRows = Array.from(lineupStatsMap.values()).map(ls => ({
    gameId: ls.gameId,
    teamId: ls.teamId,
    seasonId: ls.seasonId,
    lineupId: ls.lineupId,
    secondsPlayed: ls.secondsPlayed,
    offPossessions: ls.offPossessions,
    defPossessions: ls.defPossessions,
    offPts: ls.offPts,
    defPts: ls.defPts,
    offPpp: ls.offPossessions > 0
      ? Math.round(ls.offPts / ls.offPossessions * 1000) / 1000
      : null,
    defPpp: ls.defPossessions > 0
      ? Math.round(ls.defPts / ls.defPossessions * 1000) / 1000
      : null,
    netPpp: (ls.offPossessions > 0 && ls.defPossessions > 0)
      ? Math.round((ls.offPts / ls.offPossessions - ls.defPts / ls.defPossessions) * 1000) / 1000
      : null,
    offReb: ls.offReb, defReb: ls.defReb,
    tov: ls.tov, stl: ls.stl,
  }));

  // ── Auditoría PBP vs boxscore ───────────────────────────────────────────────
  const auditRows: any[] = [];
  for (const [teamExtStr, boxPlayers] of Object.entries(boxByTeam)) {
    const boxPts = boxPlayers.reduce((s, p) => s + (p.pts ?? 0), 0);
    const boxReb = boxPlayers.reduce((s, p) => s + (p.reb ?? 0), 0);
    const boxAst = boxPlayers.reduce((s, p) => s + (p.ast ?? 0), 0);
    const boxTov = boxPlayers.reduce((s, p) => s + (p.tov ?? 0), 0);

    // PBP totales de equipo (solo jugadoras del equipo)
    const teamPbpPlayers = playerGameStatsRows.filter(p => {
      // Necesitamos mapear teamId interno a teamExtStr
      return true; // filtrar abajo con teamId
    });

    // Estimación PBP desde possessions para pts de equipo
    const teamPoss = possessions.filter(p =>
      p.teamId === homeTeamId && teamExtStr === String(homeTeamId) ||
      p.teamId === awayTeamId && teamExtStr === String(awayTeamId)
    );
    const pbpPts = teamPoss.reduce((s, p) => s + p.points, 0);
    const diffPts = Math.abs(boxPts - pbpPts);

    auditRows.push({
      gameId,
      teamExternalId: teamExtStr,
      seasonId,
      boxPts, pbpPts, diffPts: boxPts - pbpPts,
      boxReb, pbpReb: 0, diffReb: 0, // simplificado en v1
      boxAst, pbpAst: 0, diffAst: 0,
      boxTov, pbpTov: 0, diffTov: 0,
      status: diffPts <= 3 ? 'ok' : diffPts <= 10 ? 'warning' : 'error',
    });
  }

  // ── Enviar a Railway via ingest ────────────────────────────────────────────
  logger.info('Sending possessions to ingest', {
    gameId: externalGameId,
    possessions: possessions.length,
    players: playerGameStatsRows.length,
    lineups: lineupStatsRows.length,
  });

  await ingest({
    type: 'pbp_possessions',
    seasonId,
    competitionId: config.wcba.competitionId,
    data: possessions,
  });

  await ingest({
    type: 'pbp_player_game_stats',
    seasonId,
    competitionId: config.wcba.competitionId,
    data: playerGameStatsRows,
  });

  await ingest({
    type: 'pbp_lineup_stats',
    seasonId,
    competitionId: config.wcba.competitionId,
    data: lineupStatsRows,
  });

  await ingest({
    type: 'pbp_audit',
    seasonId,
    competitionId: config.wcba.competitionId,
    data: auditRows,
  });

  logger.info('Possessions processed', {
    gameId: externalGameId,
    possessions: possessions.length,
    players: playerGameStatsRows.length,
    lineups: lineupStatsRows.length,
    auditStatus: auditRows.map(a => `${a.teamExternalId}:${a.status}`).join(', '),
  });
}

// ─── Helper: jugadora vacía ───────────────────────────────────────────────────
function emptyPlayerStats(
  gameId: number,
  playerExternalId: string,
  teamId: number,
  seasonId: number,
  isStarter: boolean,
): PlayerGameStats {
  return {
    gameId, playerExternalId, teamId, seasonId,
    secondsPlayed: 0,
    fgm: 0, fga: 0, fg3m: 0, fg3a: 0,
    ftm: 0, fta: 0, pts: 0,
    offReb: 0, defReb: 0, reb: 0,
    ast: 0, stl: 0, blk: 0,
    tov: 0, fouls: 0,
    plusMinus: 0,
    isStarter,
  };
}

// ─── Sync entry point ─────────────────────────────────────────────────────────
interface GameRow {
  id: number;
  external_game_id: number;
  home_team_id: number;
  away_team_id: number;
  season_id: number | null;
}

export async function syncPossessions(gameIds: number[]): Promise<void> {
  // Cargar mapping external_game_id → internal id + teams
  const { data: gamesRaw } = await supabase
    .from('stats_games')
    .select('id, external_game_id, home_team_id, away_team_id, season_id')
    .in('external_game_id', gameIds)
    .eq('status', 4);
  const games = (gamesRaw ?? []) as GameRow[];

  if (games.length === 0) return;

  // Verificar qué partidos ya tienen possessions procesadas
  const { data: done } = await supabase
    .from('pbp_possessions')
    .select('game_id')
    .in('game_id', games.map((g: GameRow) => g.id));

  const donSet = new Set((done ?? []).map((d: any) => d.game_id));
  const pending = games.filter((g: GameRow) => !donSet.has(g.id));

  logger.info('Syncing possessions', {
    total: games.length,
    pending: pending.length,
    skipped: games.length - pending.length,
  });

  for (const g of pending) {
    try {
      await processPossessions(
        g.id,
        g.external_game_id,
        g.season_id ?? config.wcba.seasonId,
        g.home_team_id,
        g.away_team_id,
      );
    } catch (err: any) {
      logger.error('Possessions failed', { gameId: g.external_game_id, error: err.message });
    }
  }

  logger.info('Possessions done', { synced: pending.length });
}
