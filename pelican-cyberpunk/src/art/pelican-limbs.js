// OWNER: pelican-limbs. Legs and wings of the great white pelican, near + far: CYBERPUNK edition "Neon Pelican"
// (docs/STYLE-X.md §3). The bird wears a short techwear bomber: the upper arm is a jacket SLEEVE and the wing
// feathers emerge from its ribbed cuff; the legs keep their feathered "trousers" under a techwear knee wrap, the
// orange tarsus stays bare and scaly, and the totipalmate feet sit in open-toe high-top sneaker wraps so every web
// stays visible. Lighting language: dual-colour rim light, CYAN from the front (−y edges facing the direction of
// travel) and MAGENTA from behind (+y / trailing edges), always as stacked strokes (a wide low-opacity stroke under a
// thin bright one and a pale core): rider slots carry NO filters (STYLE-X §2). The far side is darker and less lit.
//
// Slots are drawn in joint-local coordinates (bone along +x, pivot at 0,0; see CONTRACT.md):
//   thigh*  hip -> knee 142      shank*  knee -> ankle 134      foot*  ankle; ball (17,9) on the pedal spindle
//   wing*Upper shoulder -> elbow 78   wing*Lower elbow -> wrist 74   wing*Hand wrist ON the grip (grip r = 6)
//
// Anatomy (why it still reads as a wing, not an arm in a sleeve):
//   upper slot  = the bomber sleeve over the humerus (raglan seam, zip pocket, 鹈鹕 patch, strap, reflective
//                 chevrons) with the white tertials fanning out from under its trailing edge onto the back.
//   lower slot  = the ribbed sleeve cuff at the elbow (a disc r 16.5 about the pivot, so the elbow never seams at any
//                 angle), then the forearm as a bird's wing: the propatagium / covert base with marginal, lesser,
//                 median and greater covert rows, black secondaries hanging below the arm line as a fringe with
//                 magenta-lit tips, and the trailing black primaries sweeping back and down from the wrist.
//   hand slot   = carpal bend with a smart wrist band, primary coverts, the alula (flicks the bell) and five outer
//                 primaries that share one wrap round the grip and peel off into five separate curled tips; they open
//                 into a fan for the wave.
// Legs: feathered trousers merge into the belly; a techwear wrap hides the rig knee (a disc r 17.5 about the knee
//   pivot, so bare skin starts ≥ 17 u below it at every knee angle) with a white feather fringe peeking out below;
//   orange tarsus 13.6→10 u with transverse scutes and reticulate rear scales; totipalmate foot (all four toes webbed,
//   incl. the hallux web) flat on the pedal, sole on the pedal's top face (foot-local y = 6), toes over its front edge.
//
// Hit-testing note: long curved lines are emitted as short C1-continuous quadratic pieces (splitQ) so a stroke's
// chord area never "covers" what is underneath; detail lines nest inside the part they belong to.
// Per frame: a handful of cached transforms (primaries, alula, finger fan, toe curl, web press, covert lift).
import { fmt2 } from '../core/math.js';
import { SKEL } from '../contract.js';
import { h, refs } from '../core/svg.js';

export const id = 'pelican-limbs';

// ---------------------------------------------------------------- neon + techwear inks (STYLE-X §1)
// Neon is emissive: it does not follow the city mood, so these are fixed. Feathers and skin use the palette tokens.
const X = {
  ink: '#0A0816', mag: '#FF2E88', magCore: '#FFD3E7', cyan: '#19E6FF', cyanCore: '#D8FBFF', acid: '#C6FF3D', amber: '#FFB547',
  jacket: '#1C1932', jacketHi: '#2E2A52', jacketLo: '#110F20', rib: '#2A2646', ribLo: '#15122A', strap: '#262240', pale: '#E9E6F2',
  sneaker: '#1A1730', sneakerHi: '#34305A', sole: '#E9E6F2',
};
const XF = {   // far side: darker, less lit (thin dim rims, no cores)
  ink: '#07060F', mag: '#7A2E60', magCore: '#A04A80', cyan: '#2A6F8A', cyanCore: '#3E8CA8', acid: '#5E7A24', amber: '#7A5A2A',
  jacket: '#100E1E', jacketHi: '#1A1730', jacketLo: '#0A0914', rib: '#17142A', ribLo: '#0C0A18', strap: '#151226', pale: '#6A6390',
  sneaker: '#0D0B16', sneakerHi: '#1A1730', sole: '#5A5480',
};

// ---------------------------------------------------------------- glyphs (WenQuanYi Zen Hei / DejaVu Sans Mono Bold, em 100)
const GLYPH = {
  '鹈': 'M32 12Q28 12 25 12Q25 5 25-1L25-17Q19-6 6 5Q4 3 1 1Q7-4 11-10Q16-16 22-26L9-26L9-47L25-47L25-58L18-58Q13-58 9-57Q9-60 9-62Q13-62 18-62L28-62Q33-70 36-80Q40-79 43-78Q41-71 35-62L48-62L48-43L31-43L31-31L48-31L48-13Q48-10 45-7Q41-5 36-5Q37-10 34-13Q35-13 37-13Q41-12 41-13Q42-13 42-14L42-26L31-26L31-1Q31 5 32 12ZM26-66L20-63L10-78L17-82ZM25-31L25-43L15-43Q15-37 16-31ZM31-47L41-47L41-58L33-58L32-57Q32-58 31-58ZM86-13Q85-10 86-7Q81-8 77-8L64-8Q60-8 56-7Q56-10 56-13Q60-12 64-12L77-12Q81-12 86-13ZM80-51L75-46L68-57L73-61ZM78-33Q79-38 77-41Q79-41 82-41Q85-41 85-41Q86-42 86-43L86-63L72-63L71-62Q71-63 70-63Q69-63 66-63L66-29L96-29L96 4Q96 8 94 11Q90 14 82 14Q83 9 80 6Q83 6 86 6Q90 6 90 5Q91 5 91 3L91-25L61-25L61-68Q65-68 68-68Q72-72 73-78Q76-77 79-76Q78-71 76-68L91-68L91-42Q91-39 89-37Q86-33 78-33Z',
  '鹕': 'M49-26L39-26Q40-11 35-2Q30 7 22 12Q21 9 17 7Q33 0 33-22L33-74L56-74L56 1Q56 8 52 10Q48 13 41 12Q42 8 39 5Q41 5 44 5Q47 5 48 4Q49 3 49-3ZM12-2L5-2L5-38Q9-38 13-38L13-54L2-53Q2-56 2-58L13-58L13-69Q13-76 13-82Q16-82 20-82Q19-76 19-69L19-58L32-58Q32-56 32-53L19-54L19-38L28-38L28-2L21-2L21-10L12-10ZM49-52L49-70L39-70L39-52ZM49-30L49-49L39-49L39-30ZM21-34L12-34L12-14L21-14ZM87-13Q86-10 87-7Q83-8 79-8L66-8Q63-8 59-7Q59-10 59-13Q63-12 66-12L79-12Q83-12 87-13ZM81-51L77-46L71-57L75-61ZM80-33Q80-38 78-41Q80-41 83-41Q86-41 86-41Q87-42 87-43L87-63L74-63L73-62Q73-63 72-63Q71-63 68-63L68-29L97-29L97 4Q97 8 94 11Q91 14 83 14Q84 9 81 6Q84 6 87 6Q90 6 91 5Q91 5 91 3L91-25L63-25L63-68Q67-68 71-68Q74-72 75-78Q78-77 81-76Q79-71 78-68L92-68L92-42Q92-39 90-37Q87-33 80-33Z',
  '0': 'M24-36Q24-39 26-41Q28-42 30-42Q33-42 34-41Q36-39 36-36Q36-34 34-32Q33-30 30-30Q28-30 26-32Q24-34 24-36ZM30-62Q25-62 23-56Q21-50 21-36Q21-23 23-17Q25-11 30-11Q35-11 37-17Q40-23 40-36Q40-50 37-56Q35-62 30-62ZM6-36Q6-55 12-65Q18-74 30-74Q42-74 48-65Q54-55 54-36Q54-17 48-8Q42 1 30 1Q18 1 12-8Q6-17 6-36Z',
  '7': 'M7-73L53-73L53-63L28 0L13 0L37-60L7-60Z',
  'N': 'M6-73L21-73L42-20L42-73L54-73L54 0L39 0L19-53L19 0L6 0Z',
  'P': 'M22-61L22-39L28-39Q35-39 38-42Q41-44 41-50Q41-56 38-58Q35-61 28-61ZM8-73L28-73Q43-73 49-68Q56-62 56-50Q56-38 49-33Q43-27 28-27L22-27L22 0L8 0Z',
  '-': 'M15-36L46-36L46-22L15-22Z',
};
const ADV = { '鹈': 94, '鹕': 94 };
// A string of glyphs as one path group: baseline-left at (x, y), cap size s (em = s).
function glyphs(str, x, y, s, fillC, extra = {}) {
  let cx = 0; const parts = [];
  for (const ch of str) { parts.push(h('path', { d: GLYPH[ch], transform: `translate(${f(cx)} 0)` })); cx += ADV[ch] || 60; }
  return h('g', { transform: `translate(${f(x)} ${f(y)}) scale(${f(s / 100)})`, fill: fillC, ...extra }, parts);
}

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
// Neon rim/piping without filters: wide faint halo + bright line + pale core (the far side gets the dim line only).
// The 20 % halo is see-through light, not an occluder, so it takes no pointer hits (it never hides the part below).
function neon(d, col, core, w, far, extra = {}) {
  if (far) return line(d, col, w * 0.8, extra);
  return h('g', extra, line(d, col, w * 3.4, { 'stroke-opacity': 0.2, style: 'pointer-events:none !important' }), line(d, col, w), core ? line(d, core, w * 0.38) : '');
}
// an arc about (cx,cy) as short quadratic pieces (small hit-test chords), angles in degrees
const arcQ = (cx, cy, r, a0, a1, n = 8) => splitQ(Array.from({ length: n + 1 }, (_, i) => { const a = lerp(a0, a1, i / n) * D2R; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; }));
// seeded deterministic jitter for baked hand-made wobble (no Math.random)
function jit(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 - 0.5; }; }

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
  return { d, r, P, hw };
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
// knit rib lines inside a disc of radius r about (0,0) extended to x = x1 (the cuff): lines run along the bone
function ribLines(r, x1, step, y0 = -r + 1.5) {
  let d = '';
  for (let y = y0; y <= r - 1.5; y += step) { const x0 = -Math.sqrt(Math.max(0, r * r - y * y)) + 1; d += `M${f(x0)} ${f(y)}L${f(x1 - 1)} ${f(y * 0.96)}`; }
  return d;
}

