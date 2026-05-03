/**
 * stats-ingest.ts — Endpoint POST /api/stats/ingest
 * Recibe datos del collector (Raspberry Pi) y los escribe en las tablas stats_*.
 * Autenticación: Bearer token via STATS_INGEST_KEY env var.
 * Filosofía: guardar todo lo que llega, sin filtrar en la recolección.
 */

import type { Express, Request, Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "./db";

// ─── Auth middleware ───────────────────────────────────────────────────────────
function requireIngestKey(req: Request, res: Response, next: () => void) {
  const key = process.env.STATS_INGEST_KEY;
  if (!key) {
    console.error("[stats-ingest] STATS_INGEST_KEY not configured");
    return res.status(500).json({ error: "Ingest not configured" });
  }
  const auth = req.headers.authorization ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token !== key) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// ─── Upsert helpers ────────────────────────────────────────────────────────────

async function upsertTeam(t: any): Promise<void> {
  await db.execute(sql`
    INSERT INTO stats_teams (external_id, name_zh, name_en, logo_url, competition_id)
    VALUES (${t.teamId}, ${t.teamName ?? ''}, ${t.teamNameEn ?? null}, ${t.teamLogo ?? null}, ${t.competitionId ?? 56})
    ON CONFLICT (external_id) DO UPDATE SET
      name_zh = EXCLUDED.name_zh,
      logo_url = COALESCE(EXCLUDED.logo_url, stats_teams.logo_url),
      updated_at = NOW()
  `);
}

async function upsertPlayer(p: any): Promise<void> {
  const teamRow = p.teamId ? await db.execute(sql`
    SELECT id FROM stats_teams WHERE external_id = ${p.teamId} LIMIT 1
  `) : null;
  const teamInternalId = teamRow?.rows?.[0]?.id ?? null;

  await db.execute(sql`
    INSERT INTO stats_players (external_id, name_zh, name_en, team_id, is_foreign, jersey_number, position)
    VALUES (
      ${String(p.playerId)}, ${p.playerName ?? ''}, ${p.playerNameEn ?? null},
      ${teamInternalId}, ${p.isForeign ?? false},
      ${p.jersey ?? null}, ${p.position ?? null}
    )
    ON CONFLICT (external_id) DO UPDATE SET
      name_zh = EXCLUDED.name_zh,
      team_id = COALESCE(EXCLUDED.team_id, stats_players.team_id),
      is_foreign = EXCLUDED.is_foreign,
      updated_at = NOW()
  `);
}

// ─── Handlers por tipo ─────────────────────────────────────────────────────────

async function handleStandings(rows: any[], seasonId: number, competitionId: number): Promise<number> {
  let count = 0;
  for (const r of rows) {
    if (!r.teamId) continue;
    await db.execute(sql`
      INSERT INTO stats_teams (external_id, name_zh, logo_url, competition_id)
      VALUES (${r.teamId}, ${r.teamName ?? ''}, ${r.teamLogo ?? null}, ${competitionId})
      ON CONFLICT (external_id) DO UPDATE SET
        name_zh = EXCLUDED.name_zh,
        logo_url = COALESCE(EXCLUDED.logo_url, stats_teams.logo_url),
        updated_at = NOW()
    `);
    await db.execute(sql`
      INSERT INTO stats_standings (
        team_external_id, season_id, phase_id, phase_name, rank,
        wins, losses, win_pct, pts_per_game, pts_against_per_game,
        goal_diff, streak, last10_wins, last10_losses,
        home_wins, home_losses, away_wins, away_losses
      ) VALUES (
        ${r.teamId}, ${seasonId}, ${r.phaseId ?? null}, ${r.phaseName ?? null},
        ${r.rank ?? 0}, ${r.wins ?? 0}, ${r.losses ?? 0}, ${r.winPct ?? null},
        ${r.ptsPerGame ?? null}, ${r.ptsAgainstPerGame ?? null},
        ${r.goalDiff ?? null}, ${r.streak ?? null},
        ${r.last10Wins ?? null}, ${r.last10Losses ?? null},
        ${r.homeWins ?? null}, ${r.homeLosses ?? null},
        ${r.awayWins ?? null}, ${r.awayLosses ?? null}
      )
      ON CONFLICT (team_external_id, season_id, phase_id) DO UPDATE SET
        rank = EXCLUDED.rank, wins = EXCLUDED.wins, losses = EXCLUDED.losses,
        win_pct = EXCLUDED.win_pct, pts_per_game = EXCLUDED.pts_per_game,
        pts_against_per_game = EXCLUDED.pts_against_per_game,
        goal_diff = EXCLUDED.goal_diff, streak = EXCLUDED.streak,
        last10_wins = EXCLUDED.last10_wins, last10_losses = EXCLUDED.last10_losses,
        home_wins = EXCLUDED.home_wins, home_losses = EXCLUDED.home_losses,
        away_wins = EXCLUDED.away_wins, away_losses = EXCLUDED.away_losses,
        updated_at = NOW()
    `);
    count++;
  }
  return count;
}

async function handleSchedule(rows: any[], seasonId: number, competitionId: number): Promise<number> {
  let count = 0;
  for (const r of rows) {
    if (!r.gameId) continue;
    if (r.homeTeamId) await db.execute(sql`
      INSERT INTO stats_teams (external_id, name_zh, competition_id)
      VALUES (${r.homeTeamId}, ${r.homeTeamName ?? ''}, ${competitionId})
      ON CONFLICT (external_id) DO UPDATE SET name_zh = EXCLUDED.name_zh, updated_at = NOW()
    `);
    if (r.awayTeamId) await db.execute(sql`
      INSERT INTO stats_teams (external_id, name_zh, competition_id)
      VALUES (${r.awayTeamId}, ${r.awayTeamName ?? ''}, ${competitionId})
      ON CONFLICT (external_id) DO UPDATE SET name_zh = EXCLUDED.name_zh, updated_at = NOW()
    `);

    const homeTeam = r.homeTeamId ? await db.execute(sql`SELECT id FROM stats_teams WHERE external_id = ${r.homeTeamId} LIMIT 1`) : null;
    const awayTeam = r.awayTeamId ? await db.execute(sql`SELECT id FROM stats_teams WHERE external_id = ${r.awayTeamId} LIMIT 1`) : null;

    await db.execute(sql`
      INSERT INTO stats_games (
        external_game_id, match_id, season_id, competition_id,
        phase_id, round_id, home_team_id, away_team_id,
        scheduled_at, status
      ) VALUES (
        ${r.gameId}, ${r.matchId ?? null}, ${seasonId}, ${competitionId},
        ${r.phaseId ?? null}, ${r.roundId ?? null},
        ${homeTeam?.rows?.[0]?.id ?? null}, ${awayTeam?.rows?.[0]?.id ?? null},
        ${r.scheduledAt ?? null}, ${r.status ?? 0}
      )
      ON CONFLICT (external_game_id) DO UPDATE SET
        status = EXCLUDED.status,
        scheduled_at = COALESCE(EXCLUDED.scheduled_at, stats_games.scheduled_at),
        updated_at = NOW()
    `);
    count++;
  }
  return count;
}

async function handleBoxscores(rows: any[], seasonId: number): Promise<number> {
  let count = 0;
  for (const r of rows) {
    if (!r.gameId) continue;
    const game = await db.execute(sql`SELECT id FROM stats_games WHERE external_game_id = ${r.gameId} LIMIT 1`);
    const gameInternalId = game?.rows?.[0]?.id;
    if (!gameInternalId) continue;

    await db.execute(sql`
      UPDATE stats_games SET
        home_score = ${r.homeScore ?? null}, away_score = ${r.awayScore ?? null},
        home_q1 = ${r.homeQ1 ?? null}, home_q2 = ${r.homeQ2 ?? null},
        home_q3 = ${r.homeQ3 ?? null}, home_q4 = ${r.homeQ4 ?? null},
        away_q1 = ${r.awayQ1 ?? null}, away_q2 = ${r.awayQ2 ?? null},
        away_q3 = ${r.awayQ3 ?? null}, away_q4 = ${r.awayQ4 ?? null},
        status = ${r.status ?? 4}, updated_at = NOW()
      WHERE id = ${gameInternalId}
    `);
    count++;
  }
  return count;
}

async function handlePlayerStats(rows: any[], seasonId: number): Promise<number> {
  let count = 0;
  for (const r of rows) {
    if (!r.playerId) continue;
    await upsertPlayer(r);
    const player = await db.execute(sql`SELECT id FROM stats_players WHERE external_id = ${String(r.playerId)} LIMIT 1`);
    const playerInternalId = player?.rows?.[0]?.id;
    const team = r.teamId ? await db.execute(sql`SELECT id FROM stats_teams WHERE external_id = ${r.teamId} LIMIT 1`) : null;
    const teamInternalId = team?.rows?.[0]?.id ?? null;

    await db.execute(sql`
      INSERT INTO stats_season (
        player_id, player_external_id, team_id, season_id, phase_id,
        games, minutes, pts, reb, ast, stl, blk, tov,
        fgm, fga, tpm, tpa, ftm, fta, eff,
        fg_pct, tp_pct, ft_pct
      ) VALUES (
        ${playerInternalId}, ${String(r.playerId)}, ${teamInternalId},
        ${seasonId}, ${r.phaseId ?? null},
        ${r.games ?? 0}, ${r.minutes ?? null},
        ${r.pts ?? null}, ${r.reb ?? null}, ${r.ast ?? null},
        ${r.stl ?? null}, ${r.blk ?? null}, ${r.tov ?? null},
        ${r.fgm ?? null}, ${r.fga ?? null},
        ${r.tpm ?? null}, ${r.tpa ?? null},
        ${r.ftm ?? null}, ${r.fta ?? null},
        ${r.eff ?? null}, ${r.fgPct ?? null},
        ${r.tpPct ?? null}, ${r.ftPct ?? null}
      )
      ON CONFLICT (player_external_id, season_id, phase_id) DO UPDATE SET
        games = EXCLUDED.games, minutes = EXCLUDED.minutes,
        pts = EXCLUDED.pts, reb = EXCLUDED.reb, ast = EXCLUDED.ast,
        stl = EXCLUDED.stl, blk = EXCLUDED.blk, tov = EXCLUDED.tov,
        fgm = EXCLUDED.fgm, fga = EXCLUDED.fga,
        tpm = EXCLUDED.tpm, tpa = EXCLUDED.tpa,
        ftm = EXCLUDED.ftm, fta = EXCLUDED.fta,
        eff = EXCLUDED.eff, fg_pct = EXCLUDED.fg_pct,
        tp_pct = EXCLUDED.tp_pct, ft_pct = EXCLUDED.ft_pct,
        updated_at = NOW()
    `);
    count++;
  }
  return count;
}

async function handlePBP(rows: any[]): Promise<number> {
  if (rows.length === 0) return 0;
  let count = 0;

  const gameIds = Array.from(new Set(rows.map(r => r.gameId).filter(Boolean)));
  const gameMap = new Map<number, number>();
  for (const extId of gameIds) {
    const res = await db.execute(sql`SELECT id FROM stats_games WHERE external_game_id = ${extId} LIMIT 1`);
    if (res?.rows?.[0]?.id) gameMap.set(extId, res.rows[0].id as number);
  }

  for (const r of rows) {
    if (!r.gameId || r.sequence == null) continue;
    const gameInternalId = gameMap.get(r.gameId);
    if (!gameInternalId) continue;

    await db.execute(sql`
      INSERT INTO stats_pbp (
        game_id, external_game_id, quarter, clock, sequence,
        event_type, action_code, event_zh,
        player_external_id, team_id, action_owner_team,
        home_score, away_score,
        score_differential, lead_change, tie,
        current_momentum_run, stint_id,
        rebound_type, assisted_by_external_id,
        shot_x, shot_y, shot_made, shot_zone,
        shot_band_side, shot_dist_m
      ) VALUES (
        ${gameInternalId}, ${r.gameId}, ${r.quarter ?? null},
        ${r.clock ?? null}, ${r.sequence},
        ${r.eventType ?? null}, ${r.actionCode ?? null}, ${r.eventZh ?? null},
        ${r.playerExternalId ?? null}, ${r.teamId ?? null}, ${r.actionOwnerTeam ?? null},
        ${r.homeScore ?? null}, ${r.awayScore ?? null},
        ${r.scoreDifferential ?? null}, ${r.leadChange ?? null}, ${r.tie ?? null},
        ${r.currentMomentumRun ?? null}, ${r.stintId ?? null},
        ${r.reboundType ?? null}, ${r.assistedByExternalId ?? null},
        ${r.shotX ?? null}, ${r.shotY ?? null}, ${r.shotMade ?? null},
        ${r.shotZone ?? null}, ${r.shotBandSide ?? null}, ${r.shotDistM ?? null}
      )
      ON CONFLICT (game_id, sequence) DO NOTHING
    `);
    count++;
  }
  return count;
}

// ─── Roster ───────────────────────────────────────────────────────────────────
async function handleRoster(rosters: any[]): Promise<number> {
  let count = 0;
  const today = new Date().toISOString().slice(0, 10);

  for (const roster of rosters) {
    const { teamId, teamName, seasonId, players } = roster;
    if (!teamId || !Array.isArray(players)) continue;

    await db.execute(sql`
      INSERT INTO stats_teams (external_id, name_zh, competition_id)
      VALUES (${teamId}, ${teamName ?? ''}, 56)
      ON CONFLICT (external_id) DO UPDATE SET
        name_zh = EXCLUDED.name_zh, updated_at = NOW()
    `);

    for (const p of players) {
      if (!p.playerId) continue;

      await db.execute(sql`
        INSERT INTO stats_players (
          external_id, name_zh, name_en, team_id,
          is_foreign, jersey_number, position,
          height_cm, weight_kg, birthday, photo_url,
          veteran_years, country, ethnicity, season_id
        )
        SELECT
          ${String(p.playerId)}, ${p.playerName ?? ''}, ${p.playerNameEn ?? null},
          st.id,
          ${p.isForeign ?? false}, ${p.jerseyNumber ?? null}, ${p.position ?? null},
          ${p.heightCm ?? null}, ${p.weightKg ?? null},
          ${p.birthday ? p.birthday : null}::date,
          ${p.photoUrl ?? null},
          ${p.veteranYears ?? null}, ${p.country ?? null},
          ${p.ethnicity ?? null}, ${seasonId ?? null}
        FROM stats_teams st WHERE st.external_id = ${teamId}
        ON CONFLICT (external_id) DO UPDATE SET
          name_zh       = EXCLUDED.name_zh,
          team_id       = EXCLUDED.team_id,
          jersey_number = EXCLUDED.jersey_number,
          position      = EXCLUDED.position,
          height_cm     = COALESCE(EXCLUDED.height_cm, stats_players.height_cm),
          weight_kg     = COALESCE(EXCLUDED.weight_kg, stats_players.weight_kg),
          birthday      = COALESCE(EXCLUDED.birthday,  stats_players.birthday),
          photo_url     = COALESCE(EXCLUDED.photo_url, stats_players.photo_url),
          veteran_years = EXCLUDED.veteran_years,
          country       = EXCLUDED.country,
          season_id     = EXCLUDED.season_id,
          updated_at    = NOW()
      `);

      await db.execute(sql`
        INSERT INTO stats_roster_snapshots
          (season_id, team_external_id, player_external_id, player_name_zh, snapshot_date)
        VALUES
          (${seasonId}, ${teamId}, ${String(p.playerId)}, ${p.playerName ?? ''}, ${today}::date)
        ON CONFLICT (season_id, team_external_id, player_external_id, snapshot_date)
        DO NOTHING
      `);

      count++;
    }
  }
  return count;
}

// ─── Registro del endpoint ─────────────────────────────────────────────────────
export function registerStatsIngest(app: Express): void {
  app.post("/api/stats/ingest", requireIngestKey, async (req: Request, res: Response) => {
    const { type, seasonId, competitionId, data } = req.body;

    if (!type || !Array.isArray(data)) {
      return res.status(400).json({ error: "type and data[] required" });
    }

    const started = Date.now();
    let recordsProcessed = 0;

    try {
      switch (type) {
        case "standings":
          recordsProcessed = await handleStandings(data, seasonId, competitionId ?? 56);
          break;
        case "schedule":
          recordsProcessed = await handleSchedule(data, seasonId, competitionId ?? 56);
          break;
        case "boxscores":
          recordsProcessed = await handleBoxscores(data, seasonId);
          break;
        case "player_stats":
          recordsProcessed = await handlePlayerStats(data, seasonId);
          break;
        case "pbp":
          recordsProcessed = await handlePBP(data);
          break;
        case "roster":
          recordsProcessed = await handleRoster(data);
          break;
        default:
          return res.status(400).json({ error: `Unknown ingest type: ${type}` });
      }

      await db.execute(sql`
        INSERT INTO stats_sync_log (sync_type, season_id, records_processed, status, finished_at)
        VALUES (${type}, ${seasonId ?? null}, ${recordsProcessed}, 'ok', NOW())
      `);

      const elapsed = Date.now() - started;
      console.log(`[stats-ingest] ${type} → ${recordsProcessed} records in ${elapsed}ms`);
      return res.json({ ok: true, type, recordsProcessed, elapsedMs: elapsed });

    } catch (err: any) {
      console.error(`[stats-ingest] ${type} error:`, err);
      await db.execute(sql`
        INSERT INTO stats_sync_log (sync_type, season_id, records_processed, status, error_message, finished_at)
        VALUES (${type}, ${seasonId ?? null}, ${recordsProcessed}, 'error', ${err.message ?? 'unknown'}, NOW())
      `).catch(() => {});
      return res.status(500).json({ error: "Ingest failed", detail: err.message });
    }
  });
}
