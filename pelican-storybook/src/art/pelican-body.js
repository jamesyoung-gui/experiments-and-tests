// OWNER: pelican-body. Slots: neck, tail, body, pouch, billLower, billUpper, head, eye, crest (+ the knitted scarf,
// drawn inside the body slot). Style B (warm storybook gouache, docs/STYLE-B.md §3): warm-white plumage with rose-grey
// glazes, painted scallop feathers, a warm-brown hand-inked outline, a peach bill with a red hooked nail, a yellow
// textured pouch, a pink bare face with a rosy blush and a kind dark eye, and a red-and-cream knitted scarf.
//
// PERFORMANCE RULE (STYLE-B §2): no filters anywhere in these slots (they move every frame). The hand-made look is
// BAKED INTO THE GEOMETRY at build time, deterministically (seeded):
//   · hand-drawn outlines: contours are resampled and displaced along their normals by smooth seeded value noise;
//   · brush-weight ink: tapered, variable-width FILLED strokes (brush()) on the shadow side of each silhouette;
//   · pencil double lines: a second, thinner, offset, low-opacity stroke along the back of the body, neck and head;
//   · dry-brush edges: short tapered strokes along the inner edge of each glaze;
//   · gouache texture: small static <pattern>s (plumage mottling, pouch stipple, knit stitches) in slot-local space,
//     so the texture rides with the part.
// Each slot is drawn in its joint-local frame (see CONTRACT.md "Slots"). Everything static is built once as markup;
// update() only rewrites the neck + scarf ribbons (fixed command counts) and toggles a few opacities/transforms.
import { fmt2 } from '../core/math.js';
import { h, refs } from '../core/svg.js';
import { SKEL } from '../contract.js';
import { gouacheTile, glazeGrads, glaze as gz } from './gouache.js';

export const id = 'pelican-body';
// Extra base colours of the storybook costume and face (graded by light like the core materials).
export const materials = {
  pbBlush: '#F2938C', pbScarf: '#D8443A', pbScarfLo: '#A82E2E', pbCream: '#FBE3B8', pbInkSoft: '#8A5A48',
  pbBrass: '#D9A441', pbLeather: '#7A4A2A', pbLens: '#A8D4CF', pbPouchHi: '#FFE08A',
};

