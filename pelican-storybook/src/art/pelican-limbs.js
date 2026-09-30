// OWNER: pelican-limbs. Legs and wings of the great white pelican, near + far.
// Style B (warm storybook gouache, docs/STYLE-B.md §2–§3): warm-white plumage with rose-grey glazes and painted
// scallop feathers, deep plum-black flight feathers with sheen strokes and pale blooms, an orange tarsus with painted
// scale rings, totipalmate feet; every outline is the warm-brown ink, hand-wobbled and doubled with a faint pencil
// line. The far wing and far leg repeat the same shapes in cooler, darker glazes (never flat black).
//
// PERFORMANCE RULE: no filters here (these are rider slots). The hand-made look is baked into the geometry at build
// time: seeded wobble on every outline, tapered brush ribbons for shading and dry-brush flecks, a second offset
// "pencil" stroke, and ONE static <pattern> of gouache blotches in slot-local coordinates (it moves with the part).
//
// Slots are drawn in joint-local coordinates (bone along +x, pivot at 0,0; see CONTRACT.md):
//   thigh*  hip -> knee 142      shank*  knee -> ankle 134      foot*  ankle; ball (17,9) on the pedal spindle
//   wing*Upper shoulder -> elbow 78   wing*Lower elbow -> wrist 74   wing*Hand wrist ON the grip (grip r = 6)
//
// Anatomy (why it reads as a wing, not an arm in a sleeve):
//   upper slot  = scapulars + tertials: a broad covert cape over the body side that merges into it at the shoulder
//                 (no key line there), with overlapping rounded tertials as the trailing edge.
//   lower slot  = the propatagium (skin fold shoulder -> wrist; its outline is rebuilt from the real elbow angle so
//                 the leading edge is always one clean curve and the elbow never seams), marginal / lesser / median
//                 / greater covert rows, deep secondaries hanging below the arm line as a fringe (pale blooms) and
//                 the trailing primaries sweeping back and down from the wrist (rotated with the hand).
//   hand slot   = carpal bend, primary coverts, the alula (the bird's "thumb", flicks the bell) and five outer
//                 primaries that share one wrap round the grip and peel off one by one into five separate tips that
//                 curl like fingers (each with its own pale edge, so they never read as a clump or a brush);
//                 they open into a fan for the wave.
// Legs: feathered "trousers" merge into the belly and hide the rig knee in a pointed feather cuff (bare skin starts
//   ≥ 15 u below the knee pivot at every knee angle); orange tarsus 13.6→10 u with painted scale rings, reticulate
//   rear scales and an intertarsal heel pad; totipalmate foot (all four toes webbed, incl. the hallux web) flat on the
//   pedal, sole on the pedal's top face (foot-local y = 6), toes draping over its front edge.
//
// Hit-testing note: long curved lines are emitted as short C1-continuous quadratic pieces (splitQ) so a stroke's
// chord area never "covers" what is underneath; detail lines nest inside the part they belong to.
// Per frame: the propatagium outline (fixed command counts, skipped when the elbow angle moved < 0.15°) plus a
// handful of cached transforms (primaries, alula, finger fan, toe curl, web press, covert lift).
import { fmt2 } from '../core/math.js';
import { SKEL } from '../contract.js';
import { h, refs } from '../core/svg.js';

export const id = 'pelican-limbs';

// ---------------------------------------------------------------- gouache palette (STYLE-B §1, golden hour)
// Exported as graded materials so time of day lights them like the core materials. The far side has its own
// explicit glazes (the draft-B far(): darker, cooler), so its look does not depend on the generic -far mapping.
const NEAR = {
  Ink: '#4A2C20', InkSoft: '#6B4632', Paper: '#FFF6EC', Glow: '#FFFBF4', Rose: '#E9D3D2', RoseDeep: '#C7AFC2',
  Deep: '#231D26', Sheen: '#4A4458', Bloom: '#A195AB', Foot: '#F08A3C', FootHi: '#F9B676', FootLo: '#C9652A',
  FootDeep: '#9A4A22', Web: '#F7A860', Pad: '#D9705A', Claw: '#3B2C2A',
};
function farHex(hex, k = 0.78) {
  const n = parseInt(hex.slice(1), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255], s = [0.92, 0.9, 1.0];
  return '#' + c.map((v, i) => Math.round(Math.min(255, v * k * s[i] + 10 * (i === 2))).toString(16).padStart(2, '0')).join('');
}
export const materials = {};
for (const [k, hex] of Object.entries(NEAR)) { materials['pl' + k] = hex; materials['plF' + k] = farHex(hex, k === 'Deep' || k === 'Sheen' ? 0.95 : 0.8); }

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
const norm = v => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
const perp = v => [-v[1], v[0]];
const dir = a => [Math.cos(a * D2R), Math.sin(a * D2R)];
const wrapA = a => ((a % 360) + 540) % 360 - 180;
// deterministic hash noise in [-1, 1] (the hand-drawn wobble must be identical every frame and in the bake)
const jr = (i, s) => { const x = Math.sin(i * 127.1 + s * 311.7 + 0.5) * 43758.5453; return (x - Math.floor(x)) * 2 - 1; };
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
// Catmull-Rom resample of an open polyline (k samples per span)
function resample(P, k) {
  const out = [], n = P.length, g = i => P[Math.max(0, Math.min(n - 1, i))];
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < k; j++) {
    const t = j / k, t2 = t * t, t3 = t2 * t, p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
    out.push([0, 1].map(c => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)));
  }
  out.push(P[n - 1]); return out;
}
// Seeded wobble: every point pushed along its local normal (open curves keep their end points, so joins stay put).
function wob(P, amp, seed, closed = true) {
  const n = P.length;
  return P.map((p, i) => {
    if (!closed && (i === 0 || i === n - 1)) return p;
    const a = P[closed ? (i - 1 + n) % n : i - 1], b = P[closed ? (i + 1) % n : i + 1];
    return add(p, mul(perp(norm(sub(b, a))), amp * jr(i, seed)));
  });
}
// offset an open polyline along its normal
function offs(P, d) {
  const n = P.length;
  return P.map((p, i) => add(p, mul(perp(norm(sub(P[Math.min(n - 1, i + 1)], P[Math.max(0, i - 1)]))), d)));
}
// A long line as short quadratic pieces (midpoint to midpoint): looks like one smooth round-capped stroke.
function splitQ(S) {
  const m = i => lerp2(S[i], S[i + 1], 0.5);
  let d = `M${pt(S[0])}L${pt(m(0))}`;
  for (let i = 1; i < S.length - 1; i++) d += `M${pt(m(i - 1))}Q${pt(S[i])} ${pt(m(i))}`;
  return d + `M${pt(m(S.length - 2))}L${pt(S[S.length - 1])}`;
}
const curve = (P, k = 3) => splitQ(resample(P, k));
// Tapered brush ribbon along a polyline: width w at the belly, pointed ends (a gouache stroke, not a pen line).
function ribbon(P, w, k = 3, seed = 0, taper = 0.6) {
  const S = resample(P, k), n = S.length, L = [], R = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), tn = norm(sub(S[Math.min(n - 1, i + 1)], S[Math.max(0, i - 1)])), nn = perp(tn);
    const hw = 0.5 * w * (Math.sin(Math.PI * t) ** taper) * (1 + 0.18 * jr(i, seed));
    L.push(add(S[i], mul(nn, hw))); R.push(add(S[i], mul(nn, -hw)));
  }
  return `M${L.map(pt).join('L')}L${R.reverse().map(pt).join('L')}Z`;
}
const line = (d, stroke, w, extra = {}) => h('path', { d, fill: 'none', stroke, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...extra });
const fill = (d, c, extra = {}) => h('path', { d, fill: c, ...extra });
const tag = (kind, name) => `pelican:${kind}:${name}`;
const G = (name, kind, far, kids, extra = {}) => h('g', { 'data-detail': tag(kind, (far ? 'far-' : '') + name), ...extra }, kids);
// Hand-inked contour: wobbly warm-brown stroke + a faint offset pencil line (two strokes, one visual line).
function ink(P, I, w, seed, extra = {}, k = 3) {
  const S = wob(resample(P, k), 0.32, seed, false);
  return line(splitQ(S), I.ink, w, extra) + (I.pencil ? line(splitQ(offs(wob(S, 0.45, seed + 7, false), 0.9)), I.ink, w * 0.38, { opacity: 0.42 }) : '');
}

