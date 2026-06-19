import sharp from 'sharp';
import { mkdirSync, createReadStream, existsSync, statSync, unlinkSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { randomBytes } from 'node:crypto';
import { addMedia, getMedia, deleteMedia as repoDeleteMedia } from './repo';

export const MEDIA_DIR = process.env.BLOG_MEDIA_DIR ?? resolve(process.cwd(), 'data/media');
const MAX_BYTES = 12 * 1024 * 1024; // 12 MB upload cap
const MAX_DIM = 2400; // downscale very large images

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);

mkdirSync(MEDIA_DIR, { recursive: true });

export interface ProcessResult {
  ok: boolean;
  error?: string;
  media?: ReturnType<typeof addMedia>;
}

// Re-encode uploads through sharp. This both strips EXIF/embedded payloads
// (a common image-based attack vector) and produces a normalized web image.
export async function processUpload(file: File): Promise<ProcessResult> {
  if (!ALLOWED.has(file.type)) return { ok: false, error: 'Unsupported image type.' };
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.byteLength === 0) return { ok: false, error: 'Empty file.' };
  if (buf.byteLength > MAX_BYTES) return { ok: false, error: 'File too large (max 12 MB).' };

  const isGif = file.type === 'image/gif';
  const id = randomBytes(8).toString('hex');

  try {
    if (isGif) {
      // Keep animation; just validate + copy through sharp (no re-encode of frames).
      const meta = await sharp(buf, { animated: true }).metadata();
      const filename = `${id}.gif`;
      const { writeFileSync } = await import('node:fs');
      writeFileSync(resolve(MEDIA_DIR, filename), buf);
      const media = addMedia({
        filename,
        original_name: safeName(file.name),
        mime: 'image/gif',
        width: meta.width ?? null,
        height: meta.height ?? null,
        size: buf.byteLength,
        alt: '',
      });
      return { ok: true, media };
    }

    const pipeline = sharp(buf, { failOn: 'error' }).rotate(); // auto-orient, then drop metadata
    const meta = await pipeline.metadata();
    let img = pipeline;
    if ((meta.width ?? 0) > MAX_DIM || (meta.height ?? 0) > MAX_DIM) {
      img = img.resize({ width: MAX_DIM, height: MAX_DIM, fit: 'inside', withoutEnlargement: true });
    }
    const out = await img.webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
    const filename = `${id}.webp`;
    const { writeFileSync } = await import('node:fs');
    writeFileSync(resolve(MEDIA_DIR, filename), out.data);
    const media = addMedia({
      filename,
      original_name: safeName(file.name),
      mime: 'image/webp',
      width: out.info.width,
      height: out.info.height,
      size: out.data.byteLength,
      alt: '',
    });
    return { ok: true, media };
  } catch (e) {
    return { ok: false, error: 'Could not process image (corrupt or unsupported).' };
  }
}

// Path-traversal-safe resolve + stream for the /uploads endpoint.
export function resolveMedia(filename: string): { path: string; mime: string } | null {
  const clean = basename(filename); // strips any ../ segments
  if (clean !== filename || !/^[a-z0-9]+\.(webp|gif|png|jpe?g|avif)$/i.test(clean)) return null;
  const row = getMedia(clean);
  if (!row) return null;
  const path = resolve(MEDIA_DIR, clean);
  if (!existsSync(path)) return null;
  return { path, mime: row.mime };
}

export function streamMedia(filename: string): Response | null {
  const found = resolveMedia(filename);
  if (!found) return null;
  const size = statSync(found.path).size;
  const stream = createReadStream(found.path) as unknown as ReadableStream;
  return new Response(stream as any, {
    headers: {
      'content-type': found.mime,
      'content-length': String(size),
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}

export function removeMedia(id: number, filename: string): void {
  const found = resolveMedia(filename);
  if (found) {
    try {
      unlinkSync(found.path);
    } catch {
      /* ignore */
    }
  }
  repoDeleteMedia(id);
}

function safeName(name: string): string {
  return basename(String(name ?? '')).slice(0, 120);
}
