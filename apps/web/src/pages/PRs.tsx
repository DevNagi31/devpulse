import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { fmtRelative, fmtSecondsToHours } from '../lib/format';

export function PRs() {
  const { data, isLoading } = useQuery({ queryKey: ['recent-prs', 90], queryFn: () => api.recentPrs(90) });

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <header className="mb-6">
        <div className="text-[11px] uppercase tracking-[0.08em] text-ink-400">Pull Requests</div>
        <h1 className="text-[32px] font-semibold tracking-tightest text-ink-800">All PRs</h1>
        <p className="text-[13px] text-ink-400">Last 90 days · {data?.length ?? 0} pull requests</p>
      </header>

      <div className="glass overflow-hidden">
        <table className="w-full">
          <thead className="bg-ink-50/50 text-[11px] uppercase tracking-wider text-ink-400">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Title</th>
              <th className="px-4 py-3 text-left font-medium">Repo</th>
              <th className="px-4 py-3 text-left font-medium">Author</th>
              <th className="px-4 py-3 text-left font-medium">State</th>
              <th className="px-4 py-3 text-left font-medium">Cycle</th>
              <th className="px-4 py-3 text-left font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-t border-ink-100">
                    <td colSpan={6} className="p-4">
                      <div className="h-3 w-2/3 animate-pulse rounded bg-ink-100" />
                    </td>
                  </tr>
                ))
              : data?.map((pr) => (
                  <tr key={`${pr.repo}-${pr.number}`} className="border-t border-ink-100 text-[13px]">
                    <td className="px-4 py-2 font-medium text-ink-800">{pr.title}</td>
                    <td className="px-4 py-2 text-ink-600">
                      {pr.repo}#{pr.number}
                    </td>
                    <td className="px-4 py-2 text-ink-600">@{pr.author_login}</td>
                    <td className="px-4 py-2">
                      <StateBadge state={pr.state} />
                    </td>
                    <td className="px-4 py-2 font-mono text-ink-600">{fmtSecondsToHours(pr.cycle_time_sec)}</td>
                    <td className="px-4 py-2 text-ink-400">{fmtRelative(pr.created_at)}</td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StateBadge({ state }: { state: 'open' | 'closed' | 'merged' }) {
  const cls =
    state === 'merged'
      ? 'bg-violet-50 text-violet-700'
      : state === 'closed'
        ? 'bg-rose-50 text-rose-700'
        : 'bg-emerald-50 text-emerald-700';
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>{state}</span>;
}
