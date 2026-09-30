// OWNER: pelican-limbs. Legs and wings of the great white pelican, near + far (far = flat B/N inks, no dots).
// Style C (screen-print travel poster): paper-white P plumage with B key lines and B covert scallops, N flight
// feathers with thin P edges and B sheen lines, amber O tarsus/feet with R scale lines, N claws.
//
// Slots are drawn in joint-local coordinates (bone along +x, pivot at 0,0; see CONTRACT.md):
//   thigh*  hip -> knee 142      shank*  knee -> ankle 134      foot*  ankle; ball (17,9) on the pedal spindle
//   wing*Upper shoulder -> elbow 78   wing*Lower elbow -> wrist 74   wing*Hand wrist ON the grip (grip r = 6)
//
// Anatomy (why it reads as a wing, not an arm in a sleeve):
//   upper slot  = scapulars + tertials: a broad P covert cape over the body side that merges into it at the
//                 shoulder (no key line there), with overlapping rounded tertials as the trailing edge.
//   lower slot  = the propatagium (skin fold shoulder -> wrist; its outline is rebuilt from the real elbow angle so
//                 the leading edge is always one clean curve and the elbow never seams), marginal / lesser / median
//                 / greater covert rows, N secondaries hanging below the arm line as a fringe (thin P edges) and
//                 the trailing N primaries sweeping back and down from the wrist (rotated with the hand).
//   hand slot   = carpal bend, primary coverts, the alula (the bird's "thumb", flicks the bell) and five outer
//                 primaries that share one wrap round the grip and peel off one by one into five separate tips;
//                 they open into a fan for the wave.
// Legs: feathered "trousers" merge into the belly and hide the rig knee in a pointed feather cuff (bare skin starts
//   ≥ 15 u below the knee pivot at every knee angle); amber tarsus 13.6→10 u with transverse scutes, reticulate rear
//   scales and an intertarsal heel pad; totipalmate foot (all four toes webbed, incl. the hallux web) flat on the
//   pedal, sole on the pedal's top face (foot-local y = 6), toes draping over its front edge.
//
// Hit-testing note: long curved lines are emitted as short C1-continuous quadratic pieces (splitQ) so a stroke's
// chord area never "covers" what is underneath; detail lines nest inside the part they belong to.
// Per frame: the propatagium outline (fixed command counts, skipped when the elbow angle moved < 0.15°) plus a
// handful of cached transforms (primaries, alula, finger fan, toe curl, web press, covert lift).
import { SKEL } from '../contract.js';
import { h, refs } from '../core/svg.js';

export const id = 'pelican-limbs';
// far leg prints in its own inks so it separates from the navy sea: B thigh, R tarsus/foot, P rim line
export const materials = { limbFarSkin: 'R', limbFarRim: 'P' };

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
const norm = v => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
const perp = v => [-v[1], v[0]];
const dir = a => [Math.cos(a * D2R), Math.sin(a * D2R)];
const wrapA = a => ((a % 360) + 540) % 360 - 180;
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
// A long line as short quadratic pieces (midpoint to midpoint): looks like one smooth round-capped stroke.
function splitQ(S) {
  const m = i => lerp2(S[i], S[i + 1], 0.5);
  let d = `M${pt(S[0])}L${pt(m(0))}`;
  for (let i = 1; i < S.length - 1; i++) d += `M${pt(m(i - 1))}Q${pt(S[i])} ${pt(m(i))}`;
  return d + `M${pt(m(S.length - 2))}L${pt(S[S.length - 1])}`;
}
const curve = (P, k = 3) => splitQ(resample(P, k));
const line = (d, stroke, w, extra = {}) => h('path', { d, fill: 'none', stroke, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...extra });
const fill = (d, c, extra = {}) => h('path', { d, fill: c, ...extra });
const tag = (kind, name) => `pelican:${kind}:${name}`;
const G = (name, kind, far, kids, extra = {}) => h('g', { 'data-detail': tag(kind, (far ? 'far-' : '') + name), ...extra }, kids);

// A feather from base b along angle a (deg): length L, width w, bend k (tip swings toward +n by k·L), tip shape.
// Returns { d: outline, r: rachis, P(s, t): point at fraction s along, t across }.
function feather(b, a, L, w, k = 0, tip = 'point', w0 = 0.55) {
  const u = dir(a), n = perp(u);
  const P = (s, t) => add(b, add(mul(u, s * L), mul(n, t + k * L * s * s)));
  const hw = w / 2;
  let d;
  if (tip === 'round') {
    d = `M${pt(P(0, -hw * w0))}C${pt(P(0.35, -hw * 1.05))} ${pt(P(0.78, -hw * 1.02))} ${pt(P(0.93, -hw * 0.6))}` +
      `Q${pt(P(1.02, 0))} ${pt(P(0.93, hw * 0.6))}C${pt(P(0.78, hw * 1.02))} ${pt(P(0.35, hw * 1.05))} ${pt(P(0, hw * w0))}Z`;
  } else {
    d = `M${pt(P(0, -hw * w0))}C${pt(P(0.3, -hw * 1.08))} ${pt(P(0.72, -hw * 0.95))} ${pt(P(1, 0))}` +
      `C${pt(P(0.72, hw * 0.95))} ${pt(P(0.3, hw * 1.08))} ${pt(P(0, hw * w0))}Z`;
  }
  const r = `M${pt(P(0.08, 0))}L${pt(P(0.5, 0))}L${pt(P(0.86, 0))}`;
  return { d, r, P };
}
// Scallop arcs between successive points, bulging by `depth` along unit vector u (the feather-tip direction).
function scallops(points, u, depth) {
  let d = '';
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1], m = lerp2(a, b, 0.5);
    d += `M${pt(a)}Q${pt(add(m, mul(u, depth * 2)))} ${pt(b)}`;
  }
  return d;
}
const rowPts = (p0, p1, n) => Array.from({ length: n + 1 }, (_, i) => lerp2(p0, p1, i / n));

