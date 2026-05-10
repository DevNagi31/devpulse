import { buildServer } from './server.js';
import { env } from './env.js';

const app = await buildServer();

try {
  await app.listen({ port: env.API_PORT, host: '0.0.0.0' });
  app.log.info(`api listening on :${env.API_PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
