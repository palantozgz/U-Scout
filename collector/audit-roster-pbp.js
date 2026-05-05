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
    const rows = Array.isArray(d) ? d : (d?.list ?? d?.players ?? d?.rows ?? []);
    return { ok: true, rows, raw: d };
  } catch (e) { return { ok: false, error: e.response?.status + ': ' + e.message }; }
}
async function probe(label, path, params) {
  const r = await get(path, params);
  console.log((r.ok && r.rows.length > 0 ? '✅' : '❌') + ' ' + label + ': ' + (r.ok ? 'rows=' + r.rows.length + (r.rows[0] ? ' keys=' + Object.keys(r.rows[0]).slice(0,6).join(',') : ' raw=' + JSON.stringify(r.raw).slice(0,60)) : r.error));
}
async function main() {
  console.log('=== ROSTER URL PROBE teamId=' + TEAM_ID + ' season=' + SEASON + ' ===');
  await probe('cbamatch/games/teamplayers',   '/datahub/cbamatch/games/teamplayers',   { seasonId: SEASON, teamId: TEAM_ID });
  await probe('cbamatch/team/teamplayers',    '/datahub/cbamatch/team/teamplayers',    { seasonId: SEASON, teamId: TEAM_ID });
  await probe('cbamatch/games/teamplayerlist','/datahub/cbamatch/games/teamplayerlist',{ seasonId: SEASON, teamId: TEAM_ID });
  await probe('cbamatch/games/playerlist',    '/datahub/cbamatch/games/playerlist',    { seasonId: SEASON, teamId: TEAM_ID });
  await probe('cbamatch/player/teamplayers',  '/datahub/cbamatch/player/teamplayers',  { seasonId: SEASON, teamId: TEAM_ID });
  await probe('cbamatch/games/roster',        '/datahub/cbamatch/games/roster',        { seasonId: SEASON, teamId: TEAM_ID });
  await probe('cbamatch/rank/teamplayers',    '/datahub/cbamatch/rank/teamplayers',    { seasonId: SEASON, teamId: TEAM_ID });
  await probe('cbamatch/games/teaminfo',      '/datahub/cbamatch/games/teaminfo',      { seasonId: SEASON, teamId: TEAM_ID });
  await probe('cbamatch/games/matchplayerlist','/datahub/cbamatch/games/matchplayerlist',{ seasonId: SEASON, teamId: TEAM_ID });
  // Try with competitionId too
  await probe('cbamatch/games/teamplayers+comp', '/datahub/cbamatch/games/teamplayers', { seasonId: SEASON, teamId: TEAM_ID, competitionId: 56 });
  await probe('cbamatch/games/playerdata',    '/datahub/cbamatch/games/playerdata',    { seasonId: SEASON, teamId: TEAM_ID });

  // Also check PBP-derived stats vs boxscore
  console.log('\n=== PBP vs BOXSCORE consistency check ===');
  const pbp = await get('/api/v2/game/1108582/actions', {});
  if (pbp.ok) {
    const events = Array.isArray(pbp.raw) ? pbp.raw : [];
    // Calculate pts from PBP for player 530931
    const PLAYER = '530931';
    let pbpPts = 0;
    for (const e of events) {
      const uid = String(e.user_id ?? '');
      const code = e.action_code ?? '';
      if (uid === PLAYER) {
        if (['2PMJMP','2PMLAY','2PMDLA','2PMHOK','2PMTIP','2PMFLO','2PMTLA','2PMSBK','2PMTRN','2PMFAD','2PMFLT','2PMPUL','MADE2'].includes(code)) pbpPts += 2;
        else if (['3PMJMP','3PMCOR','3PMSBK','3PMFAD','3PMPUL','MADE3'].includes(code)) pbpPts += 3;
        else if (['FTH11M','FTH21M','FTH22M','FTH31M','FTH32M','FTH33M'].includes(code)) pbpPts += 1;
      }
    }
    console.log('Player 530931 pts from PBP:', pbpPts, '| Expected from boxscore: 18');
    console.log(pbpPts > 0 ? '✅ PBP has scoring data' : '❌ PBP scoring empty — action codes may not match');
    // Show all action codes for this player
    const playerCodes = events.filter(e => String(e.user_id) === PLAYER).map(e => e.action_code);
    console.log('Player action codes:', [...new Set(playerCodes)].join(', '));
  }
}
main().catch(e => console.error('FATAL:', e.message));
