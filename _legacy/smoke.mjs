const BASE = 'http://127.0.0.1:4321';
let cookies = {};
function cookieHeader() {
  return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
}
function store(res) {
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [pair] = c.split(';');
    const i = pair.indexOf('=');
    const k = pair.slice(0, i);
    const v = pair.slice(i + 1);
    if (v === '' ) delete cookies[k]; else cookies[k] = v;
  }
}
function csrf() { return decodeURIComponent(cookies['hm_csrf'] ?? ''); }

let pass = 0, fail = 0;
function check(name, cond, extra='') { if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, extra); } }

async function J(method, path, body, useCsrf = true) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'content-type': 'application/json',
      cookie: cookieHeader(),
      ...(useCsrf ? { 'x-csrf-token': csrf() } : {}),
      origin: BASE,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  store(res);
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json, text };
}

console.log('\n— public —');
let r = await fetch(BASE + '/'); check('GET / 200', r.status === 200);
r = await fetch(BASE + '/admin'); check('GET /admin redirects to login', r.url.includes('/admin/login') || r.status === 200);

console.log('\n— auth —');
r = await J('POST', '/api/auth/setup', { username: 'hrishi', password: 'supersecret123' });
check('setup creates admin', r.status === 200 && r.json.ok, JSON.stringify(r.json));
check('session cookie set', !!cookies['hm_session']);
check('csrf cookie set', !!cookies['hm_csrf']);

r = await J('POST', '/api/auth/setup', { username: 'x', password: 'yyyyyyyyyy' });
check('second setup blocked (403)', r.status === 403);

console.log('\n— csrf / authz —');
const noCsrf = await fetch(BASE + '/api/posts', { method: 'POST', headers: { cookie: cookieHeader(), origin: BASE } });
check('POST without csrf → 403', noCsrf.status === 403);
const noAuth = await fetch(BASE + '/api/posts', { method: 'POST', headers: { 'x-csrf-token': 'fake', 'content-type': 'application/json' } });
check('POST without session rejected (401/403)', noAuth.status === 401 || noAuth.status === 403);

console.log('\n— posting —');
r = await J('POST', '/api/posts');
const id = r.json.id;
check('create post', r.status === 200 && id > 0);

const doc = { type: 'doc', content: [
  { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'The Gaussian Integral' }] },
  { type: 'paragraph', content: [
    { type: 'text', text: 'We claim ' },
    { type: 'mathInline', attrs: { latex: '\\int_{-\\infty}^{\\infty} e^{-x^2}dx = \\sqrt{\\pi}' } },
    { type: 'text', text: '.' },
  ] },
  { type: 'mathBlock', attrs: { latex: 'I^2 = \\iint_{\\mathbb{R}^2} e^{-(x^2+y^2)}dx\\,dy' } },
  { type: 'codeBlock', attrs: { language: 'python' }, content: [{ type: 'text', text: 'import numpy as np\nprint(np.sqrt(np.pi))' }] },
  { type: 'graph', attrs: { expr: 'exp(-x^2)', xmin: -3, xmax: 3, caption: 'the bell curve' } },
  { type: 'paragraph', content: [{ type: 'text', text: 'XSS attempt: ' }, { type: 'text', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }], text: 'click' }] },
] };

r = await J('PUT', `/api/posts/${id}?snapshot=manual`, { title: 'On the Gaussian Integral', abstract: 'A polar-coordinate derivation.', tags: ['analysis', 'integration'], cover_image: null, doc });
check('save post', r.status === 200 && r.json.ok, JSON.stringify(r.json));
check('reading time computed', r.json.reading_time >= 1);

r = await J('PATCH', `/api/posts/${id}`, { action: 'publish' });
const slug = r.json.slug;
check('publish post', r.status === 200 && !!slug);

console.log('\n— render —');
r = await fetch(BASE + '/posts/' + slug);
const html = await r.text();
check('public post 200', r.status === 200);
check('renders KaTeX', html.includes('katex'));
check('renders block math', html.includes('math-block'));
check('renders graph svg', html.includes('graph-svg'));
check('renders highlighted code', html.includes('hljs'));
check('escapes javascript: link', !html.includes('javascript:alert'), 'XSS link leaked!');
check('post appears on index', (await (await fetch(BASE + '/')).text()).includes('Gaussian'));

console.log('\n— versions —');
r = await J('GET', `/api/posts/${id}/versions`);
check('versions listed', r.status === 200 && r.json.versions.length >= 1);
const vid = r.json.versions[r.json.versions.length - 1].id;
r = await J('PATCH', `/api/posts/${id}`, { action: 'revert', versionId: vid });
check('revert works', r.status === 200 && r.json.ok);

console.log('\n— feeds —');
r = await fetch(BASE + '/rss.xml');
check('rss 200 + xml', r.status === 200 && (await r.text()).includes('<rss'));
r = await fetch(BASE + '/search?q=gaussian');
check('search finds post', (await r.text()).includes('Gaussian'));

console.log('\n— security headers —');
r = await fetch(BASE + '/');
check('CSP header present', !!r.headers.get('content-security-policy'));
check('X-Frame-Options DENY', r.headers.get('x-frame-options') === 'DENY');
check('nosniff', r.headers.get('x-content-type-options') === 'nosniff');

console.log('\n— logout —');
r = await J('POST', '/api/auth/logout');
check('logout ok', r.status === 200);
r = await J('POST', '/api/posts');
check('post blocked after logout (401)', r.status === 401);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
