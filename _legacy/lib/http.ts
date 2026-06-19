import type { APIContext } from 'astro';
import { CSRF_COOKIE, SESSION_COOKIE, csrfValid, getSessionUser } from './auth';

export function clientIp(ctx: APIContext): string {
  const xf = ctx.request.headers.get('x-forwarded-for');
  if (xf) return xf.split(',')[0].trim();
  return ctx.clientAddress || '0.0.0.0';
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export function requireUser(ctx: APIContext) {
  const token = ctx.cookies.get(SESSION_COOKIE)?.value;
  return getSessionUser(token);
}

// Mutating API calls must carry a valid CSRF token AND a same-origin header.
export function assertCsrf(ctx: APIContext): boolean {
  const cookie = ctx.cookies.get(CSRF_COOKIE)?.value;
  const header = ctx.request.headers.get('x-csrf-token') ?? undefined;
  if (!csrfValid(cookie, header)) return false;

  // Origin check as defense-in-depth.
  const origin = ctx.request.headers.get('origin');
  if (origin) {
    try {
      const o = new URL(origin);
      if (o.host !== ctx.url.host) return false;
    } catch {
      return false;
    }
  }
  return true;
}

export function isProd(): boolean {
  return import.meta.env.PROD;
}

const SESSION_MAX_AGE = 14 * 86400;

export function setAuthCookies(ctx: APIContext, sessionToken: string, csrfToken: string): void {
  const secure = isProd();
  ctx.cookies.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
  // CSRF cookie is intentionally readable by JS (double-submit pattern).
  ctx.cookies.set(CSRF_COOKIE, csrfToken, {
    httpOnly: false,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
}

export function clearAuthCookies(ctx: APIContext): void {
  ctx.cookies.delete(SESSION_COOKIE, { path: '/' });
  ctx.cookies.delete(CSRF_COOKIE, { path: '/' });
}
