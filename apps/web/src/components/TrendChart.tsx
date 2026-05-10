import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import type { TrendPoint } from '../lib/api';

export function TrendChart({ data, loading }: { data: TrendPoint[] | undefined; loading: boolean }) {
  if (loading) {
    return <div className="glass h-72 animate-pulse" />;
  }
  if (!data || data.length === 0) {
    return (
      <div className="glass flex h-72 items-center justify-center text-sm text-ink-400">
        No data in the selected window
      </div>
    );
  }
  return (
    <div className="glass h-72 p-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="cycleGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0071e3" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#0071e3" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 4" stroke="#e5e5e7" vertical={false} />
          <XAxis
            dataKey="day"
            stroke="#86868b"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: '#e5e5e7' }}
            tickFormatter={(v: string) => v.slice(5)}
          />
          <YAxis
            stroke="#86868b"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `${v.toFixed(0)}h`}
          />
          <Tooltip
            cursor={{ stroke: '#0071e3', strokeWidth: 1, strokeDasharray: '3 3' }}
            contentStyle={{
              background: 'rgba(255,255,255,0.94)',
              backdropFilter: 'blur(20px)',
              border: '1px solid #e5e5e7',
              borderRadius: 12,
              fontSize: 12,
              boxShadow: '0 8px 30px rgba(0,0,0,0.06)',
            }}
            formatter={(v: number) => [`${v.toFixed(1)}h`, 'p50 cycle']}
          />
          <Area
            type="monotone"
            dataKey="p50_cycle_hours"
            stroke="#0071e3"
            strokeWidth={2}
            fill="url(#cycleGradient)"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