// ---------------------------------------------------------------- propatagium (lower-wing local, pure)
// e = elbow angle (deg) = wingLower.rot − wingUpper.rot (negative: the forearm swings up-forward of the upper arm).
// The shoulder in lower-local coordinates is S = −78·(cos e, −sin e). Fixed command counts (bake-friendly).
const LE_END = [73, -8.5];                         // leading edge ends at the carpal bend (continued by the hand slot)
export function propGeom(eDeg) {
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
  const samp = (t0, t1, n, off = 0) => Array.from({ length: n }, (_, i) => { const t = lerp(t0, t1, i / (n - 1)); return add(cub(t), mul(out(t), off)); });
  // key line: a thin start fading into the breast, then the full-weight leading edge to the carpal bend
  const keyThin = splitQ(samp(0.1, 0.3, 4));
  const key = splitQ(samp(0.27, 0.9, 9));
  // marginal coverts: 11 small scallops just inside the leading edge, tips toward the trailing edge
  let marg = '';
  const mp = Array.from({ length: 12 }, (_, i) => { const t = lerp(0.2, 0.9, i / 11); return add(cub(t), mul(out(t), -(3.6 - 1.4 * t))); });
  for (let i = 0; i < mp.length - 1; i++) {
    const a = mp[i], b = mp[i + 1], m = lerp2(a, b, 0.5), tn = norm(sub(b, a));
    let nn = perp(tn); if (nn[1] > 0) nn = mul(nn, -1);
    marg += `M${pt(a)}Q${pt(add(m, mul(nn, -3.2 + 1.2 * i / 11)))} ${pt(b)}`;
  }
  const rim = splitQ(samp(0.22, 0.86, 7, -1.9));
  return { fill: fillD, key, keyThin, marg, rim, S };
}

// ================================================================ WINGS
// ---- upper wing (shoulder-local; +x toward the elbow = down at rest, +y = back toward the tail)
function wingUpper(I, far) {
  const ter = [];
  for (let i = 0; i < 8; i++) {
    const u = i / 7;
    ter.push(feather(lerp2([-6, 12], [66, 1], u), lerp(100, 70, u), lerp(33, 23, u), lerp(13.5, 11, u), -0.05, 'round', 0.8));
  }
  const cape = smooth([[-28, -14], [-30, 4], [-22, 15], [-8, 19], [14, 16.5], [40, 11], [66, 4.5], [84, 0], [88, -6], [70, -13], [40, -15], [8, -16]]);
  const kids = [];
  // thin B shadow under the tertial tips where they lie on the flank
  if (!far) kids.push(fill(ter.map(t => t.d).join(''), I.B, { transform: 'translate(0.6 1.6)' }));
  kids.push(G('tertials', 'O', far, [
    ...ter.map(t => fill(t.d, I.P, far ? {} : { stroke: I.B, 'stroke-width': 1.35, 'stroke-linejoin': 'round' })),
    far ? '' : line(ter.map(t => `M${pt(t.P(0.62, 0))}L${pt(t.P(0.88, 0))}`).join(''), I.B, 0.75, { 'data-detail': tag('T', 'tertial-shafts') }),
  ]));
  // the scapular cape covers the tertial bases and merges into the body side (no outline on the body side)
  kids.push(fill(cape, I.P));
  if (!far) {
    const flow = norm([0.25, 1]);
    kids.push(line(scallops(rowPts([-18, 13], [42, 6], 5), flow, 2.2), I.B, 1.3, { 'data-detail': tag('T', 'scapular-scallops'), 'data-tract': 'scapulars' }));
    kids.push(line(scallops(rowPts([-26, 5], [18, 0], 4), flow, 1.6), I.B, 1.05, { 'data-detail': tag('T', 'humeral-covert-scallops'), 'data-tract': 'humeral' }));
  }
  return G('scapular-cape', 'O', far, kids);
}

