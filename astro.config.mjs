// @ts-check
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeBrutal from './src/lib/rehype-brutal.mjs';

// Static, file-based Markdown blog. The public site prerenders to fast static
// HTML; the local /admin dashboard + /api routes are dev-only (prerender:false,
// guarded by import.meta.env.DEV) and use the node adapter for on-demand runs.
// https://astro.build/config
export default {
  output: 'static',
  // Set this to your real domain before deploying (canonical URLs, RSS, OG).
  site: 'https://hrishimehta.blog',
  // Bind the dev server to all local addresses so it opens on both
  // http://localhost:4321 and http://127.0.0.1:4321 (avoids the IPv6-only bind).
  server: { host: true, port: 4321 },
  markdown: {
    // LaTeX: inline $…$ and block $$…$$ → KaTeX at build time.
    remarkPlugins: [remarkMath],
    // rehypeKatex first (math → spans), then rehypeBrutal frames/contact-sheets
    // the post images. rehypeBrutal skips .katex/.math subtrees regardless.
    rehypePlugins: [rehypeKatex, rehypeBrutal],
    // Code blocks: Astro's built-in Shiki highlighter.
    shikiConfig: {
      theme: 'github-light',
      wrap: false,
    },
  },
};
