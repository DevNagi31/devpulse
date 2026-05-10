import { describe, it, expect } from 'vitest';
import { computePrMetrics } from '../src/computePr.js';
import type { PrSnapshot } from '../src/types.js';

const T = (iso: string) => new Date(iso);

describe('computePrMetrics', () => {
  it('simple PR: opened ready, approved, merged — wait stops at approval', () => {
    const pr: PrSnapshot = {
      number: 1,
      author: 'alice',
      createdAt: T('2026-05-04T10:00:00Z'),
      events: [
        { kind: 'opened', actor: 'alice', at: T('2026-05-04T10:00:00Z') },
        { kind: 'approved', actor: 'bob', at: T('2026-05-04T11:00:00Z') },
        { kind: 'merged', actor: 'alice', at: T('2026-05-04T12:00:00Z') },
      ],
    };
    const m = computePrMetrics(pr);
    expect(m.cycleTimeSec).toBe(2 * 3600);
    expect(m.timeToFirstReviewSec).toBe(3600);
    // Wait stops at approval (11:00) — the hour author took to merge isn't reviewer wait.
    expect(m.reviewWaitSec).toBe(3600);
  });

  it('plain "review" comment does NOT end the wait — only approve/changes_requested do', () => {
    const pr: PrSnapshot = {
      number: 11,
      author: 'alice',
      createdAt: T('2026-05-04T10:00:00Z'),
      events: [
        { kind: 'opened', actor: 'alice', at: T('2026-05-04T10:00:00Z') },
        { kind: 'review', actor: 'bob', at: T('2026-05-04T11:00:00Z') }, // a comment
        { kind: 'merged', actor: 'alice', at: T('2026-05-04T12:00:00Z') },
      ],
    };
    const m = computePrMetrics(pr);
    expect(m.reviewWaitSec).toBe(2 * 3600); // entire span counts
  });

  it('draft PR: ready_for_review starts the review clock, not creation', () => {
    const pr: PrSnapshot = {
      number: 2,
      author: 'alice',
      createdAt: T('2026-05-04T09:00:00Z'),
      events: [
        { kind: 'opened', actor: 'alice', at: T('2026-05-04T09:00:00Z') },
        { kind: 'commit', actor: 'alice', at: T('2026-05-04T09:30:00Z') },
        { kind: 'ready_for_review', actor: 'alice', at: T('2026-05-04T11:00:00Z') },
        { kind: 'review', actor: 'bob', at: T('2026-05-04T12:00:00Z') },
        { kind: 'merged', actor: 'alice', at: T('2026-05-04T13:00:00Z') },
      ],
    };
    const m = computePrMetrics(pr);
    expect(m.timeToFirstReviewSec).toBe(3600);
    // coding time: first commit (09:30) → ready_for_review (11:00)
    expect(m.codingTimeSec).toBe(90 * 60);
  });

  it('changes_requested handoff: review-wait excludes time ball was with author', () => {
    const pr: PrSnapshot = {
      number: 3,
      author: 'alice',
      createdAt: T('2026-05-04T10:00:00Z'),
      events: [
        { kind: 'opened', actor: 'alice', at: T('2026-05-04T10:00:00Z') },
        // 1hr with reviewer
        { kind: 'changes_requested', actor: 'bob', at: T('2026-05-04T11:00:00Z') },
        // 2hr with author — must NOT count
        { kind: 'commit', actor: 'alice', at: T('2026-05-04T13:00:00Z') },
        // 1hr more with reviewer
        { kind: 'review', actor: 'bob', at: T('2026-05-04T14:00:00Z') },
        { kind: 'merged', actor: 'alice', at: T('2026-05-04T15:00:00Z') },
      ],
    };
    const m = computePrMetrics(pr);
    // First non-author review feedback (changes_requested counts) is at 11:00 → TTFR = 1hr.
    expect(m.timeToFirstReviewSec).toBe(3600);
    // review-wait = 1hr (10→11, with reviewer) + 2hr (13→15, back with reviewer) = 3hr
    expect(m.reviewWaitSec).toBe(3 * 3600);
    expect(m.cycleTimeSec).toBe(5 * 3600);
  });

  it('author cannot self-review (own review event ignored for TTFR)', () => {
    const pr: PrSnapshot = {
      number: 4,
      author: 'alice',
      createdAt: T('2026-05-04T10:00:00Z'),
      events: [
        { kind: 'opened', actor: 'alice', at: T('2026-05-04T10:00:00Z') },
        { kind: 'review', actor: 'alice', at: T('2026-05-04T10:30:00Z') }, // self-comment
        { kind: 'review', actor: 'bob', at: T('2026-05-04T11:00:00Z') },
        { kind: 'merged', actor: 'alice', at: T('2026-05-04T12:00:00Z') },
      ],
    };
    const m = computePrMetrics(pr);
    expect(m.timeToFirstReviewSec).toBe(3600);
  });

  it('off-hours: weekend wait does not count toward review-wait', () => {
    // Friday 23:00 UTC → Monday 09:00 UTC merge.
    // With default off-hours (9-18 UTC, weekends excluded) the only business
    // window inside that span is... none — Friday's business hours (9-18)
    // are over by 23:00, then weekend, then merge at Monday 09:00 (boundary).
    // Expect 0 review-wait.
    const pr: PrSnapshot = {
      number: 5,
      author: 'alice',
      createdAt: T('2026-05-01T23:00:00Z'), // Friday
      events: [
        { kind: 'opened', actor: 'alice', at: T('2026-05-01T23:00:00Z') },
        { kind: 'merged', actor: 'alice', at: T('2026-05-04T09:00:00Z') }, // Monday 9am
      ],
    };
    const m = computePrMetrics(pr);
    expect(m.cycleTimeSec).toBe(58 * 3600); // wall clock
    expect(m.reviewWaitSec).toBe(0);        // business clock
  });

  it('still-open PR has no cycle or review-wait but may have TTFR', () => {
    const pr: PrSnapshot = {
      number: 6,
      author: 'alice',
      createdAt: T('2026-05-04T10:00:00Z'),
      events: [
        { kind: 'opened', actor: 'alice', at: T('2026-05-04T10:00:00Z') },
        { kind: 'review', actor: 'bob', at: T('2026-05-04T11:00:00Z') },
      ],
    };
    const m = computePrMetrics(pr);
    expect(m.cycleTimeSec).toBeNull();
    expect(m.reviewWaitSec).toBeNull();
    expect(m.timeToFirstReviewSec).toBe(3600);
  });

  it('events out of order are sorted before computation', () => {
    const pr: PrSnapshot = {
      number: 7,
      author: 'alice',
      createdAt: T('2026-05-04T10:00:00Z'),
      events: [
        { kind: 'merged', actor: 'alice', at: T('2026-05-04T12:00:00Z') },
        { kind: 'opened', actor: 'alice', at: T('2026-05-04T10:00:00Z') },
        { kind: 'review', actor: 'bob', at: T('2026-05-04T11:00:00Z') },
      ],
    };
    const m = computePrMetrics(pr);
    expect(m.cycleTimeSec).toBe(7200);
    expect(m.timeToFirstReviewSec).toBe(3600);
  });
});
