# DevPulse — AI-Integrated Developer Analytics Platform

A developer productivity platform that connects to GitHub and surfaces engineering metrics — PR cycle time, review bottlenecks, deploy frequency — alongside an LLM-powered query interface and anomaly detector. The analytics tool engineering managers wish they had.

## Why This Project

- **AI-integrated full-stack** is the new default in 2026 job postings
- DevTools/SaaS hiring is steady — every company has internal dashboards like this built by hand in spreadsheets
- Demonstrates the things interviewers actually probe: API + worker separation, queue-based ingestion, rate-limit handling, idempotent sync, time-series analytics, LLM integration with grounded data, and end-to-end testing

## What It Does

```
┌──────────────────────────────────────────────────────┐
│ DevPulse — Engineering Health Dashboard              │
│                                                      │
│ PR Cycle Time (p50)     Deploy Frequency             │
│ ┌───────────────┐       ┌───────────────┐            │
│ │    4.2 hrs    │       │  3.1 / day    │            │
│ │   ▼ 18% wow   │       │  ▲ 12% wow    │            │
│ └───────────────┘       └───────────────┘            │
│                                                      │
│ ⚠ Anomaly: review wait time on backend/* is 2.4σ    │
│   above 30-day baseline. Driven by 12 PRs queued     │
│   on @alice (avg 18hr first-response).               │
│                                                      │
│ Ask DevPulse:                                        │
│ > "which PRs merged last week without review?"       │
│ > "deploy success rate for the payments service"     │
│                                                      │
│ Recent Deploys                                       │
│ ✅ payments@v2.3.1  ✅ web@v8.1.0  ❌ api@v2.2.9 ↩  │
└──────────────────────────────────────────────────────┘
```

### Features

- **PR Analytics** — cycle time (p50/p90), time-to-first-review, review-wait excluding off-hours, size distribution, force-push & rebase aware
- **Team Metrics** — review load per developer, bus factor per directory, contribution patterns
- **Deploy Tracking** — frequency, lead time for changes, change failure rate, MTTR (the four DORA metrics)
- **AI Query Interface** — natural-language questions answered via constrained text-to-SQL over the metrics warehouse, with the generated SQL shown to the user
- **Anomaly Detection** — z-score + EWMA over rolling baselines per metric/repo/team, with LLM-generated root-cause hypotheses grounded in the underlying PRs
- **Alerts** — Slack/email when metrics breach thresholds, deduped by incident key
- **Real-Time Updates** — GitHub webhooks for push/PR/deployment events; polling fallback for backfill

## Tech Stack (All Free-Tier)

| Component | Tool | Cost |
|---|---|---|
| Frontend | React + TanStack Query + Recharts on Vercel | $0 |
| API | Node.js + Fastify (TypeScript) on Render | $0 |
| Worker | Same image, separate process — BullMQ consumer | $0 |
| Queue | Upstash Redis (BullMQ) | $0 |
| Database | Neon PostgreSQL with `pg_partman` for time-series | $0 |
| GitHub Data | REST + GraphQL + Webhooks (5K req/hr authed) | $0 |
| LLM | Groq (Llama 3.3 70B) for insights, structured output for SQL | $0 |
| Auth | GitHub OAuth + signed session cookies | $0 |
| Observability | Pino structured logs → Better Stack; OpenTelemetry traces | $0 |
| CI/CD | GitHub Actions + Testcontainers for integration tests | $0 |

## Architecture

```
                    ┌──────────────┐
                    │   GitHub     │
                    └──────┬───────┘
              webhooks     │     REST/GraphQL
                  ▼        │        ▲
          ┌──────────┐     │        │ (rate-limited,
          │ Webhook  │     │        │  ETag-cached)
          │ ingester │─────┼────────┤
          └────┬─────┘     │        │
               │           ▼        │
               │     ┌──────────────┴───┐
               └────▶│  BullMQ queue    │
                     │ (Upstash Redis)  │
                     └─────────┬────────┘
                               ▼
       ┌──────────────────────────────────────────┐
       │  Worker process                           │
       │  • incremental sync (cursor + since)     │
       │  • PR event reconstruction               │
       │  • metric rollups → materialized tables  │
       │  • anomaly scan (every 15m)              │
       └─────────────────┬────────────────────────┘
                         ▼
                 ┌───────────────┐
                 │   Postgres    │◀──── API (Fastify)
                 │   (Neon)      │      • /metrics/*
                 └───────────────┘      • /ask  (text-to-SQL)
                         ▲              • /insights/:id
                         │              • OAuth, RBAC
                         └─────── Frontend (React)
```