// ================================================================ WINGS
// ---- upper wing = jacket sleeve (shoulder-local; +x toward the elbow = down at rest, +y = back toward the tail)
const ELBOW_R = 16.5;
function wingUpper(I, far) {
  const Z = far ? XF : X, kids = [];
  // tertials: white feathers fanning out from under the sleeve's trailing edge onto the back
  const ter = [];
  for (let i = 0; i < 8; i++) { const u = i / 7; ter.push(feather(lerp2([-10, 16.5], [52, 14.5], u), lerp(122, 102, u), lerp(42, 30, u), lerp(12.5, 10.5, u), -0.06, 'round', 0.7)); }
  kids.push(G('tertials', 'O', far, [
    ...ter.map(t => fill(t.d, I.P, { stroke: far ? I.B : I.B, 'stroke-width': far ? 0.8 : 1.2, 'stroke-linejoin': 'round' })),
    far ? '' : fill(ter.map(t => `M${pt(t.P(0.55, t.hw * 0.95))}Q${pt(t.P(0.85, t.hw * 1.02))} ${pt(t.P(0.97, t.hw * 0.3))}L${pt(t.P(0.8, t.hw * 0.25))}Z`).join(''), I.B, { 'fill-opacity': 0.55, 'data-detail': tag('T', 'tertial-shade') }),
    far ? '' : line(ter.map(t => `M${pt(t.P(0.5, 0))}L${pt(t.P(0.86, 0))}`).join(''), I.B, 0.7, { 'data-detail': tag('T', 'tertial-shafts') }),
    far ? '' : neon(ter.slice(0, 5).map(t => `M${pt(t.P(0.74, t.hw * 0.95))}Q${pt(t.P(0.98, t.hw * 0.6))} ${pt(t.P(1, 0))}`).join(''), X.mag, X.magCore, 0.9, far, { 'data-detail': tag('O', 'tertial-magenta-tips') }),
  ]));
  // sleeve outline: shoulder cap (x −33) → cap round the elbow (r 15.5 about (78,0), inside the lower cuff disc)
  const cap = Array.from({ length: 7 }, (_, i) => { const a = lerp(-100, 100, i / 6); return [78 + 15.5 * Math.cos(a * D2R), 15.5 * Math.sin(a * D2R)]; });
  const top = [[-24, -19.5], [0, -22], [30, -20.5], [56, -17.4]], bot = [[56, 17.6], [30, 20], [0, 21.5], [-24, 18.5]];
  const sleeve = smooth([...top, ...cap, ...bot, [-33, 0]], true, 0.16);
  const sk = [fill(sleeve, Z.jacket, { stroke: Z.ink, 'stroke-width': far ? 0.9 : 1.3, 'stroke-linejoin': 'round' })];
  // volume: lit front panel (hi) and a shadow band along the rear
  sk.push(fill(smooth([[-22, -16], [4, -19], [34, -17.5], [62, -13.5], [80, -12], [66, -8], [34, -9.5], [2, -10], [-24, -8]], true, 0.16), Z.jacketHi, { 'data-detail': far ? undefined : tag('T', 'sleeve-lit-panel') }));
  if (!far) {
    sk.push(fill(smooth([[-26, 11], [0, 14], [34, 13], [64, 10], [82, 12], [66, 17], [30, 19.6], [0, 21], [-24, 17.5]], true, 0.16), Z.jacketLo, { 'fill-opacity': 0.9 }));
    // raglan seam from the neck to the underarm, with top-stitching
    sk.push(G('sleeve-raglan-seam', 'O', far, [line(curve([[-20, -19], [-12, -8], [-8, 4], [-12, 17]], 3), Z.ink, 1.2),
      line(curve([[-17.5, -18.6], [-9.5, -8], [-5.4, 4], [-9.2, 17.4]], 3), Z.pale, 0.45, { 'stroke-dasharray': '1.4 1.3', 'stroke-opacity': 0.55 })]));
    // lengthwise panel seam + stitching
    sk.push(G('sleeve-panel-seam', 'T', far, [line(curve([[-4, -1], [24, -3], [52, -2.4], [74, -1]], 3), Z.ink, 0.9),
      line(curve([[-2, 1.2], [24, -0.8], [52, -0.2], [72, 1.2]], 3), Z.pale, 0.4, { 'stroke-dasharray': '1.3 1.2', 'stroke-opacity': 0.45 })]));
    // bunching folds at the inner elbow (baked, seeded wobble)
    const r = jit(71); let fo = '', fh = '';
    for (let i = 0; i < 4; i++) {
      const x = 50 + i * 6.2 + r() * 1.5, y0 = 6 + r() * 2, y1 = 16 - i * 0.8;
      fo += `M${f(x)} ${f(y0)}Q${f(x + 3.2 + r())} ${f((y0 + y1) / 2)} ${f(x + 1.5)} ${f(y1)}`;
      fh += `M${f(x + 1.3)} ${f(y0 + 0.6)}Q${f(x + 4.4 + r())} ${f((y0 + y1) / 2)} ${f(x + 2.7)} ${f(y1 - 1)}`;
    }
    for (let i = 0; i < 3; i++) { const x = 58 + i * 7 + r(); fo += `M${f(x)} ${f(-14 + r())}Q${f(x + 3)} ${f(-9)} ${f(x + 1)} ${f(-4.5)}`; }
    sk.push(G('sleeve-elbow-folds', 'T', far, [line(fo, Z.ink, 0.9, { 'stroke-opacity': 0.85 }), line(fh, Z.jacketHi, 0.7)]));
    // zip pocket on the upper arm: welt, teeth, acid pull tab
    sk.push(G('sleeve-zip-pocket', 'O', far, [
      fill('M16 3.2L46 1.8L46.4 5.2L16.4 6.8Z', Z.jacketLo),
      line('M17 5L45.6 3.5', '#8A90B0', 1.4, { 'stroke-dasharray': '0.6 0.7', 'stroke-linecap': 'butt' }),
      fill('M44.6 2.6l3.6 -0.2l1.6 5.2l-3 0.6z', X.acid), line('M46.6 3.4l0.9 3', X.ink, 0.5)]));
    // 鹈鹕 patch, kept upright (counter-rotated for the rest pose) with a magenta neon border
    sk.push(G('sleeve-patch-hanzi', 'O', far, h('g', { transform: 'translate(30 -9.5) rotate(-72)' },
      h('rect', { x: -12.4, y: -7, width: 24.8, height: 13.4, rx: 2, fill: '#0E0C18' }),
      neon('M-11.4 -6h22.8a1.2 1.2 0 0 1 1.2 1.2v10a1.2 1.2 0 0 1 -1.2 1.2h-22.8a1.2 1.2 0 0 1 -1.2 -1.2v-10a1.2 1.2 0 0 1 1.2 -1.2z', X.mag, null, 0.8, false),
      glyphs('鹈鹕', -9.6, 3.9, 9.6, '#FFE3F0'))));
    // velcro strap with a buckle across the sleeve above the cuff
    sk.push(G('sleeve-strap-buckle', 'O', far, [
      fill('M60.4 -16.2L66.4 -15.4L65.6 16.4L59.6 16.6Z', Z.strap), line('M61 -14L60.4 14.6M65.2 -13.6L64.6 14.6', '#4A4F70', 0.4, { 'stroke-dasharray': '0.8 0.8' }),
      h('rect', { x: 58.6, y: -5.4, width: 9.4, height: 7.4, rx: 1.4, fill: 'none', stroke: '#A7AED0', 'stroke-width': 1.3 }),
      line('M63.3 -4.4v5.4', '#A7AED0', 1)]));
    // reflective chevrons near the shoulder
    sk.push(fill('M2 -17.6l5 3.4l5 -3.4l0 2.4l-5 3.4l-5 -3.4zM2 -12.6l5 3.4l5 -3.4l0 2.4l-5 3.4l-5 -3.4z', X.pale, { 'fill-opacity': 0.72, 'data-detail': tag('O', 'sleeve-reflective-chevrons') }));
    // status LEDs (acid, cyan, cyan)
    sk.push(G('sleeve-status-leds', 'O', far, [h('circle', { cx: 48, cy: -12.6, r: 1.1, fill: X.acid }), h('circle', { cx: 51.4, cy: -12.2, r: 1.1, fill: X.cyan }), h('circle', { cx: 54.8, cy: -11.8, r: 1.1, fill: X.cyan })]));
  }
  // dual rim: cyan on the leading (front, −y) edge, magenta piping along the trailing (+y) edge
  sk.push(neon(curve([[-20, -18.6], [0, -21], [30, -19.6], [56, -16.4], [76, -14.2]], 3), Z.cyan, X.cyanCore, 1.3, far, { 'data-detail': tag('O', (far ? 'far-' : '') + 'sleeve-cyan-rim') }));
  sk.push(neon(curve([[-22, 17.2], [0, 20.2], [30, 18.8], [56, 16.4], [74, 14.6]], 3), Z.mag, X.magCore, 1.3, far, { 'data-detail': tag('O', (far ? 'far-' : '') + 'sleeve-magenta-piping') }));
  kids.push(G('jacket-sleeve', 'O', far, sk));
  return kids.join('');
}

