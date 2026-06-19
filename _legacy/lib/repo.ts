import { db } from './db';
import type { Post, PostRow, Version, Media, Settings } from './types';

// ---- helpers --------------------------------------------------------------
export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize('NFKD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'untitled'
  );
}

export function readingTime(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function hydrate(row: PostRow | undefined): Post | null {
  if (!row) return null;
  let tags: string[] = [];
  try {
    tags = JSON.parse(row.tags);
  } catch {
    tags = [];
  }
  return { ...row, tags };
}

// ---- posts ----------------------------------------------------------------
export function listPosts(opts: { status?: 'draft' | 'published'; limit?: number } = {}): Post[] {
  const d = db();
  let sql = 'SELECT * FROM posts';
  const params: unknown[] = [];
  if (opts.status) {
    sql += ' WHERE status = ?';
    params.push(opts.status);
  }
  sql += " ORDER BY COALESCE(published_at, updated_at) DESC";
  if (opts.limit) {
    sql += ' LIMIT ?';
    params.push(opts.limit);
  }
  const rows = d.prepare(sql).all(...(params as never[])) as unknown as PostRow[];
  return rows.map((r) => hydrate(r)!) as Post[];
}

export function getPostBySlug(slug: string): Post | null {
  const row = db().prepare('SELECT * FROM posts WHERE slug = ?').get(slug) as PostRow | undefined;
  return hydrate(row);
}

export function getPostById(id: number): Post | null {
  const row = db().prepare('SELECT * FROM posts WHERE id = ?').get(id) as PostRow | undefined;
  return hydrate(row);
}

export function uniqueSlug(base: string, ignoreId?: number): string {
  const d = db();
  let slug = slugify(base);
  let n = 1;
  // Append -2, -3, ... on collision.
  while (true) {
    const row = d.prepare('SELECT id FROM posts WHERE slug = ?').get(slug) as { id: number } | undefined;
    if (!row || row.id === ignoreId) return slug;
    n += 1;
    slug = `${slugify(base)}-${n}`;
  }
}

export function createPost(): Post {
  const d = db();
  const slug = uniqueSlug('untitled-' + Date.now().toString(36));
  const info = d
    .prepare('INSERT INTO posts (slug, title) VALUES (?, ?)')
    .run(slug, 'Untitled');
  return getPostById(Number(info.lastInsertRowid))!;
}

export interface PostInput {
  title: string;
  abstract: string;
  tags: string[];
  cover_image: string | null;
  content_json: string;
  content_html: string;
  plain_text: string;
}

export function updatePost(id: number, input: PostInput): Post {
  const d = db();
  d.prepare(
    `UPDATE posts SET title=?, abstract=?, tags=?, cover_image=?, content_json=?, content_html=?,
       reading_time=?, updated_at=datetime('now') WHERE id=?`
  ).run(
    input.title,
    input.abstract,
    JSON.stringify(input.tags),
    input.cover_image,
    input.content_json,
    input.content_html,
    readingTime(input.plain_text),
    id
  );
  return getPostById(id)!;
}

export function setPostStatus(id: number, status: 'draft' | 'published', slug?: string): Post {
  const d = db();
  if (status === 'published') {
    d.prepare(
      `UPDATE posts SET status='published', slug=COALESCE(?, slug),
         published_at=COALESCE(published_at, datetime('now')), updated_at=datetime('now') WHERE id=?`
    ).run(slug ?? null, id);
  } else {
    d.prepare("UPDATE posts SET status='draft', updated_at=datetime('now') WHERE id=?").run(id);
  }
  return getPostById(id)!;
}

export function deletePost(id: number): void {
  db().prepare('DELETE FROM posts WHERE id = ?').run(id);
}

// ---- versions -------------------------------------------------------------
const MAX_VERSIONS = 50;

export function snapshot(postId: number, label = 'autosave'): void {
  const d = db();
  const p = getPostById(postId);
  if (!p) return;
  d.prepare(
    `INSERT INTO post_versions (post_id, title, abstract, tags, content_json, content_html, label)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(postId, p.title, p.abstract, JSON.stringify(p.tags), p.content_json, p.content_html, label);
  // Trim history to the most recent MAX_VERSIONS per post.
  d.prepare(
    `DELETE FROM post_versions WHERE post_id = ? AND id NOT IN
       (SELECT id FROM post_versions WHERE post_id = ? ORDER BY id DESC LIMIT ?)`
  ).run(postId, postId, MAX_VERSIONS);
}

export function listVersions(postId: number): Version[] {
  return db()
    .prepare('SELECT * FROM post_versions WHERE post_id = ? ORDER BY id DESC')
    .all(postId) as unknown as Version[];
}

export function getVersion(versionId: number): Version | null {
  return (
    (db().prepare('SELECT * FROM post_versions WHERE id = ?').get(versionId) as Version | undefined) ??
    null
  );
}

// ---- media ----------------------------------------------------------------
export function addMedia(m: Omit<Media, 'id' | 'created_at'>): Media {
  const d = db();
  const info = d
    .prepare(
      `INSERT INTO media (filename, original_name, mime, width, height, size, alt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(m.filename, m.original_name, m.mime, m.width, m.height, m.size, m.alt);
  return db().prepare('SELECT * FROM media WHERE id = ?').get(Number(info.lastInsertRowid)) as unknown as Media;
}

export function listMedia(): Media[] {
  return db().prepare('SELECT * FROM media ORDER BY id DESC').all() as unknown as Media[];
}

export function getMedia(filename: string): Media | null {
  return (
    (db().prepare('SELECT * FROM media WHERE filename = ?').get(filename) as Media | undefined) ?? null
  );
}

export function deleteMedia(id: number): void {
  db().prepare('DELETE FROM media WHERE id = ?').run(id);
}

// ---- settings -------------------------------------------------------------
export function getSettings(): Settings {
  const rows = db().prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const out: Settings = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export function setSettings(partial: Settings): void {
  const d = db();
  const stmt = d.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value'
  );
  for (const [k, v] of Object.entries(partial)) stmt.run(k, String(v));
}

// ---- tags -----------------------------------------------------------------
export function allTags(): { tag: string; count: number }[] {
  const posts = listPosts({ status: 'published' });
  const counts = new Map<string, number>();
  for (const p of posts) for (const t of p.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count);
}
