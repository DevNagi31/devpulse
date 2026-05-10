import { request } from '@octokit/request';
import { graphql } from '@octokit/graphql';
import type { GitHubPR, TimelineEvent, RateLimit } from './types.js';

// Token bucket: drips at the GitHub authed-rate (5000/hr ≈ 1.39/sec)
// per installation. Wraps every REST/GraphQL call.
class TokenBucket {
  private tokens: number;
  private last = Date.now();
  constructor(
    private capacity: number,
    private refillPerSec: number,
  ) {
    this.tokens = capacity;
  }
  async take(): Promise<void> {
    while (true) {
      const now = Date.now();
      const elapsed = (now - this.last) / 1000;
      this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerSec);
      this.last = now;
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      const wait = ((1 - this.tokens) / this.refillPerSec) * 1000;
      await new Promise((r) => setTimeout(r, Math.max(50, wait)));
    }
  }
}

export interface GitHubClientOptions {
  token: string;
  /** ETag store — pass through to enable conditional requests. */
  etagStore?: { get: (key: string) => string | null; set: (key: string, etag: string) => void };
}

export class GitHubClient {
  private bucket = new TokenBucket(50, 1.39);
  private gql: typeof graphql;
  private etagStore?: GitHubClientOptions['etagStore'];

  constructor(private opts: GitHubClientOptions) {
    this.gql = graphql.defaults({
      headers: { authorization: `token ${opts.token}` },
    });
    this.etagStore = opts.etagStore;
  }

  /** REST call with token-bucket pacing and ETag support (304 returns null). */
  async get<T>(route: string, params: Record<string, unknown> = {}): Promise<T | null> {
    await this.bucket.take();
    const etagKey = `${route}:${JSON.stringify(params)}`;
    const ifNoneMatch = this.etagStore?.get(etagKey);
    const headers: Record<string, string> = {
      authorization: `token ${this.opts.token}`,
      ...(ifNoneMatch ? { 'if-none-match': ifNoneMatch } : {}),
    };

    try {
      const res = await request(route, { ...params, headers });
      const etag = res.headers.etag;
      if (etag && this.etagStore) this.etagStore.set(etagKey, etag);
      return res.data as T;
    } catch (err: unknown) {
      const e = err as { status?: number };
      if (e.status === 304) return null;
      throw err;
    }
  }

  /** Fan-out PR query — gets reviews, commits, status checks in one request. */
  async getPullRequestDetails(owner: string, name: string, number: number) {
    await this.bucket.take();
    return this.gql<{ repository: { pullRequest: PullRequestDetails } }>(
      `query($owner: String!, $name: String!, $number: Int!) {
         repository(owner: $owner, name: $name) {
           pullRequest(number: $number) {
             number
             title
             state
             isDraft
             createdAt
             mergedAt
             closedAt
             additions
             deletions
             changedFiles
             author { login }
             reviews(first: 50) {
               nodes { author { login } state submittedAt }
             }
             commits(first: 100) {
               nodes { commit { committedDate oid } }
             }
             timelineItems(first: 100, itemTypes: [
               READY_FOR_REVIEW_EVENT, REVIEW_REQUESTED_EVENT, HEAD_REF_FORCE_PUSHED_EVENT,
               PULL_REQUEST_REVIEW, MERGED_EVENT, CLOSED_EVENT, REOPENED_EVENT
             ]) {
               nodes {
                 __typename
                 ... on ReadyForReviewEvent { createdAt actor { login } }
                 ... on ReviewRequestedEvent { createdAt actor { login } }
                 ... on HeadRefForcePushedEvent { createdAt actor { login } }
                 ... on MergedEvent { createdAt actor { login } }
                 ... on ClosedEvent { createdAt actor { login } }
                 ... on ReopenedEvent { createdAt actor { login } }
               }
             }
           }
         }
       }`,
      { owner, name, number },
    );
  }

  async listPulls(owner: string, name: string, since?: Date): Promise<GitHubPR[]> {
    const data = await this.get<GitHubPR[]>('GET /repos/{owner}/{repo}/pulls', {
      owner,
      repo: name,
      state: 'all',
      sort: 'updated',
      direction: 'desc',
      per_page: 100,
      ...(since ? { since: since.toISOString() } : {}),
    });
    return data ?? [];
  }

  async listTimeline(owner: string, name: string, number: number): Promise<TimelineEvent[]> {
    const data = await this.get<TimelineEvent[]>(
      'GET /repos/{owner}/{repo}/issues/{number}/timeline',
      { owner, repo: name, number, per_page: 100, mediaType: { previews: ['mockingbird'] } },
    );
    return data ?? [];
  }

  async rateLimit(): Promise<RateLimit> {
    const data = await this.get<{
      rate: { limit: number; remaining: number; reset: number };
    }>('GET /rate_limit');
    return {
      limit: data!.rate.limit,
      remaining: data!.rate.remaining,
      resetAt: new Date(data!.rate.reset * 1000),
    };
  }
}

export interface PullRequestDetails {
  number: number;
  title: string;
  state: string;
  isDraft: boolean;
  createdAt: string;
  mergedAt: string | null;
  closedAt: string | null;
  additions: number;
  deletions: number;
  changedFiles: number;
  author: { login: string } | null;
  reviews: { nodes: Array<{ author: { login: string } | null; state: string; submittedAt: string }> };
  commits: { nodes: Array<{ commit: { committedDate: string; oid: string } }> };
  timelineItems: { nodes: Array<Record<string, unknown> & { __typename: string }> };
}