// ---- lower wing (elbow-local; +x toward the wrist, +y = down below the arm line)
const PRIM = Array.from({ length: 5 }, (_, i) => { const u = i / 4; return { b: [lerp(66, 76, u), lerp(8, 3, u)], a: lerp(160, 140, u), L: lerp(90, 72, u), w: lerp(12, 13.5, u) }; });
function wingLower(I, far, side) {
  const Z = far ? XF : X, s = [], ref = n => `pl-${side}-${n}`;
  // secondaries: black fringe hanging below the arm line, sheen edges, shafts, magenta-lit tips
  const sec = [];
  for (let i = 0; i < 10; i++) { const u = i / 9; sec.push(feather([lerp(4, 62, u), lerp(5, 4, u)], lerp(106, 98, u), lerp(33, 27, u), 11.5, 0.05, 'round', 0.8)); }
  const secG = G('secondaries-fringe', 'O', far, [
    ...[...sec].reverse().map(t => fill(t.d, I.N, { stroke: far ? Z.ink : I.S, 'stroke-width': 0.7 })),
    far ? '' : line(sec.map(t => `M${pt(t.P(0.45, -4.9))}Q${pt(t.P(0.78, -5.4))} ${pt(t.P(0.93, -2.6))}`).join(''), I.S, 1, { 'data-detail': tag('T', 'secondary-sheen-edges') }),
    far ? '' : line(sec.map(t => `M${pt(t.P(0.42, 0))}L${pt(t.P(0.86, 0))}`).join(''), I.S, 0.6, { 'data-detail': tag('T', 'secondary-rachis') }),
    neon(sec.map(t => `M${pt(t.P(0.66, t.hw * 0.98))}Q${pt(t.P(0.97, t.hw * 0.75))} ${pt(t.P(1.01, -0.5))}`).join(''), Z.mag, X.magCore, 1, far, { 'data-detail': tag('O', (far ? 'far-' : '') + 'secondary-neon-tips') }),
  ]);
  // trailing primaries, folded under the secondaries and sweeping back and down from the wrist past the fringe;
  // rotated about the wrist by the wrist angle each frame, each can fan open (wave).
  const prim = PRIM.map(q => feather(q.b, q.a, q.L, q.w, -0.07, 'point', 0.9));
  s.push(G('primaries-trailing', 'O', far, [
    h('g', { 'data-ref': ref('prims') }, prim.map((p, i) => h('g', { 'data-ref': ref('p' + i) }, fill(p.d, I.N, { stroke: far ? Z.ink : I.S, 'stroke-width': 0.9, 'stroke-linejoin': 'round' }),
      far ? '' : line(p.r, I.S, 0.8),
      far || i < 2 ? '' : line(`M${pt(p.P(0.55, 3.6))}L${pt(p.P(0.66, 1.3))}`, I.S, 1.1),
      far || i > 2 ? '' : neon(`M${pt(p.P(0.62, -p.hw * 0.9))}Q${pt(p.P(0.9, -p.hw * 0.5))} ${pt(p.P(1, 0))}`, X.cyan, null, 0.8, false)))),
    secG]));
  // covert base: the forearm's propatagium + covert rows (static: the elbow sits inside the cuff disc)
  const base = `M-4 -14.6C20 -19 50 -16.4 73 -8.5Q80 -5 79 0L76 6L30 8.6L0 9.6L-6 4Z`;
  const panel = [fill(base, I.P)];
  // lavender volume along the underside of the arm
  if (!far) panel.push(fill('M2 2.6C26 1 52 1.4 76 3L76 6L30 8.6L0 9.6Z', I.B, { 'fill-opacity': 0.4 }));
  const gc = [];
  for (let i = 0; i < 10; i++) { const u = i / 9; gc.push(feather([lerp(9, 70, u), -2], lerp(100, 94, u), 15, 8.6, 0.04, 'round', 1)); }
  panel.push(h('g', { 'data-ref': ref('gc') }, G('greater-coverts', 'O', far, [
    fill(gc.map(t => t.d).join(''), I.P, { stroke: I.B, 'stroke-width': far ? 0.8 : 1.3, 'stroke-linejoin': 'round' }), fill('M8 -6L76 -7L78 0L7 3Z', I.P),
    far ? '' : line(gc.slice(0, 9).map(t => `M${pt(t.P(0.5, 0))}L${pt(t.P(0.86, 0.3))}`).join(''), I.B, 0.8, { 'data-detail': tag('T', 'greater-covert-shafts') }),
    far ? '' : neon(gc.map(t => `M${pt(t.P(0.78, t.hw * 0.9))}Q${pt(t.P(1.0, t.hw * 0.4))} ${pt(t.P(1.01, -1))}`).join(''), X.mag, null, 0.7, false, { 'stroke-opacity': 0.9, 'data-detail': tag('O', 'covert-magenta-bloom') }),
  ])));
  if (!far) {
    const down = [0.12, 1];
    panel.push(h('clipPath', { id: ref('clip') }, h('path', { d: base })));
    panel.push(h('g', { 'clip-path': `url(#${ref('clip')})` },
      line(scallops(rowPts([11, -12.6], [58, -13.6], 7), down, 1.6) + scallops(rowPts([12, -15.4], [48, -16], 6), down, 1.3), I.B, 1, { 'data-detail': tag('T', 'lesser-covert-rows'), 'data-tract': 'coverts' }),
      line(scallops(rowPts([11, -6.4], [60, -7.2], 7), down, 2.1), I.B, 1.2, { 'data-detail': tag('T', 'median-covert-row'), 'data-tract': 'coverts' })));
    // marginal coverts: tiny scallops just inside the leading edge
    const le = t => { const m = 1 - t, P0 = [-4, -14.6], C1 = [20, -19], C2 = [50, -16.4], E = [73, -8.5]; return [0, 1].map(c => m * m * m * P0[c] + 3 * m * m * t * C1[c] + 3 * m * t * t * C2[c] + t * t * t * E[c]); };
    const mp = Array.from({ length: 10 }, (_, i) => add(le(lerp(0.22, 0.92, i / 9)), [0, 3.2]));
    panel.push(line(scallops(mp, [0.1, 1], 1.3), I.B, 0.9, { 'data-detail': tag('T', 'marginal-coverts'), 'data-tract': 'coverts' }));
    // leading edge: ink key line + cyan front rim inside it
    panel.push(neon(splitQ(Array.from({ length: 9 }, (_, i) => add(le(lerp(0.2, 0.96, i / 8)), [0, 1.9]))), X.cyan, X.cyanCore, 1.2, false, { 'data-detail': tag('O', 'wing-cyan-rim') }));
    panel.push(line(splitQ(Array.from({ length: 10 }, (_, i) => le(lerp(0.16, 1, i / 9)))), X.ink, 1.8, { 'data-detail': tag('O', 'wing-leading-edge') }));
  } else {
    panel.push(line(splitQ(Array.from({ length: 6 }, (_, i) => [lerp(2, 70, i / 5), lerp(-15.4, -9.4, (i / 5) ** 2)])), XF.cyan, 0.8));
  }
  s.push(G('covert-panel', 'O', far, panel));
  // ribbed jacket cuff at the elbow: a disc r 16.5 about the pivot (covers the sleeve's elbow cap at every angle)
  const cuff = `M${f(-ELBOW_R)} 0A${ELBOW_R} ${ELBOW_R} 0 0 1 0 ${f(-ELBOW_R)}L9 -15.6Q12.2 0 9 15.6L0 ${f(ELBOW_R)}A${ELBOW_R} ${ELBOW_R} 0 0 1 ${f(-ELBOW_R)} 0Z`;
  const ck = [fill(cuff, Z.rib, { stroke: Z.ink, 'stroke-width': far ? 0.9 : 1.2 })];
  ck.push(line(ribLines(ELBOW_R, 10.6, far ? 3.4 : 2.3), Z.ribLo, far ? 0.8 : 1, { 'data-detail': far ? undefined : tag('T', 'cuff-knit-rib') }));
  if (!far) {
    ck.push(neon('M9 -15.2Q12 0 9 15.2', X.mag, X.magCore, 1.2, false, { 'data-detail': tag('O', 'cuff-magenta-hem') }));
    ck.push(neon(arcQ(0, 0, ELBOW_R - 1.6, 200, 268, 5), X.cyan, null, 1, false));
    ck.push(G('cuff-snap-tab', 'O', far, [fill('M-3 -17.8h7.4l1.2 5.4h-9.8z', X.strap), h('circle', { cx: 0.9, cy: -15.4, r: 1.3, fill: '#A7AED0' }), h('circle', { cx: 0.9, cy: -15.4, r: 0.5, fill: X.ink })]));
  }
  s.push(G('sleeve-rib-cuff', 'O', far, ck));
  return s.join('');
}

