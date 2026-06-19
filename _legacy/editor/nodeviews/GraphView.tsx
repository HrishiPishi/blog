import { useMemo, useState } from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { plotToSvg } from '../../../lib/plot';

export function GraphView({ node, updateAttributes, selected }: NodeViewProps) {
  const { expr, xmin, xmax, caption } = node.attrs as {
    expr: string;
    xmin: number;
    xmax: number;
    caption: string;
  };
  const [open, setOpen] = useState(false);

  const svg = useMemo(() => {
    try {
      return plotToSvg({ expr: expr || 'sin(x)', xmin: Number(xmin), xmax: Number(xmax) });
    } catch {
      return '<div class="graph-error">parse error</div>';
    }
  }, [expr, xmin, xmax]);

  return (
    <NodeViewWrapper className={`graph-node ${selected ? 'is-selected' : ''}`}>
      <figure className="graph" contentEditable={false}>
        <div dangerouslySetInnerHTML={{ __html: svg }} />
        <figcaption>
          <span className="grid-index">fig.</span> {caption || `y = ${expr}`}
        </figcaption>
      </figure>
      <button type="button" className="node-edit-btn" onClick={() => setOpen((v) => !v)}>
        {open ? 'done' : 'edit graph'}
      </button>
      {open && (
        <div className="graph-controls" contentEditable={false}>
          <label>
            f(x) =
            <input value={expr} onChange={(e) => updateAttributes({ expr: e.target.value })} />
          </label>
          <label>
            x min
            <input type="number" value={xmin} onChange={(e) => updateAttributes({ xmin: Number(e.target.value) })} />
          </label>
          <label>
            x max
            <input type="number" value={xmax} onChange={(e) => updateAttributes({ xmax: Number(e.target.value) })} />
          </label>
          <label>
            caption
            <input value={caption} onChange={(e) => updateAttributes({ caption: e.target.value })} />
          </label>
        </div>
      )}
    </NodeViewWrapper>
  );
}
