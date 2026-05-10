import { businessSecondsBetween } from './businessTime.js';
import {
  DEFAULT_OFF_HOURS,
  type OffHoursConfig,
  type PrEvent,
  type PrMetrics,
  type PrSnapshot,
} from './types.js';

/**
 * Compute PR metrics from a reconstructed event timeline.
 *
 * Why this is non-trivial:
 *   - PRs may open as draft, become ready_for_review, get force-pushed,
 *     receive reviews, get changes_requested (returning the ball to the
 *     author), get re-reviewed, and finally merge.
 *   - cycle_time uses created → merged (drafts included; that's deliberate
 *     since coding-in-draft is still part of delivery time).
 *   - time_to_first_review uses ready_for_review → first non-author review.
 *     If the PR was opened ready (not draft), ready_for_review is implicit
 *     at creation.
 *   - review_wait sums "ball in reviewer's court" intervals only,
 *     during business hours, so off-hours don't penalize anyone.
 */
export function computePrMetrics(
  pr: PrSnapshot,
  cfg: OffHoursConfig = DEFAULT_OFF_HOURS,
): PrMetrics {
  const sorted = [...pr.events].sort((a, b) => a.at.getTime() - b.at.getTime());

  const merged = sorted.find((e) => e.kind === 'merged');
  const closed = sorted.find((e) => e.kind === 'closed' && !merged);

  const cycleTimeSec = merged
    ? Math.round((merged.at.getTime() - pr.createdAt.getTime()) / 1000)
    : null;

  const readyAt = findReadyAt(sorted, pr.createdAt);

  const firstReview = sorted.find(
    (e) =>
      (e.kind === 'review' || e.kind === 'approved' || e.kind === 'changes_requested') &&
      e.actor &&
      e.actor !== pr.author &&
      e.at >= readyAt,
  );
  const timeToFirstReviewSec = firstReview
    ? Math.round((firstReview.at.getTime() - readyAt.getTime()) / 1000)
    : null;

  const reviewWaitSec = computeReviewWait(pr, sorted, readyAt, merged ?? closed, cfg);

  const firstCommit = sorted.find((e) => e.kind === 'commit');
  const codingTimeSec =
    firstCommit && readyAt > firstCommit.at
      ? Math.round((readyAt.getTime() - firstCommit.at.getTime()) / 1000)
      : null;

  return { cycleTimeSec, timeToFirstReviewSec, reviewWaitSec, codingTimeSec };
}

function findReadyAt(events: PrEvent[], createdAt: Date): Date {
  const ready = events.find((e) => e.kind === 'ready_for_review');
  return ready?.at ?? createdAt;
}

/**
 * Walk the timeline as a state machine. The PR is in one of:
 *   - waiting_for_review (ball with reviewers — counts toward wait)
 *   - waiting_for_author (ball with author after changes_requested — does not count)
 *   - resolved (merged/closed — stop counting)
 *
 * Transitions:
 *   ready_for_review                                    → waiting_for_review
 *   approved by non-author                              → waiting_for_author
 *   changes_requested by non-author                     → waiting_for_author
 *   review (comment) by non-author                      → no state change
 *   commit / force_push by author when waiting_for_author → waiting_for_review
 *   merged / closed                                     → resolved
 */
function computeReviewWait(
  pr: PrSnapshot,
  events: PrEvent[],
  readyAt: Date,
  terminal: PrEvent | undefined,
  cfg: OffHoursConfig,
): number | null {
  if (!terminal) return null;

  type State = 'waiting_for_review' | 'waiting_for_author' | 'resolved';
  let state: State = 'waiting_for_review';
  let intervalStart = readyAt;
  let total = 0;

  const flush = (until: Date) => {
    if (state === 'waiting_for_review') {
      total += businessSecondsBetween(intervalStart, until, cfg);
    }
  };

  for (const e of events) {
    if (e.at < readyAt) continue;
    if (e.at > terminal.at) break;

    if (
      (e.kind === 'changes_requested' || e.kind === 'approved') &&
      e.actor !== pr.author &&
      state === 'waiting_for_review'
    ) {
      flush(e.at);
      state = 'waiting_for_author';
      intervalStart = e.at;
    } else if (
      (e.kind === 'commit' || e.kind === 'force_push') &&
      e.actor === pr.author &&
      state === 'waiting_for_author'
    ) {
      // Author addressed feedback — ball back in reviewers' court.
      state = 'waiting_for_review';
      intervalStart = e.at;
    } else if (e.kind === 'merged' || e.kind === 'closed') {
      flush(e.at);
      state = 'resolved';
      break;
    }
  }

  if (state === 'waiting_for_review') flush(terminal.at);
  return total;
}