// A feather from base b along angle a (deg): length L, width w, bend k (tip swings toward +n by k·L), tip shape.
// The outline is a wobbled Catmull-Rom ring (hand-painted edge). Returns { d, r: rachis, P(s, t), hw }.
function feather(b, a, L, w, k = 0, tip = 'point', w0 = 0.55, seed = 0, jit = 0.28) {
  const u = dir(a), n = perp(u);
  const P = (s, t) => add(b, add(mul(u, s * L), mul(n, t + k * L * s * s)));
  const hw = w / 2;
  const ring = tip === 'round'
    ? [P(0, -hw * w0), P(0.3, -hw * 1.02), P(0.62, -hw * 1.04), P(0.86, -hw * 0.82), P(0.985, -hw * 0.3), P(0.985, hw * 0.3), P(0.86, hw * 0.82), P(0.62, hw * 1.04), P(0.3, hw * 1.02), P(0, hw * w0)]
    : [P(0, -hw * w0), P(0.3, -hw * 1.04), P(0.62, -hw * 0.86), P(0.86, -hw * 0.42), P(1, 0), P(0.86, hw * 0.42), P(0.62, hw * 0.86), P(0.3, hw * 1.04), P(0, hw * w0)];
  const d = smooth(jit ? wob(ring, jit * Math.min(1, w / 8), seed) : ring, true, 0.16);
  const r = `M${pt(P(0.08, 0))}L${pt(P(0.5, 0))}L${pt(P(0.86, 0))}`;
  return { d, r, P, hw };
}
// painted scallop arcs between successive points, bulging by `depth` along unit vector u (the feather-tip
// direction); each arc gets its own seeded depth so the row looks brushed, not stamped
function scallops(points, u, depth, seed = 0) {
  let d = '';
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1], m = lerp2(a, b, 0.5), q = depth * (1 + 0.22 * jr(i, seed));
    d += `M${pt(add(a, mul(u, 0.25 * jr(i + 9, seed))))}Q${pt(add(m, mul(u, q * 2)))} ${pt(b)}`;
  }
  return d;
}
const rowPts = (p0, p1, n) => Array.from({ length: n + 1 }, (_, i) => lerp2(p0, p1, i / n));
// small painted dabs (ellipses) scattered inside a box, seeded; one path
function dabs(n, x0, x1, y0, y1, r, seed, fn = null) {
  let d = '';
  for (let i = 0; i < n; i++) {
    const x = lerp(x0, x1, (jr(i, seed) + 1) / 2), y = lerp(y0, y1, (jr(i + 50, seed) + 1) / 2);
    if (fn && !fn(x, y)) continue;
    const rx = r * (0.7 + 0.4 * (jr(i + 90, seed) + 1) / 2), ry = rx * 0.55, a = 20 * jr(i + 130, seed);
    const u = mul(dir(a), rx), v = mul(perp(dir(a)), ry), c = [x, y];
    d += `M${pt(add(c, u))}Q${pt(add(add(c, u), v))} ${pt(add(c, v))}Q${pt(sub(add(c, v), u))} ${pt(sub(c, u))}Q${pt(sub(sub(c, u), v))} ${pt(sub(c, v))}Q${pt(sub(add(c, u), v))} ${pt(add(c, u))}Z`;
  }
  return d;
}

// ---------------------------------------------------------------- propatagium (lower-wing local, pure)
// e = elbow angle (deg) = wingLower.rot − wingUpper.rot (negative: the forearm swings up-forward of the upper arm).
// The shoulder in lower-local coordinates is S = −78·(cos e, −sin e). Fixed command counts (bake-friendly).
const LE_END = [73, -8.5];                         // leading edge ends at the carpal bend (continued by the hand slot)
export function propGeom(eDeg, full = true) {
  const e = eDeg * D2R, L = SKEL.wingUpper;
  const S = [-L * Math.cos(e), L * Math.sin(e)];
  const tb = [Math.sin(e), Math.cos(e)];          // trailing side of the upper arm (toward the cape)
  const E = LE_END, dv = norm(sub(E, S)), len = Math.hypot(E[0] - S[0], E[1] - S[1]);
  let nv = perp(dv); if (nv[1] > 0) nv = mul(nv, -1);          // outward normal (up-front)
  const S0 = add(S, mul(dv, 4));
  const C1 = add(add(S0, mul(dv, 0.34 * len)), mul(nv, 13)), C2 = add(add(E, mul(dv, -0.3 * len)), mul(nv, 7.5));
  const cub = t => { const m = 1 - t; return [0, 1].map(c => m * m * m * S0[c] + 3 * m * m * t * C1[c] + 3 * m * t * t * C2[c] + t * t * t * E[c]); };
  const tan = t => norm(sub(cub(Math.min(1, t + 0.01)), cub(Math.max(0, t - 0.01))));
  const out = t => { let nn = perp(tan(t)); if (nn[1] > 0) nn = mul(nn, -1); return nn; };
  const fillD = `M${pt(S0)}C${pt(C1)} ${pt(C2)} ${pt(E)}Q${pt([80, -5])} ${pt([79, 0])}L${pt([76, 6])}L${pt([0, 9])}` +
    `L${pt(add([-4, 0], mul(tb, 5)))}L${pt(add(mul(S, 0.55), mul(tb, 4)))}L${pt(add(S, mul(tb, 4)))}Z`;
  // samples carry a per-index seeded wobble: continuous in e, so the edge never shimmers as the elbow moves
  const samp = (t0, t1, n, off = 0, amp = 0, seed = 0) => Array.from({ length: n }, (_, i) => { const t = lerp(t0, t1, i / (n - 1)); return add(cub(t), mul(out(t), off + amp * jr(i, seed))); });
  // key line: a thin start fading into the breast, then the full-weight leading edge to the carpal bend
  const kp = samp(0.27, 0.9, 11, 0, 0.3, 3); kp[kp.length - 1] = cub(0.9);
  const key = splitQ(kp);
  if (!full) return { fill: fillD, key, S };           // far wing: fill, clip and key line only
  const keyThin = splitQ(samp(0.1, 0.3, 4));
  const pencil = splitQ(samp(0.3, 0.88, 9, -1.3, 0.45, 5));
  // marginal coverts: 11 small painted scallops just inside the leading edge, tips toward the trailing edge
  let marg = '';
  const mp = Array.from({ length: 12 }, (_, i) => { const t = lerp(0.2, 0.9, i / 11); return add(cub(t), mul(out(t), -(3.6 - 1.4 * t))); });
  for (let i = 0; i < mp.length - 1; i++) {
    const a = mp[i], b = mp[i + 1], m = lerp2(a, b, 0.5), tn = norm(sub(b, a));
    let nn = perp(tn); if (nn[1] > 0) nn = mul(nn, -1);
    marg += `M${pt(a)}Q${pt(add(m, mul(nn, (-3.2 + 1.2 * i / 11) * (1 + 0.2 * jr(i, 11)))))} ${pt(b)}`;
  }
  const rim = splitQ(samp(0.22, 0.86, 7, -1.9));
  // warm glow glaze just inside the leading edge (the lit top of the folded wing)
  const gp = samp(0.24, 0.86, 8, -5.2, 0.5, 8);
  const glow = `M${gp.map(pt).join('L')}` + [...samp(0.24, 0.86, 8, -2.6)].reverse().map(p => `L${pt(p)}`).join('') + 'Z';
  return { fill: fillD, key, keyThin, pencil, marg, rim, glow, S };
}

