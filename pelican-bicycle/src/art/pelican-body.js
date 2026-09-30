// OWNER: pelican-body. Slots: neck, tail, body, pouch, billLower, billUpper, head, eye, crest (+ the scarf, drawn
// inside the body slot). Style C (retro screen-print travel poster): paper-white plumage in ink P, B key line, volume
// from contour-feather scallops (never large halftone), K bill/skin, O pouch, R nail/scarf, N darks.
// Each slot is drawn in its joint-local frame (see CONTRACT.md "Slots"). Everything static is built once as markup;
// update() only rewrites the neck + scarf ribbons (fixed command counts) and toggles a few opacities/transforms.
import { h, refs } from '../core/svg.js';
import { SKEL } from '../contract.js';

export const id = 'pelican-body';
export const materials = {};

// ---------------------------------------------------------------- helpers (pure)
const D2R = Math.PI / 180;
const f = x => { const r = Math.round(x * 100) / 100; return (r === 0 ? 0 : r).toString(); };
const pt = p => `${f(p[0])} ${f(p[1])}`;
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const lerp = (a, b, t) => a + (b - a) * t;
const lerp2 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const rot = ([x, y], a) => { const c = Math.cos(a * D2R), s = Math.sin(a * D2R); return [x * c - y * s, x * s + y * c]; };
const norm = v => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
const perp = v => [-v[1], v[0]];                     // +90° (clockwise on screen)
// Catmull-Rom through points -> cubic path (closed or open)
function smooth(pts, closed = true, k = 1 / 6) {
  const n = pts.length; const g = i => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
  let d = `M${pt(pts[0])}`;
  const m = closed ? n : n - 1;
  for (let i = 0; i < m; i++) {
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
    d += `C${pt([p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k])} ${pt([p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k])} ${pt(p2)}`;
  }
  return d + (closed ? 'Z' : '');
}
// midpoint-quadratic smoothing of an open polyline: fixed command count (M + Q×(n-2) + L)
function qline(p) {
  let d = `M${pt(p[0])}`;
  for (let i = 1; i < p.length - 1; i++) d += `Q${pt(p[i])} ${pt(lerp2(p[i], p[i + 1], 0.5))}`;
  return d + `L${pt(p[p.length - 1])}`;
}
// Catmull-Rom resample of a polyline (k samples per span)
function resample(P, k, closed = false) {
  const out = [], n = P.length, g = i => closed ? P[(i + n) % n] : P[Math.max(0, Math.min(n - 1, i))];
  const m = closed ? n : n - 1;
  for (let i = 0; i < m; i++) for (let j = 0; j < k; j++) {
    const t = j / k, t2 = t * t, t3 = t2 * t, p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
    out.push([0, 1].map(c => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)));
  }
  out.push(closed ? P[0] : P[n - 1]); return out;
}
// A long line as short C1-continuous quadratic pieces (midpoint to midpoint). Looks identical to one smooth stroke
// with round caps, but each piece only encloses a sliver (keeps hit-testing honest for the things underneath).
function splitQ(S) {
  const m = i => lerp2(S[i], S[i + 1], 0.5);
  let d = `M${pt(S[0])}L${pt(m(0))}`;
  for (let i = 1; i < S.length - 1; i++) d += `M${pt(m(i - 1))}Q${pt(S[i])} ${pt(m(i))}`;
  return d + `M${pt(m(S.length - 2))}L${pt(S[S.length - 1])}`;
}
// Point in polygon (even-odd)
function inside(poly, [x, y]) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
// Scallop arc: chord across the flow at c (width w), bulging by `depth` toward the flow direction u.
const scallop = (c, u, w, depth) => {
  const n = perp(u), a = add(c, mul(n, -w / 2)), b = add(c, mul(n, w / 2)), q = add(c, mul(u, depth * 2));
  return `M${pt(a)}Q${pt(q)} ${pt(b)}`;
};
// Halftone dots as zero-length round-capped strokes, radii quantised into bins (one path per bin).
function dots(pts, color, extra = {}) {
  const bins = new Map();
  for (const [x, y, r] of pts) { if (r < 0.35) continue; const q = Math.round(r * 4) / 4; if (!bins.has(q)) bins.set(q, []); bins.get(q).push(`M${f(x)} ${f(y)}h0`); }
  return [...bins].map(([q, a]) => h('path', { d: a.join(''), stroke: color, 'stroke-width': f(q * 2), 'stroke-linecap': 'round', fill: 'none', ...extra })).join('');
}
const line = (d, stroke, w, extra = {}) => h('path', { d, fill: 'none', stroke, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...extra });

// ---------------------------------------------------------------- neck deformer (pure; also used by the baker)
// Cubic Bézier centreline (rig-spec §2); width w0 -> w1. Optional bulge {at: 0..1, amp} for the gulp.
function neckSamples(n, N, bulge) {
  const B = (t, a, b, c, d) => (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t * t * c + t ** 3 * d;
  const Bd = (t, a, b, c, d) => 3 * (1 - t) ** 2 * (b - a) + 6 * (1 - t) * t * (c - b) + 3 * t * t * (d - c);
  const C = [], T = [], W = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    C.push([B(t, n.p0[0], n.p1[0], n.p2[0], n.p3[0]), B(t, n.p0[1], n.p1[1], n.p2[1], n.p3[1])]);
    T.push(norm([Bd(t, n.p0[0], n.p1[0], n.p2[0], n.p3[0]), Bd(t, n.p0[1], n.p1[1], n.p2[1], n.p3[1])]));
    // slight throat fullness under the head + taper; bulge for the gulp
    let w = (n.w0 + (n.w1 - n.w0) * t) / 2 + 1.6 * Math.sin(Math.PI * t) ** 2;
    const bg = bulge || (n.bulgeA > 0 ? { at: n.bulgeT, amp: (n.bulgeW ?? 13 * n.bulgeA) / 2 } : null);
    if (bg && bg.amp > 0) w += bg.amp * Math.exp(-(((t - bg.at) / 0.1) ** 2));
    W.push(w);
  }
  return { C, T, W };
}
const openCubic = P => {
  let d = '';
  const g = i => P[Math.max(0, Math.min(P.length - 1, i))];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
    d += `C${pt([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6])} ${pt([p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6])} ${pt(p2)}`;
  }
  return d;
};
// Outline: M + 8 C (front side, base -> head) + L + 8 C (back side, head -> base) + Z. Fixed command count.
export function neckD(n, bulge) {
  const { C, T, W } = neckSamples(n, 9, bulge);
  const F = C.map((c, i) => add(c, mul(perp(T[i]), W[i]))), Bk = C.map((c, i) => add(c, mul(perp(T[i]), -W[i]))).reverse();
  return `M${pt(F[0])}${openCubic(F)}L${pt(Bk[0])}${openCubic(Bk)}Z`;
}
// Feather-flow marks + front crease + rim lines that ride on the deformer (fixed command counts).
function neckDetail(n, bulge) {
  const N = 13, { C, T, W } = neckSamples(n, N, bulge);
  let flow = '', flowSmall = '';
  for (let i = 3; i < N - 1; i++) {
    const nr = perp(T[i]), u = mul(T[i], -1);            // feathers overlap downward, toward the body
    for (const [o, s, pathSel] of [[-0.42, 0.3, 0], [0.16, 0.36, 1]]) {
      const tt = i + (pathSel ? 0.5 : 0); if (tt > N - 1.5) continue;
      const k = Math.floor(tt), fr = tt - k, c0 = lerp2(C[k], C[k + 1], fr), w = lerp(W[k], W[k + 1], fr);
      const c = add(c0, mul(nr, o * w));
      if (pathSel) flowSmall += scallop(c, u, s * w * 2, 1.6 + 0.04 * w);
      else flow += scallop(c, u, s * w * 2, 2.1 + 0.05 * w);
    }
  }
  const side = (sgn, inset, t0, t1) => {
    const p = []; for (let i = 0; i < 9; i++) {
      const tt = lerp(t0, t1, i / 8) * (N - 1), k = Math.min(N - 2, Math.floor(tt)), fr = tt - k;
      const c = lerp2(C[k], C[k + 1], fr), tn = norm(lerp2(T[k], T[k + 1], fr)), w = lerp(W[k], W[k + 1], fr);
      p.push(add(c, mul(perp(tn), sgn * (w - inset))));
    }
    return splitQ(p);
  };
  return {
    flow, flowSmall,
    crease: side(1, 4.2, 0.24, 0.64),
    rimF: side(1, 2.6, 0.3, 0.84),
    rimB: side(-1, 2.6, 0.3, 0.9),
    shade: side(-1, 5.5, 0.3, 0.66),
  };
}

