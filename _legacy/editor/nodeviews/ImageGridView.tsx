import { useRef, useState } from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { api } from '../api';

interface Item {
  src: string;
  alt: string;
  caption: string;
}

export function ImageGridView({ node, updateAttributes, selected }: NodeViewProps) {
  const items: Item[] = Array.isArray(node.attrs.items) ? node.attrs.items : [];
  const columns: number = node.attrs.columns ?? 2;
  const title: string = node.attrs.title ?? '';
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  function setItems(next: Item[]) {
    updateAttributes({ items: next });
  }

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      const uploaded: Item[] = [];
      for (const f of Array.from(files)) {
        const m = await api.upload(f);
        uploaded.push({ src: m.url, alt: '', caption: 'Untitled' });
      }
      setItems([...items, ...uploaded]);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <NodeViewWrapper className={`imagegrid-node ${selected ? 'is-selected' : ''}`}>
      <div className="grid-toolbar" contentEditable={false}>
        <input
          className="grid-title-input"
          value={title}
          placeholder="grid title (optional)"
          onChange={(e) => updateAttributes({ title: e.target.value })}
        />
        <span className="label">cols</span>
        {[1, 2, 3, 4].map((c) => (
          <button
            key={c}
            type="button"
            className={columns === c ? 'on' : ''}
            onClick={() => updateAttributes({ columns: c })}
          >
            {c}
          </button>
        ))}
        <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}>
          {busy ? 'uploading…' : '+ images'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      <div className="image-grid" data-cols={columns} contentEditable={false}>
        <div className="grid-cells">
          {items.map((it, i) => (
            <figure className="grid-cell" key={i}>
              <span className="grid-index">({i + 1})</span>
              <img src={it.src} alt={it.alt} />
              <input
                className="cell-caption"
                value={it.caption}
                onChange={(e) => {
                  const next = items.slice();
                  next[i] = { ...it, caption: e.target.value };
                  setItems(next);
                }}
              />
              <button
                type="button"
                className="cell-remove"
                onClick={() => setItems(items.filter((_, j) => j !== i))}
              >
                ×
              </button>
            </figure>
          ))}
          {items.length === 0 && <p className="label">no images yet — use “+ images”.</p>}
        </div>
      </div>
    </NodeViewWrapper>
  );
}