// ================================================================ WINGS
// ---- upper wing (shoulder-local; +x toward the elbow = down at rest, +y = back toward the tail)
function wingUpper(I, far) {
  const ter = [];
  for (let i = 0; i < 8; i++) {
    const u = i / 7;
    ter.push(feather(lerp2([-6, 12], [66, 1], u), lerp(100, 70, u), lerp(33, 23, u), lerp(13.5, 11, u), -0.05, 'round', 0.8, 40 + i));
  }
  const cape = smooth(wob([[-28, -14], [-30, 4], [-22, 15], [-8, 19], [14, 16.5], [40, 11], [66, 4.5], [84, 0], [88, -6], [70, -13], [40, -15], [8, -16]], 0.35, 3));
  const kids = [];
  // soft rose shadow the tertial tips cast on the flank
  kids.push(fill(ter.map(t => t.d).join(''), I.S2, { transform: 'translate(0.8 2)', opacity: far ? 0.6 : 0.75 }));
  kids.push(G('tertials', 'O', far, [
    ...ter.map(t => fill(t.d, I.P, { stroke: I.ink, 'stroke-width': far ? 1 : 1.3, 'stroke-linejoin': 'round' })),
    // each tertial: a rose glaze along its shaded (trailing) web and a warm lit edge on the other
    G('tertial-rose-glaze', 'T', far, fill(ter.map((t, i) => ribbon([t.P(0.18, t.hw * 0.42), t.P(0.55, t.hw * 0.5), t.P(0.9, t.hw * 0.28)], t.hw * 0.75, 3, i)).join(''), I.S)),
    far ? '' : line(ter.map(t => `M${pt(t.P(0.6, 0))}L${pt(t.P(0.9, 0.2))}`).join(''), I.inkSoft, 0.7, { opacity: 0.8, 'data-detail': tag('T', 'tertial-shafts') }),
  ]));
  // the scapular cape covers the tertial bases and merges into the body side (no outline on the body side)
  kids.push(fill(cape, I.P));
  kids.push(fill(cape, 'url(#pl-mottle)', { opacity: far ? 0.4 : 0.7 }));
  kids.push(G('scapular-shade-glaze', 'T', far, fill(ribbon([[-24, 11], [-8, 15.5], [14, 13.5], [40, 8.6], [66, 3], [82, -1]], 6.5, 3, 2), I.S)));
  const flow = norm([0.25, 1]);
  if (!far) kids.push(fill(dabs(9, -16, 60, -12, 4, 2.2, 5), I.glow, { 'data-detail': tag('T', 'cape-highlight-dabs') }));
  kids.push(line(scallops(rowPts([-18, 13], [42, 6], 5), flow, 2.2, 1), I.S2, far ? 1.1 : 1.45, { 'data-detail': tag('T', 'scapular-scallops'), 'data-tract': 'scapulars' }));
  kids.push(line(scallops(rowPts([-26, 5], [18, 0], 4), flow, 1.6, 2), I.S2, 1.15, { 'data-detail': tag('T', 'humeral-covert-scallops'), 'data-tract': 'humeral' }));
  if (!far) {
    kids.push(line(scallops(rowPts([-20, -4], [26, -8], 4), flow, 1.3, 3), I.S, 1, { 'data-detail': tag('T', 'scapular-fine-row'), 'data-tract': 'scapulars' }));
  }
  return G('scapular-cape', 'O', far, kids);
}

// ---- lower wing (elbow-local; +x toward the wrist, +y = down below the arm line)
const PRIM = Array.from({ length: 5 }, (_, i) => { const u = i / 4; return { b: [lerp(66, 76, u), lerp(8, 3, u)], a: lerp(160, 140, u), L: lerp(90, 72, u), w: lerp(12, 13.5, u) }; });
const V = { rim: '' };
function wingLower(I, far, side) {
  const s = [], ref = n => `pl-${side}-${n}`;
  // secondaries: deep fringe hanging below the arm line, pale bloom edges, sheen strokes, shafts
  const sec = [];
  for (let i = 0; i < 10; i++) { const u = i / 9; sec.push(feather([lerp(-12, 62, u), lerp(5, 4, u)], lerp(106, 98, u), lerp(33, 27, u), 11.5, 0.05, 'round', 0.8, 60 + i)); }
  const secG = G('secondaries-fringe', 'O', far, [
    ...[...sec].reverse().map(t => fill(t.d, I.N, { stroke: I.ink, 'stroke-width': 0.8 })),
    G('secondary-sheen', 'T', far, fill(sec.map((t, i) => ribbon([t.P(0.3, 1.2), t.P(0.62, 1.8), t.P(0.9, 0.8)], 2.2, 2, i)).join(''), I.NS)),
    line(sec.map(t => `M${pt(t.P(0.5, -4.9))}Q${pt(t.P(0.78, -5.4))} ${pt(t.P(0.93, -2.6))}`).join(''), I.NB, far ? 0.8 : 1.05, { 'data-detail': tag('T', (far ? 'far-' : '') + 'secondary-pale-edges') }),
    far ? '' : line(sec.map(t => `M${pt(t.P(0.42, 0))}L${pt(t.P(0.86, 0))}`).join(''), I.NS, 0.75, { 'data-detail': tag('T', 'secondary-rachis') }),
  ]);
  // trailing primaries, folded under the secondaries (as in a real folded wing) and sweeping back and down from
  // the wrist past the fringe; rotated about the wrist by the wrist angle each frame, each can fan open (wave).
  const prim = PRIM.map((q, i) => feather(q.b, q.a, q.L, q.w, -0.07, 'point', 0.9, 80 + i));
  s.push(G('primaries-trailing', 'O', far, [
    h('g', { 'data-ref': ref('prims') }, prim.map((p, i) => h('g', { 'data-ref': ref('p' + i) }, fill(p.d, I.N, { stroke: I.ink, 'stroke-width': 0.95, 'stroke-linejoin': 'round' }),
      fill(ribbon([p.P(0.2, -1.4), p.P(0.55, -2.4), p.P(0.88, -1)], 2.4, 2, i), I.NS),
      far ? '' : line(`M${pt(p.P(0.5, p.hw * 0.72))}Q${pt(p.P(0.8, p.hw * 0.55))} ${pt(p.P(0.95, p.hw * 0.12))}`, I.NB, 0.8),
      far ? '' : line(p.r, I.NS, 0.8),
      far || i < 2 ? '' : line(`M${pt(p.P(0.55, 3.6))}L${pt(p.P(0.66, 1.3))}`, I.NB, 0.9)))),
    secG]));
  // covert panel: propatagium + arm-line fill (per frame), elbow cap, greater coverts, clipped rows, marginal row
  const g0 = propGeom(-58);
  const panel = [fill(g0.fill, I.P, { 'data-ref': ref('prop') }), h('circle', { cx: -2, cy: 2, r: 10, fill: I.P })];
  const gc = [];
  for (let i = 0; i < 10; i++) { const u = i / 9; gc.push(feather([lerp(-8, 70, u), -2], lerp(100, 94, u), 15, 10.5, 0.04, 'round', 1, 100 + i, 0.35)); }
  panel.push(h('g', { 'data-ref': ref('gc') }, G('greater-coverts', 'O', far, [
    fill(gc.map(t => t.d).join(''), I.P, { stroke: I.ink, 'stroke-width': far ? 1.1 : 1.45, 'stroke-linejoin': 'round' }), fill('M-10 -6L76 -7L78 0L-11 3Z', I.P),
    G('greater-covert-glaze', 'T', far, fill(gc.map((t, i) => ribbon([t.P(0.35, -t.hw * 0.45), t.P(0.7, -t.hw * 0.25), t.P(0.9, t.hw * 0.35)], 3.2, 2, i + 3)).join(''), I.S)),
    far ? '' : line(gc.slice(0, 8).map(t => `M${pt(t.P(0.5, 0))}L${pt(t.P(0.86, 0.3))}`).join(''), I.inkSoft, 0.75, { opacity: 0.75, 'data-detail': tag('T', 'greater-covert-shafts') }),
  ])));
  const down = [0.12, 1];
  if (!far) panel.push(fill(g0.glow, I.glow, { 'data-ref': ref('glow'), 'data-detail': tag('T', 'leading-edge-glow-glaze') }));
  panel.push(h('clipPath', { id: ref('clip') }, h('path', { d: g0.fill, 'data-ref': ref('clipP') })));
  panel.push(h('g', { 'clip-path': `url(#${ref('clip')})` },
    h('rect', { x: -90, y: -60, width: 180, height: 70, fill: 'url(#pl-mottle)', opacity: far ? 0.4 : 0.7 }),
    G('covert-under-glaze', 'T', far, fill(ribbon([[-40, -4], [-10, -3.4], [30, -4], [66, -5]], 6, 3, 6), I.S)),
    far ? '' : fill(dabs(14, -40, 60, -34, -10, 1.8, 9), I.glow, { 'data-detail': tag('T', 'covert-highlight-dabs') }),
    line(scallops(rowPts([-22, -14], [54, -15.4], 11), down, 1.7, 4) + scallops(rowPts([-30, -22], [42, -23.4], 12), down, 1.45, 5), I.S2, far ? 1 : 1.2, { 'data-detail': tag('T', (far ? 'far-' : '') + 'lesser-covert-rows'), 'data-tract': 'coverts' }),
    far ? '' : line(scallops(rowPts([-38, -30], [30, -31.4], 13), down, 1.25, 6), I.S2, 0.95, { 'data-tract': 'coverts' }),
    far ? '' : line(scallops(rowPts([-12, -6], [56, -7.2], 9), down, 2.1, 7), I.inkSoft, 1.25, { opacity: 0.8, 'data-detail': tag('T', 'median-covert-row'), 'data-tract': 'coverts' }),
    ''));
  if (!far) {
    panel.push(line(g0.marg, I.S2, 1.1, { 'data-ref': ref('marg'), 'data-detail': tag('T', 'marginal-coverts'), 'data-tract': 'coverts' }));
    panel.push(line(g0.rim, V.rim, 1.7, { 'data-ref': ref('rim'), 'data-detail': tag('O', 'wing-rim-light'), style: 'opacity:var(--pb-n-rimAlpha)' }));
    panel.push(line(g0.keyThin, I.ink, 1.2, { 'data-ref': ref('keyThin') }));
    panel.push(line(g0.pencil, I.ink, 0.8, { 'data-ref': ref('pencil'), opacity: 0.4, 'data-detail': tag('T', 'pencil-double-line') }));
    panel.push(line(g0.key, I.ink, 2.3, { 'data-ref': ref('key'), 'data-detail': tag('O', 'wing-leading-edge') }));
  } else {
    panel.push(line(g0.key, I.ink, 1.5, { 'data-ref': ref('key') }));
  }
  s.push(G('covert-panel', 'O', far, panel));
  return s.join('');
}

