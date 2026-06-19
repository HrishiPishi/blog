import type { APIRoute } from 'astro';
import { createPost } from '../../../lib/repo';
import { json, requireUser, assertCsrf } from '../../../lib/http';

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  if (!requireUser(ctx)) return json({ error: 'Unauthorized.' }, 401);
  if (!assertCsrf(ctx)) return json({ error: 'Invalid CSRF token.' }, 403);
  const post = createPost();
  return json({ ok: true, id: post.id, slug: post.slug });
};
