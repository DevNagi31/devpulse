import type { RecentPr } from '../lib/api';
import { fmtRelative, fmtSecondsToHours } from '../lib/format';

export function PrList({ prs, loading }: { prs: RecentPr[] | undefined; loading: boolean }) {
  if (loading) {
    return (
      <div className="glass">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border-b border-ink-100 p-4 last:border-0">
            <div className="h-3 w-2/3 animate-pulse rounded bg-ink-100" />
            <div className="mt-2 h-2.5 w-1/3 animate-pulse rounded bg-ink-100" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="glass divide-y divide-ink-100 overflow-hidden">
      {prs?.slice(0, 8).map((pr) => (
        <div key={`${pr.repo}-${pr.number}`} className="flex items-center gap-3 px-4 py-3">
          <StateDot state={pr.state} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="truncate text-[13px] font-medium text-ink-800">{pr.title}</span>
              <span className="shrink-0 text-[11px] text-ink-400">
                {pr.repo}#{pr.number}
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-3 text-[11px] text-ink-400">
              <span>@{pr.author_login}</span>
              <span>·</span>
              <span>{fmtRelative(pr.created_at)}</span>
              {pr.cycle_time_sec != null && (
                <>
                  <span>·</span>
                  <span>cycle {fmtSecondsToHours(pr.cycle_time_sec)}</span>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function StateDot({ state }: { state: 'open' | 'closed' | 'merged' }) {
  const color =
    state === 'merged' ? 'bg-violet-500' : state === 'closed' ? 'bg-rose-500' : 'bg-emerald-500';
  return (
    <span className={`mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full ${color} ring-2 ring-white`} />
  );
}
