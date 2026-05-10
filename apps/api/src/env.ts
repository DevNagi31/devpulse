import { z } from 'zod';

const Env = z.object({
  NODE_ENV: z.string().default('development'),
  API_PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().optional(),
  SESSION_SECRET: z.string().min(32),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),

  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_OAUTH_CALLBACK: z.string().optional(),

  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),
});

export const env = Env.parse(process.env);
export type Env = z.infer<typeof Env>;
