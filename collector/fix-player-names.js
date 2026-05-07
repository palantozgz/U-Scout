/**
 * fix-player-names.js
 * Regenera name_en de todos los stats_players usando pinyin-pro.
 * Actualiza directamente via Supabase REST API (no requiere supabase-js).
 */
const { pinyin } = require('./node_modules/pinyin-pro');
const axios = require('./node_modules/axios').default;
const fs = require('fs');

const env = fs.readFileSync('./.env', 'utf-8');
for (const line of env.split('\n')) {
  const idx = line.indexOf('=');
  if (idx === -1 || line.startsWith('#')) continue;
  const k = line.slice(0, idx).trim();
  const v = line.slice(idx + 1).trim();
  if (!process.env[k]) process.env[k] = v;
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': 'Bearer ' + SUPABASE_KEY,
  'Content-Type': 'application/json',
};

function titleCase(str) {
  return str.split(/\s+/).map(function(w) {
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(' ');
}

function isAsterisked(nameZh) {
  return nameZh.startsWith('*');
}

function toEnglishName(nameZh, nameEn) {
  if (!nameZh) return nameEn ? titleCase(nameEn) : null;
  // Skip asterisk-prefixed entries (non-player markers)
  if (isAsterisked(nameZh)) return nameEn ? titleCase(nameEn) : null;
  // Extract all Chinese characters (ignore dashes and other separators used in foreign names)
  const chineseChars = Array.from(nameZh).filter(c => /[\u4e00-\u9fff]/.test(c));
  if (chineseChars.length < 2) return nameEn ? titleCase(nameEn) : null;
  const syllables = chineseChars.map(c => {
    const p = pinyin(c, { toneType: 'none', type: 'array' });
    return (p[0] || c).toLowerCase();
  });
  // For names with dashes (foreign transliterations), join all syllables as one name block
  if (nameZh.includes('-')) {
    const allSyllables = syllables.join('');
    return allSyllables.charAt(0).toUpperCase() + allSyllables.slice(1);
  }
  // Standard Chinese name: surname (first char) + given name (remaining)
  const surname = syllables[0].charAt(0).toUpperCase() + syllables[0].slice(1);
  const givenRaw = syllables.slice(1).join('');
  const given = givenRaw.charAt(0).toUpperCase() + givenRaw.slice(1);
  return surname + ' ' + given;
}

async function main() {
  // Fetch all players
  const r = await axios.get(SUPABASE_URL + '/rest/v1/stats_players?select=external_id,name_zh,name_en', { headers });
  const players = r.data;
  console.log('Total players:', players.length);

  let updated = 0;
  let skipped = 0;
  for (const p of players) {
    const newName = toEnglishName(p.name_zh, p.name_en);
    if (!newName || newName === p.name_en) { skipped++; continue; }
    await axios.patch(
      SUPABASE_URL + '/rest/v1/stats_players?external_id=eq.' + encodeURIComponent(p.external_id),
      { name_en: newName },
      { headers: { ...headers, 'Prefer': 'return=minimal' } }
    );
    console.log(p.name_zh, '->', newName);
    updated++;
  }
  console.log('\nDone. Updated:', updated, 'Skipped:', skipped);
}

main().catch(e => console.error('ERROR:', e.response?.data ?? e.message));
