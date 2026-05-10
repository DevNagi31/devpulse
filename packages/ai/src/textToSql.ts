import { GroqClient } from './groq.js';
import { guardSelect, SqlGuardError } from './sqlGuard.js';

const SCHEMA_PROMPT = `You translate engineering questions into PostgreSQL SELECT queries.

You may ONLY reference these views — no other relations exist:

  v_prs(id, repo, number, title, state, author_login, additions, deletions,
        changed_files, created_at, merged_at, closed_at,
        cycle_time_sec, review_wait_sec, time_to_first_review_sec)
    state ∈ ('open','closed','merged')

  v_reviews(id, repo, pr_number, reviewer_login, state, submitted_at, response_sec)
    state ∈ ('approved','changes_requested','commented')

  v_deploys(id, repo, service, version, state, deployed_at, duration_sec)
    state ∈ ('success','failure','rolled_back')

Rules:
  - Output a single SELECT statement, no semicolon, no commentary.
  - Always include a LIMIT (default 50, never above 500).
  - Use ONLY the relations and columns above.
  - Time math: cycle_time_sec / 3600.0 AS cycle_hours when humans want hours.
  - Prefer percentile_cont(0.5) WITHIN GROUP (ORDER BY x) for medians.
  - When the user asks about "last week" use created_at >= now() - interval '7 days'.

Output JSON only: {"sql": "<the query>"}`;

export interface TextToSqlResult {
  sql: string;
  rewritten: boolean;
}

export async function textToSql(client: GroqClient, question: string): Promise<TextToSqlResult> {
  const raw = await client.chat({
    messages: [
      { role: 'system', content: SCHEMA_PROMPT },
      { role: 'user', content: question },
    ],
    jsonMode: true,
    temperature: 0,
    maxTokens: 512,
  });

  let parsed: { sql?: string };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new SqlGuardError('LLM returned non-JSON');
  }
  const sql = parsed.sql?.trim();
  if (!sql) throw new SqlGuardError('LLM returned empty sql');

  const guarded = guardSelect(sql);
  return { sql: guarded.sql, rewritten: guarded.sql !== sql };
}

export { SqlGuardError };
