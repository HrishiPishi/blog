import type { APIRoute } from 'astro';
import { listPosts, getSettings } from '../lib/repo';

export const prerender = false;

function esc(s: string): string {
  return String(s ?? '').replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]!));
}

export const GET: APIRoute = (ctx) => {
  const settings = getSettings();
  const site = (ctx.site ?? new URL(ctx.url.origin)).toString().replace(/\/$/, '');
  const posts = listPosts({ status: 'published' }).slice(0, 30);

  const items = posts
    .map((p) => {
      const url = `${site}/posts/${p.slug}`;
      const date = new Date((p.published_at ?? p.updated_at).replace(' ', 'T') + 'Z').toUTCString();
      return `    <item>
      <title>${esc(p.title)}</title>
      <link>${esc(url)}</link>
      <guid isPermaLink="true">${esc(url)}</guid>
      <pubDate>${date}</pubDate>
      <description>${esc(p.abstract)}</description>
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${esc(settings.site_title)}</title>
    <link>${esc(site)}</link>
    <description>${esc(settings.site_tagline)}</description>
${items}
  </channel>
</rss>`;

  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
};
