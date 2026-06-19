import { useEffect, useRef, useState } from 'react';
import { api } from './api';

interface Item {
  id: number;
  url: string;
  filename: string;
  width: number | null;
  height: number | null;
  size: number;
}

export default function MediaLibrary() {
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function load() {
    api.get('/api/media').then((r) => setItems(r.media)).catch((e) => console.error(e));
  }
  useEffect(load, []);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const f of Array.from(files)) await api.upload(f);
      load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    if (!confirm('Delete this image? Posts using it will show a broken image.')) return;
    await api.del('/api/media', { id });
    load();
  }

  function copy(url: string) {
    navigator.clipboard?.writeText(url);
  }

  return (
    <div className="media-lib">
      <div className="dash-actions">
        <button className="btn-primary" onClick={() => fileRef.current?.click()} disabled={busy}>
          {busy ? 'uploading…' : '+ upload'}
        </button>
        <a href="/admin" className="label">← studio</a>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
      </div>
      <div className="media-grid">
        {items.map((m) => (
          <figure key={m.id} className="media-cell">
            <img src={m.url} alt="" loading="lazy" />
            <figcaption>
              <button className="label" onClick={() => copy(m.url)} title="copy URL">copy</button>
              <button className="label danger" onClick={() => remove(m.id)}>del</button>
            </figcaption>
          </figure>
        ))}
        {items.length === 0 && <p className="label dim">no media yet.</p>}
      </div>
    </div>
  );
}
