import type { APIRoute } from 'astro';
import {
  getUserByName,
  verifyPassword,
  createSession,
  newCsrfToken,
  isLockedOut,
  recordFailedLogin,
  clearLoginAttempts,
} from '../../../lib/auth';
import { json, clientIp, setAuthCookies } from '../../../lib/http';

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const ip = clientIp(ctx);
  if (isLockedOut(ip)) {
    return json({ error: 'Too many attempts. Try again later.' }, 429);
  }

  let body: { username?: string; password?: string };
  try {
    body = await ctx.request.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  const username = String(body.username ?? '').trim();
  const password = String(body.password ?? '');
  if (!username || !password) return json({ error: 'Username and password required.' }, 400);

  const user = getUserByName(username);
  // Always run a verify to keep timing roughly constant even when user missing.
  const ok = user
    ? verifyPassword(password, user.password_hash)
    : verifyPassword(password, 'scrypt$00$00');

  if (!user || !ok) {
    recordFailedLogin(ip);
    return json({ error: 'Incorrect username or password.' }, 401);
  }

  clearLoginAttempts(ip);
  const token = createSession(user.id, ctx.request.headers.get('user-agent'), ip);
  const csrf = newCsrfToken();
  setAuthCookies(ctx, token, csrf);
  return json({ ok: true });
};