// ---- lower wing (elbow-local; +x toward the wrist, +y = down below the arm line)
const PRIM = Array.from({ length: 5 }, (_, i) => { const u = i / 4; return { b: [lerp(66, 76, u), lerp(8, 3, u)], a: lerp(160, 140, u), L: lerp(90, 72, u), w: lerp(12, 13.5, u) }; });
const V = { rim: '' };
function wingLower(I, far, side) {
  const s = [], ref = n => `pl-${side}-${n}`;
  // secondaries: N fringe hanging below the arm line, P thin trailing edges, B shafts
  const sec = [];
  for (let i = 0; i < 10; i++) { const u = i / 9; sec.push(feather([lerp(-12, 62, u), lerp(5, 4, u)], lerp(106, 98, u), lerp(33, 27, u), 11.5, 0.05, 'round', 0.8)); }
  const secG = G('secondaries-fringe', 'O', far, [
    ...[...sec].reverse().map(t => fill(t.d, I.N, far ? {} : { stroke: I.B, 'stroke-width': 0.7 })),
    far ? '' : line(sec.map(t => `M${pt(t.P(0.5, -4.9))}Q${pt(t.P(0.78, -5.4))} ${pt(t.P(0.93, -2.6))}`).join(''), I.P, 0.95, { 'data-detail': tag('T', 'secondary-pale-edges') }),
    far ? '' : line(sec.map(t => `M${pt(t.P(0.42, 0))}L${pt(t.P(0.86, 0))}`).join(''), I.B, 0.8, { 'data-detail': tag('T', 'secondary-rachis') }),
  ]);
  // trailing primaries, folded under the secondaries (as in a real folded wing) and sweeping back and down from
  // the wrist past the fringe; rotated about the wrist by the wrist angle each frame, each can fan open (wave).
  // The secondaries group nests inside so the remiges read as one layered unit.
  const prim = PRIM.map(q => feather(q.b, q.a, q.L, q.w, -0.07, 'point', 0.9));
  s.push(G('primaries-trailing', 'O', far, [
    h('g', { 'data-ref': ref('prims') }, prim.map((p, i) => h('g', { 'data-ref': ref('p' + i) }, fill(p.d, I.N, far ? {} : { stroke: I.B, 'stroke-width': 0.95, 'stroke-linejoin': 'round' }),
      far ? '' : line(p.r, I.B, 0.9),
      far || i < 2 ? '' : line(`M${pt(p.P(0.55, 3.6))}L${pt(p.P(0.66, 1.3))}`, I.B, 1.1)))),
    secG]));
  // covert panel: propatagium + arm-line fill (per frame), elbow cap, greater coverts, clipped rows, marginal row
  const g0 = propGeom(-58);
  const panel = [fill(g0.fill, I.P, { 'data-ref': ref('prop') }), h('circle', { cx: -2, cy: 2, r: 10, fill: I.P })];
  const gc = [];
  for (let i = 0; i < 10; i++) { const u = i / 9; gc.push(feather([lerp(-8, 70, u), -2], lerp(100, 94, u), 15, 10.5, 0.04, 'round', 1)); }
  panel.push(h('g', { 'data-ref': ref('gc') }, G('greater-coverts', 'O', far, [
    fill(gc.map(t => t.d).join(''), I.P, far ? {} : { stroke: I.B, 'stroke-width': 1.5, 'stroke-linejoin': 'round' }), fill('M-10 -6L76 -7L78 0L-11 3Z', I.P),
    far ? '' : line(gc.slice(0, 8).map(t => `M${pt(t.P(0.5, 0))}L${pt(t.P(0.86, 0.3))}`).join(''), I.B, 0.9, { 'data-detail': tag('T', 'greater-covert-shafts') }),
  ])));
  if (!far) {
    const down = [0.12, 1];
    panel.push(h('clipPath', { id: ref('clip') }, h('path', { d: g0.fill, 'data-ref': ref('clipP') })));
    panel.push(h('g', { 'clip-path': `url(#${ref('clip')})` },
      line(scallops(rowPts([-22, -14], [54, -15.4], 11), down, 1.7) + scallops(rowPts([-30, -22], [42, -23.4], 12), down, 1.45), I.B, 1.05, { 'data-detail': tag('T', 'lesser-covert-rows'), 'data-tract': 'coverts' }),
      line(scallops(rowPts([-38, -30], [30, -31.4], 13), down, 1.25), I.B, 0.85, { 'data-tract': 'coverts' }),
      line(scallops(rowPts([-12, -6], [56, -7.2], 9), down, 2.1), I.B, 1.3, { 'data-detail': tag('T', 'median-covert-row'), 'data-tract': 'coverts' })));
    panel.push(line(g0.marg, I.B, 1, { 'data-ref': ref('marg'), 'data-detail': tag('T', 'marginal-coverts'), 'data-tract': 'coverts' }));
    panel.push(line(g0.rim, V.rim, 1.6, { 'data-ref': ref('rim'), 'data-detail': tag('O', 'wing-rim-light'), style: 'opacity:var(--pb-n-rimAlpha)' }));
    panel.push(line(g0.keyThin, I.B, 1.2, { 'data-ref': ref('keyThin') }));
    panel.push(line(g0.key, I.B, 2.2, { 'data-ref': ref('key'), 'data-detail': tag('O', 'wing-leading-edge') }));
  }
  s.push(G('covert-panel', 'O', far, panel));
  return s.join('');
}

