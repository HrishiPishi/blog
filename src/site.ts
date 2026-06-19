// Site metadata lives in src/content/site.json so it's editable from the dev
// dashboard (/admin/settings) and backed up with the rest of src/content.
import siteData from './content/site.json';

export interface SiteConfig {
  title: string;
  tagline: string;
  author: string;
  instagram: string;
  spotify: string;
  about: string;
}

export const site = siteData as SiteConfig;

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

// lowercase, no comma — "february 11 2026". UTC so a date-only value never
// shifts a day in local time.
export function stamp(d: Date): string {
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()} ${d.getUTCFullYear()}`;
}