// ---- hand (wrist-local, pivot ON the grip; grip radius 6; bell at about (8,−8))
function fingerFeathers() {
  // five outer primaries leave the carpal bend at the front-top of the grip and share one wrap band round its
  // front; one by one they peel away, so five separate curled tips splay round the lower half of the grip like a
  // feather fan — never a coil of knuckles. Returned innermost-last (drawn on top).
  const F = [], R0 = 9.2, W = 5.2, a0 = -44;
  for (let i = 4; i >= 0; i--) {
    const a1 = 18 + 25 * i, n = 6 + i;
    const L = [], R = [], C = [];
    for (let j = 0; j <= n; j++) {
      const a = lerp(a0, a1, j / n), nr = dir(a), c = mul(nr, R0);
      C.push(c); L.push(add(c, mul(nr, W / 2))); R.push(add(c, mul(nr, -W / 2)));
    }
    const td = dir(a1 + 90 - 46), tipL = 14 - 0.8 * i, e = C[n], nn = perp(td);
    // tip curls toward the rear (+nn side bends back by ~20% of its length)
    const mid = add(add(e, mul(td, tipL * 0.5)), mul(nn, tipL * 0.06));
    const tip = add(add(e, mul(td, tipL)), mul(nn, tipL * 0.24));
    const d = smooth([...L, add(mid, mul(nn, -W * 0.36)), tip, add(mid, mul(nn, W * 0.3)), ...R.reverse()], true, 0.15);
    const rach = `M${pt(C[n - 1])}Q${pt(e)} ${pt(lerp2(mid, tip, 0.5))}`;
    const edge = `M${pt(add(e, mul(nn, -W * 0.45)))}Q${pt(add(mid, mul(nn, -W * 0.42)))} ${pt(tip)}`;
    F.push({ d, rach, tip, edge });
  }
  return F;
}
function wingHand(I, far, side) {
  const Z = far ? XF : X, s = [], ref = n => `pl-${side}-${n}`;
  // open fan (wave): six primaries splayed from the wrist; hidden while gripping
  const fan = [];
  for (let i = 0; i < 6; i++) fan.push(feather([-2 + i * 0.6, 2 - i * 0.8], lerp(52, -26, i / 5), lerp(42, 56, i / 5) - (i > 3 ? (i - 3) * 5 : 0), 12.5, -0.05, 'round', 0.8));
  s.push(h('g', { 'data-ref': ref('fan'), style: 'display:none' },
    [...fan].reverse().map((p, i) => h('g', { 'data-ref': ref('fan' + (5 - i)) }, fill(p.d, I.N, { stroke: far ? Z.ink : I.S, 'stroke-width': 1 }), far ? '' : line(p.r, I.S, 0.8),
      far ? '' : neon(`M${pt(p.P(0.4, -p.hw))}Q${pt(p.P(0.82, -p.hw * 1.02))} ${pt(p.P(0.97, -p.hw * 0.4))}`, i % 2 ? X.cyan : X.mag, null, 0.8, false)))));
  const F = fingerFeathers();
  s.push(h('g', { 'data-ref': ref('grip') }, G('primary-fingers', 'O', far, [
    h('circle', { cx: -1, cy: 0, r: 7.6, fill: I.N }),        // the grip end-on is fully inside the hand
    ...F.map(p => fill(p.d, I.N, { stroke: far ? Z.ink : I.S, 'stroke-width': 1, 'stroke-linejoin': 'round' })),
    far ? '' : line(F.map(p => p.rach).join(''), I.S, 0.6, { 'data-detail': tag('T', 'finger-rachis') }),
    far ? '' : neon(F.map(p => p.edge).join(''), X.mag, X.magCore, 0.8, false, { 'data-detail': tag('O', 'finger-neon-tips') }),
  ])));
  // primary coverts: short black feathers on the back of the hand, over the bases of the trailing primaries
  const pc = [];
  for (let i = 0; i < 4; i++) pc.push(feather([-6 - i * 2.6, -1 + i * 0.4], lerp(160, 126, i / 3), lerp(16, 12, i / 3), 7.5, -0.05, 'round', 0.9));
  s.push(G('primary-coverts', 'O', far, pc.map(p => fill(p.d, I.N, { stroke: far ? Z.ink : I.S, 'stroke-width': 0.8 }))));
  // carpal bend: white end of the leading edge folding over the top of the grip (the "palm" rests on the bar)
  const carpal = smooth([[-21, -10], [-10, -15], [1, -13.6], [7.4, -8.4], [6.4, -3.2], [0, -1.6], [-8, -0.6], [-17, -1.6], [-22, -5]]);
  s.push(G('carpal-bend', 'O', far, [fill(carpal, I.P),
    far ? '' : fill('M-20 -4.6Q-10 -2.4 0 -3.6L6 -3.4L0 -1.6L-8 -0.6L-17 -1.6Z', I.B, { 'fill-opacity': 0.45 }),
    far ? line(curve([[-18, -11.6], [-9, -15.2], [2, -14.4]], 2), XF.cyan, 0.8) : neon(curve([[-17, -10.6], [-9, -13.8], [1.6, -12.8], [6, -8.4]], 2), X.cyan, X.cyanCore, 1, false),
    far ? '' : line(curve([[-18, -11.6], [-9, -15.2], [2, -14.4], [7.2, -8.6], [6.4, -3.6]], 2), X.ink, 1.6),
    far ? '' : line('M-8 -6.4q2.1 2.4 4.2 0q2.1 2.4 4.2 0M-4 -3q2 2 4 0', I.B, 0.8, { 'data-detail': tag('T', 'carpal-covert-scallops') })]));
  // smart wrist band: a slim black band with a cyan micro-display, across the base of the hand
  if (!far) s.push(G('wrist-data-band', 'O', far, [fill('M-17.6 -13.4L-12.6 -14.8L-11 -0.8L-16 -0.6Z', X.jacketLo, { stroke: X.ink, 'stroke-width': 0.7 }),
    fill('M-16.4 -10.6L-13.2 -11.4L-12.6 -6.2L-15.8 -5.6Z', X.cyan), line('M-15.6 -9.4l1.8 -0.4M-15.4 -8l1.2 -0.3', X.ink, 0.45), h('circle', { cx: -13.8, cy: -2.6, r: 0.8, fill: X.acid })]));
  // alula: three small feathers on the leading edge of the wrist; rotates about its base for the bell flick
  const al = [];
  for (let i = 0; i < 3; i++) al.push(feather([-4 - i * 2.4, -13 + i * 0.9], lerp(-16, -4, i / 2), lerp(11.5, 8, i / 2), 5, 0.08, 'round', 0.9));
  s.push(h('g', { 'data-ref': ref('alula') }, G('alula', 'O', far, [
    ...[...al].reverse().map(p => fill(p.d, I.N, { stroke: far ? Z.ink : I.S, 'stroke-width': 0.8 })),
    far ? '' : neon(`M${pt(al[0].P(0.3, -2.4))}Q${pt(al[0].P(0.8, -2.8))} ${pt(al[0].P(1, 0))}`, X.cyan, null, 0.7, false),
    far ? '' : line(al.map(p => p.r).join(''), I.S, 0.5)])));
  return s.join('');
}

