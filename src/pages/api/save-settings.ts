import type { APIRoute } from 'astro';
import { backupContent, writeSiteConfig, type SiteConfig } from '../../server/content-fs';

export const prerender = false;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

// Saves site-wide settings to src/content/site.json, after backing up the whole
// src/content tree first (so settings edits are reversible too). Dev-only.
export const POST: APIRoute = async (ctx) => {
  if (!import.meta.env.DEV) return json({ error: 'Editing is only available in dev.' }, 404);

  let body: any;
  try {
    body = await ctx.request.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }

  const cfg: SiteConfig = {
    title: String(body.title ?? ''),
    tagline: String(body.tagline ?? ''),
    author: String(body.author ?? ''),
    instagram: String(body.instagram ?? ''),
    spotify: String(body.spotify ?? ''),
    about: String(body.about ?? ''),
  };

  try {
    const backup = backupContent();
    writeSiteConfig(cfg);
    return json({ ok: true, backup });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
};
