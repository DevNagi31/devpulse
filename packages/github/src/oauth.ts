// Minimal GitHub OAuth helpers — not using a heavy passport dep on purpose,
// the flow is small enough to own.

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  scopes?: string[];
}

export function authorizeUrl(cfg: OAuthConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.callbackUrl,
    scope: (cfg.scopes ?? ['read:user', 'repo']).join(' '),
    state,
    allow_signup: 'true',
  });
  return `https://github.com/login/oauth/authorize?${params}`;
}

export async function exchangeCode(cfg: OAuthConfig, code: string): Promise<{
  access_token: string;
  scope: string;
  token_type: string;
}> {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      code,
      redirect_uri: cfg.callbackUrl,
    }),
  });
  if (!res.ok) throw new Error(`oauth exchange failed: ${res.status}`);
  const json = (await res.json()) as { access_token?: string; error?: string; scope?: string; token_type?: string };
  if (!json.access_token) throw new Error(`oauth missing token: ${json.error ?? 'unknown'}`);
  return { access_token: json.access_token, scope: json.scope ?? '', token_type: json.token_type ?? 'bearer' };
}

export async function fetchViewer(token: string): Promise<{
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
}> {
  const res = await fetch('https://api.github.com/user', {
    headers: { authorization: `token ${token}`, accept: 'application/vnd.github+json' },
  });
  if (!res.ok) throw new Error(`viewer fetch failed: ${res.status}`);
  return (await res.json()) as { id: number; login: string; name: string | null; avatar_url: string };
}
