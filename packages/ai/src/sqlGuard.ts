import { parse, type Statement } from 'pgsql-ast-parser';

/**
 * SQL safety check for the text-to-SQL endpoint.
 *
 * Approach: parse the LLM's output into an AST, then walk it and reject
 * anything outside an explicit allow-list. This is structural — string
 * matching for "DROP" or "DELETE" is famously easy to bypass.
 *
 * Allowed:
 *   - exactly one statement
 *   - SELECT only (no CTE writes, no UPDATE/DELETE/INSERT/DDL)
 *   - tables / aliases must be from ALLOWED_RELATIONS
 *   - LIMIT must be present and ≤ MAX_LIMIT (else we cap it)
 *
 * Even past this, the API runs the query against a read-only role with
 * statement_timeout='2s' as defense-in-depth.
 */

export const ALLOWED_RELATIONS = new Set(['v_prs', 'v_reviews', 'v_deploys']);
export const MAX_LIMIT = 500;

export class SqlGuardError extends Error {
  constructor(message: string) {
    super(`SQL rejected: ${message}`);
  }
}

export interface GuardResult {
  /** Possibly rewritten SQL (e.g. with LIMIT injected). */
  sql: string;
}

export function guardSelect(rawSql: string): GuardResult {
  const trimmed = rawSql.trim().replace(/;+\s*$/, '');
  let stmts: Statement[];
  try {
    stmts = parse(trimmed);
  } catch (err) {
    throw new SqlGuardError(`parse error: ${(err as Error).message}`);
  }
  if (stmts.length !== 1) throw new SqlGuardError('exactly one statement required');
  const stmt = stmts[0]!;
  if (stmt.type !== 'select') throw new SqlGuardError(`statement type "${stmt.type}" not allowed`);

  const tables = collectTableNames(stmt);
  for (const t of tables) {
    if (!ALLOWED_RELATIONS.has(t)) {
      throw new SqlGuardError(`relation "${t}" is not in the allow-list`);
    }
  }

  // Cap LIMIT — if missing, append; if too large, reduce.
  let sql = trimmed;
  const limitMatch = /\blimit\s+(\d+)\b/i.exec(sql);
  if (!limitMatch) {
    sql = `${sql} LIMIT ${MAX_LIMIT}`;
  } else if (Number(limitMatch[1]) > MAX_LIMIT) {
    sql = sql.replace(limitMatch[0], `LIMIT ${MAX_LIMIT}`);
  }
  return { sql };
}

function collectTableNames(node: unknown, acc: Set<string> = new Set()): Set<string> {
  if (!node || typeof node !== 'object') return acc;
  const obj = node as Record<string, unknown>;

  // pgsql-ast-parser uses { type: 'table', name: { name: 'foo' } } shapes
  if (obj.type === 'table' && obj.name && typeof obj.name === 'object') {
    const n = (obj.name as { name?: string }).name;
    if (typeof n === 'string') acc.add(n);
  }
  for (const v of Object.values(obj)) {
    if (Array.isArray(v)) {
      for (const item of v) collectTableNames(item, acc);
    } else if (v && typeof v === 'object') {
      collectTableNames(v, acc);
    }
  }
  return acc;
}
