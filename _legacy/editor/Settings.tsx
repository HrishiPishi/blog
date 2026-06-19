import { useState } from 'react';
import { api } from './api';

const FIELDS: { key: string; label: string; area?: boolean }[] = [
  { key: 'site_title', label: 'Site title' },
  { key: 'site_tagline', label: 'Tagline' },
  { key: 'author_name', label: 'Author name' },
  { key: 'instagram', label: 'Instagram handle' },
  { key: 'about', label: 'About (two line breaks = new paragraph)', area: true },
  { key: 'footer_note', label: 'Footer note' },
];

export default function Settings({ initial }: { initial: Record<string, string> }) {
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSaved(false);
    try {
      await api.put('/api/settings', values);
      setSaved(true);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="settings-form" onSubmit={save}>
      {FIELDS.map((f) => (
        <label key={f.key} className="settings-field">
          <span className="label">{f.label}</span>
          {f.area ? (
            <textarea
              rows={5}
              value={values[f.key] ?? ''}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
            />
          ) : (
            <input
              value={values[f.key] ?? ''}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
            />
          )}
        </label>
      ))}
      <div className="settings-actions">
        <button className="btn-primary" disabled={busy} type="submit">
          {busy ? 'saving…' : 'save settings'}
        </button>
        {saved && <span className="label">saved ✓</span>}
        <a href="/admin" className="label">← studio</a>
      </div>
    </form>
  );
}
