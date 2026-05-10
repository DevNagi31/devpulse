import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import session from '@fastify/session';
import { ZodError } from 'zod';
import { env } from './env.js';
import { metricsRoutes } from './routes/metrics.js';
import { reposRoutes } from './routes/repos.js';
import { authRoutes } from './routes/auth.js';
import { askRoutes } from './routes/ask.js';

declare module 'fastify' {
  interface Session {
    userId?: string;
    login?: string;
    avatarUrl?: string;
    accessToken?: string;
    oauthState?: string;
  }
}

export async function buildServer() {
  const app = Fastify({
    logger: {
      transport: env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
    },
  });

  await app.register(cors, {
    origin: env.WEB_ORIGIN,
    credentials: true,
  });

  await app.register(cookie);
  await app.register(session, {
    secret: env.SESSION_SECRET,
    cookie: {
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 30,
    },
  });

  // Convert validation errors to clean 400s instead of letting them bubble
  // up as 500s with raw Zod error blobs in the body.
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({
        error: 'bad_request',
        details: err.flatten(),
      });
    }
    const e = err as { statusCode?: number; name?: string; code?: string; message?: string };
    app.log.error({ err: e }, 'unhandled error');
    return reply.code(e.statusCode ?? 500).send({
      error: e.name === 'FastifyError' ? e.code ?? 'error' : 'internal_error',
      message: e.message ?? 'unknown error',
    });
  });

  app.get('/health', async () => ({ ok: true, ts: new Date().toISOString() }));

  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(reposRoutes, { prefix: '/repos' });
  await app.register(metricsRoutes, { prefix: '/metrics' });
  await app.register(askRoutes, { prefix: '/ask' });

  return app;
}
