import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { MetricCard } from '../components/MetricCard';
import { TrendChart } from '../components/TrendChart';
import { PrList } from '../components/PrList';
import { DeployList } from '../components/DeployList';
import { AskBar } from '../components/AskBar';
import { fmtHours, fmtNumber, fmtPct } from '../lib/format';

export function Dashboard() {
  const summary = useQuery({ queryKey: ['summary', 30], queryFn: () => api.summary(30) });
  const trend = useQuery({ queryKey: ['trend', 30], queryFn: () => api.trend(30) });
  const prs = useQuery({ queryKey: ['recent-prs'], queryFn: () => api.recentPrs(30) });
  const deploys = useQuery({ queryKey: ['recent-deploys'], queryFn: () => api.recentDeploys() });

  const s = summary.data;

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <Hero />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          label="PR cycle time (p50)"
          value={fmtHours(s?.pr.p50_cycle_hours ?? null)}
          sub={s?.pr.p90_cycle_hours != null ? `p90 ${fmtHours(s.pr.p90_cycle_hours)}` : undefined}
          loading={summary.isLoading}
        />
        <MetricCard
          label="Time to first review"
          value={fmtHours(s?.pr.avg_ttfr_hours ?? null)}
          sub="avg, last 30 days"
          loading={summary.isLoading}
        />
        <MetricCard
          label="Deploys per day"
          value={fmtNumber(s?.deploys.per_day ?? null, 1)}
          sub={`${s?.deploys.total ?? 0} in last 30 days`}
          loading={summary.isLoading}
        />
        <MetricCard
          label="Change failure rate"
          value={fmtPct(s?.deploys.failure_rate ?? null, 1)}
          sub={`${s?.deploys.rolled_back ?? 0} rolled back`}
          loading={summary.isLoading}
          goodWhenLower
        />
      </section>

      <section className="mt-8 space-y-2">
        <SectionHeader
          eyebrow="Trend"
          title="PR cycle time, last 30 days"
          subtitle="Median time from PR opened to merged. Lower is better."
        />
        <TrendChart data={trend.data} loading={trend.isLoading} />
      </section>

      <section className="mt-8">
        <AskBar />
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="space-y-2">
          <SectionHeader eyebrow="Activity" title="Recent pull requests" />
          <PrList prs={prs.data} loading={prs.isLoading} />
        </section>
        <section className="space-y-2">
          <SectionHeader eyebrow="Releases" title="Recent deploys" />
          <DeployList deploys={deploys.data} loading={deploys.isLoading} />
        </section>
      </div>

      <Footer />
    </div>
  );
}

function Hero() {
  return (
    <div className="mb-12 text-center">
      <h1 className="text-[44px] font-semibold leading-none tracking-tightest text-ink-800 md:text-[56px]">
        Engineering health,{' '}
        <span className="bg-gradient-to-br from-accent to-violet-500 bg-clip-text text-transparent">
          in focus.
        </span>
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-[17px] text-ink-600">
        Cycle time, review bottlenecks, deploy frequency. Ask anything in plain English.
      </p>
    </div>
  );
}

function SectionHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div className="px-1">
      <div className="text-[11px] uppercase tracking-[0.08em] text-ink-400">{eyebrow}</div>
      <h2 className="text-[20px] font-semibold tracking-tight text-ink-800">{title}</h2>
      {subtitle && <p className="text-[13px] text-ink-400">{subtitle}</p>}
    </div>
  );
}

function Footer() {
  return (
    <footer className="mt-16 border-t border-ink-100 pt-6 text-center text-[11px] text-ink-400">
      Built with Fastify · BullMQ · Postgres · Groq · React
    </footer>
  );
}
