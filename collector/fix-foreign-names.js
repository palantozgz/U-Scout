/**
 * fix-foreign-names.js
 * Busca cada jugadora extranjera (is_foreign=true) en asia-basket.com
 * cruza por número de camiseta y actualiza name_en en stats_players + players.
 *
 * Uso: node fix-foreign-names.js [--dry-run]
 */
const axios = require('./node_modules/axios').default;
const { execSync } = require('child_process');
const fs = require('fs');

const DRY_RUN = process.argv.includes('--dry-run');

// ── Cargar .env ────────────────────────────────────────────────────────────────
const env = fs.readFileSync('./.env', 'utf-8');
for (const line of env.split('\n')) {
  const idx = line.indexOf('=');
  if (idx === -1 || line.startsWith('#')) continue;
  process.env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const sbHeaders = {
  'apikey': SUPABASE_KEY,
  'Authorization': 'Bearer ' + SUPABASE_KEY,
  'Content-Type': 'application/json',
};

// ── Mapa team_external_id → asia-basket team ID ────────────────────────────────
// external_id = WCBA API id | asia-basket id + slug from their WCBA women page
const TEAM_ASIAB = {
  277:   { id: 16016, slug: 'Hebei-Win-Power' },           // Shijiazhuang 石家庄
  710:   { id: 9614,  slug: 'Jiangsu-Yonglian-Nanjing' },  // Jiangsu 江苏
  713:   { id: 9617,  slug: 'Guangdong-Vermilion-Birds' },  // Dongguan 东莞 (Guangdong)
  717:   { id: 8299,  slug: 'Fujian-Zoten' },               // Fujian 福建
  723:   { id: 17772, slug: 'Shanxi-Flame' },               // Shanxi 山西
  726:   { id: 49580, slug: 'Wuhan-Shengfan' },             // Wuhan 武汉
  729:   { id: 32461, slug: 'Shaanxi-Red-Wolves' },         // Shaanxi 陕西
  4900:  { id: 19982, slug: 'Sichuan-Yuanda-Meile-Basketball-Club' }, // Sichuan 四川
  4913:  { id: 20983, slug: 'Xinjiang-Magic-Deer' },        // Xinjiang 新疆
  19038: { id: 10818, slug: 'Zhejiang-Golden-Bulls' },      // Zhejiang 浙江
  20054: { id: 9615,  slug: 'Beijing-Great-Wall' },         // Beijing 北京
  20055: { id: 69709, slug: 'Xiamen-Egrets' },              // Xiamen 厦门
  20064: { id: 9619,  slug: 'Shanghai-Baoshan-Dahua-Swordfish' }, // Shanghai 上海
  20734: { id: 9616,  slug: 'Henan-Phoenix' },              // Henan 河南
  20809: { id: 9466,  slug: 'Liaoning-Henye' },             // Dalian 大连 (Liaoning)
  20917: { id: 71383, slug: 'Hefei' },                      // Hefei 合肥
  21956: { id: 9618,  slug: 'Shandong-Sports-Lottery' },    // Shandong 山东
  // 20915 Jiangxi — no asia-basket entry found
};

const SEASON = '2024-2025';
const DELAY_MS = 1200; // respetar rate limit asia-basket

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Parser roster asia-basket ──────────────────────────────────────────────────
function parseRoster(html) {
  // <td class="mediumfont" translate="no">
  //   <label class="mobileuniformstarting">#22<img ...></label> Yuting<br> Lin
  // </td>
  const rows = [];
  const tdRegex = /<td[^>]*class="mediumfont"[^>]*translate="no"[^>]*>([\s\S]*?)<\/td>/gi;
  let m;
  while ((m = tdRegex.exec(html)) !== null) {
    const cell = m[1];
    const jerseyMatch = cell.match(/#(\d{1,3})/);
    if (!jerseyMatch) continue;
    const jersey = parseInt(jerseyMatch[1], 10);
    // Strip all tags, collapse whitespace
    const name = cell.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
                     .replace(/^#\d{1,3}\s*/, '').trim();
    if (name.length > 2) rows.push({ jersey, name });
  }
  return rows;
}

function fetchRoster(teamId, slug) {
  const url = `https://basketball.asia-basket.com/team/${slug}/${teamId}?Women=1`;
  try {
    const html = execSync(
      `curl -sL "${url}" -H "User-Agent: Mozilla/5.0" --max-time 15`,
      { encoding: 'utf-8', timeout: 20000 }
    );
    return parseRoster(html);
  } catch (e) {
    console.warn(`  ⚠ fetch error for ${slug}: ${e.message}`);
    return [];
  }
}

async function updatePlayerName(externalId, newName, nameZh) {
  if (DRY_RUN) {
    console.log(`  [DRY] ${nameZh} → ${newName}`);
    return;
  }
  // Update stats_players
  await axios.patch(
    `${SUPABASE_URL}/rest/v1/stats_players?external_id=eq.${externalId}`,
    { name_en: newName },
    { headers: { ...sbHeaders, 'Prefer': 'return=minimal' } }
  );
  // Update players (app table) — match by Chinese name
  await axios.patch(
    `${SUPABASE_URL}/rest/v1/players?name=eq.${encodeURIComponent(nameZh)}`,
    { name_en: newName },
    { headers: { ...sbHeaders, 'Prefer': 'return=minimal' } }
  );
  console.log(`  ✓ ${nameZh} → ${newName}`);
}

async function main() {
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`);

  // 1. Obtener todas las jugadoras extranjeras con team external_id + jersey
  const r = await axios.get(
    `${SUPABASE_URL}/rest/v1/stats_players?select=external_id,name_zh,name_en,jersey_number,team_id&is_foreign=eq.true`,
    { headers: sbHeaders }
  );
  const foreignPlayers = r.data;
  console.log(`Foreign players in DB: ${foreignPlayers.length}`);

  // 2. Obtener mapeo team_id → external_id desde stats_teams
  const tr = await axios.get(
    `${SUPABASE_URL}/rest/v1/stats_teams?select=id,external_id`,
    { headers: sbHeaders }
  );
  const teamIdToExternal = {};
  for (const t of tr.data) teamIdToExternal[t.id] = t.external_id;

  // 3. Agrupar jugadoras por team_external_id
  const byTeam = {};
  for (const p of foreignPlayers) {
    const extId = teamIdToExternal[p.team_id];
    if (!extId) continue;
    if (!byTeam[extId]) byTeam[extId] = [];
    byTeam[extId].push(p);
  }

  let updated = 0;
  let notFound = 0;

  // 4. Para cada equipo, fetch roster + cruzar por jersey
  for (const [extIdStr, players] of Object.entries(byTeam)) {
    const extId = Number(extIdStr);
    const teamInfo = TEAM_ASIAB[extId];
    if (!teamInfo) {
      console.log(`\nTeam ${extId}: no asia-basket mapping — skipping ${players.length} players`);
      for (const p of players) console.log(`  skip: ${p.name_zh} #${p.jersey_number}`);
      continue;
    }

    console.log(`\nTeam ${extId} (${teamInfo.slug}):`);
    const roster = fetchRoster(teamInfo.id, teamInfo.slug);
    console.log(`  Roster fetched: ${roster.length} players`);

    for (const p of players) {
      const jerseyNum = p.jersey_number;
      const match = roster.find(r => r.jersey === jerseyNum);
      if (!match) {
        console.log(`  ✗ ${p.name_zh} #${jerseyNum} — not found in roster (current: ${p.name_en})`);
        notFound++;
        continue;
      }
      if (match.name === p.name_en) {
        console.log(`  = ${p.name_zh} #${jerseyNum} — already correct: ${p.name_en}`);
        continue;
      }
      await updatePlayerName(p.external_id, match.name, p.name_zh);
      updated++;
    }

    // rate limit
    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  console.log(`\n✅ Done. Updated: ${updated} | Not found: ${notFound}`);
}

main().catch(e => console.error('ERROR:', e.response?.data ?? e.message));
