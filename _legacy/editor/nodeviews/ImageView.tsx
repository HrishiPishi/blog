import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';

// Derive a short "scan id" from the stored filename (purely decorative, archival).
function scanId(src: string): string {
  const base = (src.split('/').pop() ?? '').split('.')[0];
  return (base.slice(0, 6) || 'image').toUpperCase();
}

export function ImageView({ node, updateAttributes, selected }: NodeViewProps) {
  const { src, alt, caption } = node.attrs as { src: string; alt: string; caption: string };

  return (
    <NodeViewWrapper as="figure" className={`img ${selected ? 'is-selected' : ''}`}>
      <div className="calib-bar" aria-hidden="true" contentEditable={false}>
        <span className="calib-grey" />
        <span className="calib-cmyk" />
      </div>
      <div className="img-frame" contentEditable={false}>
        <span className="reg-mark reg-tl" />
        <span className="reg-mark reg-tr" />
        <span className="reg-mark reg-bl" />
        <span className="reg-mark reg-br" />
        {src ? <img src={src} alt={alt} /> : <div className="img-empty">no image</div>}
        <span className="scan-id">{scanId(src)}</span>
      </div>
      <input
        className="cap-input"
        contentEditable={false}
        value={caption}
        placeholder="Untitled"
        onChange={(e) => updateAttributes({ caption: e.target.value })}
      />
      <input
        className="alt-input"
        contentEditable={false}
        value={alt}
        placeholder="alt text (accessibility)"
        onChange={(e) => updateAttributes({ alt: e.target.value })}
      />
    </NodeViewWrapper>
  );
}
