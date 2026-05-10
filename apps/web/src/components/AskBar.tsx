import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, type AskResult } from '../lib/api';

const SUGGESTIONS = [
  'PRs merged last week without review',
  'avg cycle time by author',
  'deploy success rate per service',
  'top 5 reviewers by load this month',
];

export function AskBar() {
  const [q, setQ] = useState('');
  const [result, setResult] = useState<AskResult | null>(null);
  const mut = useMutation({
    mutationFn: api.ask,
    onSuccess: (r) => setResult(r),
    onError: () => setResult(null),
  });

  return (
    <div className="glass overflow-hidden">
      <div className="flex items-center gap-3 border-b border-ink-100 px-4 py-3">
        <span className="text-[11px] uppercase tracking-[0.08em] text-ink-400">Ask DevPulse</span>
        <span className="pill">beta</span>
      </div>

      <form
        className="flex items-center gap-2 px-4 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim().length > 0) mut.mutate(q.trim());
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask anything about your engineering metrics..."
          className="flex-1 bg-transparent text-[15px] text-ink-800 placeholder:text-ink-400 focus:outline-none"
          autoComplete="off"
        />
        <button type="submit" className="btn-primary" disabled={mut.isPending || q.trim().length === 0}>
          {mut.isPending ? 'Thinking…' : 'Ask'}
        </button>
      </form>

      <div className="flex flex-wrap gap-2 px-4 pb-3">
        {SUGGESTIONS.map((s) => (
          <button key={s} className="pill hover:bg-ink-200" onClick={() => setQ(s)}>
            {s}
          </button>
        ))}
      </div>

      {mut.error && (
        <div className="border-t border-ink-100 px-4 py-3 text-[12px] text-rose-600">
          {(mut.error as Error).message}
        </div>
      )}

      {result && <ResultPanel result={result} />}
    </div>
  );
}

function ResultPanel({ result }: { result: AskResult }) {
  const cols = result.fields;
  const rows = result.rows.slice(0, 50);
  return (
    <div className="border-t border-ink-100">
      <details className="bg-ink-50/60 px-4 py-2 text-[11px] text-ink-600" open>
        <summary className="cursor-pointer select-none font-medium">Generated SQL ({result.row_count} rows)</summary>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-md bg-ink-800 p-3 font-mono text-[11px] text-ink-50">
          {result.sql}
        </pre>
      </details>
      <div className="overflow-x-auto px-4 pb-4">
        <table className="min-w-full text-[12px]">
          <thead>
            <tr className="text-left text-ink-400">
              {cols.map((c) => (
                <th key={c} className="border-b border-ink-100 py-2 pr-4 font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="text-ink-800">
                {cols.map((c) => (
                  <td key={c} className="border-b border-ink-100/70 py-1.5 pr-4 font-mono">
                    {format(row[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function format(v: unknown): string {
  if (v == null) return '—';
  if (typeof v === 'number') return Math.abs(v) < 100 ? v.toFixed(2) : String(v);
  if (typeof v === 'string') return v.length > 60 ? v.slice(0, 57) + '…' : v;
  return JSON.stringify(v);
}
