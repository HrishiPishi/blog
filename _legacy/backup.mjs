#!/usr/bin/env node
// Snapshot the database + media into data/backups/<timestamp>/.
import { cpSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const dbPath = process.env.BLOG_DB_PATH ?? resolve(root, 'data/blog.db');
const mediaDir = process.env.BLOG_MEDIA_DIR ?? resolve(root, 'data/media');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const dest = resolve(root, 'data/backups', stamp);

mkdirSync(dest, { recursive: true });
if (existsSync(dbPath)) cpSync(dbPath, resolve(dest, 'blog.db'));
if (existsSync(mediaDir)) cpSync(mediaDir, resolve(dest, 'media'), { recursive: true });

console.log(`✓ backup written to ${dest}`);
