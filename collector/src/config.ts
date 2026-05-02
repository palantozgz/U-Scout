import * as fs from 'fs';
import * as path from 'path';

const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const idx = t.indexOf('=');
    if (idx === -1) continue;
    const key = t.slice(0, idx).trim();
    const val = t.slice(idx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

function required(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env var: ${key}`);
  return v;
}
function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const config = {
  wcba: {
    baseUrl:       optional('WCBA_BASE_URL', 'https://www.cba.net.cn'),
    competitionId: parseInt(optional('WCBA_COMPETITION_ID', '56'), 10),
    seasonId:      parseInt(optional('WCBA_SEASON_ID', '2092'), 10),
  },
  ucore: {
    apiUrl:    required('UCORE_API_URL'),
    ingestKey: required('STATS_INGEST_KEY'),
  },
  telegram: {
    botToken: optional('TELEGRAM_BOT_TOKEN', ''),
    chatId:   optional('TELEGRAM_CHAT_ID', ''),
  },
  cron: {
    nightly:         optional('CRON_NIGHTLY', '0 19 * * *'),
    livePollMinutes: parseInt(optional('LIVE_POLL_MINUTES', '3'), 10),
  },
} as const;