// ---- hand (wrist-local, pivot ON the grip; grip radius 6; bell at about (8,−8))
function fingerFeathers() {
  // five outer primaries leave the carpal bend at the front-top of the grip and share one wrap band round its
  // front; one by one they peel away, so five separate tips splay round the lower half of the grip, each curling
  // back at its end like a finger — never a coil of knuckles, never a brush. Returned innermost-last (on top).
  const F = [], R0 = 9.2, W = 6, a0 = -44;
  for (let i = 4; i >= 0; i--) {
    const a1 = 16 + 26 * i, n = 6 + i;
    const L = [], R = [], C = [];
    for (let j = 0; j <= n; j++) {
      const a = lerp(a0, a1, j / n), nr = dir(a), c = mul(nr, R0);
      C.push(c); L.push(add(c, mul(nr, W / 2))); R.push(add(c, mul(nr, -W / 2)));
    }
    const td = dir(a1 + 40), td2 = dir(a1 + 40 + 26), tipL = 19 - 1.1 * i, e = C[n];
    const nn = perp(td), nn2 = perp(td2);
    const mid = add(e, mul(td, tipL * 0.55)), tip = add(mid, mul(td2, tipL * 0.5));
    const m2 = lerp2(mid, tip, 0.55);
    const ring = [...L, add(mid, mul(nn, -W * 0.46)), add(m2, mul(nn2, -W * 0.36)), add(tip, mul(nn2, -W * 0.16)), add(tip, mul(td2, 0.9)), add(tip, mul(nn2, W * 0.1)), add(m2, mul(nn2, W * 0.24)), add(mid, mul(nn, W * 0.38)), ...R.reverse()];
    const d = smooth(wob(ring, 0.14, 200 + i), true, 0.15);
    // pale bloom along the outer (leading) edge of the free part of each finger: every tip reads on its own
    const o = W * 0.3;
    const edge = `M${pt(add(C[n - 1], mul(dir(lerp(a0, a1, (n - 1) / n)), o)))}Q${pt(add(e, mul(nn, -o)))} ${pt(add(mid, mul(nn, -o * 0.95)))}Q${pt(add(m2, mul(nn2, -o * 0.55)))} ${pt(lerp2(m2, tip, 0.7))}`;
    const sheen = ribbon([lerp2(e, mid, 0.1), lerp2(e, mid, 0.7), lerp2(mid, tip, 0.35)], 1.5, 2, 30 + i);
    F.push({ d, tip, edge, sheen, td2 });
  }
  return F;
}
function wingHand(I, far, side) {
  const s = [], ref = n => `pl-${side}-${n}`;
  // open fan (wave): six primaries splayed from the wrist; hidden while gripping
  const fan = [];
  for (let i = 0; i < 6; i++) fan.push(feather([-2 + i * 0.6, 2 - i * 0.8], lerp(52, -26, i / 5), lerp(42, 56, i / 5) - (i > 3 ? (i - 3) * 5 : 0), 12.5, -0.05, 'round', 0.8, 300 + i));
  // (the far wing never lets go of its grip, so only the near hand carries the fan)
  if (!far) s.push(h('g', { 'data-ref': ref('fan'), style: 'display:none' },
    [...fan].reverse().map((p, i) => h('g', { 'data-ref': ref('fan' + (5 - i)) }, fill(p.d, I.N, { stroke: I.ink, 'stroke-width': 1 }),
      fill(ribbon([p.P(0.15, 1.2), p.P(0.5, 2), p.P(0.85, 1)], 2.6, 2, i), I.NS),
      line(`M${pt(p.P(0.3, -4))}Q${pt(p.P(0.6, -5.4))} ${pt(p.P(0.88, -3))}`, I.NB, 1)))));
  const F = fingerFeathers();
  s.push(h('g', { 'data-ref': ref('grip') }, G('primary-fingers', 'O', far, [
    h('circle', { cx: -1, cy: 0, r: 7.6, fill: I.N }),        // the grip end-on is fully inside the hand
    ...F.map(p => fill(p.d, I.N, { stroke: I.ink, 'stroke-width': far ? 0.7 : 0.85, 'stroke-linejoin': 'round' }) + fill(p.sheen, I.NS) + line(p.edge, I.NB, far ? 0.75 : 0.95)),
    far ? '' : G('finger-tip-blooms', 'T', far, fill(F.map(p => ribbon([sub(p.tip, mul(p.td2, 3.6)), sub(p.tip, mul(p.td2, 1.6)), sub(p.tip, mul(p.td2, 0.3))], 1.2, 2, 3)).join(''), I.NB)),
  ])));
  // primary coverts: short deep feathers on the back of the hand, over the bases of the trailing primaries
  const pc = [];
  for (let i = 0; i < 4; i++) pc.push(feather([-6 - i * 2.6, -1 + i * 0.4], lerp(160, 126, i / 3), lerp(16, 12, i / 3), 7.5, -0.05, 'round', 0.9, 320 + i));
  s.push(G('primary-coverts', 'O', far, [...pc.map(p => fill(p.d, I.N, { stroke: I.ink, 'stroke-width': 0.85 })),
    line(pc.map(p => `M${pt(p.P(0.3, -p.hw * 0.6))}Q${pt(p.P(0.7, -p.hw * 0.8))} ${pt(p.P(0.95, -p.hw * 0.2))}`).join(''), I.NB, 0.8, { 'data-detail': tag('T', (far ? 'far-' : '') + 'primary-covert-edges') })]));
  // carpal bend: warm-white end of the leading edge folding over the top of the grip (the "palm" rests on the bar)
  const carpal = smooth(wob([[-21, -10], [-10, -15], [1, -13.6], [7.4, -8.4], [6.4, -3.2], [0, -1.6], [-8, -0.6], [-17, -1.6], [-22, -5]], 0.2, 12));
  s.push(G('carpal-bend', 'O', far, [fill(carpal, I.P),
    fill(ribbon([[-20, -3.6], [-10, -2.4], [0, -3], [5.6, -5]], 3.6, 3, 4), I.S, { 'data-detail': tag('T', (far ? 'far-' : '') + 'carpal-shade-glaze') }),
    ink([[-18, -11.6], [-9, -15.2], [2, -14.4], [7.2, -8.6], [6.4, -3.6]], I, far ? 1.3 : 2, 21, {}, 2),
    far ? '' : line('M-14 -6.4q2.3 2.6 4.6 0.1q2.4 2.4 4.6 -0.1q2.1 2.3 4.2 0M-9 -3q2 2.1 4 0', I.S2, 1, { 'data-detail': tag('T', 'carpal-covert-scallops') })]));
  // alula: three small feathers on the leading edge of the wrist; rotates about its base for the bell flick
  const al = [];
  for (let i = 0; i < 3; i++) al.push(feather([-4 - i * 2.4, -13 + i * 0.9], lerp(-16, -4, i / 2), lerp(11.5, 8, i / 2), 5, 0.08, 'round', 0.9, 340 + i));
  s.push(h('g', { 'data-ref': ref('alula') }, G('alula', 'O', far, [
    ...[...al].reverse().map(p => fill(p.d, I.N, { stroke: I.ink, 'stroke-width': 0.8 })),
    line(al.map(p => `M${pt(p.P(0.25, -p.hw * 0.55))}Q${pt(p.P(0.65, -p.hw * 0.8))} ${pt(p.P(0.94, -p.hw * 0.1))}`).join(''), I.NB, 0.7)])));
  return s.join('');
}