// ---- hand (wrist-local, pivot ON the grip; grip radius 6; bell at about (8,−8))
function fingerFeathers() {
  // five outer primaries leave the carpal bend at the front-top of the grip and share one wrap band round its
  // front; one by one they peel away, so five separate pointed tips splay round the lower half of the grip like a
  // feather fan — never a coil of knuckles. Returned innermost-last (drawn on top).
  const F = [], R0 = 9.2, W = 5.2, a0 = -44;
  for (let i = 4; i >= 0; i--) {
    const a1 = 18 + 25 * i, n = 6 + i;
    const L = [], R = [], C = [];
    for (let j = 0; j <= n; j++) {
      const a = lerp(a0, a1, j / n), nr = dir(a), c = mul(nr, R0);
      C.push(c); L.push(add(c, mul(nr, W / 2))); R.push(add(c, mul(nr, -W / 2)));
    }
    const td = dir(a1 + 90 - 46), tipL = 14 - 0.8 * i, e = C[n];
    const mid = add(e, mul(td, tipL * 0.5)), tip = add(e, mul(td, tipL)), nn = perp(td);
    const d = smooth([...L, add(mid, mul(nn, -W * 0.36)), tip, add(mid, mul(nn, W * 0.3)), ...R.reverse()], true, 0.15);
    const rach = `M${pt(C[n - 1])}Q${pt(e)} ${pt(lerp2(e, tip, 0.72))}`;
    F.push({ d, rach, tip });
  }
  return F;
}
function wingHand(I, far, side) {
  const s = [], ref = n => `pl-${side}-${n}`;
  // open fan (wave): six primaries splayed from the wrist; hidden while gripping
  const fan = [];
  for (let i = 0; i < 6; i++) fan.push(feather([-2 + i * 0.6, 2 - i * 0.8], lerp(52, -26, i / 5), lerp(42, 56, i / 5) - (i > 3 ? (i - 3) * 5 : 0), 12.5, -0.05, 'round', 0.8));
  s.push(h('g', { 'data-ref': ref('fan'), style: 'display:none' },
    [...fan].reverse().map((p, i) => h('g', { 'data-ref': ref('fan' + (5 - i)) }, fill(p.d, I.N, far ? {} : { stroke: I.B, 'stroke-width': 1 }), far ? '' : line(p.r, I.B, 0.9),
      far ? '' : line(`M${pt(p.P(0.3, -4))}Q${pt(p.P(0.6, -5.4))} ${pt(p.P(0.88, -3))}`, I.P, 0.9)))));
  const F = fingerFeathers();
  s.push(h('g', { 'data-ref': ref('grip') }, G('primary-fingers', 'O', far, [
    h('circle', { cx: -1, cy: 0, r: 7.6, fill: I.N }),        // the grip end-on is fully inside the hand
    ...F.map(p => fill(p.d, I.N, far ? {} : { stroke: I.B, 'stroke-width': 1.1, 'stroke-linejoin': 'round' })),
    far ? '' : line(F.map(p => p.rach).join(''), I.B, 0.7, { 'data-detail': tag('T', 'finger-rachis') }),
  ])));
  // primary coverts: short N feathers on the back of the hand, over the bases of the trailing primaries
  const pc = [];
  for (let i = 0; i < 4; i++) pc.push(feather([-6 - i * 2.6, -1 + i * 0.4], lerp(160, 126, i / 3), lerp(16, 12, i / 3), 7.5, -0.05, 'round', 0.9));
  s.push(G('primary-coverts', 'O', far, pc.map(p => fill(p.d, I.N, far ? {} : { stroke: I.B, 'stroke-width': 0.85 }))));
  // carpal bend: P end of the leading edge folding over the top of the grip (the "palm" rests on the bar)
  const carpal = smooth([[-21, -10], [-10, -15], [1, -13.6], [7.4, -8.4], [6.4, -3.2], [0, -1.6], [-8, -0.6], [-17, -1.6], [-22, -5]]);
  s.push(G('carpal-bend', 'O', far, [fill(carpal, I.P),
    far ? '' : line(curve([[-18, -11.6], [-9, -15.2], [2, -14.4], [7.2, -8.6], [6.4, -3.6]], 2), I.B, 2),
    far ? '' : line('M-14 -6.4q2.3 2.5 4.6 0q2.3 2.5 4.6 0q2.1 2.2 4.2 0M-9 -3q2 2 4 0', I.B, 0.85, { 'data-detail': tag('T', 'carpal-covert-scallops') })]));
  // alula: three small feathers on the leading edge of the wrist; rotates about its base for the bell flick
  const al = [];
  for (let i = 0; i < 3; i++) al.push(feather([-4 - i * 2.4, -13 + i * 0.9], lerp(-16, -4, i / 2), lerp(11.5, 8, i / 2), 5, 0.08, 'round', 0.9));
  s.push(h('g', { 'data-ref': ref('alula') }, G('alula', 'O', far, [
    ...[...al].reverse().map(p => fill(p.d, I.N, far ? {} : { stroke: I.B, 'stroke-width': 0.8 })),
    far ? '' : line(al.map(p => p.r).join(''), I.B, 0.6)])));
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
  let d = `M${pt([K - 16, -9.8])}L${pt(N[0])}`, edge = '';
  for (let j = 0; j < n; j++) {
    const a = A0 + j * step, r = 21.6 + [0, 1.4, -0.6, 1.8, 0.2, 1.2, -0.4, 0.8][j];
    const tip = at(a + step * 0.72, r), c1 = at(a + step * 0.28, r - 1.2), c2 = at(a + step * 0.95, r - 3.6);
    T.push(tip);
    d += `Q${pt(c1)} ${pt(tip)}Q${pt(c2)} ${pt(N[j + 1])}`;
    edge += `M${pt(N[j])}Q${pt(c1)} ${pt(tip)}M${pt(tip)}Q${pt(c2)} ${pt(N[j + 1])}`;
  }
  d += `L${pt([K - 16, 11.6])}Z`;
  return { d, edge, T };
}
function thigh(I, far) {
  const K = SKEL.thigh;
  // drumstick: broad where it leaves the belly, tapering to a slim feathered shin at the knee
  const top = [[-14, -25], [12, -27], [44, -21], [76, -14], [106, -10.5], [128, -10], [140, -9.6]];
  const bottom = [[140, 11.6], [112, 11.5], [86, 11], [60, 9.5], [36, 6.5], [14, 4], [-4, 3], [-17, -8]];
  const cuff = cuffGeom(K);
  const kids = [fill(smooth([...top, ...bottom]), I.P), fill(cuff.d, I.P)];
  if (!far) {
    // front + rear key lines only where the leg is outside the body; the fringe line
    kids.push(line(curve([[50, -19.6], [76, -14], [106, -10.5], [128, -10], [141, -8.8], [150, -5.4], [K + 11.7, -2.5]]), I.B, 2.1));
    kids.push(line(curve([[44, 7.8], [60, 9.5], [86, 11], [112, 11.5], [128, 11.6]]), I.B, 2));
    kids.push(line(cuff.edge, I.B, 1.7, { 'data-detail': tag('O', 'knee-feather-cuff') }));
    kids.push(line(cuff.T.map(t => `M${pt(lerp2([K, 0], t, 0.55))}L${pt(lerp2([K, 0], t, 0.82))}`).join(''), I.B, 0.8, { 'data-detail': tag('T', 'cuff-feather-shafts') }));
    // contour-feather scallops flowing down the leg (tips toward the knee), shrinking toward the knee
    const u = [1, 0.1];
    kids.push(line(scallops(rowPts([46, -15.5], [54, 6], 4), u, 2.6) + scallops(rowPts([74, -12], [78, 9], 3), u, 2.5) +
      scallops(rowPts([100, -9.6], [102, 10], 3), u, 2.2) + scallops(rowPts([124, -8.6], [124, 9.6], 3), u, 2), I.B, 1.25, { 'data-detail': tag('T', 'trouser-feather-scallops'), 'data-tract': 'leg' }));
    kids.push(line('M62 6.4q9 2.4 18 2.6M90 8.2q9 1.6 16 1.4M112 8.6q6 1 11 0.4', I.B, 0.85, { 'data-detail': tag('T', 'trouser-rear-hatching') }));
    kids.push(line('M24 -21q5 3 4 8M35 -20.4q4.6 3.2 3.4 8.2M28 1.6q3.4 -2 7.2 -0.8', I.B, 1.1, { 'data-detail': tag('O', 'flank-plume-curls') }));
  } else {
    kids.push(line(curve([[60, -16.4], [86, -12.4], [112, -9.8], [136, -9.2]]), I.rim, 1, { 'data-detail': tag('O', 'far-thigh-rim') }));
    kids.push(line(scallops(rowPts([80, -11], [82, 9], 3), [1, 0.1], 2.4) + scallops(rowPts([112, -9], [112, 9.6], 3), [1, 0.1], 2), I.B, 1.1, { 'data-detail': tag('T', 'far-trouser-scallops') }));
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
  if (!far) {
    // intertarsal heel pad: the bird's "backward knee" just below the feather cuff
    kids.push(line('M17 7.6Q21 11.4 23.4 10.6Q27 9.6 29.5 7.4M19.5 5.2q3.6 2.4 7.2 0', I.R, 1.3, { 'data-detail': tag('O', 'intertarsal-heel-pad') }));
    kids.push(line('M15.6 -7.8Q23 -11.6 30.4 -7.2M18 -3.6Q23 -1.2 28.6 -3.8M31.6 -5.4Q34.6 -1 31.4 3.2', I.R, 1.1, { 'data-detail': tag('O', 'intertarsal-knuckle') }));
    // rear shade band (R) keeps the tarsus round; reticulate rear scales sit on it
    let rt = '';
    for (let x = 34, k = 0; x <= 124; x += 4.6, k++) { const w = hw(x), y = w * (k % 2 ? 0.62 : 0.3); rt += `M${f(x)} ${f(y)}q1.6 -1.3 3.2 0q-1.6 1.3 -3.2 0`; }
    kids.push(G('tarsus-shade-band', 'T', far, [fill(`M30 ${f(hw(30) - 2)}C70 ${f(hw(70) - 2.2)} 110 ${f(hw(110) - 2)} ${L} ${f(hw(L) - 1.6)}L${L} ${f(hw(L))}C110 ${f(hw(110))} 70 ${f(hw(70))} 30 ${f(hw(30))}Z`, I.R),
      line(rt, I.R, 0.7, { 'data-detail': tag('T', 'tarsus-reticulate-scales') })]));
    // broken K highlight down the shin
    const hl = x => [x, -hw(x) + 2];
    kids.push(line(`M${pt(hl(30))}L${pt(hl(50))}M${pt(hl(55))}L${pt(hl(58))}M${pt(hl(64))}L${pt(hl(88))}M${pt(hl(93))}L${pt(hl(96))}M${pt(hl(102))}L${pt(hl(118))}`, I.K, 1.3, { 'data-detail': tag('T', 'tarsus-highlight') }));
    // transverse scutes on the front (scale rings), overlapping downward
    let sc = '';
    for (let x = 24; x <= 126; x += 7.4) { const w = hw(x); sc += `M${f(x)} ${f(-w + 0.3)}Q${f(x + 2.6)} ${f(-w * 0.2)} ${f(x + 0.6)} ${f(w * 0.45)}`; }
    kids.push(line(sc, I.R, 1.1, { 'data-detail': tag('T', 'tarsus-scutes') }));
  } else {
    let sc = '';
    for (let x = 36; x <= 126; x += 9) { const w = hw(x); sc += `M${f(x)} ${f(-w + 0.4)}q2.4 ${f(w * 0.6)} 0.6 ${f(w * 1.2)}`; }
    kids.push(line(sc, I.B, 0.9, { 'data-detail': tag('T', 'far-tarsus-scutes') }));
    kids.push(line(`M${f(16)} -9.6Q24 -11.8 31 -7.8M34 ${f(-hw(34) - 0.2)}C70 ${f(-hw(70) - 0.2)} 100 ${f(-hw(100) - 0.2)} ${L - 2} ${f(-hw(L - 2) - 0.2)}`, I.rim, 1, { 'data-detail': tag('O', 'far-tarsus-rim') }));
    kids.push(line('M17 7.6Q21 11.4 23.4 10.6Q27 9.6 29.5 7.4M15.6 -7.8Q23 -11.6 30.4 -7.2', I.B, 1, { 'data-detail': tag('O', 'far-intertarsal-knuckle') }));
  }
  return G('tarsus', 'O', far, kids);
}
// ---- foot (ankle-local; ball (17,9) sits on the pedal spindle; pedal top face at y = 6 spans x ≈ 4..30)
// Totipalmate: toes IV (outer, nearest, longest), III, II and the hallux I, all joined by webs. The near toes
// drape over the pedal's front edge; the farther ones are seen across its top face (a slightly raised viewpoint
// fans them so every web is visible).
const SOLE = 6, EDGE = 30;
const TOES = [
  { n: 'IV', root: [8, 4.3], mid: [EDGE - 1, 4.8], tip: [40.5, 12.4], w: 3.6 },
  { n: 'III', root: [8, 2.5], mid: [EDGE - 1, 2.4], tip: [41, 6.6], w: 3.2 },
  { n: 'II', root: [7, 0.7], mid: [EDGE - 4, -0.8], tip: [38, -0.6], w: 2.9 },
  { n: 'I', root: [-2.5, -0.4], mid: [9, -5], tip: [20.5, -8.6], w: 2.6 },
];
function toeD(t) {
  const a = t.root, b = t.mid, c = t.tip, w = t.w / 2;
  const n1 = perp(norm(sub(b, a))), n2 = perp(norm(sub(c, b)));
  return smooth([add(a, mul(n1, -w)), add(b, mul(n1, -w * 0.95)), add(lerp2(b, c, 0.6), mul(n2, -w * 0.75)), add(c, mul(n2, -0.4)), add(c, mul(norm(sub(c, b)), 1.2)), add(c, mul(n2, 0.6)), add(lerp2(b, c, 0.6), mul(n2, w * 0.8)), add(b, mul(n1, w)), add(a, mul(n1, w))], true, 0.14);
}
function foot(I, far, side) {
  const ref = n => `pl-${side}-${n}`, T = TOES;
  const webs = [];
  for (let i = 0; i < 3; i++) {
    const A = T[i], B = T[i + 1];
    const tipA = lerp2(A.mid, A.tip, 0.92), tipB = lerp2(B.mid, B.tip, 0.92);
    const dip = add(lerp2(tipA, tipB, 0.5), mul(norm(sub(lerp2(A.root, B.root, 0.5), lerp2(tipA, tipB, 0.5))), 5.5));
    webs.push(`M${pt(A.root)}L${pt(A.mid)}L${pt(tipA)}Q${pt(dip)} ${pt(tipB)}L${pt(B.mid)}L${pt(B.root)}Z`);
  }
  const pleats = [];
  for (let i = 0; i < 2; i++) {
    const A = T[i], B = T[i + 1];
    for (const k of [0.33, 0.66]) { const r = lerp2(A.root, B.root, k), m = lerp2(lerp2(A.mid, A.tip, 0.5), lerp2(B.mid, B.tip, 0.5), k); pleats.push(`M${pt(lerp2(r, m, 0.3))}L${pt(lerp2(r, m, 0.92))}`); }
  }
  const W = I.OW, Tc = I.O, Ln = far ? I.B : I.R;
  const st = far ? { stroke: I.rim, 'stroke-width': 0.8, 'stroke-linejoin': 'round' } : { stroke: Ln, 'stroke-width': 0.8, 'stroke-linejoin': 'round' };
  const ankle = G('ankle-joint', 'O', far, [fill(`M-5.4 -3.2C-6.4 -8 5.4 -8.6 6.8 -3.4C8.6 0.6 13 1.6 18 2.4L18 ${SOLE}L-3 ${SOLE}C-6 ${SOLE - 0.6} -7.4 3 -5.4 -3.2Z`, Tc),
    far ? '' : fill(`M-3.8 ${SOLE - 2.2}Q4 ${SOLE - 3.2} 12 ${SOLE - 1.6}L12 ${SOLE}L-3 ${SOLE}Z`, I.R, { 'data-detail': tag('O', 'metatarsal-pad') }),
    far ? '' : line('M-4.4 -1.2Q-1 1.8 3.8 0.2M-3.4 3.2Q0 4.8 4.6 3.4', I.R, 0.9, { 'data-detail': tag('T', 'ankle-creases') })]);
  // toes II–IV with their scutes, highlights, pads and claws (near toe on top)
  const toeKids = [T[2], T[1], T[0]].map(t => fill(toeD(t), Tc, st));
  if (!far) {
    toeKids.push(fill(T.slice(0, 2).map(t => { const p = lerp2(t.mid, t.tip, 0.55), nn = perp(norm(sub(t.tip, t.mid))); const c = add(p, mul(nn, t.w * 0.45)); return `M${pt(add(c, [-2.2, 0]))}q2.2 2.6 4.4 0z`; }).join(''), I.R, { 'data-detail': tag('O', 'toe-pads') }));
    toeKids.push(line(T.slice(0, 3).map(t => { const nn = perp(norm(sub(t.tip, t.root))); return `M${pt(add(lerp2(t.root, t.mid, 0.35), mul(nn, -t.w * 0.18)))}L${pt(add(lerp2(t.mid, t.tip, 0.5), mul(nn, -t.w * 0.16)))}`; }).join(''), I.K, 0.9, { 'data-detail': tag('T', 'toe-highlights') }));
    let sc = '';
    for (const t of T) {
      const segs = t.n === 'I' ? 2 : 4;
      for (let j = 1; j <= segs; j++) {
        const u = j / (segs + 1), p = u < 0.5 ? lerp2(t.root, t.mid, u * 2) : lerp2(t.mid, t.tip, (u - 0.5) * 2), nn = perp(norm(sub(t.tip, t.root)));
        sc += `M${pt(add(p, mul(nn, -t.w * 0.42)))}L${pt(add(p, mul(nn, t.w * 0.3)))}`;
      }
    }
    toeKids.push(line(sc, I.R, 0.7, { 'data-detail': tag('T', 'toe-scutes') }));
  }
  const claws = T.map(t => { const u = norm(sub(t.tip, t.mid)), nn = perp(u), c = t.tip; return `M${pt(add(c, mul(nn, -t.w * 0.4)))}Q${pt(add(add(c, mul(u, 3.4)), mul(nn, -0.2)))} ${pt(add(add(c, mul(u, 3.3)), mul(nn, 2.6)))}Q${pt(add(c, mul(u, 1.4)))} ${pt(add(c, mul(nn, t.w * 0.45)))}Z`; }).join('');
  toeKids.push(fill(claws, I.N, { 'data-detail': tag('O', far ? 'far-claws' : 'claws') }));
  // the webbed foot: hallux + its web (farthest), the other two webs with pleats, then the toes
  const foot = G('totipalmate-webs', 'O', far, [
    G('hallux-web', 'O', far, [fill(webs[2], W, st), fill(toeD(T[3]), Tc, st)]),
    fill(webs[1], W, st), fill(webs[0], W, st), far ? '' : line(pleats.join(''), Ln, 0.7),
    G('toes', 'O', far, toeKids)]);
  const out = [h('g', { 'data-ref': ref('toes') }, h('g', { 'data-ref': ref('webs') }, foot)), ankle];
  return out.join('');
}

// ================================================================ build
export function build({ v }) {
  V.rim = v('rim');
  const near = { P: v('plume'), B: v('plumeShade'), N: v('flight'), O: v('foot'), OW: v('web'), R: v('billNail'), K: v('skin') };
  const Bf = v('plumeShade', { far: true }), Nf = v('flight', { far: true });
  const farI = { P: Bf, B: Bf, N: Nf, O: Nf, OW: Nf, R: Bf, K: Bf };
  // far leg: lighter than the sea band (B thigh, R skin) with a thin P rim so it reads at every crank phase
  const farLeg = { ...farI, P: v('plume', { far: true }), B: Nf, O: v('limbFarSkin'), OW: v('limbFarSkin'), R: Nf, K: v('limbFarRim'), rim: v('limbFarRim') };
  const s = {};
  for (const side of ['Near', 'Far']) {
    const far = side === 'Far', I = far ? farI : near;
    const IL = far ? farLeg : I;
    s['thigh' + side] = thigh(IL, far);
    s['shank' + side] = shank(IL, far);
    s['foot' + side] = foot(IL, far, side);
    s['wing' + side + 'Upper'] = wingUpper(I, far);
    s['wing' + side + 'Lower'] = wingLower(I, far, side);
    s['wing' + side + 'Hand'] = wingHand(I, far, side);
  }
  return { slots: s };
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
          const g = propGeom(S.e);
          r[side + '-prop']?.setAttribute('d', g.fill);
          r[side + '-clipP']?.setAttribute('d', g.fill);
          r[side + '-marg']?.setAttribute('d', g.marg);
          r[side + '-key']?.setAttribute('d', g.key);
          r[side + '-keyThin']?.setAttribute('d', g.keyThin);
          r[side + '-rim']?.setAttribute('d', g.rim);
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
        const props = S.map(s => propGeom(s[side].e));
        out.push(attr(`[data-ref="pl-${side}-prop"]`, 'd', props.map(g => g.fill)), attr(`[data-ref="pl-${side}-clipP"]`, 'd', props.map(g => g.fill)));
        if (side === 'Near') for (const k of ['marg', 'key', 'keyThin', 'rim']) out.push(attr(`[data-ref="pl-${side}-${k}"]`, 'd', props.map(g => g[k])));
        for (const k of ['prims', 'alula', 'gc', 'toes', 'webs']) out.push(attr(`[data-ref="pl-${side}-${k}"]`, 'transform', S.map(s => s[side][k])));
      }
      return out;
    },
  };
}

