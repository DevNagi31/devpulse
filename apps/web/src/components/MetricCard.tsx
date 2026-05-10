import type { ReactNode } from 'react';

interface Props {
  label: string;
  value: ReactNode;
  /** Sub-label rendered below the big number. */
  sub?: ReactNode;
  /** Optional WoW delta — positive number = improvement when goodWhenLower is false. */
  delta?: number | null;
  goodWhenLower?: boolean;
  loading?: boolean;
}

export function MetricCard({ label, value, sub, delta, goodWhenLower = false, loading }: Props) {
  return (
    <div className="glass p-6">
      <div className="text-[11px] uppercase tracking-[0.08em] text-ink-400">{label}</div>
      <div className="mt-2 flex items-baseline gap-3">
        {loading ? (
          <div className="h-9 w-24 animate-pulse rounded-md bg-ink-100" />
        ) : (
          <div className="text-[34px] font-semibold leading-none tracking-tightest text-ink-800">
            {value}
          </div>
        )}
        {delta != null && !loading && <DeltaPill value={delta} goodWhenLower={goodWhenLower} />}
      </div>
      {sub && <div className="mt-2 text-[12px] text-ink-400">{sub}</div>}
    </div>
  );
}

function DeltaPill({ value, goodWhenLower }: { value: number; goodWhenLower: boolean }) {
  const isImprovement = goodWhenLower ? value < 0 : value > 0;
  const color = isImprovement ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50';
  const arrow = value < 0 ? '▼' : '▲';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${color}`}>
      <span>{arrow}</span>
      <span>{Math.abs(value).toFixed(0)}%</span>
    </span>
  );
}
