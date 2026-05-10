import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getDb } from '@devpulse/db';
import { sql } from 'kysely';

const RangeQuery = z.object({
  days: z.coerce.number().min(1).max(365).default(30),
  repo: z.string().optional(),
});

export async function metricsRoutes(app: FastifyInstance) {
  const db = getDb();

  // Summary cards on the dashboard.
  app.get('/summary', async (req) => {
    const { days, repo } = RangeQuery.parse(req.query);
    const rows = await db
      .selectFrom('prs')
      .innerJoin('repos', 'repos.id', 'prs.repo_id')
      .where(sql<boolean>`prs.merged_at >= now() - (${days} || ' days')::interval`)
      .$if(!!repo, (q) => q.where(sql<boolean>`repos.owner || '/' || repos.name = ${repo}`))
      .select([
        sql<number>`percentile_cont(0.5) within group (order by prs.cycle_time_sec)`.as('p50_cycle_sec'),
        sql<number>`percentile_cont(0.9) within group (order by prs.cycle_time_sec)`.as('p90_cycle_sec'),
        sql<number>`avg(prs.time_to_first_review_sec)`.as('avg_ttfr_sec'),
        sql<number>`count(*)`.as('merged_count'),
      ])
      .executeTakeFirst();

    const deploys = await db
      .selectFrom('deploys')
      .innerJoin('repos', 'repos.id', 'deploys.repo_id')
      .where(sql<boolean>`deploys.deployed_at >= now() - (${days} || ' days')::interval`)
      .$if(!!repo, (q) => q.where(sql<boolean>`repos.owner || '/' || repos.name = ${repo}`))
      .select([
        sql<number>`count(*)`.as('total'),
        sql<number>`count(*) filter (where deploys.state = 'success')`.as('success'),
        sql<number>`count(*) filter (where deploys.state = 'failure')`.as('failed'),
        sql<number>`count(*) filter (where deploys.state = 'rolled_back')`.as('rolled_back'),
      ])
      .executeTakeFirst();

    const dailyDeploys = Number(deploys?.total ?? 0) / Math.max(1, days);
    const failureRate = deploys?.total ? Number(deploys.failed) / Number(deploys.total) : 0;

    return {
      window_days: days,
      pr: {
        p50_cycle_hours: rows?.p50_cycle_sec ? rows.p50_cycle_sec / 3600 : null,
        p90_cycle_hours: rows?.p90_cycle_sec ? rows.p90_cycle_sec / 3600 : null,
        avg_ttfr_hours: rows?.avg_ttfr_sec ? rows.avg_ttfr_sec / 3600 : null,
        merged_count: Number(rows?.merged_count ?? 0),
      },
      deploys: {
        per_day: dailyDeploys,
        failure_rate: failureRate,
        total: Number(deploys?.total ?? 0),
        rolled_back: Number(deploys?.rolled_back ?? 0),
      },
    };
  });

  // Time-series for the trend chart — grouped by day.
  app.get('/trend', async (req) => {
    const { days, repo } = RangeQuery.parse(req.query);
    const rows = await db
      .selectFrom('prs')
      .innerJoin('repos', 'repos.id', 'prs.repo_id')
      .where(sql<boolean>`prs.merged_at >= now() - (${days} || ' days')::interval`)
      .$if(!!repo, (q) => q.where(sql<boolean>`repos.owner || '/' || repos.name = ${repo}`))
      .select([
        sql<string>`date_trunc('day', prs.merged_at)::date::text`.as('day'),
        sql<number>`percentile_cont(0.5) within group (order by prs.cycle_time_sec) / 3600.0`.as(
          'p50_cycle_hours',
        ),
        sql<number>`count(*)`.as('merged'),
      ])
      .groupBy(sql`date_trunc('day', prs.merged_at)`)
      .orderBy(sql`date_trunc('day', prs.merged_at)`)
      .execute();

    return rows.map((r) => ({
      day: r.day,
      p50_cycle_hours: Number(r.p50_cycle_hours),
      merged: Number(r.merged),
    }));
  });

  // Per-reviewer load for the Team page.
  app.get('/team', async (req) => {
    const { days } = RangeQuery.parse(req.query);
    const rows = await db
      .selectFrom('reviews')
      .where(sql<boolean>`reviews.submitted_at >= now() - (${days} || ' days')::interval`)
      .select([
        'reviewer_login',
        sql<number>`count(*)`.as('reviews'),
        sql<number>`avg(response_sec) / 3600.0`.as('avg_response_hours'),
      ])
      .groupBy('reviewer_login')
      .orderBy(sql`count(*) desc`)
      .execute();

    return rows.map((r) => ({
      reviewer: r.reviewer_login,
      reviews: Number(r.reviews),
      avg_response_hours: Number(r.avg_response_hours),
    }));
  });

  // Recent PRs for the dashboard list.
  app.get('/prs/recent', async (req) => {
    const { days, repo } = RangeQuery.parse(req.query);
    const rows = await db
      .selectFrom('prs')
      .innerJoin('repos', 'repos.id', 'prs.repo_id')
      .where(sql<boolean>`prs.created_at >= now() - (${days} || ' days')::interval`)
      .$if(!!repo, (q) => q.where(sql<boolean>`repos.owner || '/' || repos.name = ${repo}`))
      .select([
        'prs.number',
        'prs.title',
        'prs.state',
        'prs.author_login',
        'prs.author_avatar',
        'prs.cycle_time_sec',
        'prs.created_at',
        'prs.merged_at',
        sql<string>`repos.owner || '/' || repos.name`.as('repo'),
      ])
      .orderBy('prs.created_at', 'desc')
      .limit(25)
      .execute();
    return rows;
  });

  // Recent deploys for the dashboard list.
  app.get('/deploys/recent', async () => {
    const rows = await db
      .selectFrom('deploys')
      .innerJoin('repos', 'repos.id', 'deploys.repo_id')
      .select([
        'deploys.service',
        'deploys.version',
        'deploys.state',
        'deploys.deployed_at',
        'deploys.duration_sec',
        sql<string>`repos.owner || '/' || repos.name`.as('repo'),
      ])
      .orderBy('deploys.deployed_at', 'desc')
      .limit(15)
      .execute();
    return rows;
  });
}