// ================================================================ LEGS
// Knee cuff: a fringe of pointed feather tips round the knee over the sector the shank can leave through
// (33..108° in thigh-local, ± the tarsus half-width); notches stay at r ≥ 16.8 so bare skin always starts
// ≥ 15 u below the knee pivot. Tips curl toward the rear (the feathers flow down and back).
function cuffGeom(K) {
  const A0 = -12, A1 = 146, n = 8, step = (A1 - A0) / n;
  const at = (a, r) => add([K, 0], mul(dir(a), r));
  const N = [], T = [];
  for (let j = 0; j <= n; j++) N.push(at(A0 + j * step, j === 0 || j === n ? 12 : 16.8));
  let d = `M${pt([K - 16, -9.8])}L${pt(N[0])}`, edge = '', glaze = '';
  for (let j = 0; j < n; j++) {
    const a = A0 + j * step, r = 21.6 + [0, 1.4, -0.6, 1.8, 0.2, 1.2, -0.4, 0.8][j];
    const tip = at(a + step * 0.72, r), c1 = at(a + step * 0.28, r - 1.2), c2 = at(a + step * 0.95, r - 3.6);
    T.push(tip);
    d += `Q${pt(c1)} ${pt(tip)}Q${pt(c2)} ${pt(N[j + 1])}`;
    edge += `M${pt(N[j])}Q${pt(c1)} ${pt(tip)}M${pt(tip)}Q${pt(c2)} ${pt(N[j + 1])}`;
    // rose glaze in the shadowed half of every cuff feather
    glaze += ribbon([at(a + step * 0.62, 13), at(a + step * 0.78, 17.6), at(a + step * 0.8, r - 1.6)], 2.6, 2, j);
  }
  d += `L${pt([K - 16, 11.6])}Z`;
  return { d, edge, T, glaze };
}
function thigh(I, far) {
  const K = SKEL.thigh;
  // drumstick: broad where it leaves the belly, tapering to a slim feathered shin at the knee
  const top = [[-14, -25], [12, -27], [44, -21], [76, -14], [106, -10.5], [128, -10], [140, -9.6]];
  const bottom = [[140, 11.6], [112, 11.5], [86, 11], [60, 9.5], [36, 6.5], [14, 4], [-4, 3], [-17, -8]];
  const cuff = cuffGeom(K);
  const body = smooth(wob([...top, ...bottom], 0.3, 7));
  const kids = [fill(body, I.P), fill(cuff.d, I.P)];
  kids.push(fill(body, 'url(#pl-mottle)', { opacity: far ? 0.4 : 0.6, 'data-detail': tag('T', (far ? 'far-' : '') + 'gouache-mottle') }));
  // shadow side: a broad rose glaze along the rear, a deeper rose core line inside it
  kids.push(G('trouser-shade-glaze', 'T', far, [fill(ribbon([[30, 3.5], [60, 6.4], [90, 7.6], [120, 8], [138, 8.2]], 7.5, 3, 3, 0.45), I.S),
    fill(ribbon([[50, 7.4], [86, 9.2], [124, 9.6]], 2.4, 3, 4), I.S2, { opacity: 0.85 })]));
  kids.push(fill(cuff.glaze, I.S, { 'data-detail': tag('T', (far ? 'far-' : '') + 'cuff-feather-glaze') }));
  if (!far) {
    kids.push(fill(ribbon([[56, -15.8], [80, -11.6], [106, -8.4], [130, -7.6]], 3.2, 3, 5), I.glow, { 'data-detail': tag('T', 'trouser-lit-edge') }));
    // dry-brush flecks where the feathers break the silhouette
    kids.push(fill(ribbon([[70, -13.4], [76, -15.2], [81, -14.8]], 1.3, 2, 1) + ribbon([[98, -10.6], [103, -12.2], [107, -11.6]], 1.2, 2, 2) +
      ribbon([[80, 10.6], [86, 12.8], [92, 12.4]], 1.2, 2, 3) + ribbon([[108, 11.2], [113, 13], [118, 12.4]], 1.1, 2, 4), I.ink, { opacity: 0.7, 'data-detail': tag('T', 'dry-brush-feather-breaks') }));
  }
  if (!far) {
      kids.push(ink([[50, -19.6], [76, -14], [106, -10.5], [128, -10], [141, -8.8], [150, -5.4], [K + 11.7, -2.5]], I, 2.1, 1));
      kids.push(ink([[44, 7.8], [60, 9.5], [86, 11], [112, 11.5], [128, 11.6]], I, 2, 2));
  }
  // contour-feather scallops flowing down the leg (tips toward the knee), shrinking toward the knee
  const u = [1, 0.1];
  kids.push(line(scallops(rowPts([46, -15.5], [54, 6], 4), u, 2.6, 1) + scallops(rowPts([74, -12], [78, 9], 3), u, 2.5, 2) +
    scallops(rowPts([100, -9.6], [102, 10], 3), u, 2.2, 3) + scallops(rowPts([124, -8.6], [124, 9.6], 3), u, 2, 4), I.S2, far ? 1.05 : 1.35, { 'data-detail': tag('T', (far ? 'far-' : '') + 'trouser-feather-scallops'), 'data-tract': 'leg' }));
  if (!far) {
    // front + rear key lines only where the leg is outside the body; the fringe line
    kids.push(line(cuff.edge, I.ink, 1.6, { 'data-detail': tag('O', 'knee-feather-cuff') }));
    kids.push(line(cuff.T.map(t => `M${pt(lerp2([K, 0], t, 0.55))}L${pt(lerp2([K, 0], t, 0.82))}`).join(''), I.inkSoft, 0.75, { opacity: 0.8, 'data-detail': tag('T', 'cuff-feather-shafts') }));
    kids.push(line('M62 6.4q9 2.6 18 2.4M90 8.2q9 1.8 16 1.2M112 8.6q6 1.2 11 0.2', I.inkSoft, 0.8, { opacity: 0.7, 'data-detail': tag('T', 'trouser-rear-hatching') }));
    kids.push(line('M24 -21q5 3 4 8M35 -20.4q4.6 3.2 3.4 8.2M28 1.6q3.4 -2 7.2 -0.8', I.S2, 1.2, { 'data-detail': tag('O', 'flank-plume-curls') }));
    kids.push(line(curve([[64, -15.4], [88, -12.6], [112, -10.2], [132, -9.6]]), V.rim, 1.4, { 'data-ref': 'pl-thighRim', 'data-detail': tag('O', 'thigh-rim-light'), style: 'opacity:var(--pb-n-rimAlpha)' }));
  } else {
    kids.push(ink([[56, -18.8], [86, -12.8], [112, -10.2], [136, -9.6], [148, -6]], I, 1.3, 3));
    kids.push(ink([[60, 9.2], [86, 10.8], [112, 11.3], [128, 11.4]], I, 1.2, 4));
    kids.push(line(cuff.edge, I.ink, 1.1, { 'data-detail': tag('O', 'far-knee-feather-cuff') }));
  }
  return G('thigh-trousers', 'O', far, kids);
}
// ---- shank / tarsus (knee-local; +x toward the ankle, +y = rear)
function shank(I, far) {
  const L = SKEL.shank;
  const hw = x => lerp(6.8, 5, x / L);               // half width 13.6 -> 10
  const outline = `M0 ${f(-hw(0))}C40 ${f(-hw(40))} 90 ${f(-hw(90))} ${L} ${f(-hw(L))}A5 5 0 0 1 ${L} ${f(hw(L))}` +
    `C92 ${f(hw(92))} 36 ${f(hw(36) + 0.4)} 29 ${f(hw(29) + 0.6)}C26 ${f(hw(26) + 3.6)} 20 ${f(hw(20) + 3.8)} 16 ${f(hw(16) + 1.2)}C10 ${f(hw(10))} 4 ${f(hw(0))} 0 ${f(hw(0))}Z`;
  // intertarsal knuckle: the joint bulges forward just below the cuff and the tarsus leaves it at a slight angle
  const knuckle = 'M13 -6.4C16 -10.6 25 -11 30 -7.6C33 -5.6 34 -3 33 0L14 0Z';
  const kids = [fill(outline, I.O), fill(knuckle, I.O)];
  // hand-inked contour: front and rear edges (stops short of the ankle so no line crosses the joint)
  kids.push(ink([[31, -hw(31) - 0.2], [70, -hw(70) - 0.1], [110, -hw(110)], [L - 3, -hw(L - 3)]], I, far ? 1.1 : 1.55, 11));
  kids.push(ink([[34, hw(34) + 0.2], [72, hw(72)], [110, hw(110)], [L - 3, hw(L - 3)]], I, far ? 1 : 1.35, 12));
  // rear shade band keeps the tarsus round; reticulate rear scales sit on it
  const band = `M30 ${f(hw(30) - 3)}C70 ${f(hw(70) - 3.4)} 110 ${f(hw(110) - 3)} ${L} ${f(hw(L) - 2.4)}L${L} ${f(hw(L))}C110 ${f(hw(110))} 70 ${f(hw(70))} 30 ${f(hw(30))}Z`;
  let rt = '';
  for (let x = 34, k = 0; x <= 124; x += 4.6, k++) { const w = hw(x), y = w * (k % 2 ? 0.66 : 0.36); rt += `M${f(x)} ${f(y)}q1.6 -1.4 3.3 0q-1.7 1.3 -3.3 0`; }
  kids.push(G('tarsus-shade-band', 'T', far, [fill(band, I.OL), line(rt, I.OD, 0.75, { 'data-detail': tag('T', (far ? 'far-' : '') + 'tarsus-reticulate-scales') })]));
  // painted scale rings (transverse scutes) across the front: a dark ring and a lit lip just below each one
  let sc = '', lip = '';
  for (let x = 24, j = 0; x <= 126; x += 7.4, j++) {
    const w = hw(x), dx = 0.5 * jr(j, 31);
    sc += `M${f(x + dx)} ${f(-w + 0.3)}Q${f(x + 2.8 + dx)} ${f(-w * 0.15)} ${f(x + 0.8 + dx)} ${f(w * 0.5)}`;
    lip += `M${f(x + 1.9 + dx)} ${f(-w + 1.1)}Q${f(x + 3.9 + dx)} ${f(-w * 0.45)} ${f(x + 3.4 + dx)} ${f(-w * 0.05)}`;
  }
  if (!far) {
    kids.push(fill(dabs(10, 36, 124, -2, 1.5, 0.9, 17), I.OL, { opacity: 0.7, 'data-detail': tag('T', 'tarsus-skin-mottle') }));
  }
  kids.push(line(sc, I.OD, far ? 0.9 : 1.15, { 'data-detail': tag('T', (far ? 'far-' : '') + 'tarsus-scale-rings') }));
  if (!far) {
    kids.push(line(lip, I.OH, 0.9, { 'data-detail': tag('T', 'scale-ring-lit-lips') }));
    // gouache highlight: a broken lit stroke down the shin
    kids.push(fill(ribbon([[30, -hw(30) + 2.3], [44, -hw(44) + 2.2], [52, -hw(52) + 2.3]], 1.8, 2, 1) + ribbon([[62, -hw(62) + 2.2], [80, -hw(80) + 2.1], [90, -hw(90) + 2.2]], 1.9, 2, 2) +
      ribbon([[100, -hw(100) + 2], [112, -hw(112) + 2], [119, -hw(119) + 2.1]], 1.6, 2, 3), I.OH, { 'data-detail': tag('T', 'tarsus-highlight') }));
    // intertarsal heel pad: the bird's "backward knee" just below the feather cuff
    kids.push(line('M17 7.6Q21 11.4 23.4 10.6Q27 9.6 29.5 7.4M19.5 5.2q3.6 2.4 7.2 0', I.OD, 1.25, { 'data-detail': tag('O', 'intertarsal-heel-pad') }));
    kids.push(line('M15.6 -7.8Q23 -11.6 30.4 -7.2M18 -3.6Q23 -1.2 28.6 -3.8M31.6 -5.4Q34.6 -1 31.4 3.2', I.OD, 1.05, { 'data-detail': tag('O', 'intertarsal-knuckle') }));
  } else {
    kids.push(line('M17 7.6Q21 11.4 23.4 10.6Q27 9.6 29.5 7.4M15.6 -7.8Q23 -11.6 30.4 -7.2', I.OD, 1, { 'data-detail': tag('O', 'far-intertarsal-knuckle') }));
  }
  return G('tarsus', 'O', far, kids);
}
// ---- foot (ankle-local; ball (17,9) sits on the pedal spindle; pedal top face at y = 6 spans x ≈ 4..30)
// Totipalmate: toes IV (outer, nearest, longest), III, II and the hallux I, all joined by webs. The near toes
// drape over the pedal's front edge; the farther ones are seen across its top face (a slightly raised viewpoint
// fans them so every web is visible).
const SOLE = 6, EDGE = 30;
const TOES = [
  { n: 'IV', root: [8, 4.3], mid: [EDGE - 1, 4.8], tip: [40.5, 12.4], w: 4.3 },
  { n: 'III', root: [8, 2.5], mid: [EDGE - 1, 2.4], tip: [41, 6.6], w: 3.9 },
  { n: 'II', root: [7, 0.7], mid: [EDGE - 4, -0.8], tip: [38, -0.6], w: 3.5 },
  { n: 'I', root: [-2.5, -0.4], mid: [9, -5], tip: [20.5, -8.6], w: 3.1 },
];
function toeD(t) {
  const a = t.root, b = t.mid, c = t.tip, w = t.w / 2;
  const n1 = perp(norm(sub(b, a))), n2 = perp(norm(sub(c, b)));
  return smooth([add(a, mul(n1, -w)), add(b, mul(n1, -w * 0.95)), add(lerp2(b, c, 0.6), mul(n2, -w * 0.75)), add(c, mul(n2, -0.4)), add(c, mul(norm(sub(c, b)), 1.2)), add(c, mul(n2, 0.6)), add(lerp2(b, c, 0.6), mul(n2, w * 0.8)), add(b, mul(n1, w)), add(a, mul(n1, w))], true, 0.14);
}
function foot(I, far, side) {
  const ref = n => `pl-${side}-${n}`, T = TOES;
  const webs = [], webShade = [];
  for (let i = 0; i < 3; i++) {
    const A = T[i], B = T[i + 1];
    const tipA = lerp2(A.mid, A.tip, 0.92), tipB = lerp2(B.mid, B.tip, 0.92);
    const dip = add(lerp2(tipA, tipB, 0.5), mul(norm(sub(lerp2(A.root, B.root, 0.5), lerp2(tipA, tipB, 0.5))), 5.5));
    webs.push(`M${pt(A.root)}L${pt(A.mid)}L${pt(tipA)}Q${pt(dip)} ${pt(tipB)}L${pt(B.mid)}L${pt(B.root)}Z`);
    // the web sags between the toes: a warm shade glaze along its scalloped trailing edge
    webShade.push(ribbon([lerp2(tipA, dip, 0.15), lerp2(tipA, dip, 0.6), dip, lerp2(dip, tipB, 0.45), lerp2(dip, tipB, 0.85)], 1.8, 2, i));
  }
  const pleats = [];
  for (let i = 0; i < 2; i++) {
    const A = T[i], B = T[i + 1];
    for (const k of [0.33, 0.66]) { const r = lerp2(A.root, B.root, k), m = lerp2(lerp2(A.mid, A.tip, 0.5), lerp2(B.mid, B.tip, 0.5), k); pleats.push(`M${pt(lerp2(r, m, 0.3))}Q${pt(add(lerp2(r, m, 0.62), [0.4, 0.5]))} ${pt(lerp2(r, m, 0.92))}`); }
  }
  const W = I.OW, Tc = I.O;
  const st = { stroke: I.ink, 'stroke-width': far ? 0.75 : 0.85, 'stroke-linejoin': 'round' };
  const ankle = G('ankle-joint', 'O', far, [fill(`M-5.4 -3.2C-6.4 -8 5.4 -8.6 6.8 -3.4C8.6 0.6 13 1.6 18 2.4L18 ${SOLE}L-3 ${SOLE}C-6 ${SOLE - 0.6} -7.4 3 -5.4 -3.2Z`, Tc),
    fill(`M-3.8 ${SOLE - 2.2}Q4 ${SOLE - 3.4} 12 ${SOLE - 1.6}L12 ${SOLE}L-3 ${SOLE}Z`, I.OL, { 'data-detail': tag('O', (far ? 'far-' : '') + 'metatarsal-pad') }),
    far ? '' : line('M-4.4 -1.2Q-1 1.8 3.8 0.2M-3.4 3.2Q0 4.8 4.6 3.4', I.OD, 0.9, { 'data-detail': tag('T', 'ankle-creases') }),
    far ? '' : fill(ribbon([[-4.6, -4.4], [-1, -6.6], [4, -6]], 1.6, 2, 5), I.OH, { 'data-detail': tag('T', 'ankle-knob-highlight') })]);
  // toes II–IV with their scutes, highlights, pads and claws (near toe on top)
  const toeKids = [T[2], T[1], T[0]].map(t => fill(toeD(t), Tc, st));
  if (!far) {
    toeKids.push(fill(T.slice(0, 2).map(t => { const p = lerp2(t.mid, t.tip, 0.55), nn = perp(norm(sub(t.tip, t.mid))); const c = add(p, mul(nn, t.w * 0.45)); return `M${pt(add(c, [-2.2, 0]))}q2.2 2.6 4.4 0z`; }).join(''), I.pad, { 'data-detail': tag('O', 'toe-pads') }));
    toeKids.push(line(T.slice(0, 3).map(t => { const nn = perp(norm(sub(t.tip, t.root))); return `M${pt(add(lerp2(t.root, t.mid, 0.35), mul(nn, -t.w * 0.2)))}L${pt(add(lerp2(t.mid, t.tip, 0.5), mul(nn, -t.w * 0.18)))}`; }).join(''), I.OH, 0.95, { 'data-detail': tag('T', 'toe-highlights') }));
  }
  let sc = '', scI = '';
  for (const t of T) {
    const segs = t.n === 'I' ? 2 : 4;
    for (let j = 1; j <= segs; j++) {
      const u = j / (segs + 1), p = u < 0.5 ? lerp2(t.root, t.mid, u * 2) : lerp2(t.mid, t.tip, (u - 0.5) * 2), nn = perp(norm(sub(t.tip, t.root)));
      const seg = `M${pt(add(p, mul(nn, -t.w * 0.42)))}Q${pt(add(add(p, mul(nn, -t.w * 0.05)), mul(norm(sub(t.tip, t.root)), 0.7)))} ${pt(add(p, mul(nn, t.w * 0.32)))}`;
      if (t.n === 'I') scI += seg; else sc += seg;
    }
  }
  toeKids.push(line(sc, I.OD, far ? 0.6 : 0.72, { 'data-detail': tag('T', (far ? 'far-' : '') + 'toe-scutes') }));
  const claws = T.map(t => { const u = norm(sub(t.tip, t.mid)), nn = perp(u), c = t.tip; return `M${pt(add(c, mul(nn, -t.w * 0.4)))}Q${pt(add(add(c, mul(u, 3.4)), mul(nn, -0.2)))} ${pt(add(add(c, mul(u, 3.3)), mul(nn, 2.6)))}Q${pt(add(c, mul(u, 1.4)))} ${pt(add(c, mul(nn, t.w * 0.45)))}Z`; }).join('');
  toeKids.push(fill(claws, I.claw, { 'data-detail': tag('O', far ? 'far-claws' : 'claws') }));
  // the webbed foot: hallux + its web (farthest), the other two webs with pleats, then the toes
  const foot = G('totipalmate-webs', 'O', far, [
    G('hallux-web', 'O', far, [fill(webs[2], W, st), fill(webShade[2], I.OL, { opacity: 0.8 }), fill(toeD(T[3]), Tc, st), line(scI, I.OD, far ? 0.6 : 0.72)]),
    fill(webs[1], W, st), fill(webs[0], W, st),
    G('web-sag-glaze', 'T', far, fill(webShade[0] + webShade[1], I.OL, { opacity: 0.8 })),
    far ? '' : line(pleats.join(''), I.OL, 0.75, { 'data-detail': tag('T', 'web-pleats') }),
    G('toes', 'O', far, toeKids)]);
  const out = [h('g', { 'data-ref': ref('toes') }, h('g', { 'data-ref': ref('webs') }, foot)), ankle];
  return out.join('');
}

