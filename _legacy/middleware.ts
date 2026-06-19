import { defineMiddleware } from 'astro:middleware';
import { SESSION_COOKIE, getSessionUser } from './lib/auth';

export const onRequest = defineMiddleware(async (ctx, next) => {
  // Attach the current user (if any) to locals for pages/endpoints.
  const token = ctx.cookies.get(SESSION_COOKIE)?.value;
  ctx.locals.user = getSessionUser(token);

  const res = await next();

  // ---- Security headers (applied to every response) -----------------------
  const h = res.headers;
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('X-Frame-Options', 'DENY');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  // Astro's built-in CSP emits a header with hash-locked script-src (good) but
  // also style hashes, which per spec void the 'unsafe-inline' that KaTeX's
  // inline style attributes require. Rewrite ONLY style-src to drop those hashes
  // so 'unsafe-inline' is honored; script-src keeps its hashes untouched.
  const csp = h.get('content-security-policy');
  if (csp) {
    h.set(
      'content-security-policy',
      csp.replace(/style-src[^;]*/, "style-src 'self' 'unsafe-inline'")
    );
  }

  if (import.meta.env.PROD) {
    h.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  }
  return res;
});
