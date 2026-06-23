# Bloggit Development Guidelines (Anti-Corporate Zine Aesthetic)

> Design spec for the Bloggit Astro blog. These rules are grounded in the
> existing implementation — see [`src/styles/global.css`](src/styles/global.css)
> for the live tokens and components, and [`inspo/`](inspo/) for the three
> reference layouts cited below.

## UI & Aesthetic Principles

- **Core Concept:** Raw Brutalism meets a physical photo-journal/scrapbook.
  Inspired directly by the layouts in [`inspo/`](inspo/):
  `f16941042c1f3e43c0722a0e5aead2b7.jpg`,
  `e7de38ef106be4f9da579006c0a9c535.jpg`, and
  `fed50441264b0af9b8c08e2d5cf03f0d.jpg`.

- **Typography:** Absolute extremes. Massively oversized Sans-Serif titles
  (e.g. Arial, Inter Black) crashing directly into standard un-styled Serif or
  Monospace body text.

- **Grid:** Multi-column grid layouts with asymmetric image scaling, raw
  borders, and un-cropped, stark canvas framing.

- **Elements:** Include deliberate raw desktop UI metaphors (mock file folders,
  window frames, or keyboard interfaces inspired by
  `e7de38ef106be4f9da579006c0a9c535.jpg`) and clean numbered lists matching
  `fed50441264b0af9b8c08e2d5cf03f0d.jpg`.

- **Animations:** Zero generic web animations or modern fading transitions. Use
  instant state changes.

## How This Maps To The Existing Code

The blog is a static Astro site with file-based Markdown posts. Honor what is
already built rather than reinventing it:

- **Design tokens** live in the `@theme` block of
  [`src/styles/global.css`](src/styles/global.css): `--color-paper`,
  `--color-ink`, `--color-faint`, `--color-rule`, `--color-accent` (cobalt
  `#1d4ed8`), `--font-serif` (Newsreader), `--font-mono` (JetBrains Mono).
  Add new tokens here; never hardcode hex values in components.

- **Printer's-proof chrome** is already implemented as the brutalist signature:
  `.calib-bar` / `.regmark` (grayscale + CMYK calibration strips), `.reg-mark`
  registration crosshairs, `.scan-id` stamps. Reuse these for the "raw desktop /
  scanned artifact" feel instead of building new decoration.

- **Deliberate tilt** is deterministic, not random: `.tilt-l` / `.tilt-r` and the
  `:nth-child` rotations on `.grid-cell` / `.tile-image`. Keep tilts subtle
  (≤ ~0.7deg) and rule-based so the layout reads as "taped down," never chaotic.

- **Post layouts** are driven by `layoutType` in the content schema
  ([`src/content.config.ts`](src/content.config.ts)): `math | text | gallery |
  list`. Style each via its `.post-*` class. The `list` layout already renders
  the numbered-index style from `fed50441264b0af9b8c08e2d5cf03f0d.jpg` via the
  `(n)` counters in `.post-list`.

- **Homepage** is the multi-column `.board` grid of `.tile` cards (image + text
  tiles). This is where asymmetric scaling and stark framing belong.

## Hard Rules (Do / Don't)

- **Do** use instant state changes — `:hover` swaps borders/underlines with no
  `transition`. **Don't** add fades, eases, or scroll-reveal animations.
- **Do** crash oversized sans titles against plain serif/mono body. **Don't**
  smooth the contrast with intermediate weights or soft gray hierarchies.
- **Do** keep raw 1px `--color-rule` borders and un-cropped framing. **Don't**
  add rounded-corner cards, drop shadows, or gradients (except the existing
  calibration strips).
- **Do** reuse the printer's-proof + tilt vocabulary already in `global.css`.
  **Don't** introduce a second decorative system.
- **Do** keep everything self-hosted (fonts bundled at build via
  `@fontsource-variable/*`). **Don't** add external font/CDN requests.
