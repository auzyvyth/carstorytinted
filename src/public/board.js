// The circuit trace behind the film board (same idea as XDrive /for-salesmen's
// PlanTour): a PCB-style line joins the film chips and draws itself as the
// visitor scrolls; each chip's pads light when the line reaches them.
// Scroll-linked, never looping. Reduced motion = drawn in full, no tip.
const NS = 'http://www.w3.org/2000/svg';
const DESKTOP = '(min-width: 861px)';
const GUTTER_X = 11;

// Orthogonal polyline -> path with rounded corners.
function tracePath(pts, r = 14) {
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [a, b, c] = [pts[i - 1], pts[i], pts[i + 1]];
    const inX = Math.sign(b.x - a.x), inY = Math.sign(b.y - a.y);
    const outX = Math.sign(c.x - b.x), outY = Math.sign(c.y - b.y);
    if (inX === outX && inY === outY) { d += ` L ${b.x} ${b.y}`; continue; }
    const rr = Math.min(r, Math.hypot(b.x - a.x, b.y - a.y) / 2, Math.hypot(c.x - b.x, c.y - b.y) / 2);
    d += ` L ${b.x - inX * rr} ${b.y - inY * rr} Q ${b.x} ${b.y} ${b.x + outX * rr} ${b.y + outY * rr}`;
  }
  const z = pts[pts.length - 1];
  return `${d} L ${z.x} ${z.y}`;
}

// How far along the polyline (0..1) each pad sits.
function fractions(pts, pads) {
  const seg = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const len = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    seg.push({ a: pts[i - 1], b: pts[i], start: total });
    total += len;
  }
  return pads.map((p) => {
    const s = seg.find((g) => Math.min(g.a.x, g.b.x) - 0.5 <= p.x && p.x <= Math.max(g.a.x, g.b.x) + 0.5
      && Math.min(g.a.y, g.b.y) - 0.5 <= p.y && p.y <= Math.max(g.a.y, g.b.y) + 0.5);
    return { ...p, frac: s && total ? (s.start + Math.hypot(p.x - s.a.x, p.y - s.a.y)) / total : 1 };
  });
}

const el = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };

let cleanup = null;

export function mountBoard() {
  if (cleanup) cleanup();
  const flow = document.querySelector('[data-board]');
  if (!flow) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const svg = el('svg', { class: 'board-trace', 'aria-hidden': 'true' });
  flow.prepend(svg);
  let lit = null, tip = null, len = 0, pads = [], chipAt = [], raf = 0;

  function measure() {
    const B = flow.getBoundingClientRect();
    const W = B.width, H = flow.offsetHeight;
    const rel = (e) => { const r = e.getBoundingClientRect(); return { top: r.top - B.top, bottom: r.bottom - B.top, cx: r.left - B.left + r.width / 2 }; };
    const rows = [...flow.querySelectorAll('.brow')].map(rel);
    const chips = [...flow.querySelectorAll('.chip')].map(rel);
    if (!rows.length || rows.length !== chips.length) return;
    let pts, pp;
    if (matchMedia(DESKTOP).matches) {
      const cx = W / 2, g0 = Math.max(12, rows[0].top / 2);
      pts = [{ x: cx, y: 0 }, { x: cx, y: g0 }, { x: chips[0].cx, y: g0 }];
      pp = [];
      chips.forEach((c, i) => {
        pts.push({ x: c.cx, y: c.top }, { x: c.cx, y: c.bottom });
        pp.push({ x: c.cx, y: c.top }, { x: c.cx, y: c.bottom });
        const gap = (rows[i].bottom + (i < chips.length - 1 ? rows[i + 1].top : H)) / 2;
        const nx = i < chips.length - 1 ? chips[i + 1].cx : cx;
        pts.push({ x: c.cx, y: gap }, { x: nx, y: gap });
      });
      pts.push({ x: cx, y: H });
    } else {
      pts = [{ x: GUTTER_X, y: 0 }, { x: GUTTER_X, y: H }];
      pp = rows.map((r) => ({ x: GUTTER_X, y: r.top + 14 }));
    }
    svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.replaceChildren();
    const d = tracePath(pts);
    svg.append(el('path', { d, class: 'trace-base' }));
    lit = el('path', { d, class: 'trace-lit' });
    svg.append(lit);
    len = lit.getTotalLength();
    lit.style.strokeDasharray = `${len}`;
    pads = fractions(pts, pp).map((p) => { const r = el('rect', { x: p.x - 5, y: p.y - 5, width: 10, height: 10, rx: 2, class: 'pad' }); svg.append(r); return { r, frac: p.frac }; });
    // A chip lights when the trace reaches it: its top pad on desktop, its row pad on mobile.
    const step = pads.length / chips.length;
    chipAt = chips.map((_, i) => pads[i * step].frac);
    tip = reduce ? null : el('circle', { r: 4, class: 'trace-tip' });
    if (tip) svg.append(tip);
    paint();
  }

  function paint() {
    raf = 0;
    if (!lit) return;
    const r = flow.getBoundingClientRect(), vh = innerHeight;
    const v = reduce ? 1 : Math.max(0, Math.min(1, (vh * 0.7 - r.top) / r.height));
    lit.style.strokeDashoffset = `${len * (1 - v)}`;
    if (tip) { const p = lit.getPointAtLength(v * len); tip.setAttribute('cx', p.x); tip.setAttribute('cy', p.y); }
    for (const p of pads) p.r.classList.toggle('on', p.frac <= v + 0.002);
    flow.querySelectorAll('.chip').forEach((c, i) => c.classList.toggle('on', chipAt[i] <= v + 0.002));
  }

  const onScroll = () => { if (!raf) raf = requestAnimationFrame(paint); };
  const ro = new ResizeObserver(() => measure());
  ro.observe(flow);
  addEventListener('scroll', onScroll, { passive: true });
  document.fonts?.ready.then(measure);
  measure();
  cleanup = () => { ro.disconnect(); removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); svg.remove(); };
}
