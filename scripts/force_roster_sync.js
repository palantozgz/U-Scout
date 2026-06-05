#!/usr/bin/env node
/**
 * Sync de rosters forzado — ejecutar en el Pi cuando hay jugadoras sin nombre.
 * Uso: node scripts/force_roster_sync.js
 * 
 * Llama a syncRosters() del collector directamente.
 */
const path = require('path');

// Cambiar al directorio del collector
process.chdir(path.join(__dirname, '..', 'collector'));

// Cargar dotenv si existe
try { require('dotenv').config(); } catch(e) {}

// Importar y ejecutar syncRosters
async function main() {
  try {
    // Compilar y ejecutar via tsx
    const { execSync } = require('child_process');
    const result = execSync(
      'npx tsx -e "import { syncRosters } from \'./src/sync/roster\'; syncRosters().then(() => { console.log(\'Roster sync OK\'); process.exit(0); }).catch(e => { console.error(\'Error:\', e.message); process.exit(1); })"',
      { cwd: path.join(__dirname, '..', 'collector'), stdio: 'inherit', timeout: 120000 }
    );
  } catch(e) {
    console.error('Error ejecutando sync:', e.message);
    process.exit(1);
  }
}

main();
