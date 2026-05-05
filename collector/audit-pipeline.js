/**
 * audit-pipeline.js
 * Audit completo del pipeline: verifica cada endpoint contra la API real
 * y reporta field mapping correcto/incorrecto para cada tipo de dato.
 * Ejecutar: node audit-pipeline.js (desde collector/ en el Pi)
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

const BASE_URL = process.env.WCBA_BASE_URL || 'https://www.cba.net.cn';
const SEASON_ID = 2092;
const COMPETITION_ID = 56;
const TEST_GAME_ID = 1108582;
const TEST_MATCH_ID = 2603;

const headers = {
  'Referer': 'https://www.cba.net.cn/',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'zh-CN,zh;q=0.9',
};

async function get(url, params) {
  try {
    const r = await axios.get(BASE_URL + url, { params, headers, timeout: 10000 });
    return { ok: true, data: r.data?.data ?? r.data, status: r.status };
  } catch (e) {
    return { ok: false, error: e.response?.status + ' ' + e.message };
  }
}

function check(label, value, expected) {
  const ok = value !== undefined && value !== null && value !== '' && value !== 0 || expected === 'any';
  const expectedOk = expected === undefined || value === expected || expected === 'any' || (expected === '>0' && Number(value) > 0);
  const pass = ok && expectedOk;
  console.log('  ' + (pass ? '✅' : '❌') + ' ' + label + ': ' + JSON.stringify(value));
  return pass;
}

async function auditStandings() {
  console.log('\n=== STANDINGS ===');
  const r = await get('/datahub/wcba/teamrankfirst', { competitionId: COMPETITION_ID, seasonId: SEASON_ID });
  if (!r.ok) { console.log('❌ FETCH FAILED:', r.error); return false; }
  const rows = Array.isArray(r.data) ? r.data : (r.data?.list ?? r.data?.rows ?? []);
  console.log('  Rows:', rows.length);
  if (rows.length === 0) { console.log('❌ No data'); return false; }
  const row = rows[0];
  console.log('  Raw sample keys:', Object.keys(row).join(', '));
  check('teamId', row.teamId, '>0');
  check('teamName', row.teamName, 'any');
  check('wins', row.wins ?? row.winCount ?? row.win, '>0');
  check('losses', row.losses ?? row.lossCount ?? row.lose, 'any');
  check('rank', row.rank ?? row.rankNo, '>0');
  check('phaseName', row.phaseName ?? row.phaseTitle ?? row.phase, 'any');
  return true;
}

async function auditSchedule() {
  console.log('\n=== SCHEDULE ===');
  const r = await get('/datahub/wcba/matchschedules', { competitionId: COMPETITION_ID, seasonId: SEASON_ID, teamId: '' });
  if (!r.ok) { console.log('❌ FETCH FAILED:', r.error); return false; }
  const rows = Array.isArray(r.data) ? r.data : (r.data?.list ?? r.data?.rows ?? []);
  console.log('  Rows:', rows.length);
  if (rows.length === 0) { console.log('❌ No data'); return false; }
  const row = rows[0];
  console.log('  Raw sample keys:', Object.keys(row).join(', '));
  check('gameId', row.gameId, '>0');
  check('matchId', row.matchId, 'any');
  check('homeTeamId', row.homeTeamId, '>0');
  check('awayTeamId', row.awayTeamId, '>0');
  check('status', row.status, 'any');
  return true;
}

async function auditBoxscore() {
  console.log('\n=== BOXSCORE (game scores) ===');
  const r = await get('/datahub/cbamatch/games/matchinfoscores', { matchId: TEST_MATCH_ID, gameId: TEST_GAME_ID });
  if (!r.ok) { console.log('❌ FETCH FAILED:', r.error); return false; }
  console.log('  Raw top-level keys:', Object.keys(r.data).join(', '));
  check('home.teamScore', r.data.home?.teamScore, '>0');
  check('away.teamScore', r.data.away?.teamScore, '>0');
  check('home.periodScores', r.data.home?.periodScores, 'any');
  return true;
}

async function auditPlayerBoxscore() {
  console.log('\n=== PLAYER BOXSCORE ===');
  const r = await get('/datahub/cbamatch/games/player/playerdata', { gameId: TEST_GAME_ID });
  if (!r.ok) { console.log('❌ FETCH FAILED:', r.error); return false; }
  const arr = Array.isArray(r.data) ? r.data : [];
  const home = arr.find(t => t.teamType === 'Home');
  const p = home?.teamPlayerData?.[0];
  if (!p) { console.log('❌ No player data'); return false; }
  console.log('  Raw player keys:', Object.keys(p).join(', '));
  check('points (pts)', p.points, '>0');
  check('rebound (reb)', p.rebound, '>0');
  check('assists (ast)', p.assists, 'any');
  check('shot (fgm/fga)', p.shot, 'any');
  check('threePoints (tpm/tpa)', p.threePoints, 'any');
  check('foulShot (ftm/fta)', p.foulShot, 'any');
  check('minutes', p.minutes, 'any');
  check('playerId', p.playerId, '>0');
  return true;
}

async function auditPBP() {
  console.log('\n=== PBP ===');
  // Test current URL in collector
  const url1 = '/api/v2/game/' + TEST_GAME_ID + '/actions';
  const r1 = await get(url1, {});
  console.log('  URL1 (' + url1 + '):', r1.ok ? '✅ ' + r1.status : '❌ ' + r1.error);

  // Test alternative URLs
  const urls = [
    '/datahub/wcba/pbp?gameId=' + TEST_GAME_ID,
    '/datahub/cbamatch/games/pbp?gameId=' + TEST_GAME_ID,
    '/datahub/wcbamatch/games/pbp?gameId=' + TEST_GAME_ID,
    '/datahub/cbamatch/pbp?gameId=' + TEST_GAME_ID,
  ];
  for (const url of urls) {
    const r = await get(url, {});
    console.log('  ' + url + ': ' + (r.ok ? '✅ rows=' + (Array.isArray(r.data) ? r.data.length : JSON.stringify(r.data).slice(0,50)) : '❌ ' + r.error));
  }

  // Also try phasemenus to find correct PBP endpoint
  const r2 = await get('/datahub/wcba/phasemenus', { competitionId: COMPETITION_ID, seasonId: SEASON_ID });
  console.log('  phasemenus:', r2.ok ? '✅' : '❌ ' + r2.error);
  return true;
}

async function auditRoster() {
  console.log('\n=== ROSTER ===');
  // Get a real teamId first from schedule
  const r = await get('/datahub/wcba/matchschedules', { competitionId: COMPETITION_ID, seasonId: SEASON_ID, teamId: '' });
  const rows = Array.isArray(r.data) ? r.data : (r.data?.list ?? []);
  const teamId = rows[0]?.homeTeamId;
  if (!teamId) { console.log('❌ No teamId available'); return false; }
  const r2 = await get('/datahub/wcba/teamplayers', { seasonId: SEASON_ID, teamId });
  if (!r2.ok) { console.log('❌ FETCH FAILED:', r2.error); return false; }
  const players = Array.isArray(r2.data) ? r2.data : (r2.data?.list ?? []);
  console.log('  Players:', players.length);
  if (players.length > 0) {
    const p = players[0];
    console.log('  Raw player keys:', Object.keys(p).join(', '));
    check('playerId', p.playerId, '>0');
    check('playerName', p.playerName, 'any');
  }
  return true;
}

async function main() {
  console.log('WCBA Pipeline Audit — Base URL:', BASE_URL);
  console.log('Test game:', TEST_GAME_ID, '| Match:', TEST_MATCH_ID, '| Season:', SEASON_ID);

  await auditStandings();
  await auditSchedule();
  await auditBoxscore();
  await auditPlayerBoxscore();
  await auditPBP();
  await auditRoster();

  console.log('\n=== DONE ===');
}

main().catch(e => console.error('FATAL:', e.message));
