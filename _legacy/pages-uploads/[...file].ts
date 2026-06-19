import type { APIRoute } from 'astro';
import { streamMedia } from '../../lib/media';

export const prerender = false;

// Serves re-encoded media from data/media with long-lived caching.
export const GET: APIRoute = async (ctx) => {
  const file = String(ctx.params.file ?? '');
  const res = streamMedia(file);
  if (!res) return new Response('Not found', { status: 404 });
  return res;
};
