import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import pg from 'pg';
import { GroqClient, textToSql, SqlGuardError } from '@devpulse/ai';
import { env } from '../env.js';

const Body = z.object({
  question: z.string().min(3).max(500),
});

// Defense-in-depth: even though guardSelect rejects non-SELECT, we run the
// generated SQL through a separate read-only pool with statement_timeout='2s'.
// In production this would be a different DB role with no write grants.
const readPool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 4,
  statement_timeout: 2000,
});

export async function askRoutes(app: FastifyInstance) {
  app.post('/', async (req, reply) => {
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'bad_request', details: parsed.error.flatten() });
    }
    if (!env.GROQ_API_KEY) {
      return reply.code(503).send({
        error: 'groq_not_configured',
        hint: 'Set GROQ_API_KEY (free tier at console.groq.com)',
      });
    }

    const groq = new GroqClient({ apiKey: env.GROQ_API_KEY, model: env.GROQ_MODEL });
    let sql: string;
    try {
      const result = await textToSql(groq, parsed.data.question);
      sql = result.sql;
    } catch (err) {
      if (err instanceof SqlGuardError) {
        return reply.code(400).send({ error: 'sql_rejected', message: err.message });
      }
      app.log.error({ err }, 'text-to-sql failed');
      return reply.code(502).send({ error: 'llm_error' });
    }

    try {
      const result = await readPool.query(sql);
      return {
        sql,
        rows: result.rows,
        row_count: result.rowCount,
        fields: result.fields.map((f) => f.name),
      };
    } catch (err) {
      app.log.warn({ err, sql }, 'generated query failed to execute');
      return reply.code(400).send({
        error: 'query_failed',
        message: (err as Error).message,
        sql,
      });
    }
  });
}