### Repo Layout

```
devpulse/
├── apps/
│   ├── web/                    # React + Vite frontend
│   │   └── src/{pages,components,hooks,lib}/
│   ├── api/                    # Fastify HTTP API
│   │   └── src/{routes,middleware,schemas}/
│   └── worker/                 # BullMQ consumer (sync + rollups + anomalies)
│       └── src/{jobs,sync,rollups,anomaly}/
├── packages/
│   ├── db/                     # Kysely schema, migrations, query builders
│   ├── github/                 # Typed GitHub client (REST + GraphQL + webhooks)
│   ├── metrics/                # Pure metric computation — heavily unit-tested
│   └── ai/                     # Groq client, text-to-SQL guardrails, prompts
├── infra/
│   └── docker-compose.yml      # Postgres + Redis for local dev
└── .github/workflows/          # lint, typecheck, unit, integration (testcontainers)
```

## The Hard Parts (What Makes This Interview-Defensible)

**1. PR cycle time is not `merged_at - created_at`.** PRs go through draft → ready → review → changes-requested → re-review cycles, get force-pushed (which can hide commits), rebased onto main, and reopened. The metric engine reconstructs the event timeline from the PR's `timeline` API and computes:
- *time-to-first-review* — first non-author review after `ready_for_review`
- *review-wait* — sum of intervals where the ball was in a reviewer's court, excluding configured off-hours
- *coding time* — first commit on branch → ready_for_review

**2. GitHub's 5K req/hr limit forces a real ingestion design.** The worker uses conditional requests (`If-None-Match` with stored ETags), GraphQL for fan-out queries (one query for a PR's reviews + checks + commits), incremental sync with `since` cursors, and a token bucket to stay under the limit per installation. Webhooks handle the live tail; polling handles backfill and reconciliation.

**3. Text-to-SQL with guardrails.** `/ask` sends the user's question + a curated schema prompt to Groq with structured-output enforcement. Generated SQL is parsed with `pgsql-ast-parser`, rejected if it touches anything outside an allow-listed view set, executed against a read-only role with a 2s statement timeout, and shown to the user before results render. No raw LLM output ever reaches the database.

**4. Anomaly detection that doesn't cry wolf.** Per (metric, repo, team) tuple, we maintain an EWMA + rolling stddev over a 30-day window stored in a `metric_baselines` table. Alerts fire only when z > 2 *and* the absolute change clears a per-metric floor (e.g. cycle time must move ≥1hr). LLM is called only after the statistical filter passes, to draft a human-readable hypothesis grounded in the PRs that drove the change — never to decide whether to alert.

**5. Tested like production.** Unit tests for the metric engine (golden fixtures of recorded GitHub timelines). Integration tests with Testcontainers spinning up real Postgres + Redis — no mocks at the DB boundary. Contract tests against GitHub's API using recorded fixtures (`nock`).

## Run Locally

```bash
# Prereqs: Node 20+, Docker (for Postgres/Redis), pnpm
cp .env.example .env            # fill in GITHUB_CLIENT_ID, GROQ_API_KEY (both optional for first run)
docker compose up -d            # local Postgres + Redis
pnpm install
pnpm db:migrate                 # apply schema
pnpm db:seed                    # seed ~80 PRs across 3 demo repos
pnpm dev                        # runs api (:4000), worker, web (:5173) in parallel
```

Open http://localhost:5173 — the dashboard renders against the seeded data
immediately. Set `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` and the
"Connect GitHub" button in the nav goes live. Set `GROQ_API_KEY` and the
**Ask** page becomes functional.

### Useful scripts

```bash
pnpm test           # vitest across packages (metrics + ai guardrail tests)
pnpm typecheck      # tsc --noEmit across the workspace
pnpm build          # production build of all packages
```

## Roadmap

- [ ] Multi-org support with per-installation rate-limit pools
- [ ] Slack app (slash command for `/devpulse ask ...`)
- [ ] Deploy tracking via GitHub Deployments API + CI webhook adapter
- [ ] Public demo seeded with the React, Fastify, and Next.js OSS repos