// ================================================================ build
// Gouache blotch texture (ONE static pattern, slot-local user space, so it moves with each part): soft rose and
// warm-white patches like dried paint, used at low opacity over the plumage. No filter.
function mottle(v) {
  let a = '', b = '';
  for (let i = 0; i < 10; i++) {   // blotches stay inside the tile (no cut edges at the tile seams)
    const r = 2 + 1.8 * (jr(i, 73) + 1) / 2, x = r + 1 + (44 - 2 * r) * (jr(i, 71) + 1) / 2, y = r + 1 + (44 - 2 * r) * (jr(i, 72) + 1) / 2;
    const P = Array.from({ length: 7 }, (_, k) => add([x, y], mul(dir(k * 360 / 7 + 30 * jr(i, 74)), r * (0.78 + 0.2 * jr(k + i * 7, 75)))));
    if (i % 3) a += smooth(P); else b += smooth(P);
  }
  return h('pattern', { id: 'pl-mottle', patternUnits: 'userSpaceOnUse', width: 46, height: 46, patternTransform: 'rotate(17)' },
    fill(a, v('plRose'), { opacity: 0.3 }), fill(b, v('plGlow'), { opacity: 0.7 }),
    line('M6 30q6 -3 12 -1M26 9q5 -2.4 11 -0.6', v('plRose'), 1.1, { opacity: 0.45 }));
}
export function build({ v }) {
  V.rim = v('rim');
  const pal = pre => ({
    ink: v(pre + 'Ink'), inkSoft: v(pre + 'InkSoft'), P: v(pre + 'Paper'), glow: v(pre + 'Glow'), S: v(pre + 'Rose'), S2: v(pre + 'RoseDeep'),
    N: v(pre + 'Deep'), NS: v(pre + 'Sheen'), NB: v(pre + 'Bloom'), O: v(pre + 'Foot'), OH: v(pre + 'FootHi'), OL: v(pre + 'FootLo'),
    OD: v(pre + 'FootDeep'), OW: v(pre + 'Web'), pad: v(pre + 'Pad'), claw: v(pre + 'Claw'),
  });
  const near = { ...pal('pl'), pencil: true }, farI = pal('plF');
  const s = {};
  for (const side of ['Near', 'Far']) {
    const far = side === 'Far', I = far ? farI : near;
    s['thigh' + side] = thigh(I, far);
    s['shank' + side] = shank(I, far);
    s['foot' + side] = foot(I, far, side);
    s['wing' + side + 'Upper'] = wingUpper(I, far);
    s['wing' + side + 'Lower'] = wingLower(I, far, side);
    s['wing' + side + 'Hand'] = wingHand(I, far, side);
  }
  return { defs: mottle(v), slots: s };
}

