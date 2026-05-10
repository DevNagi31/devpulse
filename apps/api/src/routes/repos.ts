import type { FastifyInstance } from 'fastify';
import { getDb } from '@devpulse/db';

export async function reposRoutes(app: FastifyInstance) {
  const db = getDb();

  app.get('/', async () => {
    const rows = await db
      .selectFrom('repos')
      .select(['id', 'owner', 'name', 'default_branch', 'last_synced_at'])
      .orderBy('owner')
      .execute();
    return rows;
  });
}
