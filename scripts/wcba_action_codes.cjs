const https = require('https');

// Solo los external_game_ids de la WCBA season 2092
// Rango confirmado: 1106508 a ~1106730 pero solo los que están en nuestra DB
// Los IDs continuos que devolvieron datos en el sync: 223 partidos
const ids = [];
for (let i = 1106508; i <= 1106560; i++) ids.push(i); // primeros 53

const allCodes = new Map();
let withData = 0;

function fetch(id) {
  return new Promise(resolve => {
    const url = `https://www.cba.net.cn/api/v2/game/${id}/actions`;
    https.get(url, {
      headers: { 'Referer': 'https://www.cba.net.cn/', 'User-Agent': 'Mozilla/5.0' },
      timeout: 8000
    }, res => {
      let d = '';
      res.on('data', x => d += x);
      res.on('end', () => {
        try {
          const events = JSON.parse(d);
          if (Array.isArray(events) && events.length > 10) {
            // Verificar que es WCBA por team_id (nuestros equipos: 710,713,717,720,723,726,729,277,4900,4913,19038,20054,20064,20734,20809,20915,20917,21956)
            const wcbaTeams = new Set([710,713,717,720,723,726,729,277,4900,4913,19038,20054,20064,20734,20809,20915,20917,21956]);
            const isWCBA = events.some(e => wcbaTeams.has(e.team_id));
            if (isWCBA) {
              withData++;
              events.forEach(e => {
                if (e.action_code) {
                  allCodes.set(e.action_code, (allCodes.get(e.action_code) || 0) + 1);
                }
              });
            }
          }
        } catch(e) {}
        resolve();
      });
    }).on('error', resolve).on('timeout', resolve);
  });
}

async function run() {
  // Cargar todos los external_game_ids de nuestra DB desde stats_games
  // Los tenemos en el rango confirmado
  const allIds = [];
  for (let i = 1106508; i <= 1106730; i++) allIds.push(i);
  
  const BATCH = 10;
  let done = 0;
  for (let i = 0; i < allIds.length; i += BATCH) {
    const batch = allIds.slice(i, i + BATCH);
    await Promise.all(batch.map(id => fetch(id)));
    done += batch.length;
    process.stdout.write(`\r${done}/${allIds.length} checked, ${withData} WCBA games found`);
  }

  const sorted = Array.from(allCodes.entries()).sort((a, b) => b[1] - a[1]);
  console.log(`\n\n=== WCBA ACTION CODES (${withData} games) ===`);
  console.log(`Total unique codes: ${sorted.length}`);
  sorted.forEach(([code, count]) => console.log(`  ${code}: ${count}`));
}

run();
