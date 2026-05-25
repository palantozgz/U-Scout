const https = require('https');

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
          const found = events.filter(e => e.action_code === '2PMDUK');
          if (found.length > 0) {
            console.log(`\n=== Game ${id} — ${found.length} events ===`);
            console.log(JSON.stringify(found[0], null, 2));
            process.exit(0); // parar al primer resultado
          }
        } catch(e) {}
        resolve();
      });
    }).on('error', resolve).on('timeout', resolve);
  });
}

async function run() {
  console.log('Buscando 2PMDUK...');
  for (let id = 1106508; id <= 1106810; id++) {
    await fetch(id);
    if (id % 10 === 0) process.stdout.write(`\r${id-1106508}/300`);
  }
  console.log('\nNo encontrado.');
}

run();
