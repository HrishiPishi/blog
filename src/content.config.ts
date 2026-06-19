import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// File-based posts: src/content/posts/*.md (and .mdx).
const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    category: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    thumbnail: z.string().optional(),
    layoutType: z.enum(['math', 'text', 'gallery', 'list']).default('text'),
    draft: z.boolean().default(false),
  }),
});

export const collections = { posts };
