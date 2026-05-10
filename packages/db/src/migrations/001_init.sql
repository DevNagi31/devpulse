-- DevPulse initial schema
-- Stores GitHub repos, PRs, the raw event timeline, reviews, deploys.

CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  github_id     BIGINT UNIQUE NOT NULL,
  login         TEXT NOT NULL,
  name          TEXT,
  avatar_url    TEXT,
  access_token  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS repos (
  id            BIGSERIAL PRIMARY KEY,
  github_id     BIGINT UNIQUE NOT NULL,
  owner         TEXT NOT NULL,
  name          TEXT NOT NULL,
  default_branch TEXT NOT NULL DEFAULT 'main',
  added_by      BIGINT REFERENCES users(id) ON DELETE SET NULL,
  last_synced_at TIMESTAMPTZ,
  etag_pulls    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner, name)
);

CREATE TABLE IF NOT EXISTS prs (
  id              BIGSERIAL PRIMARY KEY,
  repo_id         BIGINT NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  number          INT NOT NULL,
  title           TEXT NOT NULL,
  state           TEXT NOT NULL,                         -- open | closed | merged
  author_login    TEXT NOT NULL,
  author_avatar   TEXT,
  base_ref        TEXT NOT NULL,
  head_ref        TEXT NOT NULL,
  additions       INT NOT NULL DEFAULT 0,
  deletions       INT NOT NULL DEFAULT 0,
  changed_files   INT NOT NULL DEFAULT 0,
  is_draft        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL,
  ready_at        TIMESTAMPTZ,
  first_review_at TIMESTAMPTZ,
  merged_at       TIMESTAMPTZ,
  closed_at       TIMESTAMPTZ,
  cycle_time_sec      BIGINT,
  review_wait_sec     BIGINT,
  time_to_first_review_sec BIGINT,
  UNIQUE (repo_id, number)
);

CREATE INDEX IF NOT EXISTS prs_repo_created_idx ON prs (repo_id, created_at DESC);
CREATE INDEX IF NOT EXISTS prs_author_idx       ON prs (author_login);
CREATE INDEX IF NOT EXISTS prs_state_idx        ON prs (state);

-- Raw event timeline. Source of truth — metric columns above are derived.
CREATE TABLE IF NOT EXISTS pr_events (
  id          BIGSERIAL PRIMARY KEY,
  pr_id       BIGINT NOT NULL REFERENCES prs(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,   -- opened | ready_for_review | review | review_requested |
                               -- changes_requested | commit | force_push | merged | closed
  actor_login TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS pr_events_pr_idx ON pr_events (pr_id, occurred_at);

CREATE TABLE IF NOT EXISTS reviews (
  id              BIGSERIAL PRIMARY KEY,
  pr_id           BIGINT NOT NULL REFERENCES prs(id) ON DELETE CASCADE,
  reviewer_login  TEXT NOT NULL,
  state           TEXT NOT NULL,             -- approved | changes_requested | commented
  submitted_at    TIMESTAMPTZ NOT NULL,
  response_sec    BIGINT
);

CREATE INDEX IF NOT EXISTS reviews_reviewer_idx ON reviews (reviewer_login, submitted_at DESC);

CREATE TABLE IF NOT EXISTS deploys (
  id            BIGSERIAL PRIMARY KEY,
  repo_id       BIGINT NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  service       TEXT NOT NULL,
  version       TEXT NOT NULL,
  state         TEXT NOT NULL,                -- success | failure | rolled_back
  deployed_at   TIMESTAMPTZ NOT NULL,
  duration_sec  INT
);

CREATE INDEX IF NOT EXISTS deploys_repo_time_idx ON deploys (repo_id, deployed_at DESC);