// ================================================================ attach / update
// Pure per-frame state from a pose (shared by update() and bake()).
export function limbState(pose, reduced = false) {
  const J = pose.joints, out = {};
  for (const side of ['Near', 'Far']) {
    const U = J['wing' + side + 'Upper'], L = J['wing' + side + 'Lower'], H = J['wing' + side + 'Hand'];
    if (!U || !L || !H) continue;
    const wg = pose.wing?.[side] || {}, ft = pose.feet?.[side] || {};
    const open = wg.open || 0, grip = wg.grip ?? 1, lag = reduced ? 0 : (wg.primLag || 0);
    out[side] = {
      e: wrapA(L.rot - U.rot),
      prims: `rotate(${f(wrapA(H.rot - L.rot) + 0.35 * lag)} 74 0)`,
      p: PRIM.map((q, i) => { const k = clamp(open * 1.35 - (4 - i) * 0.09, 0, 1); return k > 0.001 ? `rotate(${f(-k * (26 + i * 17))} ${f(q.b[0])} ${f(q.b[1])})` : 'rotate(0)'; }),
      fanOn: grip < 0.5,
      fan: Array.from({ length: 6 }, (_, i) => `rotate(${f((1 - clamp(open * 1.3 - i * 0.06, 0, 1)) * (40 + i * 10))})`),
      alula: `rotate(${f(24 * (wg.thumb || 0))} -5 -13)`,
      gc: `translate(0 ${f(-0.9 * (wg.covertLift || 0))})`,
      toes: `rotate(${f(2 + 7 * (ft.curl ?? 0.3))} ${EDGE} ${SOLE})`,
      webs: `translate(0 ${f(SOLE * 0.1 * (ft.press ?? 0))}) scale(1 ${f(1 - 0.1 * (ft.press ?? 0))})`,
    };
  }
  return out;
}
const PER_FRAME = ['marg', 'key', 'keyThin', 'pencil', 'rim', 'glow'];
export function attach(svg) {
  const r = refs(svg, 'pl-');
  const last = {};
  const set = (key, el, attr, val) => { if (!el || last[key] === val) return; last[key] = val; el.setAttribute(attr, val); };
  const show = (key, el, on) => { if (!el || last[key] === on) return; last[key] = on; el.style.display = on ? '' : 'none'; };
  const lastE = {};
  return {
    update(fr) {
      const pose = fr.pose; if (!pose || !pose.joints) return;
      const st = limbState(pose, fr.reduced);
      for (const side of ['Near', 'Far']) {
        const S = st[side]; if (!S) continue;
        if (lastE[side] === undefined || Math.abs(lastE[side] - S.e) > 0.15) {
          lastE[side] = S.e;
          const g = propGeom(S.e, side === 'Near');
          r[side + '-prop']?.setAttribute('d', g.fill);
          r[side + '-clipP']?.setAttribute('d', g.fill);
          for (const k of (side === 'Near' ? PER_FRAME : ['key'])) r[side + '-' + k]?.setAttribute('d', g[k]);
        }
        set(side + 'prims', r[side + '-prims'], 'transform', S.prims);
        S.p.forEach((v, i) => set(side + 'p' + i, r[side + '-p' + i], 'transform', v));
        show(side + 'fan', r[side + '-fan'], S.fanOn);
        show(side + 'grip', r[side + '-grip'], !S.fanOn);
        if (S.fanOn) S.fan.forEach((v, i) => set(side + 'fan' + i, r[side + '-fan' + i], 'transform', v));
        set(side + 'alula', r[side + '-alula'], 'transform', S.alula);
        set(side + 'gc', r[side + '-gc'], 'transform', S.gc);
        set(side + 'toes', r[side + '-toes'], 'transform', S.toes);
        set(side + 'webs', r[side + '-webs'], 'transform', S.webs);
      }
      // rim light follows the light (front when the sun/moon is ahead of the rider)
      const lx = (fr.night > 0.5 ? fr.moon?.x : fr.sun?.x) ?? 1200;
      show('rim', r['Near-rim'], lx > 740);
      show('thighRim', r['thighRim'], lx > 740);
    },
    // Baker: spec.poseAt(phase) -> pose (phase 0..1 over spec.dur seconds). Samples the per-frame state.
    bake(kit, spec = {}) {
      if (!spec.poseAt) return [];
      const n = spec.samples || 60, dur = spec.dur || 1, out = [];
      const S = Array.from({ length: n + 1 }, (_, i) => limbState(spec.poseAt(i / n), false));
      const kt = S.map((_, i) => +(i / n).toFixed(4));
      const attr = (sel, a, values) => ({ selector: sel, kind: 'attr', attr: a, values, keyTimes: kt, dur });
      for (const side of ['Near', 'Far']) {
        if (!S[0][side]) continue;
        const props = S.map(s => propGeom(s[side].e, side === 'Near'));
        out.push(attr(`[data-ref="pl-${side}-prop"]`, 'd', props.map(g => g.fill)), attr(`[data-ref="pl-${side}-clipP"]`, 'd', props.map(g => g.fill)));
        for (const k of (side === 'Near' ? PER_FRAME : ['key'])) out.push(attr(`[data-ref="pl-${side}-${k}"]`, 'd', props.map(g => g[k])));
        for (const k of ['prims', 'alula', 'gc', 'toes', 'webs']) out.push(attr(`[data-ref="pl-${side}-${k}"]`, 'transform', S.map(s => s[side][k])));
      }
      return out;
    },
  };
}

