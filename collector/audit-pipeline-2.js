/**
 * audit-pipeline-2.js — Encontrar URLs correctas para standings, schedule, roster y PBP
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

const headers = {
  'Referer': 'https://www.cba.net.cn/',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'zh-CN,zh;q=0.9',
};

async function get(path, params) {
  try {
    const url = path.startsWith('http') ? path : BASE + path;
    const r = await axios.get(url, { params, headers, timeout: 8000 });
    const d = r.data?.data ?? r.data;
    const rows = Array.isArray(d) ? d : (d?.list ?? d?.rows ?? d?.records ?? []);
    return { ok: true, rows, raw: d, keys: rows[0] ? Object.keys(rows[0]).join(',') : JSON.stringify(d).slice(0,80) };
  } catch (e) {
    return { ok: false, error: e.response?.status + ' ' + (e.response?.data ? JSON.stringify(e.response.data).slice(0,50) : e.message) };
  }
}

async function probe(label, path, params) {
  const r = await get(path, params);
  if (r.ok) {
    console.log('✅ ' + label + ' — rows:' + r.rows.length + ' keys:' + r.keys);
  } else {
    console.log('❌ ' + label + ': ' + r.error);
  }
  return r;
}

async function main() {
  console.log('=== STANDINGS — probing URLs ===');
  await probe('wcba/teamrankfirst', '/datahub/wcba/teamrankfirst', { competitionId: COMP, seasonId: SEASON });
  await probe('wcba/rank', '/datahub/wcba/rank', { competitionId: COMP, seasonId: SEASON });
  await probe('wcba/standings', '/datahub/wcba/standings', { competitionId: COMP, seasonId: SEASON });
  await probe('wcba/grouprank', '/datahub/wcba/grouprank', { competitionId: COMP, seasonId: SEASON });
  await probe('wcba/leaguerank', '/datahub/wcba/leaguerank', { competitionId: COMP, seasonId: SEASON });
  await probe('wcba/teamrank', '/datahub/wcba/teamrank', { competitionId: COMP, seasonId: SEASON });

  console.log('\n=== SCHEDULE — probing URLs ===');
  await probe('wcba/matchschedules', '/datahub/wcba/matchschedules', { competitionId: COMP, seasonId: SEASON, teamId: '' });
  await probe('wcba/schedule', '/datahub/wcba/schedule', { competitionId: COMP, seasonId: SEASON });
  await probe('wcba/matchlist', '/datahub/wcba/matchlist', { competitionId: COMP, seasonId: SEASON });
  await probe('wcba/gamelist', '/datahub/wcba/gamelist', { competitionId: COMP, seasonId: SEASON });
  await probe('cbamatch/matchschedules', '/datahub/cbamatch/matchschedules', { competitionId: COMP, seasonId: SEASON, teamId: '' });

  console.log('\n=== PBP — verify /api/v2 response ===');
  const pbp = await get('/api/v2/game/' + GAME + '/actions', {});
  if (pbp.ok) {
    console.log('✅ PBP rows:', pbp.rows.length, '| keys:', pbp.keys);
    if (pbp.rows.length > 0) {
      const a = pbp.rows[0];
      console.log('  action_code:', a.action_code ?? a.actionCode);
      console.log('  user_id:', a.user_id ?? a.userId);
      console.log('  team_id:', a.team_id ?? a.teamId);
      console.log('  home_score:', a.home_score ?? a.homeScore);
      console.log('  clock:', a.start_time ?? a.clock);
      console.log('  period:', a.current_period ?? a.period);
    }
  } else {
    console.log('❌ PBP:', pbp.error);
  }

  console.log('\n=== ROSTER — probing URLs ===');
  await probe('wcba/teamplayers', '/datahub/wcba/teamplayers', { seasonId: SEASON, teamId: 723 });
  await probe('wcba/roster', '/datahub/wcba/roster', { seasonId: SEASON, teamId: 723 });
  await probe('wcba/players', '/datahub/wcba/players', { seasonId: SEASON, teamId: 723 });
  await probe('cbamatch/teamplayers', '/datahub/cbamatch/teamplayers', { seasonId: SEASON, teamId: 723 });
}

main().catch(e => console.error('FATAL:', e.message));
