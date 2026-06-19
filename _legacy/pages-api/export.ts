import type { APIRoute } from 'astro';
import { listPosts, getSettings } from '../../lib/repo';
import { requireUser } from '../../lib/http';

export const prerender = false;

// Full content backup (posts + settings) as a downloadable JSON file.
export const GET: APIRoute = async (ctx) => {
  if (!requireUser(ctx)) return new Response('Unauthorized', { status: 401 });
  const payload = {
    exported_at: new Date().toISOString(),
    settings: getSettings(),
    posts: [...listPosts({ status: 'published' }), ...listPosts({ status: 'draft' })],
  };
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      'content-type': 'application/json',
      'content-disposition': 'attachment; filename="blog-backup.json"',
    },
  });
};
