import http from 'node:http';
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, cpSync, rmSync } from 'node:fs';
import { resolve, basename, extname, join } from 'node:path';
import katex from 'katex';

const ROOT = process.cwd();
const PORT = Number(process.env.PORT || 4321);
const CONTENT_DIR = resolve(ROOT, 'src/content');
const POSTS_DIR = resolve(CONTENT_DIR, 'posts');
const SITE_JSON = resolve(CONTENT_DIR, 'site.json');
const BACKUP_ROOT = resolve(ROOT, 'backups');
const PUBLIC_DIR = resolve(ROOT, 'public');

loadDotEnv();

const defaults = {
  title: 'thoughts',
  tagline: 'working notebook',
  author: 'hrishi',
  instagram: 'hrishi.meh',
  spotify: '',
  about: 'working notebook',
};

function loadDotEnv() {
  const file = resolve(ROOT, '.env');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const [, key, raw] = m;
    if (process.env[key]) continue;
    process.env[key] = raw.replace(/^["']|["']$/g, '');
  }
}

function setDotEnvValue(key, value) {
  const file = resolve(ROOT, '.env');
  const lines = existsSync(file) ? readFileSync(file, 'utf8').split(/\r?\n/) : [];
  const safe = `${key}=${String(value).replace(/\n/g, '')}`;
  let found = false;
  const next = lines.map((line) => {
    if (line.match(new RegExp(`^\\s*${key}\\s*=`))) {
      found = true;
      return safe;
    }
    return line;
  });
  if (!found) next.push(safe);
  writeFileSync(file, next.filter((line, i, arr) => line || i < arr.length - 1).join('\n') + '\n', 'utf8');
  process.env[key] = String(value);
}

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function site() {
  try {
    return { ...defaults, ...JSON.parse(readFileSync(SITE_JSON, 'utf8')) };
  } catch {
    return defaults;
  }
}

function safeSlug(slug) {
  const s = String(slug || '').trim();
  return s && s === basename(s) && /^[a-z0-9][a-z0-9-]*$/i.test(s) ? s : null;
}

function toArray(v) {
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof v === 'string') return v.split(',').map((s) => s.trim()).filter(Boolean);
  return [];
}

function toDate(v) {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v || '');
  return s.match(/^\d{4}-\d{2}-\d{2}/)?.[0] || new Date().toISOString().slice(0, 10);
}

function parseFrontmatter(raw) {
  if (!raw.startsWith('---\n')) return { data: {}, body: raw };
  const end = raw.indexOf('\n---', 4);
  if (end === -1) return { data: {}, body: raw };
  const yaml = raw.slice(4, end).trim();
  const body = raw.slice(raw.indexOf('\n', end + 4) + 1);
  const data = {};
  let pendingList = null;
  for (const line of yaml.split(/\r?\n/)) {
    const item = line.match(/^\s*-\s*(.*)$/);
    if (item && pendingList) {
      data[pendingList].push(parseYamlValue(item[1]));
      continue;
    }
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) continue;
    const [, key, value] = m;
    if (!value.trim()) {
      data[key] = [];
      pendingList = key;
    } else {
      data[key] = parseYamlValue(value);
      pendingList = null;
    }
  }
  return { data, body };
}

function parseYamlValue(value) {
  const v = value.trim();
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v.startsWith('[') && v.endsWith(']')) {
    const inner = v.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map((x) => unquote(x.trim())).filter(Boolean);
  }
  return unquote(v);
}

function unquote(v) {
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}

function stringifyFrontmatter(data, body) {
  const lines = ['---'];
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) lines.push(`${key}: [${value.map((v) => JSON.stringify(String(v))).join(', ')}]`);
    else if (typeof value === 'boolean') lines.push(`${key}: ${value ? 'true' : 'false'}`);
    else lines.push(`${key}: ${JSON.stringify(String(value))}`);
  }
  lines.push('---', '', body, '');
  return lines.join('\n');
}

function readPost(slug) {
  const s = safeSlug(slug);
  if (!s) return null;
  const file = resolve(POSTS_DIR, `${s}.md`);
  if (!existsSync(file)) return null;
  const parsed = parseFrontmatter(readFileSync(file, 'utf8'));
  const d = parsed.data;
  return {
    slug: s,
    front: {
      title: String(d.title || 'untitled'),
      date: toDate(d.date),
      category: toArray(d.category),
      tags: toArray(d.tags),
      thumbnail: d.thumbnail ? String(d.thumbnail) : '',
      layoutType: ['math', 'text', 'gallery', 'list'].includes(d.layoutType) ? d.layoutType : 'text',
      draft: Boolean(d.draft),
    },
    body: parsed.body.replace(/^\n+/, ''),
  };
}

