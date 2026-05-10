import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import type { DB } from './schema.js';

let _db: Kysely<DB> | null = null;

export function getDb(databaseUrl = process.env.DATABASE_URL): Kysely<DB> {
  if (_db) return _db;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 10 });
  _db = new Kysely<DB>({ dialect: new PostgresDialect({ pool }) });
  return _db;
}

export async function closeDb(): Promise<void> {
  if (_db) {
    await _db.destroy();
    _db = null;
  }
}
