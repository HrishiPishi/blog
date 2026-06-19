import type { APIRoute } from 'astro';
import {
  getPostById,
  updatePost,
  setPostStatus,
  deletePost,
  snapshot,
  listVersions,
  getVersion,
  uniqueSlug,
} from '../../../lib/repo';
import { renderDocument } from '../../../lib/render';
import { json, requireUser, assertCsrf } from '../../../lib/http';

export const prerender = false;

function pid(ctx: Parameters<APIRoute>[0]): number {
  return Number(ctx.params.id);
}

// ---- autosave / save ------------------------------------------------------
export const PUT: APIRoute = async (ctx) => {
  if (!requireUser(ctx)) return json({ error: 'Unauthorized.' }, 401);
  if (!assertCsrf(ctx)) return json({ error: 'Invalid CSRF token.' }, 403);
  const id = pid(ctx);
  const post = getPostById(id);
  if (!post) return json({ error: 'Not found.' }, 404);

  let body: any;
  try {
    body = await ctx.request.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  const doc = body.doc ?? {};
  const { html, text } = renderDocument(doc);
  const tags = Array.isArray(body.tags)
    ? body.tags.map((t: unknown) => String(t).trim()).filter(Boolean).slice(0, 12)
    : [];

  updatePost(id, {
    title: String(body.title ?? 'Untitled').slice(0, 200),
    abstract: String(body.abstract ?? '').slice(0, 400),
    tags,
    cover_image: body.cover_image ? String(body.cover_image) : null,
    content_json: JSON.stringify(doc),
    content_html: html,
    plain_text: text,
  });

  // Version snapshots: always on manual save; for autosave, throttle to ~90s.
  const mode = ctx.url.searchParams.get('snapshot');
  if (mode === 'manual') {
    snapshot(id, 'manual save');
  } else if (mode === 'auto') {
    const last = listVersions(id)[0];
    const age = last
      ? Date.now() - new Date(last.created_at.replace(' ', 'T') + 'Z').getTime()
      : Infinity;
    if (age > 90_000) snapshot(id, 'autosave');
  }

  const fresh = getPostById(id)!;
  return json({ ok: true, updated_at: fresh.updated_at, reading_time: fresh.reading_time });
};

// ---- publish / unpublish / revert -----------------------------------------
export const PATCH: APIRoute = async (ctx) => {
  if (!requireUser(ctx)) return json({ error: 'Unauthorized.' }, 401);
  if (!assertCsrf(ctx)) return json({ error: 'Invalid CSRF token.' }, 403);
  const id = pid(ctx);
  const post = getPostById(id);
  if (!post) return json({ error: 'Not found.' }, 404);

  let body: any;
  try {
    body = await ctx.request.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  switch (body.action) {
    case 'publish': {
      snapshot(id, 'published');
      let slug = post.slug;
      const desired = String(body.slug ?? '').trim();
      if (desired) slug = uniqueSlug(desired, id);
      else if (slug.startsWith('untitled-')) slug = uniqueSlug(post.title || 'untitled', id);
      const updated = setPostStatus(id, 'published', slug);
      return json({ ok: true, slug: updated.slug, status: updated.status });
    }
    case 'unpublish': {
      const updated = setPostStatus(id, 'draft');
      return json({ ok: true, status: updated.status });
    }
    case 'revert': {
      const v = getVersion(Number(body.versionId));
      if (!v || v.post_id !== id) return json({ error: 'Version not found.' }, 404);
      snapshot(id, 'before revert');
      const { html, text } = renderDocument(v.content_json);
      let tags: string[] = [];
      try {
        tags = JSON.parse(v.tags);
      } catch {
        tags = [];
      }
      updatePost(id, {
        title: v.title,
        abstract: v.abstract,
        tags,
        cover_image: post.cover_image,
        content_json: v.content_json,
        content_html: html,
        plain_text: text,
      });
      return json({ ok: true });
    }
    default:
      return json({ error: 'Unknown action.' }, 400);
  }
};

export const DELETE: APIRoute = async (ctx) => {
  if (!requireUser(ctx)) return json({ error: 'Unauthorized.' }, 401);
  if (!assertCsrf(ctx)) return json({ error: 'Invalid CSRF token.' }, 403);
  const id = pid(ctx);
  if (!getPostById(id)) return json({ error: 'Not found.' }, 404);
  deletePost(id);
  return json({ ok: true });
};
