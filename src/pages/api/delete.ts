import type { APIRoute } from 'astro';
import { backupContent, deletePost, safeSlug } from '../../server/content-fs';

export const prerender = false;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

// Deletes a post — but backs up the whole content tree first, so a delete is
// itself reversible from backups/. Dev-only.
export const POST: APIRoute = async (ctx) => {
  if (!import.meta.env.DEV) return json({ error: 'Editing is only available in dev.' }, 404);

  let body: any;
  try {
    body = await ctx.request.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }

  const slug = safeSlug(body.slug ?? '');
  if (!slug) return json({ error: 'Invalid slug.' }, 400);

  const backup = backupContent();
  const ok = deletePost(slug);
  if (!ok) return json({ error: 'Post not found.' }, 404);
  return json({ ok: true, backup });
};