function listPosts({ includeDrafts = false } = {}) {
  if (!existsSync(POSTS_DIR)) return [];
  return readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => readPost(f.replace(/\.md$/, '')))
    .filter(Boolean)
    .filter((p) => includeDrafts || !p.front.draft)
    .sort((a, b) => b.front.date.localeCompare(a.front.date));
}

function backupContent() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const name = `backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
  mkdirSync(BACKUP_ROOT, { recursive: true });
  cpSync(CONTENT_DIR, resolve(BACKUP_ROOT, name), { recursive: true });
  return name;
}

function writePost({ slug, originalSlug, front, body }) {
  const s = safeSlug(slug);
  if (!s) throw new Error('invalid slug');
  mkdirSync(POSTS_DIR, { recursive: true });
  const data = {
    title: front.title || 'untitled',
    date: front.date || new Date().toISOString().slice(0, 10),
    category: toArray(front.category),
    tags: toArray(front.tags),
    layoutType: ['math', 'text', 'gallery', 'list'].includes(front.layoutType) ? front.layoutType : 'text',
  };
  if (front.thumbnail) data.thumbnail = front.thumbnail;
  if (front.draft) data.draft = true;
  writeFileSync(resolve(POSTS_DIR, `${s}.md`), stringifyFrontmatter(data, String(body || '').trim()), 'utf8');
  const old = safeSlug(originalSlug);
  if (old && old !== s && existsSync(resolve(POSTS_DIR, `${old}.md`))) rmSync(resolve(POSTS_DIR, `${old}.md`));
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function stamp(date) {
  return new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${date}T00:00:00Z`))
    .replace(',', '')
    .toLowerCase();
}

function renderMath(src, display) {
  try {
    return katex.renderToString(src, { displayMode: display, throwOnError: false, strict: false });
  } catch {
    return esc(src);
  }
}

function renderMarkdown(md) {
  const blocks = [];
  md = md.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang = '', code) => {
    const i = blocks.push(`<pre class="astro-code" data-language="${esc(lang)}"><code>${esc(code.trimEnd())}</code></pre>`) - 1;
    return `\n@@BLOCK${i}@@\n`;
  });
  md = md.replace(/\$\$([\s\S]*?)\$\$/g, (_, tex) => {
    const i = blocks.push(`<div class="math-block">${renderMath(tex.trim(), true)}</div>`) - 1;
    return `\n@@BLOCK${i}@@\n`;
  });
  const lines = md.split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const ph = line.trim().match(/^@@BLOCK(\d+)@@$/);
    if (ph) {
      out.push(blocks[Number(ph[1])]);
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.+)$/);
    if (h) {
      out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) items.push(`<li>${inline(lines[i++].replace(/^\d+\.\s+/, ''))}</li>`);
      i--;
      out.push(`<ol>${items.join('')}</ol>`);
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) items.push(`<li>${inline(lines[i++].replace(/^[-*]\s+/, ''))}</li>`);
      i--;
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }
    const para = [line];
    while (i + 1 < lines.length && lines[i + 1].trim() && !/^(#{1,4})\s+|^\d+\.\s+|^[-*]\s+|^@@BLOCK\d+@@$/.test(lines[i + 1].trim())) para.push(lines[++i]);
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }
  return out.join('\n');
}

