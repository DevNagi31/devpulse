import { AskBar } from '../components/AskBar';

export function Ask() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-8 text-center">
        <div className="text-[11px] uppercase tracking-[0.08em] text-ink-400">Ask</div>
        <h1 className="text-[40px] font-semibold tracking-tightest text-ink-800">Ask DevPulse anything</h1>
        <p className="mx-auto mt-2 max-w-xl text-[15px] text-ink-600">
          Plain-English questions become safe, allow-listed SQL against your engineering data.
        </p>
      </header>
      <AskBar />
      <p className="mt-6 text-center text-[11px] text-ink-400">
        The model can only read three views (v_prs, v_reviews, v_deploys) on a read-only role with a 2s
        statement timeout. The generated SQL is shown above the results.
      </p>
    </div>
  );
}
