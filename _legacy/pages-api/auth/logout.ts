import type { APIRoute } from 'astro';
import { SESSION_COOKIE, destroySession } from '../../../lib/auth';
import { json, assertCsrf, clearAuthCookies } from '../../../lib/http';

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  if (!assertCsrf(ctx)) return json({ error: 'Invalid CSRF token.' }, 403);
  const token = ctx.cookies.get(SESSION_COOKIE)?.value;
  destroySession(token);
  clearAuthCookies(ctx);
  return json({ ok: true });
};
