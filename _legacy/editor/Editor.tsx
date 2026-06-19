import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent, type Editor as TiptapEditor } from '@tiptap/react';
import { buildExtensions } from './extensions';
import { api } from './api';

export interface InitialPost {
  id: number;
  title: string;
  abstract: string;
  tags: string[];
  slug: string;
  status: 'draft' | 'published';
  cover_image: string | null;
  doc: unknown;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function Editor({ post }: { post: InitialPost }) {
  const [title, setTitle] = useState(post.title === 'Untitled' ? '' : post.title);
  const [abstract, setAbstract] = useState(post.abstract);
  const [tags, setTags] = useState(post.tags.join(', '));
  const [status, setStatus] = useState(post.status);
  const [slug, setSlug] = useState(post.slug);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [savedAt, setSavedAt] = useState<string>('');
  const [showVersions, setShowVersions] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: buildExtensions(),
    // Defer first render out of the synchronous render pass (avoids React 19
    // flushSync warnings from node views, and SSR hydration mismatches).
    immediatelyRender: false,
    content: hasContent(post.doc) ? (post.doc as object) : '',
    editorProps: {
      attributes: { class: 'prose editor-surface' },
      handlePaste(view, event) {
        const files = Array.from(event.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/'));
        if (files.length) {
          event.preventDefault();
          uploadAndInsert(files);
          return true;
        }
        return false;
      },
      handleDrop(view, event) {
        const files = Array.from((event as DragEvent).dataTransfer?.files ?? []).filter((f) =>
          f.type.startsWith('image/')
        );
        if (files.length) {
          event.preventDefault();
          uploadAndInsert(files);
          return true;
        }
        return false;
      },
    },
    onUpdate: () => scheduleSave(),
  });

  const uploadAndInsert = useCallback(
    async (files: File[]) => {
      if (!editor) return;
      for (const f of files) {
        try {
          const m = await api.upload(f);
          editor.chain().focus().insertContent({ type: 'image', attrs: { src: m.url, alt: '', caption: '' } }).run();
        } catch (e) {
          alert((e as Error).message);
        }
      }
    },
    [editor]
  );

  const doSave = useCallback(
    async (mode: 'auto' | 'manual' = 'auto') => {
      if (!editor) return;
      setSaveState('saving');
      try {
        const res = await api.put(`/api/posts/${post.id}?snapshot=${mode}`, {
          title: title || 'Untitled',
          abstract,
          tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
          cover_image: post.cover_image,
          doc: editor.getJSON(),
        });
        setSaveState('saved');
        setSavedAt(new Date().toLocaleTimeString());
        return res;
      } catch (e) {
        setSaveState('error');
        console.error(e);
      }
    },
    [editor, post.id, title, abstract, tags, post.cover_image]
  );