function inline(s) {
  return esc(s)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\$([^$\n]+)\$/g, (_, tex) => renderMath(tex, false))
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function layout(title, body, { wide = false } = {}) {
  const s = site();
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(title ? `${title} — ${s.title}` : s.title)}</title><link rel="stylesheet" href="/assets/style.css"></head>
  <body><div class="shell ${wide ? 'wide' : ''}"><header class="site-head"><a href="/" class="site-title">${esc(s.title)}</a>
  <nav class="label nav"><a href="/">index</a><a href="/about">about</a>${s.instagram ? `<a href="https://instagram.com/${esc(s.instagram)}">ig</a>` : ''}${s.spotify ? `<a href="${esc(s.spotify)}" target="_blank" rel="noopener">spotify</a>` : ''}<a class="accent" href="/admin">edit</a></nav></header>
  <main>${body}</main><footer class="label site-foot"><span>${esc(s.author)} · ${new Date().getFullYear()}</span><span><a href="#" id="archive-toggle">archive</a> · <a class="accent" href="/admin">edit</a></span></footer></div>${cursorMarkup()}<script src="/assets/site.js"></script></body></html>`;
}

function cursorMarkup() {
  return `<div class="cursor-cross" id="cursor-cross" aria-hidden="true">
    <span class="c-line c-top"></span><span class="c-line c-bottom"></span><span class="c-line c-left"></span><span class="c-line c-right"></span>
  </div>`;
}

function home() {
  const s = site();
  const tiles = listPosts().map((p, i, arr) => {
    const idx = String(arr.length - i).padStart(2, '0');
    const cat = p.front.category[0] || 'note';
    const temps = temperatureTags(p);
    if (p.front.thumbnail) {
      return `<a href="/posts/${p.slug}" class="tile tile-image"><div class="tile-frame"><span class="reg-mark reg-tl"></span><span class="reg-mark reg-br"></span><img src="${esc(p.front.thumbnail)}" alt="${esc(p.front.title)}"><span class="scan-id">${esc(cat)}</span></div><div class="tile-meta"><span class="label">(${idx}) ${stamp(p.front.date)}</span><span class="tile-title">${esc(p.front.title)}</span>${tempStrip(temps)}</div></a>`;
    }
    return `<a href="/posts/${p.slug}" class="tile tile-text tile-${esc(p.front.layoutType)}"><div class="label tile-cat">(${idx}) · ${esc(cat)} · ${stamp(p.front.date)}</div><h2 class="tile-title-lg">${esc(p.front.title)}</h2>${tempStrip(temps)}<div class="tile-tags label">${p.front.tags.map((t) => `<span>#${esc(t)}</span>`).join('')}</div></a>`;
  }).join('');
  return layout('', `<section class="home-head"><div class="label home-meta"><span>[ ${esc(s.author)} — index ]</span><span class="tilt-r">@${esc(s.instagram)} <span class="reg-dot"></span></span></div><h1>${esc(s.title)}</h1><p>${esc(s.tagline)}</p></section><div class="regmark"></div><div class="board">${tiles}</div>`, { wide: true });
}

function temperatureTags(post) {
  const text = [
    post.front.layoutType,
    ...post.front.category,
    ...post.front.tags,
    post.front.title,
  ].join(' ').toLowerCase();
  const tags = new Set();
  if (/math|physics|quantum|electro|derivation|latex/.test(text)) tags.add('cold');
  if (/essay|politic|social|convenience|text/.test(text)) tags.add('dry');
  if (/music|chart|album|listening|rotation/.test(text)) tags.add('noisy');
  if (/clothes|lookbook|winter|wool|gallery|fits/.test(text)) tags.add('soft');
  if (/night|late|field|notebook|scratch/.test(text)) tags.add('late');
  if (tags.size === 0) tags.add('neutral');
  return [...tags].slice(0, 3);
}

function tempStrip(tags) {
  return `<div class="temp-strip label">${tags.map((t) => `<span data-temp="${esc(t)}">${esc(t)}</span>`).join('')}</div>`;
}

function postPage(slug) {
  const p = readPost(slug);
  if (!p || p.front.draft) return notFound();
  const hero = p.front.layoutType === 'gallery' && p.front.thumbnail ? `<figure class="img gallery-hero"><div class="calib-bar"><span class="calib-grey"></span><span class="calib-cmyk"></span></div><div class="img-frame"><span class="reg-mark reg-tl"></span><span class="reg-mark reg-tr"></span><span class="reg-mark reg-bl"></span><span class="reg-mark reg-br"></span><img src="${esc(p.front.thumbnail)}" alt="${esc(p.front.title)}"></div></figure>` : '';
  return layout(p.front.title, `<article class="post post-${esc(p.front.layoutType)}"><header class="post-header"><div class="label post-meta"><time>${stamp(p.front.date)}</time>${p.front.category.map((c) => `<span>${esc(c)}</span>`).join('')}${p.front.tags.map((t) => `<span>#${esc(t)}</span>`).join('')}<span class="push">${esc(p.front.layoutType)}</span></div><h1 class="post-title">${esc(p.front.title)}</h1>${tempStrip(temperatureTags(p))}</header>${hero}<div class="prose post-body">${renderMarkdown(p.body)}</div><nav class="label post-nav"><a href="/">← index</a></nav></article>`, { wide: p.front.layoutType === 'gallery' });
}

function admin() {
  const posts = listPosts({ includeDrafts: true }).map((p) => `<li><a href="/admin/edit/${p.slug}" class="dash-post"><span class="dash-post-title">${esc(p.front.title)}</span><span class="label">${esc(p.front.date)} · ${esc(p.front.layoutType)}${p.front.category.length ? ' · ' + esc(p.front.category.join(', ')) : ''}${p.front.draft ? ' · draft' : ''}</span></a><a href="/posts/${p.slug}" class="label">view ↗</a></li>`).join('');
  return layout('edit', `<div class="dash-actions"><a href="/admin/new" class="btn-primary">+ new post</a><a href="/admin/settings" class="btn-ghost">site settings</a><span class="label">${listPosts({ includeDrafts: true }).length} posts</span></div><ol class="dash-list">${posts || '<li class="label dim">no posts yet</li>'}</ol>`, { wide: true });
}

function editor(slug = '') {
  const p = slug ? readPost(slug) : null;
  const front = p?.front || { title: '', date: new Date().toISOString().slice(0, 10), category: [], tags: [], thumbnail: '', layoutType: 'text', draft: false };
  return layout(slug ? 'edit post' : 'new post', `<form class="editor-form" id="post-form">
  ${field('slug', 'slug', slug || 'untitled')}
  ${field('title', 'title', front.title)}
  <div class="field-row">${field('date', 'date', front.date, 'date')}${select('layoutType', front.layoutType)}</div>
  <div class="field-row">${field('category', 'category', front.category.join(', '))}${field('tags', 'tags', front.tags.join(', '))}</div>
  ${field('thumbnail', 'thumbnail', front.thumbnail || '')}
  <label class="field-check"><input type="checkbox" id="draft" ${front.draft ? 'checked' : ''}> <span class="label">draft</span></label>
  <label class="field"><span class="label">markdown body</span><textarea id="body">${esc(p?.body || '')}</textarea></label>
  <div class="editor-bar"><button type="button" class="btn-primary" id="save">save</button>${slug ? '<button type="button" class="btn-ghost btn-danger" id="delete">delete</button>' : ''}<span id="status" class="save-status"></span></div></form>
  <script>${clientEditorScript(slug)}</script>`, { wide: true });
}

function settings() {
  const s = site();
  return layout('settings', `<form class="editor-form" id="settings-form">${field('title', 's-title', s.title)}${field('tagline', 's-tagline', s.tagline)}<div class="field-row">${field('author', 's-author', s.author)}${field('instagram', 's-instagram', s.instagram)}</div>${field('spotify url', 's-spotify', s.spotify || '')}<label class="field"><span class="label">about</span><textarea id="s-about" style="min-height:6rem">${esc(s.about)}</textarea></label><div class="editor-bar"><button type="button" class="btn-primary" id="save-settings">save settings</button><span id="settings-status" class="save-status"></span></div></form><script>${clientSettingsScript()}</script>`, { wide: true });
}

function field(label, id, value, type = 'text') {
  return `<label class="field"><span class="label">${label}</span><input type="${type}" id="${id}" value="${esc(value)}"></label>`;
}

function select(id, value) {
  return `<label class="field"><span class="label">layout type</span><select id="${id}">${['math', 'text', 'gallery', 'list'].map((x) => `<option value="${x}" ${x === value ? 'selected' : ''}>${x}</option>`).join('')}</select></label>`;
}

function clientEditorScript(originalSlug) {
  return `const $=id=>document.getElementById(id),status=$('status');$('save').onclick=async()=>{status.textContent='saving...';const slug=$('slug').value;const body={slug,originalSlug:${JSON.stringify(originalSlug)},front:{title:$('title').value,date:$('date').value,category:$('category').value.split(',').map(s=>s.trim()).filter(Boolean),tags:$('tags').value.split(',').map(s=>s.trim()).filter(Boolean),thumbnail:$('thumbnail').value,layoutType:$('layoutType').value,draft:$('draft').checked},body:$('body').value};const r=await fetch('/api/save',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const j=await r.json();status.textContent=r.ok?'saved (backup '+j.backup+')':j.error;if(r.ok&&!${JSON.stringify(originalSlug)}) location.href='/admin/edit/'+slug};${originalSlug ? "$('delete').onclick=async()=>{if(!confirm('delete post? backup will be made first.'))return;const r=await fetch('/api/delete',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({slug:"+JSON.stringify(originalSlug)+"})});if(r.ok)location.href='/admin';};" : ''}`;
}

function clientSettingsScript() {
  return `const $=id=>document.getElementById(id),status=$('settings-status');$('save-settings').onclick=async()=>{status.textContent='saving...';const r=await fetch('/api/save-settings',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({title:$('s-title').value,tagline:$('s-tagline').value,author:$('s-author').value,instagram:$('s-instagram').value,spotify:$('s-spotify').value,about:$('s-about').value})});const j=await r.json();status.textContent=r.ok?'saved (backup '+j.backup+')':j.error;};`;
}

function about() {
  return layout('about', `<div class="prose">${site().about.split(/\n{2,}/).map((p) => `<p>${esc(p)}</p>`).join('')}</div>`);
}

function notFound() {
  return layout('not found', '<div class="prose"><p>not found</p></div>');
}

function css() {
  let base = readFileSync(resolve(ROOT, 'src/styles/global.css'), 'utf8')
    .replace(/^@import[^;]+;\n/gm, '')
    .replace(/@theme\s*\{([\s\S]*?)\}/, '');
  const katexCss = readFileSync(resolve(ROOT, 'node_modules/katex/dist/katex.min.css'), 'utf8').replace(/url\(fonts\//g, 'url(/assets/katex-fonts/');
  return `${katexCss}\n:root{--font-serif:Georgia,'Times New Roman',serif;--font-mono:ui-monospace,SFMono-Regular,Menlo,monospace;--color-paper:#f7f6f2;--color-ink:#16140f;--color-faint:#6b675e;--color-rule:#d8d4c8;--color-accent:#1d4ed8;--container-measure:40rem}html,body,a,button{cursor:none}button,input,textarea,select{cursor:text}.shell{max-width:var(--container-measure);min-height:100vh;margin:0 auto;padding:2.5rem 1.5rem 5rem;display:flex;flex-direction:column}.shell.wide{max-width:64rem}.site-head,.site-foot{display:flex;align-items:baseline;justify-content:space-between;border-bottom:1px solid var(--color-rule);padding-bottom:1rem;margin-bottom:3rem}.site-foot{border-top:1px solid var(--color-rule);border-bottom:0;margin:6rem 0 0;padding:1rem 0 0}.site-title{font-family:var(--font-serif);font-size:1.125rem;text-decoration:none}.nav{display:flex;gap:1.25rem}.accent{color:var(--color-accent)}.home-head{margin-bottom:2rem}.home-head h1{font-size:3rem;line-height:1.04}.home-meta,.post-meta{display:flex;align-items:center;justify-content:space-between;gap:.75rem;flex-wrap:wrap}.post-meta .push{margin-left:auto}.post-nav{border-top:1px solid var(--color-rule);padding-top:1rem;margin-top:4rem}.reg-dot{display:inline-block;width:.7em;height:.7em;border:1px solid currentColor;border-radius:999px}.ml-1{margin-left:.25rem}.text-\\(--color-ink\\){color:var(--color-ink)}html.ambient-night{--color-paper:#f1f2ef;--color-ink:#111412;--color-faint:#5c625d;--color-rule:#c9cec8}html.ambient-late{--color-paper:#f3f4f0;--color-ink:#101316;--color-faint:#565d63;--color-rule:#c7ccd0}html.ambient-dawn{--color-paper:#f8f5ef;--color-ink:#17130f;--color-faint:#6f6559;--color-rule:#ddd5c8}.temp-strip{display:flex;flex-wrap:wrap;gap:.35rem;margin-top:.55rem}.temp-strip span{border:1px solid var(--color-rule);padding:.08rem .38rem;background:color-mix(in srgb,var(--color-paper) 78%,#fff)}[data-temp=cold]{color:#315a72}[data-temp=dry]{color:#6b675e}[data-temp=noisy]{color:#8a2f1d}[data-temp=soft]{color:#6d6155}[data-temp=late]{color:#1d4ed8}.archive-mode .board{display:block}.archive-mode .tile{border:0!important;border-bottom:1px solid var(--color-rule)!important;min-height:auto!important;padding:.55rem 0!important;background:transparent!important;transform:none!important}.archive-mode .tile-frame,.archive-mode .tile-tags,.archive-mode .temp-strip{display:none!important}.archive-mode .tile-meta{margin:0}.archive-mode .tile-title,.archive-mode .tile-title-lg{font-family:var(--font-mono);font-size:.82rem;line-height:1.4;margin:0}.cursor-ghost{position:fixed;width:20px;height:20px;z-index:9998;pointer-events:none;transform:translate(-50%,-50%);opacity:.28;color:var(--color-ink);animation:ghost-fade .45s ease-out forwards}.cursor-ghost:before,.cursor-ghost:after{content:"";position:absolute;background:currentColor}.cursor-ghost:before{left:9px;top:0;width:1px;height:20px}.cursor-ghost:after{left:0;top:9px;width:20px;height:1px}@keyframes ghost-fade{to{opacity:0;transform:translate(-50%,-50%) scale(.45)}}.cursor-cross{position:fixed;left:0;top:0;width:24px;height:24px;z-index:9999;pointer-events:none;transform:translate(-50%,-50%);mix-blend-mode:multiply;color:var(--color-ink)}.c-line{position:absolute;background:currentColor;transition:opacity .12s ease,background .08s ease}.c-top,.c-bottom{left:11px;width:1px;height:9px}.c-top{top:0}.c-bottom{bottom:0}.c-left,.c-right{top:11px;height:1px;width:9px}.c-left{left:0}.c-right{right:0}.cursor-cross.is-down{color:#b11226}.cursor-cross.scroll-down .c-top{opacity:0}.cursor-cross.scroll-up .c-bottom{opacity:0}@media(pointer:coarse){html,body,a,button{cursor:auto}.cursor-cross{display:none}}\n${base}`;
}

