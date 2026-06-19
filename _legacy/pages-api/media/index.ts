import type { APIRoute } from 'astro';
import { listMedia, getMedia } from '../../../lib/repo';
import { removeMedia } from '../../../lib/media';
import { json, requireUser, assertCsrf } from '../../../lib/http';

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  if (!requireUser(ctx)) return json({ error: 'Unauthorized.' }, 401);
  const media = listMedia().map((m) => ({
    id: m.id,
    url: `/uploads/${m.filename}`,
    filename: m.filename,
    width: m.width,
    height: m.height,
    size: m.size,
    alt: m.alt,
    created_at: m.created_at,
  }));
  return json({ ok: true, media });
};

export const DELETE: APIRoute = async (ctx) => {
  if (!requireUser(ctx)) return json({ error: 'Unauthorized.' }, 401);
  if (!assertCsrf(ctx)) return json({ error: 'Invalid CSRF token.' }, 403);
  let body: any;
  try {
    body = await ctx.request.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }
  const id = Number(body.id);
  const m = listMedia().find((x) => x.id === id);
  if (!m) return json({ error: 'Not found.' }, 404);
  removeMedia(m.id, m.filename);
  return json({ ok: true });
};
