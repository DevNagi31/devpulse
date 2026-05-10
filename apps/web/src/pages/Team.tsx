import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { fmtHours } from '../lib/format';

export function Team() {
  const { data, isLoading } = useQuery({ queryKey: ['team', 30], queryFn: () => api.team(30) });
  const max = Math.max(1, ...(data?.map((d) => d.reviews) ?? [1]));

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-6">
        <div className="text-[11px] uppercase tracking-[0.08em] text-ink-400">Team</div>
        <h1 className="text-[32px] font-semibold tracking-tightest text-ink-800">Review load</h1>
        <p className="text-[13px] text-ink-400">
          How review work is distributed across the team in the last 30 days.
        </p>
      </header>

      <div className="glass divide-y divide-ink-100">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4">
                <div className="h-4 w-1/3 animate-pulse rounded bg-ink-100" />
              </div>
            ))
          : data?.map((row) => (
              <div key={row.reviewer} className="p-4">
                <div className="flex items-baseline justify-between">
                  <div className="font-medium text-ink-800">@{row.reviewer}</div>
                  <div className="text-[12px] text-ink-400">
                    {row.reviews} reviews · avg response {fmtHours(row.avg_response_hours)}
                  </div>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent to-violet-500"
                    style={{ width: `${(row.reviews / max) * 100}%` }}
                  />
                </div>
              </div>
            ))}
      </div>
    </div>
  );
}