function siteJs() {
  return `(() => {
  const root = document.documentElement;
  const cursor = document.getElementById('cursor-cross');
  const archiveToggle = document.getElementById('archive-toggle');
  let lastY = scrollY;
  let scrollTimer;
  let audio;
  let lastGhost = 0;
  let lastScrollSound = 0;
  let lastTypeSound = 0;
  let lastSelectSound = 0;
  let lastDragSound = 0;

  const hour = new Date().getHours();
  root.classList.add(hour < 5 ? 'ambient-late' : hour < 8 ? 'ambient-dawn' : hour > 20 ? 'ambient-night' : 'ambient-day');

  const applyArchive = (on) => {
    document.body.classList.toggle('archive-mode', on);
    localStorage.setItem('archive-mode', on ? '1' : '0');
  };
  applyArchive(localStorage.getItem('archive-mode') === '1');
  archiveToggle?.addEventListener('click', (e) => { e.preventDefault(); applyArchive(!document.body.classList.contains('archive-mode')); play('archive'); });
  addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() !== 'a') return;
    if (['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName || '')) return;
    applyArchive(!document.body.classList.contains('archive-mode'));
    play('archive');
  });

  const move = (e) => {
    if (cursor) { cursor.style.left = e.clientX + 'px'; cursor.style.top = e.clientY + 'px'; }
    const now = performance.now();
    if (now - lastGhost > 42) { lastGhost = now; ghost(e.clientX, e.clientY); }
  };

  function ensureAudio() { audio ||= new (window.AudioContext || window.webkitAudioContext)(); return audio; }
  function play(kind = 'default') {
    try {
      const ctx = ensureAudio();
      const palette = {
        default: [760, 0.038, 0.045],
        link: [980, 0.032, 0.035],
        button: [520, 0.045, 0.055],
        save: [660, 0.06, 0.05],
        archive: [310, 0.07, 0.04],
        delete: [180, 0.075, 0.05],
        scroll: [240, 0.018, 0.032],
        type: [1180, 0.018, 0.018],
        select: [430, 0.05, 0.026],
        drag: [150, 0.024, 0.018],
      };
      const [freq, dur, gainMax] = palette[kind] || palette.default;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = kind === 'delete' || kind === 'drag' ? 'sawtooth' : kind === 'scroll' ? 'triangle' : 'square';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(gainMax, ctx.currentTime + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + dur + 0.01);
    } catch {}
  }

  function soundKind(target) {
    if (target.closest('.btn-danger')) return 'delete';
    if (target.closest('#save,#save-settings')) return 'save';
    if (target.closest('button,.btn-primary,.btn-ghost')) return 'button';
    if (target.closest('a')) return 'link';
    return 'default';
  }

  function ghost(x, y) {
    if (matchMedia('(pointer: coarse)').matches) return;
    const el = document.createElement('span');
    el.className = 'cursor-ghost';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 520);
  }

  addEventListener('pointermove', move, { passive: true });
  addEventListener('pointerdown', (e) => { cursor?.classList.add('is-down'); play(soundKind(e.target)); });
  addEventListener('pointerup', () => cursor?.classList.remove('is-down'));
  addEventListener('keydown', (e) => {
    if (!['INPUT','TEXTAREA'].includes(e.target?.tagName || '') && !e.target?.isContentEditable) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const now = performance.now();
    if (now - lastTypeSound > 34) { lastTypeSound = now; play('type'); }
  }, { passive: true });
  addEventListener('selectionchange', () => {
    const selected = String(getSelection?.() || '').trim();
    if (!selected) return;
    const now = performance.now();
    if (now - lastSelectSound > 260) { lastSelectSound = now; play('select'); }
  });
  addEventListener('dragover', () => {
    const now = performance.now();
    if (now - lastDragSound > 180) { lastDragSound = now; play('drag'); }
  }, { passive: true });
  addEventListener('scroll', () => {
    const y = scrollY;
    cursor?.classList.toggle('scroll-down', y > lastY);
    cursor?.classList.toggle('scroll-up', y < lastY);
    lastY = y;
    const now = performance.now();
    if (now - lastScrollSound > 95) { lastScrollSound = now; play('scroll'); }
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      cursor?.classList.remove('scroll-down', 'scroll-up');
    }, 140);
  }, { passive: true });
})();`;
}