// ================================================================ LEGS
// Knee fringe: pointed feather tips round the knee over the sector the shank can leave through (−12..146° in
// thigh-local); the knee wrap (disc r 17.5) sits on top, so only the tips (r 18–22) peek out below it.
function cuffGeom(K) {
  const A0 = -12, A1 = 146, n = 8, step = (A1 - A0) / n;
  const at = (a, r) => add([K, 0], mul(dir(a), r));
  const N = [], T = [];
  for (let j = 0; j <= n; j++) N.push(at(A0 + j * step, j === 0 || j === n ? 12 : 16.8));
  let d = `M${pt([K - 16, -9.8])}L${pt(N[0])}`, edge = '';
  for (let j = 0; j < n; j++) {
    const a = A0 + j * step, r = 22.2 + [0, 1.4, -0.6, 1.8, 0.2, 1.2, -0.4, 0.8][j];
    const tip = at(a + step * 0.72, r), c1 = at(a + step * 0.28, r - 1.2), c2 = at(a + step * 0.95, r - 3.6);
    T.push(tip);
    d += `Q${pt(c1)} ${pt(tip)}Q${pt(c2)} ${pt(N[j + 1])}`;
    edge += `M${pt(N[j])}Q${pt(c1)} ${pt(tip)}M${pt(tip)}Q${pt(c2)} ${pt(N[j + 1])}`;
  }
  d += `L${pt([K - 16, 11.6])}Z`;
  return { d, edge, T };
}
const KNEE_R = 15.6;
function thigh(I, far) {
  const K = SKEL.thigh, Z = far ? XF : X;
  // drumstick: broad where it leaves the belly, tapering to a slim feathered shin at the knee
  const top = [[-14, -25], [12, -27], [44, -21], [76, -14], [106, -10.5], [128, -10], [140, -9.6]];
  const bottom = [[140, 11.6], [112, 11.5], [86, 11], [60, 9.5], [36, 6.5], [14, 4], [-4, 3], [-17, -8]];
  const cuff = cuffGeom(K);
  const kids = [fill(smooth([...top, ...bottom]), I.P), fill(cuff.d, I.P)];
  if (!far) {
    // lavender volume on the underside of the trousers
    kids.push(fill(smooth([[30, 2.6], [60, 4.4], [90, 6], [120, 6.4], [136, 7], [128, 11.6], [100, 11.4], [70, 10.4], [44, 7.6], [24, 5]], true, 0.16), I.B, { 'fill-opacity': 0.5, 'data-detail': tag('T', 'trouser-volume-shade') }));
    kids.push(line(cuff.edge, I.B, 1.3, { 'data-detail': tag('O', 'knee-feather-fringe') }));
    kids.push(line(cuff.T.map(t => `M${pt(lerp2([K, 0], t, 0.82))}L${pt(lerp2([K, 0], t, 0.94))}`).join(''), I.B, 0.7, { 'data-detail': tag('T', 'fringe-feather-shafts') }));
    // contour-feather scallops flowing down the leg (tips toward the knee), shrinking toward the knee
    const u = [1, 0.1];
    kids.push(line(scallops(rowPts([46, -15.5], [54, 6], 4), u, 2.6) + scallops(rowPts([70, -12.6], [74, 9], 3), u, 2.5) +
      scallops(rowPts([94, -10.2], [96, 10], 3), u, 2.2) + scallops(rowPts([108, -9.6], [109, 10.2], 3), u, 1.9) +
      scallops(rowPts([30, -19], [40, 3.6], 5), u, 2.6), I.B, 1.1, { 'data-detail': tag('T', 'trouser-feather-scallops'), 'data-tract': 'leg' }));
    kids.push(line('M62 6.4q9 2.4 18 2.6M88 8.2q9 1.6 16 1.4', I.B, 0.8, { 'data-detail': tag('T', 'trouser-rear-hatching') }));
    kids.push(line('M24 -21q5 3 4 8M35 -20.4q4.6 3.2 3.4 8.2M28 1.6q3.4 -2 7.2 -0.8', I.B, 1, { 'data-detail': tag('O', 'flank-plume-curls') }));
    kids.push(line(curve([[50, -19.6], [76, -14], [106, -10.5], [118, -10.2]]), X.ink, 1.6));
    kids.push(line(curve([[44, 7.8], [60, 9.5], [86, 11], [118, 11.5]]), X.ink, 1.5));
    // dual rim: cyan along the front (top) edge, magenta under the leg
    kids.push(neon(curve([[40, -20], [76, -12.4], [104, -8.8], [116, -8.4]]), X.cyan, X.cyanCore, 1.6, false, { 'data-detail': tag('O', 'thigh-cyan-rim') }));
    kids.push(neon(curve([[34, 4.2], [60, 8], [86, 9.6], [116, 10]]), X.mag, X.magCore, 1.6, false, { 'data-detail': tag('O', 'thigh-magenta-rim') }));
  } else {
    kids.push(line(scallops(rowPts([80, -11], [82, 9], 3), [1, 0.1], 2.4), I.B, 1, { 'data-detail': tag('T', 'far-trouser-scallops') }));
    kids.push(line(curve([[60, -16.4], [86, -12.4], [112, -9.8]]), XF.cyan, 0.9, { 'data-detail': tag('O', 'far-thigh-rim') }));
  }
  // techwear knee wrap: a band from x 112 that closes in a disc r 17.5 round the knee pivot
  const wrap = `M116 -11.6C124 -12.8 132 -15 ${K} ${f(-KNEE_R)}A${KNEE_R} ${KNEE_R} 0 0 1 ${K} ${f(KNEE_R)}C132 15.4 124 13.8 116 12.8Q113.8 0.6 116 -11.6Z`;
  const wk = [fill(wrap, Z.jacket, { stroke: Z.ink, 'stroke-width': far ? 0.9 : 1.2 })];
  if (!far) {
    // two crossing wrap straps (lit) and a strap round the knee cap
    wk.push(G('knee-wrap-straps', 'O', far, [fill('M118 -12L123.6 -12.8L132.4 14.6L126.6 14.2Z', X.strap), fill('M132.4 -14.8L138 -15.4L129.4 14.8L124 14.2Z', X.jacketHi),
      line('M119.4 -10.8L127.8 13M133.8 -13.4L125.8 13.4', X.pale, 0.4, { 'stroke-dasharray': '1.2 1.1', 'stroke-opacity': 0.5 })]));
    wk.push(line(arcQ(K, 0, KNEE_R - 3.8, -80, 80, 8), X.jacketLo, 3.2, { 'data-detail': tag('O', 'knee-cap-pad') }));
    // velcro patch + reflective tag "NP-07"
    wk.push(G('knee-velcro-tag', 'O', far, [h('rect', { x: 138.6, y: -9.4, width: 13.4, height: 6.4, rx: 1.2, fill: X.pale, 'fill-opacity': 0.88 }), glyphs('NP-07', 139.5, -4.3, 4, X.ink)]));
    // hex LED stud with glow
    wk.push(G('knee-hex-led', 'O', far, [h('circle', { cx: 146.4, cy: 5.4, r: 4, fill: X.cyan, 'fill-opacity': 0.18 }),
      fill('M146.4 2.8l2.25 1.3v2.6l-2.25 1.3l-2.25 -1.3v-2.6z', X.cyan, { stroke: X.ink, 'stroke-width': 0.5 }), h('circle', { cx: 146.4, cy: 5.4, r: 0.9, fill: X.cyanCore })]));
    wk.push(neon(curve([[116.4, -11], [124, -12.2], [132, -14.2], [K, -KNEE_R + 0.9]], 2) + arcQ(K, 0, KNEE_R - 0.9, -90, -30, 4), X.mag, X.magCore, 1.2, false, { 'data-detail': tag('O', 'knee-wrap-piping') }));
    wk.push(neon(arcQ(K, 0, KNEE_R - 0.9, 8, 76, 5), X.cyan, null, 1, false));
    wk.push(line('M117 -9Q115.4 0.6 117 10.8', X.pale, 0.45, { 'stroke-dasharray': '1.2 1.1', 'stroke-opacity': 0.55, 'data-detail': tag('T', 'knee-wrap-stitching') }));
  } else {
    wk.push(line(curve([[116.4, -11], [124, -12.2], [132, -14.2], [K, -KNEE_R + 0.9]], 2), XF.mag, 0.9));
    wk.push(line(arcQ(K, 0, KNEE_R - 0.9, -75, 75, 8), XF.cyan, 0.9, { 'data-detail': tag('O', 'far-knee-wrap-rim') }));
    wk.push(line('M121 -11L128 13M133 -13L126 13', XF.jacketHi, 2.2));
  }
  kids.push(G('techwear-knee-wrap', 'O', far, wk));
  return G('thigh-trousers', 'O', far, kids);
}
// ---- shank / tarsus (knee-local; +x toward the ankle, +y = rear)
function shank(I, far) {
  const L = SKEL.shank;
  const hw = x => lerp(6.8, 5, x / L);               // half width 13.6 -> 10
  const outline = `M0 ${f(-hw(0))}C40 ${f(-hw(40))} 90 ${f(-hw(90))} ${L} ${f(-hw(L))}A5 5 0 0 1 ${L} ${f(hw(L))}` +
    `C92 ${f(hw(92))} 36 ${f(hw(36) + 0.4)} 29 ${f(hw(29) + 0.6)}C26 ${f(hw(26) + 3.6)} 20 ${f(hw(20) + 3.8)} 16 ${f(hw(16) + 1.2)}C10 ${f(hw(10))} 4 ${f(hw(0))} 0 ${f(hw(0))}Z`;
  // intertarsal knuckle: the joint bulges forward just below the wrap and the tarsus leaves it at a slight angle
  const knuckle = 'M13 -6.4C16 -10.6 25 -11 30 -7.6C33 -5.6 34 -3 33 0L14 0Z';
  const kids = [fill(outline, I.O), fill(knuckle, I.O)];
  const SC = '#5A1E0A';   // scale lines: translucent dark over whatever orange the mood prints
  if (!far) {
    kids.push(line('M17 7.6Q21 11.4 23.4 10.6Q27 9.6 29.5 7.4M19.5 5.2q3.6 2.4 7.2 0', SC, 1.1, { 'stroke-opacity': 0.6, 'data-detail': tag('O', 'intertarsal-heel-pad') }));
    kids.push(line('M15.6 -7.8Q23 -11.6 30.4 -7.2M18 -3.6Q23 -1.2 28.6 -3.8M31.6 -5.4Q34.6 -1 31.4 3.2', SC, 1, { 'stroke-opacity': 0.6, 'data-detail': tag('O', 'intertarsal-knuckle') }));
    // rear shade band keeps the tarsus round; reticulate rear scales sit on it
    let rt = '';
    for (let x = 34, k = 0; x <= 112; x += 4.6, k++) { const w = hw(x), y = w * (k % 2 ? 0.62 : 0.3); rt += `M${f(x)} ${f(y)}q1.6 -1.3 3.2 0q-1.6 1.3 -3.2 0`; }
    kids.push(G('tarsus-shade-band', 'T', far, [fill(`M30 ${f(hw(30) - 3)}C70 ${f(hw(70) - 3.2)} 110 ${f(hw(110) - 3)} ${118} ${f(hw(118) - 2.4)}L118 ${f(hw(118))}C110 ${f(hw(110))} 70 ${f(hw(70))} 30 ${f(hw(30))}Z`, '#6A2410', { 'fill-opacity': 0.42 }),
      line(rt, SC, 0.6, { 'stroke-opacity': 0.7, 'data-detail': tag('T', 'tarsus-reticulate-scales') })]));
    // dual rim: cyan down the front of the shin, magenta down the back
    kids.push(neon(splitQ([30, 52, 74, 96, 112].map(x => [x, -hw(x) + 0.9])), X.cyan, X.cyanCore, 1.1, false, { 'data-detail': tag('O', 'tarsus-cyan-rim') }));
    kids.push(neon(splitQ([34, 56, 78, 98, 112].map(x => [x, hw(x) - 0.9])), X.mag, X.magCore, 1.1, false, { 'data-detail': tag('O', 'tarsus-magenta-rim') }));
    // transverse scutes on the front (scale rings), overlapping downward
    let sc = '';
    for (let x = 24; x <= 114; x += 7.4) { const w = hw(x); sc += `M${f(x)} ${f(-w + 0.3)}Q${f(x + 2.6)} ${f(-w * 0.2)} ${f(x + 0.6)} ${f(w * 0.45)}`; }
    kids.push(line(sc, SC, 0.95, { 'stroke-opacity': 0.62, 'data-detail': tag('T', 'tarsus-scutes') }));
    // scute highlights (pale warm) just above each ring
    let sh = '';
    for (let x = 27; x <= 112; x += 7.4) { const w = hw(x); sh += `M${f(x)} ${f(-w + 1.3)}l2.4 0.2`; }
    kids.push(line(sh, '#FFE7C8', 0.9, { 'stroke-opacity': 0.8, 'data-detail': tag('T', 'scute-highlights') }));
  } else {
    kids.push(fill(outline, XF.ink, { 'fill-opacity': 0.42 }));
    let sc = '';
    for (let x = 36; x <= 126; x += 9) { const w = hw(x); sc += `M${f(x)} ${f(-w + 0.4)}q2.4 ${f(w * 0.6)} 0.6 ${f(w * 1.2)}`; }
    kids.push(line(sc, XF.ink, 0.8, { 'stroke-opacity': 0.6, 'data-detail': tag('T', 'far-tarsus-scutes') }));
    kids.push(line(splitQ([34, 58, 82, 106, L - 2].map(x => [x, -hw(x) + 0.6])), XF.cyan, 0.9, { 'data-detail': tag('O', 'far-tarsus-rim') }));
  }
  return G('tarsus', 'O', far, kids);
}
// ---- foot (ankle-local; ball (17,9) sits on the pedal spindle; pedal top face at y = 6 spans x ≈ 4..30)
// Totipalmate: toes IV (outer, nearest, longest), III, II and the hallux I, all joined by webs. The near toes
// drape over the pedal's front edge; the farther ones are seen across its top face (a slightly raised viewpoint
// fans them so every web is visible). The sneaker wrap is open-toed: it covers heel, ankle and the toe roots only.
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
  const Z = far ? XF : X, ref = n => `pl-${side}-${n}`, T = TOES;
  const webs = [];
  for (let i = 0; i < 3; i++) {
    const A = T[i], B = T[i + 1];
    const tipA = lerp2(A.mid, A.tip, 0.92), tipB = lerp2(B.mid, B.tip, 0.92);
    const dip = add(lerp2(tipA, tipB, 0.5), mul(norm(sub(lerp2(A.root, B.root, 0.5), lerp2(tipA, tipB, 0.5))), 5.5));
    webs.push(`M${pt(A.root)}L${pt(A.mid)}L${pt(tipA)}Q${pt(dip)} ${pt(tipB)}L${pt(B.mid)}L${pt(B.root)}Z`);
  }
  const pleats = [];
  for (let i = 0; i < 3; i++) {
    const A = T[i], B = T[i + 1];
    for (const k of [0.33, 0.66]) { const r = lerp2(A.root, B.root, k), m = lerp2(lerp2(A.mid, A.tip, 0.5), lerp2(B.mid, B.tip, 0.5), k); pleats.push(`M${pt(lerp2(r, m, 0.55))}L${pt(lerp2(r, m, 0.92))}`); }
  }
  const W = I.OW, Tc = I.O, SC = '#5A1E0A';
  const st = { stroke: far ? XF.ink : '#7A2E14', 'stroke-width': 0.75, 'stroke-linejoin': 'round' };
  // toes II–IV with their scutes, highlights, pads and claws (near toe on top)
  const toeKids = [T[2], T[1], T[0]].map(t => fill(toeD(t), Tc, st));
  if (!far) {
    toeKids.push(fill(T.slice(0, 2).map(t => { const p = lerp2(t.mid, t.tip, 0.55), nn = perp(norm(sub(t.tip, t.mid))); const c = add(p, mul(nn, t.w * 0.45)); return `M${pt(add(c, [-2.2, 0]))}q2.2 2.6 4.4 0z`; }).join(''), SC, { 'fill-opacity': 0.5, 'data-detail': tag('O', 'toe-pads') }));
    toeKids.push(line(T.slice(0, 3).map(t => { const nn = perp(norm(sub(t.tip, t.root))); return `M${pt(add(lerp2(t.root, t.mid, 0.82), mul(nn, -t.w * 0.18)))}L${pt(add(lerp2(t.mid, t.tip, 0.5), mul(nn, -t.w * 0.16)))}`; }).join(''), X.cyan, 0.8, { 'stroke-opacity': 0.85, 'data-detail': tag('T', 'toe-cyan-glints') }));
    let sc = '';
    for (const t of T) {
      const segs = t.n === 'I' ? 2 : 4;
      for (let j = 1; j <= segs; j++) {
        const u = j / (segs + 1);
        const p = u < 0.5 ? lerp2(t.root, t.mid, u * 2) : lerp2(t.mid, t.tip, (u - 0.5) * 2), nn = perp(norm(sub(t.tip, t.root)));
        if (p[0] < 19) continue;
        sc += `M${pt(add(p, mul(nn, -t.w * 0.42)))}L${pt(add(p, mul(nn, t.w * 0.3)))}`;
      }
    }
    toeKids.push(line(sc, SC, 0.65, { 'stroke-opacity': 0.7, 'data-detail': tag('T', 'toe-scutes') }));
  } else {
    toeKids.push(fill([T[2], T[1], T[0]].map(toeD).join(''), XF.ink, { 'fill-opacity': 0.42 }));
  }
  const claws = T.map(t => { const u = norm(sub(t.tip, t.mid)), nn = perp(u), c = t.tip; return `M${pt(add(c, mul(nn, -t.w * 0.4)))}Q${pt(add(add(c, mul(u, 3.4)), mul(nn, -0.2)))} ${pt(add(add(c, mul(u, 3.3)), mul(nn, 2.6)))}Q${pt(add(c, mul(u, 1.4)))} ${pt(add(c, mul(nn, t.w * 0.45)))}Z`; }).join('');
  toeKids.push(fill(claws, far ? XF.ink : '#C9CEE6', { stroke: far ? 'none' : X.ink, 'stroke-width': 0.5, 'data-detail': tag('O', far ? 'far-claws' : 'chrome-claws') }));
  // the webbed foot: hallux + its web (farthest), the other two webs with pleats and veins, then the toes
  const webDark = far ? h('g', {}, fill(webs.join(''), XF.ink, { 'fill-opacity': 0.42 })) : '';
  const foot = G('totipalmate-webs', 'O', far, [
    G('hallux-web', 'O', far, [fill(webs[2], W, st), fill(toeD(T[3]), Tc, st), far ? fill(webs[2] + toeD(T[3]), XF.ink, { 'fill-opacity': 0.42 }) : '']),
    fill(webs[1], W, st), fill(webs[0], W, st), webDark,
    far ? '' : line(pleats.join(''), SC, 0.6, { 'stroke-opacity': 0.55, 'data-detail': tag('T', 'web-pleats') }),
    far ? '' : fill(webs.join(''), '#FFE2B8', { 'fill-opacity': 0.3, 'data-detail': tag('T', 'web-translucent-membrane') }),
    far ? '' : neon(webs.slice(0, 2).map((w, i) => { const A = T[i], B = T[i + 1], tA = lerp2(A.mid, A.tip, 0.92), tB = lerp2(B.mid, B.tip, 0.92), dp = add(lerp2(tA, tB, 0.5), mul(norm(sub(lerp2(A.root, B.root, 0.5), lerp2(tA, tB, 0.5))), 5.5)); return `M${pt(tA)}Q${pt(dp)} ${pt(tB)}`; }).join(''), X.mag, null, 0.7, false, { 'data-detail': tag('O', 'web-magenta-edge') }),
    G('toes', 'O', far, toeKids)]);
  // open-toe high-top sneaker wrap: heel counter, collar over the ankle, velcro strap, magenta sole stripe
  const shoe = smooth([[-10.4, -17.6], [-1, -19.2], [8.2, -17.4], [10.4, -10], [13.4, -3.6], [17.6, 1.4], [18.4, SOLE], [6, SOLE], [-8, SOLE], [-12.6, 2], [-13.4, -8]], true, 0.15);
  const sk = [fill(shoe, Z.sneaker, { stroke: Z.ink, 'stroke-width': far ? 0.9 : 1.1 })];
  if (!far) {
    sk.push(fill('M-13 -6C-13.4 -1 -12.4 3 -9 5.2L-2 5.2C-4.6 1 -5 -5 -3 -10.6Z', X.sneakerHi, { 'data-detail': tag('O', 'sneaker-heel-counter') }));
    sk.push(G('sneaker-velcro-straps', 'O', far, [fill('M-4 -12.6L9.6 -14.2L11.8 -10L-2.8 -8.2Z', X.strap, { stroke: X.ink, 'stroke-width': 0.5 }), fill('M-1.6 -5.6L11.6 -6.6L13.8 -2.8L-0.4 -1.4Z', X.strap, { stroke: X.ink, 'stroke-width': 0.5 }),
      line('M9.6 -12.8l1.2 2.2M11.8 -5.4l1.2 2.2', X.pale, 0.8)]));
    sk.push(line('M-8.6 -1.4l3.4 -2.4l3.4 2.4l3.4 -2.4l3.4 2.4', X.pale, 1, { 'data-detail': tag('O', 'sneaker-zigzag-logo') }));
    sk.push(G('sneaker-collar-leds', 'O', far, [0, 4.4, 8.8].map(x => h('circle', { cx: f(-7 + x), cy: f(-16.4 - x * 0.05), r: 1.05, fill: X.cyan }))));
    sk.push(neon('M-11 -17.2Q-13 -24 -8.4 -24.4Q-6 -24.2 -6.8 -18.2', X.mag, null, 1, false, { 'data-detail': tag('O', 'sneaker-pull-loop') }));
    // midsole: pale band with tread notches + magenta neon stripe
    sk.push(G('sneaker-glow-sole', 'O', far, [fill(`M-11.4 1.8L17.4 1.8L18.4 ${SOLE}L-8 ${SOLE}Q-11.6 ${SOLE - 0.6} -11.4 1.8Z`, X.sole),
      line(`M-6 ${SOLE - 1.2}v1.2M-1 ${SOLE - 1.2}v1.2M4 ${SOLE - 1.2}v1.2M9 ${SOLE - 1.2}v1.2M14 ${SOLE - 1.2}v1.2`, X.jacketHi, 0.8),
      neon('M-11 3.1H17.8', X.mag, X.magCore, 1.3, false)]));
    sk.push(neon('M-10 -17.2Q-1 -19 8.2 -17', X.cyan, X.cyanCore, 1, false, { 'data-detail': tag('O', 'sneaker-cyan-collar-rim') }));
  } else {
    sk.push(line('M-11 3.2H17.8', XF.mag, 1.6));
  }
  const shoeG = G('sneaker-wrap', 'O', far, sk);
  const out = [h('g', { 'data-ref': ref('toes') }, h('g', { 'data-ref': ref('webs') }, foot)), shoeG];
  return out.join('');
}

