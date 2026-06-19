import type { APIRoute } from 'astro';
import { getSettings, setSettings } from '../../lib/repo';
import { json, requireUser, assertCsrf } from '../../lib/http';

export const prerender = false;

const ALLOWED_KEYS = new Set([
  'site_title',
  'site_tagline',
  'author_name',
  'instagram',
  'about',
  'footer_note',
]);

export const GET: APIRoute = async (ctx) => {
  if (!requireUser(ctx)) return json({ error: 'Unauthorized.' }, 401);
  return json({ ok: true, settings: getSettings() });
};

export const PUT: APIRoute = async (ctx) => {
  if (!requireUser(ctx)) return json({ error: 'Unauthorized.' }, 401);
  if (!assertCsrf(ctx)) return json({ error: 'Invalid CSRF token.' }, 403);
  let body: any;
  try {
    body = await ctx.request.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }
  const partial: Record<string, string> = {};
  for (const [k, v] of Object.entries(body ?? {})) {
    if (ALLOWED_KEYS.has(k)) partial[k] = String(v).slice(0, 2000);
  }
  setSettings(partial);
  return json({ ok: true, settings: getSettings() });
};
