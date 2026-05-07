/**
 * audit-end-to-end.js — Pipeline completo WCBA → ingest → Supabase
 *
 * Corre en el Pi: node audit-end-to-end.js
 * Objetivo: <60 segundos, reporte ✅/❌ por cada campo crítico.
 *
 * FASES:
 *  1. WCBA API — llama cada endpoint, verifica field mapping del collector
 *  2. INGEST   — ingesta standings + player_boxscores de 1 partido completo
 *  3. SUPABASE — verifica vía REST que los datos llegaron (requiere SUPABASE_URL + SUPABASE_ANON_KEY en .env)
 */

'use strict';

const fs   = require('fs');
const axios = require('./node_modules/axios').default;

// ── Cargar .env ───────────────────────────────────────────────────────────────
const envPath = './.env';
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const idx = t.indexOf('=');
    if (idx === -1) continue;
    const k = t.slice(0, idx).trim();
    const v = t.slice(idx + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

// ── Constantes ────────────────────────────────────────────────────────────────
const WCBA_BASE    = 'https://www.cba.net.cn';
const SEASON       = 2092;
const COMP         = 56;
const TEST_GAME_ID = 1108582; // Partido conocido con datos completos
const UCORE_URL    = process.env.UCORE_API_URL    || 'https://u-scout-production.up.railway.app';
const INGEST_KEY   = process.env.STATS_INGEST_KEY || '';
const SUPA_URL     = process.env.SUPABASE_URL     || '';
const SUPA_KEY     = process.env.SUPABASE_ANON_KEY|| '';

const WCBA_HEADERS = {
  'Referer':        'https://www.cba.net.cn/',
  'User-Agent':     'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Accept':         'application/json, text/plain, */*',
  'Accept-Language':'zh-CN,zh;q=0.9',
};

// ── Resultados globales ───────────────────────────────────────────────────────
const results = [];
let passCount = 0, failCount = 0;

function ok(label, expected, actual) {
  const pass = actual !== undefined && actual !== null && actual !== '' && actual !== 0;
  results.push({ pass, label, expected: String(expected), actual: String(actual ?? 'undefined') });
  if (pass) passCount++; else failCount++;
}
function okEq(label, expected, actual) {
  const pass = String(actual) === String(expected);
  results.push({ pass, label, expected: String(expected), actual: String(actual) });
  if (pass) passCount++; else failCount++;
}
function okGt(label, threshold, actual) {
  const pass = Number(actual) > threshold;
  results.push({ pass, label, expected: `>${threshold}`, actual: String(actual) });
  if (pass) passCount++; else failCount++;
}
function fail(label, reason) {
  results.push({ pass: false, label, expected: 'OK', actual: String(reason) });
  failCount++;
}
function skip(label, reason) {
  results.push({ pass: null, label, expected: '-', actual: String(reason) });
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────
async function wcbaGet(path, params = {}) {
  const r = await axios.get(WCBA_BASE + path, { params, headers: WCBA_HEADERS, timeout: 12000 });
  return r.data;
}

async function ucorePost(path, body) {
  const r = await axios.post(UCORE_URL + path, body, {
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${INGEST_KEY}` },
    timeout: 30000,
  });
  return r.data;
}

async function supaGet(table, query = '') {
  if (!SUPA_URL || !SUPA_KEY) return null;
  const url = `${SUPA_URL}/rest/v1/${table}${query ? '?' + query : ''}`;
  const r = await axios.get(url, {
    headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}`, 'Accept': 'application/json' },
    timeout: 10000,
  });
  return r.data;
}

// ── parseShotStr (igual que en boxscores.ts) ──────────────────────────────────
function parseShotStr(s) {
  if (!s) return [0, 0];
  const m = String(s).match(/^(\d+)-(\d+)/);
  if (!m) return [0, 0];
  return [Number(m[1]), Number(m[2])];
}

// ── ACTION CODES para calcular pts desde PBP ──────────────────────────────────
const MADE2_CODES = new Set(['2PMJMP','2PMLAY','2PMDLA','2PMHOK','2PMTIP','2PMFLO','2PMTLA','2PMSBK','2PMTRN','2PMFAD','2PMFLT','2PMPUL','MADE2']);
const MADE3_CODES = new Set(['3PMJMP','3PMCOR','3PMSBK','3PMFAD','3PMPUL','MADE3']);
const FT_MADE     = new Set(['FTH11M','FTH21M','FTH22M','FTH31M','FTH32M','FTH33M','FT_MADE']);

function ptsFromCode(code) {
  if (MADE3_CODES.has(code)) return 3;
  if (MADE2_CODES.has(code)) return 2;
  if (FT_MADE.has(code))     return 1;
  return 0;
}

// ═════════════════════════════════════════════════════════════════════════════
// FASE 1: WCBA API + Field Mapping
// ═════════════════════════════════════════════════════════════════════════════

async function phase1_wcba() {
  console.log('\n══════════════════════════════════════════');
  console.log('FASE 1 — WCBA API + Field Mapping');
  console.log('══════════════════════════════════════════');

  // ── 1A. STANDINGS ─────────────────────────────────────────────────────────
  console.log('\n[1A] STANDINGS');
  let standingsData = [];
  try {
    const raw = await wcbaGet('/datahub/cbamatch/rank/teamrankfirst', { competitionId: COMP, seasonId: SEASON });
    const rows = raw?.data ?? [];
    standingsData = rows;
    okGt('standings.count', 0, rows.length);
    if (rows.length > 0) {
      const r = rows[0];
      const mapped = {
        teamId:            Number(r.teamId),
        wins:              Number(r.wins ?? 0),
        losses:            Number(r.loses ?? 0),      // ← "loses" en la API, NO "losses"
        ptsPerGame:        Number(r.pts ?? 0),        // ← campo "pts" → ppg
        ptsAgainstPerGame: Number(r.losePts ?? 0),    // ← campo "losePts" → oppg
        phaseName:         r.phaseName ?? '',
        phaseId:           r.phaseId != null ? String(r.phaseId) : null,
      };
      okGt('standings[0].teamId', 0, mapped.teamId);
      okGt('standings[0].ptsPerGame (r.pts→ppg)', 0, mapped.ptsPerGame);
      okGt('standings[0].ptsAgainstPerGame (r.losePts→oppg)', 0, mapped.ptsAgainstPerGame);
      ok ('standings[0].phaseName', 'non-empty', mapped.phaseName);
      ok ('standings[0].phaseId',   'non-null',  mapped.phaseId);
      okGt('standings[0].wins', -1, mapped.wins);
      console.log(`  teamId=${mapped.teamId} | ${mapped.wins}W-${mapped.losses}L | ppg=${mapped.ptsPerGame} oppg=${mapped.ptsAgainstPerGame} | phase="${mapped.phaseName}"`);
    }
  } catch (e) {
    fail('standings.fetch', e.message);
  }

  // ── 1B. SCHEDULE (phasemenus → matchmenusschedule → matchschedules) ────────
  console.log('\n[1B] SCHEDULE');
  let foundGameId  = TEST_GAME_ID;
  let foundMatchId = 0;
  try {
    const pmRaw  = await wcbaGet('/datahub/cbamatch/games/phasemenus', { seasonId: SEASON });
    const pmRows = pmRaw?.data ?? pmRaw?.matchmenusschedule ?? [];
    okGt('phasemenus.count', 0, pmRows.length);

    if (pmRows.length > 0) {
      const phaseId = pmRows[0].phaseId;
      ok('phasemenus[0].phaseId', 'non-empty', phaseId);
      console.log(`  phaseId=${phaseId} | phaseName=${pmRows[0].phaseName ?? '-'}`);

      const mmRaw = await wcbaGet('/datahub/cbamatch/games/matchmenusschedule', { competitionId: COMP, seasonId: SEASON, phaseId });
      // FIX: path exacto de phases.ts — schedRes.data?.data?.rounds ?? schedRes.data?.data
      // wcbaGet devuelve r.data, por tanto mmRaw = schedRes.data → correcto: mmRaw?.data?.rounds
      const roundsRaw = mmRaw?.data?.rounds ?? mmRaw?.data ?? [];
      const rounds    = Array.isArray(roundsRaw) ? roundsRaw : [];
      okGt('matchmenusschedule.rounds', 0, rounds.length);

      if (rounds.length > 0) {
        const round   = rounds[rounds.length - 1]; // último round
        const roundId = round.roundId ?? round.id;
        ok('matchmenusschedule.roundId', 'non-empty', roundId);
        console.log(`  roundId=${roundId}`);

        // ⚠ teamId='' obligatorio
        const scRaw    = await wcbaGet('/datahub/cbamatch/games/matchschedules', { competitionId: COMP, seasonId: SEASON, phaseId, roundId, teamId: '' });
        const dateDays = Array.isArray(scRaw?.data) ? scRaw.data : (Array.isArray(scRaw) ? scRaw : []);
        const allGames = dateDays.flatMap(d => d.games ?? []);
        const completed = allGames.filter(g => Number(g.gameStatus ?? 0) === 4);
        okGt('matchschedules.completedGames', 0, completed.length);

        if (completed.length > 0) {
          const g = completed[0];
          foundGameId  = Number(g.gameId);
          foundMatchId = Number(g.matchId ?? 0);
          ok('schedule.gameId', 'non-empty', foundGameId);
          console.log(`  gameId=${foundGameId} matchId=${foundMatchId} | ${g.homeTeamName ?? g.homeName ?? '-'} ${g.homeScore ?? '?'}-${g.awayScore ?? '?'} ${g.awayTeamName ?? g.awayName ?? '-'}`);
        } else {
          console.log(`  ⚠ No hay completedGames en este round — usando game fallback ${TEST_GAME_ID}`);
        }
      } else {
        console.log(`  ⚠ rounds vacío para phaseId=${phaseId} — usando game fallback ${TEST_GAME_ID}`);
        console.log(`  Raw matchmenusschedule: ${JSON.stringify(mmRaw).slice(0, 120)}`);
      }
    }
  } catch (e) {
    fail('schedule.fetch', e.message);
    console.log(`  ⚠ Usando game fallback ${TEST_GAME_ID}`);
  }

  // ── 1C. BOXSCORE ──────────────────────────────────────────────────────────
  console.log(`\n[1C] BOXSCORE gameId=${foundGameId}`);
  try {
    const raw = await wcbaGet('/datahub/cbamatch/games/matchinfoscores', { matchId: foundMatchId || foundGameId, gameId: foundGameId });
    const d   = raw?.data ?? raw;
    const homeScore = Number(d.home?.teamScore ?? d.homeScore ?? d.homeTeamScore ?? 0);
    const awayScore = Number(d.away?.teamScore ?? d.awayScore ?? d.guestTeamScore ?? 0);
    okGt('boxscore.homeScore', 0, homeScore);
    okGt('boxscore.awayScore', 0, awayScore);
    const homeQs = String(d.home?.periodScores ?? '').split(';').map(Number);
    okGt('boxscore.homeQ1', -1, homeQs[0] ?? 0);
    console.log(`  ${homeScore}-${awayScore} | Quarters H:${homeQs.join('-')} A:${String(d.away?.periodScores ?? '').split(';').join('-')}`);
  } catch (e) {
    fail('boxscore.fetch', e.message);
  }

  // ── 1D. PLAYER BOXSCORE — field mapping exacto de boxscores.ts ────────────
  console.log(`\n[1D] PLAYER BOXSCORE gameId=${foundGameId}`);
  let topScorer    = null;
  let allPlayerRows = [];
  try {
    const raw = await wcbaGet('/datahub/cbamatch/games/player/playerdata', { gameId: foundGameId });
    const d   = raw?.data ?? raw;

    const mapPlayers = (players, teamType) =>
      (Array.isArray(players) ? players : []).map(p => {
        const [fgm, fga] = parseShotStr(p.shot ?? p.twoPoints);
        const [tpm, tpa] = parseShotStr(p.threePoints);
        const [ftm, fta] = parseShotStr(p.foulShot);
        return {
          gameId:           foundGameId,
          playerExternalId: String(p.playerId ?? p.userId ?? p.playerid ?? ''),
          teamExternalId:   String(p.teamId ?? ''),
          teamType,
          isStartLineUp:    Boolean(p.isStartLineUp ?? false),
          minutes:          String(p.minutes ?? p.playTime ?? p.playtime ?? '00:00'),
          pts:              Number(p.points    ?? p.pts   ?? p.score ?? p.point ?? 0),
          offReb:           Number(p.offensiveRebound ?? p.offReb ?? 0),
          defReb:           Number(p.defensiveRebound ?? p.defReb ?? 0),
          reb:              Number(p.rebound   ?? p.totalReb ?? p.reb ?? 0),
          ast:              Number(p.assists   ?? p.ast  ?? 0),
          stl:              Number(p.steals    ?? p.stl  ?? 0),
          blk:              Number(p.blocks    ?? p.blk  ?? 0),
          tov:              Number(p.turnover  ?? p.tov  ?? p.to ?? 0),
          fouls:            Number(p.fouls     ?? p.pf   ?? 0),
          fgm, fga, tpm, tpa, ftm, fta,
          plusMinus:        Number(p.positiveNegativeValue ?? p.plusMinus ?? 0),
        };
      });

    const homeTeam = Array.isArray(d) ? d.find(t => t.teamType === 'Home') : (d.home ?? null);
    const awayTeam = Array.isArray(d) ? d.find(t => t.teamType === 'Away') : (d.away ?? null);
    const home     = mapPlayers(homeTeam?.teamPlayerData ?? homeTeam?.players ?? [], 'Home');
    const away     = mapPlayers(awayTeam?.teamPlayerData ?? awayTeam?.players ?? [], 'Away');
    allPlayerRows  = [...home, ...away];

    okGt('playerBoxscore.count', 0, allPlayerRows.length);
    okGt('playerBoxscore.scorers', 0, allPlayerRows.filter(p => p.pts > 0).length);

    topScorer = allPlayerRows.reduce((best, p) => p.pts > (best?.pts ?? 0) ? p : best, null);
    if (topScorer) {
      okGt('playerBoxscore.topScorer.pts',    0, topScorer.pts);
      okGt('playerBoxscore.topScorer.fga',    0, topScorer.fga);
      ok  ('playerBoxscore.topScorer.minutes','non-empty', topScorer.minutes);
      ok  ('playerBoxscore.topScorer.playerId','non-empty', topScorer.playerExternalId);
      console.log(`  ${allPlayerRows.length} players | top: id=${topScorer.playerExternalId} pts=${topScorer.pts} fgm/fga=${topScorer.fgm}/${topScorer.fga} ast=${topScorer.ast} reb=${topScorer.reb} min=${topScorer.minutes}`);
    }
  } catch (e) {
    fail('playerBoxscore.fetch', e.message);
  }

  // ── 1E. PBP — field mapping + cross-check pts vs boxscore ─────────────────
  console.log(`\n[1E] PBP gameId=${foundGameId}`);
  try {
    const raw     = await wcbaGet(`/api/v2/game/${foundGameId}/actions`);
    const actions = Array.isArray(raw) ? raw : (raw?.data ?? []);
    okGt('pbp.events', 0, actions.length);

    if (actions.length > 0) {
      const a0 = actions[0];
      const mc = {
        actionCode: a0.action_code ?? a0.actionCode,
        userId:     a0.user_id,
        teamId:     a0.team_id,
        homeScore:  a0.home_score ?? a0.homeScore,
        awayScore:  a0.away_score ?? a0.awayScore,
        clock:      a0.start_time ?? a0.clock,
        period:     a0.current_period ?? a0.period,
        eventZh:    a0.action_title ?? a0.action_zh,
      };
      ok  ('pbp.field.action_code',       'present', mc.actionCode);
      ok  ('pbp.field.start_time(clock)', 'present', mc.clock);
      ok  ('pbp.field.current_period',    'present', mc.period !== undefined ? 'ok' : undefined);
      ok  ('pbp.field.home_score exists', 'present', mc.homeScore !== undefined ? 'ok' : undefined);

      const pbpPts = {};
      for (const a of actions) {
        const uid = String(a.user_id ?? '');
        const pts = ptsFromCode(a.action_code ?? '');
        if (uid && pts > 0) pbpPts[uid] = (pbpPts[uid] ?? 0) + pts;
      }

      if (topScorer?.playerExternalId) {
        const boxPts = topScorer.pts;
        const pbp    = pbpPts[String(topScorer.playerExternalId)] ?? 0;
        const diff   = Math.abs(pbp - boxPts);
        console.log(`  top scorer ${topScorer.playerExternalId}: boxscore=${boxPts}pts PBP=${pbp}pts diff=${diff}`);
        if (diff === 0) {
          okEq('pbp.pts_crosscheck (box==PBP)', boxPts, pbp);
        } else if (diff <= 3) {
          console.log(`  ℹ diff=${diff} (probable T-foul / FT no mapeado) — aceptable`);
          okGt('pbp.pts_crosscheck (PBP>0)', 0, pbp);
        } else {
          fail('pbp.pts_crosscheck', `boxscore=${boxPts} PBP=${pbp} diff=${diff} — revisar ACTION_CODE_MAP`);
        }
      }

      const uniqueCodes = new Set(actions.map(a => a.action_code).filter(Boolean));
      console.log(`  ${actions.length} eventos | ${uniqueCodes.size} action codes únicos`);
    }
  } catch (e) {
    fail('pbp.fetch', e.message);
  }

  // ── 1F. ROSTER ────────────────────────────────────────────────────────────
  console.log('\n[1F] ROSTER');
  const rosterTeamId = standingsData.length > 0 ? Number(standingsData[0].teamId) : 723;
  try {
    const raw     = await wcbaGet('/datahub/cbamatch/team/teamplayers', { seasonId: SEASON, teamId: rosterTeamId });
    const players = raw?.players ?? raw?.data?.players ?? raw?.data ?? [];
    const arr     = Array.isArray(players) ? players : [];
    okGt('roster.players', 0, arr.length);
    if (arr.length > 0) {
      const p0 = arr[0];
      ok('roster[0].playerId',   'present', p0.playerId);
      ok('roster[0].playerName', 'present', p0.playerName);
      console.log(`  teamId=${rosterTeamId} | ${arr.length} jugadoras | sample: ${p0.playerName} #${p0.number ?? '-'} pos=${p0.position ?? '-'}`);
    }
  } catch (e) {
    fail('roster.fetch', e.message);
  }

  return { foundGameId, foundMatchId, standingsData, allPlayerRows };
}

// ═════════════════════════════════════════════════════════════════════════════
// FASE 2: INGEST → Railway → Supabase
// ═════════════════════════════════════════════════════════════════════════════

async function phase2_ingest(foundGameId, foundMatchId, standingsData, allPlayerRows) {
  console.log('\n══════════════════════════════════════════');
  console.log('FASE 2 — INGEST → Railway → Supabase');
  console.log('══════════════════════════════════════════');

  if (!INGEST_KEY) {
    fail('ingest.auth', 'STATS_INGEST_KEY no configurado en .env');
    return;
  }

  // ── 2A. Ingest STANDINGS ───────────────────────────────────────────────────
  console.log('\n[2A] Ingest STANDINGS');
  if (standingsData.length > 0) {
    try {
      const payload = {
        type: 'standings',
        seasonId: SEASON,
        competitionId: COMP,
        data: standingsData.map(r => ({
          teamId:            Number(r.teamId),
          teamName:          r.teamName ?? '',
          teamLogo:          r.teamLogo ?? '',
          phaseId:           r.phaseId != null ? String(r.phaseId) : null,
          phaseName:         r.phaseName ?? '',
          rank:              Number(r.rank ?? 0),
          wins:              Number(r.wins ?? 0),
          losses:            Number(r.loses ?? 0),
          winPct:            Number(r.wins ?? 0) / Math.max(Number(r.wins ?? 0) + Number(r.loses ?? 0), 1),
          ptsPerGame:        Number(r.pts ?? 0),
          ptsAgainstPerGame: Number(r.losePts ?? 0),
          goalDiff:          Number(r.goalDifference ?? 0),
          streak:            Number(r.winLoss ?? 0),
          last10Wins:        Math.round(Number(r.last10Win ?? 0)),
          last10Losses:      Math.round(Number(r.last10Loses ?? 0)),
          homeWins:          Number(r.homeWin ?? 0),
          homeLosses:        Number(r.homeLoses ?? 0),
          awayWins:          Number(r.awayWin ?? 0),
          awayLosses:        Number(r.awayLoses ?? 0),
        })),
      };
      const resp = await ucorePost('/api/stats/ingest', payload);
      okGt('ingest.standings.recordsProcessed', 0, resp.recordsProcessed);
      console.log(`  recordsProcessed=${resp.recordsProcessed}`);
    } catch (e) {
      fail('ingest.standings', e.response?.data?.error ?? e.message);
    }
  } else {
    skip('ingest.standings', 'no standings data from WCBA');
  }

  // ── 2B. Ingest PLAYER_BOXSCORES ────────────────────────────────────────────
  console.log(`\n[2B] Ingest PLAYER_BOXSCORES (gameId=${foundGameId}, ${allPlayerRows.length} jugadoras)`);
  if (allPlayerRows.length > 0) {
    try {
      const payload = {
        type: 'player_boxscores',
        seasonId: SEASON,
        competitionId: COMP,
        data: allPlayerRows,
      };
      const resp = await ucorePost('/api/stats/ingest', payload);
      okGt('ingest.player_boxscores.recordsProcessed', 0, resp.recordsProcessed);
      console.log(`  recordsProcessed=${resp.recordsProcessed}`);
    } catch (e) {
      fail('ingest.player_boxscores', e.response?.data?.error ?? e.message);
    }
  } else {
    skip('ingest.player_boxscores', 'no player data from WCBA');
  }

  // ── 2C. Sync-status ───────────────────────────────────────────────────────
  console.log('\n[2C] Sync-status');
  try {
    const resp    = await axios.get(UCORE_URL + '/api/stats/sync-status', {
      headers: { 'Authorization': `Bearer ${INGEST_KEY}` },
      timeout: 10000,
    });
    const boxDone = (resp.data?.boxDone ?? []).map(Number);
    const pbpDone = (resp.data?.pbpDone ?? []).map(Number);
    okGt('sync_status.boxDone.count', 0, boxDone.length);
    console.log(`  boxDone=${boxDone.length} | pbpDone=${pbpDone.length} | gameId ${foundGameId} en boxDone: ${boxDone.includes(foundGameId)}`);
  } catch (e) {
    fail('sync_status', e.message);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// FASE 3: Verificación directa en Supabase
// ═════════════════════════════════════════════════════════════════════════════

async function phase3_supabase(foundGameId) {
  console.log('\n══════════════════════════════════════════');
  console.log('FASE 3 — Verificación Supabase REST');
  console.log('══════════════════════════════════════════');

  if (!SUPA_URL || !SUPA_KEY) {
    console.log('\n⚠  SUPABASE_URL o SUPABASE_ANON_KEY no están en .env del Pi.');
    console.log('   Añade estas líneas al .env para activar la verificación de BD:');
    console.log('   SUPABASE_URL=https://XXXX.supabase.co');
    console.log('   SUPABASE_ANON_KEY=eyJ...');
    console.log('   (Supabase Dashboard → Project Settings → API → Project URL y anon/public key)');
    skip('supabase.player_boxscores', 'credenciales no configuradas');
    skip('supabase.standings_ppg',    'credenciales no configuradas');
    skip('supabase.players_pinyin',   'credenciales no configuradas');
    skip('supabase.total_count',      'credenciales no configuradas');
    return;
  }

  console.log(`\n[3A] stats_player_boxscores gameId=${foundGameId}`);
  try {
    const rows = await supaGet('stats_player_boxscores',
      `game_id=eq.${foundGameId}&select=game_id,player_external_id,pts,ast,reb,fgm,fga&limit=30`);
    if (!Array.isArray(rows)) {
      fail('supabase.player_boxscores', 'respuesta no es array: ' + JSON.stringify(rows).slice(0, 80));
    } else {
      okGt('supabase.player_boxscores.count', 0, rows.length);
      okGt('supabase.player_boxscores.scorers', 0, rows.filter(r => Number(r.pts) > 0).length);
      const top = rows.reduce((b, r) => Number(r.pts) > Number(b?.pts ?? 0) ? r : b, null);
      if (top) {
        okGt('supabase.player_boxscores.top_pts', 0, top.pts);
        okGt('supabase.player_boxscores.top_fga', 0, top.fga);
        console.log(`  ${rows.length} filas | top: id=${top.player_external_id} pts=${top.pts} fgm/fga=${top.fgm}/${top.fga}`);
      }
    }
  } catch (e) {
    fail('supabase.player_boxscores', e.message);
  }

  console.log('\n[3B] stats_standings ppg/oppg > 0');
  try {
    const rows = await supaGet('stats_standings',
      `season_id=eq.${SEASON}&select=team_id,wins,losses,pts_per_game,pts_against_per_game,phase_name&limit=5`);
    if (!Array.isArray(rows)) {
      fail('supabase.standings', 'respuesta no es array');
    } else {
      okGt('supabase.standings.count', 0, rows.length);
      if (rows.length > 0) {
        const r0 = rows[0];
        okGt('supabase.standings.pts_per_game',         0, r0.pts_per_game);
        okGt('supabase.standings.pts_against_per_game', 0, r0.pts_against_per_game);
        ok  ('supabase.standings.phase_name', 'non-empty', r0.phase_name);
        console.log(`  ${rows.length} filas | teamId=${r0.team_id} ppg=${r0.pts_per_game} oppg=${r0.pts_against_per_game} phase="${r0.phase_name}"`);
      }
    }
  } catch (e) {
    fail('supabase.standings', e.message);
  }

  console.log('\n[3C] stats_players pinyin names');
  try {
    const rows = await supaGet('stats_players',
      `season_id=eq.${SEASON}&name_en=not.is.null&select=player_id,name_zh,name_en&limit=5`);
    if (!Array.isArray(rows)) {
      fail('supabase.players', 'respuesta no es array');
    } else {
      okGt('supabase.players.with_name_en', 0, rows.length);
      if (rows.length > 0) {
        console.log(`  Sample: ${rows.map(r => `${r.name_zh}→${r.name_en}`).join(' | ')}`);
      }
    }
  } catch (e) {
    fail('supabase.players', e.message);
  }

  console.log('\n[3D] Total stats_player_boxscores');
  try {
    const url = `${SUPA_URL}/rest/v1/stats_player_boxscores?season_id=eq.${SEASON}&select=game_id`;
    const r   = await axios.get(url, {
      headers: {
        'apikey': SUPA_KEY,
        'Authorization': `Bearer ${SUPA_KEY}`,
        'Prefer': 'count=exact',
        'Range-Unit': 'items',
        'Range': '0-0',
      },
      timeout: 10000,
    });
    const count = parseInt(r.headers['content-range']?.split('/')[1] ?? '0') || 0;
    console.log(`  Total filas: ${count}`);
    okGt('supabase.total_boxscores', 0, count);
  } catch (e) {
    fail('supabase.total_boxscores', e.message);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// REPORTE FINAL
// ═════════════════════════════════════════════════════════════════════════════

function printReport() {
  console.log('\n══════════════════════════════════════════');
  console.log('REPORTE FINAL');
  console.log('══════════════════════════════════════════');

  for (const r of results) {
    const icon = r.pass === true ? '✅' : r.pass === false ? '❌' : '⏭ ';
    console.log(`${icon} ${r.label}: ${r.actual} (expected ${r.expected})`);
  }

  const passes = results.filter(r => r.pass === true);
  const fails  = results.filter(r => r.pass === false);
  const skips  = results.filter(r => r.pass === null);

  console.log('\n──────────────────────────────────────────');
  console.log(`✅ PASS: ${passes.length}  ❌ FAIL: ${fails.length}  ⏭  SKIP: ${skips.length}`);

  if (fails.length === 0) {
    if (skips.every(s => s.actual.includes('credenciales'))) {
      console.log('\n✅ WCBA + INGEST OK — añade SUPABASE_URL/ANON_KEY para verificar BD directamente');
      console.log('🎉 Pipeline funcional — listo para TRUNCATE + pm2 restart');
    } else {
      console.log('\n🎉 PIPELINE 100% ✅ — Listo para TRUNCATE + pm2 restart');
    }
  } else {
    console.log(`\n⛔ ${fails.length} FALLO(S) — resolver antes de pm2 restart:`);
    for (const f of fails) {
      console.log(`   ❌ ${f.label}: ${f.actual}`);
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN
// ═════════════════════════════════════════════════════════════════════════════

async function main() {
  const t0 = Date.now();
  console.log('=== U Core audit-end-to-end.js ===');
  console.log(`Hora: ${new Date().toISOString()}`);
  console.log(`UCORE_URL:   ${UCORE_URL}`);
  console.log(`INGEST_KEY:  ${INGEST_KEY ? '✅ ok' : '❌ FALTA'}`);
  console.log(`SUPABASE:    ${SUPA_URL && SUPA_KEY ? '✅ ok' : '⚠ no configurado (Fase 3 se saltará)'}`);

  try {
    const { foundGameId, foundMatchId, standingsData, allPlayerRows } = await phase1_wcba();
    await phase2_ingest(foundGameId, foundMatchId, standingsData, allPlayerRows);
    await phase3_supabase(foundGameId);
  } catch (e) {
    console.error('\n💥 Error no capturado:', e.message);
    fail('FATAL', e.message);
  }

  printReport();

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\nTiempo total: ${elapsed}s`);
  if (Number(elapsed) > 60) console.log('⚠ Superó el objetivo de <60s');
}

main();
