import { Queue, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';

export interface SyncRepoJob {
  repoId: string;
  owner: string;
  name: string;
  /** ISO date — only fetch PRs updated since this. */
  since?: string;
}

export interface RollupJob {
  repoId: string;
  windowDays: number;
}

const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
export const connection = new IORedis(url, { maxRetriesPerRequest: null });

export const syncQueue = new Queue<SyncRepoJob>('sync', { connection });
export const rollupQueue = new Queue<RollupJob>('rollup', { connection });

export const syncEvents = new QueueEvents('sync', { connection: connection.duplicate() });
export const rollupEvents = new QueueEvents('rollup', { connection: connection.duplicate() });
