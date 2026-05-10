import { getDb } from '@devpulse/db';
import { ewma, RunningStats } from '@devpulse/metrics';
import type { RollupJob } from '../queue.js';
import type { Logger } from 'pino';
import { sql } from 'kysely';

/**
 * Recompute baseline EWMA + stddev for a repo over the configured window.
 * The output goes into metric_baselines and is used by the anomaly detector.
 *
 * EWMA alpha = 2 / (window_days + 1) — standard exponential smoothing.
 */
export async function runRollupMetrics(job: RollupJob, log: Logger): Promise<void> {
  const db = getDb();
  const repo = await db
    .selectFrom('repos')
    .select(['owner', 'name'])
    .where('id', '=', job.repoId)
    .executeTakeFirstOrThrow();

  const rows = await db
    .selectFrom('prs')
    .where('repo_id', '=', job.repoId)
    .where(sql<boolean>`merged_at >= now() - (${job.windowDays} || ' days')::interval`)
    .where('cycle_time_sec', 'is not', null)
    .select(['cycle_time_sec', 'review_wait_sec', 'merged_at'])
    .orderBy('merged_at', 'asc')
    .execute();

  if (rows.length === 0) {
    log.info({ repo: repo.owner + '/' + repo.name }, 'no PRs in window — skipping baseline');
    return;
  }

  const alpha = 2 / (job.windowDays + 1);
  const cycleStats = new RunningStats();
  let cycleEwma = rows[0]!.cycle_time_sec! / 3600;
  for (const r of rows) {
    const hours = r.cycle_time_sec! / 3600;
    cycleStats.push(hours);
    cycleEwma = ewma(cycleEwma, hours, alpha);
  }

  await db
    .insertInto('metric_baselines')
    .values({
      metric: 'cycle_time',
      scope_kind: 'repo',
      scope_id: `${repo.owner}/${repo.name}`,
      window_days: job.windowDays,
      ewma: cycleEwma,
      stddev: cycleStats.stddev,
      sample_count: cycleStats.count,
    })
    .onConflict((oc) =>
      oc.columns(['metric', 'scope_kind', 'scope_id', 'window_days']).doUpdateSet({
        ewma: cycleEwma,
        stddev: cycleStats.stddev,
        sample_count: cycleStats.count,
        updated_at: new Date(),
      }),
    )
    .execute();
}
