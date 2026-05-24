import { ucoreClient } from './client';
import { logger } from './logger';

export type IngestType =
  | 'standings'
  | 'schedule'
  | 'boxscores'
  | 'player_boxscores'
  | 'player_stats'
  | 'pbp'
  | 'shot_chart'
  | 'roster'
  | 'pbp_possessions'
  | 'pbp_player_game_stats'
  | 'pbp_lineup_stats'
  | 'pbp_audit';

export interface IngestPayload {
  type: IngestType;
  seasonId: number;
  competitionId: number;
  data: unknown;
}

export interface SyncStatus {
  pbpDone: number[];
  boxDone: number[];
}

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

export async function fetchSyncStatus(): Promise<SyncStatus> {
  try {
    const res = await ucoreClient.get('/api/stats/sync-status');
    return {
      pbpDone:  Array.isArray(res.data?.pbpDone)  ? res.data.pbpDone  : [],
      boxDone:  Array.isArray(res.data?.boxDone)   ? res.data.boxDone  : [],
    };
  } catch (err: any) {
    logger.warn('fetchSyncStatus failed, assuming nothing done', { error: err.message });
    return { pbpDone: [], boxDone: [] };
  }
}

export async function ingest(payload: IngestPayload): Promise<void> {
  let lastErr: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await ucoreClient.post('/api/stats/ingest', payload);
      logger.info('Ingest OK', { type: payload.type, records: (res.data as any).recordsProcessed, attempt });
      return;
    } catch (err: any) {
      lastErr = err;
      logger.warn('Ingest attempt failed', { type: payload.type, attempt, error: err.message });
      if (attempt < 3) await sleep(5_000 * attempt);
    }
  }
  logger.error('Ingest failed after 3 retries', { type: payload.type, error: lastErr?.message });
  throw lastErr;
}