// ---------------------------------------------------------------- static geometry
// Body (pelvis-local): the spec ellipse (centre (32,-50), rx 98, ry 58, rot −18°) warped into a deep-chested teardrop.
function bodyPoly() {
  const pts = [];
  for (let i = 0; i < 48; i++) {
    const t = i / 48 * Math.PI * 2; let ex = 98 * Math.cos(t), ey = 58 * Math.sin(t);
    const deg = (t / D2R) % 360;
    // warp mask: 0 on the belly bottom (the saddle contact band), 1 elsewhere
    const m = 1 - sstep(55, 85, deg) * (1 - sstep(150, 180, deg));
    const back = Math.max(0, -Math.cos(t)), breast = Math.max(0, Math.cos(t)) * Math.max(0, Math.sin(t));
    ey *= 1 - 0.3 * back * back * m; ex *= 1 + (0.06 * back + 0.05 * breast) * m; ey *= 1 + 0.05 * breast * m;
    if (Math.sin(t) < 0) ey *= 1 - 0.06 * Math.max(0, -Math.cos(t));    // flatter back line
    const p = rot([ex, ey], -18); pts.push([32 + p[0], -50 + p[1]]);
  }
  return pts;
}
// lowest belly point (pelvis-local) for a body rotation, on the exact spec ellipse (matches rig bellyLow)
function bellyLowLocal(bodyRot, sx = 1, sy = 1) {
  let best = null;
  for (let d = 70; d <= 170; d += 0.5) {
    const t = d * D2R, e = rot([98 * Math.cos(t), 58 * Math.sin(t)], -18), q = [(32 + e[0]) * sx, (-50 + e[1]) * sy];
    const y = rot(q, bodyRot)[1]; if (!best || y > best.y) best = { y, q };
  }
  return best.q;
}
const EL = (e, g) => { const p = rot([e * 98, g * 58], -18); return [32 + p[0], -50 + p[1]]; };   // ellipse param -> body-local

// scarf wrap frame (body-local), from the neck base and the rig's first neck control offset (30,-58)
const NB = SKEL.neckBase, NU = norm([30, -58]), NN = perp(NU);   // NU along the neck (up), NN across (toward the front)
// Scarf art lives in a canonical frame (origin = wrap centre on the neck axis, axes NN/NU at rest); update() places it
// at the rig's knot (pose.scarf, rider space -> body-local) or at the default spot below.
const WRAP_DEFAULT = add(NB, mul(NU, 18)), NU_ANG = Math.atan2(NU[1], NU[0]) / D2R;
const W_ = (a, b) => add(mul(NN, a), mul(NU, b));  // across, along (canonical)
const KNOT = W_(12, -3);
const TAIL0 = { near: W_(-17, 1), far: W_(-13, 6) };
const scarfXf = (c, dAng) => `translate(${f(c[0])} ${f(c[1])}) rotate(${f(dAng)})`;
const XF0 = scarfXf(WRAP_DEFAULT, 0);

