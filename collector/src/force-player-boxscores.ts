/**
 * force-player-boxscores.ts
 * One-shot script: sincroniza player_boxscores para todos los partidos pendientes.
 * Uso: npx tsx src/force-player-boxscores.ts
 */
import { syncNewPlayerBoxscores } from './sync/boxscores';
import { logger } from './logger';

async function main() {
  // Rango de gameIds conocidos de la temporada 2024-25
  // syncNewPlayerBoxscores filtrará internamente via fetchSyncStatus los que ya existen
  const ids: number[] = [];
  for (let i = 1106500; i <= 1108700; i++) ids.push(i);

  logger.info('Force player boxscores start', { candidates: ids.length });
  await syncNewPlayerBoxscores(ids);
  logger.info('Force player boxscores complete');
  process.exit(0);
}

main().catch(err => {
  logger.error('Force sync failed', { error: err.message });
  process.exit(1);
});