  const scheduleSave = useCallback(() => {
    setSaveState('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => doSave('auto'), 1400);
  }, [doSave]);

  // Autosave when metadata fields change too.
  useEffect(() => {
    if (!editor) return;
    scheduleSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, abstract, tags]);

  // Warn before leaving with an unsaved scheduled write.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (saveState === 'saving') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [saveState]);

  async function publish() {
    await doSave('manual');
    try {
      const res = await api.patch(`/api/posts/${post.id}`, { action: 'publish', slug: slug || undefined });
      setStatus('published');
      setSlug(res.slug);
    } catch (e) {
      alert((e as Error).message);
    }
  }

  async function unpublish() {
    try {
      await api.patch(`/api/posts/${post.id}`, { action: 'unpublish' });
      setStatus('draft');
    } catch (e) {
      alert((e as Error).message);
    }
  }

  async function remove() {
    if (!confirm('Delete this post permanently?')) return;
    await api.del(`/api/posts/${post.id}`);
    window.location.href = '/admin';
  }

  if (!editor) return <p className="label">loading editor…</p>;

  return (
    <div className="editor">
      <div className="editor-bar">
        <a href="/admin" className="label">← studio</a>
        <span className={`label save-${saveState}`}>
          {saveState === 'saving' && 'saving…'}
          {saveState === 'saved' && `saved ${savedAt}`}
          {saveState === 'error' && 'save failed — retry'}
          {saveState === 'idle' && 'ready'}
        </span>
        <div className="editor-bar-actions">
          <button className="label" onClick={() => doSave('manual')}>save version</button>
          <button className="label" onClick={() => setShowVersions((v) => !v)}>history</button>
          {status === 'published' ? (
            <>
              <a className="label" href={`/posts/${slug}`} target="_blank" rel="noopener">view ↗</a>
              <button className="label" onClick={unpublish}>unpublish</button>
            </>
          ) : (
            <button className="btn-primary" onClick={publish}>publish</button>
          )}
          <button className="label danger" onClick={remove}>delete</button>
        </div>
      </div>

      {showVersions && <VersionPanel postId={post.id} onClose={() => setShowVersions(false)} />}

      <div className="editor-meta">
        <input
          className="meta-title"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="meta-abstract"
          placeholder="Abstract / one-line summary…"
          rows={2}
          value={abstract}
          onChange={(e) => setAbstract(e.target.value)}
        />
        <div className="meta-row">
          <input
            className="meta-tags"
            placeholder="tags, comma, separated"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
          {status === 'published' && (
            <input
              className="meta-slug"
              placeholder="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              onBlur={publish}
              title="URL slug — blurring re-publishes with the new slug"
            />
          )}
        </div>
      </div>

      <Toolbar editor={editor} onImage={uploadAndInsert} />
      <EditorContent editor={editor} />
    </div>
  );
}

function hasContent(doc: unknown): boolean {
  return !!doc && typeof doc === 'object' && Array.isArray((doc as any).content) && (doc as any).content.length > 0;
}

// ---- toolbar --------------------------------------------------------------
function Toolbar({ editor, onImage }: { editor: TiptapEditor; onImage: (f: File[]) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const active = (name: string, attrs?: Record<string, unknown>) => (editor.isActive(name, attrs) ? 'on' : '');

  function setLink() {
    const prev = editor.getAttributes('link').href ?? '';
    const url = window.prompt('Link URL', prev);
    if (url === null) return;
    if (url === '') editor.chain().focus().unsetLink().run();
    else editor.chain().focus().setLink({ href: url }).run();
  }

  return (
    <div className="toolbar">
      <button className={active('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
      <button className={active('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</button>
      <span className="sep" />
      <button className={active('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></button>
      <button className={active('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></button>
      <button className={active('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><s>S</s></button>
      <button className={active('code')} onClick={() => editor.chain().focus().toggleCode().run()}>{'<>'}</button>
      <button className={active('link')} onClick={setLink}>link</button>
      <span className="sep" />
      <button className={active('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>• list</button>
      <button className={active('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. list</button>
      <button className={active('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>quote</button>
      <button className={active('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>code</button>
      <button onClick={() => editor.chain().focus().setHorizontalRule().run()}>―</button>
      <span className="sep" />
      <button onClick={() => editor.chain().focus().insertContent({ type: 'mathInline', attrs: { latex: '' } }).run()}>∑ inline</button>
      <button onClick={() => editor.chain().focus().insertContent({ type: 'mathBlock', attrs: { latex: '' } }).run()}>∑ block</button>
      <button onClick={() => editor.chain().focus().insertContent({ type: 'graph', attrs: { expr: 'sin(x)', xmin: -10, xmax: 10, caption: '' } }).run()}>graph</button>
      <span className="sep" />
      <button onClick={() => fileRef.current?.click()}>image</button>
      <button onClick={() => editor.chain().focus().insertContent({ type: 'imageGrid', attrs: { items: [], columns: 2, title: '' } }).run()}>grid</button>
      <button onClick={() => editor.chain().focus().insertContent({ type: 'callout', attrs: { kind: 'note' }, content: [{ type: 'paragraph' }] }).run()}>callout</button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) onImage(Array.from(e.target.files));
          e.target.value = '';
        }}
      />
    </div>
  );
}

// ---- version history ------------------------------------------------------
interface Version {
  id: number;
  label: string;
  title: string;
  created_at: string;
}

function VersionPanel({ postId, onClose }: { postId: number; onClose: () => void }) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get(`/api/posts/${postId}/versions`)
      .then((r) => setVersions(r.versions))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, [postId]);

  async function revert(versionId: number) {
    if (!confirm('Revert to this version? Your current state is snapshotted first.')) return;
    await api.patch(`/api/posts/${postId}`, { action: 'revert', versionId });
    window.location.reload();
  }

  return (
    <div className="version-panel">
      <div className="version-head">
        <span className="label">version history</span>
        <button className="label" onClick={onClose}>close ×</button>
      </div>
      {loading && <p className="label">loading…</p>}
      {!loading && versions.length === 0 && <p className="label">no versions yet — they accrue as you write.</p>}
      <ol>
        {versions.map((v) => (
          <li key={v.id}>
            <div>
              <span className="v-label">{v.label}</span>
              <span className="label"> · {fmt(v.created_at)}</span>
            </div>
            <button className="label" onClick={() => revert(v.id)}>revert</button>
          </li>
        ))}
      </ol>
    </div>
  );
}

function fmt(s: string): string {
  return new Date(s.replace(' ', 'T') + 'Z').toLocaleString();
}
