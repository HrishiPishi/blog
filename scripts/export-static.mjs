import { existsSync, mkdirSync, rmSync, readdirSync, cpSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = process.cwd();
const OUT = resolve(ROOT, 'dist-site');
const PORT = 4545;
const BASE = `http://127.0.0.1:${PORT}`;

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const server = spawn(process.execPath, ['scripts/local-server.mjs'], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'pipe'],
});

try {
  await waitForServer();

  const slugs = readdirSync(resolve(ROOT, 'src/content/posts'))
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace(/\.md$/, ''));

  const pages = ['/', '/about', ...slugs.map((slug) => `/posts/${slug}`)];
  for (const route of pages) {
    await writeRoute(route);
  }

  await writeAsset('/assets/style.css');
  await writeAsset('/assets/site.js');
  if (existsSync(resolve(ROOT, 'public'))) {
    cpSync(resolve(ROOT, 'public'), OUT, {
      recursive: true,
      filter: (source) => !source.endsWith('.DS_Store'),
    });
  }
  cpSync(resolve(ROOT, 'node_modules/katex/dist/fonts'), resolve(OUT, 'assets/katex-fonts'), { recursive: true });

  console.log(`exported ${pages.length} pages to dist-site/`);
} finally {
  server.kill('SIGTERM');
}

async function waitForServer() {
  const timeoutAt = Date.now() + 10000;
  while (Date.now() < timeoutAt) {
    try {
      const res = await fetch(BASE);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('local export server did not start');
}

async function writeRoute(route) {
  const res = await fetch(BASE + route);
  if (!res.ok) throw new Error(`${route} -> ${res.status}`);
  const file = route === '/' ? resolve(OUT, 'index.html') : resolve(OUT, route.slice(1), 'index.html');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, await res.text(), 'utf8');
}

async function writeAsset(route) {
  const res = await fetch(BASE + route);
  if (!res.ok) throw new Error(`${route} -> ${res.status}`);
  const file = resolve(OUT, route.slice(1));
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, await res.text(), 'utf8');
}
