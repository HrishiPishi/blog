import { useState } from 'react';
import { api } from './api';

export interface PostSummary {
  id: number;
  title: string;
  slug: string;
  status: 'draft' | 'published';
  updated_at: string;
  reading_time: number;
  tags: string[];
}

export default function Dashboard({ initial }: { initial: PostSummary[] }) {
  const [posts, setPosts] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function newPost() {
    setBusy(true);
    try {
      const res = await api.post('/api/posts');
      window.location.href = `/admin/edit/${res.id}`;
    } catch (e) {
      alert((e as Error).message);
      setBusy(false);
    }
  }

  async function logout() {
    await api.post('/api/auth/logout');
    window.location.href = '/';
  }

  const drafts = posts.filter((p) => p.status === 'draft');
  const published = posts.filter((p) => p.status === 'published');

  return (
    <div className="dashboard">
      <div className="dash-actions">
        <button className="btn-primary" onClick={newPost} disabled={busy}>
          {busy ? '…' : '+ new post'}
        </button>
        <div className="dash-links label">
          <a href="/admin/media">media</a>
          <a href="/admin/settings">settings</a>
          <a href="/api/export">export ↓</a>
          <button className="label" onClick={logout}>logout</button>
        </div>
      </div>

      <Section title={`drafts (${drafts.length})`} posts={drafts} />
      <Section title={`published (${published.length})`} posts={published} />
    </div>
  );
}

function Section({ title, posts }: { title: string; posts: PostSummary[] }) {
  return (
    <section className="dash-section">
      <h2 className="label dash-section-title">{title}</h2>
      {posts.length === 0 && <p className="label dim">none.</p>}
      <ol>
        {posts.map((p) => (
          <li key={p.id}>
            <a href={`/admin/edit/${p.id}`} className="dash-post">
              <span className="dash-post-title">{p.title || 'Untitled'}</span>
              <span className="label">
                {fmt(p.updated_at)} · {p.reading_time}m {p.tags.length > 0 && '· ' + p.tags.map((t) => '#' + t).join(' ')}
              </span>
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}

function fmt(s: string): string {
  return new Date(s.replace(' ', 'T') + 'Z').toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}
