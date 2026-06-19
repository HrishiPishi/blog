// A tiny, safe math-expression evaluator + SVG function plotter.
// No eval(): we tokenize and run shunting-yard, supporting one variable `x`.

type Token = { t: 'num'; v: number } | { t: 'op'; v: string } | { t: 'fn'; v: string } | { t: 'var' } | { t: 'paren'; v: '(' | ')' } | { t: 'comma' };

const FUNCS: Record<string, (n: number) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  exp: Math.exp, log: Math.log, ln: Math.log, log10: Math.log10,
  sqrt: Math.sqrt, abs: Math.abs, sign: Math.sign, floor: Math.floor, ceil: Math.ceil,
};
const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E, tau: Math.PI * 2 };
const PREC: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 3 };
const RIGHT = new Set(['^']);

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const s = src.replace(/\s+/g, '');
  while (i < s.length) {
    const c = s[i];
    if (/[0-9.]/.test(c)) {
      let num = '';
      while (i < s.length && /[0-9.eE+\-]/.test(s[i])) {
        // allow exponent notation like 1e-3 but stop at standalone operators
        if ((s[i] === '+' || s[i] === '-') && !/[eE]/.test(s[i - 1])) break;
        num += s[i++];
      }
      const v = Number(num);
      if (!Number.isFinite(v)) throw new Error('bad number');
      tokens.push({ t: 'num', v });
      continue;
    }
    if (/[a-zA-Z]/.test(c)) {
      let name = '';
      while (i < s.length && /[a-zA-Z0-9_]/.test(s[i])) name += s[i++];
      if (name === 'x') tokens.push({ t: 'var' });
      else if (name in CONSTS) tokens.push({ t: 'num', v: CONSTS[name] });
      else if (name in FUNCS) tokens.push({ t: 'fn', v: name });
      else throw new Error('unknown identifier: ' + name);
      continue;
    }
    if ('+-*/^'.includes(c)) { tokens.push({ t: 'op', v: c }); i++; continue; }
    if (c === '(') { tokens.push({ t: 'paren', v: '(' }); i++; continue; }
    if (c === ')') { tokens.push({ t: 'paren', v: ')' }); i++; continue; }
    if (c === ',') { tokens.push({ t: 'comma' }); i++; continue; }
    throw new Error('unexpected char: ' + c);
  }
  return tokens;
}

// Compile to RPN once, then evaluate cheaply per x.
function toRPN(tokens: Token[]): Token[] {
  const out: Token[] = [];
  const stack: Token[] = [];
  let prev: Token | null = null;
  for (let idx = 0; idx < tokens.length; idx++) {
    let tok = tokens[idx];
    // unary minus → 0 - x  via marking; handle by treating as (0 -)
    if (tok.t === 'op' && tok.v === '-' && (prev === null || (prev.t === 'op') || (prev.t === 'paren' && prev.v === '(') || prev.t === 'comma')) {
      out.push({ t: 'num', v: 0 });
    }
    if (tok.t === 'num' || tok.t === 'var') out.push(tok);
    else if (tok.t === 'fn') stack.push(tok);
    else if (tok.t === 'op') {
      while (stack.length) {
        const top = stack[stack.length - 1];
        if (top.t === 'op' && (PREC[top.v] > PREC[tok.v] || (PREC[top.v] === PREC[tok.v] && !RIGHT.has(tok.v)))) {
          out.push(stack.pop()!);
        } else break;
      }
      stack.push(tok);
    } else if (tok.t === 'paren' && tok.v === '(') stack.push(tok);
    else if (tok.t === 'paren' && tok.v === ')') {
      while (stack.length && !(stack[stack.length - 1].t === 'paren')) out.push(stack.pop()!);
      if (!stack.length) throw new Error('mismatched parens');
      stack.pop();
      if (stack.length && stack[stack.length - 1].t === 'fn') out.push(stack.pop()!);
    } else if (tok.t === 'comma') {
      while (stack.length && !(stack[stack.length - 1].t === 'paren')) out.push(stack.pop()!);
    }
    prev = tok;
  }
  while (stack.length) {
    const top = stack.pop()!;
    if (top.t === 'paren') throw new Error('mismatched parens');
    out.push(top);
  }
  return out;
}

