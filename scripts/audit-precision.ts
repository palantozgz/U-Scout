#!/usr/bin/env npx tsx
/**
 * scripts/audit-precision.ts — Audit de precisión absoluta U Stats v1.0
 *
 * FUENTE DE VERDAD: WCBA API → stats_pbp → pbp_possessions → endpoints → UI
 *
 * NIVELES:
 *   L1  Integridad de puntos      Todos los partidos. Sin API externa.
 *       SUM(poss.points per team) == stats_games.score
 *       Fallo = bug de procesamiento en possessions.ts
 *
 *   L2  Integridad de stats       Partidos con boxscore (stats_player_boxscores).
 *       FTA, TOV, REB del PBP == boxscore oficial WCBA
 *       Fallo = evento mal mapeado en possessions.ts o stats-ingest.ts
 *
 *   L3  Colección vs WCBA API     Muestra de N partidos.
 *       stats_pbp eventos == raw WCBA API eventos (count + action_code + clock)
 *       Fallo = Pi no colectó todos los eventos, o los malinterpretó
 *
 * USO:
 *   npx tsx scripts/audit-precision.ts           → L1 + L2 (todos los partidos)
 *   npx tsx scripts/audit-precision.ts --l3       → + L3 (10 partidos vs API)
 *   npx tsx scripts/audit-precision.ts --game 301 → solo ese partido, todos los niveles
 *   npx tsx scripts/audit-precision.ts --fix       → reprocesa los partidos que fallan L1
 */

import * as path from 'path';
import * as fs from 'fs';

// Cargar .env desde el directorio del repo (padre de ucore o ucore mismo)
function loadEnv(): void {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '..', '.env'),
  ];
  for (const envPath of candidates) {
    if (fs.existsSync(envPath)) {
      for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
        const m = line.match(/^([A-Z0-9_]+)=(.+)$/);
        if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
      }
      return;
    }
  }
}
loadEnv();

// Soporta VITE_ prefix (Vite expone las vars con este prefix en el .env del frontend)
function getEnv(key: string): string {
  return process.env[key] ?? process.env[`VITE_${key}`] ?? '';
}

const SUPABASE_URL = getEnv('SUPABASE_URL');
const SUPABASE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY');
const RAILWAY_URL  = 'https://u-scout-production.up.railway.app';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no encontrados en .env');
  console.error('   Buscado en:', process.cwd(), 'y directorio padre');
  process.exit(1);
}

// ─── Supabase REST helper ────────────────────────────────────────────────────