// ================================================================ build
export function build({ v }) {
  const near = { P: v('plume'), B: v('plumeShade'), N: v('flight'), S: v('flightSheen'), O: v('foot'), OW: v('web') };
  // far side: the palette's far feather inks; the far skin keeps its orange under a translucent night overlay
  const farI = { P: v('plume', { far: true }), B: v('plumeShade', { far: true }), N: v('flight', { far: true }), S: v('flightSheen', { far: true }), O: v('foot'), OW: v('web') };
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
  return {
    update(fr) {
      const pose = fr.pose; if (!pose || !pose.joints) return;
      const st = limbState(pose, fr.reduced);
      for (const side of ['Near', 'Far']) {
        const S = st[side]; if (!S) continue;
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
        for (const k of ['prims', 'alula', 'gc', 'toes', 'webs']) out.push(attr(`[data-ref="pl-${side}-${k}"]`, 'transform', S.map(s => s[side][k])));
      }
      return out;
    },
  };
}

export const detailItems = [
  ['jacket-sleeve', 'O', 'techwear bomber sleeve over the humerus; the wing feathers emerge from it'],
  ['sleeve-lit-panel', 'T', 'lit front panel of the sleeve (volume)'],
  ['sleeve-cyan-rim', 'O', 'cyan front rim light along the leading edge of the sleeve (stacked-stroke glow)'],
  ['sleeve-magenta-piping', 'O', 'magenta neon piping along the trailing seam of the sleeve'],
  ['sleeve-raglan-seam', 'O', 'raglan seam from neck to underarm with top-stitching'],
  ['sleeve-panel-seam', 'T', 'lengthwise panel seam and stitching'],
  ['sleeve-elbow-folds', 'T', 'fabric bunching folds at the inner elbow (seeded wobble)'],
  ['sleeve-zip-pocket', 'O', 'arm zip pocket with zipper teeth and an acid pull tab'],
  ['sleeve-patch-hanzi', 'O', '鹈鹕 patch with a magenta neon border (glyph paths)'],
  ['sleeve-strap-buckle', 'O', 'velcro strap with a buckle above the cuff'],
  ['sleeve-reflective-chevrons', 'O', 'reflective chevrons at the shoulder'],
  ['sleeve-status-leds', 'O', 'three status LEDs on the sleeve (acid, cyan, cyan)'],
  ['tertials', 'O', 'white tertials fanning out from under the sleeve onto the back'],
  ['tertial-shade', 'T', 'lavender shade on the rear edge of each tertial'],
  ['tertial-shafts', 'T', 'shafts on the tertials'],
  ['tertial-magenta-tips', 'O', 'magenta back-light on the tertial tips'],
  ['sleeve-rib-cuff', 'O', 'ribbed jacket cuff at the elbow: a disc about the pivot so the elbow never seams'],
  ['cuff-knit-rib', 'T', 'knit rib lines of the cuff'],
  ['cuff-magenta-hem', 'O', 'magenta neon hem where the feathers leave the cuff'],
  ['cuff-snap-tab', 'O', 'snap tab with a chrome press stud on the cuff'],
  ['covert-panel', 'O', 'propatagium / covert base of the forearm'],
  ['greater-coverts', 'O', 'ten rounded white greater coverts over the secondary bases (lift in gusts)'],
  ['greater-covert-shafts', 'T', 'shaft ticks on the greater coverts'],
  ['covert-magenta-bloom', 'O', 'magenta back-light blooming on the greater covert tips'],
  ['median-covert-row', 'T', 'median covert scallop row'],
  ['lesser-covert-rows', 'T', 'two lesser covert scallop rows, finer toward the leading edge'],
  ['marginal-coverts', 'T', 'tiny marginal coverts along the leading edge'],
  ['wing-cyan-rim', 'O', 'cyan front rim inside the leading edge'],
  ['wing-leading-edge', 'O', 'ink key line of the leading edge'],
  ['secondaries-fringe', 'O', 'ten black secondaries hanging below the arm line as a fringe'],
  ['secondary-sheen-edges', 'T', 'violet sheen edges on the secondaries'],
  ['secondary-rachis', 'T', 'shafts of the secondaries'],
  ['secondary-neon-tips', 'O', 'magenta neon rim on the trailing tips of the secondaries'],
  ['primaries-trailing', 'O', 'five black primaries sweeping back and down from the wrist, shafts, emarginations and cyan leading-edge glints (fan open in sequence in the wave)'],
  ['primary-fingers', 'O', 'five outer primaries wrapping the grip, peeling off into five separate curled tips'],
  ['finger-rachis', 'T', 'shafts of the finger primaries'],
  ['finger-neon-tips', 'O', 'magenta neon edge on each curled primary tip'],
  ['primary-coverts', 'O', 'short black primary coverts on the back of the hand'],
  ['carpal-bend', 'O', 'white bend of the wing folding over the wrist, with a cyan rim'],
  ['carpal-covert-scallops', 'T', 'small covert scallops on the carpal bend'],
  ['wrist-data-band', 'O', 'smart wrist band with a cyan micro-display and an acid LED'],
  ['alula', 'O', 'three-feather alula (bastard wing) that flicks the bell'],
  ['thigh-trousers', 'O', 'feathered white thigh merging into the belly, tapering to the knee'],
  ['trouser-volume-shade', 'T', 'lavender volume shade under the trousers'],
  ['thigh-cyan-rim', 'O', 'cyan front rim on the thigh'],
  ['thigh-magenta-rim', 'O', 'magenta rim under the thigh'],
  ['trouser-feather-scallops', 'T', 'contour-feather scallops flowing down the leg'],
  ['trouser-rear-hatching', 'T', 'fine hatching on the rear of the trousers'],
  ['flank-plume-curls', 'O', 'plume curls where the thigh leaves the belly'],
  ['knee-feather-fringe', 'O', 'white feather tips peeking out below the knee wrap'],
  ['fringe-feather-shafts', 'T', 'shaft ticks in the fringe feathers'],
  ['techwear-knee-wrap', 'O', 'techwear knee wrap: a disc about the knee pivot so the knee never shows'],
  ['knee-wrap-straps', 'O', 'two crossing wrap straps with stitching'],
  ['knee-cap-pad', 'O', 'padded strap round the knee cap'],
  ['knee-velcro-tag', 'O', 'reflective velcro tag printed NP-07 (glyph paths)'],
  ['knee-hex-led', 'O', 'hex LED stud with a cyan glow'],
  ['knee-wrap-piping', 'O', 'magenta neon piping round the wrap'],
  ['knee-wrap-stitching', 'T', 'stitched upper hem of the wrap'],
  ['tarsus', 'O', 'orange tarsus 13.6→10 u wide'],
  ['tarsus-shade-band', 'T', 'shade band on the rear of the tarsus'],
  ['intertarsal-heel-pad', 'O', 'heel pad of the intertarsal joint just below the wrap'],
  ['intertarsal-knuckle', 'O', 'knuckle and crease rings of the intertarsal joint'],
  ['tarsus-scutes', 'T', 'transverse scutes (scale rings) down the front of the tarsus'],
  ['scute-highlights', 'T', 'pale highlight above each scute'],
  ['tarsus-reticulate-scales', 'T', 'small reticulate scales on the rear of the tarsus'],
  ['tarsus-cyan-rim', 'O', 'cyan rim down the front of the shin'],
  ['tarsus-magenta-rim', 'O', 'magenta rim down the back of the shin'],
  ['sneaker-wrap', 'O', 'open-toe high-top sneaker wrap over heel and ankle, webs left free'],
  ['sneaker-heel-counter', 'O', 'lighter heel counter panel'],
  ['sneaker-velcro-straps', 'O', 'two velcro straps with pale tab edges'],
  ['sneaker-zigzag-logo', 'O', 'pale zigzag logo on the side'],
  ['sneaker-collar-leds', 'O', 'three cyan LEDs on the collar'],
  ['sneaker-pull-loop', 'O', 'magenta neon heel pull loop'],
  ['sneaker-glow-sole', 'O', 'pale midsole with tread notches and a magenta neon stripe'],
  ['sneaker-cyan-collar-rim', 'O', 'cyan rim on the collar'],
  ['hallux-web', 'O', 'hallux (toe I, turned forward) and the web joining it to toe II: what makes the foot totipalmate'],
  ['totipalmate-webs', 'O', 'webs IV–III and III–II'],
  ['web-pleats', 'T', 'pleats / veins in the webs'],
  ['web-translucent-membrane', 'T', 'pale translucent membrane tint that separates the webs from the toes'],
  ['web-magenta-edge', 'O', 'magenta back-light along the free edges of the webs'],
  ['toes', 'O', 'toes II–IV, outer toe longest, draping over the pedal edge'],
  ['toe-scutes', 'T', 'transverse scutes on each toe'],
  ['toe-cyan-glints', 'T', 'cyan glints along the near toes'],
  ['toe-pads', 'O', 'digital pads under the drooping toe tips'],
  ['chrome-claws', 'O', 'short hooked chrome-tipped claws'],
  ['far-*', 'O', 'far wing and leg: the same anatomy darker and less lit (tagged far-…; counted only where visible)'],
].map(([name, kind, what]) => ({ id: tag(kind, name), layer: 'pelican', kind, what }));
