const BASE = import.meta.env.VITE_API_URL ?? '/api';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? `${path} failed: ${res.status}`);
  }
  return res.json();
}

export interface Summary {
  window_days: number;
  pr: {
    p50_cycle_hours: number | null;
    p90_cycle_hours: number | null;
    avg_ttfr_hours: number | null;
    merged_count: number;
  };
  deploys: {
    per_day: number;
    failure_rate: number;
    total: number;
    rolled_back: number;
  };
}

export interface TrendPoint {
  day: string;
  p50_cycle_hours: number;
  merged: number;
}

export interface RecentPr {
  number: number;
  title: string;
  state: 'open' | 'closed' | 'merged';
  author_login: string;
  author_avatar: string | null;
  cycle_time_sec: number | null;
  created_at: string;
  merged_at: string | null;
  repo: string;
}

export interface RecentDeploy {
  service: string;
  version: string;
  state: 'success' | 'failure' | 'rolled_back';
  deployed_at: string;
  duration_sec: number | null;
  repo: string;
}

export interface TeamRow {
  reviewer: string;
  reviews: number;
  avg_response_hours: number;
}

export interface AskResult {
  sql: string;
  rows: Array<Record<string, unknown>>;
  row_count: number;
  fields: string[];
}

export interface MeResult {
  authenticated: boolean;
  login?: string;
  avatar_url?: string;
}

export const api = {
  me: () => get<MeResult>('/auth/me'),
  summary: (days = 30) => get<Summary>(`/metrics/summary?days=${days}`),
  trend: (days = 30) => get<TrendPoint[]>(`/metrics/trend?days=${days}`),
  team: (days = 30) => get<TeamRow[]>(`/metrics/team?days=${days}`),
  recentPrs: (days = 30) => get<RecentPr[]>(`/metrics/prs/recent?days=${days}`),
  recentDeploys: () => get<RecentDeploy[]>(`/metrics/deploys/recent`),
  ask: (question: string) => post<AskResult>('/ask', { question }),
};
