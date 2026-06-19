import type { APIRoute } from 'astro';
import { listVersions, getPostById } from '../../../../lib/repo';
import { json, requireUser } from '../../../../lib/http';

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  if (!requireUser(ctx)) return json({ error: 'Unauthorized.' }, 401);
  const id = Number(ctx.params.id);
  if (!getPostById(id)) return json({ error: 'Not found.' }, 404);
  const versions = listVersions(id).map((v) => ({
    id: v.id,
    label: v.label,
    title: v.title,
    created_at: v.created_at,
  }));
  return json({ ok: true, versions });
};
