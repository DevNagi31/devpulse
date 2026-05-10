import type { RecentDeploy } from '../lib/api';
import { fmtRelative } from '../lib/format';

export function DeployList({ deploys, loading }: { deploys: RecentDeploy[] | undefined; loading: boolean }) {
  if (loading) {
    return (
      <div className="glass">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border-b border-ink-100 p-4 last:border-0">
            <div className="h-3 w-1/2 animate-pulse rounded bg-ink-100" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="glass divide-y divide-ink-100 overflow-hidden">
      {deploys?.slice(0, 6).map((d, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <StateIcon state={d.state} />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium text-ink-800">
              {d.service} <span className="text-ink-400">{d.version}</span>
            </div>
            <div className="text-[11px] text-ink-400">
              {d.repo} · {fmtRelative(d.deployed_at)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function StateIcon({ state }: { state: 'success' | 'failure' | 'rolled_back' }) {
  if (state === 'success') {
    return <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">✓</span>;
  }
  if (state === 'failure') {
    return <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-rose-100 text-rose-700">✕</span>;
  }
  return <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-700">↩</span>;
}
