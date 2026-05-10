export type EventKind =
  | 'opened'
  | 'ready_for_review'
  | 'review_requested'
  | 'review'              // a comment review — does not transfer the ball
  | 'approved'            // explicit approval — ball returns to author
  | 'changes_requested'   // explicit ask for changes — ball returns to author
  | 'commit'
  | 'force_push'
  | 'merged'
  | 'closed'
  | 'reopened';

export interface PrEvent {
  kind: EventKind;
  actor: string | null;
  at: Date;
}

export interface PrSnapshot {
  number: number;
  author: string;
  createdAt: Date;
  events: PrEvent[];
}

export interface PrMetrics {
  /** From created_at to merged_at, in seconds. */
  cycleTimeSec: number | null;
  /** From ready_for_review to first non-author review, in seconds. */
  timeToFirstReviewSec: number | null;
  /** Sum of intervals where the ball was in a reviewer's court, in seconds. */
  reviewWaitSec: number | null;
  /** First commit on branch → ready_for_review, in seconds (best-effort). */
  codingTimeSec: number | null;
}

export interface OffHoursConfig {
  /** Hours considered "off" — events during these hours don't contribute to wait. */
  offHourStart: number; // e.g. 18 (6pm)
  offHourEnd: number;   // e.g. 9  (9am)
  /** ISO weekday numbers considered weekend (1=Monday). Default: 6,7 (Sat, Sun). */
  weekendDays?: number[];
}

export const DEFAULT_OFF_HOURS: OffHoursConfig = {
  offHourStart: 18,
  offHourEnd: 9,
  weekendDays: [6, 7],
};