async function readJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function send(res, status, body, type = 'text/html; charset=utf-8') {
  res.writeHead(status, { 'content-type': type });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname === '/') return send(res, 200, home());
    if (url.pathname === '/about') return send(res, 200, about());
    if (url.pathname === '/admin') return send(res, 200, admin());
    if (url.pathname === '/admin/settings') return send(res, 200, settings());
    if (url.pathname === '/admin/new') return send(res, 200, editor());
    if (url.pathname.startsWith('/admin/edit/')) return send(res, 200, editor(decodeURIComponent(url.pathname.split('/').pop())));
    if (url.pathname.startsWith('/posts/')) return send(res, 200, postPage(decodeURIComponent(url.pathname.split('/').pop())));
    if (url.pathname === '/assets/style.css') return send(res, 200, css(), 'text/css; charset=utf-8');
    if (url.pathname === '/assets/site.js') return send(res, 200, siteJs(), 'text/javascript; charset=utf-8');
    if (url.pathname.startsWith('/assets/katex-fonts/')) return serveFile(res, resolve(ROOT, 'node_modules/katex/dist/fonts', basename(url.pathname)));
    if (url.pathname.startsWith('/thumbnails/')) return serveFile(res, resolve(PUBLIC_DIR, url.pathname.slice(1)));
    if (url.pathname === '/api/save' && req.method === 'POST') {
      const body = await readJson(req);
      const backup = backupContent();
      writePost(body);
      return send(res, 200, JSON.stringify({ ok: true, slug: body.slug, backup }), mime['.json']);
    }
    if (url.pathname === '/api/delete' && req.method === 'POST') {
      const body = await readJson(req);
      const backup = backupContent();
      const s = safeSlug(body.slug);
      if (s && existsSync(resolve(POSTS_DIR, `${s}.md`))) rmSync(resolve(POSTS_DIR, `${s}.md`));
      return send(res, 200, JSON.stringify({ ok: true, backup }), mime['.json']);
    }
    if (url.pathname === '/api/save-settings' && req.method === 'POST') {
      const body = await readJson(req);
      const backup = backupContent();
      writeFileSync(SITE_JSON, JSON.stringify({
        ...defaults,
        ...body,
        instagram: String(body.instagram || '').replace(/^@/, ''),
        spotify: String(body.spotify || ''),
      }, null, 2) + '\n');
      return send(res, 200, JSON.stringify({ ok: true, backup }), mime['.json']);
    }
    return send(res, 404, notFound());
  } catch (e) {
    return send(res, 500, JSON.stringify({ error: e.message }), mime['.json']);
  }
});

function serveFile(res, file) {
  if (!existsSync(file)) return send(res, 404, 'not found', 'text/plain');
  send(res, 200, readFileSync(file), mime[extname(file)] || 'application/octet-stream');
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`local blog server ready: http://localhost:${PORT}/`);
});
