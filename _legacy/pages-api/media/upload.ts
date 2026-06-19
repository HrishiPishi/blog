import type { APIRoute } from 'astro';
import { processUpload } from '../../../lib/media';
import { json, requireUser, assertCsrf } from '../../../lib/http';

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  if (!requireUser(ctx)) return json({ error: 'Unauthorized.' }, 401);
  if (!assertCsrf(ctx)) return json({ error: 'Invalid CSRF token.' }, 403);

  let form: FormData;
  try {
    form = await ctx.request.formData();
  } catch {
    return json({ error: 'Invalid upload.' }, 400);
  }
  const file = form.get('file');
  if (!(file instanceof File)) return json({ error: 'No file provided.' }, 400);

  const result = await processUpload(file);
  if (!result.ok || !result.media) return json({ error: result.error ?? 'Upload failed.' }, 400);

  const m = result.media;
  return json({
    ok: true,
    media: { id: m.id, url: `/uploads/${m.filename}`, width: m.width, height: m.height, alt: m.alt },
  });
};
