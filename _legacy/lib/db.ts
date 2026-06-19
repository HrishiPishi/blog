import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// Single file-based SQLite DB. No external service, easy to back up (copy the file).
const DB_PATH = process.env.BLOG_DB_PATH ?? resolve(process.cwd(), 'data/blog.db');

let _db: DatabaseSync | null = null;

export function db(): DatabaseSync {
  if (_db) return _db;
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const database = new DatabaseSync(DB_PATH);
  database.exec('PRAGMA journal_mode = WAL;');
  database.exec('PRAGMA foreign_keys = ON;');
  database.exec('PRAGMA busy_timeout = 5000;');
  migrate(database);
  _db = database;
  return _db;
}

function migrate(d: DatabaseSync) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash  TEXT PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at  TEXT NOT NULL,
      user_agent  TEXT,
      ip          TEXT
    );

    CREATE TABLE IF NOT EXISTS posts (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      slug          TEXT NOT NULL UNIQUE,
      title         TEXT NOT NULL DEFAULT 'Untitled',
      abstract      TEXT NOT NULL DEFAULT '',
      tags          TEXT NOT NULL DEFAULT '[]',
      cover_image   TEXT,
      content_json  TEXT NOT NULL DEFAULT '{}',
      content_html  TEXT NOT NULL DEFAULT '',
      reading_time  INTEGER NOT NULL DEFAULT 1,
      status        TEXT NOT NULL DEFAULT 'draft',
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
      published_at  TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status, published_at DESC);

    CREATE TABLE IF NOT EXISTS post_versions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id       INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      title         TEXT NOT NULL,
      abstract      TEXT NOT NULL,
      tags          TEXT NOT NULL,
      content_json  TEXT NOT NULL,
      content_html  TEXT NOT NULL,
      label         TEXT NOT NULL DEFAULT 'autosave',
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_versions_post ON post_versions(post_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS media (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      filename      TEXT NOT NULL UNIQUE,
      original_name TEXT,
      mime          TEXT NOT NULL,
      width         INTEGER,
      height        INTEGER,
      size          INTEGER NOT NULL,
      alt           TEXT NOT NULL DEFAULT '',
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS login_attempts (
      ip            TEXT PRIMARY KEY,
      count         INTEGER NOT NULL DEFAULT 0,
      first_at      TEXT NOT NULL DEFAULT (datetime('now')),
      locked_until  TEXT
    );
  `);

  // Seed default settings the editor can later override.
  const defaults: Record<string, string> = {
    site_title: 'Hrishi Mehta',
    site_tagline: 'Notes on mathematics & physics.',
    author_name: 'Hrishi Mehta',
    instagram: 'hrishimeh',
    about: 'A working notebook. Mostly math and physics, occasionally finished.',
    footer_note: '',
  };
  const insert = d.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(defaults)) insert.run(k, v);
}
