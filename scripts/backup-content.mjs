#!/usr/bin/env node
// Manual snapshot of src/content/ → backups/backup-<timestamp>/.
// (The /admin Save button does this automatically before every write.)
import { cpSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const src = resolve(root, 'src/content');
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
const dest = resolve(root, 'backups', `backup-${stamp}`);

mkdirSync(resolve(root, 'backups'), { recursive: true });
if (existsSync(src)) cpSync(src, dest, { recursive: true });
console.log(`✓ content backed up → backups/backup-${stamp}`);
