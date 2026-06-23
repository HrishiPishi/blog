// Rehype plugin: auto-brutalize post images. Plain Markdown stays plain — this
// runs at build time on the rendered HTML (hast) and:
//
//   * turns a run of >= 2 images into a numbered "contact sheet" (.image-grid),
//     reusing the latent grid styles already in global.css;
//   * wraps a lone image in a framed <figure class="img fig-brutal"> with
//     registration-mark chrome + a mono .fig-meta caption.
//
// Consecutive `![..](..)` lines with no blank line between them collapse into a
// single <p> holding several <img> (CommonMark), so we extract images from a
// paragraph rather than assuming one-img-per-paragraph.
//
// Scoped strictly to <p>/<img>; KaTeX (.katex / .math) subtrees are skipped so
// math rendering is never touched.

const WHITESPACE = /^\s*$/;

function isElement(node, tag) {
  return node && node.type === 'element' && (!tag || node.tagName === tag);
}

function hasClass(node, cls) {
  const c = node.properties && node.properties.className;
  if (!c) return false;
  return Array.isArray(c) ? c.includes(cls) : String(c).split(/\s+/).includes(cls);
}

// Returns the <img> elements of an image-only paragraph (text children must be
// whitespace; soft/hard line breaks allowed), or null if the paragraph holds
// anything else.
function paragraphImages(node) {
  if (!isElement(node, 'p')) return null;
  const imgs = [];
  for (const child of node.children) {
    if (child.type === 'text') {
      if (!WHITESPACE.test(child.value)) return null;
    } else if (isElement(child, 'img')) {
      imgs.push(child);
    } else if (isElement(child, 'br')) {
      // line break between images — ignore
    } else {
      return null;
    }
  }
  return imgs.length ? imgs : null;
}

function fileName(src) {
  if (!src) return 'untitled';
  const base = String(src).split('/').pop() || String(src);
  return base.replace(/\.[a-z0-9]+$/i, '');
}

const t = (value) => ({ type: 'text', value });
const el = (tagName, properties, children = []) => ({ type: 'element', tagName, properties, children });
const regMark = (pos) => el('span', { className: ['reg-mark', `reg-${pos}`], 'aria-hidden': 'true' });

function withDuo(img) {
  img.properties = img.properties || {};
  const cls = img.properties.className || [];
  const list = Array.isArray(cls) ? cls.slice() : String(cls).split(/\s+/).filter(Boolean);
  if (!list.includes('img-duo')) list.push('img-duo');
  img.properties.className = list;
  img.properties.loading = img.properties.loading || 'lazy';
  return img;
}

function figMeta(img) {
  const name = fileName(img.properties && img.properties.src);
  const alt = (img.properties && img.properties.alt) || '';
  return el('figcaption', { className: ['fig-meta'] }, [t(alt ? `${name} · ${alt}` : name)]);
}

function brutalFigure(img) {
  return el('figure', { className: ['img', 'fig-brutal'] }, [
    el('div', { className: ['img-frame'] }, [
      regMark('tl'), regMark('tr'), regMark('bl'), regMark('br'),
      withDuo(img),
    ]),
    figMeta(img),
  ]);
}

function contactSheet(imgs) {
  const cols = Math.min(imgs.length, 4);
  const cells = imgs.map((img, i) => {
    const idx = String(i + 1).padStart(2, '0');
    const name = fileName(img.properties && img.properties.src);
    return el('figure', { className: ['grid-cell'] }, [
      el('span', { className: ['grid-index'] }, [t(`(${idx})`)]),
      el('div', { className: ['img-frame'] }, [
        regMark('tl'), regMark('br'),
        withDuo(img),
        el('span', { className: ['scan-id'] }, [t(name)]),
      ]),
    ]);
  });
  return el('div', { className: ['image-grid'], dataCols: String(cols) }, [
    el('div', { className: ['grid-title'] }, [t(`contact sheet — ${imgs.length} plates`)]),
    el('div', { className: ['grid-cells'] }, cells),
  ]);
}

function processChildren(children) {
  const out = [];
  let i = 0;
  while (i < children.length) {
    const node = children[i];
    const imgs = paragraphImages(node);
    if (imgs) {
      // Merge with any following image-only paragraphs (whitespace between is ok).
      const run = imgs.slice();
      let j = i + 1;
      while (j < children.length) {
        const next = children[j];
        if (next.type === 'text' && WHITESPACE.test(next.value)) { j++; continue; }
        const more = paragraphImages(next);
        if (!more) break;
        run.push(...more);
        j++;
      }
      out.push(run.length >= 2 ? contactSheet(run) : brutalFigure(run[0]));
      i = j;
      continue;
    }
    if (node.type === 'element' && Array.isArray(node.children) && !hasClass(node, 'katex') && !hasClass(node, 'math')) {
      node.children = processChildren(node.children);
    }
    out.push(node);
    i++;
  }
  return out;
}

export default function rehypeBrutal() {
  return (tree) => {
    if (tree && Array.isArray(tree.children)) {
      tree.children = processChildren(tree.children);
    }
  };
}