export function build({ v }) {
  const P = v('plume'), Bk = v('plumeShade'), N = v('flight'), K = v('bill'), Ks = v('skin'), O = v('pouch'), R = v('billNail'), Re = v('billEdge');
  const Pf = v('plume', { far: true }), Rf = v('billNail', { far: true }), Nf = v('flight', { far: true });
  const RIM = v('rim');
  const KW = 2.2;
  const key = (d, w = KW, extra = {}) => line(d, Bk, w, extra);
  const tag = (kind, name) => `pelican:${kind}:${name}`;
  const s = {};

  // ================================================================ NECK (rider space; deformer)
  s.neck = h('g', { 'data-detail': tag('O', 'neck') },
    h('path', { 'data-ref': 'pb-neck', d: '', fill: P, stroke: Bk, 'stroke-width': KW, 'stroke-linejoin': 'round' }),
    h('path', { 'data-ref': 'pb-neckRimF', 'data-detail': tag('O', 'neck-rim-light'), d: '', fill: 'none', stroke: RIM, 'stroke-width': 2, 'stroke-linecap': 'round', style: 'opacity:var(--pb-n-rimAlpha)' }),
    h('path', { 'data-ref': 'pb-neckRimB', d: '', fill: 'none', stroke: RIM, 'stroke-width': 2, 'stroke-linecap': 'round', style: 'opacity:var(--pb-n-rimAlpha);display:none' }),
    h('path', { 'data-ref': 'pb-neckShade', 'data-detail': tag('O', 'neck-nape-shade'), d: '', fill: 'none', stroke: Bk, 'stroke-width': 1.2, 'stroke-linecap': 'round', 'stroke-dasharray': '2.4 4.2' }),
    h('path', { 'data-ref': 'pb-neckFlow', 'data-detail': tag('T', 'neck-feather-flow'), d: '', fill: 'none', stroke: Bk, 'stroke-width': 1.25, 'stroke-linecap': 'round' }),
    h('path', { 'data-ref': 'pb-neckFlow2', 'data-detail': tag('T', 'neck-feather-flow-fine'), d: '', fill: 'none', stroke: Bk, 'stroke-width': 0.9, 'stroke-linecap': 'round' }),
    h('path', { 'data-ref': 'pb-neckCrease', 'data-detail': tag('O', 'neck-throat-crease'), d: '', fill: 'none', stroke: Bk, 'stroke-width': 1.2, 'stroke-linecap': 'round' }),
  );

  // ================================================================ TAIL (tail-local: pivot at the rump, feathers along −x)
  // A short, square pelican tail: 5 tight rectrices with blunt, grey (B) tipped ends, rooted inside the rump (the body
  // slot draws over the roots, so the tail grows out of the contour) and angled a little down.
  {
    const TILT = -17;                                   // slot adds tailRot +8°: net ≈ 9° tip-down
    const fan = [[-7, 38, -6], [-3, 41, -3], [1, 42, 0], [5, 41, 3], [9, 38, 6]];
    let feathers = '', tips = '', shafts = '';
    for (const [ang0, L, yb] of fan) {
      const ang = ang0 + TILT, dir = rot([-1, 0], ang), nr = perp(dir), b = [8, yb];
      const at = (u, w) => add(add(b, mul(dir, u)), mul(nr, w)), w = 4.4;
      const o = [at(0, -w), at(L * 0.5, -w * 1.02), at(L - 1.6, -w * 0.96), at(L, -w * 0.55), at(L + 0.3, 0), at(L, w * 0.55), at(L - 1.6, w * 0.96), at(L * 0.5, w * 1.02), at(0, w)];
      feathers += h('path', { d: smooth(o, true, 1 / 9), fill: P, stroke: Bk, 'stroke-width': 1.5, 'stroke-linejoin': 'round' });
      tips += `M${pt(at(L - 5, -w * 0.9))}L${pt(at(L - 1.6, -w * 0.9))}Q${pt(at(L + 0.3, -w * 0.5))} ${pt(at(L + 0.3, 0))}Q${pt(at(L + 0.3, w * 0.5))} ${pt(at(L - 1.6, w * 0.9))}L${pt(at(L - 5, w * 0.9))}Q${pt(at(L - 3.8, 0))} ${pt(at(L - 5, -w * 0.9))}Z`;
      shafts += `M${pt(at(L * 0.45, 0))}L${pt(at(L - 5.5, 0))}`;
    }
    // upper tail coverts: two short rounded feathers overlapping the tail base right at the rump line
    let cv = '';
    for (const [x, y, L, w] of [[2, -7, 16, 5.4], [0, -1.5, 14, 5.2]]) {
      const q = p => add([x, y], rot(p, TILT));
      const d = smooth([q([2, -w * 0.8]), q([-L * 0.5, -w * 0.8]), q([-L, 0.3]), q([-L * 0.5, w * 0.75]), q([2, w * 0.8])]);
      cv += h('path', { d, fill: P, stroke: Bk, 'stroke-width': 1.4, 'stroke-linejoin': 'round' });
    }
    const uq = p => rot(p, TILT);
    const ut = smooth([[12, 8], [2, 11], [-8, 13.5], [-14, 12], [-9, 9], [2, 6]].map(uq));
    s.tail = h('g', { 'data-detail': tag('O', 'tail-rectrices') }, feathers,
      h('path', { 'data-detail': tag('O', 'tail-grey-tips'), d: tips, fill: Bk }),
      line(shafts, Bk, 0.8, { 'data-detail': tag('T', 'tail-rachis-lines') }),
      h('g', { 'data-detail': tag('O', 'tail-upper-coverts') }, cv),
      h('g', { 'data-detail': tag('O', 'undertail-coverts') }, h('path', { d: ut, fill: P, stroke: Bk, 'stroke-width': 1.4, 'stroke-linejoin': 'round' }),
        line(`M${pt(uq([0, 9.5]))}Q${pt(uq([-5, 11]))} ${pt(uq([-9, 11.4]))}`, Bk, 0.9)));
  }

  // ================================================================ BODY (pelvis-local) + SCARF
  {
    const poly = bodyPoly();
    const o = smooth(poly);
    let b = '';
    // far scarf tail, behind the body mass (flat far inks)
    b += h('g', { 'data-detail': tag('O', 'scarf-far-tail') },
      h('path', { 'data-ref': 'pb-sfFill', d: '', fill: Rf, stroke: Nf, 'stroke-width': 1 }),
      h('path', { 'data-ref': 'pb-sfStripe', d: '', fill: Pf }),
      h('path', { 'data-ref': 'pb-sfFringe', d: '', fill: 'none', stroke: Rf, 'stroke-width': 1.8, 'stroke-linecap': 'round' }));
    let inner = '';
    // belly-edge halftone band: B band with P dots (spacing 5.2, radius falling toward the edge), STYLE-C §2.1
    {
      const low = poly.filter(p => p[1] > -20 && p[0] > -52 && p[0] < 8).sort((a, c) => a[0] - c[0]);
      const band = [...low.map(p => [p[0], p[1] + 2]), ...low.slice().reverse().map(p => [p[0], p[1] - 11])];
      const dp = [], s0 = 5.2;
      for (let j = 0; j < 4; j++) for (let x = -52 + (j % 2) * s0 / 2; x < 8; x += s0) {
        let ey = null; for (let i = 0; i < low.length - 1; i++) if (low[i][0] <= x && low[i + 1][0] > x) { const u = (x - low[i][0]) / (low[i + 1][0] - low[i][0]); ey = lerp(low[i][1], low[i + 1][1], u); }
        if (ey === null) continue;
        dp.push([x, ey - 10 + j * s0 * 0.866, 2.3 - j * 0.5]);
      }
      inner += h('g', { 'data-detail': tag('T', 'belly-halftone-band') }, h('path', { d: 'M' + band.map(pt).join('L') + 'Z', fill: Bk }), h('g', { 'data-detail': tag('T', 'belly-halftone-dots') }, dots(dp, P)));
    }
    // rump shade band: a narrow B band hugging the back end, P dots fading toward the edge
    {
      const seg = poly.slice(18, 32), cx = 32, cy = -50;
      const inw = (p, k) => { const d = sub([cx, cy], p), l = Math.hypot(...d); return add(p, mul(d, k / l)); };
      const band = [...seg.map(p => inw(p, -2)), ...seg.slice().reverse().map(p => inw(p, 10))];
      const rp = [];
      for (let j = 0; j < 3; j++) for (let i = 0; i < seg.length - 1; i++) for (let q = 0; q < 2; q++) {
        const a = lerp2(seg[i], seg[i + 1], q * 0.5 + (j % 2) * 0.25); rp.push([...inw(a, 9.4 - j * 3.6), 2.2 - j * 0.6]);
      }
      inner += h('g', { 'data-detail': tag('T', 'rump-halftone-band') }, h('path', { d: 'M' + band.map(pt).join('L') + 'Z', fill: Bk }), dots(rp, P));
    }
    // contour-feather rows (connected shingle scallops, convex back-and-down: feathers overlap toward the tail).
    // Tracts are separated by clean paper-white areas so the body keeps its volume (STYLE-C §2.1).
    const DOWN = norm(rot([0.35, 1], -18)), BACK = norm(rot([-1, 0], -18));
    const row = (g, e0, e1, n, depth, gTilt = 0) => {
      const pts = []; for (let i = 0; i <= n; i++) { const u = i / n; pts.push(EL(lerp(e0, e1, u), g + gTilt * u)); }
      let d = '';
      for (let i = 0; i < n; i++) { const m = lerp2(pts[i], pts[i + 1], 0.5), q = add(m, add(mul(DOWN, depth * 2), mul(BACK, depth * 0.7))); d += `M${pt(pts[i])}Q${pt(q)} ${pt(pts[i + 1])}`; }
      return { d, pts };
    };
    const rows = defs => defs.map(a => row(...a).d).join('');
    inner += line(rows([[-0.74, 0.34, -0.66, 8, 2.6, 0.08], [-0.55, 0.2, -0.6, 6, 3, 0.08], [-0.36, -0.1, -0.5, 3, 3.4, 0.06]]), Bk, 1.35, { 'data-detail': tag('T', 'mantle-scallops'), 'data-tract': 'mantle' });
    const fl = [[0.3, 0.1, -0.64, 4, 4.8, 0.04], [0.55, -0.04, -0.6, 3, 5.4, 0.02]];
    inner += line(rows(fl), Bk, 1.55, { 'data-detail': tag('T', 'flank-scallops'), 'data-tract': 'flank' });
    inner += line(rows([[-0.3, -0.64, -0.92, 3, 2.4, 0.1], [-0.08, -0.62, -0.94, 3, 2.6, 0.1], [0.16, -0.62, -0.9, 3, 2.6, 0.08]]), Bk, 1.25, { 'data-detail': tag('T', 'rump-scallops'), 'data-tract': 'rump' });
    // breast: small feathers; the upper rows in O = the yellowish breeding breast patch of P. onocrotalus
    inner += line(rows([[-0.64, 0.96, 0.66, 4, 1.9, 0.04], [-0.47, 0.98, 0.64, 4, 2, 0.04], [-0.3, 0.99, 0.66, 4, 2, 0.03]]), O, 1.5, { 'data-detail': tag('T', 'breast-buff-feathers'), 'data-tract': 'breast' });
    inner += line(rows([[-0.12, 0.99, 0.7, 3, 2.1, 0.03], [0.06, 0.98, 0.72, 3, 2.2, 0.02]]), Bk, 1.2, { 'data-detail': tag('T', 'breast-scallops'), 'data-tract': 'breast' });
    {
      let d = '';
      for (const a of fl) { const { pts } = row(...a); for (let i = 0; i < pts.length - 1; i++) { const m = lerp2(pts[i], pts[i + 1], 0.5); d += `M${pt(add(m, mul(DOWN, -2)))}L${pt(add(m, add(mul(DOWN, a[4] * 1.1), mul(BACK, a[4] * 0.4))))}`; } }
      inner += line(d, Bk, 0.8, { 'data-detail': tag('T', 'feather-shaft-ticks') });
    }
    inner += line('M-44 6Q-30 11 -12 10.5M-36 1.5Q-26 5 -16 4.6', Bk, 1.2, { 'data-detail': tag('O', 'saddle-compression-crease') });
    inner += line('M-68 -10Q-62 -4 -60 3M-62 -15Q-56 -11 -54 -5', Bk, 1.1, { 'data-detail': tag('O', 'vent-fluff') });
    // rim light (sun side; switched in update), inset from the outline, in short pieces
    const cx = 32, cy = -50, ins = p => { const d = sub(p, [cx, cy]), l = Math.hypot(...d); return add(p, mul(d, -3 / l)); };
    const frR = poly.filter((p, i) => { const a = i / poly.length; return a > 0.62 && a < 0.97; }).map(ins);
    const bkR = poly.filter((p, i) => { const a = i / poly.length; return a > 0.45 && a < 0.7; }).map(ins);
    b += h('g', { 'data-detail': tag('O', 'body') },
      h('path', { d: o, fill: P, stroke: Bk, 'stroke-width': KW, 'stroke-linejoin': 'round' }),
      h('clipPath', { id: 'pb-bodyclip' }, h('path', { d: o })),
      h('g', { 'clip-path': 'url(#pb-bodyclip)' }, inner),
      line(splitQ(resample(frR, 2)), RIM, 2.2, { 'data-ref': 'pb-rimF', 'data-detail': tag('O', 'rim-light'), style: 'opacity:var(--pb-n-rimAlpha)' }),
      line(splitQ(resample(bkR, 2)), RIM, 2.2, { 'data-ref': 'pb-rimB', style: 'opacity:var(--pb-n-rimAlpha);display:none' }));
    // --- belly-on-saddle compression: along the saddle (rider x −101…−23 -> body-local −56…22) the belly arc is pushed
    // down onto the saddle top (y 13) and spreads a touch, so the weight visibly rests on it. Drawn over the key line.
    {
      const arc = [];
      for (let d = 60; d <= 175; d += 2.5) { const t = d * D2R, e = rot([98 * Math.cos(t), 58 * Math.sin(t)], -18), q = [32 + e[0], -50 + e[1]]; if (q[1] > 6 && q[0] > -42 && q[0] < 24) arc.push(q); }
      arc.sort((a, c) => a[0] - c[0]);
      const x0 = arc[0][0], x1 = arc[arc.length - 1][0];
      const low = arc.map(([x, y]) => { const u = (x - x0) / (x1 - x0), wgt = Math.sin(Math.PI * u) ** 0.6; return [x, lerp(y, 13.6, 0.85 * wgt)]; });
      const top = arc.map(([x, y]) => [x, y - 2.2]).reverse();
      const dB = 'M' + low.map(pt).join('L') + 'L' + top.map(pt).join('L') + 'Z';
      const ends = [low[Math.round(low.length * 0.1)], low[Math.round(low.length * 0.9)]];
      b += h('g', { 'data-detail': tag('O', 'belly-saddle-bulge') },
        h('path', { d: dB, fill: P }), line(qline(low), Bk, KW),
        line(`M${pt(add(ends[0], [4, -2.6]))}q-2.6 0.4 -4.6 3.2q-0.8 -2.6 -3.2 -3.4M${pt(add(ends[1], [-4, -2.2]))}q2.6 0.4 4.4 3q0.8 -2.4 3 -3.2`, Bk, 1.1, { 'data-detail': tag('O', 'belly-splay-tufts') }));
    }
    // --- scarf (canonical frame, placed by update): cast shadow + collar ruff | near tail | wrap | hanging end | knot
    const wrapPts = [W_(-21, 10), W_(-8, 13.5), W_(8, 13.5), W_(21, 10), W_(24, 1), W_(21, -9), W_(8, -13), W_(-8, -13), W_(-21, -9), W_(-24, 1)];
    const wrap = smooth(wrapPts);
    let gA = h('path', { d: smooth(wrapPts.slice(5).concat([W_(-18, -17), W_(0, -19), W_(18, -16)]).map(p => add(p, mul(NU, -3)))), fill: Bk });      // cast shadow on the plumage
    {
      let d = '', dl = '';
      for (let i = 0; i < 4; i++) {
        const a = -21 + i * 6.8, c = W_(a, -12.5 - (i % 2) * 1.2), u = mul(NU, -1);
        const nrm = perp(u), p0 = add(c, mul(nrm, -3.8)), p1 = add(c, mul(nrm, 3.8)), q = add(c, mul(u, 12));
        d += `M${pt(add(p0, mul(u, -2)))}L${pt(p0)}Q${pt(q)} ${pt(p1)}L${pt(add(p1, mul(u, -2)))}Z`;
        dl += `M${pt(p0)}Q${pt(q)} ${pt(p1)}`;
      }
      gA += h('g', { 'data-detail': tag('O', 'collar-ruff') }, h('path', { d, fill: P }), line(dl, Bk, 1.3));
    }
    b += h('g', { 'data-ref': 'pb-scarfA', transform: XF0 }, gA);
    b += h('g', { 'data-detail': tag('O', 'scarf-trailing-end') },
      h('path', { 'data-ref': 'pb-snFill', d: '', fill: R, stroke: N, 'stroke-width': 1.3, 'stroke-linejoin': 'round' }),
      h('path', { 'data-ref': 'pb-snStripe', 'data-detail': tag('T', 'scarf-stripes'), d: '', fill: P }),
      h('path', { 'data-ref': 'pb-snKnit', 'data-detail': tag('T', 'scarf-knit-rib'), d: '', fill: 'none', stroke: Bk, 'stroke-width': 0.9, 'stroke-dasharray': '1.6 2.4', 'stroke-linecap': 'round' }),
      h('path', { 'data-ref': 'pb-snFringe', 'data-detail': tag('O', 'scarf-fringe'), d: '', fill: 'none', stroke: R, 'stroke-width': 2, 'stroke-linecap': 'round' }));
    {
      let st = '';
      for (let a = -26; a <= 26; a += 8.5) st += `M${pt(W_(a, 18))}L${pt(W_(a + 2, -18))}`;
      let hatch = '';
      for (let a = -21; a <= 4; a += 3.1) hatch += `M${pt(W_(a, -12.6))}L${pt(W_(a + 2.4, -8.2))}`;
      b += h('g', { 'data-ref': 'pb-scarfB', transform: XF0 }, h('g', { 'data-detail': tag('O', 'scarf-wrap') },
        h('path', { d: wrap, fill: R, stroke: N, 'stroke-width': 1.3 }),
        h('clipPath', { id: 'pb-wrapclip' }, h('path', { d: wrap })),
        h('g', { 'clip-path': 'url(#pb-wrapclip)' },
          line(st, P, 4.2, { 'stroke-linecap': 'butt' }),
          line(splitQ(resample([W_(-24, 5), W_(0, 8.5), W_(24, 5)], 3)), R, 1.2, { 'stroke-dasharray': '1.4 2' }),
          line(hatch, N, 0.9, { 'data-detail': tag('T', 'scarf-shade-hatching') }))));
    }
    b += h('g', { 'data-detail': tag('O', 'scarf-hanging-end') },
      h('path', { 'data-ref': 'pb-shFill', d: '', fill: R, stroke: N, 'stroke-width': 1.2, 'stroke-linejoin': 'round' }),
      h('path', { 'data-ref': 'pb-shStripe', d: '', fill: P }),
      h('path', { 'data-ref': 'pb-shFringe', 'data-detail': tag('O', 'scarf-fringe-cream'), d: '', fill: 'none', stroke: P, 'stroke-width': 1.8, 'stroke-linecap': 'round' }));
    b += h('g', { 'data-ref': 'pb-scarfC', transform: XF0 }, h('g', { 'data-detail': tag('O', 'scarf-knot') },
      h('ellipse', { cx: f(KNOT[0]), cy: f(KNOT[1]), rx: 8, ry: 7, fill: R, stroke: N, 'stroke-width': 1.1, transform: `rotate(-62 ${f(KNOT[0])} ${f(KNOT[1])})` }),
      line(`M${pt(add(KNOT, [-5, -3]))}Q${pt(add(KNOT, [1, -1]))} ${pt(add(KNOT, [3, 5.5]))}`, P, 3, {}),
      line(`M${pt(add(KNOT, [-2, 6]))}Q${pt(add(KNOT, [3, 4]))} ${pt(add(KNOT, [6.5, 0]))}`, N, 1, {})));
    const lowP = poly.reduce((a, p) => (p[1] > a[1] ? p : a), poly[0]);
    b += h('g', { 'data-ref': 'pb-seat', 'data-anchor': 'pb-seatContact', transform: `translate(${f(lowP[0])} ${f(lowP[1])})` });
    s.body = b;
  }

  // ================================================================ POUCH (pouch-local: hangs +y under the lower mandible)
  {
    const po = 'M-26 -3L108 -3C100 4 88 13 70 21C52 28 30 31.5 10 31.5C-8 31.5 -24 30 -36 25.5C-40 21 -40 15 -37 10C-34 5 -30 0 -26 -3Z';
    const edge = resample([[108, -3], [92, 10], [70, 21], [42, 29.6], [10, 31.5], [-14, 30.6], [-36, 25.5], [-39.4, 17], [-37, 10]], 2);
    s.pouch = h('g', { 'data-detail': tag('O', 'pouch') },
      h('path', { d: po, fill: O }),
      line(splitQ(edge), Re, 1.6, { 'data-detail': tag('O', 'pouch-edge-line') }),
      h('clipPath', { id: 'pb-pouchclip' }, h('path', { d: po })),
      h('g', { 'clip-path': 'url(#pb-pouchclip)' },
        h('path', { 'data-ref': 'pb-pouchGlow', d: 'M-20 2C10 8 60 8 98 0C88 12 66 20 44 24C20 27 -8 26 -28 20Z', fill: K, style: 'display:none' }),
        h('g', { 'data-ref': 'pb-pouchFish', style: 'display:none' },
          h('path', { d: 'M18 0C13 -5.6 -1 -7 -10 -3L-20 -8.4L-17.6 0L-20 8.4L-10 3C-1 7 13 5.6 18 0Z', fill: Re }),
          line('M4 -4.6Q7 0 4 4.6', O, 0.9), h('circle', { cx: 12.4, cy: -1, r: 1.3, fill: O })),
        line('M-30 7C-4 14 40 16 92 3M-34 15C-6 23 36 24 76 13M-34 22C-10 29 22 30 54 23', Re, 1.3, { 'data-detail': tag('T', 'pouch-stretch-lines'), 'data-stretch': 'sy' }),
        line('M-33 14q-1.6 4 -0.6 8M-28.4 16q-1.4 4.4 -0.4 8.6M-23.6 17.6q-1.2 4.4 0 8.6M-18.8 19q-1 4.2 0 8', K, 1, { 'data-detail': tag('T', 'pouch-throat-wrinkles') }),
        line('M4 22q3 3 7 3M18 24q3 3 7 2.6M32 23q3 3 7 1.6M46 19.5q3 2.6 6.6 1', K, 1, { 'data-detail': tag('T', 'pouch-sag-folds') })),
      line('M14 1.6C36 6 60 5.4 90 0.6', P, 2, { 'data-detail': tag('O', 'pouch-highlight') }),
      line('M-12 -1q4 3 8 0q4 3 8 0q4 3 8 0q4 3 8 0q4 3 8 0q4 3 8 0q4 3 8 0q4 3 8 0q4 3 8 0q4 2.6 8 0q4 2.2 8 0q4 2 8 0', Re, 1, { 'data-detail': tag('O', 'pouch-rim-folds') }));
  }

  // ================================================================ LOWER BILL (pivot at the gape; +x along the bill)
  s.billLower = h('g', { 'data-detail': tag('O', 'bill-lower') },
    h('path', { d: 'M-4 -0.4L114 -0.6C117.4 0 118.4 2.2 115.6 3.8L0 5.6C-4 5 -5.4 1.2 -4 -0.4Z', fill: K }),
    line('M0 5L115 3.4', Re, 1.4, { 'data-detail': tag('O', 'mandible-ramus-line') }),
    line('M20 2.4L104 1.6', P, 0.9, { 'stroke-dasharray': '10 5', 'data-detail': tag('O', 'ramus-sheen') }),
    h('g', { 'data-ref': 'pb-drips', style: 'display:none' },
      ...[[40, 6, 1], [76, 5, 0.8], [100, 4, 1.1]].map(([x, y, k], i) => h('path', { 'data-ref': 'pb-drip' + i, d: `M${x} ${y}c${f(-1.8 * k)} ${f(3 * k)} ${f(-1.8 * k)} ${f(5 * k)} 0 ${f(5 * k)}s${f(1.8 * k)} ${f(-2 * k)} 0 ${f(-5 * k)}Z`, fill: P, stroke: Bk, 'stroke-width': 0.7 }))));

  // ================================================================ UPPER BILL (pivot at the gape)
  s.billUpper = h('g', { 'data-detail': tag('O', 'bill-upper') },
    h('path', { d: 'M-4 -13C20 -13.6 60 -9.8 100 -7.1C110 -6.5 117 -6.9 121 -6.7L121 3.1L-2 4.1C-6 1 -7 -8 -4 -13Z', fill: K }),
    line('M-2 3.7L119 2.9', Re, 1.6, { 'data-detail': tag('O', 'tomium-line') }),
    line('M24 -0.6C56 -0.8 88 -1.4 116 -1.6', Re, 0.9, { 'data-detail': tag('O', 'maxillary-groove') }),
    line('M28 -4.2l-0.8 3.2M33 -4.4l-0.8 3.3M38 -4.4l-0.8 3.3M43 -4.3l-0.8 3.2M48 -4.1l-0.7 3', Re, 0.8, { 'data-detail': tag('T', 'bill-growth-ridges') }),
    line('M4 -8.2C40 -6.8 80 -5 114 -4.3', Re, 1.2, { 'data-detail': tag('O', 'culmen-ridge') }),
    line('M6 -11.2C40 -10.2 76 -8.2 104 -7', P, 1.5, { 'data-detail': tag('O', 'culmen-highlight') }),
    line('M30 -6.7Q36 -7.1 44 -6.2', N, 1.2, { 'data-detail': tag('O', 'nostril-slit') }),
    h('path', { 'data-detail': tag('O', 'bill-tip-shadow'), d: 'M104 3.1L125 4.8C126.5 6.4 127 8 127.4 10C122 8 112 6 104 5Z', fill: Bk }),
    h('g', { 'data-detail': tag('O', 'nail-hook') },
      h('path', { d: 'M114 -6.6C120 -7.6 126 -7 129.6 -3.8C132.6 0.5 131.8 6 128.6 10.8C127.6 7.6 125 5.2 121 4L114 3.4Z', fill: R }),
      line('M119 -5.1C123.4 -5.5 127 -4 128.6 -1.2', P, 1.2, { 'data-detail': tag('O', 'nail-highlight') }),
      line('M126.2 5.6C127.6 7 128.2 8.6 128.6 10.8', N, 1, { 'data-detail': tag('O', 'nail-under-hook') })));

  // ================================================================ HEAD (head-local, skull r≈26)
  {
    const outline = [[-26, 12], [-30.5, -3], [-25, -19], [-11, -29], [5, -30.5], [19, -25.6], [29, -17], [37, -9.6], [47.5, -4.4], [36, -3.6], [26, -1], [21, 6], [12, 14], [0, 19], [-14, 18.5]];
    const o = smooth(outline);
    const skin = smooth([[-9, -5], [-5.5, -13], [3, -17], [13, -17.6], [22, -14], [28, -8.5], [31, -2.5], [25, 4.5], [13, 5], [4, 3.4], [-4, 1.6]]);
    let inner = h('path', { 'data-detail': tag('O', 'facial-skin'), d: skin, fill: Ks });
    {
      const edge = [[-9.5, -3], [-7.4, -9.4], [-3.4, -14.2], [2.6, -17.2]];
      let d = `M-14 -1L${pt(edge[0])}`, dl = '';
      for (let i = 0; i < edge.length - 1; i++) {
        const a = edge[i], c = edge[i + 1], m = lerp2(a, c, 0.5), n = perp(norm(sub(c, a))), q = add(m, mul(n, -3.2));
        d += `Q${pt(q)} ${pt(c)}`; dl += `M${pt(a)}Q${pt(q)} ${pt(c)}`;
      }
      d += 'L0 -24L-14 -24Z';
      inner += h('g', { 'data-detail': tag('O', 'cheek-feather-edge') }, h('path', { d, fill: P }), line(dl, Bk, 1.1));
      const chin = [[-8, 3.4], [-1, 5.4], [6, 7], [12, 8.6]];
      let dcl = '';
      const dc = `M-12 3L${pt(chin[0])}` + chin.slice(1).map((c, i) => { const a = chin[i], m = lerp2(a, c, 0.5), n = perp(norm(sub(c, a))), q = add(m, mul(n, 3.4)); dcl += `M${pt(a)}Q${pt(q)} ${pt(c)}`; return `Q${pt(q)} ${pt(c)}`; }).join('') + 'L12 24L-12 24Z';
      inner += h('g', { 'data-detail': tag('O', 'chin-feathers') }, h('path', { d: dc, fill: P }), line(dcl, Bk, 1.1));
    }
    inner += line('M6 -26.4l-3.6 1.8M12 -24.6l-3.8 1.6M18 -21.6l-3.6 1.4M9 -20.4l-3.4 1.2M15 -18.6l-3 1', Bk, 1, { 'data-detail': tag('T', 'forehead-feather-flecks') });
    inner += line('M-27 8Q-22 12 -16 13M-22 14Q-17 16 -12 16.4', Bk, 1.1, { 'data-detail': tag('O', 'nape-edge') });
    const keyPts = resample([[21, 6], [12, 14], [0, 19], [-14, 18.5], [-26, 12], [-30.5, -3], [-25, -19], [-11, -29], [5, -30.5], [19, -25.6], [29, -17], [37, -9.6], [47.5, -4.4]], 2);
    s.head = h('g', { 'data-detail': tag('O', 'head') },
      h('path', { d: o, fill: P }),
      h('clipPath', { id: 'pb-headclip' }, h('path', { d: o })),
      h('g', { 'clip-path': 'url(#pb-headclip)' }, inner),
      key(splitQ(keyPts)),
      // feathered forehead point pressing onto the culmen base (P. onocrotalus field mark)
      h('g', { 'data-detail': tag('O', 'forehead-feather-point') },
        h('path', { d: 'M24 -18C32 -12 40 -7 48 -4.4C40 -3.2 33 -3.4 26 -4.6C24 -8 23 -13 24 -18Z', fill: P }),
        line('M26 -4.6C33 -3.4 40 -3.2 48 -4.4', Bk, 1.4), line('M30 -9.6Q36 -7 41 -5.4', Bk, 0.8)),
      // gape: the mouth line runs back under the eye and turns up slightly at the corner (content smile)
      line(splitQ(resample([[40, 9.2], [26, 6.4], [14, 3.8], [5, 1.8], [0.4, 0.6]], 2)), Re, 2, { 'data-detail': tag('O', 'gape-smile-line') }),
      h('g', { 'data-ref': 'pb-smile' }, line('M0.4 0.6Q-1.6 -0.4 -1.8 -2.8', Re, 1.4, { 'data-detail': tag('O', 'smile-crease') })),
      // goggles pushed up on the crown (clear of the forehead point and the bare face skin)
      h('g', { 'data-detail': tag('O', 'goggle-strap') },
        line('M-5 -30.6C-10 -29.8 -14 -28.4 -17.4 -26.6', N, 4.4, { 'stroke-linecap': 'butt' }),
        line('M-5 -30.6C-10 -29.8 -14 -28.4 -17.4 -26.6', Bk, 0.8, { 'stroke-dasharray': '1.4 2', 'stroke-linecap': 'butt' })),
      h('rect', { 'data-detail': tag('O', 'goggle-buckle'), x: -14, y: -31.6, width: 5, height: 6, rx: 1, fill: O, stroke: N, 'stroke-width': 1, transform: 'rotate(-16 -11.5 -28.6)' }),
      h('g', { 'data-detail': tag('O', 'goggle-lens'), transform: 'translate(3 -34.5) rotate(20)' },
        h('ellipse', { cx: -9, cy: 1, rx: 5.6, ry: 7.4, fill: v('plumeShade', { far: true }), stroke: N, 'stroke-width': 1.2 }),
        h('path', { d: 'M-4.4 0.4Q-6 -1.6 -8 -0.4', fill: 'none', stroke: N, 'stroke-width': 2.4 }),
        h('ellipse', { cx: 0, cy: 0, rx: 7.4, ry: 8.6, fill: O, stroke: N, 'stroke-width': 1.4 }),
        h('ellipse', { cx: 0.3, cy: 0.3, rx: 5, ry: 6.1, fill: Bk, stroke: N, 'stroke-width': 0.8 }),
        line('M-2.6 -3.2Q-0.8 -5 2 -4.4', P, 1.4, { 'data-detail': tag('O', 'goggle-glint') }),
        h('circle', { cx: 2.4, cy: 3, r: 1, fill: P })),
      // closed-eye line (blink / happy squint); the eye slot itself squashes to nothing
      line('M-1.4 -7.6Q6 -12.2 13.6 -8', N, 2.2, { 'data-ref': 'pb-lidClosed', style: 'display:none' }));
  }

  // ================================================================ EYE (eye-local; sy = blink)
  s.eye = h('g', {},
    h('g', { 'data-detail': tag('O', 'iris') }, h('circle', { r: 5.6, fill: v('iris') }),
      h('g', { 'data-ref': 'pb-pupil' },
        h('circle', { 'data-detail': tag('O', 'pupil'), r: 4, fill: v('pupil') }),
        h('circle', { 'data-detail': tag('O', 'eye-highlight'), cx: 1.5, cy: -1.7, r: 1.45, fill: P }),
        h('circle', { 'data-detail': tag('O', 'eye-glint-secondary'), cx: -1.7, cy: 1.5, r: 0.65, fill: P }))),
    // nictitating membrane: sweeps front -> back across the eye (most of the pelican's blinks)
    h('clipPath', { id: 'pb-eyeclip' }, h('circle', { r: 5.7 })),
    h('g', { 'clip-path': 'url(#pb-eyeclip)', 'data-ref': 'pb-nictG', style: 'display:none' },
      h('g', { 'data-ref': 'pb-nict', 'data-detail': tag('O', 'nictitating-membrane') }, h('path', { d: 'M-6.4 -6.5Q-8.4 0 -6.4 6.5L9 6.5L9 -6.5Z', fill: P }), line('M-6.4 -6.5Q-8.4 0 -6.4 6.5', Bk, 0.9))),
    // expression lids: the upper lid skin slides down over the eye (clipped to the orbit), the lower lid rises
    // (cheek push: delight / focus). update() drives both from pose.face (lid, brow, mood).
    h('clipPath', { id: 'pb-orbitclip' }, h('circle', { r: 6.3 })),
    h('g', { 'clip-path': 'url(#pb-orbitclip)' },
      h('g', { 'data-ref': 'pb-lidSkin' }, h('path', { 'data-detail': tag('O', 'upper-lid-skin'), d: 'M-8 -2.4Q0 -7.6 8 -3L8 -20L-8 -20Z', fill: Ks })),
      h('g', { 'data-ref': 'pb-lowLid' }, h('path', { 'data-detail': tag('O', 'lower-lid-skin'), d: 'M-7 6.4Q0 4.2 7 5.4L7 14L-7 14Z', fill: Ks }),
        line('M-5.4 6.2Q0 4.2 5.6 5.4', Re, 1.2, { 'data-detail': tag('O', 'lower-eyelid') }))),
    h('g', { 'data-ref': 'pb-lid' },
      h('path', { 'data-detail': tag('O', 'upper-eyelid'), d: 'M-7.2 -1.8Q-1 -8.8 7.6 -3.6Q8.6 -2.6 8.2 -1.6Q0.4 -6.4 -7.2 -1.8Z', fill: N }),
      line('M7.6 -3.4Q9.4 -3.2 10.2 -1.6', N, 1.1, { 'data-detail': tag('O', 'lid-corner-crinkle') })),
    // happy closed eye (swallow / delight): an upturned lid arc with a cheek crinkle, drawn in eye space
    h('g', { 'data-ref': 'pb-happy', style: 'display:none' }, line('M-6.6 2Q0 -5.4 7 1.4', N, 2.1, { 'data-detail': tag('O', 'happy-closed-lid') }),
      line('M-4.4 5.6Q0 7.4 4.6 5.4M8 1.2l2.4 -1.4', Re, 1, { 'data-detail': tag('O', 'happy-cheek-crinkle') })),
    // brow ridge: the feathered supraorbital edge; lowers + tilts for focus, lifts for surprise
    h('g', { 'data-ref': 'pb-brow' }, line('M-6.8 -9.4Q0.6 -13.4 9.8 -9.8', N, 1.6, { 'data-detail': tag('O', 'brow-ridge') }),
      line('M-3.4 -11.4l-1.2 -2M1 -12.2l-0.7 -2.2M5.4 -11.8l-0.2 -2.2', N, 0.9, { 'data-detail': tag('T', 'brow-feather-tips') })));

  // ================================================================ CREST (crest-local: +x back along the nape, +y up)
  {
    const strand = (by, L, droop, curl, w) => {
      const c = [[0, by], [L * 0.35, by + curl], [L * 0.7, by + curl * 0.4 - droop * 0.45], [L, by - droop]];
      const P2 = [], Q2 = [];
      for (let i = 0; i < c.length; i++) {
        const d = norm(sub(c[Math.min(c.length - 1, i + 1)], c[Math.max(0, i - 1)])), n = perp(d), ww = w * (1 - i / (c.length - 1)) ** 0.8 / 2;
        P2.push(add(c[i], mul(n, ww))); Q2.push(add(c[i], mul(n, -ww)));
      }
      const tip = add(c[c.length - 1], mul(norm(sub(c[3], c[2])), 2.5));
      return { d: smooth([...P2.slice(0, -1), tip, ...Q2.slice(0, -1).reverse()]), shaft: splitQ(resample([c[0], c[1], c[2], lerp2(c[2], c[3], 0.6)].map((p, i) => i ? p : lerp2(c[0], c[1], 0.4)), 2)) };
    };
    const longS = [[-6, 34, 24, -2, 9], [-2, 43, 23, 1.5, 10], [2, 47, 19, -1, 10.5], [6, 39, 12, 3, 9.5], [10, 30, 5, 2.5, 8.5]];
    const shortS = [[12, 20, 2, 2, 6.5], [14, 14, -2, 1.5, 6], [7, 26, 9, 2, 7]];
    let longD = '', shaftD = '', shortD = '';
    for (const a of longS) { const st = strand(...a); longD += h('path', { d: st.d, fill: P, stroke: Bk, 'stroke-width': 1.3, 'stroke-linejoin': 'round' }); shaftD += st.shaft; }
    for (const a of shortS) shortD += h('path', { d: strand(...a).d, fill: P, stroke: Bk, 'stroke-width': 1.3, 'stroke-linejoin': 'round' });
    s.crest = h('g', {},
      h('path', { 'data-detail': tag('O', 'crest-shadow'), d: smooth([[-4, -12], [14, -14], [34, -26], [26, -12], [6, -4]]), fill: Bk }),
      h('g', { 'data-detail': tag('O', 'nape-tuft') },
        h('path', { d: smooth([[-5, -4], [6, -12], [15, -19], [12, -22], [20, -26], [7, -23], [-2, -14]]), fill: P, stroke: Bk, 'stroke-width': 1.3, 'stroke-linejoin': 'round' }),
        line('M3 -11Q8 -15 11 -19', Bk, 0.8)),
      h('g', { 'data-ref': 'pb-crestLong' }, h('g', { 'data-detail': tag('O', 'crest-long-strands') }, longD, line(shaftD, Bk, 0.8, { 'data-detail': tag('T', 'crest-shaft-lines') }))),
      h('g', { 'data-ref': 'pb-crestShort', 'data-detail': tag('O', 'crest-short-spikes') }, shortD));
  }
  return { slots: s };
}
function rng(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------------------------------------------------------------- scarf ribbon (body-local, animated)
// centreline: inextensible chain from the wrap, trailing behind; flutter = travelling wave; lift from speed & hop.
function scarfCentre(p0, L, n, t, spd, hopA, seed) {
  const pts = [p0]; let p = p0;
  const s1 = Math.min(spd, 1.2);
  const base = Math.PI + 0.05 + 0.1 * s1 - 1.15 * (1 - Math.min(1, spd * 1.4));
  const A = 0.07 + 0.2 * s1, fw = 1.1 + 1.6 * s1;
  for (let i = 0; i < n; i++) {
    const sN = (i + 0.5) / n;
    const droop = -(0.55 * (1 - s1) + 0.12) * sN;
    const wave = A * (0.3 + sN) * Math.sin(2 * Math.PI * (1.25 * sN - fw * t) + seed);
    const th = base + droop + wave + hopA(sN);
    p = add(p, [Math.cos(th) * L / n, Math.sin(th) * L / n]); pts.push(p);
  }
  return pts;
}
function ribbon(cl, w0, w1, t, seed) {
  const n = cl.length, L = [], Rr = [];
  for (let i = 0; i < n; i++) {
    const d = norm(sub(cl[Math.min(n - 1, i + 1)], cl[Math.max(0, i - 1)])), nr = perp(d), s = i / (n - 1);
    const tw = 0.62 + 0.38 * Math.abs(Math.cos(Math.PI * (1.1 * s - 0.35 * t) + seed));
    const w = lerp(w0, w1, s) * tw / 2;
    L.push(add(cl[i], mul(nr, w))); Rr.push(add(cl[i], mul(nr, -w)));
  }
  const mid = (a, i) => lerp2(a[i], a[i + 1], 0.5);
  // outline: midpoint-quadratic smoothing along both edges
  let d = `M${pt(L[0])}`;
  for (let i = 1; i < n - 1; i++) d += `Q${pt(L[i])} ${pt(mid(L, i))}`;
  d += `L${pt(L[n - 1])}L${pt(Rr[n - 1])}`;
  for (let i = n - 2; i >= 1; i--) d += `Q${pt(Rr[i])} ${pt(mid(Rr, i - 1))}`;
  d += `L${pt(Rr[0])}Z`;
  // stripes: every other pair of segments, along the same smoothed edges
  let st = '';
  for (let i = 1; i + 2 < n; i += 4) {
    const a = i, b = i + 2;
    st += `M${pt(mid(L, a - 1))}Q${pt(L[a])} ${pt(mid(L, a))}Q${pt(L[a + 1])} ${pt(mid(L, a + 1))}L${pt(mid(Rr, b - 1))}Q${pt(Rr[b - 1])} ${pt(mid(Rr, b - 2))}Q${pt(Rr[a])} ${pt(mid(Rr, a - 1))}Z`;
  }
  // knit rib: dashed centre line
  const knit = splitQ(cl.map((c, i) => lerp2(L[i], Rr[i], 0.5)));
  // fringe at the free end
  let fr = ''; const e0 = L[n - 1], e1 = Rr[n - 1], dn = norm(sub(cl[n - 1], cl[n - 2]));
  for (let k = 0; k <= 5; k++) { const p = lerp2(e0, e1, k / 5); fr += `M${pt(p)}l${f(dn[0] * 8.5 + (k - 2.5) * 0.4)} ${f(dn[1] * 8.5 + Math.sin(t * 9 + k) * 1.2)}`; }
  return { d, st, knit, fr };
}

export const detailItems = [
  ['neck', 'O', 'S-neck deformer outline, P with B key line (fixed command count)'],
  ['neck-nape-shade', 'O', 'dashed B shade line down the back of the neck'],
  ['neck-feather-flow', 'T', 'contour-feather scallops that ride on and stretch with the neck deformer'],
  ['neck-feather-flow-fine', 'T', 'second, finer staggered lane of neck flow scallops'],
  ['neck-throat-crease', 'O', 'fore-neck crease line continuing the pouch skin down the throat'],
  ['neck-rim-light', 'O', 'rim line on the sun/moon side of the neck (flips with the light)'],
  ['tail-rectrices', 'O', '5 short, square-ended rectrices rooted in the rump, angled slightly down'],
  ['tail-grey-tips', 'O', 'B grey edge band on each blunt tail tip'],
  ['tail-rachis-lines', 'T', 'feather shafts on each rectrix'],
  ['tail-upper-coverts', 'O', '2 rounded coverts overlapping the tail base'],
  ['undertail-coverts', 'O', 'fluffy undertail lobe with fold lines'],
  ['scarf-far-tail', 'O', 'far scarf end in flat far inks behind the body'],
  ['body', 'O', 'deep-chested teardrop body mass in paper-white P'],
  ['belly-halftone-band', 'T', 'narrow B band along the belly edge (STYLE-C §2.1)'],
  ['belly-halftone-dots', 'T', 'P dots over the belly band, spacing 5.2, radius fading to the edge'],
  ['rump-halftone-band', 'T', 'rump shade band with P dots'],
  ['mantle-scallops', 'T', 'mantle/back contour-feather rows, overlapping toward the tail'],
  ['flank-scallops', 'T', 'large flank feather rows'],
  ['breast-scallops', 'T', 'small breast feather rows'],
  ['rump-scallops', 'T', 'rump feather rows by the tail'],
  ['feather-shaft-ticks', 'T', 'shaft ticks inside flank feathers'],
  ['breast-buff-feathers', 'T', 'O breast feather rows: the yellowish breeding breast patch of P. onocrotalus'],
  ['belly-saddle-bulge', 'O', 'underbelly contour flattened and spread onto the saddle top (weight on the seat)'],
  ['belly-splay-tufts', 'O', 'feather tufts splaying where the belly spreads over the saddle edges'],
  ['saddle-compression-crease', 'O', 'feathers compressed where the belly sits on the saddle'],
  ['vent-fluff', 'O', 'vent fluff lines under the tail'],
  ['rim-light', 'O', 'body rim light on the sun/moon side'],
  ['collar-ruff', 'O', 'neck-base feather tips poking out below the scarf'],
  ['scarf-trailing-end', 'O', 'long scarf end streaming back, with follow-through and hop lift'],
  ['scarf-stripes', 'T', 'R/P stripes that ride on the animated ribbon'],
  ['scarf-knit-rib', 'T', 'dashed knit rib along the ribbon'],
  ['scarf-fringe', 'O', 'fringe tassels at the trailing end'],
  ['scarf-wrap', 'O', 'bulky striped wrap around the neck base'],
  ['scarf-shade-hatching', 'T', 'N hatching on the wrap underside'],
  ['scarf-hanging-end', 'O', 'short front end hanging from the knot, swinging with the ride'],
  ['scarf-fringe-cream', 'O', 'cream fringe on the hanging end'],
  ['scarf-knot', 'O', 'knot with a fold highlight'],
  ['pouch', 'O', 'amber gular pouch reaching behind the gape to the throat'],
  ['pouch-stretch-lines', 'T', 'R texture lines that stretch with the pouch sy'],
  ['pouch-throat-wrinkles', 'T', 'fine K wrinkles where the pouch folds into the throat'],
  ['pouch-sag-folds', 'T', 'small K sag folds along the pouch belly'],
  ['pouch-highlight', 'O', 'P highlight under the ramus'],
  ['pouch-rim-folds', 'O', 'scalloped attachment folds under the lower mandible'],
  ['pouch-edge-line', 'O', 'R edge line on the pouch'],
  ['bill-lower', 'O', 'thin lower mandible'],
  ['mandible-ramus-line', 'O', 'R ramus edge framing the pouch'],
  ['ramus-sheen', 'O', 'P sheen dashes on the ramus'],
  ['bill-upper', 'O', 'long flat upper mandible (128 u)'],
  ['maxillary-groove', 'O', 'lateral groove line along the upper mandible'],
  ['bill-growth-ridges', 'T', 'fine growth ridges near the bill base'],
  ['culmen-highlight', 'O', 'P highlight along the culmen'],
  ['culmen-ridge', 'O', 'R ridge line of the culmen'],
  ['tomium-line', 'O', 'R cutting-edge line'],
  ['nostril-slit', 'O', 'slit nostril near the culmen base'],
  ['bill-tip-shadow', 'O', 'B shadow under the nail'],
  ['nail-hook', 'O', 'R hooked nail overlapping the lower tip'],
  ['nail-highlight', 'O', 'P highlight on the nail'],
  ['nail-under-hook', 'O', 'N under-hook line'],
  ['head', 'O', 'skull with a sloping forehead'],
  ['facial-skin', 'O', 'bare peach facial skin around the eye, running into the bill'],
  ['cheek-feather-edge', 'O', 'scalloped feather edge over the bare skin'],
  ['chin-feathers', 'O', 'scalloped chin feathers over the gape'],
  ['forehead-feather-flecks', 'T', 'short B flecks following the forehead feather flow'],
  ['nape-edge', 'O', 'nape edge lines where the head meets the neck'],
  ['forehead-feather-point', 'O', 'feathered forehead point pressing onto the culmen base (P. onocrotalus field mark)'],
  ['gape-smile-line', 'O', 'gape line running back under the eye, turning up (content)'],
  ['smile-crease', 'O', 'small upturn at the mouth corner'],
  ['goggle-strap', 'O', 'goggle strap with stitching, around the back of the skull'],
  ['goggle-buckle', 'O', 'amber strap buckle'],
  ['goggle-lens', 'O', 'goggles pushed up on the crown (clear of face skin and forehead point)'],
  ['goggle-glint', 'O', 'P glint on the lens'],
  ['iris', 'O', 'dark red iris'],
  ['pupil', 'O', 'N pupil with saccades'],
  ['eye-highlight', 'O', 'P catch-light'],
  ['eye-glint-secondary', 'O', 'second small catch-light'],
  ['nictitating-membrane', 'O', 'pale membrane sweeping front-to-back across the eye (most blinks; not in the still count)'],
  ['upper-lid-skin', 'O', 'relaxed upper lid skin'],
  ['upper-eyelid', 'O', 'thick N upper eyelid line'],
  ['lid-corner-crinkle', 'O', 'smile crinkle at the outer eye corner'],
  ['lower-lid-skin', 'O', 'cheek skin pushing the lower lid up (smiling eye)'],
  ['lower-eyelid', 'O', 'R lower lid line (rises with the cheek: delight / focus)'],
  ['happy-closed-lid', 'O', 'upturned closed-lid arc for the swallow / delight beat (not in the still count)'],
  ['happy-cheek-crinkle', 'O', 'cheek crinkles under the happy closed eye (not in the still count)'],
  ['brow-ridge', 'O', 'feathered supraorbital brow edge: lowers for sprint focus, lifts for hop surprise'],
  ['brow-feather-tips', 'T', 'three feather tips along the brow ridge'],
  ['crest-shadow', 'O', 'B shadow under the crest'],
  ['nape-tuft', 'O', 'fluffy tuft under the crest'],
  ['crest-short-spikes', 'O', '4 short spiky crest feathers (second design)'],
  ['crest-long-strands', 'O', '5 long shaggy crest strands'],
  ['crest-shaft-lines', 'T', 'shaft lines in the long crest strands'],
].map(([name, kind, what]) => ({ id: 'pelican:' + kind + ':' + name, layer: 'pelican', kind, what }));

// ---------------------------------------------------------------- runtime
export function attach(svg) {
  const r = refs(svg, 'pb-');
  const st = {};
  const set = (el, k, val) => { if (!el) return; const key = el.getAttribute('data-ref') + k; if (st[key] !== val) { st[key] = val; if (k === 'd') el.setAttribute('d', val); else if (k === 'op') el.style.opacity = val; else if (k === 'show') el.style.display = val ? '' : 'none'; else el.setAttribute(k, val); } };
  let lastNeck = '';
  return {
    update(fr) {
      const pose = fr.pose, t = fr.t, n = pose.neck, J = pose.joints || {};
      const bj = J.body || { x: SKEL.pelvis[0], y: SKEL.pelvis[1], rot: 0 }, bsx = bj.sx ?? 1, bsy = bj.sy ?? 1;
      const toBody = p => { const q = rot([p[0] - bj.x, p[1] - bj.y], -(bj.rot || 0)); return [q[0] / bsx, q[1] / bsy]; };
      const tt = fr.reduced ? 0 : t;
      // ---- events (fallbacks when the rig does not provide the richer fields)
      let gulpTau = -1, hopTau = -1;
      for (const e of fr.events || []) { const k = t - e.t0; if (k < 0) continue; if (e.type === 'gulp' && k < 2.6) gulpTau = k; if (e.type === 'hop' && k < 2.5) hopTau = k; }
      // ---- neck: outline + riding detail (bulge from the rig's neck fields, or a local fallback)
      let bulge = null;
      if (!(n.bulgeT !== undefined) && gulpTau > 0.85 && gulpTau < 1.6) { const u = (gulpTau - 0.85) / 0.75; bulge = { at: 0.95 - 0.85 * u, amp: 5 * Math.sin(Math.PI * u) }; }
      const nk = [n.p0, n.p1, n.p2, n.p3].map(q => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(';') + (n.w0 ?? 0).toFixed(2) + (n.bulgeA ?? 0).toFixed(3) + (n.bulgeT ?? 0).toFixed(3) + (bulge ? bulge.at.toFixed(3) : '');
      if (nk !== lastNeck) {
        lastNeck = nk;
        set(r.neck, 'd', neckD(n, bulge));
        const nd = neckDetail(n, bulge);
        set(r.neckFlow, 'd', nd.flow); set(r.neckFlow2, 'd', nd.flowSmall); set(r.neckCrease, 'd', nd.crease);
        set(r.neckRimF, 'd', nd.rimF); set(r.neckRimB, 'd', nd.rimB); set(r.neckShade, 'd', nd.shade);
      }
      // ---- seat contact anchor on the exact belly ellipse
      const lo = bellyLowLocal(bj.rot || 0, bsx, bsy);
      set(r.seat, 'transform', `translate(${f(lo[0] / bsx)} ${f(lo[1] / bsy)})`);
      // ---- rim light side: follows the sun by day, the moon by night
      const lx = (fr.night > 0.5 ? fr.moon?.x : fr.sun?.x) ?? 1200;
      const front = lx > 740;
      set(r.rimF, 'show', front); set(r.neckRimF, 'show', front); set(r.rimB, 'show', !front); set(r.neckRimB, 'show', !front);
      // ---- scarf
      const spd = clamp((fr.speed ?? 1885) / 1885, 0, 1.8);
      const sc = pose.scarf;
      let cL = WRAP_DEFAULT, dAng = 0;
      if (sc && Number.isFinite(sc.x)) { cL = toBody([sc.x, sc.y]); dAng = (sc.neckAng ?? NU_ANG) - (bj.rot || 0) - NU_ANG; }
      const xfS = scarfXf(cL, dAng);
      set(r.scarfA, 'transform', xfS); set(r.scarfB, 'transform', xfS); set(r.scarfC, 'transform', xfS);
      const place = q => add(cL, rot(q, dAng));
      let nearCL, farCL, hangCL;
      if (sc && sc.tails && sc.tails[0] && sc.tails[0].a) {
        // rig tails: rider-space segment angles (deg) -> body-local chains, resampled smooth
        const chain = (p0, angs, len, k, dA = 0, dL = 1) => { const P = [p0]; let p = p0; angs.forEach((a, i) => { const aa = (a + dA * (i + 1) / angs.length - (bj.rot || 0)) * D2R; p = add(p, [Math.cos(aa) * len * dL, Math.sin(aa) * len * dL]); P.push(p); }); return resample(P, k); };
        const A = sc.tails[0], B = sc.tails[1] || sc.tails[0];
        nearCL = chain(place(TAIL0.near), A.a, A.len * 1.25, 3);
        farCL = chain(place(TAIL0.far), A.a.map((a, i) => a + 12 + 3 * Math.sin(tt * 5.1 + i)), A.len * 1.0, 3, 10);
        hangCL = chain(place(KNOT), B.a, B.len * 0.95, 3);
      } else {
        const hopA = sN => {
          if (hopTau < 0) return 0;
          const u0 = hopTau - 0.1 * sN; let a = 0;
          if (u0 > 0.15 && u0 < 0.75) { const u = (u0 - 0.15) / 0.6; a = -0.0026 * (58 * Math.PI / 0.6) * Math.cos(Math.PI * u); }
          else if (u0 >= 0.75) { const k = u0 - 0.75; a = -0.55 * Math.exp(-4 * k) * Math.sin(12 * k); }
          return -a * (0.4 + sN);
        };
        nearCL = scarfCentre(place(TAIL0.near), 150, 14, tt, spd, hopA, 0);
        farCL = scarfCentre(place(TAIL0.far), 124, 12, tt + 0.23, spd, hopA, 1.7);
        const k0 = place(KNOT), sw = (fr.reduced ? 0 : 6 * Math.sin(t * 2 * Math.PI * 0.9) * Math.min(1, spd)) - 14 * Math.min(1, spd);
        hangCL = [0, 1, 2, 3, 4].map(i => add(k0, rot([2 * i, 11.5 * i], sw * i / 4)));
        hangCL = resample(hangCL, 2);
      }
      const near = ribbon(nearCL, 17, 12, tt, 0.4);
      set(r.snFill, 'd', near.d); set(r.snStripe, 'd', near.st); set(r.snKnit, 'd', near.knit); set(r.snFringe, 'd', near.fr);
      const far = ribbon(farCL, 15, 11, tt + 0.4, 1.3);
      set(r.sfFill, 'd', far.d); set(r.sfStripe, 'd', far.st); set(r.sfFringe, 'd', far.fr);
      const hang = ribbon(hangCL, 15, 12, tt * 0.5, 2.2);
      set(r.shFill, 'd', hang.d); set(r.shStripe, 'd', hang.st); set(r.shFringe, 'd', hang.fr);
      // ---- face: closed-lid line when the eye is (nearly) shut; nictitating membrane; smile; lid pose; gaze
      const face = pose.face || {};
      const eyeSy = J.eye?.sy ?? pose.blink ?? 1;
      const squintFB = gulpTau > 0.55 && gulpTau < 1.25 && !pose.face;
      // expression: content = soft half-lid, focus = flat low lid + brow down, surprise = wide eye + brow up +
      // pupil pop, delight = closed happy arc (cheek pushes the lower lid up)
      const md = face.mood || {}, mC = md.content ?? (pose.face ? 0 : 1), mF = md.focus ?? 0, mS = md.surprise ?? 0, mD = md.delight ?? (squintFB ? 1 : 0);
      let lidA = clamp((face.lid ?? 0.14) + 0.22 * mC + 0.12 * mF - 0.3 * mS, 0, 1);
      const swallow = gulpTau > 0.95 && gulpTau < 2.3;   // the swallow + savour: eyes screw shut, happy
      const happy = lidA > 0.8 || mD > 0.6 || swallow;
      if (happy) lidA = 1;
      set(r.lid, 'show', !happy);
      set(r.lidClosed, 'show', (eyeSy < 0.4 || squintFB) && !happy); set(r.happy, 'show', happy);
      if (happy) set(r.happy, 'transform', `scale(1 ${(1 / Math.max(0.3, eyeSy)).toFixed(2)})`);   // keep the arc's curve when the slot squashes
      const lidY = lerp(-0.6, 10.5, lidA) - 1.6 * mS;
      const lidR = 6 * mF - 4 * mS;          // focus: lid flattens, front end drops
      const lidXf = `translate(0 ${lidY.toFixed(2)}) rotate(${lidR.toFixed(1)})`;
      set(r.lidSkin, 'transform', lidXf); set(r.lid, 'transform', lidXf);
      set(r.lowLid, 'transform', `translate(0 ${(-(2.6 * (happy ? 1 : mD) + 1.4 * mF + 0.5 * mC) + 0.8 * mS).toFixed(2)})`);
      const nict = face.nict ?? 0;
      set(r.nictG, 'show', nict > 0.02);
      if (nict > 0.02) set(r.nict, 'transform', `translate(${(12 * (1 - nict)).toFixed(2)} 0)`);
      const smile = face.smile ?? 0.4, brow = face.brow ?? 0.1;
      set(r.smile, 'transform', `rotate(${(-16 * (smile - 0.4)).toFixed(1)} 2.6 -1.4)`);
      set(r.brow, 'transform', `translate(0 ${(-2.6 * brow + 1.2 * mF).toFixed(2)}) rotate(${(-7 * brow + 5 * mF).toFixed(1)} 1 -12)`);
      let px, py;
      if (pose.gaze && Number.isFinite(pose.gaze.x)) { px = -0.6 + 2.2 * pose.gaze.x; py = 1.5 * pose.gaze.y; }
      else {
        const slot = Math.floor(t / 2.1), fracS = t / 2.1 - slot;
        const targ = q => { const a = Math.sin(q * 12.9898) * 43758.5453; const u = a - Math.floor(a); return [[0.9, -0.4], [1.2, -1], [-0.8, -0.5], [0.4, 0.5]][Math.floor(u * 4)]; };
        const A0 = targ(slot - 1), A1 = targ(slot), k = sstep(0, 0.07, fracS);
        px = lerp(A0[0], A1[0], k); py = lerp(A0[1], A1[1], k);
      }
      const ps = face.pupil ?? 1;
      set(r.pupil, 'transform', `translate(${clamp(px, -1.6, 1.6).toFixed(2)} ${clamp(py, -1.5, 1.5).toFixed(2)})${Math.abs(ps - 1) > 0.01 ? ` scale(${ps.toFixed(2)})` : ''}`);
      // ---- crest: two strand groups lag differently (rig crestBend = [mid, tip] degrees)
      const cb = pose.crestBend || [0, 0];
      set(r.crestShort, 'transform', `rotate(${(0.7 * cb[0]).toFixed(2)})`);
      set(r.crestLong, 'transform', `rotate(${(0.6 * cb[0] + 0.6 * cb[1]).toFixed(2)})`);
      // ---- gulp: fish silhouette in the pouch (head to the throat), drips off the bill; backlit pouch glow
      const fish = pose.fish;
      let fishOp, fishRot, drip;
      if (fish) { fishOp = fish.inPouch ?? 0; fishRot = fish.pouchRot ?? 180; drip = fish.drip ?? 0; }
      else { fishOp = gulpTau > 0.3 && gulpTau < 1.0 ? 1 - sstep(0.8, 1.0, gulpTau) : 0; fishRot = 20 + 160 * sstep(0.3, 0.9, gulpTau); drip = gulpTau > 0.25 && gulpTau < 1.0 ? 1 : 0; }
      set(r.pouchFish, 'show', fishOp > 0.5);
      if (fishOp > 0.5) { const u = clamp((fishRot - 20) / 160, 0, 1); set(r.pouchFish, 'transform', `translate(${(lerp(52, 8, u)).toFixed(1)} ${(lerp(13, 16, u)).toFixed(1)}) rotate(${fishRot.toFixed(1)})`); }
      set(r.drips, 'show', drip > 0.5);
      if (drip > 0.5) for (let i = 0; i < 3; i++) { const u = ((t * 2.6 + i * 0.37) % 1); set(r['drip' + i], 'transform', `translate(0 ${(u * u * 24).toFixed(1)})`); }
      const sunE = fr.sun?.elev ?? 0.3;
      const backlit = (fr.night || 0) < 0.5 && sunE < 0.24 && sunE > -0.06;     // low sun behind the rider: brighter ink pair
      set(r.pouchGlow, 'show', backlit || fishOp > 0.5);
    },
  };
}