export const detailItems = [
  ['tertials', 'O', 'eight overlapping rounded tertials forming the trailing edge of the folded wing'],
  ['tertial-shafts', 'T', 'B shafts on the tertials'],
  ['scapular-cape', 'O', 'broad P covert base over the body side; merges into the body at the shoulder'],
  ['scapular-scallops', 'T', 'scapular scallop row, tips toward the tail'],
  ['humeral-covert-scallops', 'T', 'finer humeral covert row nearest the shoulder'],
  ['secondaries-fringe', 'O', 'ten N secondaries hanging below the arm line as a fringe'],
  ['secondary-pale-edges', 'T', "thin P edges on the secondaries (the pelican's pale bloom)"],
  ['secondary-rachis', 'T', 'B shafts of the secondaries'],
  ['primaries-trailing', 'O', 'five N primaries sweeping back and down from the wrist, B shafts and emarginations (rotate with the hand; fan open in sequence in the wave)'],
  ['covert-panel', 'O', 'propatagium: skin fold shoulder→wrist, outline rebuilt from the elbow angle so it never seams'],
  ['greater-coverts', 'O', 'ten rounded P greater coverts over the secondary bases (lift in gusts)'],
  ['greater-covert-shafts', 'T', 'B shaft ticks on the greater coverts'],
  ['median-covert-row', 'T', 'median covert scallop row'],
  ['lesser-covert-rows', 'T', 'three lesser covert scallop rows, finer toward the leading edge'],
  ['marginal-coverts', 'T', 'tiny marginal coverts along the leading edge (per frame)'],
  ['wing-rim-light', 'O', 'rim light inside the leading edge on the sun side'],
  ['wing-leading-edge', 'O', 'B key line of the leading edge, thin where it leaves the breast'],
  ['primary-fingers', 'O', 'five outer primaries wrapping the grip, peeling off into five separate pointed tips'],
  ['finger-rachis', 'T', 'B shafts of the finger primaries'],
  ['primary-coverts', 'O', 'short N primary coverts on the back of the hand'],
  ['carpal-bend', 'O', 'P bend of the wing folding over the wrist, key line continuing the leading edge'],
  ['carpal-covert-scallops', 'T', 'small covert scallops on the carpal bend'],
  ['alula', 'O', 'three-feather alula (bastard wing) that flicks the bell'],
  ['thigh-trousers', 'O', 'feathered P thigh merging into the belly, tapering to a slim shin'],
  ['knee-feather-cuff', 'O', 'pointed feather fringe hiding the rig knee'],
  ['cuff-feather-shafts', 'T', 'shaft ticks in the cuff feathers'],
  ['trouser-feather-scallops', 'T', 'contour-feather scallops flowing down the leg'],
  ['trouser-rear-hatching', 'T', 'fine B hatching on the rear of the trousers'],
  ['flank-plume-curls', 'O', 'plume curls where the thigh leaves the belly'],
  ['tarsus', 'O', 'amber tarsus 13.6→10 u wide'],
  ['tarsus-shade-band', 'T', 'R shade band on the rear of the tarsus'],
  ['intertarsal-heel-pad', 'O', 'heel pad of the intertarsal joint just below the cuff'],
  ['tarsus-scutes', 'T', 'transverse scutes (scale rings) down the front of the tarsus'],
  ['tarsus-reticulate-scales', 'T', 'small reticulate scales on the rear of the tarsus'],
  ['tarsus-highlight', 'T', 'broken K highlight down the shin'],
  ['hallux-web', 'O', 'hallux (toe I, turned forward) and the web joining it to toe II: what makes the foot totipalmate'],
  ['totipalmate-webs', 'O', 'webs IV–III and III–II'],
  ['toes', 'O', 'toes II–IV, outer toe longest, draping over the pedal edge'],
  ['toe-scutes', 'T', 'transverse scutes on each toe'],
  ['toe-highlights', 'T', 'K highlight along the near toes'],
  ['toe-pads', 'O', 'digital pads under the drooping toe tips'],
  ['claws', 'O', 'short hooked N claws'],
  ['ankle-joint', 'O', 'ankle knob capping the tarsus'],
  ['ankle-creases', 'T', 'skin creases at the ankle'],
  ['metatarsal-pad', 'O', 'R metatarsal pad on the pedal'],
  ['intertarsal-knuckle', 'O', 'knuckle and crease rings of the intertarsal joint; the tarsus leaves it at a slight angle'],
  ['far-thigh-rim', 'O', 'P rim line along the far thigh so it separates from the sea'],
  ['far-trouser-scallops', 'T', 'N scallops on the far trousers'],
  ['far-tarsus-rim', 'O', 'P rim line down the front of the far (R) tarsus'],
  ['far-intertarsal-knuckle', 'O', 'far intertarsal joint knuckle + heel pad lines'],
  ['far-*', 'O', 'far wing and leg: the same anatomy in flat B/N (tagged far-…; counted only where visible)'],
].map(([name, kind, what]) => ({ id: tag(kind, name), layer: 'pelican', kind, what }));
