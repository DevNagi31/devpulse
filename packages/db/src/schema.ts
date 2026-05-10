import type { Generated, ColumnType } from 'kysely';

type Timestamp = ColumnType<Date, Date | string, Date | string>;

export interface UsersTable {
  id: Generated<string>;
  github_id: string;
  login: string;
  name: string | null;
  avatar_url: string | null;
  access_token: string | null;
  created_at: Generated<Timestamp>;
}

export interface ReposTable {
  id: Generated<string>;
  github_id: string;
  owner: string;
  name: string;
  default_branch: Generated<string>;
  added_by: string | null;
  last_synced_at: Timestamp | null;
  etag_pulls: string | null;
  created_at: Generated<Timestamp>;
}

export interface PrsTable {
  id: Generated<string>;
  repo_id: string;
  number: number;
  title: string;
  state: 'open' | 'closed' | 'merged';
  author_login: string;
  author_avatar: string | null;
  base_ref: string;
  head_ref: string;
  additions: Generated<number>;
  deletions: Generated<number>;
  changed_files: Generated<number>;
  is_draft: Generated<boolean>;
  created_at: Timestamp;
  ready_at: Timestamp | null;
  first_review_at: Timestamp | null;
  merged_at: Timestamp | null;
  closed_at: Timestamp | null;
  cycle_time_sec: number | null;
  review_wait_sec: number | null;
  time_to_first_review_sec: number | null;
}

export type PrEventKind =
  | 'opened'
  | 'ready_for_review'
  | 'review_requested'
  | 'review'
  | 'approved'
  | 'changes_requested'
  | 'commit'
  | 'force_push'
  | 'merged'
  | 'closed'
  | 'reopened';

export interface PrEventsTable {
  id: Generated<string>;
  pr_id: string;
  kind: PrEventKind;
  actor_login: string | null;
  occurred_at: Timestamp;
  payload: Record<string, unknown>;
}

export interface ReviewsTable {
  id: Generated<string>;
  pr_id: string;
  reviewer_login: string;
  state: 'approved' | 'changes_requested' | 'commented';
  submitted_at: Timestamp;
  response_sec: number | null;
}

export interface DeploysTable {
  id: Generated<string>;
  repo_id: string;
  service: string;
  version: string;
  state: 'success' | 'failure' | 'rolled_back';
  deployed_at: Timestamp;
  duration_sec: number | null;
}

export interface MetricBaselinesTable {
  metric: string;
  scope_kind: 'repo' | 'team' | 'global';
  scope_id: string;
  window_days: number;
  ewma: number;
  stddev: number;
  sample_count: number;
  updated_at: Generated<Timestamp>;
}

export interface DB {
  users: UsersTable;
  repos: ReposTable;
  prs: PrsTable;
  pr_events: PrEventsTable;
  reviews: ReviewsTable;
  deploys: DeploysTable;
  metric_baselines: MetricBaselinesTable;
}
