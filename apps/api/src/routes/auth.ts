import type { FastifyInstance } from 'fastify';
import { randomBytes } from 'node:crypto';
import { authorizeUrl, exchangeCode, fetchViewer } from '@devpulse/github';
import { getDb } from '@devpulse/db';
import { env } from '../env.js';

export async function authRoutes(app: FastifyInstance) {
  const db = getDb();

  app.get('/me', async (req) => {
    if (!req.session.userId) return { authenticated: false };
    return {
      authenticated: true,
      login: req.session.login,
      avatar_url: req.session.avatarUrl,
    };
  });

  app.post('/logout', async (req, reply) => {
    await req.session.destroy();
    return reply.send({ ok: true });
  });

  app.get('/github', async (req, reply) => {
    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !env.GITHUB_OAUTH_CALLBACK) {
      return reply.code(503).send({
        error: 'oauth_not_configured',
        hint: 'Set GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET / GITHUB_OAUTH_CALLBACK',
      });
    }
    const state = randomBytes(16).toString('hex');
    req.session.oauthState = state;
    const url = authorizeUrl(
      {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
        callbackUrl: env.GITHUB_OAUTH_CALLBACK,
      },
      state,
    );
    return reply.redirect(url);
  });

  app.get<{ Querystring: { code?: string; state?: string } }>(
    '/github/callback',
    async (req, reply) => {
      const { code, state } = req.query;
      if (!code) return reply.code(400).send({ error: 'missing_code' });
      if (!state || state !== req.session.oauthState) {
        return reply.code(400).send({ error: 'state_mismatch' });
      }
      if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !env.GITHUB_OAUTH_CALLBACK) {
        return reply.code(503).send({ error: 'oauth_not_configured' });
      }

      const { access_token } = await exchangeCode(
        {
          clientId: env.GITHUB_CLIENT_ID,
          clientSecret: env.GITHUB_CLIENT_SECRET,
          callbackUrl: env.GITHUB_OAUTH_CALLBACK,
        },
        code,
      );
      const viewer = await fetchViewer(access_token);

      const user = await db
        .insertInto('users')
        .values({
          github_id: String(viewer.id),
          login: viewer.login,
          name: viewer.name,
          avatar_url: viewer.avatar_url,
          access_token,
        })
        .onConflict((oc) =>
          oc.column('github_id').doUpdateSet({
            login: viewer.login,
            name: viewer.name,
            avatar_url: viewer.avatar_url,
            access_token,
          }),
        )
        .returning(['id'])
        .executeTakeFirstOrThrow();

      req.session.userId = String(user.id);
      req.session.login = viewer.login;
      req.session.avatarUrl = viewer.avatar_url;
      req.session.accessToken = access_token;

      return reply.redirect(env.WEB_ORIGIN);
    },
  );
}