export function compile(expr: string): (x: number) => number {
  const rpn = toRPN(tokenize(expr));
  return (x: number) => {
    const st: number[] = [];
    for (const tok of rpn) {
      if (tok.t === 'num') st.push(tok.v);
      else if (tok.t === 'var') st.push(x);
      else if (tok.t === 'fn') st.push(FUNCS[tok.v](st.pop()!));
      else if (tok.t === 'op') {
        const b = st.pop()!;
        const a = st.pop()!;
        switch (tok.v) {
          case '+': st.push(a + b); break;
          case '-': st.push(a - b); break;
          case '*': st.push(a * b); break;
          case '/': st.push(a / b); break;
          case '^': st.push(Math.pow(a, b)); break;
        }
      }
    }
    return st.length === 1 ? st[0] : NaN;
  };
}

export interface PlotSpec {
  expr: string;
  xmin?: number;
  xmax?: number;
  ymin?: number;
  ymax?: number;
}

// Returns a clean, axis-marked SVG string in the site's ink/paper palette.
export function plotToSvg(spec: PlotSpec): string {
  const W = 680, H = 380, pad = 28;
  const xmin = spec.xmin ?? -10, xmax = spec.xmax ?? 10;
  let f: (x: number) => number;
  try {
    f = compile(spec.expr);
  } catch (e) {
    return `<div class="graph-error">Could not parse: ${escapeXml(spec.expr)}</div>`;
  }

  const N = 600;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i <= N; i++) {
    const x = xmin + ((xmax - xmin) * i) / N;
    xs.push(x);
    ys.push(f(x));
  }
  const finite = ys.filter((y) => Number.isFinite(y));
  let ymin = spec.ymin ?? Math.min(...finite);
  let ymax = spec.ymax ?? Math.max(...finite);
  if (!Number.isFinite(ymin) || !Number.isFinite(ymax) || ymin === ymax) {
    ymin = -10; ymax = 10;
  }
  const padY = (ymax - ymin) * 0.08;
  ymin -= padY; ymax += padY;

  const sx = (x: number) => pad + ((x - xmin) / (xmax - xmin)) * (W - 2 * pad);
  const sy = (y: number) => H - pad - ((y - ymin) / (ymax - ymin)) * (H - 2 * pad);

  // Build the path, breaking on non-finite / large jumps (asymptotes).
  let d = '';
  let pen = false;
  for (let i = 0; i <= N; i++) {
    const y = ys[i];
    if (!Number.isFinite(y) || y < ymin - (ymax - ymin) * 4 || y > ymax + (ymax - ymin) * 4) {
      pen = false;
      continue;
    }
    const px = sx(xs[i]).toFixed(2);
    const py = sy(y).toFixed(2);
    d += pen ? ` L${px},${py}` : ` M${px},${py}`;
    pen = true;
  }

  const x0 = xmin <= 0 && xmax >= 0 ? sx(0) : null;
  const y0 = ymin <= 0 && ymax >= 0 ? sy(0) : null;

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="graph-svg" role="img" aria-label="Plot of ${escapeXml(spec.expr)}">
  <rect x="0" y="0" width="${W}" height="${H}" fill="none"/>
  ${y0 !== null ? `<line x1="${pad}" y1="${y0.toFixed(1)}" x2="${W - pad}" y2="${y0.toFixed(1)}" stroke="#c9c4b6" stroke-width="1"/>` : ''}
  ${x0 !== null ? `<line x1="${x0.toFixed(1)}" y1="${pad}" x2="${x0.toFixed(1)}" y2="${H - pad}" stroke="#c9c4b6" stroke-width="1"/>` : ''}
  <path d="${d.trim()}" fill="none" stroke="#16140f" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>
</svg>`;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]!));
}
