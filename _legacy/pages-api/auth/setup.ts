import type { APIRoute } from 'astro';
import { userCount, createUser, createSession, newCsrfToken } from '../../../lib/auth';
import { json, clientIp, setAuthCookies } from '../../../lib/http';

export const prerender = false;

// First-run only: creates the single admin account when none exists yet.
export const POST: APIRoute = async (ctx) => {
  if (userCount() > 0) return json({ error: 'Setup already complete.' }, 403);

  let body: { username?: string; password?: string };
  try {
    body = await ctx.request.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  const username = String(body.username ?? '').trim();
  const password = String(body.password ?? '');
  if (username.length < 3) return json({ error: 'Username must be at least 3 characters.' }, 400);
  if (password.length < 10) return json({ error: 'Password must be at least 10 characters.' }, 400);

  const id = createUser(username, password);
  const token = createSession(id, ctx.request.headers.get('user-agent'), clientIp(ctx));
  const csrf = newCsrfToken();
  setAuthCookies(ctx, token, csrf);
  return json({ ok: true });
};