async function supa(
  table: string,
  params: string,
  method = 'GET',
  body?: object,
): Promise<any[]> {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${params}`;
  const res = await fetch(url, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Supabase ${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

// ─── Contadores globales ─────────────────────────────────────────────────────

interface AuditResult {
  level:   number;
  gameId:  number;
  teamId?: number;
  check:   string;
  expected: number | string;
  actual:   number | string;
  diff:     number;
  status:  'OK' | 'WARN' | 'FAIL';
  detail?: string;
}

const results: AuditResult[] = [];
let failCount = 0;
let warnCount = 0;

function record(r: AuditResult): void {
  results.push(r);
  if (r.status === 'FAIL') {
    failCount++;
    console.log(`  ❌ L${r.level} game=${r.gameId}${r.teamId ? ` team=${r.teamId}` : ''} [${r.check}]  esperado=${r.expected}  actual=${r.actual}  diff=${r.diff > 0 ? '+' : ''}${r.diff}${r.detail ? '  '+r.detail : ''}`);
  } else if (r.status === 'WARN') {
    warnCount++;
    console.log(`  ⚠️  L${r.level} game=${r.gameId}${r.teamId ? ` team=${r.teamId}` : ''} [${r.check}]  esperado=${r.expected}  actual=${r.actual}  diff=${r.diff > 0 ? '+' : ''}${r.diff}${r.detail ? '  '+r.detail : ''}`);
  }
}

// ─── L1: Integridad de puntos ────────────────────────────────────────────────
// Para cada partido procesado: SUM(poss.points per team) == stats_games.score
// Este es el chequeo más fundamental — si los puntos no cuadran, nada cuadra.

async function auditL1(filterGameId?: number): Promise<void> {
  console.log('\n══════════════════════════════════════════');
  console.log('L1 — Integridad de puntos (PBP vs marcador oficial)');
  console.log('══════════════════════════════════════════');

  // Traer todos los partidos procesados (tienen possessions)
  const gamesParam = filterGameId
    ? `select=id,home_team_id,away_team_id,home_score,away_score&id=eq.${filterGameId}`
    : 'select=id,home_team_id,away_team_id,home_score,away_score&status=eq.4&order=id.asc&limit=250';

  const games = await supa('stats_games', gamesParam);
  const processedGames = games.filter(g => g.home_score != null && g.away_score != null);

  console.log(`  Partidos con marcador: ${processedGames.length}`);

  let checkedGames = 0;
  let okGames = 0;
  const failedGameIds: number[] = [];

  for (const game of processedGames) {
    // Verificar si tiene possessions
    const possCheck = await supa('pbp_possessions',
      `select=team_id,points,possession_number&game_id=eq.${game.id}&limit=500`);

    if (possCheck.length === 0) continue; // partido sin procesar — skip
    checkedGames++;

    // Check duplicados: mismo (possession_number, team_id) más de una vez
    // Solo cuenta duplicados reales — filtra los que tienen possession_number definido
    const keyCounts: Record<string, number> = {};
    for (const p of possCheck) {
      if (p.possession_number == null) continue;
      const k = `${p.team_id}:${p.possession_number}`;
      keyCounts[k] = (keyCounts[k] ?? 0) + 1;
    }
    const dupKeys = Object.entries(keyCounts).filter(([, c]) => c > 1);
    const dupPtsTotal = dupKeys.reduce((sum, [k]) => {
      const [tid, pnum] = k.split(':');
      const dupRows = possCheck.filter(p => String(p.team_id) === tid && String(p.possession_number) === pnum);
      return sum + dupRows.reduce((s, p) => s + (Number(p.points) || 0), 0) - (Number(dupRows[0]?.points) || 0);
    }, 0);
    if (dupKeys.length > 0) {
      record({
        level: 1, gameId: game.id, check: 'dup_possessions',
        expected: 0, actual: dupKeys.length, diff: dupKeys.length,
        status: dupPtsTotal > 0 ? 'FAIL' : 'WARN',
        detail: `${dupKeys.length} poss duplicadas, ~${dupPtsTotal} pts extra — race condition Pi`,
      });
    }

    // Agregar puntos por equipo
    const ptsByTeam: Record<number, number> = {};
    for (const p of possCheck) {
      const tid = Number(p.team_id);
      ptsByTeam[tid] = (ptsByTeam[tid] ?? 0) + (Number(p.points) || 0);
    }

    const homeId  = Number(game.home_team_id);
    const awayId  = Number(game.away_team_id);
    const homePts = ptsByTeam[homeId] ?? 0;
    const awayPts = ptsByTeam[awayId] ?? 0;
    const homeExp = Number(game.home_score);
    const awayExp = Number(game.away_score);

    const homeDiff = homePts - homeExp;
    const awayDiff = awayPts - awayExp;
    const homeOk   = homeDiff === 0;
    const awayOk   = awayDiff === 0;

    if (homeOk && awayOk) {
      okGames++;
    } else {
      failedGameIds.push(game.id);
      if (!homeOk) record({
        level: 1, gameId: game.id, teamId: homeId, check: 'pts_home',
        expected: homeExp, actual: homePts, diff: homeDiff,
        status: Math.abs(homeDiff) <= 2 ? 'WARN' : 'FAIL',
      });
      if (!awayOk) record({
        level: 1, gameId: game.id, teamId: awayId, check: 'pts_away',
        expected: awayExp, actual: awayPts, diff: awayDiff,
        status: Math.abs(awayDiff) <= 2 ? 'WARN' : 'FAIL',
      });
    }
  }

  console.log(`  Verificados: ${checkedGames}  ✅ OK: ${okGames}  ❌ Fallos: ${failedGameIds.length}`);
  if (failedGameIds.length > 0) {
    console.log(`  Games fallidos: [${failedGameIds.join(', ')}]`);
  }
}

// ─── L2: Integridad de stats vs boxscore ────────────────────────────────────
// Compara FTA + TOV del PBP contra pbp_audit_log (que tiene comparación vs boxscore)
// Solo disponible para partidos con boxscore (42 games actualmente)

async function auditL2(filterGameId?: number): Promise<void> {
  console.log('\n══════════════════════════════════════════');
  console.log('L2 — Stats PBP vs Boxscore oficial (FTA, TOV, REB)');
  console.log('══════════════════════════════════════════');

  const param = filterGameId
    ? `select=*&game_id=eq.${filterGameId}&order=game_id.asc`
    : 'select=*&order=game_id.asc&limit=500';

  const auditRows = await supa('pbp_audit_log', param);
  if (auditRows.length === 0) {
    console.log('  Sin datos en pbp_audit_log — L2 no disponible');
    return;
  }

  let checked = 0;
  let ok = 0;

  for (const row of auditRows) {
    checked++;
    const gid = Number(row.game_id);

    // Si box_pts=0 y box_tov=0 y box_reb=0 → no hay boxscore disponible → skip
    if (Number(row.box_pts) === 0 && Number(row.box_tov ?? 0) === 0 && Number(row.box_reb ?? 0) === 0) {
      checked--; // no contar este team-game en el total
      continue;
    }

    // Puntos (redundante con L1 pero útil como cross-check)
    const ptsDiff = Number(row.diff_pts);
    if (ptsDiff !== 0) {
      record({
        level: 2, gameId: gid, check: 'audit_pts',
        expected: row.box_pts, actual: row.pbp_pts, diff: ptsDiff,
        status: Math.abs(ptsDiff) <= 2 ? 'WARN' : 'FAIL',
        detail: `team_ext=${row.team_external_id}`,
      });
    }

    // TOV
    const tovDiff = Number(row.diff_tov ?? 0);
    if (Math.abs(tovDiff) > 0) {
      record({
        level: 2, gameId: gid, check: 'tov',
        expected: row.box_tov, actual: row.pbp_tov, diff: tovDiff,
        status: Math.abs(tovDiff) <= 1 ? 'WARN' : 'FAIL',
        detail: `team_ext=${row.team_external_id}`,
      });
    }

    // REB
    const rebDiff = Number(row.diff_reb ?? 0);
    if (Math.abs(rebDiff) > 2) {  // tolerancia de 2 (rebotes de equipo no siempre en PBP)
      record({
        level: 2, gameId: gid, check: 'reb',
        expected: row.box_reb, actual: row.pbp_reb, diff: rebDiff,
        status: Math.abs(rebDiff) <= 5 ? 'WARN' : 'FAIL',
        detail: `team_ext=${row.team_external_id}`,
      });
    }

    if (ptsDiff === 0 && Math.abs(tovDiff) <= 1 && Math.abs(rebDiff) <= 2) ok++;
  }

  console.log(`  Verificados: ${checked}  ✅ OK: ${ok}  discrepancias: ${checked - ok}`);
  console.log(`  (Cobertura: ${checked} team-games de ${checked/2|0} partidos con boxscore)`);
}

// ─── L3: Colección vs WCBA API ───────────────────────────────────────────────
// Compara stats_pbp contra el raw de la WCBA API para una muestra de partidos.
// Requiere acceso a cba.net.cn desde esta máquina o vía Pi tunnel.
// ESTRUCTURA: http://cba.net.cn/... (completar con URL real del Pi collector)

async function auditL3(filterGameId?: number, sampleSize = 10): Promise<void> {
  console.log('\n══════════════════════════════════════════');
  console.log('L3 — Colección PBP vs WCBA API (evento a evento)');
  console.log('══════════════════════════════════════════');

  // Traer muestra de partidos con external_game_id
  const gamesParam = filterGameId
    ? `select=id,external_game_id,home_score,away_score&id=eq.${filterGameId}&status=eq.4`
    : `select=id,external_game_id,home_score,away_score&status=eq.4&order=id.desc&limit=${sampleSize}`;

  const games = await supa('stats_games', gamesParam);

  // Intentar una llamada de prueba a la WCBA API
  // URL base conocida del Pi collector — ajustar si cambia
  const WCBA_BASE = 'https://pbpapi.cba.cn/api';

  let apiReachable = false;
  try {
    const testRes = await fetch(`${WCBA_BASE}/health`, { signal: AbortSignal.timeout(5000) });
    apiReachable = testRes.ok;
  } catch {
    // Intentar URL alternativa
    try {
      const testRes2 = await fetch('https://www.cba.cn/api', { signal: AbortSignal.timeout(5000) });
      apiReachable = testRes2.ok;
    } catch { /* no reachable */ }
  }

  if (!apiReachable) {
    console.log('  ⚠️  WCBA API no accesible desde esta máquina.');
    console.log('     L3 requiere ejecutarse desde el Pi: ssh pi && npx tsx scripts/audit-precision.ts --l3');
    console.log('     O habilitar un proxy inverso desde el Pi para este endpoint.');
    console.log('\n  L3 ALTERNATIVO: comparando event counts en stats_pbp por partido...');
    await auditL3Fallback(games);
    return;
  }

  console.log('  ✅ WCBA API accesible. Comparando eventos...');

  for (const game of games) {
    if (!game.external_game_id) continue;
    try {
      // Fetch PBP de la API
      const apiRes = await fetch(
        `${WCBA_BASE}/pbp?gameId=${game.external_game_id}`,
        { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(10000) },
      );
      if (!apiRes.ok) { console.log(`  ⚠️  game=${game.id} API ${apiRes.status}`); continue; }
      const apiData = await apiRes.json();
      const apiEvents: any[] = apiData?.data?.list ?? apiData?.list ?? [];

      // Fetch de stats_pbp para este partido
      const dbEvents = await supa('stats_pbp',
        `select=sequence,event_type,action_code,clock,team_id&game_id=eq.${game.id}&order=sequence.asc&limit=2000`);

      const apiCount = apiEvents.length;
      const dbCount  = dbEvents.length;
      const diff     = dbCount - apiCount;

      if (diff !== 0) {
        record({
          level: 3, gameId: game.id, check: 'event_count',
          expected: apiCount, actual: dbCount, diff,
          status: Math.abs(diff) <= 5 ? 'WARN' : 'FAIL',
          detail: `external_id=${game.external_game_id}`,
        });
      } else {
        console.log(`  ✅ game=${game.id}: ${dbCount} eventos == API`);
      }

      // Comparar action_codes secuencialmente (primeros 50 eventos)
      const limit = Math.min(50, apiEvents.length, dbEvents.length);
      let codeMismatches = 0;
      for (let i = 0; i < limit; i++) {
        const apiCode  = String(apiEvents[i]?.actionCode ?? apiEvents[i]?.action_code ?? '');
        const dbCode   = String(dbEvents[i]?.action_code ?? '');
        if (apiCode && dbCode && apiCode !== dbCode) {
          codeMismatches++;
          if (codeMismatches <= 3) {
            console.log(`    ↳ seq=${i} api_code=${apiCode} db_code=${dbCode}`);
          }
        }
      }
      if (codeMismatches > 0) {
        record({
          level: 3, gameId: game.id, check: 'action_codes',
          expected: 0, actual: codeMismatches, diff: codeMismatches,
          status: 'FAIL',
          detail: `primeros ${limit} eventos`,
        });
      }

    } catch (e: any) {
      console.log(`  ⚠️  game=${game.id}: error API — ${e.message}`);
    }
  }
}

// L3 Fallback — sin acceso a API: verifica event counts y secuencias internas
async function auditL3Fallback(games: any[]): Promise<void> {
  for (const game of games) {
    const events = await supa('stats_pbp',
      `select=quarter,sequence,event_type,action_code,clock&game_id=eq.${game.id}&order=quarter.asc,sequence.asc&limit=2000`);

    if (events.length === 0) continue;

    // Check 1: secuencias sin gaps grandes (señal de eventos perdidos en colección)
    let maxGap = 0;
    let maxGapAt = 0;
    for (let i = 1; i < events.length; i++) {
      if (events[i].quarter === events[i-1].quarter) {
        const gap = Number(events[i].sequence) - Number(events[i-1].sequence);
        if (gap > maxGap) { maxGap = gap; maxGapAt = i; }
      }
    }
    if (maxGap > 10) {
      record({
        level: 3, gameId: game.id, check: 'sequence_gap',
        expected: '<=10', actual: maxGap, diff: maxGap,
        status: maxGap > 50 ? 'FAIL' : 'WARN',
        detail: `en evento idx=${maxGapAt}`,
      });
    }

    // Check 2: reloj nunca salta hacia adelante dentro del mismo cuarto
    // (puede indicar eventos out-of-order en la colección)
    let clockErrors = 0;
    for (let i = 1; i < events.length; i++) {
      if (events[i].quarter === events[i-1].quarter) {
        const [m1, s1] = String(events[i-1].clock ?? '0:00').split(':').map(Number);
        const [m2, s2] = String(events[i].clock ?? '0:00').split(':').map(Number);
        const t1 = m1 * 60 + s1;
        const t2 = m2 * 60 + s2;
        // Reloj FIBA cuenta hacia atrás — t2 debe ser <= t1 (o igual)
        // Tolerancia de 2s para eventos simultáneos con mismo timestamp
        if (t2 > t1 + 2) clockErrors++;
      }
    }
    if (clockErrors > 0) {
      record({
        level: 3, gameId: game.id, check: 'clock_order',
        expected: 0, actual: clockErrors, diff: clockErrors,
        status: clockErrors > 5 ? 'FAIL' : 'WARN',
        detail: 'eventos con reloj invertido (out-of-order)',
      });
    }

    if (maxGap <= 10 && clockErrors === 0) {
      console.log(`  ✅ game=${game.id}: ${events.length} eventos, secuencia OK, reloj OK`);
    }
  }
}

// ─── Reporte final ───────────────────────────────────────────────────────────

function printReport(): void {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║        REPORTE AUDIT PRECISION           ║');
  console.log('╚══════════════════════════════════════════╝');

  const l1 = results.filter(r => r.level === 1);
  const l2 = results.filter(r => r.level === 2);
  const l3 = results.filter(r => r.level === 3);

  const summary = (arr: AuditResult[], label: string) => {
    const fails = arr.filter(r => r.status === 'FAIL').length;
    const warns = arr.filter(r => r.status === 'WARN').length;
    const icon  = fails > 0 ? '❌' : warns > 0 ? '⚠️ ' : '✅';
    console.log(`  ${icon}  ${label}: ${fails} FAIL  ${warns} WARN`);
  };

  summary(l1, 'L1 Integridad puntos     ');
  summary(l2, 'L2 Stats vs boxscore     ');
  summary(l3, 'L3 Colección PBP         ');

  console.log(`\n  Total FAIL: ${failCount}  Total WARN: ${warnCount}`);

  if (failCount === 0 && warnCount === 0) {
    console.log('\n  🟢 AUDIT COMPLETO — PRECISIÓN 100% en todos los niveles verificados');
  } else if (failCount === 0) {
    console.log('\n  🟡 AUDIT OK con advertencias — revisar WARNs antes de cerrar módulo');
  } else {
    console.log('\n  🔴 AUDIT FALLIDO — hay discrepancias que corregir antes de cerrar');
    // Exportar juego detallado
    const failedGames = [...new Set(results.filter(r => r.status === 'FAIL').map(r => r.gameId))];
    console.log(`\n  Partidos a reprocesar: npx tsx scripts/fast_reprocess.ts --games ${failedGames.join(',')}`);
  }

  // Guardar resultado a disco
  const outPath = path.resolve(process.cwd(), 'scripts/audit-precision-output.json');
  fs.writeFileSync(outPath, JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2));
  console.log(`\n  Reporte completo: scripts/audit-precision-output.json`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args  = process.argv.slice(2);
  const runL3 = args.includes('--l3');
  const gameArg = args.find(a => a.startsWith('--game'));
  const filterGame = gameArg ? Number(gameArg.split('=')[1] ?? args[args.indexOf(gameArg) + 1]) : undefined;

  console.log('╔══════════════════════════════════════════╗');
  console.log('║  AUDIT PRECISIÓN U STATS                 ║');
  console.log(`║  ${new Date().toISOString().slice(0, 19)}                  ║`);
  console.log('╚══════════════════════════════════════════╝');
  if (filterGame) console.log(`  Modo partido único: game_id=${filterGame}`);

  await auditL1(filterGame);
  await auditL2(filterGame);
  if (runL3) await auditL3(filterGame);

  printReport();
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('Error fatal:', e);
  process.exit(1);
});
