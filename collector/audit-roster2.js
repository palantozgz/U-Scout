const fs = require('fs');
const env = fs.readFileSync('./.env', 'utf-8');
for (const line of env.split('\n')) {
  const idx = line.indexOf('=');
  if (idx === -1 || line.startsWith('#')) continue;
  const k = line.slice(0, idx).trim();
  const v = line.slice(idx + 1).trim();
  if (!process.env[k]) process.env[k] = v;
}
const axios = require('./node_modules/axios').default;
axios.get('https://www.cba.net.cn/datahub/cbamatch/team/teamplayers', {
  params: { seasonId: 2092, teamId: 723 },
  headers: { 'Referer': 'https://www.cba.net.cn/', 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
}).then(r => {
  const d = r.data?.data ?? r.data;
  console.log('data keys:', Object.keys(d));
  const arr = d.players ?? d.playerList ?? d.list ?? d.rows ?? d.teamPlayers ?? [];
  console.log('array key found:', Array.isArray(arr) ? 'yes, len=' + arr.length : 'no');
  if (arr.length > 0) console.log('player[0]:', JSON.stringify(arr[0]).slice(0, 200));
  else console.log('full data:', JSON.stringify(d).slice(0, 300));
}).catch(e => console.error(e.message));