// ---------------------------------------------------------------- helpers (pure)
const D2R = Math.PI / 180;
const f = fmt2;   // = String(Math.round(x * 100) / 100), fast (core/math.js)
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
function rng(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
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
// midpoint-quadratic smoothing of a closed polygon: fixed command count (M + Q×n + Z)
function qclosed(p) {
  const n = p.length, m = i => lerp2(p[i % n], p[(i + 1) % n], 0.5);
  let d = `M${pt(m(n - 1))}`;
  for (let i = 0; i < n; i++) d += `Q${pt(p[i])} ${pt(m(i))}`;
  return d + 'Z';
}
// Catmull-Rom resample of a polyline (k samples per span)
function resample(P, k, closed = false) {
  const out = [], n = P.length, g = i => closed ? P[(i + n) % n] : P[Math.max(0, Math.min(n - 1, i))];
  const m = closed ? n : n - 1;
  for (let i = 0; i < m; i++) for (let j = 0; j < k; j++) {
    const t = j / k, t2 = t * t, t3 = t2 * t, p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
    const cr = c => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3);
    out.push([cr(0), cr(1)]);
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
// a closed contour as short pieces (see splitQ): the outline stroke never 'covers' what is inside it
const loopQ = P => splitQ([...P, P[0], P[1]].map((p, i, a) => i === a.length - 1 ? lerp2(a[i - 1], p, 0.5) : p));
// smooth seeded 1-D value noise in [-1, 1]
function noise1(seed) {
  const r = rng(seed), g = Array.from({ length: 64 }, () => r() * 2 - 1);
  return x => { const i = Math.floor(x), fr = x - i, a = g[((i % 64) + 64) % 64], b = g[(((i + 1) % 64) + 64) % 64], s = fr * fr * (3 - 2 * fr); return a + (b - a) * s; };
}
// HAND-DRAWN contour: resample (k per span) and push every point along its normal by amp·noise(arc length / lam).
function hand(pts, { k = 2, amp = 0.8, lam = 9, seed = 1, closed = true } = {}) {
  const R = resample(pts, k, closed); if (closed) R.pop();
  const nz = noise1(seed), n = R.length; let s = 0;
  return R.map((p, i) => {
    if (i) s += Math.hypot(p[0] - R[i - 1][0], p[1] - R[i - 1][1]);
    const a = R[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], b = R[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    return add(p, mul(perp(norm(sub(b, a))), amp * nz(s / lam)));
  });
}
// BRUSH stroke: a tapered, variable-width filled shape along an open polyline (the gouache/ink brush weight).
function brush(pts, w, { k = 3, seed = 1, t0 = 0.2, t1 = 0.25, amp = 0.28, min = 0.12 } = {}) {
  const C = resample(pts, k), n = C.length, nz = noise1(seed), L = [], Rr = [];
  for (let i = 0; i < n; i++) {
    const s = i / (n - 1), d = norm(sub(C[Math.min(n - 1, i + 1)], C[Math.max(0, i - 1)])), nn = perp(d);
    const tp = Math.min(1, s / t0, (1 - s) / t1), ww = w * (min + (1 - min) * Math.sqrt(Math.max(0, tp))) * (1 + amp * nz(i * 0.55)) / 2;
    L.push(add(C[i], mul(nn, ww))); Rr.push(add(C[i], mul(nn, -ww)));
  }
  return smooth([...L, ...Rr.reverse()], true, 1 / 7);
}
// painted feather: a crescent (outer arc bulging toward u by depth, inner arc shallower) as a filled brush mark
function crescent(a, b, u, depth, inner = 0.38) {
  const m = lerp2(a, b, 0.5), q = add(m, mul(u, depth * 2)), q2 = add(m, mul(u, depth * 2 * inner));
  return `M${pt(a)}Q${pt(q)} ${pt(b)}Q${pt(q2)} ${pt(a)}Z`;
}
const line = (d, stroke, w, extra = {}) => h('path', { d, fill: 'none', stroke, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...extra });

// ---------------------------------------------------------------- neck deformer (pure; also used by the baker)
// Cubic Bézier centreline (rig-spec §2); width w0 -> w1. Optional bulge {at: 0..1, amp} for the gulp.
// The hand-drawn wobble is a fixed function of the neck parameter t (not of time), so the outline never boils.
const wobF = t => 0.42 * Math.sin(19 * t + 0.7) + 0.26 * Math.sin(37 * t + 2.1);
const wobB = t => 0.5 * Math.sin(23 * t + 1.9) + 0.3 * Math.sin(41 * t + 0.3);
function neckSamples(n, N, bulge) {
  const B = (t, a, b, c, d) => (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t * t * c + t ** 3 * d;
  const Bd = (t, a, b, c, d) => 3 * (1 - t) ** 2 * (b - a) + 6 * (1 - t) * t * (c - b) + 3 * t * t * (d - c);
  const C = [], T = [], W = [], WF = [], WB = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    C.push([B(t, n.p0[0], n.p1[0], n.p2[0], n.p3[0]), B(t, n.p0[1], n.p1[1], n.p2[1], n.p3[1])]);
    T.push(norm([Bd(t, n.p0[0], n.p1[0], n.p2[0], n.p3[0]), Bd(t, n.p0[1], n.p1[1], n.p2[1], n.p3[1])]));
    // slight throat fullness under the head + taper; bulge for the gulp
    let w = (n.w0 + (n.w1 - n.w0) * t) / 2 + 1.6 * Math.sin(Math.PI * t) ** 2;
    const bg = bulge || (n.bulgeA > 0 ? { at: n.bulgeT, amp: (n.bulgeW ?? 13 * n.bulgeA) / 2 } : null);
    if (bg && bg.amp > 0) w += bg.amp * Math.exp(-(((t - bg.at) / 0.1) ** 2));
    W.push(w); WF.push(w + wobF(t)); WB.push(w + wobB(t));
  }
  return { C, T, W, WF, WB };
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
  const { C, T, WF, WB } = neckSamples(n, 9, bulge);
  const F = C.map((c, i) => add(c, mul(perp(T[i]), WF[i]))), Bk = C.map((c, i) => add(c, mul(perp(T[i]), -WB[i]))).reverse();
  return `M${pt(F[0])}${openCubic(F)}L${pt(Bk[0])}${openCubic(Bk)}Z`;
}
// Painted feather flow + nape glaze + throat crease + pencil line + rim lines that ride on the deformer (fixed counts).
function neckDetail(n, bulge) {
  const N = 13, { C, T, WF, WB } = neckSamples(n, N, bulge);
  const at = (tt, sgn, inset) => {
    const x = clamp(tt, 0, 1) * (N - 1), k = Math.min(N - 2, Math.floor(x)), fr = x - k;
    const c = lerp2(C[k], C[k + 1], fr), tn = norm(lerp2(T[k], T[k + 1], fr)), w = sgn > 0 ? lerp(WF[k], WF[k + 1], fr) : lerp(WB[k], WB[k + 1], fr);
    return { p: add(c, mul(perp(tn), sgn * (w - inset))), c, tn, w };
  };
  // painted scallops: crescents overlapping downward (toward the body), two staggered lanes
  let flow = '', flowSmall = '';
  for (let i = 3; i < N - 1; i++) {
    for (const [o, s, lane] of [[-0.4, 0.34, 0], [0.18, 0.3, 1]]) {
      const tt = (i + (lane ? 0.5 : 0)) / (N - 1); if (tt > (N - 1.5) / (N - 1)) continue;
      const { c, tn, w } = at(tt, 1, 0), u = mul(tn, -1), nr = perp(tn), cc = add(c, mul(nr, o * w));
      const a = add(cc, mul(nr, -s * w)), b = add(cc, mul(nr, s * w));
      if (lane) flowSmall += `M${pt(a)}Q${pt(add(lerp2(a, b, 0.5), mul(u, 3.2)))} ${pt(b)}`;
      else flow += crescent(a, b, u, 1.5 + 0.05 * w, 0.3);
    }
  }
  const side = (sgn, inset, t0, t1, M = 9) => { const p = []; for (let i = 0; i < M; i++) p.push(at(lerp(t0, t1, i / (M - 1)), sgn, inset).p); return p; };
  // nape glaze: a rose-grey band inside the back edge whose inner edge swells and thins like a loaded brush
  const outer = side(-1, 1.1, 0.12, 0.96, 11);
  const inner = []; for (let i = 10; i >= 0; i--) { const u = i / 10; inner.push(at(lerp(0.12, 0.96, u), -1, 1.1 + (3.2 + 4.4 * Math.sin(Math.PI * u) ** 0.7) * (1 + 0.18 * Math.sin(u * 17)) ).p); }
  const pencil = side(-1, -1.9, 0.18, 0.8, 9);
  return {
    flow, flowSmall,
    crease: splitQ(side(1, 4.2, 0.22, 0.66)),
    rimF: splitQ(side(1, 2.6, 0.3, 0.84)),
    rimB: splitQ(side(-1, 2.6, 0.3, 0.9)),
    shade: qclosed([...outer, ...inner]),
    pencil: splitQ(pencil),
  };
}

// ---------------------------------------------------------------- static geometry
// Body (pelvis-local): the spec ellipse (centre (32,-50), rx 98, ry 58, rot −18°) warped into the pelican shape: a
// DEEP chest that hangs forward under the neck, a LONG, nearly straight back that runs down to the tail, a tapering
// rump. The belly band that sits on the saddle is left exactly on the ellipse (the rig's seat contact).
function bodyPoly() {
  const pts = [];
  for (let i = 0; i < 48; i++) {
    const t = i / 48 * Math.PI * 2; let ex = 98 * Math.cos(t), ey = 58 * Math.sin(t);
    const deg = (t / D2R) % 360;
    const m = 1 - sstep(55, 85, deg) * (1 - sstep(150, 180, deg));        // 0 on the saddle contact band
    const back = Math.max(0, -Math.cos(t)), breast = Math.max(0, Math.cos(t)) * Math.max(0, Math.sin(t));
    const top = Math.max(0, -Math.sin(t));
    ey *= 1 - 0.34 * back * back * m;                                     // tapering rump
    ex *= 1 + (0.1 * back + 0.07 * breast) * m;                           // long back, chest pushed forward
    ey *= 1 + 0.1 * breast * m;                                           // deep chest
    if (Math.sin(t) < 0) ey *= 1 - 0.1 * Math.max(0, -Math.cos(t)) - 0.05 * top * Math.max(0, Math.cos(t));   // long flat back line
    const p = rot([ex, ey], -18); pts.push([32 + p[0], -50 + p[1]]);
  }
  return pts;
}
// lowest belly point (pelvis-local) for a body rotation, on the exact spec ellipse (matches rig bellyLow)
let BELLY_E = null;
function bellyLowLocal(bodyRot, sx = 1, sy = 1) {
  if (!BELLY_E) { BELLY_E = []; for (let d = 70; d <= 170; d += 0.5) { const t = d * D2R; BELLY_E.push(rot([98 * Math.cos(t), 58 * Math.sin(t)], -18)); } }
  const c = Math.cos(bodyRot * D2R), sn = Math.sin(bodyRot * D2R);
  let by = 0, bx0 = 0, by0 = 0, has = false;
  for (let i = 0; i < BELLY_E.length; i++) {
    const e = BELLY_E[i], qx = (32 + e[0]) * sx, qy = (-50 + e[1]) * sy, y = qx * sn + qy * c;
    if (!has || y > by) { has = true; by = y; bx0 = qx; by0 = qy; }
  }
  return [bx0, by0];
}
const EL = (e, g) => { const p = rot([e * 98, g * 58], -18); return [32 + p[0], -50 + p[1]]; };   // ellipse param -> body-local

// scarf wrap frame (body-local), from the neck base and the rig's first neck control offset (30,-58)
const NB = SKEL.neckBase, NU = norm([30, -58]), NN = perp(NU);   // NU along the neck (up), NN across (toward the front)
const WRAP_DEFAULT = add(NB, mul(NU, 18)), NU_ANG = Math.atan2(NU[1], NU[0]) / D2R;
const W_ = (a, b) => add(mul(NN, a), mul(NU, b));  // across, along (canonical)
const KNOT = W_(12, -3);
const TAIL0 = { near: W_(-17, 1), far: W_(-13, 6) };
const scarfXf = (c, dAng) => `translate(${f(c[0])} ${f(c[1])}) rotate(${f(dAng)})`;
const XF0 = scarfXf(WRAP_DEFAULT, 0);

// ---------------------------------------------------------------- static textures (defs; slot-local user space)
function textures(v) {
  const S = v('plumeShade'), Dp = v('plumeDeep'), P = v('plume'), Od = v('pouchDeep');
  // plumage gouache: soft rose-grey blotches + paper speckles, wrapped so the 60-unit tile has no seams
  const r = rng(71); let blot = '', spk = '';
  const T = 60;
  for (let i = 0; i < 16; i++) {
    const cx = r() * T, cy = r() * T, rx = 5 + r() * 9, ry = rx * (0.4 + r() * 0.4), a = r() * 180, op = 0.1 + r() * 0.14;
    for (const dx of [-T, 0, T]) for (const dy of [-T, 0, T]) {
      if (cx + dx + rx < 0 || cx + dx - rx > T || cy + dy + rx < 0 || cy + dy - rx > T) continue;
      blot += h('ellipse', { cx: f(cx + dx), cy: f(cy + dy), rx: f(rx), ry: f(ry), transform: `rotate(${f(a)} ${f(cx + dx)} ${f(cy + dy)})`, fill: i % 3 ? S : Dp, opacity: f(op * (i % 3 ? 1 : 0.6)) });
    }
  }
  for (let i = 0; i < 16; i++) spk += `M${f(r() * T)} ${f(r() * T)}h0`;
  let brushL = '';
  for (let i = 0; i < 6; i++) { const x = r() * T, y = r() * T, a = -20 + r() * 40; const d = rot([4 + r() * 3, 0], a); brushL += `M${f(x)} ${f(y)}l${f(d[0])} ${f(d[1])}`; }
  const gouache = h('pattern', { id: 'pb-gouache', patternUnits: 'userSpaceOnUse', width: T, height: T }, blot,
    line(brushL, S, 1.1, { opacity: 0.5 }), line(spk, P, 1.6, { opacity: 0.9 }));
  // pouch stipple: fine deep-orange dots and short skin-wrinkle ticks
  const r2 = rng(83); let st = '', tk = '';
  for (let i = 0; i < 22; i++) st += `M${f(r2() * 24)} ${f(r2() * 18)}h0`;
  for (let i = 0; i < 5; i++) { const x = r2() * 24, y = r2() * 18; tk += `M${f(x)} ${f(y)}q1.6 ${f(0.6 + r2())} 3.4 0`; }
  const pouchTex = h('pattern', { id: 'pb-pouchTex', patternUnits: 'userSpaceOnUse', width: 24, height: 18 },
    line(st, Od, 0.9, { opacity: 0.7 }), line(tk, Od, 0.6, { opacity: 0.55 }));
  // knit stitches (stocking stitch "V" columns) for the scarf wrap and knot
  const knit = h('pattern', { id: 'pb-knit', patternUnits: 'userSpaceOnUse', width: 4.4, height: 3.6, patternTransform: `rotate(${f(NU_ANG + 90)})` },
    line('M0.4 0.3L2.2 3.1L4 0.3', v('pbScarfLo'), 0.8, { opacity: 0.75 }));
  const blush = h('radialGradient', { id: 'pb-blushG' },
    h('stop', { offset: 0, 'stop-color': v('pbBlush'), 'stop-opacity': 0.95 }), h('stop', { offset: 0.5, 'stop-color': v('pbBlush'), 'stop-opacity': 0.6 }),
    h('stop', { offset: 1, 'stop-color': v('pbBlush'), 'stop-opacity': 0 }));
  // gouache director: a bolder painted-blotch tile (pigment pooled darker / lifted paler, dry-brush drags, flecks) and
  // soft radial glazes (wet-in-wet shading without filters) shared by every slot of this module
  const gw = gouacheTile('pb-gw', { size: 72, seed: 5, dark: Dp, light: '#FFFDF7', kd: 0.11, kl: 0.3, nBlot: 12, nStroke: 9, nFleck: 18, ang: -24 });
  const gwY = gouacheTile('pb-gwY', { size: 40, seed: 9, dark: Od, light: v('pbPouchHi'), kd: 0.16, kl: 0.34, nBlot: 9, nStroke: 6, nFleck: 10, ang: 8 });
  const gz = glazeGrads('pb', { shade: Dp, rose: S, warm: v('rim'), lite: '#FFFDF6', pLo: Od, pHi: v('pbPouchHi'), bill: v('billEdge') });
  return gouache + pouchTex + knit + blush + gw + gwY + gz;
}

export function build({ v }) {
  const P = v('plume'), S = v('plumeShade'), Dp = v('plumeDeep'), N = v('flight'), K = v('bill'), Ks = v('skin'), O = v('pouch'), Od = v('pouchDeep');
  const Nl = v('billNail'), Ke = v('billEdge'), INK = v('ink'), SOFT = v('pbInkSoft');
  const SC = v('pbScarf'), SCL = v('pbScarfLo'), CR = v('pbCream');
  const RIM = v('rim');
  const KW = 2.1;
  const tag = (kind, name) => `pelican:${kind}:${name}`;
  const s = {};

  // ================================================================ NECK (rider space; deformer)
  s.neck = h('g', { 'data-detail': tag('O', 'neck') },
    h('path', { 'data-ref': 'pb-neck', d: '', fill: P, stroke: INK, 'stroke-width': KW, 'stroke-linejoin': 'round' }),
    h('path', { 'data-ref': 'pb-neckGw', 'data-detail': tag('T', 'neck-gouache-blotch-texture'), class: 'gw-tex', d: '', fill: 'url(#pb-gw)', 'pointer-events': 'none' }),
    h('path', { 'data-ref': 'pb-neckShade', 'data-detail': tag('T', 'neck-nape-glaze'), d: '', fill: S, opacity: 0.9 }),
    h('path', { 'data-ref': 'pb-neckRimF', 'data-detail': tag('O', 'neck-rim-light'), d: '', fill: 'none', stroke: RIM, 'stroke-width': 2.2, 'stroke-linecap': 'round', style: 'opacity:var(--pb-n-rimAlpha)' }),
    h('path', { 'data-ref': 'pb-neckRimB', d: '', fill: 'none', stroke: RIM, 'stroke-width': 2.2, 'stroke-linecap': 'round', style: 'opacity:var(--pb-n-rimAlpha);display:none' }),
    h('path', { 'data-ref': 'pb-neckFlow', 'data-detail': tag('T', 'neck-painted-scallops'), d: '', fill: S }),
    h('path', { 'data-ref': 'pb-neckFlow2', 'data-detail': tag('T', 'neck-feather-flecks'), d: '', fill: 'none', stroke: Dp, 'stroke-width': 0.9, 'stroke-linecap': 'round' }),
    h('path', { 'data-ref': 'pb-neckCrease', 'data-detail': tag('O', 'neck-throat-crease'), d: '', fill: 'none', stroke: SOFT, 'stroke-width': 1.1, 'stroke-linecap': 'round' }),
    h('path', { 'data-ref': 'pb-neckPencil', 'data-detail': tag('T', 'neck-pencil-line'), d: '', fill: 'none', stroke: INK, 'stroke-width': 0.8, 'stroke-linecap': 'round', opacity: 0.4 }),
  );

  // ================================================================ TAIL (tail-local: pivot at the rump, feathers along −x)
  // A short, rounded pelican tail: 5 painted rectrices with rose-grey tips, rooted inside the rump (the body slot draws
  // over the roots) and angled a little down; coverts on top, a fluffy undertail lobe below.
  {
    const TILT = -17;
    const fan = [[-8, 42, -6.5], [-3.5, 46, -3.2], [1, 48, 0], [5.5, 46, 3.2], [10, 41, 6.5]];
    let feathers = '', tips = '', shafts = '', splits = '';
    fan.forEach(([ang0, L, yb], j) => {
      const ang = ang0 + TILT, dir = rot([-1, 0], ang), nr = perp(dir), b = [8, yb];
      const at = (u, w) => add(add(b, mul(dir, u)), mul(nr, w)), w = 4.6;
      const o = hand([at(0, -w), at(L * 0.5, -w * 1.04), at(L - 2, -w * 0.96), at(L, -w * 0.5), at(L + 0.6, 0), at(L, w * 0.5), at(L - 2, w * 0.96), at(L * 0.5, w * 1.04), at(0, w)], { k: 2, amp: 0.35, lam: 5, seed: 30 + j });
      feathers += h('path', { d: smooth(o, true, 1 / 8), fill: P, stroke: INK, 'stroke-width': 1.4, 'stroke-linejoin': 'round' });
      tips += `M${pt(at(L - 9, -w * 0.9))}Q${pt(at(L - 6, 0))} ${pt(at(L - 10, w * 0.9))}L${pt(at(L - 1.6, w * 0.88))}Q${pt(at(L + 0.6, 0))} ${pt(at(L - 1.6, -w * 0.88))}Z`;
      shafts += `M${pt(at(L * 0.4, 0.2))}Q${pt(at(L * 0.7, -0.5))} ${pt(at(L - 4, 0))}`;
      splits += `M${pt(at(L + 0.2, w * 0.25))}l${pt(mul(dir, -3.2))}`;
    });
    let cv = '';
    for (const [x, y, L, w, sd] of [[2, -7, 17, 5.6, 41], [0, -1.5, 15, 5.4, 42]]) {
      const q = p => add([x, y], rot(p, TILT));
      const d = smooth(hand([q([2, -w * 0.8]), q([-L * 0.5, -w * 0.85]), q([-L, 0.3]), q([-L * 0.5, w * 0.8]), q([2, w * 0.8])], { k: 2, amp: 0.3, lam: 5, seed: sd }));
      cv += h('path', { d, fill: P, stroke: INK, 'stroke-width': 1.3, 'stroke-linejoin': 'round' });
    }
    const uq = p => rot(p, TILT);
    const ut = smooth(hand([[12, 8], [2, 11.5], [-8, 14], [-14, 12.5], [-9, 9], [2, 6]].map(uq), { k: 2, amp: 0.45, lam: 4, seed: 44 }));
    s.tail = h('g', { 'data-detail': tag('O', 'tail-rectrices') }, feathers,
      h('path', { 'data-detail': tag('O', 'tail-rose-tips'), d: tips, fill: S }),
      line(shafts, Dp, 0.8, { 'data-detail': tag('T', 'tail-rachis-lines') }),
      line(splits, SOFT, 0.7, { 'data-detail': tag('T', 'tail-tip-splits') }),
      h('g', { 'data-detail': tag('O', 'tail-upper-coverts') }, cv),
      h('g', { 'data-detail': tag('O', 'undertail-coverts') }, h('path', { d: ut, fill: P, stroke: INK, 'stroke-width': 1.3, 'stroke-linejoin': 'round' }),
        line(`M${pt(uq([0, 9.5]))}Q${pt(uq([-5, 11.2]))} ${pt(uq([-9, 11.6]))}M${pt(uq([4, 8]))}q-2 1.8 -4.6 2.4`, S, 1.2)));
  }

  // ================================================================ BODY (pelvis-local) + SCARF
  {
    const poly = bodyPoly();
    const WB = hand(poly, { k: 2, amp: 0.9, lam: 11, seed: 11 });      // hand-drawn silhouette (96 points)
    const nW = WB.length, tOf = i => i / nW * 360;                    // point index -> ellipse angle (deg)
    const cx = 32, cy = -50;
    const toC = (p, k) => { const d = sub([cx, cy], p), l = Math.hypot(...d); return add(p, mul(d, k / l)); };   // k units toward the centre
    const range = (a0, a1) => WB.filter((p, i) => { const t = tOf(i); return a0 <= a1 ? t >= a0 && t <= a1 : t >= a0 || t <= a1; });
    const o = smooth(WB);
    let b = '';
    // far scarf tail, behind the body mass (far glazes)
    b += h('g', { 'data-detail': tag('O', 'scarf-far-tail') },
      h('path', { 'data-ref': 'pb-sfFill', d: '', fill: SCL, stroke: INK, 'stroke-width': 1 }),
      h('path', { 'data-ref': 'pb-sfStripe', d: '', fill: CR, opacity: 0.6 }),
      h('path', { 'data-ref': 'pb-sfFringe', d: '', fill: 'none', stroke: CR, 'stroke-width': 1.8, 'stroke-linecap': 'round', opacity: 0.6 }));
    let inner = '';
    // gouache mottling over the whole mass
    inner += h('path', { 'data-detail': tag('T', 'plumage-gouache-mottle'), d: smooth(WB.map(p => toC(p, 1))), fill: 'url(#pb-gouache)', opacity: 0.75 });
    // --- rose-grey glazes: the underside + rump in shadow, painted as two layered washes with dry-brush inner edges
    const nzG = noise1(5);
    const glaze = (depthOf, a0, a1, jit) => {
      const out = [], inn = [];
      for (let i = 0; i < nW; i++) {
        const t = tOf(i); if (!(t >= a0 && t <= a1)) continue;
        const dpt = depthOf(t); out.push(toC(WB[i], -2)); inn.push(toC(WB[i], Math.max(0.5, dpt * (1 + jit * nzG(i * 0.9)))));
      }
      return { d: smooth([...out, ...inn.reverse()], true, 1 / 7), inn };
    };
    const lowD = t => { const s1 = Math.max(0, Math.sin(t * D2R)); const rump = 13 * Math.exp(-(((t - 188) / 30) ** 2)); return 21 * s1 ** 0.75 + rump; };
    const g1 = glaze(lowD, 6, 238, 0.22);
    const g2 = glaze(t => 0.42 * lowD(t) - 1.5, 30, 230, 0.3);
    inner += h('path', { 'data-detail': tag('T', 'belly-rose-glaze'), d: g1.d, fill: S, opacity: 0.92 });
    inner += h('path', { 'data-detail': tag('T', 'belly-deep-glaze'), d: g2.d, fill: Dp, opacity: 0.5 });
    // wet-in-wet: soft rose shade pooled under the belly and round the rump, a cool glaze under the wing, a warm lit
    // back, then the painted-blotch tile over everything (visible brush direction, pigment variation)
    inner += h('g', { 'data-detail': tag('T', 'body-wet-in-wet-glazes') },
      gz('pb', 'shade', ...EL(-0.05, 0.72), 88, 30, -18, 0.42), gz('pb', 'rose', ...EL(-0.72, 0.3), 42, 40, -18, 0.55),
      gz('pb', 'shade', ...EL(0.35, 0.1), 60, 34, -30, 0.28), gz('pb', 'rose', ...EL(0.8, 0.45), 34, 28, 0, 0.35),
      gz('pb', 'warm', ...EL(0.05, -0.7), 90, 22, -18, 0.5), gz('pb', 'lite', ...EL(0.45, -0.45), 50, 26, -18, 0.8));
    inner += h('path', { 'data-detail': tag('T', 'body-gouache-blotch-texture'), class: 'gw-tex', d: o, fill: 'url(#pb-gw)' });
    {
      // dry-brush: short tapered strokes feathering up out of the glaze edge
      let d = ''; const r = rng(17);
      g1.inn.forEach((p, i) => {
        if (i % 3 || i < 2 || i > g1.inn.length - 3) return;
        const up = norm(sub([cx, cy], p)), sd = perp(up), L = 5 + r() * 5, q = add(p, add(mul(up, L), mul(sd, (r() - 0.5) * 3)));
        d += brush([add(p, mul(up, -1.5)), lerp2(p, q, 0.55), q], 2.4 + r(), { k: 2, seed: 200 + i, t0: 0.1, t1: 0.7, amp: 0.2 });
      });
      inner += h('path', { 'data-detail': tag('T', 'belly-drybrush-edge'), d, fill: S });
    }
    // --- painted scallop feathers (crescent brush marks overlapping back-and-down toward the tail), per tract
    const DOWN = norm(rot([0.35, 1], -18)), BACK = norm(rot([-1, 0], -18));
    const U = norm(add(mul(DOWN, 2), mul(BACK, 0.7)));
    const r3 = rng(23);
    const row = (g, e0, e1, n, depth, gTilt = 0, jit = 0.25) => {
      const pts = []; for (let i = 0; i <= n; i++) { const u = i / n; pts.push(EL(lerp(e0, e1, u) + (i && i < n ? (r3() - 0.5) * jit * (e1 - e0) / n : 0), g + gTilt * u)); }
      let d = '', edge = '';
      for (let i = 0; i < n; i++) {
        const dd = depth * (0.8 + r3() * 0.45), a = pts[i], c = pts[i + 1];
        d += crescent(a, c, U, dd, 0.34);
        edge += `M${pt(a)}Q${pt(add(lerp2(a, c, 0.5), mul(U, dd * 2)))} ${pt(c)}`;
      }
      return { d, edge, pts };
    };
    const rows = defs => { let d = '', e = ''; for (const a of defs) { const q = row(...a); d += q.d; e += q.edge; } return { d, e }; };
    {
      const m = rows([[-0.74, 0.34, -0.66, 8, 2.8, 0.08], [-0.55, 0.2, -0.6, 6, 3.1, 0.08], [-0.36, -0.1, -0.5, 3, 3.4, 0.06]]);
      inner += h('g', { 'data-detail': tag('T', 'mantle-scallops'), 'data-tract': 'mantle' }, h('path', { d: m.d, fill: Dp, opacity: 0.62 }), line(m.e, Dp, 0.75));
    }
    const fl = [[0.3, 0.1, -0.64, 4, 4.8, 0.04], [0.55, -0.04, -0.6, 3, 5.4, 0.02]];
    { const m = rows(fl); inner += h('g', { 'data-detail': tag('T', 'flank-scallops'), 'data-tract': 'flank' }, h('path', { d: m.d, fill: Dp, opacity: 0.75 }), line(m.e, SOFT, 0.8, { opacity: 0.55 })); }
    { const m = rows([[-0.3, -0.64, -0.92, 3, 2.4, 0.1], [-0.08, -0.62, -0.94, 3, 2.6, 0.1], [0.16, -0.62, -0.9, 3, 2.6, 0.08]]); inner += h('path', { 'data-detail': tag('T', 'rump-scallops'), 'data-tract': 'rump', d: m.d, fill: Dp, opacity: 0.7 }); }
    // breast: the soft buff wash of the breeding breast patch (P. onocrotalus), small warm feathers painted over it
    inner += h('path', { 'data-detail': tag('O', 'breast-buff-wash'), d: smooth(hand([EL(0.62, -0.78), EL(0.9, -0.62), EL(1.04, -0.2), EL(1.02, 0.18), EL(0.9, 0.08), EL(0.78, -0.3), EL(0.6, -0.58)], { k: 2, amp: 1.2, lam: 6, seed: 9 })), fill: O, opacity: 0.4 });
    { const m = rows([[-0.64, 0.96, 0.66, 4, 1.9, 0.04], [-0.47, 0.98, 0.64, 4, 2, 0.04], [-0.3, 0.99, 0.66, 4, 2, 0.03]]); inner += h('path', { 'data-detail': tag('T', 'breast-buff-feathers'), 'data-tract': 'breast', d: m.d, fill: Od, opacity: 0.55 }); }
    { const m = rows([[-0.12, 0.99, 0.7, 3, 2.1, 0.03], [0.06, 0.98, 0.72, 3, 2.2, 0.02]]); inner += h('path', { 'data-detail': tag('T', 'breast-scallops'), 'data-tract': 'breast', d: m.d, fill: Dp, opacity: 0.6 }); }
    {
      let d = '';
      for (const a of fl) { const { pts } = row(...a); for (let i = 0; i < pts.length - 1; i++) { const m = lerp2(pts[i], pts[i + 1], 0.5); d += `M${pt(add(m, mul(DOWN, -2)))}L${pt(add(m, add(mul(DOWN, a[4] * 1.1), mul(BACK, a[4] * 0.4))))}`; } }
      inner += line(d, Dp, 0.8, { 'data-detail': tag('T', 'feather-shaft-ticks') });
    }
    inner += line('M-44 6Q-30 11 -12 10.5M-36 1.5Q-26 5 -16 4.6', SOFT, 1.1, { 'data-detail': tag('O', 'saddle-compression-crease') });
    inner += line('M-68 -10Q-62 -4 -60 3M-62 -15Q-56 -11 -54 -5M-73 -4q3 3 4 7', SOFT, 1, { 'data-detail': tag('O', 'vent-fluff') });
    // rim light (sun side; switched in update), inset from the outline, in short pieces
    const frR = WB.filter((p, i) => { const a = i / nW; return a > 0.62 && a < 0.97; }).map(p => toC(p, 3));
    const bkR = WB.filter((p, i) => { const a = i / nW; return a > 0.45 && a < 0.7; }).map(p => toC(p, 3));
    // brush-weight ink accents on the shadow side (under the chest, round the rump) + a pencil double line on the back
    const accChest = range(12, 62), accRump = range(172, 222);
    const pencil = range(222, 318).map(p => toC(p, -2.2));
    b += h('g', { 'data-detail': tag('O', 'body') },
      h('path', { d: o, fill: P }),
      h('clipPath', { id: 'pb-bodyclip' }, h('path', { d: o })),
      h('g', { 'clip-path': 'url(#pb-bodyclip)' }, inner),
      line(loopQ(WB), INK, KW, { 'data-detail': tag('O', 'body-hand-inked-outline') }),
      h('path', { 'data-detail': tag('T', 'body-brush-weight-accents'), d: brush(accChest, 3.6, { seed: 61 }) + brush(accRump, 3.4, { seed: 62 }), fill: INK }),
      line(splitQ(pencil), INK, 0.85, { opacity: 0.42, 'data-detail': tag('T', 'back-pencil-line') }),
      line(splitQ(resample(frR, 1)), RIM, 2.6, { 'data-ref': 'pb-rimF', 'data-detail': tag('O', 'rim-light'), style: 'opacity:var(--pb-n-rimAlpha)' }),
      line(splitQ(resample(bkR, 1)), RIM, 2.6, { 'data-ref': 'pb-rimB', style: 'opacity:var(--pb-n-rimAlpha);display:none' }));
    // --- belly-on-saddle compression: along the saddle the belly arc is pushed down onto the saddle top (y 13) and
    // spreads a touch, so the weight visibly rests on it. Drawn over the outline, with a glaze.
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
        h('path', { d: dB, fill: S }), line(qline(low), INK, KW),
        line(`M${pt(add(ends[0], [4, -2.6]))}q-2.6 0.4 -4.6 3.2q-0.8 -2.6 -3.2 -3.4M${pt(add(ends[1], [-4, -2.2]))}q2.6 0.4 4.4 3q0.8 -2.4 3 -3.2`, INK, 1.1, { 'data-detail': tag('O', 'belly-splay-tufts') }));
    }
    // --- scarf (canonical frame, placed by update): cast shadow + collar ruff | near tail | wrap | hanging end | knot
    const wrapPts = hand([W_(-21, 10), W_(-8, 13.8), W_(8, 13.8), W_(21, 10), W_(24.5, 1), W_(21, -9), W_(8, -13.2), W_(-8, -13.2), W_(-21, -9), W_(-24.5, 1)], { k: 2, amp: 0.5, lam: 6, seed: 51 });
    const wrap = smooth(wrapPts);
    let gA = h('path', { 'data-detail': tag('O', 'scarf-cast-shadow'), d: smooth([W_(15, -10), W_(8, -12.6), W_(-8, -12.6), W_(-15, -10), W_(-16, -13), W_(-12, -17.6), W_(0, -19), W_(12, -17), W_(16, -13)].map(p => add(p, mul(NU, -2)))), fill: Dp, opacity: 0.7 });
    {
      let d = '', dl = '';
      for (let i = 0; i < 5; i++) {
        const a = -21 + i * 5.6, c = W_(a, -12.5 - (i % 2) * 1.4), u = mul(NU, -1);
        const nrm = perp(u), p0 = add(c, mul(nrm, -3.4)), p1 = add(c, mul(nrm, 3.4)), q = add(c, mul(u, 11 + (i % 2) * 2));
        d += `M${pt(add(p0, mul(u, -2)))}L${pt(p0)}Q${pt(q)} ${pt(p1)}L${pt(add(p1, mul(u, -2)))}Z`;
        dl += `M${pt(p0)}Q${pt(q)} ${pt(p1)}`;
      }
      gA += h('g', { 'data-detail': tag('O', 'collar-ruff') }, h('path', { d, fill: P }), line(dl, INK, 1.1));
    }
    b += h('g', { 'data-ref': 'pb-scarfA', transform: XF0 }, gA);
    b += h('g', { 'data-detail': tag('O', 'scarf-trailing-end') },
      h('path', { 'data-ref': 'pb-snFill', d: '', fill: SC, stroke: INK, 'stroke-width': 1.3, 'stroke-linejoin': 'round' }),
      h('path', { 'data-ref': 'pb-snStripe', 'data-detail': tag('T', 'scarf-cream-stripes'), d: '', fill: CR }),
      h('path', { 'data-ref': 'pb-snKnit', 'data-detail': tag('T', 'scarf-knit-stitches'), d: '', fill: 'none', stroke: SCL, 'stroke-width': 0.65, opacity: 0.85, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
      h('path', { 'data-ref': 'pb-snFringe', 'data-detail': tag('O', 'scarf-fringe'), d: '', fill: 'none', stroke: CR, 'stroke-width': 2, 'stroke-linecap': 'round' }));
    {
      let st = '';
      for (let a = -26; a <= 26; a += 8.5) st += `M${pt(W_(a, 18))}L${pt(W_(a + 2, -18))}`;
      const shade = smooth([W_(-24, -2), W_(-21, -9), W_(-8, -13.2), W_(8, -13.2), W_(21, -9), W_(24, -2), W_(10, -8), W_(-10, -8.4)]);
      b += h('g', { 'data-ref': 'pb-scarfB', transform: XF0 }, h('g', { 'data-detail': tag('O', 'scarf-wrap') },
        h('path', { d: wrap, fill: SC }),
        h('clipPath', { id: 'pb-wrapclip' }, h('path', { d: wrap })),
        h('g', { 'clip-path': 'url(#pb-wrapclip)' },
          line(st, CR, 4.2, { 'stroke-linecap': 'butt' }),
          h('path', { 'data-detail': tag('T', 'scarf-wrap-knit-texture'), d: wrap, fill: 'url(#pb-knit)' }),
          line(splitQ(resample([W_(-24, 9), W_(0, 12.4), W_(24, 9)], 3)) + splitQ(resample([W_(-24, -7.4), W_(0, -11.6), W_(24, -7.4)], 3)), SCL, 1.1, { 'stroke-dasharray': '0.9 1.5', 'data-detail': tag('T', 'scarf-ribbed-edges') }),
          h('path', { d: shade, fill: SCL, opacity: 0.45, 'data-detail': tag('T', 'scarf-underside-glaze') }),
          // a little darned patch: someone mended this scarf with love (cream square, red cross-stitches)
          h('g', { 'data-detail': tag('O', 'scarf-darned-patch'), transform: `translate(${pt(W_(-11, 1.5))}) rotate(${f(NU_ANG + 96)})` },
            h('path', { d: 'M-3.4 -3.1L3.5 -3.4L3.2 3.3L-3.3 3.5Z', fill: CR, stroke: INK, 'stroke-width': 0.6 }),
            line('M-2.2 -2L2.2 2.1M2.2 -2L-2 2.2M-4.2 -1.2l1.4 0.2M-4.3 1l1.4 0.1M3 -1.3l1.4 0.1M2.9 1.1l1.4 0.1', SC, 0.6))),
        line(loopQ(wrapPts), INK, 1.4)));
    }
    b += h('g', { 'data-detail': tag('O', 'scarf-hanging-end') },
      h('path', { 'data-ref': 'pb-shFill', d: '', fill: SC, stroke: INK, 'stroke-width': 1.2, 'stroke-linejoin': 'round' }),
      h('path', { 'data-ref': 'pb-shStripe', d: '', fill: CR }),
      h('path', { 'data-ref': 'pb-shKnit', d: '', fill: 'none', stroke: SCL, 'stroke-width': 0.6, opacity: 0.85, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
      h('path', { 'data-ref': 'pb-shFringe', 'data-detail': tag('O', 'scarf-fringe-cream'), d: '', fill: 'none', stroke: CR, 'stroke-width': 1.8, 'stroke-linecap': 'round' }));
    {
      const knP = hand([add(KNOT, [-7.6, -2]), add(KNOT, [-3, -7.6]), add(KNOT, [4.4, -6.6]), add(KNOT, [7.8, -0.6]), add(KNOT, [5.4, 6.4]), add(KNOT, [-1.4, 7.8]), add(KNOT, [-6.6, 4.4])], { k: 2, amp: 0.35, lam: 4, seed: 57 }), kn = smooth(knP);
      b += h('g', { 'data-ref': 'pb-scarfC', transform: XF0 }, h('g', { 'data-detail': tag('O', 'scarf-knot') },
        h('path', { d: kn, fill: SC }),
        h('clipPath', { id: 'pb-knotclip' }, h('path', { d: kn })),
        h('g', { 'clip-path': 'url(#pb-knotclip)' },
          h('path', { d: kn, fill: 'url(#pb-knit)' }),
          h('path', { d: `M${pt(add(KNOT, [-7, 3]))}Q${pt(add(KNOT, [0, 9]))} ${pt(add(KNOT, [7, 2]))}L${pt(add(KNOT, [7, 9]))}L${pt(add(KNOT, [-7, 9]))}Z`, fill: SCL, opacity: 0.5 }),
          line(`M${pt(add(KNOT, [-6, -5.4]))}Q${pt(add(KNOT, [-8.4, 1]))} ${pt(add(KNOT, [-4.6, 6.4]))}M${pt(add(KNOT, [3.6, -6.8]))}Q${pt(add(KNOT, [8, -2]))} ${pt(add(KNOT, [6, 4.6]))}`, CR, 2.2, { 'data-detail': tag('O', 'knot-cream-stripes') })),
        line(loopQ(knP), INK, 1.2),
        line(`M${pt(add(KNOT, [-4.6, -3.4]))}Q${pt(add(KNOT, [0.6, -1.6]))} ${pt(add(KNOT, [2.6, 4.6]))}`, INK, 0.9, { 'data-detail': tag('O', 'knot-fold-line') }),
        line(`M${pt(add(KNOT, [-2.8, -5.2]))}q2.6 -0.8 4.6 0.4`, P, 1.3, { opacity: 0.8, 'data-detail': tag('O', 'knot-highlight') })));
    }
    const lowP = poly.reduce((a, p) => (p[1] > a[1] ? p : a), poly[0]);
    b += h('g', { 'data-ref': 'pb-seat', 'data-anchor': 'pb-seatContact', transform: `translate(${f(lowP[0])} ${f(lowP[1])})` });
    s.body = b;
  }

  // ================================================================ POUCH (pouch-local: hangs +y under the lower mandible)
  {
    const edgeP = [[108, -3], [92, 10], [70, 21], [42, 29.6], [10, 31.5], [-14, 30.6], [-36, 25.5], [-39.4, 17], [-37, 10], [-30, 1.5]];
    const edgeW = hand(edgeP, { k: 3, amp: 0.55, lam: 7, seed: 91, closed: false });
    const po = smooth([[-26, -3], [108, -3], ...edgeW.slice(1)], true, 1 / 6);
    const deep = smooth(hand([[92, 10], [70, 21], [42, 29.6], [10, 31.5], [-14, 30.6], [-36, 25.5], [-39.4, 17], [-30, 17.4], [-10, 21], [16, 22], [42, 19.6], [66, 13.2], [84, 6]], { k: 2, amp: 1.1, lam: 5, seed: 93 }));
    const deep2 = smooth(hand([[70, 21], [42, 29.6], [10, 31.5], [-14, 30.6], [-30, 27.4], [-12, 26.6], [14, 27], [42, 24.6], [60, 19.4]], { k: 2, amp: 0.8, lam: 5, seed: 94 }));
    s.pouch = h('g', { 'data-detail': tag('O', 'pouch') },
      h('path', { d: po, fill: O }),
      h('path', { 'data-detail': tag('T', 'pouch-brush-accent'), d: brush(resample([[64, 22.6], [40, 30.8], [10, 32.6], [-16, 31.6], [-34, 26.6]], 2), 2.6, { seed: 96 }), fill: INK }),
      h('clipPath', { id: 'pb-pouchclip' }, h('path', { d: po })),
      h('g', { 'clip-path': 'url(#pb-pouchclip)' },
        h('path', { 'data-detail': tag('T', 'pouch-orange-glaze'), d: deep, fill: Od, opacity: 0.42 }),
        h('path', { d: deep2, fill: Od, opacity: 0.4 }),
        h('path', { 'data-detail': tag('T', 'pouch-stipple-texture'), d: po, fill: 'url(#pb-pouchTex)' }),
        h('g', { 'data-detail': tag('T', 'pouch-wet-in-wet-glazes') }, gz('pb', 'pLo', 20, 30, 70, 12, -4, 0.5), gz('pb', 'pLo', -32, 18, 16, 16, 0, 0.45),
          gz('pb', 'pHi', 48, 6, 58, 8, -5, 0.85), gz('pb', 'pHi', 88, 2, 22, 6, -12, 0.7)),
        h('path', { 'data-detail': tag('T', 'pouch-gouache-blotch-texture'), class: 'gw-tex', d: po, fill: 'url(#pb-gwY)' }),
        h('path', { 'data-ref': 'pb-pouchGlow', 'data-detail': tag('O', 'pouch-backlit-glow'), d: 'M-20 2C10 8 60 8 98 0C88 12 66 20 44 24C20 27 -8 26 -28 20Z', fill: v('pbPouchHi'), opacity: 0.8, style: 'display:none' }),
        h('g', { 'data-ref': 'pb-pouchFish', style: 'display:none' },
          h('path', { d: 'M18 0C13 -5.6 -1 -7 -10 -3L-20 -8.4L-17.6 0L-20 8.4L-10 3C-1 7 13 5.6 18 0Z', fill: Od, opacity: 0.75 }),
          line('M4 -4.6Q7 0 4 4.6', O, 0.9), h('circle', { cx: 12.4, cy: -1, r: 1.3, fill: O })),
        line('M-30 7C-4 14 40 16 92 3M-34 15C-6 23 36 24 76 13M-34 22C-10 29 22 30 54 23', Od, 1.2, { 'data-detail': tag('T', 'pouch-stretch-lines'), 'data-stretch': 'sy', opacity: 0.8 }),
        line('M-33 14q-1.6 4 -0.6 8M-28.4 16q-1.4 4.4 -0.4 8.6M-23.6 17.6q-1.2 4.4 0 8.6M-18.8 19q-1 4.2 0 8', SOFT, 0.9, { 'data-detail': tag('T', 'pouch-throat-wrinkles') }),
        line('M4 22q3 3 7 3M18 24q3 3 7 2.6M32 23q3 3 7 1.6M46 19.5q3 2.6 6.6 1', SOFT, 0.9, { 'data-detail': tag('T', 'pouch-sag-folds') })),
      h('path', { 'data-detail': tag('O', 'pouch-highlight'), d: brush([[14, 5], [36, 9], [60, 8.2], [86, 3.6]], 3.2, { seed: 95 }), fill: v('pbPouchHi'), opacity: 0.9 }),
      line('M-12 -1q4 3 8 0q4 3 8 0q4 3 8 0q4 3 8 0q4 3 8 0q4 3 8 0q4 3 8 0q4 3 8 0q4 3 8 0q4 2.6 8 0q4 2.2 8 0q4 2 8 0', Od, 0.9, { 'data-detail': tag('O', 'pouch-rim-folds') }),
      line(splitQ(edgeW), INK, 1.7, { 'data-detail': tag('O', 'pouch-edge-line') }));

  }

  // ================================================================ LOWER BILL (pivot at the gape; +x along the bill)
  {
    const lb = smooth(hand([[-4, -0.4], [40, -0.6], [80, -0.6], [114, -0.6], [117.6, 1.6], [115.6, 3.8], [80, 4.6], [40, 5.4], [0, 5.6], [-4.4, 2.6]], { k: 2, amp: 0.25, lam: 8, seed: 101 }));
    s.billLower = h('g', { 'data-detail': tag('O', 'bill-lower') },
      h('path', { d: lb, fill: K, stroke: INK, 'stroke-width': 1.4, 'stroke-linejoin': 'round' }),
      line('M2 4.2L112 3', Ke, 1.2, { 'data-detail': tag('O', 'mandible-ramus-line') }),
      line('M20 2.2L104 1.4', P, 0.9, { 'stroke-dasharray': '10 5', opacity: 0.75, 'data-detail': tag('O', 'ramus-sheen') }),
      h('g', { 'data-ref': 'pb-drips', style: 'display:none' },
        ...[[40, 6, 1], [76, 5, 0.8], [100, 4, 1.1]].map(([x, y, k], i) => h('path', { 'data-ref': 'pb-drip' + i, d: `M${x} ${y}c${f(-1.8 * k)} ${f(3 * k)} ${f(-1.8 * k)} ${f(5 * k)} 0 ${f(5 * k)}s${f(1.8 * k)} ${f(-2 * k)} 0 ${f(-5 * k)}Z`, fill: v('pbLens'), stroke: INK, 'stroke-width': 0.6 }))));
  }

  // ================================================================ UPPER BILL (pivot at the gape)
  {
    const ubP = hand([[-4, -13], [20, -13.4], [60, -9.8], [100, -7.1], [121, -6.7], [121.4, 3.1], [60, 3.6], [-2, 4.1], [-6.4, -4]], { k: 2, amp: 0.3, lam: 9, seed: 111 }), ub = smooth(ubP);
    const r = rng(113); let mot = '';
    for (let i = 0; i < 14; i++) { const x = 8 + r() * 100, y = -9 + r() * 10 + x * 0.03; mot += `M${f(x)} ${f(y)}l${f(3 + r() * 5)} ${f((r() - 0.5) * 0.8)}`; }
    s.billUpper = h('g', { 'data-detail': tag('O', 'bill-upper') },
      h('path', { d: ub, fill: K }),
      h('clipPath', { id: 'pb-billclip' }, h('path', { d: ub })),
      h('g', { 'clip-path': 'url(#pb-billclip)' },
        line(mot, Ke, 1.6, { opacity: 0.28, 'data-detail': tag('T', 'bill-gouache-mottling') }),
        h('path', { d: 'M-6 1.6L121 0.6L121 4L-6 5Z', fill: Ke, opacity: 0.35, 'data-detail': tag('T', 'bill-underside-glaze') }),
        h('g', { 'data-detail': tag('T', 'bill-wet-in-wet-glazes') }, gz('pb', 'bill', 70, 2, 56, 5, -2, 0.55), gz('pb', 'lite', 50, -9, 40, 3.4, 2, 0.6), gz('pb', 'bill', 6, -6, 12, 9, 0, 0.4)),
        h('path', { class: 'gw-tex', d: ub, fill: 'url(#pb-gw)', opacity: 0.8 })),
      line(loopQ(ubP), INK, 1.7, { 'data-detail': tag('O', 'bill-ink-outline') }),
      line('M-2 3.5L119 2.8', INK, 1.3, { 'data-detail': tag('O', 'tomium-line') }),
      line('M24 -0.8C56 -1 88 -1.6 116 -1.8', Ke, 0.9, { 'data-detail': tag('O', 'maxillary-groove') }),
      line('M28 -4.2l-0.8 3.2M33 -4.4l-0.8 3.3M38 -4.4l-0.8 3.3M43 -4.3l-0.8 3.2M48 -4.1l-0.7 3', Ke, 0.8, { 'data-detail': tag('T', 'bill-growth-ridges') }),
      h('g', { 'data-detail': tag('O', 'culmen-ridge') }, line('M4 -8.4C40 -7 80 -5.2 114 -4.4', Ke, 1.2),
        h('path', { 'data-detail': tag('O', 'culmen-highlight'), d: brush([[44, -10.3], [76, -8.6], [106, -7.2]], 2, { seed: 115 }), fill: P, opacity: 0.8 }),
        line('M30 -6.7Q36 -7.2 44 -6.2', INK, 1.2, { 'data-detail': tag('O', 'nostril-slit') })),
      h('path', { 'data-detail': tag('O', 'bill-tip-shadow'), d: 'M104 3.1L125 4.8C126.5 6.4 127 8 127.4 10C122 8 112 6 104 5Z', fill: Ke, opacity: 0.7 }),
      h('g', { 'data-detail': tag('O', 'nail-hook') },
        h('path', { d: 'M114 -6.6C120 -7.6 126 -7 129.6 -3.8C132.6 0.5 131.8 6 128.6 10.8C127.6 7.6 125 5.2 121 4L114 3.4Z', fill: Nl, stroke: INK, 'stroke-width': 1.3, 'stroke-linejoin': 'round' }),
        line('M119 -5.1C123.4 -5.5 127 -4 128.6 -1.2', P, 1.3, { opacity: 0.85, 'data-detail': tag('O', 'nail-highlight') }),
        line('M126.2 5.6C127.6 7 128.2 8.6 128.6 10.8', INK, 1, { 'data-detail': tag('O', 'nail-under-hook') })));
  }

  // ================================================================ HEAD (head-local, skull r≈26)
  {
    const outline = [[-26, 12], [-30.5, -3], [-25, -19], [-11, -29], [5, -30.5], [19, -25.6], [29, -17], [37, -9.6], [47.5, -4.4], [36, -3.6], [26, -1], [21, 6], [12, 14], [0, 19], [-14, 18.5]];
    const k = 2, WH = hand(outline, { k, amp: 0.55, lam: 8, seed: 121 });
    const o = smooth(WH);
    const keyPts = [...WH.slice(11 * k), ...WH.slice(0, 8 * k + 1)];
    const skin = smooth(hand([[-9, -5], [-5.5, -13], [3, -17], [13, -17.6], [22, -14], [28, -8.5], [31, -2.5], [25, 4.5], [13, 5], [4, 3.4], [-4, 1.6]], { k: 2, amp: 0.4, lam: 5, seed: 123 }));
    let inner = h('path', { d: o, fill: 'url(#pb-gouache)', opacity: 0.6, 'data-detail': tag('T', 'head-gouache-mottle') });
    inner += h('path', { 'data-detail': tag('T', 'head-nape-glaze'), d: smooth(hand([[-31, -4], [-27, 8], [-16, 17], [0, 20], [12, 15], [2, 13], [-12, 11], [-22, 3], [-26, -8]], { k: 2, amp: 0.8, lam: 4, seed: 125 })), fill: S, opacity: 0.9 });
    inner += h('path', { 'data-detail': tag('O', 'facial-skin'), d: skin, fill: Ks });
    inner += h('path', { 'data-detail': tag('T', 'orbital-skin-glaze'), d: smooth([[-3, -12], [5, -15.8], [14, -14], [17.4, -8], [14, -1.6], [6, -0.6], [-1, -4]]), fill: Ke, opacity: 0.22 });
    {
      const edge = [[-9.5, -3], [-7.4, -9.4], [-3.4, -14.2], [2.6, -17.2]];
      let d = `M-14 -1L${pt(edge[0])}`, dl = '';
      for (let i = 0; i < edge.length - 1; i++) {
        const a = edge[i], c = edge[i + 1], m = lerp2(a, c, 0.5), n = perp(norm(sub(c, a))), q = add(m, mul(n, -3.2));
        d += `Q${pt(q)} ${pt(c)}`; dl += `M${pt(a)}Q${pt(q)} ${pt(c)}`;
      }
      d += 'L0 -24L-14 -24Z';
      inner += h('g', { 'data-detail': tag('O', 'cheek-feather-edge') }, h('path', { d, fill: P }), line(dl, SOFT, 1));
      const chin = [[-8, 3.4], [-1, 5.4], [6, 7], [12, 8.6]];
      let dcl = '';
      const dc = `M-12 3L${pt(chin[0])}` + chin.slice(1).map((c, i) => { const a = chin[i], m = lerp2(a, c, 0.5), n = perp(norm(sub(c, a))), q = add(m, mul(n, 3.4)); dcl += `M${pt(a)}Q${pt(q)} ${pt(c)}`; return `Q${pt(q)} ${pt(c)}`; }).join('') + 'L12 24L-12 24Z';
      inner += h('g', { 'data-detail': tag('O', 'chin-feathers') }, h('path', { d: dc, fill: P }), line(dcl, SOFT, 1), h('ellipse', { 'data-ref': 'pb-blush', 'data-detail': tag('O', 'cheek-blush'), cx: -3, cy: 6.8, rx: 10, ry: 6.2, transform: 'rotate(-10 -3 6.8)', fill: 'url(#pb-blushG)' }));
    }
    inner += h('g', { 'data-detail': tag('T', 'head-wet-in-wet-glazes') }, gz('pb', 'rose', -18, 8, 18, 12, 30, 0.6), gz('pb', 'shade', 4, 16, 20, 7, 0, 0.35),
      gz('pb', 'warm', 2, -24, 22, 8, 10, 0.55), gz('pb', 'lite', 10, -20, 12, 5, 15, 0.8));
    inner += h('path', { class: 'gw-tex', d: o, fill: 'url(#pb-gw)', opacity: 0.85 });
    inner += line('M6 -26.4l-3.6 1.8M12 -24.6l-3.8 1.6M18 -21.6l-3.6 1.4M9 -20.4l-3.4 1.2M15 -18.6l-3 1M-4 -26l-3.4 1.6M-12 -22.6l-3 1.8', Dp, 1, { 'data-detail': tag('T', 'forehead-feather-flecks') });
    inner += line('M-27 8Q-22 12 -16 13M-22 14Q-17 16 -12 16.4', SOFT, 1, { 'data-detail': tag('O', 'nape-edge') });
    const pencil = WH.slice(0, 7 * k).filter((p, i) => i >= 1 && i <= 11).map(p => add(p, mul(norm(sub(p, [2, -4])), 2)));
    s.head = h('g', { 'data-detail': tag('O', 'head') },
      h('path', { d: o, fill: P }),
      h('clipPath', { id: 'pb-headclip' }, h('path', { d: o })),
      h('g', { 'clip-path': 'url(#pb-headclip)' }, inner),
      line(splitQ(keyPts), INK, KW),
      line(splitQ(pencil), INK, 0.8, { opacity: 0.4, 'data-detail': tag('T', 'crown-pencil-line') }),
      // feathered forehead point pressing onto the culmen base (P. onocrotalus field mark)
      h('g', { 'data-detail': tag('O', 'forehead-feather-point') },
        h('path', { d: 'M24 -18C32 -12 40 -7 48 -4.4C40 -3.2 33 -3.4 26 -4.6C24 -8 23 -13 24 -18Z', fill: P }),
        line('M26 -4.6C33 -3.4 40 -3.2 48 -4.4', INK, 1.4), line('M30 -9.6Q36 -7 41 -5.4', Dp, 0.9)),
      // gape: the mouth line runs back under the eye to BEHIND it and turns up at the corner (a content smile)
      line(splitQ(resample([[40, 9.2], [26, 6.4], [14, 3.8], [5, 1.8], [0.4, 0.6]], 2)), INK, 1.8, { 'data-detail': tag('O', 'gape-smile-line') }),
      h('g', { 'data-ref': 'pb-smile' }, line('M0.4 0.6Q-1.8 -0.4 -2 -3', INK, 1.5, { 'data-detail': tag('O', 'smile-crease') }),
        line('M-3.2 -1.4q-1.2 1.2 -1 2.8', SOFT, 0.8, { 'data-detail': tag('O', 'smile-dimple') })),
      // storybook goggles pushed up on the crown: leather strap, brass rims, sea-glass lenses
      h('g', { 'data-detail': tag('O', 'goggle-strap') },
        line('M-5 -30.6C-10 -29.8 -14 -28.4 -17.4 -26.6', v('pbLeather'), 4.4, { 'stroke-linecap': 'butt' }),
        line('M-5 -30.6C-10 -29.8 -14 -28.4 -17.4 -26.6', CR, 0.7, { 'stroke-dasharray': '1.2 1.8', 'stroke-linecap': 'butt' }),
      h('rect', { 'data-detail': tag('O', 'goggle-buckle'), x: -14, y: -31.6, width: 5, height: 6, rx: 1, fill: v('pbBrass'), stroke: INK, 'stroke-width': 1, transform: 'rotate(-16 -11.5 -28.6)' }),
      h('g', { 'data-detail': tag('O', 'goggle-lens'), transform: 'translate(3 -34.5) rotate(20)' },
        h('ellipse', { cx: -9, cy: 1, rx: 5.6, ry: 7.4, fill: v('pbLens', { far: true }), stroke: INK, 'stroke-width': 1.1 }),
        h('path', { d: 'M-4.4 0.4Q-6 -1.6 -8 -0.4', fill: 'none', stroke: INK, 'stroke-width': 2.2 }),
        h('ellipse', { cx: 0, cy: 0, rx: 7.4, ry: 8.6, fill: v('pbBrass'), stroke: INK, 'stroke-width': 1.3 }),
        h('ellipse', { cx: 0.3, cy: 0.3, rx: 5, ry: 6.1, fill: v('pbLens'), stroke: INK, 'stroke-width': 0.8 }),
        h('path', { d: 'M-4.4 2.6Q0 6.6 4.6 3.4L4.6 6L-4.4 6Z', fill: v('pbLens', { far: true }), opacity: 0.7 }),
        line('M-2.6 -3.2Q-0.8 -5 2 -4.4', P, 1.4, { 'data-detail': tag('O', 'goggle-glint') }),
        h('circle', { cx: 2.4, cy: 3, r: 1, fill: P }))),
      // closed-eye line (blink / happy squint); the eye slot itself squashes to nothing
      line('M-1.4 -7.6Q6 -12.2 13.6 -8', INK, 2.2, { 'data-ref': 'pb-lidClosed', style: 'display:none' }));
  }

  // ================================================================ EYE (eye-local; sy = blink)
  s.eye = h('g', { transform: 'scale(1.16)', 'data-detail': tag('O', 'eye') },
    h('circle', { r: 6.9, fill: v('pbBlush'), opacity: 0.55 }),
    h('g', { 'data-detail': tag('O', 'iris') }, h('circle', { r: 5.6, fill: v('iris'), stroke: INK, 'stroke-width': 0.8 }),
      h('g', { 'data-ref': 'pb-pupil' },
        h('circle', { 'data-detail': tag('O', 'pupil'), r: 4.1, fill: v('pupil') }),
        h('circle', { 'data-detail': tag('O', 'eye-highlight'), cx: 1.5, cy: -1.7, r: 1.6, fill: P }),
        h('circle', { 'data-detail': tag('O', 'eye-glint-secondary'), cx: -1.7, cy: 1.6, r: 0.7, fill: P }))),
    // nictitating membrane: sweeps front -> back across the eye (most of the pelican's blinks)
    h('clipPath', { id: 'pb-eyeclip' }, h('circle', { r: 5.7 })),
    h('g', { 'clip-path': 'url(#pb-eyeclip)', 'data-ref': 'pb-nictG', style: 'display:none' },
      h('g', { 'data-ref': 'pb-nict', 'data-detail': tag('O', 'nictitating-membrane') }, h('path', { d: 'M-6.4 -6.5Q-8.4 0 -6.4 6.5L9 6.5L9 -6.5Z', fill: v('pbLens'), opacity: 0.85 }), line('M-6.4 -6.5Q-8.4 0 -6.4 6.5', SOFT, 0.9))),
    // expression lids: the upper lid skin slides down over the eye (clipped to the orbit), the lower lid rises
    // (cheek push: delight / focus). update() drives both from pose.face (lid, brow, mood).
    h('clipPath', { id: 'pb-orbitclip' }, h('circle', { r: 6.3 })),
    h('g', { 'clip-path': 'url(#pb-orbitclip)' },
      h('g', { 'data-ref': 'pb-lidSkin' }, h('path', { 'data-detail': tag('O', 'upper-lid-skin'), d: 'M-8 -2.4Q0 -7.6 8 -3L8 -20L-8 -20Z', fill: Ks })),
      h('g', { 'data-ref': 'pb-lowLid' }, h('path', { 'data-detail': tag('O', 'lower-lid-skin'), d: 'M-7 6.4Q0 4.2 7 5.4L7 14L-7 14Z', fill: Ks }),
        line('M-5.4 6.2Q0 4.2 5.6 5.4', Ke, 1.1, { 'data-detail': tag('O', 'lower-eyelid') }))),
    h('g', { 'data-ref': 'pb-lid' },
      h('path', { 'data-detail': tag('O', 'upper-eyelid'), d: 'M-7.4 -1.6Q-1 -8.9 7.6 -3.7Q8.5 -2.9 8.1 -2.2Q0.4 -7.6 -7.4 -1.6Z', fill: INK }),
      // one little storybook lash flicking back from the outer (rear) corner
      line('M-6.6 -2.6Q-8.6 -3.6 -9.6 -6', INK, 1.1, { 'data-detail': tag('O', 'eye-lash') }),
      line('M7.6 -3.4Q9.4 -3.2 10.2 -1.6', INK, 1, { 'data-detail': tag('O', 'lid-corner-crinkle') })),
    // happy closed eye (swallow / delight): an upturned lid arc with a cheek crinkle, drawn in eye space
    h('g', { 'data-ref': 'pb-happy', style: 'display:none' }, line('M-6.6 2Q0 -5.4 7 1.4', INK, 2.1, { 'data-detail': tag('O', 'happy-closed-lid') }),
      line('M-4.4 5.6Q0 7.4 4.6 5.4M8 1.2l2.4 -1.4', Ke, 1, { 'data-detail': tag('O', 'happy-cheek-crinkle') })),
    // brow ridge: the feathered supraorbital edge; lowers + tilts for focus, lifts for surprise
    h('g', { 'data-ref': 'pb-brow' }, line('M-6.8 -9.4Q0.6 -13.4 9.8 -9.8', SOFT, 1.4, { 'data-detail': tag('O', 'brow-ridge') }),
      line('M-3.4 -11.4l-1.2 -2M1 -12.2l-0.7 -2.2M5.4 -11.8l-0.2 -2.2', Dp, 0.9, { 'data-detail': tag('T', 'brow-feather-tips') })));

  // ================================================================ CREST (crest-local: +x back along the nape, +y up)
  {
    let sd = 140;
    const strand = (by, L, droop, curl, w) => {
      const c = [[0, by], [L * 0.35, by + curl], [L * 0.7, by + curl * 0.4 - droop * 0.45], [L, by - droop]];
      const P2 = [], Q2 = [];
      for (let i = 0; i < c.length; i++) {
        const d = norm(sub(c[Math.min(c.length - 1, i + 1)], c[Math.max(0, i - 1)])), n = perp(d), ww = w * (1 - i / (c.length - 1)) ** 0.8 / 2;
        P2.push(add(c[i], mul(n, ww))); Q2.push(add(c[i], mul(n, -ww)));
      }
      const tip = add(c[c.length - 1], mul(norm(sub(c[3], c[2])), 2.5));
      const outl = hand([...P2.slice(0, -1), tip, ...Q2.slice(0, -1).reverse()], { k: 2, amp: 0.3, lam: 4, seed: sd++ });
      return { d: smooth(outl), shaft: splitQ(resample([c[0], c[1], c[2], lerp2(c[2], c[3], 0.6)].map((p, i) => i ? p : lerp2(c[0], c[1], 0.4)), 2)) };
    };
    const longS = [[-6, 34, 24, -2, 9], [-2, 43, 23, 1.5, 10], [2, 47, 19, -1, 10.5], [6, 39, 12, 3, 9.5], [10, 30, 5, 2.5, 8.5]];
    const shortS = [[12, 20, 2, 2, 6.5], [14, 14, -2, 1.5, 6], [7, 26, 9, 2, 7]];
    let longD = '', shaftD = '', shortD = '';
    for (const a of longS) { const st = strand(...a); longD += h('path', { d: st.d, fill: P, stroke: INK, 'stroke-width': 1.25, 'stroke-linejoin': 'round' }); shaftD += st.shaft; }
    for (const a of shortS) shortD += h('path', { d: strand(...a).d, fill: P, stroke: INK, 'stroke-width': 1.2, 'stroke-linejoin': 'round' });
    s.crest = h('g', {},
      h('path', { 'data-detail': tag('O', 'crest-shadow'), d: smooth([[-4, -12], [14, -14], [34, -26], [26, -12], [6, -4]]), fill: S }),
      h('g', { 'data-detail': tag('O', 'nape-tuft') },
        h('path', { d: smooth(hand([[-5, -4], [6, -12], [15, -19], [12, -22], [20, -26], [7, -23], [-2, -14]], { k: 2, amp: 0.3, lam: 4, seed: 139 })), fill: P, stroke: INK, 'stroke-width': 1.2, 'stroke-linejoin': 'round' }),
        line('M3 -11Q8 -15 11 -19', Dp, 0.9)),
      h('g', { 'data-ref': 'pb-crestLong' }, h('g', { 'data-detail': tag('O', 'crest-long-strands') }, longD, line(shaftD, Dp, 0.9, { 'data-detail': tag('T', 'crest-shaft-lines') }))),
      h('g', { 'data-ref': 'pb-crestShort', 'data-detail': tag('O', 'crest-short-spikes') }, shortD));
  }
  return { defs: textures(v), slots: s };
}

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
// Knitted ribbon: outline, cream stripe bands, knit stitch chevrons in two columns (fixed counts), fringe tassels.
function ribbon(cl, w0, w1, t, seed, knitOn = true) {
  const n = cl.length, L = [], Rr = [];
  for (let i = 0; i < n; i++) {
    const d = norm(sub(cl[Math.min(n - 1, i + 1)], cl[Math.max(0, i - 1)])), nr = perp(d), s = i / (n - 1);
    const tw = 0.62 + 0.38 * Math.abs(Math.cos(Math.PI * (1.1 * s - 0.35 * t) + seed));
    const w = lerp(w0, w1, s) * tw / 2;
    L.push(add(cl[i], mul(nr, w))); Rr.push(add(cl[i], mul(nr, -w)));
  }
  const mid = (a, i) => lerp2(a[i], a[i + 1], 0.5);
  let d = `M${pt(L[0])}`;
  for (let i = 1; i < n - 1; i++) d += `Q${pt(L[i])} ${pt(mid(L, i))}`;
  d += `L${pt(L[n - 1])}L${pt(Rr[n - 1])}`;
  for (let i = n - 2; i >= 1; i--) d += `Q${pt(Rr[i])} ${pt(mid(Rr, i - 1))}`;
  d += `L${pt(Rr[0])}Z`;
  let st = '';
  for (let i = 1; i + 2 < n; i += 4) {
    const a = i, b = i + 2;
    st += `M${pt(mid(L, a - 1))}Q${pt(L[a])} ${pt(mid(L, a))}Q${pt(L[a + 1])} ${pt(mid(L, a + 1))}L${pt(mid(Rr, b - 1))}Q${pt(Rr[b - 1])} ${pt(mid(Rr, b - 2))}Q${pt(Rr[a])} ${pt(mid(Rr, a - 1))}Z`;
  }
  // knit: stocking-stitch "V"s in two columns, pointing toward the free end
  let knit = '';
  if (knitOn) for (let i = 0; i < n - 1; i++) for (const c of [0.22, 0.5, 0.78]) {
    const a = lerp2(L[i], Rr[i], c - 0.1), b = lerp2(L[i], Rr[i], c + 0.1), tip = lerp2(lerp2(L[i], Rr[i], c), lerp2(L[i + 1], Rr[i + 1], c), 0.62);
    knit += `M${pt(a)}L${pt(tip)}L${pt(b)}`;
  }
  let fr = ''; const e0 = L[n - 1], e1 = Rr[n - 1], dn = norm(sub(cl[n - 1], cl[n - 2]));
  for (let k = 0; k <= 5; k++) { const p = lerp2(e0, e1, k / 5); fr += `M${pt(p)}l${f(dn[0] * 8.5 + (k - 2.5) * 0.4)} ${f(dn[1] * 8.5 + Math.sin(t * 9 + k) * 1.2)}`; }
  return { d, st, knit, fr };
}

export const detailItems = [
  ['neck', 'O', 'S-neck deformer outline: warm-white fill, hand-wobbled warm-brown ink line (fixed command count)'],
  ['neck-nape-glaze', 'T', 'rose-grey glaze down the back of the neck; its inner edge swells like a loaded brush'],
  ['neck-painted-scallops', 'T', 'painted crescent feathers that ride on and stretch with the neck deformer'],
  ['neck-feather-flecks', 'T', 'second, finer staggered lane of lilac feather flecks'],
  ['neck-throat-crease', 'O', 'fore-neck crease continuing the pouch skin down the throat'],
  ['neck-pencil-line', 'T', 'pencil double line just outside the nape'],
  ['neck-rim-light', 'O', 'warm rim line on the sun/moon side of the neck (flips with the light)'],
  ['tail-rectrices', 'O', '5 short, rounded rectrices with hand-wobbled outlines, rooted in the rump'],
  ['tail-rose-tips', 'O', 'rose-grey glaze on each tail tip'],
  ['tail-rachis-lines', 'T', 'feather shafts on each rectrix'],
  ['tail-tip-splits', 'T', 'little split lines in the tail tips (worn feather ends)'],
  ['tail-upper-coverts', 'O', '2 rounded coverts overlapping the tail base'],
  ['undertail-coverts', 'O', 'fluffy undertail lobe with glaze fold lines'],
  ['scarf-far-tail', 'O', 'far scarf end in darker far glazes behind the body'],
  ['body', 'O', 'the pelican body: deep chest, long straight back, tapering rump (not a goose egg)'],
  ['body-hand-inked-outline', 'O', 'warm-brown silhouette line, wobble baked into the geometry'],
  ['body-brush-weight-accents', 'T', 'tapered brush-weight ink under the chest and round the rump (shadow side)'],
  ['back-pencil-line', 'T', 'offset pencil double line along the back'],
  ['plumage-gouache-mottle', 'T', 'static gouache mottling pattern (rose blotches, brush flecks, paper speckles)'],
  ['body-wet-in-wet-glazes', 'T', 'soft radial glazes, wet-in-wet: rose shade pooled under the belly and rump, a cool under-wing glaze, a warm lit back'],
  ['neck-gouache-blotch-texture', 'T', 'painted-blotch gouache tile riding on the neck (same live outline as the neck)'],
  ['body-gouache-blotch-texture', 'T', 'bold painted-blotch gouache tile over the body: pooled pigment, lifted pale patches, dry-brush drags'],
  ['belly-rose-glaze', 'T', 'rose-grey shadow wash along the underside and rump'],
  ['belly-deep-glaze', 'T', 'second, deeper lilac wash in the core shadow'],
  ['belly-drybrush-edge', 'T', 'dry-brush strokes feathering up out of the glaze edge'],
  ['mantle-scallops', 'T', 'painted mantle feather crescents with lilac edge strokes, overlapping toward the tail'],
  ['flank-scallops', 'T', 'large lilac flank feather crescents'],
  ['breast-scallops', 'T', 'small breast feather crescents'],
  ['rump-scallops', 'T', 'rump feather crescents by the tail'],
  ['feather-shaft-ticks', 'T', 'shaft ticks inside flank feathers'],
  ['breast-buff-wash', 'O', 'soft yellow wash of the breeding breast patch (P. onocrotalus)'],
  ['breast-buff-feathers', 'T', 'warm orange feather marks over the breast patch'],
  ['belly-saddle-bulge', 'O', 'underbelly contour flattened and spread onto the saddle top (weight on the seat)'],
  ['belly-splay-tufts', 'O', 'feather tufts splaying where the belly spreads over the saddle edges'],
  ['saddle-compression-crease', 'O', 'feathers compressed where the belly sits on the saddle'],
  ['vent-fluff', 'O', 'vent fluff lines under the tail'],
  ['rim-light', 'O', 'warm body rim light on the sun/moon side'],
  ['scarf-cast-shadow', 'O', 'warm lilac shadow the scarf casts on the neck plumage'],
  ['collar-ruff', 'O', 'neck-base feather tips poking out below the scarf'],
  ['scarf-trailing-end', 'O', 'long knitted scarf end streaming back, with follow-through and hop lift'],
  ['scarf-cream-stripes', 'T', 'cream stripe bands that ride on the animated ribbon'],
  ['scarf-knit-stitches', 'T', 'stocking-stitch V columns that ride on the ribbon (per frame, fixed count)'],
  ['scarf-fringe', 'O', 'cream fringe tassels at the trailing end'],
  ['scarf-wrap', 'O', 'bulky red wrap with cream stripes around the neck base'],
  ['scarf-wrap-knit-texture', 'T', 'knit-stitch pattern on the wrap'],
  ['scarf-ribbed-edges', 'T', 'ribbed knit edges of the wrap'],
  ['scarf-underside-glaze', 'T', 'deep-red glaze on the underside of the wrap'],
  ['scarf-darned-patch', 'O', 'a small cream darned patch with red cross-stitches on the wrap (a mended, loved scarf)'],
  ['scarf-hanging-end', 'O', 'short front end hanging from the knot, swinging with the ride'],
  ['scarf-fringe-cream', 'O', 'cream fringe on the hanging end'],
  ['scarf-knot', 'O', 'knitted knot with a fold highlight'],
  ['knot-cream-stripes', 'O', 'cream stripes curving round the knot'],
  ['knot-fold-line', 'O', 'ink fold line in the knot'],
  ['knot-highlight', 'O', 'soft highlight on the top of the knot'],
  ['pouch', 'O', 'yellow gular pouch reaching behind the gape to the throat'],
  ['pouch-orange-glaze', 'T', 'two layered orange glazes toward the sagging pouch bottom'],
  ['pouch-wet-in-wet-glazes', 'T', 'soft glazes on the pouch: deep orange pooled along the sagging rim and the throat, a pale lit band under the mandible'],
  ['pouch-gouache-blotch-texture', 'T', 'painted-blotch gouache tile on the pouch skin (warm pooled pigment, pale lifts)'],
  ['pouch-stipple-texture', 'T', 'static stipple + wrinkle-tick skin texture pattern'],
  ['pouch-backlit-glow', 'O', 'bright glow when the low sun backlights the pouch (and a fish silhouette inside)'],
  ['pouch-stretch-lines', 'T', 'orange texture lines that stretch with the pouch sy'],
  ['pouch-throat-wrinkles', 'T', 'fine wrinkles where the pouch folds into the throat'],
  ['pouch-sag-folds', 'T', 'small sag folds along the pouch belly'],
  ['pouch-highlight', 'O', 'pale-yellow brush highlight under the ramus'],
  ['pouch-rim-folds', 'O', 'scalloped attachment folds under the lower mandible'],
  ['pouch-edge-line', 'O', 'hand-wobbled ink edge of the pouch'],
  ['pouch-brush-accent', 'T', 'tapered brush-weight ink along the heavy lower curve'],
  ['bill-lower', 'O', 'thin lower mandible with ink outline'],
  ['mandible-ramus-line', 'O', 'ramus edge line framing the pouch'],
  ['ramus-sheen', 'O', 'pale sheen dashes on the ramus'],
  ['bill-upper', 'O', 'long flat peach upper mandible (128 u)'],
  ['bill-ink-outline', 'O', 'hand-wobbled warm-brown bill outline'],
  ['bill-gouache-mottling', 'T', 'dry-brush peach mottling strokes on the bill'],
  ['bill-underside-glaze', 'T', 'darker glaze along the cutting edge'],
  ['maxillary-groove', 'O', 'lateral groove line along the upper mandible'],
  ['bill-growth-ridges', 'T', 'fine growth ridges near the bill base'],
  ['culmen-highlight', 'O', 'tapered highlight brushstroke along the culmen'],
  ['culmen-ridge', 'O', 'ridge line of the culmen'],
  ['tomium-line', 'O', 'ink cutting-edge line'],
  ['nostril-slit', 'O', 'slit nostril near the culmen base'],
  ['bill-tip-shadow', 'O', 'shadow under the nail'],
  ['nail-hook', 'O', 'red hooked nail overlapping the lower tip'],
  ['nail-highlight', 'O', 'highlight on the nail'],
  ['nail-under-hook', 'O', 'under-hook line'],
  ['head', 'O', 'round warm-white skull with a sloping forehead'],
  ['head-wet-in-wet-glazes', 'T', 'soft glazes on the head: rose shade at the nape and chin, warm light on the crown'],
  ['bill-wet-in-wet-glazes', 'T', 'soft glazes on the bill: darker peach along the tomium, a pale sheen along the culmen'],
  ['head-gouache-mottle', 'T', 'gouache mottling on the head'],
  ['head-nape-glaze', 'T', 'rose-grey glaze on the back of the head and under the chin'],
  ['crown-pencil-line', 'T', 'pencil double line along the crown'],
  ['facial-skin', 'O', 'bare pink facial skin around the eye, running into the bill'],
  ['orbital-skin-glaze', 'T', 'deeper pink glaze on the skin around the eye'],
  ['cheek-feather-edge', 'O', 'scalloped feather edge over the bare skin'],
  ['chin-feathers', 'O', 'scalloped chin feathers over the gape'],
  ['cheek-blush', 'O', 'rosy storybook blush on the cheek (brightens with delight)'],
  ['forehead-feather-flecks', 'T', 'lilac flecks following the crown feather flow'],
  ['nape-edge', 'O', 'nape edge lines where the head meets the neck'],
  ['forehead-feather-point', 'O', 'feathered forehead point pressing onto the culmen base (P. onocrotalus field mark)'],
  ['gape-smile-line', 'O', 'gape line running back under and behind the eye, turning up (content)'],
  ['smile-crease', 'O', 'small upturn at the mouth corner'],
  ['smile-dimple', 'O', 'tiny dimple line behind the mouth corner'],
  ['goggle-strap', 'O', 'stitched leather goggle strap around the back of the skull (holds buckle + goggles)'],
  ['goggle-buckle', 'O', 'brass strap buckle'],
  ['goggle-lens', 'O', 'brass-rimmed sea-glass goggles pushed up on the crown'],
  ['goggle-glint', 'O', 'glint on the lens'],
  ['eye', 'O', 'the whole kind eye: pink orbital ring, iris, pupil, lids (scaled up 16% for picture-book appeal)'],
  ['iris', 'O', 'dark red-brown iris'],
  ['pupil', 'O', 'large dark pupil with saccades (a kind eye)'],
  ['eye-highlight', 'O', 'big catch-light'],
  ['eye-glint-secondary', 'O', 'second small catch-light'],
  ['nictitating-membrane', 'O', 'pale membrane sweeping front-to-back across the eye (most blinks; not in the still count)'],
  ['upper-lid-skin', 'O', 'relaxed upper lid skin'],
  ['upper-eyelid', 'O', 'ink upper eyelid line'],
  ['eye-lash', 'O', 'a single storybook lash at the rear corner'],
  ['lid-corner-crinkle', 'O', 'smile crinkle at the front eye corner'],
  ['lower-lid-skin', 'O', 'cheek skin pushing the lower lid up (smiling eye)'],
  ['lower-eyelid', 'O', 'lower lid line (rises with the cheek: delight / focus)'],
  ['happy-closed-lid', 'O', 'upturned closed-lid arc for the swallow / delight beat (not in the still count)'],
  ['happy-cheek-crinkle', 'O', 'cheek crinkles under the happy closed eye (not in the still count)'],
  ['brow-ridge', 'O', 'feathered supraorbital brow edge: lowers for sprint focus, lifts for hop surprise'],
  ['brow-feather-tips', 'T', 'three feather tips along the brow ridge'],
  ['crest-shadow', 'O', 'rose-grey shadow under the crest'],
  ['nape-tuft', 'O', 'fluffy tuft under the crest'],
  ['crest-short-spikes', 'O', '3 short spiky crest feathers'],
  ['crest-long-strands', 'O', '5 long shaggy crest strands with wobbly ink outlines'],
  ['crest-shaft-lines', 'T', 'shaft lines in the long crest strands'],
].map(([name, kind, what]) => ({ id: 'pelican:' + kind + ':' + name, layer: 'pelican', kind, what }));

// ---------------------------------------------------------------- runtime
export function attach(svg) {
  const r = refs(svg, 'pb-');
  const st = new WeakMap();   // per element, per attribute: last written value (no getAttribute / key strings per call)
  const set = (el, k, val) => { if (!el) return; let m = st.get(el); if (!m) st.set(el, m = {}); if (m[k] !== val) { m[k] = val; if (k === 'd') el.setAttribute('d', val); else if (k === 'op') el.style.opacity = val; else if (k === 'show') el.style.display = val ? '' : 'none'; else el.setAttribute(k, val); } };
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
        { const nd = neckD(n, bulge); set(r.neck, 'd', nd); set(r.neckGw, 'd', nd); }
        const nd = neckDetail(n, bulge);
        set(r.neckFlow, 'd', nd.flow); set(r.neckFlow2, 'd', nd.flowSmall); set(r.neckCrease, 'd', nd.crease);
        set(r.neckRimF, 'd', nd.rimF); set(r.neckRimB, 'd', nd.rimB); set(r.neckShade, 'd', nd.shade); set(r.neckPencil, 'd', nd.pencil);
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
      const far = ribbon(farCL, 15, 11, tt + 0.4, 1.3, false);
      set(r.sfFill, 'd', far.d); set(r.sfStripe, 'd', far.st); set(r.sfFringe, 'd', far.fr);
      const hang = ribbon(hangCL, 15, 12, tt * 0.5, 2.2);
      set(r.shFill, 'd', hang.d); set(r.shStripe, 'd', hang.st); set(r.shKnit, 'd', hang.knit); set(r.shFringe, 'd', hang.fr);
      // ---- face: closed-lid line when the eye is (nearly) shut; nictitating membrane; smile; lid pose; gaze
      const face = pose.face || {};
      const eyeSy = J.eye?.sy ?? pose.blink ?? 1;
      const squintFB = gulpTau > 0.55 && gulpTau < 1.25 && !pose.face;
      // expression: content = soft half-lid, focus = flat low lid + brow down, surprise = wide eye + brow up +
      // pupil pop, delight = closed happy arc (cheek pushes the lower lid up)
      const md = face.mood || {}, mC = md.content ?? (pose.face ? 0 : 1), mF = md.focus ?? 0, mS = md.surprise ?? 0, mD = md.delight ?? (squintFB ? 1 : 0);
      let lidA = clamp((face.lid ?? 0.14) + 0.08 * mC + 0.12 * mF - 0.3 * mS, 0, 1);   // storybook: a wide, kind resting eye
      const swallow = gulpTau > 0.95 && gulpTau < 2.3;   // the swallow + savour: eyes screw shut, happy
      const happy = lidA > 0.8 || mD > 0.6 || swallow;
      if (happy) lidA = 1;
      set(r.lid, 'show', !happy);
      set(r.lidClosed, 'show', (eyeSy < 0.4 || squintFB) && !happy); set(r.happy, 'show', happy);
      if (happy) set(r.happy, 'transform', `scale(1 ${(1 / Math.max(0.3, eyeSy)).toFixed(2)})`);   // keep the arc's curve when the slot squashes
      const lidY = lerp(-1.2, 10.5, lidA) - 1.6 * mS;
      const lidR = 6 * mF - 4 * mS;          // focus: lid flattens, front end drops
      const lidXf = `translate(0 ${lidY.toFixed(2)}) rotate(${lidR.toFixed(1)})`;
      set(r.lidSkin, 'transform', lidXf); set(r.lid, 'transform', lidXf);
      set(r.lowLid, 'transform', `translate(0 ${(-(2.6 * (happy ? 1 : mD) + 1.4 * mF + 1.1 * mC) + 0.8 * mS).toFixed(2)})`);   // content: a smiling lower lid
      const nict = face.nict ?? 0;
      set(r.nictG, 'show', nict > 0.02);
      if (nict > 0.02) set(r.nict, 'transform', `translate(${(12 * (1 - nict)).toFixed(2)} 0)`);
      const smile = face.smile ?? 0.4, brow = face.brow ?? 0.1;
      set(r.smile, 'transform', `rotate(${(-16 * (smile - 0.4)).toFixed(1)} 2.6 -1.4)`);
      set(r.brow, 'transform', `translate(0 ${(-2.6 * brow + 1.2 * mF).toFixed(2)}) rotate(${(-7 * brow + 5 * mF).toFixed(1)} 1 -12)`);
      // rosy blush: warms with delight / a big smile (and the savour after a fish), quantised so it rarely writes
      set(r.blush, 'op', (Math.round((0.62 + 0.38 * Math.max(mD, swallow ? 1 : 0, clamp((smile - 0.5) * 2, 0, 1))) * 20) / 20).toFixed(2));
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
      const backlit = (fr.night || 0) < 0.5 && sunE < 0.24 && sunE > -0.06;     // low sun behind the rider: warm glow
      set(r.pouchGlow, 'show', backlit || fishOp > 0.5);
    },
  };
}
