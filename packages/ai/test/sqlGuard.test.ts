import { describe, it, expect } from 'vitest';
import { guardSelect, SqlGuardError } from '../src/sqlGuard.js';

describe('guardSelect', () => {
  it('passes a basic SELECT against an allowed view', () => {
    const r = guardSelect('SELECT * FROM v_prs WHERE state = \'merged\' LIMIT 10');
    expect(r.sql.toLowerCase()).toContain('limit 10');
  });

  it('appends LIMIT when missing', () => {
    const r = guardSelect('SELECT count(*) FROM v_prs');
    expect(r.sql.toLowerCase()).toMatch(/limit 500$/);
  });

  it('caps oversized LIMIT', () => {
    const r = guardSelect('SELECT * FROM v_prs LIMIT 99999');
    expect(r.sql.toLowerCase()).toContain('limit 500');
  });

  it('rejects DROP', () => {
    expect(() => guardSelect('DROP TABLE prs')).toThrow(SqlGuardError);
  });

  it('rejects DELETE', () => {
    expect(() => guardSelect('DELETE FROM v_prs')).toThrow(SqlGuardError);
  });

  it('rejects UPDATE', () => {
    expect(() => guardSelect('UPDATE v_prs SET title = \'x\'')).toThrow(SqlGuardError);
  });

  it('rejects access to non-allowlisted table', () => {
    expect(() => guardSelect('SELECT * FROM users LIMIT 1')).toThrow(SqlGuardError);
  });

  it('rejects multi-statement (stacked queries)', () => {
    expect(() => guardSelect('SELECT 1 FROM v_prs; SELECT 1 FROM v_prs')).toThrow(SqlGuardError);
  });

  it('rejects subquery referencing forbidden table', () => {
    expect(() =>
      guardSelect("SELECT * FROM v_prs WHERE author_login IN (SELECT login FROM users)"),
    ).toThrow(SqlGuardError);
  });

  it('allows JOIN across two allowed views', () => {
    const r = guardSelect(
      'SELECT p.title, r.reviewer_login FROM v_prs p JOIN v_reviews r ON r.pr_number = p.number LIMIT 20',
    );
    expect(r.sql.toLowerCase()).toContain('limit 20');
  });
});
