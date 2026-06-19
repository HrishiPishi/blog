# Hrishi Mehta — blog + studio

A live, server-rendered personal blog with an authenticated, Medium-style editor.
Static-feeling reading experience; full in-browser authoring with autosave,
version history, and self-hosted media.

## Stack
- **Astro 6 (SSR)** + Node standalone adapter
- **node:sqlite** (built-in) — single-file database at `data/blog.db`
- **React + TipTap** — the studio editor (math, code, graphs, image grids)
- **sharp** — uploads are re-encoded/optimized to WebP
- **KaTeX** — LaTeX rendered to static HTML at save time

## Run locally
```bash
npm install
npm run dev        # http://localhost:4321
```
On first visit to `/admin`, you'll be prompted to create the admin account.
(Or create it from the CLI: `npm run setup -- <username> <password>`.)

## Build & serve (production)
```bash
npm run build
npm run start      # serves dist/server/entry.mjs (set HOST/PORT as needed)
```
Set `site` in `astro.config.mjs` to your real domain first.

## Studio (`/admin`)
- Write/publish posts; drafts are private (author-only preview).
- **Autosave** every ~1.4s; **version history** with one-click revert.
- Insert: headings, lists, quote, **code** (highlighted), **inline/block math**,
  **function graphs**, **image grids**, callouts. Drag/drop or paste images.
- **Media library**, **site settings** (title/tagline/about/socials), **JSON export**.

## Security
- scrypt password hashing; httpOnly session cookies; CSRF double-submit + origin check.
- Login rate-limiting with lockout. Per-route auth guards.
- CSP + security headers (HSTS in prod). Content is rendered server-side from
  structured JSON (not trusted HTML); KaTeX runs with `trust:false`.
- Uploads are validated and re-encoded through sharp (strips embedded payloads).

## Backups
`npm run backup` snapshots `data/blog.db` + `data/media` into `data/backups/<timestamp>/`.
The whole `data/` directory is the source of truth — copy it to back up everything.
