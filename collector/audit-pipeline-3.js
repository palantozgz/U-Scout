/**
 * audit-pipeline-3.js — Verifica URLs reales del collector
 */
const fs = require('fs');
const axios = require('./node_modules/axios').default;

const env = fs.readFileSync('./.env', 'utf-8');
for (const line of env.split('\n')) {
  const idx = line.indexOf('=');
  if (idx === -1 || line.startsWith('#')) continue;
  const k = line.slice(0, idx).trim();
  const v = line.slice(idx + 1).trim();
  if (!process.env[k]) process.env[k] = v;
}

const BASE = 'https://www.cba.net.cn';
const SEASON = 2092;
const COMP = 56;
const GAME = 1108582;
const TEAM_ID = 723;

const headers = {
  'Referer': 'https://www.cba.net.cn/',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'zh-CN,zh;q=0.9',
};

async function get(path, params) {
  try {
    const r = await axios.get(BASE + path, { params, headers, timeout: 8000 });
    const d = r.data?.data ?? r.data;
    const rows = Array.isArray(d) ? d : (d?.list ?? d?.rows ?? d?.records ?? []);
    return { ok: true, rows, raw: d };
  } catch (e) {
    return { ok: false, error: e.response?.status + ': ' + e.message };
  }
}

async function main() {
  // 1. STANDINGS
  console.log('=== STANDINGS ===');
  const s = await get('/datahub/cbamatch/rank/teamrankfirst', { competitionId: COMP, seasonId: SEASON });
  if (s.ok) {
    console.log('✅ rows:', s.rows.length);
    if (s.rows[0]) {
      const r = s.rows[0];
      console.log('  keys:', Object.keys(r).join(', '));
      console.log('  teamId:', r.teamId, '| wins:', r.wins, '| loses:', r.loses, '| rank:', r.rank);
      console.log('  pts:', r.pts, '| losePts:', r.losePts, '| phaseName:', r.phaseName);
      const mapped_wins = r.wins ?? 0;
      const mapped_losses = r.loses ?? 0;
      const mapped_ppg = r.pts ?? 0;
      const mapped_oppg = r.losePts ?? 0;
      console.log('  MAPPED → wins:', mapped_wins, 'losses:', mapped_losses, 'ppg:', mapped_ppg, 'oppg:', mapped_oppg);
      console.log('  ppg>0:', Number(mapped_ppg) > 0 ? '✅' : '❌ PROBLEM');
    }
  } else {
    console.log('❌', s.error);
  }

  // 2. PHASES
  console.log('\n=== PHASES (phasemenus) ===');
  const p = await get('/datahub/cbamatch/games/phasemenus', { seasonId: SEASON });
  if (p.ok) {
    console.log('✅ phases:', p.rows.length || JSON.stringify(p.raw).slice(0,100));
    if (p.rows[0]) console.log('  phase[0]:', JSON.stringify(p.rows[0]));
  } else {
    console.log('❌', p.error);
  }

  // 3. SCHEDULE (needs phase+round from phasemenus)
  console.log('\n=== SCHEDULE ===');
  // First get a phase
  const pm = await get('/datahub/cbamatch/games/phasemenus', { seasonId: SEASON });
  if (pm.ok && pm.rows.length > 0) {
    const phaseId = pm.rows[0].phaseId;
    const mm = await get('/datahub/cbamatch/games/matchmenusschedule', { competitionId: COMP, seasonId: SEASON, phaseId });
    if (mm.ok) {
      const rounds = mm.raw?.rounds ?? mm.rows;
      const roundId = Array.isArray(rounds) && rounds[0] ? rounds[0].roundId : 1;
      console.log('  phaseId:', phaseId, '| roundId:', roundId);
      const sc = await get('/datahub/cbamatch/games/matchschedules', { competitionId: COMP, seasonId: SEASON, phaseId, roundId, teamId: '' });
      if (sc.ok) {
        const dates = Array.isArray(sc.raw) ? sc.raw : [];
        const games = dates.flatMap(d => d.games ?? []);
        console.log('✅ games in round:', games.length);
        if (games[0]) {
          const g = games[0];
          console.log('  keys:', Object.keys(g).join(', '));
          console.log('  gameId:', g.gameId, '| homeId:', g.homeId, '| awayId:', g.awayId, '| gameStatus:', g.gameStatus);
        }
      } else console.log('❌ matchschedules:', sc.error);
    } else console.log('❌ matchmenusschedule:', mm.error);
  } else console.log('❌ phasemenus failed or empty');

  // 4. ROSTER
  console.log('\n=== ROSTER ===');
  const roster = await get('/datahub/cbamatch/games/teamplayers', { seasonId: SEASON, teamId: TEAM_ID });
  if (roster.ok) {
    console.log('✅ players:', roster.rows.length);
    if (roster.rows[0]) console.log('  keys:', Object.keys(roster.rows[0]).join(', '));
  } else {
    console.log('❌', roster.error);
    // Try alternative
    const r2 = await get('/datahub/cbamatch/players/teamplayers', { seasonId: SEASON, teamId: TEAM_ID });
    console.log('  alt1:', r2.ok ? '✅ rows:' + r2.rows.length : '❌ ' + r2.error);
  }

  // 5. PBP field mapping
  console.log('\n=== PBP field mapping ===');
  const pbp = await get('/api/v2/game/' + GAME + '/actions', {});
  if (pbp.ok && pbp.rows.length > 0) {
    const a = pbp.rows[0];
    console.log('✅ events:', pbp.rows.length);
    console.log('  keys:', Object.keys(a).join(', '));
    // Verify collector field mapping
    const mapped = {
      actionCode: a.action_code ?? a.actionCode,
      userId: a.user_id ?? a.userId,
      teamId: a.team_id ?? a.teamId,
      homeScore: a.home_score ?? a.homeScore,
      awayScore: a.away_score ?? a.awayScore,
      clock: a.start_time ?? a.clock,
      period: a.current_period ?? a.period,
      eventZh: a.action_title ?? a.action_zh,
    };
    console.log('  MAPPED:', JSON.stringify(mapped));
    const issues = Object.entries(mapped).filter(([k,v]) => v === undefined || v === null);
    if (issues.length === 0) console.log('  All fields OK ✅');
    else console.log('  MISSING fields ❌:', issues.map(([k]) => k).join(', '));
  } else console.log('❌', pbp.error);
}

main().catch(e => console.error('FATAL:', e.message));
