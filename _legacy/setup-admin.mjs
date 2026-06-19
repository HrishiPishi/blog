#!/usr/bin/env node
// Create or reset the admin account from the command line.
// Usage: node scripts/setup-admin.mjs <username> <password>
import { DatabaseSync } from 'node:sqlite';
import { scryptSync, randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const [, , username, password] = process.argv;
if (!username || !password) {
  console.error('Usage: npm run setup -- <username> <password>');
  process.exit(1);
}
if (password.length < 10) {
  console.error('Password must be at least 10 characters.');
  process.exit(1);
}

const DB_PATH = process.env.BLOG_DB_PATH ?? resolve(process.cwd(), 'data/blog.db');
mkdirSync(dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`);

const salt = randomBytes(16);
const derived = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
const hash = `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;

db.prepare(
  `INSERT INTO users (username, password_hash) VALUES (?, ?)
   ON CONFLICT(username) DO UPDATE SET password_hash=excluded.password_hash`
).run(username, hash);

console.log(`✓ admin account ready: ${username}`);