export const detailItems = [
  ['tertials', 'O', 'eight overlapping rounded tertials forming the trailing edge of the folded wing (wobbled painted edges)'],
  ['tertial-rose-glaze', 'T', 'rose-grey glaze on the shaded web of every tertial'],
  ['tertial-shafts', 'T', 'soft brown shafts on the tertials'],
  ['scapular-cape', 'O', 'broad warm-white covert base over the body side; merges into the body at the shoulder'],
  ['scapular-shade-glaze', 'T', 'tapered rose glaze where the cape overlaps the tertials'],
  ['scapular-scallops', 'T', 'painted scapular scallop row, tips toward the tail'],
  ['humeral-covert-scallops', 'T', 'finer humeral covert row nearest the shoulder'],
  ['scapular-fine-row', 'T', 'a third, paler scallop row high on the cape'],
  ['cape-highlight-dabs', 'T', 'warm-white gouache dabs on the lit cape'],
  ['secondaries-fringe', 'O', 'ten deep secondaries hanging below the arm line as a fringe'],
  ['secondary-sheen', 'T', 'plum sheen brush strokes down each secondary'],
  ['secondary-pale-edges', 'T', "pale bloom edges on the secondaries (the pelican's grey bloom)"],
  ['secondary-rachis', 'T', 'sheen shafts of the secondaries'],
  ['primaries-trailing', 'O', 'five deep primaries sweeping back and down from the wrist, sheen strokes, pale edges and emarginations (rotate with the hand; fan open in sequence in the wave)'],
  ['covert-panel', 'O', 'propatagium: skin fold shoulder→wrist, outline rebuilt from the elbow angle so it never seams'],
  ['greater-coverts', 'O', 'ten rounded greater coverts over the secondary bases (lift in gusts)'],
  ['greater-covert-glaze', 'T', 'rose glaze crescent on each greater covert'],
  ['greater-covert-shafts', 'T', 'shaft ticks on the greater coverts'],
  ['covert-under-glaze', 'T', 'rose glaze over the arm line where the coverts overlap'],
  ['median-covert-row', 'T', 'median covert scallop row in brown'],
  ['lesser-covert-rows', 'T', 'three lesser covert scallop rows, finer toward the leading edge'],
  ['covert-highlight-dabs', 'T', 'warm-white gouache dabs among the lesser coverts'],
  ['leading-edge-glow-glaze', 'T', 'warm lit glaze just inside the leading edge (per frame)'],
  ['marginal-coverts', 'T', 'tiny marginal coverts along the leading edge (per frame)'],
  ['wing-rim-light', 'O', 'rim light inside the leading edge on the sun side'],
  ['pencil-double-line', 'T', 'faint offset pencil line doubling the leading-edge ink (per frame)'],
  ['wing-leading-edge', 'O', 'hand-wobbled warm-brown key line of the leading edge, thin where it leaves the breast'],
  ['primary-fingers', 'O', 'five outer primaries wrapping the grip, peeling off into five separate tips that curl like fingers, each with a pale bloom edge and a sheen stroke'],
  ['finger-tip-blooms', 'T', 'pale bloom strokes at the ends of the five curled finger tips'],
  ['primary-coverts', 'O', 'short deep primary coverts on the back of the hand'],
  ['primary-covert-edges', 'T', 'pale bloom edges on the primary coverts'],
  ['carpal-bend', 'O', 'warm-white bend of the wing folding over the wrist; ink line continuing the leading edge'],
  ['carpal-shade-glaze', 'T', 'rose glaze under the carpal bend'],
  ['carpal-covert-scallops', 'T', 'small covert scallops on the carpal bend'],
  ['alula', 'O', 'three-feather alula (bastard wing) that flicks the bell'],
  ['thigh-trousers', 'O', 'feathered warm-white thigh merging into the belly, tapering to a slim shin; gouache mottle texture'],
  ['trouser-shade-glaze', 'T', 'broad rose glaze + deeper core on the shadow side of the trousers'],
  ['trouser-lit-edge', 'T', 'warm lit brush stroke along the front of the trousers'],
  ['thigh-rim-light', 'O', 'rim light along the front of the thigh on the sun side'],
  ['knee-feather-cuff', 'O', 'pointed feather fringe hiding the rig knee'],
  ['cuff-feather-glaze', 'T', 'rose glaze in the shadowed half of every cuff feather'],
  ['cuff-feather-shafts', 'T', 'shaft ticks in the cuff feathers'],
  ['trouser-feather-scallops', 'T', 'painted contour-feather scallops flowing down the leg'],
  ['trouser-rear-hatching', 'T', 'fine brown hatching on the rear of the trousers'],
  ['dry-brush-feather-breaks', 'T', 'dry-brush flecks where feathers break the trouser silhouette'],
  ['flank-plume-curls', 'O', 'plume curls where the thigh leaves the belly'],
  ['tarsus', 'O', 'orange tarsus 13.6→10 u wide, hand-inked front and rear contours'],
  ['tarsus-shade-band', 'T', 'burnt-orange shade band on the rear of the tarsus'],
  ['tarsus-reticulate-scales', 'T', 'small reticulate scales on the rear of the tarsus'],
  ['tarsus-scale-rings', 'T', 'painted scale rings (transverse scutes) down the front of the tarsus'],
  ['scale-ring-lit-lips', 'T', 'light-orange lit lip under every scale ring'],
  ['tarsus-highlight', 'T', 'broken gouache highlight down the shin'],
  ['tarsus-skin-mottle', 'T', 'soft darker mottling on the tarsus skin'],
  ['intertarsal-heel-pad', 'O', 'heel pad of the intertarsal joint just below the cuff'],
  ['intertarsal-knuckle', 'O', 'knuckle and crease rings of the intertarsal joint; the tarsus leaves it at a slight angle'],
  ['hallux-web', 'O', 'hallux (toe I, turned forward) and the web joining it to toe II: what makes the foot totipalmate'],
  ['totipalmate-webs', 'O', 'webs IV–III and III–II'],
  ['web-sag-glaze', 'T', 'shade glaze along the sagging scalloped web edges'],
  ['web-pleats', 'T', 'soft pleats in the webs'],
  ['toes', 'O', 'toes II–IV, outer toe longest, draping over the pedal edge'],
  ['toe-scutes', 'T', 'curved scutes on each toe'],
  ['toe-highlights', 'T', 'lit strokes along the near toes'],
  ['toe-pads', 'O', 'digital pads under the drooping toe tips'],
  ['claws', 'O', 'short hooked dark claws'],
  ['ankle-joint', 'O', 'ankle knob capping the tarsus'],
  ['ankle-knob-highlight', 'T', 'lit stroke on the ankle knob'],
  ['ankle-creases', 'T', 'skin creases at the ankle'],
  ['metatarsal-pad', 'O', 'metatarsal pad on the pedal'],
  ['far-*', 'O', 'far wing and leg: the same anatomy in cooler, darker glazes (tagged far-…; counted only where visible)'],
].map(([name, kind, what]) => ({ id: tag(kind, name), layer: 'pelican', kind, what }));
