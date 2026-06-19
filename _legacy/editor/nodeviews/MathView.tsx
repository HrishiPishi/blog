import { useEffect, useRef, useState } from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import katex from 'katex';

export function MathView({ node, updateAttributes, selected, extension }: NodeViewProps) {
  const display = extension.name === 'mathBlock';
  const latex: string = node.attrs.latex ?? '';
  const [editing, setEditing] = useState(latex === '');
  const ref = useRef<HTMLSpanElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ref.current && !editing) {
      try {
        katex.render(latex || '\\,', ref.current, {
          displayMode: display,
          throwOnError: false,
          strict: false,
          trust: false,
        });
      } catch {
        ref.current.textContent = latex;
      }
    }
  }, [latex, editing, display]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  return (
    <NodeViewWrapper
      as={display ? 'div' : 'span'}
      className={`math-node ${display ? 'math-node-block' : 'math-node-inline'} ${selected ? 'is-selected' : ''}`}
    >
      {editing ? (
        <textarea
          ref={inputRef}
          className="math-input"
          value={latex}
          rows={display ? 2 : 1}
          placeholder={display ? 'block LaTeX, e.g. \\int_0^1 x^2\\,dx' : 'inline LaTeX'}
          onChange={(e) => updateAttributes({ latex: e.target.value })}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || (!display && !e.shiftKey))) {
              e.preventDefault();
              setEditing(false);
            }
            if (e.key === 'Escape') setEditing(false);
          }}
        />
      ) : (
        <span ref={ref} className="math-render" onClick={() => setEditing(true)} title="Click to edit" />
      )}
    </NodeViewWrapper>
  );
}
