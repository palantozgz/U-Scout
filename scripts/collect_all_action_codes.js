const https = require('https');
const fs = require('fs');

// Todos los external_game_ids confirmados de la temporada
const baseId = 1106508;
const ids = [];
for (let i = baseId; i <= baseId + 300; i++) ids.push(i);

const allCodes = new Map();
let processed = 0;
let withData = 0;
let errors = 0;

function fetchGame(id) {
  return new Promise((resolve) => {
    const url = `https://www.cba.net.cn/api/v2/game/${id}/actions`;
    const req = https.get(url, {
      headers: { 'Referer': 'https://www.cba.net.cn/', 'User-Agent': 'Mozilla/5.0' },
      timeout: 8000
    }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          const events = JSON.parse(data);
          if (Array.isArray(events) && events.length > 0) {
            withData++;
            events.forEach(e => {
              if (e.action_code) {
                allCodes.set(e.action_code, (allCodes.get(e.action_code) || 0) + 1);
              }
            });
          }
        } catch(e) { errors++; }
        resolve();
      });
    });
    req.on('error', () => { errors++; resolve(); });
    req.on('timeout', () => { req.destroy(); errors++; resolve(); });
  });
}

async function run() {
  const BATCH = 8;
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    await Promise.all(batch.map(id => fetchGame(id)));
    processed += batch.length;
    process.stdout.write(`\r${processed}/${ids.length} processed, ${withData} with data, ${errors} errors`);
  }

  const sorted = Array.from(allCodes.entries()).sort((a, b) => b[1] - a[1]);
  fs.writeFileSync('/tmp/all_action_codes.json', JSON.stringify(sorted, null, 2));

  console.log(`\n\n=== RESULTADO ===`);
  console.log(`Total unique action_codes: ${sorted.length}`);
  console.log(`Partidos con datos: ${withData}`);
  console.log(`\nTodos los códigos (ordenados por frecuencia):`);
  sorted.forEach(([code, count]) => console.log(`  ${code}: ${count}`));
}

run().catch(console.error);
