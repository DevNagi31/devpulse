import pg from 'pg';

// Realistic seed: 3 repos, ~80 PRs over the last 30 days, varied authors,
// reviews with response times, deploys with rollbacks. Lets the dashboard
// show meaningful trends on first load.

const REPOS = [
  { owner: 'devpulse-demo', name: 'web', default_branch: 'main' },
  { owner: 'devpulse-demo', name: 'api', default_branch: 'main' },
  { owner: 'devpulse-demo', name: 'payments', default_branch: 'main' },
];

const AUTHORS = ['alice', 'bob', 'carol', 'dan', 'eve', 'frank', 'grace', 'henry'];
const REVIEWERS = ['alice', 'bob', 'carol', 'dan'];

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)]!;
}
function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 3600_000);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  console.log('clearing existing data');
  await client.query(
    'TRUNCATE deploys, reviews, pr_events, prs, repos, users RESTART IDENTITY CASCADE',
  );

  console.log('inserting repos');
  const repoIds: Record<string, string> = {};
  for (const r of REPOS) {
    const res = await client.query<{ id: string }>(
      `INSERT INTO repos (github_id, owner, name, default_branch)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [String(randInt(1_000_000, 9_999_999)), r.owner, r.name, r.default_branch],
    );
    repoIds[r.name] = res.rows[0]!.id;
  }

  console.log('inserting PRs + reviews');
  let prCount = 0;
  for (const r of REPOS) {
    const repoId = repoIds[r.name]!;
    const numPrs = randInt(20, 30);
    for (let i = 0; i < numPrs; i++) {
      const createdHrsAgo = randInt(1, 30 * 24);
      const createdAt = hoursAgo(createdHrsAgo);
      const author = pick(AUTHORS);

      // Most PRs merge; some still open; a few closed without merge.
      const roll = Math.random();
      const willMerge = roll < 0.78;
      const stillOpen = roll >= 0.78 && roll < 0.92;

      const cycleHours = Math.max(1, randInt(1, 48) + (Math.random() < 0.1 ? randInt(48, 200) : 0));
      const firstReviewHours = Math.min(cycleHours - 0.5, randInt(1, Math.max(2, cycleHours - 1)));

      const readyAt = new Date(createdAt.getTime() + 5 * 60_000); // 5min after created
      const firstReviewAt = new Date(readyAt.getTime() + firstReviewHours * 3600_000);
      const mergedAt = willMerge
        ? new Date(createdAt.getTime() + cycleHours * 3600_000)
        : null;
      const closedAt = !willMerge && !stillOpen ? new Date(createdAt.getTime() + cycleHours * 3600_000) : null;

      const additions = randInt(5, 600);
      const deletions = randInt(0, 200);
      const changedFiles = Math.max(1, Math.floor((additions + deletions) / 50));

      const cycleSec = mergedAt ? Math.floor((mergedAt.getTime() - createdAt.getTime()) / 1000) : null;
      const reviewWaitSec = mergedAt ? Math.floor(firstReviewHours * 3600 * (0.6 + Math.random() * 0.6)) : null;
      const ttfrSec = Math.floor((firstReviewAt.getTime() - readyAt.getTime()) / 1000);

      const prRes = await client.query<{ id: string }>(
        `INSERT INTO prs (
          repo_id, number, title, state, author_login, author_avatar,
          base_ref, head_ref, additions, deletions, changed_files,
          is_draft, created_at, ready_at, first_review_at, merged_at, closed_at,
          cycle_time_sec, review_wait_sec, time_to_first_review_sec
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
        ) RETURNING id`,
        [
          repoId,
          ++prCount,
          pickTitle(),
          mergedAt ? 'merged' : closedAt ? 'closed' : 'open',
          author,
          `https://github.com/${author}.png`,
          'main',
          `feature/${author}-${i}`,
          additions,
          deletions,
          changedFiles,
          false,
          createdAt,
          readyAt,
          mergedAt || stillOpen ? firstReviewAt : null,
          mergedAt,
          closedAt,
          cycleSec,
          reviewWaitSec,
          ttfrSec,
        ],
      );
      const prId = prRes.rows[0]!.id;

      // Events
      await client.query(
        `INSERT INTO pr_events (pr_id, kind, actor_login, occurred_at) VALUES
         ($1, 'opened', $2, $3),
         ($1, 'ready_for_review', $2, $4)`,
        [prId, author, createdAt, readyAt],
      );

      // Reviews
      if (mergedAt || stillOpen) {
        const reviewer = pick(REVIEWERS.filter((x) => x !== author));
        const reviewAt = firstReviewAt;
        const responseSec = Math.floor((reviewAt.getTime() - readyAt.getTime()) / 1000);
        await client.query(
          `INSERT INTO reviews (pr_id, reviewer_login, state, submitted_at, response_sec)
           VALUES ($1, $2, $3, $4, $5)`,
          [prId, reviewer, mergedAt ? 'approved' : 'commented', reviewAt, responseSec],
        );
        await client.query(
          `INSERT INTO pr_events (pr_id, kind, actor_login, occurred_at)
           VALUES ($1, 'review', $2, $3)`,
          [prId, reviewer, reviewAt],
        );
      }

      if (mergedAt) {
        await client.query(
          `INSERT INTO pr_events (pr_id, kind, actor_login, occurred_at)
           VALUES ($1, 'merged', $2, $3)`,
          [prId, author, mergedAt],
        );
      } else if (closedAt) {
        await client.query(
          `INSERT INTO pr_events (pr_id, kind, actor_login, occurred_at)
           VALUES ($1, 'closed', $2, $3)`,
          [prId, author, closedAt],
        );
      }
    }
  }

  console.log(`inserted ${prCount} PRs`);

  console.log('inserting deploys');
  for (const r of REPOS) {
    const repoId = repoIds[r.name]!;
    for (let i = 0; i < randInt(20, 60); i++) {
      const hrsAgo = randInt(1, 30 * 24);
      const roll = Math.random();
      const state = roll < 0.88 ? 'success' : roll < 0.97 ? 'failure' : 'rolled_back';
      await client.query(
        `INSERT INTO deploys (repo_id, service, version, state, deployed_at, duration_sec)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [repoId, r.name, `v2.${randInt(0, 5)}.${randInt(0, 30)}`, state, hoursAgo(hrsAgo), randInt(60, 600)],
      );
    }
  }

  await client.end();
  console.log('✓ seed complete');
}

const TITLES = [
  'Fix flaky test in auth flow',
  'Add Redis caching to /metrics endpoint',
  'Refactor PR sync to use GraphQL',
  'Bump octokit to 21.0',
  'Reduce bundle size on dashboard',
  'Wire up webhook ingester for push events',
  'Handle force-push in event reconstruction',
  'Add p90 cycle time to MetricCard',
  'Fix off-by-one in review-wait calculation',
  'Migrate from express to fastify',
  'Add anomaly detection EWMA window config',
  'Cache GitHub responses with ETag',
  'Improve loading state on Team page',
  'Allow filtering PRs by author',
  'Add Slack notification for failed deploys',
  'Token bucket for GitHub rate limit',
  'Drop dead code in legacy reports',
  'Document text-to-SQL guardrails',
  'Add integration test for OAuth flow',
  'Speed up cycle-time rollup query',
];
function pickTitle(): string {
  return TITLES[randInt(0, TITLES.length - 1)]!;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
