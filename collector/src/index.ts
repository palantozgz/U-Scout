import cron from 'node-cron';
import { config } from './config';
import { logger } from './logger';
import { initBot, setupBotCommands, sendMessage, sendDailyStatus, recordSyncSuccess, recordSyncFailure, checkNetworkSilence } from './bot';
import { syncStandings } from './sync/standings';
import { syncSchedule, checkActiveGame } from './sync/schedule';
import { syncNewBoxscores } from './sync/boxscores';
import { syncPlayerStats } from './sync/playerstats';
import { syncNewPBP, syncPBP } from './sync/pbp';
import { fetchPhases } from './sync/phases';
import { syncRosters } from './sync/roster';
import { wcbaClient } from './client';

let lastNightlySync = 'never';
let isSyncing = false;
let gamesTotal = 0;
let pbpSynced = 0;
let lastLiveGameId: number | null = null;

async function runNightlySync(): Promise<void> {
  if (isSyncing) { logger.warn('Sync already running — skip'); return; }
  isSyncing = true;
  const start = Date.now();
  logger.info('=== NIGHTLY SYNC START ===');
  try {
    const games = await syncSchedule();
    const finished = games.filter(g => g.status === 4);
    const matchIdMap = new Map(games.map(g => [g.gameId, g.matchId]));
    gamesTotal = games.length;

    await syncStandings();
    await syncRosters();

    await syncNewBoxscores(finished.map(g => g.gameId), matchIdMap);

    const { maxRound } = await fetchPhases();
    await syncPlayerStats(maxRound);

    await syncNewPBP(finished.map(g => g.gameId));
    pbpSynced = finished.length;

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    lastNightlySync = new Date().toISOString();
    recordSyncSuccess();
    logger.info('=== NIGHTLY SYNC DONE ===', { elapsed });
    await sendMessage(`✅ Sync nocturno completado en ${elapsed}s`);
  } catch (err: any) {
    recordSyncFailure();
    logger.error('Nightly sync failed', { error: err.message });
    await sendMessage(`❌ Sync nocturno fallido: ${err.message}`);
  } finally {
    isSyncing = false;
  }
}

async function pollLiveGame(): Promise<void> {
  try {
    const active = await checkActiveGame();
    if (!active) {
      if (lastLiveGameId !== null) {
        await syncPBP(lastLiveGameId);
        lastLiveGameId = null;
      }
      return;
    }
    if (lastLiveGameId !== active.gameId) {
      lastLiveGameId = active.gameId;
      await sendMessage(`🏀 Partido en directo: gameId <code>${active.gameId}</code>`);
    }
    await syncPBP(active.gameId);
  } catch (err: any) {
    logger.warn('Live poll error', { error: err.message });
  }
}

function getStatus(): string {
  return `🟢 U Core Collector\nseasonId: ${config.wcba.seasonId}\núltimo sync: ${lastNightlySync}\nsincronizando: ${isSyncing ? 'sí' : 'no'}\nlive: ${lastLiveGameId ?? 'ninguno'}`;
}

async function testApi(): Promise<string> {
  const res = await wcbaClient.get('/datahub/cbamatch/rank/teamrankfirst', { params: config.wcba });
  const count = res.data?.data?.length ?? 0;
  return `API OK — ${count} equipos en standings`;
}

async function main(): Promise<void> {
  logger.info('U Core Collector starting...', { seasonId: config.wcba.seasonId });

  initBot();
  setupBotCommands(runNightlySync, getStatus, undefined, () => `Partidos: ${gamesTotal} total, PBP: ${pbpSynced}`, testApi);

  cron.schedule(config.cron.nightly, () => { void runNightlySync(); });
  cron.schedule(`*/${config.cron.livePollMinutes} * * * *`, () => { void pollLiveGame(); });
  cron.schedule('0 0 * * *', () => { void sendDailyStatus({ lastSync: lastNightlySync, gamesTotal, pbpSynced }); });
  cron.schedule('*/30 * * * *', () => { checkNetworkSilence(); });

  logger.info('Collector running', { nightly: config.cron.nightly });
  await sendMessage('🚀 U Core Collector iniciado');
  await runNightlySync();
}

main().catch(err => {
  logger.error('Fatal startup error', { error: err.message });
  process.exit(1);
});
