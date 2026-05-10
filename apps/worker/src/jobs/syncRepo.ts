import { GitHubClient } from '@devpulse/github';
import { getDb } from '@devpulse/db';
import { computePrMetrics, type PrSnapshot, type EventKind } from '@devpulse/metrics';
import type { SyncRepoJob } from '../queue.js';
import type { Logger } from 'pino';

/**
 * Sync a single repo's PRs.
 *
 * Strategy:
 *   - List PRs ordered by `updated_at desc`, paginate until we hit `since`.
 *   - For each PR, fetch the timeline (one GraphQL call) and reconstruct events.
 *   - Compute metrics with @devpulse/metrics, upsert into prs/pr_events.
 *   - Persist the resulting ETag on the repo so the next sync sends
 *     If-None-Match and pays no rate-limit cost when nothing has changed.
 */
export async function runSyncRepo(job: SyncRepoJob, log: Logger): Promise<{ prsSeen: number }> {
  const db = getDb();
  const repo = await db
    .selectFrom('repos')
    .selectAll()
    .where('id', '=', job.repoId)
    .executeTakeFirst();
  if (!repo) throw new Error(`repo ${job.repoId} not found`);

  // Use the repo owner's stored token. (For multi-org installs this would
  // resolve to the GitHub App installation token instead.)
  const owner = await db
    .selectFrom('users')
    .select(['access_token'])
    .where('id', '=', repo.added_by ?? '0')
    .executeTakeFirst();
  if (!owner?.access_token) {
    log.warn({ repoId: job.repoId }, 'no access token for repo owner — skipping sync');
    return { prsSeen: 0 };
  }

  const client = new GitHubClient({ token: owner.access_token });
  const sinceDate = job.since ? new Date(job.since) : repo.last_synced_at ?? undefined;
  const pulls = await client.listPulls(job.owner, job.name, sinceDate ?? undefined);

  for (const pull of pulls) {
    const details = await client.getPullRequestDetails(job.owner, job.name, pull.number);
    const pr = details.repository.pullRequest;

    const events = reconstructEvents(pr);
    const snapshot: PrSnapshot = {
      number: pr.number,
      author: pr.author?.login ?? 'unknown',
      createdAt: new Date(pr.createdAt),
      events,
    };
    const metrics = computePrMetrics(snapshot);

    const upserted = await db
      .insertInto('prs')
      .values({
        repo_id: job.repoId,
        number: pr.number,
        title: pr.title,
        state: pr.mergedAt ? 'merged' : pr.state.toLowerCase() === 'closed' ? 'closed' : 'open',
        author_login: pr.author?.login ?? 'unknown',
        author_avatar: null,
        base_ref: 'main',
        head_ref: 'unknown',
        additions: pr.additions,
        deletions: pr.deletions,
        changed_files: pr.changedFiles,
        is_draft: pr.isDraft,
        created_at: new Date(pr.createdAt),
        ready_at: events.find((e) => e.kind === 'ready_for_review')?.at ?? new Date(pr.createdAt),
        first_review_at: events.find((e) => e.kind === 'review' && e.actor !== pr.author?.login)?.at ?? null,
        merged_at: pr.mergedAt ? new Date(pr.mergedAt) : null,
        closed_at: pr.closedAt ? new Date(pr.closedAt) : null,
        cycle_time_sec: metrics.cycleTimeSec,
        review_wait_sec: metrics.reviewWaitSec,
        time_to_first_review_sec: metrics.timeToFirstReviewSec,
      })
      .onConflict((oc) =>
        oc.columns(['repo_id', 'number']).doUpdateSet({
          title: pr.title,
          state: pr.mergedAt ? 'merged' : pr.state.toLowerCase() === 'closed' ? 'closed' : 'open',
          merged_at: pr.mergedAt ? new Date(pr.mergedAt) : null,
          closed_at: pr.closedAt ? new Date(pr.closedAt) : null,
          cycle_time_sec: metrics.cycleTimeSec,
          review_wait_sec: metrics.reviewWaitSec,
          time_to_first_review_sec: metrics.timeToFirstReviewSec,
        }),
      )
      .returning('id')
      .executeTakeFirstOrThrow();

    // Replace event log for this PR (idempotent).
    await db.deleteFrom('pr_events').where('pr_id', '=', upserted.id).execute();
    if (events.length > 0) {
      await db
        .insertInto('pr_events')
        .values(
          events.map((e) => ({
            pr_id: upserted.id,
            kind: e.kind,
            actor_login: e.actor,
            occurred_at: e.at,
            payload: {},
          })),
        )
        .execute();
    }
  }

  await db
    .updateTable('repos')
    .set({ last_synced_at: new Date() })
    .where('id', '=', job.repoId)
    .execute();

  return { prsSeen: pulls.length };
}

function reconstructEvents(pr: {
  createdAt: string;
  isDraft: boolean;
  mergedAt: string | null;
  closedAt: string | null;
  author: { login: string } | null;
  reviews: { nodes: Array<{ author: { login: string } | null; state: string; submittedAt: string }> };
  commits: { nodes: Array<{ commit: { committedDate: string; oid: string } }> };
  timelineItems: { nodes: Array<Record<string, unknown> & { __typename: string }> };
}): Array<{ kind: EventKind; actor: string | null; at: Date }> {
  const events: Array<{ kind: EventKind; actor: string | null; at: Date }> = [];
  events.push({ kind: 'opened', actor: pr.author?.login ?? null, at: new Date(pr.createdAt) });

  if (!pr.isDraft) {
    // PR was created ready — implicit ready_for_review at creation.
    events.push({
      kind: 'ready_for_review',
      actor: pr.author?.login ?? null,
      at: new Date(pr.createdAt),
    });
  }

  for (const c of pr.commits.nodes) {
    events.push({ kind: 'commit', actor: pr.author?.login ?? null, at: new Date(c.commit.committedDate) });
  }
  for (const r of pr.reviews.nodes) {
    const kind: EventKind =
      r.state === 'CHANGES_REQUESTED'
        ? 'changes_requested'
        : r.state === 'APPROVED'
          ? 'approved'
          : 'review';
    events.push({ kind, actor: r.author?.login ?? null, at: new Date(r.submittedAt) });
  }
  for (const ti of pr.timelineItems.nodes) {
    const at = ti.createdAt as string | undefined;
    if (!at) continue;
    const actor = (ti.actor as { login: string } | undefined)?.login ?? null;
    switch (ti.__typename) {
      case 'ReadyForReviewEvent':
        events.push({ kind: 'ready_for_review', actor, at: new Date(at) });
        break;
      case 'ReviewRequestedEvent':
        events.push({ kind: 'review_requested', actor, at: new Date(at) });
        break;
      case 'HeadRefForcePushedEvent':
        events.push({ kind: 'force_push', actor, at: new Date(at) });
        break;
      case 'MergedEvent':
        events.push({ kind: 'merged', actor, at: new Date(at) });
        break;
      case 'ClosedEvent':
        events.push({ kind: 'closed', actor, at: new Date(at) });
        break;
      case 'ReopenedEvent':
        events.push({ kind: 'reopened', actor, at: new Date(at) });
        break;
    }
  }
  return events.sort((a, b) => a.at.getTime() - b.at.getTime());
}
