export interface GitHubPR {
  number: number;
  title: string;
  state: 'open' | 'closed';
  draft: boolean;
  user: { login: string; avatar_url: string };
  base: { ref: string };
  head: { ref: string };
  additions: number;
  deletions: number;
  changed_files: number;
  created_at: string;
  merged_at: string | null;
  closed_at: string | null;
}

export type TimelineEvent =
  | { event: 'ready_for_review'; created_at: string; actor: { login: string } }
  | { event: 'review_requested'; created_at: string; actor: { login: string } }
  | { event: 'reviewed'; submitted_at: string; user: { login: string }; state: string }
  | { event: 'committed'; committer: { date: string }; sha: string }
  | { event: 'force-pushed'; created_at: string; actor: { login: string } }
  | { event: 'merged'; created_at: string; actor: { login: string } }
  | { event: 'closed'; created_at: string; actor: { login: string } }
  | { event: 'reopened'; created_at: string; actor: { login: string } };

export interface RateLimit {
  limit: number;
  remaining: number;
  resetAt: Date;
}
