import { Node, mergeAttributes, InputRule } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { createLowlight, common } from 'lowlight';
import { MathView } from './nodeviews/MathView';
import { GraphView } from './nodeviews/GraphView';
import { ImageGridView } from './nodeviews/ImageGridView';
import { ImageView } from './nodeviews/ImageView';

const lowlight = createLowlight(common);

// ---- inline math ----------------------------------------------------------
const MathInline = Node.create({
  name: 'mathInline',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return { latex: { default: '' } };
  },
  parseHTML() {
    return [{ tag: 'span[data-math-inline]' }];
  },
  renderHTML({ HTMLAttributes, node }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-math-inline': '' }), node.attrs.latex];
  },
  addNodeView() {
    return ReactNodeViewRenderer(MathView);
  },
  addInputRules() {
    return [
      new InputRule({
        find: /\$([^$]+)\$$/,
        handler: ({ state, range, match }) => {
          state.tr.replaceWith(range.from, range.to, this.type.create({ latex: match[1] }));
        },
      }),
    ];
  },
});

// ---- block math -----------------------------------------------------------
const MathBlock = Node.create({
  name: 'mathBlock',
  group: 'block',
  atom: true,
  selectable: true,
  addAttributes() {
    return { latex: { default: '' } };
  },
  parseHTML() {
    return [{ tag: 'div[data-math-block]' }];
  },
  renderHTML({ HTMLAttributes, node }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-math-block': '' }), node.attrs.latex];
  },
  addNodeView() {
    return ReactNodeViewRenderer(MathView);
  },
});

// ---- function graph -------------------------------------------------------
const Graph = Node.create({
  name: 'graph',
  group: 'block',
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      expr: { default: 'sin(x)' },
      xmin: { default: -10 },
      xmax: { default: 10 },
      caption: { default: '' },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-graph]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-graph': '' })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(GraphView);
  },
});

// ---- image grid -----------------------------------------------------------
const ImageGrid = Node.create({
  name: 'imageGrid',
  group: 'block',
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      items: { default: [] },
      columns: { default: 2 },
      title: { default: '' },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-image-grid]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-image-grid': '' })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageGridView);
  },
});

// ---- image (custom, with caption + archival chrome) -----------------------
const ImageBlock = Node.create({
  name: 'image',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return { src: { default: '' }, alt: { default: '' }, caption: { default: '' } };
  },
  parseHTML() {
    return [{ tag: 'img[src]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(HTMLAttributes)];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageView);
  },
});

// ---- callout --------------------------------------------------------------
const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return { kind: { default: 'note' } };
  },
  parseHTML() {
    return [{ tag: 'aside[data-callout]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['aside', mergeAttributes(HTMLAttributes, { 'data-callout': '' }), 0];
  },
});

export function buildExtensions() {
  return [
    StarterKit.configure({
      codeBlock: false, // replaced by lowlight version
      heading: { levels: [2, 3, 4] },
      link: false,
    }),
    Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer nofollow' } }),
    ImageBlock,
    Placeholder.configure({
      placeholder: ({ node }) =>
        node.type.name === 'heading' ? 'Heading…' : "Write… (type '/' is not wired — use the toolbar)",
    }),
    CodeBlockLowlight.configure({ lowlight }),
    MathInline,
    MathBlock,
    Graph,
    ImageGrid,
    Callout,
  ];
}
