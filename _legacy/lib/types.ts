export interface Post {
  id: number;
  slug: string;
  title: string;
  abstract: string;
  tags: string[];
  cover_image: string | null;
  content_json: string;
  content_html: string;
  reading_time: number;
  status: 'draft' | 'published';
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface PostRow extends Omit<Post, 'tags'> {
  tags: string;
}

export interface Version {
  id: number;
  post_id: number;
  title: string;
  abstract: string;
  tags: string;
  content_json: string;
  content_html: string;
  label: string;
  created_at: string;
}

export interface Media {
  id: number;
  filename: string;
  original_name: string | null;
  mime: string;
  width: number | null;
  height: number | null;
  size: number;
  alt: string;
  created_at: string;
}

export type Settings = Record<string, string>;
