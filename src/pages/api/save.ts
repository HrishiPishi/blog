import type { APIRoute } from 'astro';
import { backupContent, writePost, safeSlug, type PostFront } from '../../server/content-fs';

export const prerender = false;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// Saves a post to src/content/posts/<slug>.md, AFTER snapshotting the whole
// src/content tree into backups/backup-<timestamp>/. Dev-only.
export const POST: APIRoute = async (ctx) => {
  if (!import.meta.env.DEV) return json({ error: 'Editing is only available in dev.' }, 404);

  let body: any;
  try {
    body = await ctx.request.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }

  const slug = safeSlug(body.slug ?? '');
  if (!slug) return json({ error: 'Invalid slug (use letters, numbers, hyphens).' }, 400);

  const f = body.front ?? {};
  const front: PostFront = {
    title: String(f.title ?? 'Untitled').slice(0, 200),
    date: String(f.date ?? '').slice(0, 10) || new Date().toISOString().slice(0, 10),
    category: toArr(f.category),
    tags: toArr(f.tags),
    thumbnail: f.thumbnail ? String(f.thumbnail).slice(0, 300) : undefined,
    layoutType: ['math', 'text', 'gallery', 'list'].includes(f.layoutType) ? f.layoutType : 'text',
    draft: Boolean(f.draft),
  };
  const content = String(body.body ?? '');
  const originalSlug = body.originalSlug ? safeSlug(body.originalSlug) || undefined : undefined;

  try {
    // 1) Back up EVERYTHING first, so this save is fully reversible.
    const backup = backupContent();
    // 2) Then write the new version.
    writePost(slug, front, content, originalSlug);
    return json({ ok: true, slug, backup });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
};

function toArr(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === 'string') return v.split(',').map((s) => s.trim()).filter(Boolean);
  return [];
}
