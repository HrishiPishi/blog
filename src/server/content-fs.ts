// Server-only (Node fs) helpers for the dev edit dashboard. Never import this
// from client code — it's used by prerender:false admin pages + /api routes.
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  existsSync,
  mkdirSync,
  cpSync,
  rmSync,
} from 'node:fs';
import { resolve, basename } from 'node:path';
import matter from 'gray-matter';

const ROOT = process.cwd();
export const CONTENT_DIR = resolve(ROOT, 'src/content');
export const POSTS_DIR = resolve(CONTENT_DIR, 'posts');
export const SITE_JSON = resolve(CONTENT_DIR, 'site.json');
export const BACKUP_ROOT = resolve(ROOT, 'backups');

export interface SiteConfig {
  title: string;
  tagline: string;
  author: string;
  instagram: string;
  spotify: string;
  about: string;
}

const SITE_DEFAULTS: SiteConfig = {
  title: 'thoughts',
  tagline: 'working notebook',
  author: 'hrishi',
  instagram: 'hrishi.meh',
  spotify: '',
  about: 'working notebook',
};

export function readSiteConfig(): SiteConfig {
  try {
    const raw = JSON.parse(readFileSync(SITE_JSON, 'utf8'));
    return { ...SITE_DEFAULTS, ...raw };
  } catch {
    return { ...SITE_DEFAULTS };
  }
}

export function writeSiteConfig(cfg: SiteConfig): void {
  const clean: SiteConfig = {
    title: String(cfg.title ?? '').slice(0, 120) || SITE_DEFAULTS.title,
    tagline: String(cfg.tagline ?? '').slice(0, 200),
    author: String(cfg.author ?? '').slice(0, 120),
    instagram: String(cfg.instagram ?? '').replace(/^@/, '').slice(0, 120),
    spotify: String(cfg.spotify ?? '').slice(0, 500),
    about: String(cfg.about ?? '').slice(0, 2000),
  };
  writeFileSync(SITE_JSON, JSON.stringify(clean, null, 2) + '\n', 'utf8');
}

export interface PostFront {
  title: string;
  date: string; // YYYY-MM-DD
  category: string[];
  tags: string[];
  thumbnail?: string;
  layoutType: 'math' | 'text' | 'gallery' | 'list';
  draft?: boolean;
}

export interface PostFile {
  slug: string;
  front: PostFront;
  body: string;
}

// Slugs are filename-safe; reject anything with path separators or traversal.
export function safeSlug(slug: string): string | null {
  const s = String(slug ?? '').trim();
  if (s !== basename(s)) return null;
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(s)) return null;
  return s;
}

function filePath(slug: string): string {
  return resolve(POSTS_DIR, `${slug}.md`);
}

export function listSlugs(): string[] {
  if (!existsSync(POSTS_DIR)) return [];
  return readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith('.md') || f.endsWith('.mdx'))
    .map((f) => f.replace(/\.mdx?$/, ''));
}

export function readPost(slug: string): PostFile | null {
  const s = safeSlug(slug);
  if (!s) return null;
  const p = filePath(s);
  if (!existsSync(p)) return null;
  const parsed = matter(readFileSync(p, 'utf8'));
  const d = parsed.data ?? {};
  const front: PostFront = {
    title: String(d.title ?? ''),
    date: toDateString(d.date),
    category: toArray(d.category),
    tags: toArray(d.tags),
    thumbnail: d.thumbnail ? String(d.thumbnail) : undefined,
    layoutType: ['math', 'text', 'gallery', 'list'].includes(d.layoutType) ? d.layoutType : 'text',
    draft: Boolean(d.draft),
  };
  return { slug: s, front, body: parsed.content.replace(/^\n+/, '') };
}

export function listPostFiles(): PostFile[] {
  return listSlugs()
    .map((s) => readPost(s))
    .filter((p): p is PostFile => p !== null)
    .sort((a, b) => b.front.date.localeCompare(a.front.date));
}

// Copy the entire src/content tree into a timestamped backup BEFORE any write.
export function backupContent(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(
    now.getHours()
  )}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  const dest = resolve(BACKUP_ROOT, `backup-${stamp}`);
  mkdirSync(BACKUP_ROOT, { recursive: true });
  if (existsSync(CONTENT_DIR)) cpSync(CONTENT_DIR, dest, { recursive: true });
  return `backup-${stamp}`;
}

export function writePost(slug: string, front: PostFront, body: string, originalSlug?: string): void {
  const s = safeSlug(slug);
  if (!s) throw new Error('Invalid slug.');
  mkdirSync(POSTS_DIR, { recursive: true });

  // Build a clean frontmatter object (omit empty optionals).
  const data: Record<string, unknown> = {
    title: front.title || 'Untitled',
    date: front.date || new Date().toISOString().slice(0, 10),
    category: front.category,
    tags: front.tags,
    layoutType: front.layoutType,
  };
  if (front.thumbnail) data.thumbnail = front.thumbnail;
  if (front.draft) data.draft = true;

  const file = matter.stringify(`\n${body.trim()}\n`, data);
  writeFileSync(filePath(s), file, 'utf8');

  // Handle rename: remove the old file if the slug changed.
  if (originalSlug && originalSlug !== s) {
    const old = safeSlug(originalSlug);
    if (old && existsSync(filePath(old))) rmSync(filePath(old));
  }
}

export function deletePost(slug: string): boolean {
  const s = safeSlug(slug);
  if (!s) return false;
  const p = filePath(s);
  if (!existsSync(p)) return false;
  rmSync(p);
  return true;
}

function toArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === 'string' && v.trim()) return v.split(',').map((s) => s.trim()).filter(Boolean);
  return [];
}

function toDateString(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v ?? '');
  const m = s.match(/^\d{4}-\d{2}-\d{2}/);
  if (m) return m[0];
  const d = new Date(s);
  return isNaN(d.valueOf()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
}
