import katex from 'katex';
import { createLowlight, common } from 'lowlight';
import { toHtml } from 'hast-util-to-html';
import { plotToSvg } from './plot';

const lowlight = createLowlight(common);

// Shared "printer's proof" chrome (calibration bar + registration crosshairs)
// echoing the reference posters. Purely decorative.
const CALIB_BAR =
  '<div class="calib-bar" aria-hidden="true"><span class="calib-grey"></span><span class="calib-cmyk"></span></div>';
const REG_MARKS =
  '<span class="reg-mark reg-tl"></span><span class="reg-mark reg-tr"></span><span class="reg-mark reg-bl"></span><span class="reg-mark reg-br"></span>';

function scanId(src: string): string {
  const base = (src.split('/').pop() ?? '').split('.')[0];
  return (base.slice(0, 6) || 'image').toUpperCase();
}

// ---- escaping (the backbone of XSS safety) --------------------------------
function esc(s: string): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]!));
}

// Only allow safe, local-or-web URLs. Blocks javascript:, data: (except images), etc.
function safeUrl(url: string, allowData = false): string {
  const u = String(url ?? '').trim();
  if (u.startsWith('/')) return u; // local (uploads)
  if (/^https?:\/\//i.test(u)) return u;
  if (/^mailto:/i.test(u)) return u;
  if (allowData && /^data:image\//i.test(u)) return u;
  return '#';
}

// ---- types (subset of TipTap JSON we accept) ------------------------------
interface Node {
  type?: string;
  text?: string;
  attrs?: Record<string, any>;
  content?: Node[];
  marks?: { type: string; attrs?: Record<string, any> }[];
}

interface RenderResult {
  html: string;
  text: string;
}

export function renderDocument(json: unknown): RenderResult {
  let doc: Node;
  try {
    doc = typeof json === 'string' ? JSON.parse(json) : (json as Node);
  } catch {
    return { html: '', text: '' };
  }
  if (!doc || typeof doc !== 'object') return { html: '', text: '' };
  const parts: string[] = [];
  const text: string[] = [];
  for (const node of doc.content ?? []) parts.push(renderNode(node, text));
  return { html: parts.join('\n'), text: text.join(' ').replace(/\s+/g, ' ').trim() };
}

function renderInline(nodes: Node[] | undefined, text: string[]): string {
  if (!nodes) return '';
  return nodes.map((n) => renderNode(n, text)).join('');
}

function renderNode(node: Node, text: string[]): string {
  switch (node.type) {
    case 'text': {
      let out = esc(node.text ?? '');
      text.push(node.text ?? '');
      for (const mark of node.marks ?? []) {
        switch (mark.type) {
          case 'bold': out = `<strong>${out}</strong>`; break;
          case 'italic': out = `<em>${out}</em>`; break;
          case 'strike': out = `<s>${out}</s>`; break;
          case 'code': out = `<code>${out}</code>`; break;
          case 'link': {
            const href = safeUrl(mark.attrs?.href ?? '#');
            out = `<a href="${esc(href)}" rel="noopener noreferrer nofollow" target="_blank">${out}</a>`;
            break;
          }
        }
      }
      return out;
    }

    case 'paragraph':
      return `<p>${renderInline(node.content, text)}</p>`;

    case 'heading': {
      const level = Math.min(4, Math.max(2, Number(node.attrs?.level) || 2));
      const inner = renderInline(node.content, text);
      const id = slugForHeading(inner);
      return `<h${level} id="${esc(id)}">${inner}</h${level}>`;
    }

    case 'bulletList':
      return `<ul>${(node.content ?? []).map((n) => renderNode(n, text)).join('')}</ul>`;
    case 'orderedList':
      return `<ol>${(node.content ?? []).map((n) => renderNode(n, text)).join('')}</ol>`;
    case 'listItem':
      return `<li>${(node.content ?? []).map((n) => renderNode(n, text)).join('')}</li>`;

    case 'blockquote':
      return `<blockquote>${(node.content ?? []).map((n) => renderNode(n, text)).join('')}</blockquote>`;

    case 'horizontalRule':
      return '<hr/>';

    case 'hardBreak':
      return '<br/>';

    case 'codeBlock': {
      const code = (node.content ?? []).map((c) => c.text ?? '').join('');
      text.push(code);
      const lang = String(node.attrs?.language ?? '').toLowerCase();
      let body: string;
      try {
        const tree = lang && lowlight.registered(lang) ? lowlight.highlight(lang, code) : lowlight.highlightAuto(code);
        body = toHtml(tree);
      } catch {
        body = esc(code);
      }
      const label = lang ? `<span class="code-lang">${esc(lang)}</span>` : '';
      return `<figure class="code"><pre><code class="hljs">${body}</code></pre>${label}</figure>`;
    }

    case 'mathInline': {
      const latex = String(node.attrs?.latex ?? '');
      text.push(latex);
      return renderKatex(latex, false);
    }
    case 'mathBlock': {
      const latex = String(node.attrs?.latex ?? '');
      text.push(latex);
      return `<div class="math-block">${renderKatex(latex, true)}</div>`;
    }

    case 'image': {
      const src = safeUrl(node.attrs?.src ?? '', true);
      const alt = esc(node.attrs?.alt ?? '');
      const caption = node.attrs?.caption ? esc(node.attrs.caption) : 'Untitled';
      return `<figure class="img">
        ${CALIB_BAR}
        <div class="img-frame">
          ${REG_MARKS}
          <img src="${esc(src)}" alt="${alt}" loading="lazy" decoding="async"/>
          <span class="scan-id">${scanId(src)}</span>
        </div>
        <figcaption>${caption}</figcaption>
      </figure>`;
    }

    case 'imageGrid': {
      const items: any[] = Array.isArray(node.attrs?.items) ? node.attrs!.items : [];
      const cols = Math.min(4, Math.max(1, Number(node.attrs?.columns) || 2));
      const title = node.attrs?.title ? esc(node.attrs.title) : '';
      const cells = items
        .map((it, i) => {
          const src = safeUrl(it?.src ?? '', true);
          const alt = esc(it?.alt ?? '');
          const caption = it?.caption ? esc(it.caption) : 'Untitled';
          const idx = String(i + 1);
          return `<figure class="grid-cell">
            <span class="grid-index">(${idx})</span>
            <div class="calib-bar calib-bar-sm" aria-hidden="true"><span class="calib-grey"></span><span class="calib-cmyk"></span></div>
            <div class="img-frame">
              <span class="reg-mark reg-tl"></span><span class="reg-mark reg-br"></span>
              <img src="${esc(src)}" alt="${alt}" loading="lazy" decoding="async"/>
              <span class="scan-id">${scanId(src)}</span>
            </div>
            <figcaption>${caption}</figcaption>
          </figure>`;
        })
        .join('');
      const head = title ? `<div class="grid-title">${title}</div>` : '';
      return `<div class="image-grid" data-cols="${cols}">${head}<div class="grid-cells">${cells}</div></div>`;
    }

    case 'graph': {
      const svg = plotToSvg({
        expr: String(node.attrs?.expr ?? 'sin(x)'),
        xmin: numOr(node.attrs?.xmin, -10),
        xmax: numOr(node.attrs?.xmax, 10),
        ymin: node.attrs?.ymin === undefined || node.attrs?.ymin === null ? undefined : Number(node.attrs.ymin),
        ymax: node.attrs?.ymax === undefined || node.attrs?.ymax === null ? undefined : Number(node.attrs.ymax),
      });
      const caption = node.attrs?.caption ? esc(node.attrs.caption) : '';
      const expr = esc(String(node.attrs?.expr ?? ''));
      const cap = caption || `y = ${expr}`;
      return `<figure class="graph">${svg}<figcaption><span class="grid-index">fig.</span> ${cap}</figcaption></figure>`;
    }

    case 'callout': {
      const kind = ['note', 'warning', 'idea'].includes(node.attrs?.kind) ? node.attrs.kind : 'note';
      return `<aside class="callout callout-${esc(kind)}">${(node.content ?? []).map((n) => renderNode(n, text)).join('')}</aside>`;
    }

    default:
      // Unknown node: render its children if any, else nothing.
      return node.content ? node.content.map((n) => renderNode(n, text)).join('') : '';
  }
}

function renderKatex(latex: string, display: boolean): string {
  try {
    return katex.renderToString(latex, {
      displayMode: display,
      throwOnError: false,
      strict: false,
      trust: false, // never allow \href / \htmlClass injection
      output: 'htmlAndMathml',
    });
  } catch {
    return `<code class="math-error">${esc(latex)}</code>`;
  }
}

function numOr(v: unknown, d: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function slugForHeading(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
