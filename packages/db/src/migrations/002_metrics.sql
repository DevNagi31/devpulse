-- Read-only views exposed to the text-to-SQL endpoint.
-- These are the ONLY relations the AI is permitted to reference.

CREATE OR REPLACE VIEW v_prs AS
SELECT
  p.id,
  r.owner || '/' || r.name AS repo,
  p.number,
  p.title,
  p.state,
  p.author_login,
  p.additions,
  p.deletions,
  p.changed_files,
  p.created_at,
  p.merged_at,
  p.closed_at,
  p.cycle_time_sec,
  p.review_wait_sec,
  p.time_to_first_review_sec
FROM prs p
JOIN repos r ON r.id = p.repo_id;

CREATE OR REPLACE VIEW v_reviews AS
SELECT
  rv.id,
  r.owner || '/' || r.name AS repo,
  p.number AS pr_number,
  rv.reviewer_login,
  rv.state,
  rv.submitted_at,
  rv.response_sec
FROM reviews rv
JOIN prs p   ON p.id = rv.pr_id
JOIN repos r ON r.id = p.repo_id;

CREATE OR REPLACE VIEW v_deploys AS
SELECT
  d.id,
  r.owner || '/' || r.name AS repo,
  d.service,
  d.version,
  d.state,
  d.deployed_at,
  d.duration_sec
FROM deploys d
JOIN repos r ON r.id = d.repo_id;

-- Rolling baselines, written by the worker for anomaly detection.
CREATE TABLE IF NOT EXISTS metric_baselines (
  metric        TEXT NOT NULL,        -- cycle_time | review_wait | deploy_failure_rate
  scope_kind    TEXT NOT NULL,        -- repo | team | global
  scope_id      TEXT NOT NULL,
  window_days   INT  NOT NULL,
  ewma          DOUBLE PRECISION NOT NULL,
  stddev        DOUBLE PRECISION NOT NULL,
  sample_count  INT  NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (metric, scope_kind, scope_id, window_days)
);
