import { Telegraf } from 'telegraf';
import * as fs from 'fs';
import * as path from 'path';
import { config } from './config';
import { logger } from './logger';

let bot: Telegraf | null = null;

export function initBot(): void {
  if (!config.telegram.botToken || !config.telegram.chatId) {
    logger.warn('Telegram bot not configured — skipping');
    return;
  }
  bot = new Telegraf(config.telegram.botToken);
}

export async function sendMessage(text: string): Promise<void> {
  if (!bot || !config.telegram.chatId) return;
  try {
    await bot.telegram.sendMessage(config.telegram.chatId, text, { parse_mode: 'HTML' });
  } catch (err: any) {
    logger.warn('Telegram sendMessage failed', { error: err.message });
  }
}

function readLogTail(filename: string, lines: number): string {
  const p = path.resolve(__dirname, '../logs', filename);
  if (!fs.existsSync(p)) return `(${filename} not found)`;
  const all = fs.readFileSync(p, 'utf-8').split('\n').filter(Boolean);
  return all.slice(-Math.min(lines, 50)).join('\n') || '(empty)';
}

// Alertas automáticas
let consecutiveFailures = 0;
let lastRequestTime = Date.now();

export function recordSyncSuccess(): void { consecutiveFailures = 0; lastRequestTime = Date.now(); }
export function recordSyncFailure(): void {
  consecutiveFailures++;
  if (consecutiveFailures >= 2) void sendMessage(`⚠️ <b>ALERTA</b>: ${consecutiveFailures} syncs nocturnos fallidos. Revisar con /errors`);
}
export function recordRequest(): void { lastRequestTime = Date.now(); }
export function checkNetworkSilence(): void {
  if (Date.now() - lastRequestTime > 30 * 60_000) {
    void sendMessage(`⚠️ <b>ALERTA</b>: Pi lleva ${Math.round((Date.now() - lastRequestTime) / 60000)}min sin requests.`);
  }
}
export function reportUnmappedActionCode(code: string, gameId: number): void {
  void sendMessage(`⚠️ <b>action_code no mapeado</b>: <code>${code}</code> gameId:<code>${gameId}</code>\nAñadir a ACTION_CODE_MAP en sync/pbp.ts`);
}

export function setupBotCommands(
  onSync: () => Promise<void>,
  getStatus: () => string,
  onSetSeason?: (id: number) => void,
  getGamesSummary?: () => string,
  testApi?: () => Promise<string>,
): void {
  if (!bot) return;

  bot.command('status',  async ctx => ctx.reply(getStatus()));
  bot.command('season',  async ctx => ctx.reply(`📅 competitionId: <code>${config.wcba.competitionId}</code>\nseasonId: <code>${config.wcba.seasonId}</code>`, { parse_mode: 'HTML' }));
  bot.command('games',   async ctx => ctx.reply(getGamesSummary ? getGamesSummary() : 'No disponible'));
  bot.command('logs',    async ctx => { const n = parseInt(ctx.message.text.split(' ')[1] ?? '20', 10); ctx.reply(`<pre>${readLogTail('combined.log', n)}</pre>`, { parse_mode: 'HTML' }); });
  bot.command('errors',  async ctx => ctx.reply(`<pre>${readLogTail('error.log', 10)}</pre>`, { parse_mode: 'HTML' }));
  bot.command('reboot',  async ctx => { await ctx.reply('🔁 Reiniciando...'); process.exit(0); });

  bot.command('sync', async ctx => {
    await ctx.reply('🔄 Sync manual iniciado...');
    try { await onSync(); await ctx.reply('✅ Sync completado'); }
    catch (err: any) { await ctx.reply(`❌ Sync fallido: ${err.message}`); }
  });

  bot.command('setseason', async ctx => {
    const id = parseInt(ctx.message.text.split(' ')[1] ?? '', 10);
    if (!id || isNaN(id)) { await ctx.reply('❌ Uso: /setseason 2092'); return; }
    if (onSetSeason) { onSetSeason(id); await ctx.reply(`✅ seasonId → <code>${id}</code>. Ejecuta /sync`, { parse_mode: 'HTML' }); }
  });

  bot.command('test', async ctx => {
    await ctx.reply('🔍 Testeando API WCBA...');
    try { const r = testApi ? await testApi() : 'testApi no configurado'; await ctx.reply(`✅ ${r}`); }
    catch (err: any) { await ctx.reply(`❌ ${err.message}`); }
  });

  bot.launch().catch(err => logger.error('Bot launch failed', { error: err.message }));
  logger.info('Telegram bot started');
}

export async function sendDailyStatus(stats: { lastSync: string; gamesTotal: number; pbpSynced: number }): Promise<void> {
  await sendMessage(
    `📊 <b>U Core — Status diario</b>\nÚltimo sync: <code>${stats.lastSync}</code>\nPartidos: <code>${stats.gamesTotal}</code>\nPBP: <code>${stats.pbpSynced}</code>`
  );
}
