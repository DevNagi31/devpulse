import { Worker } from 'bullmq';
import pino from 'pino';
import { connection, type SyncRepoJob, type RollupJob } from './queue.js';
import { runSyncRepo } from './jobs/syncRepo.js';
import { runRollupMetrics } from './jobs/rollupMetrics.js';

const log = pino({
  transport: process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
});

const syncWorker = new Worker<SyncRepoJob>(
  'sync',
  async (job) => runSyncRepo(job.data, log.child({ job: 'sync', repoId: job.data.repoId })),
  { connection, concurrency: 2 },
);
syncWorker.on('completed', (job, ret) => log.info({ id: job.id, ret }, 'sync done'));
syncWorker.on('failed', (job, err) => log.error({ id: job?.id, err }, 'sync failed'));

const rollupWorker = new Worker<RollupJob>(
  'rollup',
  async (job) => runRollupMetrics(job.data, log.child({ job: 'rollup', repoId: job.data.repoId })),
  { connection, concurrency: 4 },
);
rollupWorker.on('completed', (job) => log.info({ id: job.id }, 'rollup done'));
rollupWorker.on('failed', (job, err) => log.error({ id: job?.id, err }, 'rollup failed'));

log.info('worker started — waiting for jobs');

const shutdown = async (signal: string) => {
  log.info({ signal }, 'shutting down');
  await Promise.all([syncWorker.close(), rollupWorker.close()]);
  await connection.quit();
  process.exit(0);
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
