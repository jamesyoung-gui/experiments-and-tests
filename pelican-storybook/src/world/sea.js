// OWNER: sea. Layers L-hills-far (0.05), L-lighthouse (0.07), L-sea (0.10), L-boats (0.12).
// Style B (docs/STYLE-B.md): a warm storybook gouache coast. Soft mauve ranges with warm rim light and brush dabs;
// the lighthouse headland with its keeper, cottage, sheep and washing line; a layered painted sea (a soft wash from
// the lavender horizon to the deep bay, painted streaks, two-tone wave strokes with light crests and dark troughs,
// slow little curls, foam dabs) and a sun / moon glitter path of lens-shaped dabs over a soft sheen; a pastel
// harbour town with terracotta roofs, a windmill, church, fish market, pier and anglers; rocks with seaweed,
// a seal and cormorants; boats with rigging, a steamer, buoys, a rowing boat with a child and a cat, a dolphin,
// jumping fish, a message in a bottle, and a whale (journey egg).
// PERFORMANCE (STYLE-B §2): no filters. The hand-made look is baked into geometry at build time: seeded wobble of
// every outline (resampled + jittered + Catmull-Rom), double "pencil" ink lines, tapered brush dabs and dry-brush
// flecks, static <pattern> textures in local coordinates on the strips that only translate; glows are gradients.
// CALM (STYLE-B §6): the sea rolls slowly, curls are few and slow.
// Design coordinates = the hero frame (t = 3.2 s at 60 rpm): every object is drawn where it sits in that frame and is
// scrolled by (distance − D0)·depth, wrapped over its own span. Everything is static markup built once; per frame we
// only write transforms (and a few visibility flags).
import { fmt1, fmt2 } from '../core/math.js';
import { h, refs } from '../core/svg.js';
import { HORIZON_Y, DIST_PER_REV } from '../contract.js';
import { LAP, KM, stretchAt, relTo, hash } from './route.js';
import { gwFilters } from '../art/gouache.js';

export const id = 'sea';
// gouache paints of the coast (graded by the hour like the core materials; namespaced sea*)
export const materials = {
  seaWhite: '#FFF6EC', seaCream: '#F6EAD0', seaCreamLo: '#D8C3A0',
  seaRed: '#D8443A', seaRedLo: '#A82E2E', seaRose: '#F4B48E',
  seaWood: '#C89B5E', seaWoodLo: '#9A6E3C', seaWoodDk: '#6B4632',
  seaRoof: '#C8664A', seaRoofB: '#DE8A5C', seaRoofLo: '#98483A',
  seaWallA: '#F8D8B2', seaWallB: '#F2B8A2', seaWallC: '#D2E0BE', seaWallD: '#F7E2A4', seaWallE: '#C6D4EA', seaWallShade: '#B98E98',
  seaWin: '#4E3A4E', seaStone: '#DCC3A4', seaStoneLo: '#A88E82',
  seaCliff: '#E2AC7E', seaCliffLo: '#B67C6A', seaCliffDk: '#7E5A62',
  seaGrass: '#8DB06A', seaGrassLo: '#5E8A4E', seaGrassHi: '#C4D68C', seaCypress: '#4A6E4C',
  seaRock: '#9C8696', seaRockLo: '#68566E', seaRockHi: '#D8BAB0', seaWeed: '#5E7A44',
  seaTeal: '#1F8A8A', seaTealLo: '#146466', seaNavy: '#34466E', seaHull: '#8A4A3E', seaYellow: '#FAC957', seaOrange: '#F08A3C',
  seaSail: '#FFEBD0', seaSailShade: '#E6CDB4',
  seaDolphin: '#A4AED0', seaDolphinLo: '#5C6698', seaBelly: '#F0DEDA', seaSkin: '#F7BBAA', seaDark: '#3B2C34',
  seaSeal: '#8E7A84', seaSealLo: '#5E4C5C', seaGlass: '#7CC0A8',
};

// ---------------------------------------------------------------------------------------------- helpers
const f = fmt2;   // = String(Math.round(x * 100) / 100), fast (core/math.js)
const f1 = fmt1;   // = String(Math.round(x * 10) / 10), fast (core/math.js)
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const wrap = (x, m) => ((x % m) + m) % m;
const D2R = Math.PI / 180;
const circ = (x, y, r) => `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
const ell = (x, y, rx, ry) => `M${f(x - rx)} ${f(y)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0Z`;
const rect = (x, y, w, hh) => `M${f(x)} ${f(y)}h${f(w)}v${f(hh)}h${f(-w)}Z`;
const poly = pts => 'M' + pts.map(p => f(p[0]) + ' ' + f(p[1])).join('L') + 'Z';
const line = pts => 'M' + pts.map(p => f(p[0]) + ' ' + f(p[1])).join('L');
// Catmull-Rom smoothing (the draft's cr())
function smooth(pts, closed = true, k = 1 / 6) {
  const n = pts.length, g = i => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
    d += `C${f(p1[0] + (p2[0] - p0[0]) * k)} ${f(p1[1] + (p2[1] - p0[1]) * k)} ${f(p2[0] - (p3[0] - p1[0]) * k)} ${f(p2[1] - (p3[1] - p1[1]) * k)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + (closed ? 'Z' : '');
}
// piecewise-linear height of a polyline at x
const heightAt = (pts, x) => {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const [a, b] = [pts[i - 1], pts[i]]; return lerp(a[1], b[1], (x - a[0]) / (b[0] - a[0] || 1)); }
  return pts[pts.length - 1][1];
};
// ---- gouache toolkit: the hand-made look, baked (seeded, identical every frame) ----
// resample a polyline / polygon every ~seg units, jitter every inner point by ±amp, smooth -> wobbly painted edge
function wobPts(pts, R, amp = 0.6, seg = 6, closed = true) {
  const out = [], n = pts.length, m = closed ? n : n - 1;
  for (let i = 0; i < m; i++) {
    const a = pts[i], b = pts[(i + 1) % n], k = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / seg));
    for (let j = 0; j < k; j++) { const u = j / k, p = [lerp(a[0], b[0], u), lerp(a[1], b[1], u)]; if (j || closed || i) { p[0] += (R() - 0.5) * 2 * amp; p[1] += (R() - 0.5) * 2 * amp; } out.push(p); }
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
}
const wob = (pts, R, amp = 0.6, seg = 6, closed = true) => smooth(wobPts(pts, R, amp, seg, closed), closed);
const wrect = (R, x, y, w, hh, amp = 0.28) => wob([[x, y], [x + w, y], [x + w, y + hh], [x, y + hh]], R, amp, Math.max(1.6, Math.min(w, hh) / 1.6));
const wcirc = (R, x, y, r, amp = 0.12) => { const n = Math.max(7, Math.round(r * 1.4 + 5)), pts = []; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, k = 1 + (R() - 0.5) * 2 * amp; pts.push([x + Math.cos(a) * r * k, y + Math.sin(a) * r * k]); } return smooth(pts); };
// tapered brush dab (a gouache stroke): from (x,y), length len, belly half-width w, angle a (deg)
const dab = (x, y, len, w, a = 0) => {
  const c = Math.cos(a * D2R), s = Math.sin(a * D2R), bx = x + len * c, by = y + len * s, mx = (x + bx) / 2, my = (y + by) / 2, nx = -s * w, ny = c * w;
  return `M${f(x)} ${f(y)}Q${f(mx + nx)} ${f(my + ny)} ${f(bx)} ${f(by)}Q${f(mx - nx * 0.6)} ${f(my - ny * 0.6)} ${f(x)} ${f(y)}Z`;
};
// lens-shaped light dab (glitter, crests)
const lens = (x, y, len, th) => `M${f(x)} ${f(y)}q${f(len / 2)} ${f(-th)} ${f(len)} 0q${f(-len / 2)} ${f(th * 0.55)} ${f(-len)} 0Z`;
const DD = key => ({ 'data-detail': key });
// split a multi-subpath d into x-buckets (so the renderer can cull off-screen pieces of long scrolling tiles)
const chunks = (d, size = 520) => {
  const out = new Map();
  for (const sp of d.split(/(?=M)/)) { if (!sp) continue; const x = parseFloat(sp.slice(1)); const k = Math.floor(x / size); out.set(k, (out.get(k) || '') + sp); }
  return [...out.values()];
};
// the same texture split into per-chunk groups (one data-detail each) so a long tile is inventoried where it is visible
const chunkMap = (d, size = 1100) => { const out = new Map(); for (const sp of d.split(/(?=M)/)) { if (!sp) continue; const k = Math.floor(parseFloat(sp.slice(1)) / size); out.set(k, (out.get(k) || '') + sp); } return out; };
const CG = (key, parts) => {
  const maps = parts.map(([d, fn]) => [chunkMap(d), fn]), ks = new Set();
  for (const [mm] of maps) for (const k of mm.keys()) ks.add(k);
  return [...ks].sort((a, b) => a - b).map(k => h('g', DD(key), maps.map(([mm, fn]) => mm.has(k) ? fn(mm.get(k)) : '').join(''))).join('');
};
const S = (d, stroke, w, extra = {}) => h('path', { d, fill: 'none', stroke, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...extra });
const F = (d, fill, extra = {}) => h('path', { d, fill, ...extra });
const Fo = (d, fill, op) => (d ? F(d, fill, op === 1 ? {} : { opacity: op }) : '');
// paint buckets: many little shapes of one paint (and opacity) -> one <path>; emitted in insertion order
function paint() {
  const m = new Map();
  return {
    add(fill, d, op = 1) { if (d) { const k = fill + '|' + op; m.set(k, (m.get(k) || '') + d); } return this; },
    out() { return [...m].map(([k, d]) => { const i = k.lastIndexOf('|'); return Fo(d, k.slice(0, i), +k.slice(i + 1)); }).join(''); },
  };
}
// module-level paint references (set in build)
let v = t => `var(--pb-${t})`;
// warm-brown ink outline with a second, offset, thinner "pencil" pass (STYLE-B §2: double-stroke lines)
const pencil = (d, w, soft = false, off = 0.5) => d ? S(d, v(soft ? 'lineSoft' : 'line'), f(w)) + S(d, v(soft ? 'lineSoft' : 'line'), f(w * 0.42), { opacity: 0.38, transform: `translate(${f(off * 1.1)} ${f(off * 0.8)})` }) : '';
const ink = (d, w, soft = false, extra = {}) => d ? S(d, v(soft ? 'lineSoft' : 'line'), f(w), extra) : '';
// tiny stroke glyphs (box 6×10) for hull numbers / buoy numbers
const GLYPH = {
  3: 'M0 0H6L2.6 4Q6 4 6 7Q6 10 3 10Q0.6 10 0 8.4',
  7: 'M0 0H6L2 10',
  P: 'M0 10V0H3.4Q6 0 6 2.7Q6 5.4 3.4 5.4H0',
  B: 'M0 0V10H3.8Q6 10 6 7.6Q6 5.2 3.6 5.2H0M0 0H3.3Q5.6 0 5.6 2.6Q5.6 5.2 3.3 5.2',
};
const glyphs = (str, x, y, sc = 1, gap = 8.5) => [...str].map((c, i) => GLYPH[c] ? `<path transform="translate(${f(x + i * gap * sc)} ${f(y)}) scale(${sc})" d="${GLYPH[c]}"/>` : '').join('');
const nightVeil = (ref, d, k) => F(d, v('skyTop'), { 'data-ref': ref, visibility: 'hidden', style: `opacity:calc(var(--pb-n-night) * ${k})` });

// ---------------------------------------------------------------------------------------------- geometry
const HZ = HORIZON_Y;
const T0 = 3.2, D0 = T0 * DIST_PER_REV;      // hero frame = design coordinates
const X0 = -420, X1 = 2020;
const W_H = LAP * 0.05;                       // hills: ONE panorama per lap of the route (23 562 u, 250 crank turns)
// Far landmarks follow the route (route.js): each is at its hero position when the rider is at one of its anchors
// (road distance within the lap) and slides by depth from there; the nearest anchor wins.
const ANCH = { cape: [D0, 10.4 * KM], harbour: [D0, 4.35 * KM], rocks: [D0, 14.3 * KM, 17.1 * KM, 20.1 * KM] };
const routeX = (D, list, d) => { let best = Infinity; for (const A of list) { const x = -relTo(D, A) * d; if (Math.abs(x) < Math.abs(best)) best = x; } return best; };
// procedural ranges for the rest of the panorama, shaped by the stretch of coast they rise behind
function routeRanges(R) {
  const out = [], x1 = W_H - 1300;
  let x = 4550;
  while (x < x1) {
    const Dc = 3.2 * DIST_PER_REV + (x + 600 - 800) / 0.05, key = stretchAt(Dc).key;
    const tall = { lighthouse: 1, cliffs: 1.25, fort: 0.8, pines: 0.9, railway: 0.75, harbour: 0.7, funfair: 0.5, pier: 0.6, village: 0.8, return: 0.8, dunes: 0.25, bridge: 0.55 }[key] ?? 0.7;
    const w = Math.min(900 + R() * 900 * (key === 'dunes' ? 1.4 : 1), W_H - 520 - x), n = Math.max(6, Math.round(w / 95));
    if (w < 420) break;
    const far = [[x, 472]], foot = [[x + 40, 472]];
    for (let i = 1; i < n; i++) {
      const u = i / n, env = Math.sin(Math.PI * u) ** (key === 'cliffs' ? 0.5 : 0.8);
      const jag = key === 'cliffs' || key === 'lighthouse' ? (i % 2 ? -14 : 8) * R() : (R() - 0.5) * 14;
      far.push([x + u * w, 472 - env * (40 + 70 * tall) + jag - (key === 'bridge' && Math.abs(u - 0.5) < 0.12 ? -30 : 0)]);
    }
    far.push([x + w, 472]);
    const fn = Math.max(5, Math.round(w / 140));
    for (let i = 1; i < fn; i++) { const u = i / fn; foot.push([x + 40 + u * (w - 80), 472 - Math.sin(Math.PI * u) * (14 + 12 * tall) + (R() - 0.5) * 6]); }
    foot.push([x + w - 40, 472]);
    const g = { far, foot, cyp: [x + w * 0.2, x + w * (key === 'pines' || key === 'railway' ? 0.8 : 0.38)], vil: [x + w * (0.45 + R() * 0.2), key === 'dunes' ? 0 : key === 'harbour' || key === 'village' || key === 'return' ? 12 : 5] };
    if (key === 'fort' || key === 'cliffs') g.castle = x + w * 0.62; else if (R() < 0.45 && key !== 'dunes') g.chapel = x + w * 0.3;
    out.push(g);
    x += w + 60 + R() * 380;
  }
  return out;
}
// wave bands: [depth, tile width (= depth·DIST_PER_REV·k, seamless in whole crank turns)]
const BANDS = [[0.10, DIST_PER_REV * 0.10 * 13], [0.12, DIST_PER_REV * 0.12 * 11], [0.14, DIST_PER_REV * 0.14 * 10], [0.17, DIST_PER_REV * 0.17 * 8]];
// single objects: depth, span (wrap), margin
const LH = { d: 0.07, S: DIST_PER_REV * 0.07 * 34, M: 2550 };     // lighthouse cape (beam reaches ±1000)
const HB = { d: 0.12, S: DIST_PER_REV * 0.12 * 24, M: 880 };      // harbour town
const RK = { d: 0.17, S: DIST_PER_REV * 0.17 * 14, M: 760 };      // rocks, seal and cormorants
const depthAt = y => 0.1 + (y - HZ) * 0.00045;                     // boats: nearer = faster
const LAMP = { x: 1150, y: 269 };                                  // lighthouse lantern (hero coords)
// on-the-water objects: hero x, waterline y, scale, own speed (+x = sailing with the rider), span
const BOATS = {
  steamer: { x: 1030, y: 486, s: 1, vx: -9, S: 4300, e: 70 },
  sloop: { x: 1405, y: 491, s: 0.3, vx: 14, S: 3600, e: 30 },
  yawl: { x: 1565, y: 496, s: 0.32, vx: 10, S: 4100, e: 30 },
  trawler: { x: 1262, y: 523, s: 0.45, vx: 5, S: 3900, e: 50 },
  row: { x: 1420, y: 556, s: 0.85, vx: 2, S: 4500, e: 50 },
  near: { x: 1150, y: 580, s: 0.95, vx: 45, S: 3700, e: 110 },
  can: { x: 1352, y: 568, s: 0.75, vx: 0, S: 3300, e: 20 },
  bell: { x: 1036, y: 596, s: 0.8, vx: 0, S: 3500, e: 30 },
  pots: { x: 1512, y: 592, s: 1, vx: 0, S: 3100, e: 30 },
  bottle: { x: 1236, y: 606, s: 1, vx: 3, S: 5200, e: 20 },
  dolphin: { x: 1335, y: 562, s: 1, vx: 0, S: 3400, e: 90 },
  fish: { x: 1455, y: 596, s: 1, vx: 0, S: 3000, e: 40 },
  sealhead: { x: 380, y: 592, s: 1, vx: 0, S: 3200, e: 30 },
};
const place = (t, D, x0, d, vx, M, Sp) => wrap(x0 + vx * (t - T0) - (D - D0) * d + M, Sp) - M;

// ---------------------------------------------------------------------------------------------- build
export function build(ctx) {
  const { rng } = ctx;
  v = ctx.v;
  let defs = '';
  // soft painted glows (gradients; no filters on anything)
  const stops = (c, list) => list.map(([o, a]) => h('stop', { offset: o, 'stop-color': v(c), 'stop-opacity': a })).join('');
  defs += h('radialGradient', { id: 'sea-glowG' }, stops('lampGlow', [[0, 0.75], [0.25, 0.45], [0.6, 0.16], [1, 0]]));
  defs += h('radialGradient', { id: 'sea-glowSoft' }, stops('lamp', [[0, 0.7], [0.35, 0.3], [1, 0]]));
  defs += h('linearGradient', { id: 'sea-gBeam', x1: 0, y1: 0, x2: 1, y2: 0 }, stops('beacon', [[0, 0.5], [0.5, 0.18], [1, 0]]));
  const lampOn = { style: 'opacity:var(--pb-n-lampOn)' };

  const hills = buildHills(rng);
  const lh = buildLighthouse(rng, lampOn);
  const seaL = buildSea(rng, lampOn);
  const boats = buildBoats(rng, lampOn);
  defs += hills.defs + lh.defs + seaL.defs + boats.defs;
  // painterly filters (STYLE-B §2) for the far, translate-only sheets (hills panorama, the static sea wash)
  defs += gwFilters('sea', { seed: 31, wob: 3, soft: 7, blur: 0.9, brushFreq: '0.003 0.12', brushK: 3.4 });
  // aerial perspective: a warm haze glazed over everything far (sky, hills, cape, sea, boats), strongest at the
  // horizon; the shore, road and rider are in front of it, so the page recedes and the rider stays the focus
  defs += h('linearGradient', { id: 'sea-aerialG', x1: 0, y1: -420, x2: 0, y2: 660, gradientUnits: 'userSpaceOnUse' },
    h('stop', { offset: 0, 'stop-color': v('skyHaze'), 'stop-opacity': 0 }), h('stop', { offset: 0.5, 'stop-color': v('skyHaze'), 'stop-opacity': 0.06 }),
    h('stop', { offset: 0.8, 'stop-color': v('skyHaze'), 'stop-opacity': 0.2 }), h('stop', { offset: 0.87, 'stop-color': v('skyHaze'), 'stop-opacity': 0.24 }),
    h('stop', { offset: 1, 'stop-color': v('skyHaze'), 'stop-opacity': 0.1 }));
  boats.markup += h('g', { 'data-ref': 'sea-aerial', ...DD('sea:T:aerial-haze'), class: 'gw-tex', 'pointer-events': 'none' }, F(rect(X0, -420, X1 - X0, 1080), 'url(#sea-aerialG)'));
  return {
    defs,
    layers: { 'L-hills-far': hills.markup, 'L-lighthouse': lh.markup, 'L-sea': seaL.markup, 'L-boats': boats.markup },
  };
}

// ============================================================================ L-hills-far: ranges, villages, island
// Far = soft: no ink outlines, a thin warm rim of light along the ridges, gouache dabs, colours glazed with haze.
function buildHills(rng) {
  const R = rng('sea-hills');
  // ranges in hero coords; each starts and ends on the horizon so the tile seam is open sea
  const ranges = [
    { far: [[-420, 472], [-380, 432], [-300, 386], [-220, 372], [-120, 390], [-30, 358], [70, 368], [150, 388], [230, 398], [320, 414], [410, 436], [520, 456], [630, 466], [720, 472]],
      foot: [[-420, 472], [-330, 446], [-200, 452], [-60, 440], [80, 444], [200, 452], [330, 460], [440, 467], [520, 472]], cyp: [150, 300], vil: [300, 9], chapel: 206 },
    { far: [[1730, 472], [1820, 446], [1930, 404], [2040, 356], [2120, 344], [2200, 360], [2310, 394], [2420, 382], [2530, 412], [2660, 442], [2790, 462], [2900, 472]],
      foot: [[1760, 472], [1880, 452], [2000, 442], [2140, 450], [2300, 440], [2450, 452], [2600, 462], [2720, 472]], cyp: [2280, 2420], vil: [2480, 8], chapel: 2120 },
    { far: [[3300, 472], [3380, 450], [3480, 428], [3600, 420], [3700, 404], [3790, 418], [3900, 432], [4010, 426], [4120, 448], [4250, 472]],
      foot: [[3320, 472], [3440, 458], [3560, 452], [3700, 440], [3840, 452], [3980, 458], [4100, 466], [4200, 472]], cyp: [3620, 3760], vil: [3930, 7], castle: 3700 },
  ];
  ranges.push(...routeRanges(rng('sea-hills-route')));
  const WALLS = ['seaWhite', 'seaWallA', 'seaWallB', 'seaWallD', 'seaWallE', 'seaCream'];
  const heroN = 3, acc = new Map();
  const newAcc = () => ({ far: '', lit: '', shd: '', rim: '', haze: '', foot: '', fhaze: '', terr: '', olive: '', cyp: '', cypL: '', vil: paint(), chap: '' });
  let tile = '';
  for (const [gi, g] of ranges.entries()) {
    const farW = wobPts(g.far, R, 1.5, 18, false), footW = wobPts(g.foot, R, 1.1, 16, false);
    const far = smooth(farW, false) + `L${f(g.far[g.far.length - 1][0])} 480L${f(g.far[0][0])} 480Z`;
    const foot = smooth(footW, false) + `L${f(g.foot[g.foot.length - 1][0])} 480L${f(g.foot[0][0])} 480Z`;
    const A = gi < heroN ? newAcc() : (() => { const k = Math.floor(g.far[0][0] / 8000); if (!acc.has(k)) acc.set(k, newAcc()); return acc.get(k); })();
    A.far += far; A.foot += foot;
    A.haze += far; A.fhaze += foot;
    // warm rim light along the upper ridge (the sun side of every crest)
    const top = farW.filter((p, i) => i > 0 && i < farW.length - 1 && p[1] < 466);
    if (top.length > 2) A.rim += smooth(top.map(([x, y]) => [x + 1.2, y + 1.8]), false);
    // gouache: warm light dabs on the upper slopes, cool mauve glazes pooling at the foot
    const x0 = g.far[0][0], x1 = g.far[g.far.length - 1][0];
    for (let x = x0 + 12; x < x1 - 30; x += 8 + R() * 11) {
      const len = 9 + R() * 17, tp = Math.max(heightAt(farW, x), heightAt(farW, x + len)), bot = Math.min(heightAt(footW, x), heightAt(footW, x + len), 471);
      if (bot - tp < 9) continue;
      A.lit += dab(x, tp + 3 + R() * Math.min(16, (bot - tp) * 0.45), len, 1.3 + R() * 1.5, (R() - 0.5) * 12);
      const y2 = bot - 2.5 - R() * 7; if (y2 > tp + 7) A.shd += dab(x, y2, len * 1.2, 1.8 + R() * 2, (R() - 0.5) * 6);
    }
    // olive groves: rows of little round trees following the foothill contour, + faint terrace lines
    const [xa, xb] = [g.foot[1][0], g.foot[g.foot.length - 2][0]];
    for (let k = 1; k <= 3; k++) {
      for (let x = xa; x < xb; x += 5.5 + R() * 5) {
        const y = heightAt(footW, x) + 2.6 + k * 4.4; if (y > 469.5) continue;
        if (R() < 0.8) A.olive += circ(x, y, 1.1 + R() * 0.8);
      }
      for (let x = xa; x < xb; x += 40 + R() * 26) { const len = 16 + R() * 20, y0 = heightAt(footW, x) + 4.8 + k * 4.4, y1 = heightAt(footW, x + len) + 4.8 + k * 4.4; if (y0 < 470 && y1 < 470) A.terr += `M${f(x)} ${f(y0)}L${f(x + len)} ${f(y1)}`; }
    }
    for (let x = g.cyp[0]; x < g.cyp[1]; x += 11 + R() * 16) {
      const yb = heightAt(footW, x) + 2, hh = 11 + R() * 9, w = 2.4 + R() * 1.2;
      A.cyp += `M${f(x)} ${f(yb)}C${f(x - w)} ${f(yb - hh * 0.3)} ${f(x - w * 0.8)} ${f(yb - hh * 0.8)} ${f(x)} ${f(yb - hh)}C${f(x + w * 0.8)} ${f(yb - hh * 0.8)} ${f(x + w)} ${f(yb - hh * 0.3)} ${f(x)} ${f(yb)}Z`;
      A.cypL += dab(x + 0.4, yb - hh * 0.85, hh * 0.7, 0.9, 88);
    }
    // hill village: pastel cubes, terracotta roofs, a shade side, little dark windows
    for (let i = 0; i < g.vil[1]; i++) {
      const x = g.vil[0] + i * 7.5 + R() * 3, yb = heightAt(farW, x) + 7 + R() * 6, w = 5 + R() * 3, hh = 4 + R() * 3;
      A.vil.add(v(WALLS[Math.floor(R() * WALLS.length)]), rect(x, yb - hh, w, hh)).add(v('seaWallShade'), rect(x, yb - hh, w * 0.3, hh), 0.55);
      if (R() < 0.6) A.vil.add(v('seaRoof'), poly([[x - 0.6, yb - hh], [x + w / 2, yb - hh - 2.6], [x + w + 0.6, yb - hh]]));
      A.vil.add(v('seaWin'), rect(x + w * 0.55, yb - hh * 0.6, 1, 1.3), 0.7);
    }
    let chap = '';
    if (g.chapel) {
      const x = g.chapel, yb = heightAt(farW, x) + 3;
      chap = h('g', DD('sea:O:hill-chapel'), F(rect(x - 5, yb - 8, 10, 8) + rect(x + 5, yb - 14, 3.2, 14), v('seaWhite')),
        F(`M${f(x - 4)} ${f(yb - 8)}A4 4 0 0 1 ${f(x + 4)} ${f(yb - 8)}Z`, v('seaWallE')), F(rect(x - 5, yb - 8, 2.6, 8), v('seaWallShade'), { opacity: 0.5 }),
        F(rect(x - 1, yb - 5, 2, 5) + rect(x + 5.8, yb - 12, 1.6, 2.4) + rect(x - 0.35, yb - 15.5, 0.7, 4) + rect(x - 1.6, yb - 14.5, 3.2, 0.7), v('seaWin')));
    }
    if (g.castle) {
      const cx = g.castle, cy = heightAt(farW, cx) + 2;
      chap = h('g', DD('sea:O:castle-ruin'), F(rect(cx - 16, cy - 10, 32, 10) + rect(cx - 16, cy - 20, 8, 10) + rect(cx + 6, cy - 16, 8, 6) + rect(cx - 16, cy - 23, 2.5, 3) + rect(cx - 11, cy - 23, 2.5, 3) + rect(cx + 6, cy - 19, 2.5, 3) + rect(cx + 11.5, cy - 19, 2.5, 3), v('seaStone')),
        F(rect(cx - 16, cy - 20, 3, 20) + rect(cx + 6, cy - 16, 2.4, 6), v('seaStoneLo'), { opacity: 0.7 }), F(rect(cx - 13, cy - 17, 2, 3) + rect(cx - 3, cy - 7, 4, 7), v('seaWin')));
    }
    A.chap += chap;
    if (gi < heroN) tile += rangeMarkup(A, true);
  }
  for (const A of acc.values()) tile += rangeMarkup(A, false);
  // far islands (one sits in front of the golden-hour sun)
  const island = (x, w, hh) => smooth([[x, 472], [x + w * 0.12, 466 - hh * 0.4], [x + w * 0.35, 470 - hh], [x + w * 0.6, 468 - hh * 0.8], [x + w * 0.85, 468 - hh * 0.3], [x + w, 472]], false) + 'Z';
  for (const [x, w, hh, tx] of [[1372, 96, 12, 1398], [3010, 150, 14, 3080]])
    tile += h('g', DD('sea:O:far-island'), F(island(x, w, hh) + `M${tx - 1} 452L${tx + 1.8} 447L${tx + 4.6} 452Z`, v('hillFar')), F(rect(tx, 452, 3.6, 8), v('seaWhite'), { opacity: 0.8 }),
      F(rect(tx, 455, 3.6, 1.4), v('seaRed'), { opacity: 0.8 }), S(`M${x + 20} 466.5q${f(w * 0.12)} -2 ${f(w * 0.3)} -0.5`, v('rim'), 1.2, { opacity: 0.7 }), F(island(x, w, hh), v('skyHaze'), { opacity: 0.25 }));
  // two real copies (not <use>) so each copy is its own hit-testable geometry
  const markup = h('g', { 'data-ref': 'sea-hills' }, h('g', { id: 'sea-pano' }, tile), h('use', { href: '#sea-pano', x: f(-W_H) }));
  return { markup, defs: '' };
}
function rangeMarkup(A, tag) {
  const G = (key, ...kids) => tag ? h('g', DD(key), ...kids) : kids.join('');
  return G('sea:O:far-ridge', F(A.far, v('hillFar')), Fo(A.lit, v('skyLow'), 0.32), Fo(A.shd, v('cloudShade'), 0.4), F(A.haze, v('skyHaze'), { opacity: 0.14 })) +
    G('sea:O:ridge-rim', S(A.rim, v('rim'), 2.2, { opacity: 0.55 })) +
    G('sea:O:foothills', F(A.foot, v('hillNear')), F(A.fhaze, v('skyHaze'), { opacity: 0.42 })) +
    G('sea:T:olive-groves', Fo(A.olive, v('foliage'), 0.42), A.terr ? S(A.terr, v('cloudLit'), 0.8, { opacity: 0.5 }) : '') +
    G('sea:O:cypresses', Fo(A.cyp, v('seaCypress'), 0.8), Fo(A.cypL, v('grassFar'), 0.45)) +
    G('sea:O:far-village', h('g', { opacity: 0.82 }, A.vil.out())) + (tag ? A.chap : A.chap.replace(/ data-detail="[^"]*"/g, ''));
}

// ============================================================================ L-lighthouse: the cape + lighthouse
function buildLighthouse(rng, lampOn) {
  const R = rng('sea-cape');
  const X = LAMP.x;       // tower axis
  const top = [[925, 472], [962, 460], [1000, 443], [1040, 423], [1072, 409], [1105, 403], [1160, 401], [1238, 402]];
  const cliff = [[1238, 402], [1246, 411], [1250, 428], [1258, 444], [1268, 458], [1282, 466], [1298, 472]];
  const topW = wobPts(top, R, 0.9, 10, false), cliffW = wobPts(cliff, R, 1, 6, false);
  const outline = smooth(topW, false) + cliffW.slice(1).map(p => `L${f(p[0])} ${f(p[1])}`).join('') + 'L925 480Z';
  const edge = smooth(topW, false) + cliffW.slice(1).map(p => `L${f(p[0])} ${f(p[1])}`).join('');
  const grassBot = [[1042, 480], [1052, 460], [1062, 452], [1100, 424], [1130, 419], [1170, 414], [1210, 416], [1236, 414]];
  let defs = '';
  // static gouache textures (local coordinates of the cape strip; rasterised once, then only composited)
  {
    const Q = rng('sea-cape-pat'); let lo = '', hi = '';
    for (let i = 0; i < 26; i++) { const x = Q() * 60, y = Q() * 40; if (i % 2) lo += dab(x, y, 3 + Q() * 3, 0.7, -80 - Q() * 20); else hi += dab(x, y, 3 + Q() * 3, 0.6, -75 - Q() * 30); }
    defs += h('pattern', { id: 'sea-pGrass', x: 0, y: 0, width: 60, height: 40, patternUnits: 'userSpaceOnUse' }, F(lo, v('seaGrassLo'), { opacity: 0.45 }), F(hi, v('seaGrassHi'), { opacity: 0.55 }));
    let st = '';
    for (let i = 0; i < 14; i++) { const x = Q() * 50, y = Q() * 36; st += dab(x, y, 5 + Q() * 9, 0.8 + Q() * 0.6, (Q() - 0.5) * 10); }
    defs += h('pattern', { id: 'sea-pRock', x: 0, y: 0, width: 50, height: 36, patternUnits: 'userSpaceOnUse' }, F(st, v('seaCliffLo'), { opacity: 0.35 }));
  }
  let g = '';
  // cliff body (warm sandstone), sunlit faces, grass mantle with tufts, ink outline
  const grass = smooth(topW, false) + `L1240 409L1236 414C1210 416 1170 414 1130 419C1100 424 1080 436 1062 452C1052 460 1046 468 1042 480L925 480Z`;
  const lit = wob([[1240, 409], [1246, 411], [1250, 428], [1258, 444], [1268, 458], [1282, 466], [1298, 472], [1272, 474], [1258, 460], [1248, 442], [1242, 424]], R, 0.6, 6) +
    wob([[1214, 415], [1232, 414], [1236, 440], [1240, 474], [1222, 474], [1218, 446]], R, 0.6, 6) +
    wob([[1184, 415], [1198, 415], [1200, 444], [1206, 474], [1192, 474], [1186, 444]], R, 0.6, 6) +
    wob([[1152, 417], [1162, 416], [1164, 446], [1170, 474], [1160, 474], [1154, 446]], R, 0.6, 6);
  let shdG = '', tufts = '';
  for (let x = 935; x < 1070; x += 6 + R() * 8) { const y = heightAt(top, x) + 5 + R() * 14; if (y < heightAt(grassBot, x) - 2 || x < 1042) shdG += dab(x, y, 8 + R() * 10, 1.6 + R(), 8 + (R() - 0.5) * 10); }
  for (let x = 1060; x < 1236; x += 3 + R() * 4) { const y = heightAt(grassBot, x) - 1; tufts += dab(x, y, 3 + R() * 3.5, 0.9, 70 + R() * 40); }
  g += h('g', DD('sea:O:cape'), F(outline, v('seaCliff')), F(outline, 'url(#sea-pRock)'), F(lit, v('sunGlow'), { opacity: 0.5 }),
    F(grass, v('seaGrass')), F(grass, 'url(#sea-pGrass)'), Fo(shdG, v('seaGrassLo'), 0.4), F(tufts, v('seaGrass')),
    S(smooth(topW.map(([x, y]) => [x, y + 1.5]), false), v('seaGrassHi'), 1.8, { opacity: 0.85 }),
    S('M1236 404L1244 412L1249 428L1257 444L1267 457L1281 465L1297 471', v('rim'), 1.4, { opacity: 0.8 }),
    pencil(edge, 1.1, true, 0.5));
  // strata + fissures + fallen boulders on the cliff
  let st = '';
  for (let k = 0; k < 6; k++) {
    const y = 426 + k * 8;
    for (let x = 1078 + k * 12 + R() * 8; x < 1236 + k * 6; x += 14 + R() * 12) { const len = 8 + R() * 14; if (y > heightAt(grassBot, x) + 3) st += dab(x, y + (R() - 0.5) * 2, len, 0.9, (R() - 0.5) * 6); }
  }
  const fis = 'M1232 418l-4 9l3 7l-5 10l2 8M1206 430l-3 8l2 6l-4 9M1250 432l-6 10l3 8M1188 452l-4 6l1 8M1266 452l-5 8';
  const bould = wcirc(R, 1262, 470, 5.5) + wcirc(R, 1284, 471, 4) + wcirc(R, 1244, 471, 3.2);
  g += h('g', DD('sea:T:cliff-strata'), F(st, v('seaCliffLo'), { opacity: 0.55 }), S(fis, v('seaCliffDk'), 1, { opacity: 0.8 }),
    F(bould, v('seaRock')), F(wcirc(R, 1263.5, 468, 2.6) + wcirc(R, 1285, 469.5, 1.8), v('seaRockHi'), { opacity: 0.8 }), ink(bould, 0.8, true));
  g += h('g', DD('sea:O:cape-path'), S('M1082 408L1060 420L1074 428L1034 440L1048 450L1004 462L1014 470', v('seaCream'), 1.4, { 'stroke-dasharray': '2.6 2.2', opacity: 0.9 }));
  // wildflowers on the grass
  const fl = paint();
  for (let i = 0; i < 70; i++) { const x = 935 + R() * 300, t = heightAt(top, x) + 2, b = Math.min(heightAt(grassBot, x), 474) - 2; if (b - t < 2 || (x > 1080 && x < 1130 && t < 404)) continue; fl.add(v(['seaYellow', 'seaWhite', 'seaRed', 'seaRose'][i % 4]), circ(x, t + R() * (b - t), 0.7 + R() * 0.5)); }
  g += h('g', DD('sea:O:cape-flowers'), fl.out());
  // sheep grazing on the slope
  const sheep = (x, s, dir) => { const y = heightAt(top, x) + 1.5, bx = x, by = y - 3.2 * s; return { wool: wcirc(R, bx, by, 2.4 * s, 0.15) + wcirc(R, bx - 2 * s, by + 0.3, 1.9 * s) + wcirc(R, bx + 2 * s, by + 0.2, 2 * s), head: ell(bx + dir * 3.6 * s, by + 0.2, 1.3 * s, 1 * s), legs: `M${f(bx - 1.6 * s)} ${f(by + 1.8 * s)}v${f(1.8 * s)}M${f(bx + 1.6 * s)} ${f(by + 1.8 * s)}v${f(1.8 * s)}` }; };
  const sh = [sheep(1003, 1, 1), sheep(1040, 1.15, -1), sheep(1055, 0.95, 1)];
  g += h('g', DD('sea:O:cape-sheep'), S(sh.map(s => s.legs).join(''), v('seaDark'), 0.8), F(sh.map(s => s.wool).join(''), v('seaWhite')), F(sh.map(s => s.head).join(''), v('seaDark')), ink(sh.map(s => s.wool).join(''), 0.45, true));
  // picket fence along the cliff edge
  let fence = '';
  for (let x = 1172; x <= 1234; x += 4.2) fence += `M${f(x)} ${f(401.5 + (R() - 0.5) * 0.4)}v${f(-5.2 - R() * 0.6)}`;
  g += h('g', DD('sea:O:cape-fence'), S(fence + 'M1171 397.6Q1203 398.2 1235 397.4M1171 399.8Q1203 400.3 1235 399.6', v('seaWhite'), 1), S(fence, v('lineSoft'), 0.3, { transform: 'translate(0.5 0)', opacity: 0.6 }));
  // gouache director: the static headland (cliff, grass, path, flowers, sheep, fence) gets a painterly edge wobble
  // (static filter: the cape strip only translates; the keeper, beam and lantern stay outside the filtered group)
  g = h('g', { filter: 'url(#sea-gw-wob)' }, g);
  // keeper's cottage: cream walls, red roof with tile rows, chimney + a lazy curl of smoke, windows, door, flowers
  const walls = wrect(R, 1086, 386, 40, 16), roof = wob([[1083, 387], [1094, 376], [1118, 376], [1129, 387]], R, 0.35, 4);
  const chim = wrect(R, 1111, 369, 5, 9);
  g += h('g', DD('sea:O:keeper-house'),
    F(chim, v('seaStone')), F(rect(1110.4, 368.4, 6.2, 1.6), v('seaStoneLo')),
    F(walls, v('seaCream')), F(rect(1086.5, 386.5, 9, 15), v('seaWallShade'), { opacity: 0.4 }),
    F(roof, v('seaRed')), S('M1088 382.6H1124M1091 379.4H1121M1085.5 385.6H1127', v('seaRedLo'), 0.6, { opacity: 0.8 }),
    F(rect(1091, 390, 5, 5) + rect(1104, 390, 5, 5), v('seaWin')), S('M1093.5 390v5M1091 392.5h5M1106.5 390v5M1104 392.5h5', v('seaCream'), 0.5),
    F(`M1118 402V393.5A2 2 0 0 1 1122 393.5V402Z`, v('seaTeal')), F(circ(1121.2, 397.6, 0.4), v('seaYellow')),
    F(rect(1090.5, 395.2, 6, 1.4) + rect(1103.5, 395.2, 6, 1.4), v('seaWoodLo')), F(circ(1091.8, 394.9, 0.7) + circ(1094, 394.7, 0.7) + circ(1105, 394.8, 0.7) + circ(1107.6, 394.7, 0.7), v('seaRed')),
    pencil(walls + roof + chim, 0.75));
  g += h('g', DD('sea:O:keeper-smoke'), F(wcirc(R, 1115.5, 364, 2.2) + wcirc(R, 1113, 358.5, 2.8) + wcirc(R, 1108.5, 352.5, 3.4) + wcirc(R, 1102, 347.5, 3.6), v('cloudLit'), { opacity: 0.7 }),
    F(dab(1110, 353.5, 5, 0.9, -10) + dab(1104, 348.5, 5, 0.9, -10), v('cloudShade'), { opacity: 0.35 }));
  // washing line from the cottage to a post, three things drying
  g += h('g', DD('sea:O:keeper-laundry'), S('M1068 411V389.5', v('seaWoodDk'), 1), S('M1068 390Q1077 392.4 1086 390.5', v('lineSoft'), 0.4),
    F('M1071 390.9h4.2v1.2l1 1.2l-0.9 0.7v3.4h-4.4v-3.4l-0.9 -0.7l1 -1.2Z', v('seaRed')), F(rect(1077, 391.7, 4.2, 5.4), v('seaWhite')), F(rect(1077, 394, 4.2, 0.6), v('seaWallE')),
    F('M1082.5 391.3h1.6v3.2l1.4 0.8l-0.6 0.9l-2.4 -1.2Z', v('seaWallE')), ink('M1071 390.9h4.2v1.2l1 1.2l-0.9 0.7v3.4h-4.4v-3.4l-0.9 -0.7l1 -1.2Z' + rect(1077, 391.7, 4.2, 5.4), 0.35));
  // the lighthouse keeper by the door (waves back when the pelican waves)
  g += h('g', DD('sea:O:lighthouse-keeper'),
    F(rect(1131.6, 399.6, 1.6, 2.4) + rect(1134, 399.6, 1.6, 2.4), v('seaDark')), F(wrect(R, 1131.2, 395.6, 4.8, 4.4, 0.15), v('seaNavy')),
    F(wob([[1130.6, 389.6], [1136.6, 389.6], [1137, 397], [1130.2, 397]], R, 0.15, 3), v('seaNavy')), F(rect(1131.4, 392.6, 5, 0.8), v('seaYellow')),
    F(circ(1133.6, 387.4, 1.9), v('seaSkin')), F('M1131.9 388.2Q1133.6 392 1135.3 388.2Q1133.6 389.2 1131.9 388.2Z', v('seaWhite')), F('M1131.4 386.6Q1133.6 383.4 1135.9 386.6Z', v('seaDark')), F(rect(1131, 386.2, 5.4, 0.7), v('seaDark')),
    h('g', { transform: 'translate(1136.2 390.6)' }, h('g', { 'data-ref': 'sea-keeperArm', transform: 'rotate(8)' }, S('M0 0L0.4 5.2', v('seaNavy'), 1.5), F(circ(0.5, 5.8, 0.75), v('seaSkin')))),
    ink(`M1130.6 389.6L1136.6 389.6L1137 397L1130.2 397Z`, 0.35));
  // signal mast with yard + flags
  g += h('g', DD('sea:O:signal-mast'),
    S('M1216 401V350M1205 360H1227M1216 372L1204 366', v('seaWoodDk'), 1.1), S('M1206 360V376M1226 360V372', v('lineSoft'), 0.45),
    F('M1216 350.5L1229 353.5L1216 356.5Z', v('seaRed')), F(circ(1216, 349.5, 1.3), v('seaYellow')),
    F(rect(1203.8, 362, 4.4, 4.4), v('seaYellow')), F(rect(1203.8, 367.4, 4.4, 4.4), v('seaRed')), F(rect(1203.8, 369, 4.4, 1.2), v('seaWhite')),
    F(rect(1223.8, 362, 4.4, 4.4), v('seaWhite')), F(rect(1223.8, 362, 2.2, 2.2) + rect(1226, 364.2, 2.2, 2.2), v('seaNavy')),
    ink(rect(1203.8, 362, 4.4, 4.4) + rect(1203.8, 367.4, 4.4, 4.4) + rect(1223.8, 362, 4.4, 4.4) + 'M1216 350.5L1229 353.5L1216 356.5Z', 0.35),
    F(wrect(R, 1211, 396, 10, 6), v('seaStone')));
  // tower: cream and scarf-red bands, wobbly painted edges, warm sun glaze on the right, a soft shade on the left
  const yb = 402, yt = 284, wb = 13, wt = 8.5, tw = y => lerp(wb, wt, (yb - y) / (yb - yt));
  const band = (y0, y1) => wob([[X - tw(y0), y0], [X - tw(y1), y1], [X + tw(y1), y1], [X + tw(y0), y0]], R, 0.25, 5);
  const shaft = wob([[X - wb, yb], [X - wt, yt], [X + wt, yt], [X + wb, yb]], R, 0.3, 7);
  let brush = '';
  for (let i = 0; i < 16; i++) { const y = yt + 6 + R() * (yb - yt - 12), x = X + (R() - 0.5) * tw(y) * 1.4; brush += dab(x, y, 6 + R() * 8, 0.5, 85 + (R() - 0.5) * 8); }
  g += h('g', DD('sea:O:lighthouse-tower'), F(shaft, v('seaCream')),
    F(poly([[X + wb * 0.18, yb], [X + wt * 0.18, yt], [X + wt, yt], [X + wb, yb]]), v('sunGlow'), { opacity: 0.35 }),
    F(poly([[X - wb, yb], [X - wt, yt], [X - wt * 0.45, yt], [X - wb * 0.5, yb]]), v('seaWallShade'), { opacity: 0.35 }),
    F(brush, v('seaWhite'), { opacity: 0.4 }),
    F(wrect(R, X - 16, yb - 3.5, 32, 5), v('seaStone')), F(rect(X - 16, yb - 3.5, 32, 1), v('seaStoneLo'), { opacity: 0.7 }),
    h('g', DD('sea:O:lighthouse-stripes'), F(band(382, 366) + band(350, 334) + band(318, 302), v('seaRed')),
      F(poly([[X - tw(382), 382], [X - tw(366), 366], [X - tw(366) + 3.4, 366], [X - tw(382) + 4.3, 382]]) + poly([[X - tw(350), 350], [X - tw(334), 334], [X - tw(334) + 3.3, 334], [X - tw(350) + 3.9, 350]]) + poly([[X - tw(318), 318], [X - tw(302), 302], [X - tw(302) + 3.2, 302], [X - tw(318) + 3.6, 318]]), v('seaRedLo'), { opacity: 0.55 }),
      F(poly([[X + tw(382) - 3, 382], [X + tw(366) - 2.5, 366], [X + tw(366), 366], [X + tw(382), 382]]) + poly([[X + tw(350) - 3, 350], [X + tw(334) - 2.5, 334], [X + tw(334), 334], [X + tw(350), 350]]) + poly([[X + tw(318) - 3, 318], [X + tw(302) - 2.5, 302], [X + tw(302), 302], [X + tw(318), 318]]), v('seaRose'), { opacity: 0.55 }),
      pencil(shaft, 1.15)),
    h('g', DD('sea:O:lighthouse-windows'), F(`M${X - 4} ${yb - 3.5}V${yb - 10}A4 4 0 0 1 ${X + 4} ${yb - 10}V${yb - 3.5}Z`, v('seaTeal')), S(`M${X - 4} ${yb - 3.5}V${yb - 10}A4 4 0 0 1 ${X + 4} ${yb - 10}V${yb - 3.5}`, v('line'), 0.6),
      F(rect(X + 1, 356, 2.8, 6) + rect(X - 3, 326, 2.6, 5.5) + rect(X + 1.2, 294, 2.4, 5), v('seaWin')), F(rect(X + 0.6, 361.6, 3.6, 1) + rect(X - 3.4, 331.2, 3.4, 1) + rect(X + 0.8, 298.7, 3.2, 1), v('seaWhite'))));
  // day glow round the lantern (the lamp is always a little alight in a picture book)
  g += h('g', DD('sea:O:lantern-glow'), h('circle', { cx: X, cy: 269, r: 24, fill: 'url(#sea-glowSoft)', opacity: 0.55 }));
  // gallery + railing
  let rail = '';
  for (let x = X - 13; x <= X + 13.1; x += 3.25) rail += `M${f(x)} ${yt - 1}v-7`;
  g += h('g', DD('sea:O:lighthouse-gallery'),
    F(wrect(R, X - 14, yt - 1, 28, 4, 0.2) + poly([[X - 12, yt + 3], [X - 8, yt + 3], [X - 8, yt + 7]]) + poly([[X + 12, yt + 3], [X + 8, yt + 3], [X + 8, yt + 7]]) + poly([[X - 2, yt + 3], [X + 2, yt + 3], [X, yt + 6]]), v('seaDark')),
    S(rail + `M${X - 13.5} ${yt - 8}H${X + 13.5}M${X - 13.5} ${yt - 4.5}H${X + 13.5}`, v('seaDark'), 0.8));
  // lantern: glass + lens + astragals
  g += h('g', DD('sea:O:lighthouse-lantern'),
    F(rect(X - 8, 262, 16, 14), v('lamp')), F(ell(X, 269, 3.6, 5), v('lampGlow')), F(ell(X - 1, 267.5, 1.2, 2), v('seaWhite'), { opacity: 0.9 }),
    S(`M${X - 3} 266h6M${X - 3.4} 269h6.8M${X - 3} 272h6`, v('seaOrange'), 0.5, { opacity: 0.7 }),
    S(`M${X - 8} 262h16v14h-16ZM${X - 4.5} 262v14M${X + 4.5} 262v14M${X - 8} 268.5l3.5 -6.5M${X + 8} 268.5l-3.5 -6.5`, v('seaDark'), 1));
  g += h('g', DD('sea:O:lighthouse-dome'),
    F(`M${X - 10} 262Q${X} 246 ${X + 10} 262Z`, v('seaRed')), F(circ(X, 248.5, 2.2), v('seaDark')),
    F(`M${X - 6} 258Q${X - 3} 252 ${X} 251.4L${X} 253Q${X - 3} 254 ${X - 4} 258Z`, v('seaRose'), { opacity: 0.8 }), ink(`M${X - 10} 262Q${X} 246 ${X + 10} 262Z`, 0.8),
    S(`M${X} 246V234M${X - 5} 238H${X + 5}`, v('seaDark'), 0.9), F(`M${X + 5} 238l-3 -2.2v4.4Z`, v('seaYellow')));
  // night: a violet veil over the cape (the materials are graded gently), lit windows, the glow and a soft sweeping beam
  const veil = nightVeil('sea-capeveil', outline + shaft + walls + roof, 0.32);
  const litG = h('g', { 'data-ref': 'sea-keeperlit', visibility: 'hidden', ...lampOn },
    F(rect(1091, 390, 5, 5) + rect(1104, 390, 5, 5), v('lamp')), h('circle', { cx: 1100, cy: 392.5, r: 12, fill: 'url(#sea-glowG)', opacity: 0.6 }), F(rect(X - 8, 262, 16, 14), v('lamp')));
  const beam = h('g', { 'data-ref': 'sea-beam', transform: `translate(${LAMP.x} ${LAMP.y})` },
    h('g', { 'data-ref': 'sea-beamRot' },
      F('M0 -3L900 -64L900 64L0 3Z', 'url(#sea-gBeam)'),
      F('M0 -2L900 -26L900 26L0 2Z', 'url(#sea-gBeam)')),
    h('circle', { 'data-ref': 'sea-lantern', r: 34, fill: 'url(#sea-glowG)' }));
  const night = h('g', { 'data-ref': 'sea-lhnight', ...DD('sea:O:lighthouse-beam'), ...lampOn, visibility: 'hidden' }, beam);
  return { markup: h('g', { 'data-ref': 'sea-cape' }, g, veil, litG, night), defs };
}

// ============================================================================ L-sea: wash, painted waves, glitter, harbour, rocks
function buildSea(rng, lampOn) {
  const R = rng('sea-surface');
  let m = '', defs = '';
  // ---- the painted wash (x-invariant: it only follows the camera): lavender at the horizon, deepening to the bay
  defs += h('linearGradient', { id: 'sea-gWash', x1: 0, y1: HZ, x2: 0, y2: 660, gradientUnits: 'userSpaceOnUse' },
    h('stop', { offset: 0, 'stop-color': v('seaMid') }), h('stop', { offset: 0.22, 'stop-color': v('seaFar') }),
    h('stop', { offset: 0.62, 'stop-color': v('seaNear') }), h('stop', { offset: 1, 'stop-color': v('seaDeep') }));
  // split into x-pieces so each piece is its own (partly unoccluded) geometry
  const halves = (key, fn, cuts = [X0, 700, 1250, X1]) => cuts.slice(1).map((b, i) => h('g', DD(key), fn(cuts[i], b + (i < cuts.length - 2 ? 1 : 0)))).join('');
  let wash = F(rect(X0, HZ, X1 - X0, 560), v('seaDeep'));
  wash += halves('sea:O:sea-wash', (a, b) => F(rect(a, HZ, b - a, 190), 'url(#sea-gWash)'));
  // long soft horizontal brush streaks laid over the wash (gouache pulled sideways with a flat brush)
  const streaks = (a, b, y0, y1, n, fills, w0, w1, op) => {
    const P = paint();
    for (let i = 0; i < n; i++) {
      const y = lerp(y0, y1, R()), len = 80 + R() * 260, x = a + R() * (b - a - len * 0.5), t = (y - y0) / (y1 - y0 || 1);
      P.add(fills[i % fills.length], dab(x, y, len, lerp(w0, w1, t) * (0.6 + R() * 0.8), (R() - 0.5) * 0.8), op);
    }
    return P.out();
  };
  wash += halves('sea:T:painted-streaks', (a, b) =>
    streaks(a, b, 474, 520, 26, [v('seaMid'), v('seaSheen'), v('skyHaze')], 1.2, 2.6, 0.3) +
    streaks(a, b, 522, 600, 30, [v('seaMid'), v('seaFar'), v('seaDeep')], 2.4, 4.6, 0.3) +
    streaks(a, b, 596, 660, 24, [v('seaDeep'), v('seaFar'), v('seaMid')], 3.5, 6, 0.3));
  wash += h('g', DD('sea:O:horizon-glow'), F(rect(X0, HZ - 1.2, X1 - X0, 3.2), v('skyHaze'), { opacity: 0.7 }),
    S((() => { let d = ''; for (let x = X0; x < X1; x += 40 + R() * 70) d += `M${f(x)} ${f1(473.8 + R() * 2.2)}h${f(12 + R() * 34)}`; return d; })(), v('seaSheen'), 1, { opacity: 0.7 }));
  // flat-brush drag texture over the wash (static filter, fixed colours: rasterised once with the wash sheet)
  wash += h('g', { ...DD('sea:T:flat-brush-drag'), class: 'gw-tex', 'pointer-events': 'none' },
    F(rect(X0, HZ, X1 - X0, 200), '#FFF3E4', { style: 'opacity:calc(0.26 - 0.16 * var(--pb-n-night))', filter: 'url(#sea-gw-brush)' }),
    F(rect(X0, HZ, X1 - X0, 200), '#23204A', { opacity: 0.12, filter: 'url(#sea-gw-brush)', transform: `translate(${X1 + X0} 0) scale(-1 1)` }));
  // the static wash is its own composited sheet: the swaying glitter above it never forces it to repaint
  m += h('g', { 'data-ref': 'sea-wash', transform: 'translate(0 0)' }, wash);
  // ---- wave bands (each scrolls at its own depth; generated periodic over its tile)
  const bandTile = (i, gen) => {
    const W = BANDS[i][1], d = gen(W);
    return h('g', { 'data-ref': 'sea-w' + i }, h('g', {}, d), h('g', { transform: `translate(${f(W)} 0)` }, d));
  };
  const periodic = (W, x, len, fn) => fn(x) + (x + len > X0 + W ? fn(x - W) : '');
  const CF = (d, ink, o = {}) => chunks(d).map(c => F(c, ink, o)).join(''), CS = (d, ink, w, o = {}) => chunks(d).map(c => S(c, ink, w, o)).join('');
  // 0: far ripples: tiny light lenses and a few dark ticks under them
  m += bandTile(0, W => {
    let lt = '', dk = '';
    for (let y = 478; y < 505; y += 3.8 + (y - 470) * 0.06) {
      const t = (y - 470) / 40, len = 5 + t * 9;
      for (let x = X0 + R() * 50; x < X0 + W; x += 32 + R() * 80) {
        const th = 0.9 + t * 1.3, dd = R() < 0.35;
        lt += periodic(W, x, len, xx => lens(xx, y, len, th));
        if (dd) dk += periodic(W, x, len, xx => lens(xx + len * 0.2, y + th * 0.9, len * 0.7, -th * 0.6));
      }
    }
    return CG('sea:T:far-ripples', [[dk, c => F(c, v('seaNear'), { opacity: 0.35 })], [lt, c => F(c, v('foam'), { opacity: 0.4 })]]);
  });
  // 1: mid wave strokes: light crest lens over a dark trough (two-tone painted waves)
  m += bandTile(1, W => {
    let lt = '', dk = '';
    for (let y = 510; y < 550; y += 5.6 + (y - 470) * 0.04) {
      const t = (y - 500) / 50;
      for (let x = X0 + R() * 60; x < X0 + W; x += 50 + R() * 110) {
        const th = (1.2 + t * 1.4) * (0.7 + R() * 0.6), len = (11 + t * 13) * (0.6 + R() * 0.9);
        lt += periodic(W, x, len, xx => lens(xx, y, len, th));
        dk += periodic(W, x, len, xx => lens(xx - len * 0.1, y + th * 0.95, len * 1.05, -th * 0.75));
      }
    }
    return CG('sea:T:wave-troughs', [[dk, c => F(c, v('seaDeep'), { opacity: 0.32 })]]) + CG('sea:T:wave-strokes', [[lt, c => F(c, v('seaMid'), { opacity: 0.62 })]]);
  });
  // 2: swell strokes + a few slow little curls (calm: sparse)
  const curl = (x, y, len, hh) => `M${f(x)} ${f(y)}c${f(len * 0.3)} ${f(-hh)} ${f(len * 0.72)} ${f(-hh)} ${f(len)} ${f(-hh * 0.15)}c${f(-len * 0.08)} ${f(hh * 0.42)} ${f(-len * 0.24)} ${f(hh * 0.38)} ${f(-len * 0.24)} ${f(-hh * 0.06)}`;
  m += bandTile(2, W => {
    let lt = '', dk = '', cu = '';
    for (let y = 555; y < 596; y += 7) {
      const t = (y - 555) / 40;
      for (let x = X0 + R() * 80; x < X0 + W; x += 80 + R() * 170) {
        const th = (1.8 + t * 1.3) * (0.7 + R() * 0.6), len = (18 + t * 14) * (0.6 + R() * 0.9);
        lt += periodic(W, x, len, xx => lens(xx, y, len, th));
        dk += periodic(W, x, len, xx => lens(xx - len * 0.12, y + th, len * 1.1, -th * 0.8));
      }
    }
    for (let x = X0 + R() * 200; x < X0 + W - 30; x += 240 + R() * 320) { const y = 562 + R() * 30, len = 16 + R() * 6; cu += periodic(W, x, len, xx => curl(xx, y, len, 5 + R() * 1.5)); }
    // long thin swell lines drawn with a dry brush: wobbly, broken, low contrast
    let sw = '';
    for (let y = 540; y < 640; y += 9 + R() * 8) for (let x = X0 + R() * 150; x < X0 + W - 20; x += 180 + R() * 260) {
      const len = 60 + R() * 110, n = 6, pts = [];
      for (let i = 0; i <= n; i++) pts.push([i / n * len, (R() - 0.5) * 1.6 + Math.sin(i / n * Math.PI) * -1.2]);
      sw += periodic(W, x, len, xx => smooth(pts.map(([px, py]) => [xx + px, y + py]), false));
    }
    return CG('sea:T:swell-lines', [[sw, c => S(c, v('seaMid'), 0.9, { opacity: 0.35, 'stroke-dasharray': '22 5 40 7 12 4' })]]) +
      CG('sea:T:wave-strokes', [[dk, c => F(c, v('seaDeep'), { opacity: 0.35 })], [lt, c => F(c, v('seaMid'), { opacity: 0.66 })]]) +
      CG('sea:O:wave-curls', [[cu, c => S(c, v('foam'), 1.5, { opacity: 0.85 })]]);
  });
  // 3: near waves + whitecaps: foam dabs with round spray drops
  m += bandTile(3, W => {
    let lt = '', dk = '', caps = '', capS = '', spray = '';
    for (let y = 600; y < 656; y += 9) {
      const t = (y - 600) / 56;
      for (let x = X0 + R() * 120; x < X0 + W; x += 90 + R() * 180) {
        const th = (2.2 + t * 1.6) * (0.7 + R() * 0.6), len = (24 + t * 16) * (0.6 + R() * 0.9);
        lt += periodic(W, x, len, xx => lens(xx, y, len, th));
        dk += periodic(W, x, len, xx => lens(xx - len * 0.1, y + th, len * 1.1, -th * 0.8));
      }
    }
    for (let y = 598; y < 652; y += 13) {
      for (let x = X0 + R() * 200; x < X0 + W; x += 240 + R() * 380) {
        const len = 10 + R() * 10, hh = 2.2 + R() * 1.6;
        // a soft rounded foam crest: a fat lens with a little lifted lip
        caps += periodic(W, x, len, xx => lens(xx, y, len, hh * 1.5) + dab(xx + len * 0.55, y - hh * 0.6, len * 0.42, hh * 0.45, -12));
        capS += periodic(W, x, len, xx => lens(xx + len * 0.1, y + 1.2, len * 0.9, -1.6));
        spray += periodic(W, x, len, xx => circ(xx + len + 3, y - hh, 0.9) + circ(xx + len + 6, y - hh * 0.4, 0.7) + circ(xx + len * 0.7, y - hh * 1.9, 0.8));
      }
    }
    return CG('sea:T:near-wave-strokes', [[dk, c => F(c, v('seaDeep'), { opacity: 0.4 })], [lt, c => F(c, v('seaFar'), { opacity: 0.75 })]]) +
      CG('sea:O:whitecaps', [[capS, c => F(c, v('seaFar'), { opacity: 0.6 })], [caps, c => F(c, v('foam'), { opacity: 0.8 })], [spray, c => F(c, v('foam'))]]);
  });
  // ---- glitter paths (positioned under the sun / moon each frame): a soft sheen + rows of lens-shaped light dabs
  const glitter = (seed, w0, w1, inkA, inkB, refp) => {
    const G = rng(seed); const rows = [[], [], []];
    for (let y = 474, i = 0; y < 648; i++) {
      const t = (y - 470) / 175, th = 1.4 + t * 3.4, w = lerp(w0, w1, t) + G() * 30;
      const n = 2 + Math.floor(G() * 3 + t * 2);
      for (let s = 0; s < n; s++) {
        const len = 5 + G() * (8 + t * 26), x = (G() - 0.5) * w - len / 2;
        rows[i % 3].push([lens(x, y, len, th), G() < 0.4]);
      }
      y += th * 0.8 + 2.2 + t * 4.5;
    }
    return rows.map((row, k) => h('g', { 'data-ref': `${refp}${k}` },
      F(row.filter(r => !r[1]).map(r => r[0]).join(''), inkA, { opacity: 0.85 }), F(row.filter(r => r[1]).map(r => r[0]).join(''), inkB))).join('');
  };
  defs += h('radialGradient', { id: 'sea-gSheen', cx: 0, cy: 520, r: 1, gradientUnits: 'userSpaceOnUse', gradientTransform: 'translate(0 520) scale(175 50) translate(0 -520)' },
    h('stop', { offset: 0, 'stop-color': v('seaSheen'), 'stop-opacity': 0.5 }), h('stop', { offset: 0.45, 'stop-color': v('seaSheen'), 'stop-opacity': 0.2 }), h('stop', { offset: 1, 'stop-color': v('seaSheen'), 'stop-opacity': 0 }));
  defs += h('radialGradient', { id: 'sea-gMoonSheen', cx: 0, cy: 520, r: 1, gradientUnits: 'userSpaceOnUse', gradientTransform: 'translate(0 520) scale(170 60) translate(0 -520)' },
    h('stop', { offset: 0, 'stop-color': v('moon'), 'stop-opacity': 0.32 }), h('stop', { offset: 1, 'stop-color': v('moon'), 'stop-opacity': 0 }));
  const star = (x, y, r) => `M${f(x)} ${f(y - r)}Q${f(x + r * 0.16)} ${f(y - r * 0.16)} ${f(x + r)} ${f(y)}Q${f(x + r * 0.16)} ${f(y + r * 0.16)} ${f(x)} ${f(y + r)}Q${f(x - r * 0.16)} ${f(y + r * 0.16)} ${f(x - r)} ${f(y)}Q${f(x - r * 0.16)} ${f(y - r * 0.16)} ${f(x)} ${f(y - r)}Z`;
  const sparkles = [[-30, 492, 6], [38, 530, 8], [-12, 584, 9]].map(([x, y, r], k) =>
    h('g', { transform: `translate(${x} ${y})` }, h('g', { 'data-ref': 'sea-spk' + k }, F(star(0, 0, r), v('sunCore')), F(circ(0, 0, r * 0.22), v('seaWhite'))))).join('');
  m += h('g', { 'data-ref': 'sea-sunG' }, h('g', DD('sea:O:sun-sheen'), F(ell(0, 520, 175, 50), 'url(#sea-gSheen)')),
    h('g', DD('sea:O:sun-glitter'), glitter('sea-sunglit', 150, 110, v('sunGlow'), v('sunCore'), 'sea-sg')),
    h('g', DD('sea:O:glitter-sparkles'), sparkles));
  m += h('g', { 'data-ref': 'sea-moonG', visibility: 'hidden' }, F(ell(0, 520, 170, 60), 'url(#sea-gMoonSheen)'),
    h('g', DD('sea:O:moon-glitter'), glitter('sea-moonglit', 70, 60, v('moonShade'), v('moon'), 'sea-mg')));
  // ---- harbour town, rocks
  const hb = buildHarbour(rng, lampOn);
  m += hb.markup; defs += hb.defs;
  m += buildRocks(rng);
  return { markup: m, defs };
}

// ---------------------------------------------------------------------------- harbour town (hero coords, L-sea)
function buildHarbour(rng, lampOn) {
  const R = rng('sea-town');
  const yHill = x => 506 - 78 * Math.exp(-(((x - 70) / 150) ** 2)) - 24 * Math.exp(-(((x + 260) / 110) ** 2));
  let g = '', sil = '';
  // hill: sunny green gouache, grass texture, warm rim, a shady foot
  let land = `M${X0} 515`;
  for (let x = X0; x <= 300; x += 10) land += `L${f(x)} ${f(yHill(x) + (R() - 0.5) * 1.2)}`;
  land += 'L300 515Z';
  sil += land;
  let rimH = '', shd = '';
  for (let x = X0 + 10; x <= 290; x += 10) rimH += (x === X0 + 10 ? 'M' : 'L') + `${f(x)} ${f(yHill(x) + 1.4)}`;
  for (let x = X0 + 20; x < 290; x += 7 + R() * 9) { const y = Math.max(yHill(x), yHill(x + 14)) + 6 + R() * (505 - yHill(x) - 8); if (y < 504) shd += dab(x, y, 10 + R() * 12, 1.4 + R(), (R() - 0.5) * 8); }
  g += h('g', DD('sea:O:town-hill'), F(land, v('seaGrass')), F(land, v('skyHaze'), { opacity: 0.18 }), S(rimH, v('seaGrassHi'), 1.6, { opacity: 0.8 }));
  g += h('g', DD('sea:T:town-hill-brush'), F(land, 'url(#sea-pGrass)'), F(shd, v('seaGrassLo'), { opacity: 0.35 }));
  // houses: three rows, each its own design (hillside cubes, gabled middle row, tall waterfront townhouses),
  // drawn back to front; every row is merged into a handful of paths (one per paint)
  const row = () => ({ W: paint(), shade: '', roof: paint(), tiles: '', par: '', dome: '', win: '', lit: '', shut: paint(), flow: paint(), chim: '', bal: '', door: paint(), out: '' });
  const rows = [row(), row(), row()];
  const PAL = { c: ['seaWhite', 'seaCream', 'seaWallE', 'seaWhite'], g: ['seaWallA', 'seaWallB', 'seaWallC', 'seaWallD', 'seaWallE', 'seaCream'], t: ['seaWallA', 'seaWallB', 'seaWallD', 'seaWallC'] };
  const SHUT = ['seaTeal', 'seaRed', 'seaNavy', 'seaGrassLo'];
  const house = (Q, x, yb, w, hh, kind) => {
    const top = yb - hh, wall = wrect(R, x, top, w, hh, 0.22);
    Q.W.add(v(PAL[kind][Math.floor(R() * PAL[kind].length)]), wall); Q.out += wall; sil += wall;
    if (kind === 'g') {
      const rf = wob([[x - 1.6, top + 0.5], [x + w / 2, top - w * 0.46], [x + w + 1.6, top + 0.5]], R, 0.2, 4);
      Q.roof.add(v(R() < 0.5 ? 'seaRoof' : 'seaRoofB'), rf); Q.out += rf; sil += rf;
      Q.tiles += `M${f(x + 1)} ${f(top - 1.6)}H${f(x + w - 1)}M${f(x + w * 0.24)} ${f(top - w * 0.2)}H${f(x + w * 0.76)}`;
      if (R() < 0.7) { const c = wrect(R, x + w * 0.68, top - w * 0.4, 2.4, w * 0.3, 0.1); Q.chim += c + rect(x + w * 0.68 - 0.5, top - w * 0.4 - 1, 3.4, 1); Q.out += c; }
    } else if (kind === 't') {
      const rf = wob([[x - 1.4, top + 0.5], [x + 3, top - 6], [x + w - 3, top - 6], [x + w + 1.4, top + 0.5]], R, 0.2, 4);
      Q.roof.add(v(R() < 0.6 ? 'seaRoof' : 'seaRoofB'), rf); Q.out += rf; sil += rf;
      Q.tiles += `M${f(x + 1)} ${f(top - 2)}H${f(x + w - 1)}M${f(x + 2.5)} ${f(top - 4.2)}H${f(x + w - 2.5)}`;
      Q.bal += `M${f(x + 1.5)} ${f(top + 10.5)}h${f(w - 3)}`; for (let bx = x + 2; bx < x + w - 1.5; bx += 1.8) Q.bal += `M${f(bx)} ${f(top + 10.5)}v2.6`;
      Q.flow.add(v(R() < 0.5 ? 'seaRed' : 'seaRose'), circ(x + 2.4, top + 9.6, 0.8) + circ(x + w - 2.6, top + 9.5, 0.8) + circ(x + w / 2, top + 9.7, 0.7));
    } else {
      Q.par += rect(x - 0.8, top - 1.6, w + 1.6, 1.6);
      if (R() < 0.45) Q.dome += `M${f(x + w * 0.3)} ${f(top - 1.5)}a${f(w * 0.2)} ${f(w * 0.2)} 0 0 1 ${f(w * 0.4)} 0Z`;
    }
    Q.shade += rect(x, top, w * 0.24, hh);
    const cols = Math.max(1, Math.floor((w - 3) / 5.5)), nr = Math.max(1, Math.floor((hh - 6) / 7)), shut = v(SHUT[Math.floor(R() * SHUT.length)]);
    for (let r = 0; r < nr; r++) for (let c = 0; c < cols; c++) {
      const wx = x + 2.2 + c * ((w - 4.4) / cols) + ((w - 4.4) / cols - 2.4) / 2, wy = top + 3 + r * 7 + (kind === 't' && r > 0 ? 1.4 : 0);
      if (r === nr - 1 && c === 0 && (kind === 't' ? nr > 1 : R() < 0.5)) { Q.door.add(v(['seaTeal', 'seaRed', 'seaWoodLo', 'seaNavy'][Math.floor(R() * 4)]), `M${f(wx)} ${f(yb)}v-4.4a1.4 1.4 0 0 1 2.8 0v4.4Z`); continue; }
      const win = kind === 'c' ? `M${f(wx)} ${f(wy + 3.8)}v-2.3a1.2 1.2 0 0 1 2.4 0v2.3Z` : rect(wx, wy, 2.4, 3.4);
      Q.win += win; if (R() < 0.55) Q.lit += win;
      if (kind !== 'c' && R() < 0.5) Q.shut.add(shut, rect(wx - 1.1, wy, 0.9, 3.4) + rect(wx + 2.6, wy, 0.9, 3.4));
      if (kind === 'g' && R() < 0.3) Q.flow.add(v(R() < 0.5 ? 'seaRed' : 'seaYellow'), circ(wx + 0.5, wy + 3.8, 0.55) + circ(wx + 1.9, wy + 3.8, 0.55));
    }
  };
  for (let x = -70; x < 205; x += 16 + R() * 7) { if (Math.abs(x - 64) < 17) continue; house(rows[0], x, yHill(x + 8) + 3, 11 + R() * 6, 10 + R() * 6, 'c'); }
  for (let x = -40; x < 215; x += 18 + R() * 8) { if (x > 180 && x < 262) continue; house(rows[1], x, (yHill(x + 8) + 503) / 2 + 4, 15 + R() * 6, 14 + R() * 8, 'g'); }
  const tx = [];
  for (let x = 42; x < 196; x += 19 + R() * 5) { const w = 16 + R() * 4, hh = 22 + R() * 8; tx.push([x, w, hh]); house(rows[2], x, 503, w, hh, 't'); }
  const rowMarkup = (Q, key) => h('g', DD(key),
    Q.W.out(), F(Q.shade, v('seaWallShade'), { opacity: 0.38 }), Q.par ? F(Q.par, v('seaCream')) : '', Q.dome ? F(Q.dome, v('seaWallE')) : '', Q.roof.out(),
    Q.tiles ? S(Q.tiles, v('seaRoofLo'), 0.5, { opacity: 0.7 }) : '', ink(Q.out, 0.55, true),
    Q.chim ? h('g', DD('sea:O:chimneys'), F(Q.chim, v('seaStone')), ink(Q.chim, 0.35, true)) : '',
    h('g', DD('sea:O:town-windows'), F(Q.win, v('seaWin')), Q.door.out()),
    h('g', DD('sea:O:shutters'), Q.shut.out()),
    Q.bal ? h('g', DD('sea:O:balconies'), S(Q.bal, v('seaDark'), 0.5)) : '',
    h('g', DD('sea:O:window-flowers'), Q.flow.out()));
  const houses = rowMarkup(rows[0], 'sea:O:houses-cubes') + rowMarkup(rows[1], 'sea:O:houses-gabled') + rowMarkup(rows[2], 'sea:O:houses-tiled');
  // washing strung between two waterfront houses
  let laundry = '';
  if (tx.length > 3) {
    const [a, b] = [tx[1], tx[2]], x0 = a[0] + a[1] - 0.5, x1 = b[0] + 0.5, y = 503 - Math.min(a[2], b[2]) + 14;
    const cl = paint(); let d = `M${f(x0)} ${f(y)}Q${f((x0 + x1) / 2)} ${f(y + 2.5)} ${f(x1)} ${f(y)}`;
    for (let i = 0, n = Math.max(2, Math.floor((x1 - x0) / 2.6)); i < n; i++) { const u = (i + 0.5) / n, xx = lerp(x0, x1, u) - 0.8, yy = y + 10 * u * (1 - u) * 0.95; cl.add(v(['seaWhite', 'seaRed', 'seaWallE', 'seaYellow'][i % 4]), rect(xx, yy, 1.6, 2.2 + (i % 2))); }
    laundry = h('g', DD('sea:O:town-laundry'), S(d, v('lineSoft'), 0.3), cl.out());
  }
  // fish market (front left) with a striped awning and crates of fish
  const fmW = wrect(R, -8, 484, 46, 19), fmR = wob([[-11, 485], [15, 470], [41, 485]], R, 0.3, 5);
  sil += fmW + fmR;
  let awn = '', awnC = '';
  for (let i = 0; i < 8; i++) { const x = -10 + i * 6.25, d = `M${f(x)} 485h6.25v3.2q-3.1 2.4 -6.25 0Z`; if (i % 2) awnC += d; else awn += d; }
  const crates = wrect(R, 40, 497, 6, 6) + wrect(R, 47, 499, 5, 4) + wrect(R, 42, 492, 5, 5);
  let fishes = ''; for (const [x, y] of [[41, 497.4], [43.4, 497.6], [47.8, 499.2], [43, 492.4]]) fishes += `M${f(x)} ${f(y)}q1 -1.2 2.2 0l0.7 -0.6v1.2l-0.7 -0.6q-1.2 1.2 -2.2 0Z`;
  const fm = h('g', DD('sea:O:fish-market'),
    F(fmW, v('seaWallD')), F(rect(-8, 484, 10, 19), v('seaWallShade'), { opacity: 0.35 }), F(fmR, v('seaRoof')), S('M-4 481.6H34M4 477H26', v('seaRoofLo'), 0.5, { opacity: 0.7 }),
    F(`M9 503V494A6 6 0 0 1 21 494V503Z` + rect(30, 489, 4, 4) + rect(-4, 489, 4, 4), v('seaWin')), pencil(fmW + fmR, 0.6, true, 0.35),
    h('g', DD('sea:O:market-awning'), F(awn, v('seaRed')), F(awnC, v('seaWhite')), ink('M-10 485h50', 0.5)),
    h('g', DD('sea:O:fish-crates'), F(crates, v('seaWood')), S('M40 500h6M47 501h5M42 494.5h5', v('seaWoodDk'), 0.5), F(fishes, v('seaDolphin')), ink(crates, 0.35, true)));
  // church (front right): nave, bell tower with a bell in the belfry, spire, clock
  const nave = wrect(R, 206, 482, 32, 22), twr = wrect(R, 238, 446, 16, 58);
  const roofs = wob([[203, 483], [222, 470], [241, 483]], R, 0.25, 5), spire = wob([[236.5, 446], [246, 420], [255.5, 446]], R, 0.25, 5);
  sil += nave + twr + roofs + spire;
  const church = h('g', DD('sea:O:church'),
    F(nave + twr, v('seaCream')), F(rect(238.5, 446, 5, 58) + rect(206.5, 482, 7, 22), v('seaWallShade'), { opacity: 0.35 }), F(rect(250, 446, 4, 58), v('sunGlow'), { opacity: 0.3 }),
    F(roofs + spire, v('seaRoof')), S('M209 480.4H235M214 476.6H230', v('seaRoofLo'), 0.5, { opacity: 0.7 }),
    F(`M241 460V454A3 3 0 0 1 247 454V460ZM249 460V455A2 2 0 0 1 253 455V460Z` + `M213 495V489.5A1.5 1.5 0 0 1 216 489.5V495ZM222 495V489.5A1.5 1.5 0 0 1 225 489.5V495ZM231 495V489.5A1.5 1.5 0 0 1 234 489.5V495Z` + `M242 504V497A4 4 0 0 1 250 497V504Z`, v('seaWin')),
    S('M246 420V413M243.5 415.5H248.5', v('seaDark'), 0.9), F(rect(236.5, 444.5, 19, 2), v('seaStoneLo')),
    pencil(nave + twr + roofs + spire, 0.6, true, 0.35),
    h('g', DD('sea:O:church-bell'), F('M242.6 459.6Q242.6 455.4 244 455.2Q245.4 455.4 245.4 459.6Z', v('seaYellow'))));
  const clock = h('g', DD('sea:O:church-clock'), F(circ(246, 470, 4.2), v('seaDark')), F(circ(246, 470, 3.3), v('seaWhite')), S('M246 470V467.4M246 470L248 471', v('seaDark'), 0.7));
  // windmill on the hilltop: cream tower, red cap, canvas sails on a wooden lattice
  const wy = yHill(70);
  const mt = wob([[62, wy + 2], [64.5, wy - 30], [75.5, wy - 30], [78, wy + 2]], R, 0.25, 5), cap = `M62.5 ${f(wy - 29)}Q70 ${f(wy - 42)} 77.5 ${f(wy - 29)}Z`;
  sil += mt + cap;
  const mill = h('g', DD('sea:O:windmill'),
    F(mt, v('seaCream')), F(poly([[62, wy + 2], [64.5, wy - 30], [67, wy - 30], [65.5, wy + 2]]), v('seaWallShade'), { opacity: 0.4 }), F(poly([[73, wy + 2], [73.2, wy - 30], [75.5, wy - 30], [78, wy + 2]]), v('sunGlow'), { opacity: 0.35 }),
    F(cap, v('seaRed')), F(`M67.5 ${f(wy + 2)}V${f(wy - 6)}A2.5 2.5 0 0 1 72.5 ${f(wy - 6)}V${f(wy + 2)}Z`, v('seaTeal')), F(rect(68.6, wy - 20, 2.8, 4), v('seaWin')),
    pencil(mt + cap, 0.6, true, 0.35));
  let blades = '', lattice = '';
  for (let k = 0; k < 4; k++) {
    const a = k * 90;
    const pt = (u, s) => { const c = Math.cos(a * D2R), sn = Math.sin(a * D2R); return [u * c - s * sn, u * sn + s * c]; };
    blades += poly([pt(6, 0.8), pt(31, 0.8), pt(31, 6.5), pt(6, 5.5)]);
    lattice += line([pt(0, 0), pt(32, 0)]) + line([pt(6, 3.2), pt(31, 3.6)]) + line([pt(31, 0.8), pt(31, 6.5)]);
    for (let u = 11; u < 31; u += 5) lattice += line([pt(u, 0.8), pt(u, 5.5 + (u - 6) * 0.04)]);
  }
  const sails = h('g', { transform: `translate(70 ${f(wy - 31)})` }, h('g', { 'data-ref': 'sea-millSails', ...DD('sea:O:windmill-sails') }, F(blades, v('seaSail')), S(lattice, v('seaWoodDk'), 0.7), F(circ(0, 0, 2.2), v('seaDark'))));
  // trees: round gouache trees with a sunlit dab, and cypresses
  let cy = '', rt = '', rtL = '';
  for (const [x, hh] of [[112, 20], [124, 15], [162, 18], [-54, 17]]) { const yb = yHill(x) + 4; cy += `M${x} ${f(yb)}C${x - 3.4} ${f(yb - hh * 0.35)} ${x - 2.6} ${f(yb - hh * 0.8)} ${x} ${f(yb - hh)}C${x + 2.6} ${f(yb - hh * 0.8)} ${x + 3.4} ${f(yb - hh * 0.35)} ${x} ${f(yb)}Z`; }
  for (const [x, r] of [[20, 6], [185, 6.5], [-25, 5]]) { const yb = yHill(x) + 2; rt += wcirc(R, x, yb - r, r) + wcirc(R, x - r * 0.7, yb - r * 0.6, r * 0.7); rtL += wcirc(R, x + r * 0.3, yb - r * 1.3, r * 0.45); }
  const trees = h('g', DD('sea:O:town-trees'), F(cy, v('seaCypress')), F(rt, v('seaGrassLo')), F(rtL, v('seaGrassHi'), { opacity: 0.7 }), ink(rt + cy, 0.4, true));
  // gouache director: painterly edge wobble on the static town (static filter on the translate-only harbour strip);
  // the turning sails stay outside the filtered groups
  const WB = { filter: 'url(#sea-gw-wob)', class: 'sea-gw' };
  g += h('g', WB, mill) + sails + h('g', WB, trees + houses + laundry + fm + church + clock);
  // quay wall: warm stones with ink joints, cream coping, bollards, and a cat on the wall
  let stones = '';
  for (let r = 0; r < 3; r++) for (let x = -416 + (r % 2) * 4.5; x < 296; x += 9) stones += wrect(R, x, 504.6 + r * 3.5, 8.4, 3.1, 0.12);
  sil += rect(-420, 502, 720, 13);
  g += h('g', DD('sea:O:quay-wall'), F(rect(-420, 503, 720, 12), v('seaStone')), F(rect(-420, 501.6, 720, 2.6), v('seaCream')),
    F([60, 104, 150, 196, 280].map(x => rect(x, 499, 2.4, 3) + rect(x - 0.6, 498.4, 3.6, 1)).join(''), v('seaDark')));
  g += h('g', DD('sea:T:quay-stones'), S(stones, v('seaStoneLo'), 0.45, { opacity: 0.85 }));
  g += h('g', DD('sea:O:quay-cat'), F('M259 501.8C258.6 498.6 259.6 496.4 261.4 496.2C262.8 496 263.8 497.6 263.6 501.8Z' + 'M260 496.8L260.2 494.4L261.4 495.8ZM262.4 495.8L263.4 494.4L263.2 496.8Z' + 'M263.4 501.4Q266.6 501.6 266 504.6', v('seaDark')),
    S('M263.4 501.4Q266.4 501.8 265.8 505', v('seaDark'), 0.8), F(circ(260.9, 497.6, 0.3) + circ(262.5, 497.6, 0.3), v('seaYellow')));
  // harbour mole in front + striped beacon tower
  let mm = '';
  for (let x = -86; x < 112; x += 8) mm += `M${x} 517.5V520.5M${x + 4} 520.5V523.5`;
  const mole = wob([[-420, 517], [110, 517], [114, 524], [-420, 524]], R, 0.3, 8);
  sil += mole;
  g += h('g', DD('sea:O:harbour-mole'), F(mole, v('seaStone')), F(rect(-420, 516, 532, 1.8), v('seaCream')), S(mm + 'M-90 520.5H112', v('seaStoneLo'), 0.5), ink(mole, 0.45, true));
  const bcn = wrect(R, 100, 494, 9, 23);
  g += h('g', DD('sea:O:harbour-beacon'), F(bcn, v('seaWhite')), F(rect(100, 499, 9, 4) + rect(100, 507, 9, 4), v('seaRed')), F(rect(99, 491, 11, 3) + `M100.5 491L104.5 486L108.5 491Z`, v('seaDark')),
    F(rect(102, 488, 5, 3), v('lamp')), ink(bcn, 0.45), h('circle', { cx: 104.5, cy: 489.5, r: 10, fill: 'url(#sea-glowG)', 'data-ref': 'sea-glow-beacon', ...lampOn, visibility: 'hidden' }));
  // moored dinghies: pastel hulls, cream gunwales, one with a furled sail
  const dinghy = (x, w) => wob([[x, 510.5], [x + w, 510], [x + w - 3, 514.5], [x + 3, 514.8]], R, 0.15, 4);
  const dg = [[128, 16, 'seaRed'], [150, 13, 'seaTeal'], [170, 18, 'seaYellow'], [196, 14, 'seaWallE']];
  g += h('g', DD('sea:O:moored-boats'), dg.map(([x, w, c]) => F(dinghy(x, w), v(c))).join(''), S(dg.map(([x, w]) => `M${x + 0.5} 510.9L${x + w - 0.5} 510.4`).join(''), v('seaCream'), 0.8),
    ink(dg.map(([x, w]) => dinghy(x, w)).join(''), 0.4), S('M178 510V496M178 498L190 509M132 510.5L126 503M157 510L150 504', v('seaWoodDk'), 0.7), F('M178.8 498L188 508.5L178.8 508.5Z', v('seaSail')));
  // pier: wooden deck + cream railing, pilings + bracing, lamps + bunting, the domed pavilion, two anglers
  let pil = '', brace = '', rails = '';
  for (let x = 304; x <= 452; x += 11) { pil += wrect(R, x - 0.9, 496, 1.8, 20, 0.1); if (x + 11 <= 452) brace += `M${x} 500L${x + 11} 510M${x + 11} 500L${x} 510`; }
  for (let x = 300; x <= 418; x += 5) rails += `M${x} 494v-5.5`;
  const deck = wrect(R, 298, 493.5, 160, 3.2, 0.12);
  sil += deck;
  g += h('g', DD('sea:O:pier-pilings'), F(pil, v('seaWoodLo')), S(brace + 'M300 505H452', v('seaWoodDk'), 0.55), ink(pil, 0.3, true));
  g += h('g', DD('sea:O:pier-deck'), F(deck, v('seaWood')), S('M299 495.1H457', v('seaWoodDk'), 0.35, { opacity: 0.6 }), S(rails + 'M299 488.6H420', v('seaWhite'), 0.8), ink(deck, 0.4, true));
  const lamps = [322, 352, 382, 410];
  g += h('g', DD('sea:O:pier-lamps'), S(lamps.map(x => `M${x} 494V482M${x - 2} 482H${x + 2}`).join(''), v('seaDark'), 0.9), F(lamps.map(x => circ(x, 480.6, 1.7)).join(''), v('lamp')));
  let bunt = ''; const flags = paint();
  for (let i = 0; i < lamps.length - 1; i++) {
    const [a, b] = [lamps[i], lamps[i + 1]];
    bunt += `M${a} 482Q${(a + b) / 2} 488 ${b} 482`;
    for (let k = 1; k < 6; k++) { const u = k / 6, x = lerp(a, b, u), y = 482 + 12 * u * (1 - u); flags.add(v(['seaRed', 'seaYellow', 'seaTeal', 'seaWhite', 'seaRose'][(i * 5 + k) % 5]), poly([[x - 1.6, y], [x + 1.6, y], [x, y + 3.4]])); }
  }
  g += h('g', DD('sea:O:pier-bunting'), S(bunt, v('lineSoft'), 0.45), flags.out());
  const pav = wrect(R, 420, 478, 32, 16), dome = `M420 478Q420 466 436 461Q452 466 452 478Z`;
  sil += pav + dome;
  let awP = ''; for (let i = 0; i < 8; i++) awP += `M${f(418 + i * 4.5)} 477h4.5v2.6q-2.25 2 -4.5 0Z`;
  g += h('g', DD('sea:O:pier-pavilion'),
    F(pav, v('seaCream')), F(dome, v('seaTeal')), F(`M430 478Q431 468 436 461Q441 468 442 478Z`, v('seaWhite'), { opacity: 0.55 }), F(`M424 478Q425 469 436 461Q429 468 428 478Z`, v('seaTealLo'), { opacity: 0.5 }),
    F(`M424 492V485A2.5 2.5 0 0 1 429 485V492ZM433.5 492V485A2.5 2.5 0 0 1 438.5 485V492ZM443 492V485A2.5 2.5 0 0 1 448 485V492Z`, v('seaWin')),
    F(awP, v('seaRed')), S('M436 461V451', v('seaDark'), 0.8), F('M436 451L444 453L436 455Z', v('seaRed')), pencil(pav + dome, 0.6, true, 0.35));
  // two anglers on the pier, rods bent over the water
  g += h('g', DD('sea:O:pier-anglers'),
    F(wrect(R, 338, 487.5, 3.4, 6, 0.1) + wrect(R, 395, 487.8, 3.4, 5.8, 0.1), v('seaYellow')), F(circ(339.7, 486.2, 1.4) + circ(396.7, 486.5, 1.4), v('seaSkin')),
    F('M337.8 485.9Q339.7 483.2 341.6 485.9Z', v('seaRed')), F('M394.8 486.2Q396.7 483.5 398.6 486.2Z', v('seaNavy')),
    S('M341 489Q350 480 356 486M398 489Q405 481 412 486', v('seaWoodDk'), 0.5), S('M356 486V515M412 486V515', v('lineSoft'), 0.25, { opacity: 0.8 }),
    F(circ(356, 515.5, 0.8) + circ(412, 515.5, 0.8), v('seaRed')));
  // reflections under the waterline: broken painted strokes of the colours above
  const rf = paint();
  for (let x = -60; x < 452; x += 3 + R() * 6) {
    const y = 517.5 + R() * 17, w = 3 + R() * 9, which = R();
    if (x < 114 && y < 525) continue;
    rf.add(v(which < 0.25 ? 'seaWallA' : which < 0.45 ? 'seaCream' : which < 0.6 ? 'seaRoof' : which < 0.75 ? 'seaWallE' : 'seaMid'), dab(x, y, w, 0.6 + R() * 0.4, 0), 0.5);
  }
  for (let x = 304; x <= 452; x += 11) rf.add(v('seaDeep'), dab(x - 0.8, 525, 12, 0.7, 90), 0.4);
  g += h('g', DD('sea:T:harbour-reflections'), rf.out());
  // night: violet veil, then lit windows, their reflections, and the lamp glows on the pier
  g += nightVeil('sea-townveil', sil, 0.3);
  g += h('g', { 'data-ref': 'sea-townlit', visibility: 'hidden', ...lampOn }, F(rows.map(Q => Q.lit).join(''), v('lamp')),
    F((() => { let d = ''; const Q = rng('sea-town-refl'); for (let i = 0; i < 40; i++) { const x = 40 + Q() * 160; d += dab(x, 518 + Q() * 14, 2 + Q() * 4, 0.5, 0); } return d; })(), v('lamp'), { opacity: 0.55 }));
  g += h('g', { 'data-ref': 'sea-pierglow', ...lampOn, visibility: 'hidden' }, lamps.map(x => h('circle', { cx: x, cy: 480.6, r: 9, fill: 'url(#sea-glowG)' })).join(''));
  return { markup: h('g', { 'data-ref': 'sea-harbour' }, g), defs: '' };
}

// ---------------------------------------------------------------------------- rocks, seal, cormorants (L-sea)
function buildRocks(rng) {
  const R = rng('sea-rocks');
  let g = '';
  const bodyPts = [[[58, 634], [66, 606], [84, 592], [104, 586], [130, 584], [152, 590], [170, 600], [186, 616], [196, 634]],
    [[206, 636], [212, 618], [224, 612], [238, 620], [244, 636]], [[298, 638], [304, 626], [318, 622], [330, 630], [334, 638]]];
  const bodies = bodyPts.map(p => wob(p, R, 1.1, 7)).join('');
  const stackP = [[250, 636], [254, 600], [258, 572], [262, 556], [272, 550], [282, 554], [286, 574], [290, 606], [294, 636]];
  const stack = wob(stackP, R, 0.9, 7);
  const shade = wob([[58, 634], [66, 606], [84, 592], [98, 600], [92, 618], [100, 634]], R, 0.8, 6) + wob([[206, 636], [212, 618], [218, 624], [216, 636]], R, 0.5, 5) +
    wob([[298, 638], [304, 626], [310, 630], [308, 638]], R, 0.5, 5);
  // gouache: light dabs on the sunward tops, cool dabs in the hollows, dry-brush cracks
  let hi = '', lo = '';
  for (let i = 0; i < 26; i++) { const x = 100 + R() * 88, y = 590 + (x - 100) * 0.18 + R() * 16; hi += dab(x, y, 6 + R() * 10, 1.2 + R(), 20 + R() * 20); }
  for (let i = 0; i < 18; i++) { const x = 70 + R() * 110, y = 612 + R() * 18; lo += dab(x, y, 7 + R() * 10, 1.3, (R() - 0.5) * 20); }
  g += h('g', DD('sea:O:rocks'), F(bodies, v('seaRock')), F(shade, v('seaRockLo'), { opacity: 0.75 }), pencil(bodies, 1.2));
  g += h('g', DD('sea:T:rock-brushwork'), F(hi, v('seaRockHi'), { opacity: 0.55 }), F(lo, v('seaRockLo'), { opacity: 0.4 }),
    S('M108 600l6 8l2 7M128 606l4 6l1 7M150 604l6 9l2 9M112 616l-3 6l-1 6M226 620l3 5l1 5', v('seaRockLo'), 0.9));
  g += h('g', DD('sea:O:sea-stack'), F(stack, v('seaRock')), F(wob([[262, 556], [266, 566], [264, 600], [268, 636], [250, 636], [254, 600], [258, 572]], R, 0.5, 6), v('seaRockLo'), { opacity: 0.75 }),
    F(dab(272, 560, 12, 1.4, 70) + dab(278, 580, 16, 1.6, 80) + dab(283, 600, 18, 1.6, 85), v('seaRockHi'), { opacity: 0.55 }), S('M270 572l8 3M268 590l12 3M270 610l14 2', v('seaRockLo'), 0.9),
    F(dab(254, 552, 10, 1.6, 74) + dab(268, 548, 6, 1.2, 20), v('seaWhite'), { opacity: 0.7 }), pencil(stack, 1.1));
  g += h('g', DD('sea:O:rock-rim-light'), S('M104 587L130 585L152 591L170 601L186 617M224 613L238 621M272 551L282 555L286 575M318 623L330 631', v('rim'), 1.8, { opacity: 0.8 }));
  // seaweed hanging at the waterline, barnacles
  let weed = '', barn = '';
  for (let x = 60; x < 334; x += 2.6 + R() * 3) { if ((x > 196 && x < 206) || (x > 244 && x < 250) || (x > 294 && x < 298)) continue; const y = x > 250 && x < 294 ? 631 : x > 298 ? 633 : 629; weed += dab(x, y - 6 - R() * 3, 5 + R() * 5, 0.9, 82 + (R() - 0.5) * 26); }
  for (let i = 0; i < 26; i++) { const x = 70 + R() * 120, y = 622 + R() * 7; barn += circ(x, y, 0.55 + R() * 0.4); }
  g += h('g', DD('sea:O:seaweed'), F(weed, v('seaWeed'))) + h('g', DD('sea:O:barnacles'), F(barn, v('seaCream'), { opacity: 0.9 }));
  // a seal basking on the big rock (head bobs): soft grey-brown, light belly, kind eye
  const sealB = 'M92 590C96 578 118 574 138 578C148 580 154 582 158 584L150 590C130 592 108 594 92 590Z';
  g += h('g', DD('sea:O:seal-basking'),
    F(sealB, v('seaSeal')), F('M100 580C112 576 128 575 142 578C130 578 112 580 100 582Z', v('seaSealLo'), { opacity: 0.7 }), F('M104 589C118 590 134 589 148 587C134 592 116 593 104 591Z', v('seaBelly'), { opacity: 0.8 }),
    F('M96 589L86 584L90 591Z', v('seaSealLo')), F(dab(120, 587, 10, 1.6, -30), v('seaSealLo')), pencil(sealB + 'M96 589L86 584L90 591Z', 0.8),
    h('g', { transform: 'translate(152 582)' }, h('g', { 'data-ref': 'sea-sealHead' },
      F('M-4 1C-4 -8 2 -14 10 -13C15 -12 17 -8 17 -5C17 -2 13 0 8 1Z', v('seaSeal')), F(ell(13.5, -4.6, 3.6, 2.4), v('seaBelly')),
      F(circ(8.5, -9, 1.3), v('seaDark')), F(circ(8.9, -9.5, 0.45), v('seaWhite')), F(ell(16, -5.6, 1.3, 0.9), v('seaDark')),
      S('M12.6 -3.4Q14.4 -2.4 16 -3.4', v('line'), 0.4), S('M14 -4.4l5 -1.2M14 -3.8l5 0.6M13.6 -3.2l4.6 1.8', v('seaWhite'), 0.35), ink('M-4 1C-4 -8 2 -14 10 -13C15 -12 17 -8 17 -5C17 -2 13 0 8 1', 0.7))));
  // cormorants on the stack: one drying its wings, one sitting (dark gouache, golden throat patch)
  const cA = 'M268 551C267 545 268 540 270 536C271 533 273 532 274 534C275 536 274 539 273 541C276 543 277 547 276 551Z' +
    'M270 540C264 536 259 531 256 526C261 528 265 530 270 537ZM273 540C279 536 284 531 287 526C282 528 278 530 273 537Z';
  const cB = 'M280 553C279 548 281 545 284 545C285 543 287 542 288 543C289 545 288 546 287 547C289 549 289 552 287 553Z';
  g += h('g', DD('sea:O:cormorants'), F(cA + cB, v('seaDark')), F('M274 534L278 535L274 535.8ZM288 543.4L291 544L288 544.6Z', v('seaOrange')),
    F(circ(273.9, 535.8, 0.8) + circ(288.3, 545, 0.7), v('seaYellow')), F(circ(273.3, 533.6, 0.45) + circ(287.3, 543.2, 0.4), v('seaWhite')),
    S('M260 529.6l4 3M263 528.4l3 3.4M284 528.4l-4 3M281 529.6l-3 3.4', v('seaDolphinLo'), 0.6));
  // surging foam collars (wobbly, soft) + round spray drops
  let foam = '', spray = '';
  for (const [x0, x1, y] of [[52, 202, 633], [202, 250, 635], [246, 298, 635], [294, 340, 637]]) {
    foam += `M${x0} ${y}`;
    for (let x = x0; x < x1; x += 6) foam += `q3 ${f(-2.6 - R() * 1.6)} 6 0`;
    foam += `L${x1} ${y + 4}Q${(x0 + x1) / 2} ${y + 5.5} ${x0} ${y + 4}Z`;
    for (let k = 0; k < 6; k++) spray += circ(x0 + R() * (x1 - x0), y - 3 - R() * 8, 0.7 + R() * 0.7);
  }
  g += h('g', DD('sea:O:rock-foam'), h('g', { 'data-ref': 'sea-foam' }, F(foam, v('foam'), { opacity: 0.92 }), F(spray, v('foam'))),
    S('M40 642q10 -3 20 0M186 644q12 -3 24 0M336 643q10 -3 20 0', v('foam'), 1.3, { opacity: 0.8 }));
  return h('g', { 'data-ref': 'sea-rocks' }, g);
}

// ============================================================================ L-boats: boats, buoys, dolphin, fish, seal
function buildBoats(rng, lampOn) {
  const R = rng('sea-boats');
  let m = '', defs = '';
  const wrapObj = (key, inner, extra = {}) => h('g', { 'data-ref': 'sea-o-' + key, ...extra }, inner);
  const gull = (x, y, s, ref) => h('g', { transform: `translate(${x} ${y}) scale(${s})` }, h('g', { 'data-ref': ref },
    F('M-14 -3Q-7 -10 0 0Q7 -10 14 -3Q7 -5.5 0 3Q-7 -5.5 -14 -3Z', v('seaWhite')), F('M-14 -3Q-12 -5 -10 -5.6L-11 -3.8ZM14 -3Q12 -5 10 -5.6L11 -3.8Z', v('seaDark')),
    F('M-1.2 0.5l1.2 3l1.2 -3Z', v('seaOrange')), ink('M-14 -3Q-7 -10 0 0Q7 -10 14 -3', 1)));
  // ---- steamer (bow to the left; heading -x): navy hull with a red boot-topping, cream decks, yellow funnels
  {
    const hull = wob([[-56, -10], [50, -10], [52.5, -9], [47, 1], [-46, 1], [-52, -4]], R, 0.25, 8);
    let ports = ''; for (let x = -40; x <= 42; x += 5) ports += circ(x, -6, 0.8);
    let dw = ''; for (let x = -21; x <= 30; x += 3.6) dw += rect(x, -14.4, 1.6, 2);
    const deck = wrect(R, -26, -16, 58, 6, 0.15) + wrect(R, -16, -21, 38, 5, 0.15) + wrect(R, -26, -27, 12, 11, 0.15);
    const smoke = [0, 1, 2, 3, 4].map(k => h('g', { 'data-ref': 'sea-smoke' + k, transform: 'translate(17 -38)' },
      F(circ(0, 0, 4) + circ(3.5, -1.5, 3.2) + circ(-3, 1, 2.8), v('cloudLit')), F(circ(1, 1.6, 2.6) + circ(-2.4, 2, 1.8), v('cloudShade'), { opacity: 0.55 }))).join('');
    const funnels = poly([[0, -21], [6.5, -21], [8.5, -36], [2, -36]]) + poly([[12, -21], [18.5, -21], [20.5, -37], [14, -37]]);
    const art = h('g', DD('sea:O:steamer-smoke'), smoke) +
      h('g', DD('sea:O:steamer'), F(hull, v('seaNavy')), F('M-48 -1.8L48.2 -1.8L47 1L-46 1Z', v('seaRed')), S('M-55 -9.4H51', v('seaCream'), 1), F(ports, v('seaCream')),
        F(deck, v('seaCream')), F(rect(-26, -16, 7, 6) + rect(-16, -21, 5, 5), v('seaWallShade'), { opacity: 0.4 }), F(dw + rect(-25, -25, 10, 2), v('seaWin')),
        F(rect(-27, -28, 14, 1.4) + rect(-17, -22, 40, 1.2), v('seaRed')), S('M-26 -16.6h58', v('seaDark'), 0.4), pencil(hull + deck, 0.8, false, 0.35)) +
      h('g', DD('sea:O:steamer-funnels'), F(funnels, v('seaYellow')),
        F(poly([[1.6, -33], [8.1, -33], [8.5, -36], [2, -36]]) + poly([[13.6, -34], [20.1, -34], [20.5, -37], [14, -37]]), v('seaDark')),
        F(poly([[0.8, -28], [7.3, -28], [7.45, -29.6], [0.95, -29.6]]) + poly([[12.9, -28.4], [19.4, -28.4], [19.55, -30], [13.05, -30]]), v('seaRed')), ink(funnels, 0.6)) +
      h('g', DD('sea:O:steamer-lifeboats'), F('M-12 -24h8l-1.2 2.4h-5.6ZM24 -24h8l-1.2 2.4h-5.6Z', v('seaWhite')), ink('M-12 -24h8l-1.2 2.4h-5.6ZM24 -24h8l-1.2 2.4h-5.6Z', 0.4), S('M-12 -21v-5h1.5M-4 -21v-5h-1.5M24 -21v-5h1.5M32 -21v-5h-1.5', v('seaDark'), 0.5)) +
      h('g', DD('sea:O:steamer-bunting'), S('M-40 -10V-42M38 -10V-40M-56 -10L-40 -42L-2 -44M22 -44L38 -40L51 -10', v('seaWoodDk'), 0.55),
        (() => { const P = paint(), C = ['seaRed', 'seaYellow', 'seaTeal', 'seaWhite'];
          for (let i = 0; i < 6; i++) { const u = (i + 0.5) / 6, x = lerp(-56, -40, u), y = lerp(-10, -42, u); P.add(v(C[i % 4]), poly([[x, y], [x + 2.2, y + 0.4], [x + 0.6, y + 2.6]])); }
          for (let i = 0; i < 5; i++) { const u = (i + 0.5) / 5, x = lerp(38, 51, u), y = lerp(-40, -10, u); P.add(v(C[(i + 1) % 4]), poly([[x, y], [x + 2.2, y + 0.4], [x + 0.9, y + 2.6]])); }
          for (let i = 0; i < 5; i++) { const u = (i + 0.5) / 5, x = lerp(-40, -2, u), y = -42 - 2 * u; P.add(v(C[(i + 2) % 4]), poly([[x, y], [x + 2.2, y], [x + 1.1, y + 2.8]])); }
          return P.out(); })()) +
      h('g', { ...lampOn, 'data-ref': 'sea-steamlit', visibility: 'hidden' }, F(circ(-40, -43, 1.3) + circ(38, -41, 1.3) + dw + ports, v('lamp')));
    m += wrapObj('steamer', art);
  }
  // ---- far sloop (the draft's cream + rose sails) and the red-sail yawl (drawn at near-boat units, placed small)
  {
    const hull = wob([[-50, -10], [54, -12], [42, 4], [-38, 4]], R, 1, 14), main = 'M-3 -126Q-30 -70 -44 -16L-3 -16Z', jib = 'M4 -114Q40 -60 46 -14L4 -14Z';
    m += wrapObj('sloop', h('g', DD('sea:O:far-sloop'),
      F(hull, v('seaHull')), S('M-48 -8L52 -10', v('seaCream'), 3), F(rect(-2, -130, 5, 120), v('seaWoodDk')),
      F(main, v('seaRose')), F(jib, v('seaSail')), F('M30 -60Q42 -36 44 -18L36 -18Q36 -40 26 -58Z', v('sunGlow'), { opacity: 0.6 }), F('M-1 -138l18 5l-18 5Z', v('seaRed')),
      ink(hull + main + jib, 3.6), S('M-54 10h110M-36 16h70', v('foam'), 3, { opacity: 0.7 })));
    const yh = wob([[-46, -12], [50, -14], [46, -2], [36, 4], [-34, 4], [-42, -2]], R, 1, 14), s1 = 'M6 -112L-26 -106L-30 -18L40 -20Z', s2 = 'M-32 -76L-56 -72L-54 -18L-34 -18Z';
    m += wrapObj('yawl', h('g', DD('sea:O:red-sail-yawl'),
      F(yh, v('seaTeal')), S('M-46 -10L50 -12', v('seaCream'), 3),
      S('M4 -12V-120M-34 -12V-80', v('seaWoodDk'), 5), F(s1 + s2, v('seaRed')), S('M-10 -108L-14 -19M14 -110L10 -20M-44 -74L-44 -18', v('seaRedLo'), 2.4, { opacity: 0.7 }),
      F('M20 -100L36 -22L40 -20L6 -112Z', v('seaRose'), { opacity: 0.55 }), ink(yh + s1 + s2, 3.4), S('M-50 10h100', v('foam'), 3, { opacity: 0.7 })));
  }
  // ---- trawler with drying net, fisherman in yellow oilskins and gulls
  {
    defs += h('clipPath', { id: 'sea-netclip' }, F('M-52 -50L-20 -64L-18 -22L-44 -18Z', '#000'));
    let mesh = ''; for (let k = -80; k < 60; k += 5) mesh += `M${k} -70L${k + 60} -10M${k + 60} -70L${k} -10`;
    const hull = wob([[-48, -18], [50, -22], [46, -8], [36, 2], [-38, 2], [-45, -7]], R, 0.6, 10), wh = wrect(R, 8, -44, 22, 24, 0.4);
    const art = h('g', DD('sea:O:trawler'),
      F(hull, v('seaTeal')), F('M-45 -3L42 -3L38 2L-38 2Z', v('seaRed')), S('M-48 -16.4L50 -20.4', v('seaCream'), 2.2),
      h('g', { fill: 'none', stroke: v('seaCream'), 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, glyphs('PB7', -34, -14, 0.95)),
      F(wh, v('seaCream')), F(rect(11, -40, 6, 6) + rect(21, -40, 6, 6), v('seaWin')), F(rect(26, -54, 3, 7), v('seaDark')), F(wrect(R, 5, -48, 28, 4, 0.3), v('seaRed')),
      F(rect(11, -40, 6, 6) + rect(21, -40, 6, 6), v('lamp'), { ...lampOn, 'data-ref': 'sea-trawlit', visibility: 'hidden' }),
      S('M-6 -20V-88M-6 -72L-54 -50M-6 -88L-54 -50', v('seaWoodDk'), 2.4), F('M-6 -88l14 4l-14 4Z', v('seaRed')),
      S('M-48 -18L-84 4', v('lineSoft'), 1.4, { 'stroke-dasharray': '4 3' }), pencil(hull + wh, 2, false, 0.8)) +
      h('g', DD('sea:T:fishing-net'), h('g', { 'clip-path': 'url(#sea-netclip)' }, F('M-52 -50L-20 -64L-18 -22L-44 -18Z', v('seaWoodLo'), { opacity: 0.7 }), S(mesh, v('seaWoodDk'), 1.2)),
        F(circ(-44, -18, 2.6) + circ(-36, -19, 2.6) + circ(-27, -20.5, 2.6) + circ(-19, -22, 2.6), v('seaOrange'))) +
      h('g', DD('sea:O:fisherman'), F(poly([[-24, -20], [-23, -36], [-15, -36], [-14, -20]]), v('seaYellow')), F(circ(-19, -40, 3.6), v('seaSkin')), F('M-26 -41Q-19 -50 -12 -41Z', v('seaYellow')),
        S('M-22 -32L-30 -46M-16 -32L-26 -50', v('seaYellow'), 2.6), ink(poly([[-24, -20], [-23, -36], [-15, -36], [-14, -20]]) + 'M-26 -41Q-19 -50 -12 -41Z', 1.2)) +
      h('g', DD('sea:O:net-gulls'), gull(-40, -104, 1, 'sea-gA'), gull(-8, -124, 0.8, 'sea-gB'));
    m += wrapObj('trawler', art);
  }
  // ---- rowing boat: a child fishing with a black-and-white cat in the bow (storybook life)
  {
    const hull = wob([[-34, -8], [36, -10], [30, 2], [-28, 2]], R, 0.5, 8);
    m += wrapObj('row', h('g', DD('sea:O:rowboat'),
      S('M-30 -6L-52 6M26 -8L44 5', v('seaWoodDk'), 2.2), F(ell(-52, 6.4, 4, 1.4) + ell(44, 5.4, 4, 1.4), v('seaWood')),
      F(hull, v('seaWood')), S('M-32 -5L34 -7M-30 -1.6L32 -3.6', v('seaWoodLo'), 1.2), S('M-34 -8L36 -10', v('seaCream'), 2.2), pencil(hull, 1.6, false, 0.6)) +
      h('g', DD('sea:O:rowboat-kid'),
        F(wob([[-6, -10], [-7, -26], [5, -26], [4, -10]], R, 0.3, 5), v('seaRed')), F(circ(-1, -31, 5), v('seaSkin')), F('M-6.6 -32Q-1 -40 4.6 -32Z', v('seaYellow')), F(circ(-1, -38.6, 1.6), v('seaYellow')),
        F(circ(1.8, -31.6, 0.8), v('seaDark')), F(circ(2.8, -29.4, 1.1), v('seaRose'), { opacity: 0.7 }), S('M0.6 -28.6q1.6 1 3 0', v('line'), 0.6),
        S('M3 -20L14 -23', v('seaRed'), 2.6), S('M13 -24Q30 -48 56 -40', v('seaWoodDk'), 1), S('M56 -40L60 8', v('lineSoft'), 0.5), F(circ(60, 8, 1.8), v('seaRed')), F(circ(60, 6.6, 1), v('seaWhite')),
        ink(wob([[-6, -10], [-7, -26], [5, -26], [4, -10]], R, 0.2, 5) + circ(-1, -31, 5), 1.1)) +
      h('g', DD('sea:O:rowboat-cat'),
        F('M20 -10C19 -16 21 -20 24 -20C27 -20 28 -16 27.4 -10Z' + 'M21.4 -19.4L21.8 -23.4L23.6 -20.6ZM25.2 -20.6L27 -23.4L27.2 -19.4Z', v('seaDark')), F('M22.4 -12.6Q23.8 -17 25.6 -12.6Z', v('seaWhite')),
        F(circ(22.8, -18, 0.5) + circ(25.4, -18, 0.5), v('seaYellow')), S('M27.4 -11Q33 -10 31 -16', v('seaDark'), 1.4)));
  }
  // ---- the near sailboat with rigging, flags, crew and wake
  {
    const xl = y => -56 * ((y + 154) / 123) ** 0.85;
    let seams = ''; for (let y = -142; y < -34; y += 11) seams += `M-1 ${y}L${f(xl(y) + 1)} ${f(y + 1)}`;
    const hull = wob([[-58, -16], [64, -18], [60, -8], [46, 3], [-46, 3], [-55, -5]], R, 0.4, 10), main = `M0 -154C-10 -120 -36 -70 -56 -31L-1 -31Z`, jib = 'M5 -140Q40 -80 60 -19L18 -27Z';
    const cabin = wob([[-12, -24], [20, -24], [24, -17], [-12, -17]], R, 0.25, 6);
    const art = h('g', DD('sea:O:boat-wake'), F('M52 -2Q66 -8 76 0Q66 -3 58 2ZM60 1Q72 -3 82 3Q72 1 64 4Z', v('foam')),
      S('M-62 3Q-86 1 -118 4M-64 6Q-92 5 -140 9M-60 9Q-80 10 -100 12', v('foam'), 2, { opacity: 0.85 }), F(circ(80, -4, 1.2) + circ(86, 0, 0.9) + circ(-120, 1, 1), v('foam'))) +
      h('g', DD('sea:O:sailboat-hull'), F(hull, v('seaHull')), F('M-57 -13L62 -15L61 -11.4L-56.4 -9.4Z', v('seaCream')),
        F('M-47 -1L49 -1L47.6 1.4L-45.6 1.4Z', v('seaDark')), S('M-40 -4.6H40M-30 -7H36', v('seaRedLo'), 0.6, { opacity: 0.6 }),
        F(cabin, v('seaCream')), F(circ(-4, -20.5, 1.4) + circ(4, -20.5, 1.4) + circ(12, -20.5, 1.4), v('seaWin')), S(`M${-5} -22.3a1.4 1.4 0 0 1 2.4 0M3 -22.3a1.4 1.4 0 0 1 2.4 0M11 -22.3a1.4 1.4 0 0 1 2.4 0`, v('seaWood'), 0.5),
        pencil(hull + cabin, 1.5, false, 0.6)) +
      h('g', DD('sea:O:lifebuoy'), F(circ(34, -9, 4.2), v('seaRed')), F(circ(34, -9, 2), v('seaHull')), S('M34 -13.2v2M34 -4.8v-2M29.8 -9h2M38.2 -9h-2', v('seaWhite'), 2), ink(circ(34, -9, 4.2), 0.6)) +
      h('g', DD('sea:O:sailboat-jib'), F(jib, v('seaRose')), F('M12 -118Q34 -80 52 -24L44 -24Q30 -70 10 -110Z', v('sunGlow'), { opacity: 0.45 }), S('M9 -128L22 -30', v('seaWhite'), 0.6, { opacity: 0.7 }), pencil(jib, 1.2, false, 0.5)) +
      h('g', DD('sea:O:sailboat-mainsail'), F(main, v('seaSail')), F(`M-2 -150C-10 -118 -30 -76 -48 -38L-38 -38C-24 -70 -8 -110 -1 -144Z`, v('seaSailShade'), { opacity: 0.6 }),
        F(poly([[-1, -88], [xl(-88), -88], [xl(-70), -70], [-1, -70]]), v('seaRed')),
        S([-128, -106, -56].map(y => `M${f(xl(y) + 1)} ${y}l12 -0.6`).join(''), v('seaWoodLo'), 1.1), pencil(main, 1.2, false, 0.5)) +
      h('g', DD('sea:T:sail-seams'), S(seams, v('seaSailShade'), 0.6)) +
      h('g', DD('sea:O:sailboat-rigging'), F(rect(1, -158, 2.6, 142) + 'M3 -30L-60 -26.8L-60 -25L3 -28Z', v('seaWoodDk')),
        S('M2 -156L63 -18M2 -156L-57 -16M2 -118L-8 -17M2 -118L12 -17M-7 -112H11M-54 -26.5L-50 -16M18 -27L-4 -18M2 -156L-60 -27', v('line'), 0.6),
        F(circ(-52, -21, 1.1) + circ(8, -22.5, 1.1), v('seaDark'))) +
      h('g', DD('sea:O:sailboat-flags'), h('g', { transform: 'translate(3 -158)' }, h('g', { 'data-ref': 'sea-burgee' }, F('M0 0L20 3.6L0 7.2Z', v('seaRed')), F('M0 2.6L10 3.6L0 4.6Z', v('seaWhite')), ink('M0 0L20 3.6L0 7.2Z', 0.6)))) +
      h('g', DD('sea:O:sailboat-flags'), S('M-58 -16L-64 -32', v('seaWoodDk'), 1),
        h('g', { transform: 'translate(-64 -32)' }, h('g', { 'data-ref': 'sea-ensign' }, F(rect(-13, 0, 13, 8.5), v('seaRed')), F(rect(-13, 3.3, 13, 1.9) + rect(-8, 0, 1.9, 8.5), v('seaWhite')), ink(rect(-13, 0, 13, 8.5), 0.6)))) +
      h('g', DD('sea:O:sailboat-crew'),
        F(wrect(R, -40.5, -31, 9, 14, 0.2), v('seaWhite')), F(rect(-40.5, -28.5, 9, 1.4) + rect(-40.5, -25.2, 9, 1.4) + rect(-40.5, -21.9, 9, 1.4), v('seaNavy')),
        F(circ(-36, -35, 3.8), v('seaSkin')), F(circ(-33.8, -35.6, 0.6), v('seaDark')), F('M-40.4 -37.4Q-36 -42.4 -31.6 -37.4Z', v('seaWhite')), F(rect(-40.6, -38.2, 9.2, 1.4), v('seaNavy')), F(circ(-36, -41.8, 1.4), v('seaRed')),
        S('M-37 -26L-48 -21', v('seaWhite'), 2.6), S('M-50 -18.6L-40 -22', v('seaWood'), 1.6), ink(circ(-36, -35, 3.8) + rect(-40.5, -31, 9, 14), 0.6),
        h('g', { transform: 'translate(-33 -28)' }, h('g', { 'data-ref': 'sea-crewArm' }, S('M0 0L6 -8', v('seaWhite'), 2.6), F(circ(6.6, -8.8, 1.5), v('seaSkin'))))) +
      h('g', { ...lampOn, 'data-ref': 'sea-nearlit', visibility: 'hidden' }, F(circ(2, -160, 1.8) + circ(-4, -20.5, 1.3) + circ(4, -20.5, 1.3) + circ(12, -20.5, 1.3), v('lamp')));
    m += wrapObj('near', art);
  }
  // ---- numbered can buoy, bell buoy with gull, pot floats
  const canB = 'M-8 -24H8V-1Q0 2 -8 -1Z';
  m += wrapObj('can', h('g', DD('sea:O:can-buoy'),
    S('M0 -24V-33', v('seaDark'), 1.4), F('M-4.4 -32L0 -40L4.4 -32Z', v('seaDark')),
    F(canB, v('seaRed')), F(rect(-8, -8, 16, 3.4), v('seaWhite')), F(rect(3, -24, 5, 23), v('seaRose'), { opacity: 0.45 }),
    h('g', { fill: 'none', stroke: v('seaWhite'), 'stroke-width': 1.7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, glyphs('3', -2.8, -21.5, 1)),
    pencil(canB, 1, false, 0.4), S('M-14 1q7 -3 14 0q7 3 14 0', v('foam'), 1.4)));
  {
    let lat = 'M-12 -16L-5 -56M12 -16L5 -56M0 -16V-56';
    for (let k = 0; k < 3; k++) { const y0 = -16 - k * 13, y1 = y0 - 13, w0 = 12 - k * 2.3, w1 = 12 - (k + 1) * 2.3; lat += `M${f(-w0)} ${y0}L${f(w1)} ${y1}M${f(w0)} ${y0}L${f(-w1)} ${y1}`; }
    const gullStand = h('g', { transform: 'translate(0 -64)' }, h('g', { 'data-ref': 'sea-buoyGull', ...DD('sea:O:buoy-gull') },
      S('M-1 -1L-2 4M2 -1L2 4', v('seaOrange'), 1), F('M-9 -6C-9 -12 -2 -14 3 -12C6 -16 11 -16 12 -12C13 -10 12 -8 10 -7C8 -2 2 0 -3 -1C-7 -2 -11 -2 -14 -4Z', v('seaWhite')),
      F('M-10 -7C-6 -11 2 -11 6 -8C2 -5 -4 -4 -10 -5Z', v('cloudShade')), F('M-14 -4L-9 -6L-10 -4Z', v('seaDark')), F('M12 -13l5 1.4l-5 1.2Z', v('seaYellow')), F(circ(9.4, -13, 0.8), v('seaDark')),
      ink('M-9 -6C-9 -12 -2 -14 3 -12C6 -16 11 -16 12 -12C13 -10 12 -8 10 -7C8 -2 2 0 -3 -1C-7 -2 -11 -2 -14 -4Z', 0.7)));
    const flt = 'M-18 -6Q-18 -16 0 -18Q18 -16 18 -6L14 2L-14 2Z';
    m += wrapObj('bell', h('g', DD('sea:O:bell-buoy'),
      S('M-18 1q9 -4 18 0q9 4 18 0M-24 5q12 -3 24 0q12 3 24 0', v('foam'), 1.4),
      F(flt, v('seaRed')), F('M-17.6 -10L17.6 -10L17.9 -6.6L-17.9 -6.6Z', v('seaWhite')), F('M6 -16Q16 -14 17 -8L14 2L8 2Z', v('seaRose'), { opacity: 0.4 }), pencil(flt, 1, false, 0.4),
      S(lat, v('seaCream'), 1.6), S(lat, v('lineSoft'), 0.4, { transform: 'translate(0.6 0.4)' }), F(rect(-7, -59, 14, 3), v('seaCream')), F(rect(-3.5, -64, 7, 5), v('seaDark')), F(rect(-2, -63, 4, 3), v('lamp')),
      h('g', { transform: 'translate(0 -48)' }, h('g', { 'data-ref': 'sea-bell' }, S('M0 0V3', v('seaDark'), 1), F('M-5.4 13Q-5.4 3 0 2.4Q5.4 3 5.4 13L7 15L-7 15Z', v('seaYellow')), F('M-3.6 12Q-3.4 5 -0.6 4L0.4 4.2Q-2 6 -2 12Z', v('seaWhite'), { opacity: 0.7 }), ink('M-5.4 13Q-5.4 3 0 2.4Q5.4 3 5.4 13L7 15L-7 15Z', 0.6), F(circ(0, 16.6, 1.6), v('seaDark')))),
      h('circle', { cy: -61.5, r: 10, fill: 'url(#sea-glowG)', ...lampOn, 'data-ref': 'sea-bellglow', visibility: 'hidden' })) + gullStand);
  }
  m += wrapObj('pots', h('g', DD('sea:O:pot-floats'),
    S('M-24 0V-14M2 0V-12M24 0V-16', v('seaDark'), 1), F('M-24 -14l7 2l-7 2ZM2 -12l7 2l-7 2ZM24 -16l7 2l-7 2Z', v('seaYellow')),
    F(ell(-24, 0, 3.4, 2.6) + ell(24, 0, 3.4, 2.6), v('seaOrange')), F(ell(2, 0, 3.4, 2.6), v('seaTeal')), F(ell(-25, -1, 1.2, 0.8) + ell(1, -1, 1.2, 0.8) + ell(23, -1, 1.2, 0.8), v('seaWhite'), { opacity: 0.7 }),
    ink(ell(-24, 0, 3.4, 2.6) + ell(24, 0, 3.4, 2.6) + ell(2, 0, 3.4, 2.6), 0.6), S('M-30 3q6 -2 12 0M-4 3q6 -2 12 0M18 3q6 -2 12 0', v('foam'), 1.1)));
  // ---- message in a bottle (a little egg bobbing past)
  m += wrapObj('bottle', h('g', DD('sea:O:message-bottle'),
    h('g', { transform: 'rotate(-18)' }, F('M-9 -3.6Q-9 -5.4 -6 -5.4H4Q6 -5.4 7.4 -3.2H11V1.2H7.4Q6 3.4 4 3.4H-6Q-9 3.4 -9 1.6Z', v('seaGlass'), { opacity: 0.8 }),
      F(rect(-5.6, -2.6, 8.6, 3.6), v('seaCream')), S('M-4.6 -1.4h6.6M-4.6 0h5', v('lineSoft'), 0.35), F(rect(11, -2.2, 2.6, 2.8), v('seaWood')), F('M-7 -4.2h9', 'none', { stroke: v('seaWhite'), 'stroke-width': 0.8, opacity: 0.8 }),
      ink('M-9 -3.6Q-9 -5.4 -6 -5.4H4Q6 -5.4 7.4 -3.2H11V1.2H7.4Q6 3.4 4 3.4H-6Q-9 3.4 -9 1.6Z', 0.6)),
    S('M-14 2.6q7 -2.4 14 0q7 2.4 14 0', v('foam'), 1.2)));
  // ---- dolphin (leaps along an arc), splashes, fish, seal head
  const dBody = 'M-32 0C-24 -7 -4 -11 14 -9C24 -8 30 -5 34 -2L41 -1L34 1C26 4 12 6 -4 5C-16 4 -26 3 -32 0Z', dFin = 'M-2 -10L-11 -20L7 -9Z', dTail = 'M-30 0L-43 -9L-38 0L-43 9Z';
  const dolphin = h('g', { 'data-ref': 'sea-dolph' }, h('g', DD('sea:O:dolphin'),
    F(dBody + dFin + dTail, v('seaDolphin')), F('M-26 -1C-12 -7 8 -9 26 -5C12 -5 -8 -3 -26 1Z', v('seaDolphinLo'), { opacity: 0.8 }),
    F('M-20 3C-6 5 14 5 31 1L29 3C12 7 -6 6 -20 4.5Z', v('seaBelly')), F('M10 4L4 11L16 5Z', v('seaDolphinLo')),
    F(circ(26.5, -3.2, 1.3), v('seaDark')), F(circ(26.9, -3.6, 0.45), v('seaWhite')), S('M31 0.4Q33.6 0.8 36 -0.4', v('line'), 0.5),
    S('M4 -8.4C14 -8.4 22 -6.4 29 -3.8', v('rim'), 0.9), pencil(dBody + dFin + dTail, 1.1, false, 0.4)));
  const splash = k => h('g', { 'data-ref': 'sea-spl' + k, visibility: 'hidden' },
    F('M-10 0Q-8 -8 -5 -12Q-5 -5 -3 0ZM-2 0Q0 -14 2 -18Q3 -8 4 0ZM5 0Q8 -9 12 -11Q10 -4 9 0Z', v('foam')), F(circ(-6, -15, 1) + circ(3, -21, 1.2) + circ(12, -14, 0.9), v('foam')),
    S('M-18 2q9 -3 18 0q9 3 18 0', v('foam'), 1.4));
  m += wrapObj('dolphin', h('g', DD('sea:O:splash'), splash(0), splash(1)) + dolphin);
  const fish = k => h('g', { 'data-ref': 'sea-fish' + k, visibility: 'hidden' },
    F('M-7 0C-4 -3.4 3 -3.6 6 -0.6L9 -3L8.6 0L9 3L6 0.6C3 3.6 -4 3.4 -7 0Z', v(k ? 'seaYellow' : 'seaOrange')), S('M-5 0.8C-1 1.8 3 1.4 5 0.4', v('seaWhite'), 0.8), S('M-1 -2.4q1 1.2 0 2.6M1.6 -2.4q1 1.2 0 2.6', v('seaRedLo'), 0.4),
    F(circ(-4.2, -0.8, 0.8), v('seaDark')), ink('M-7 0C-4 -3.4 3 -3.6 6 -0.6L9 -3L8.6 0L9 3L6 0.6C3 3.6 -4 3.4 -7 0Z', 0.5));
  m += wrapObj('fish', h('g', DD('sea:O:jumping-fish'), fish(0), fish(1)) + h('g', { 'data-ref': 'sea-fishRing', visibility: 'hidden' }, S('M-10 1q10 -3 20 0', v('foam'), 1.2), F(circ(-6, -3, 0.8) + circ(5, -4, 0.7), v('foam'))));
  defs += h('clipPath', { id: 'sea-sealclip' }, F(rect(-30, -40, 60, 40.5), '#000'));
  m += wrapObj('sealhead', h('g', DD('sea:O:seal-head'),
    h('g', { 'clip-path': 'url(#sea-sealclip)' }, h('g', { 'data-ref': 'sea-sealUp' },
      F('M-9 6C-10 -6 -7 -15 0 -16C7 -15 10 -6 9 6Z', v('seaSeal')), F('M3 -14C7 -12 9 -6 9 6L5 6C6 -4 5 -10 3 -14Z', v('seaSealLo'), { opacity: 0.6 }),
      F(ell(0, -8, 4.6, 3.2), v('seaBelly')), F(ell(0, -10.2, 1.6, 1.1), v('seaDark')), F(circ(-3.4, -12.6, 1.1) + circ(3.4, -12.6, 1.1), v('seaDark')), F(circ(-3, -13, 0.4) + circ(3.8, -13, 0.4), v('seaWhite')),
      S('M2.6 -8.4l7 -1.4M2.6 -7.4l7 0.6M-2.6 -8.4l-7 -1.4M-2.6 -7.4l-7 0.6', v('seaWhite'), 0.4), ink('M-9 6C-10 -6 -7 -15 0 -16C7 -15 10 -6 9 6', 0.8))),
    S('M-14 1q7 -3 14 0q7 3 14 0M-20 5q10 -2.6 20 0q10 2.6 20 0', v('foam'), 1.3)));
  // (journey easter egg) a whale off the old fort: back, flukes and a spout that blows every few seconds
  const wB = 'M-60 0Q-50 -22 -6 -24Q30 -24 44 -6L52 0Z', wF = 'M70 -4Q76 -22 92 -26Q84 -14 88 -4Q80 -10 70 -4Z';
  m += h('g', { 'data-ref': 'sea-whale', visibility: 'hidden', ...DD('sea:O:whale') },
    F(wB + wF, v('seaDolphinLo')) + F('M-44 -8Q-20 -18 20 -16', 'none', { stroke: v('seaDolphin'), 'stroke-width': 1.6 }) + F('M-30 -21l6 -6l4 5z', v('seaDolphinLo')) +
    F(circ(-10, -18, 1) + circ(-4, -20, 0.8) + circ(4, -19, 1.1) + circ(10, -21, 0.7), v('seaCream'), { opacity: 0.8 }) + pencil(wB + wF, 1.2) +
    S('M-66 1q30 -4 60 0t60 0t40 0', v('foam'), 1.6) +
    h('g', { 'data-ref': 'sea-spout', transform: 'translate(-14 -24)' }, S('M0 0V-26M0 -20q-10 -8 -16 -4M0 -20q10 -8 16 -4M0 -12q-8 -4 -12 0M0 -12q8 -4 12 0', v('foam'), 2.2) +
      F('M-3 -30a3 3 0 0 1 6 0zM-18 -24a2.4 2.4 0 0 1 4.8 0zM13 -24a2.4 2.4 0 0 1 4.8 0z', v('foam'))));
  return { markup: m, defs };
}

// ---------------------------------------------------------------------------------------------- detail catalogue
export const detailItems = [
  // far hills
  ['sea:T:aerial-haze', 'T', 'aerial perspective: a warm haze glazed over sky, hills, cape and sea, strongest at the horizon'],
  ['sea:T:flat-brush-drag', 'T', 'flat-brush drag texture over the sea wash: pale horizontal lifts and dark pooled strokes'],
  ['sea:O:far-ridge', 'O', 'soft mauve mountain ranges with warm light dabs above and cool glazes pooling at the foot'],
  ['sea:O:ridge-rim', 'O', 'thin warm rim of light along every ridge crest'],
  ['sea:O:foothills', 'O', 'hazy sage foothills in front of the ranges'],
  ['sea:T:olive-groves', 'T', 'rows of little round olive trees and terrace lines following the contours'],
  ['sea:O:cypresses', 'O', 'flame-shaped cypresses with a sunlit edge'],
  ['sea:O:hill-chapel', 'O', 'whitewashed chapel with a blue dome and bell tower'],
  ['sea:O:far-village', 'O', 'hill village of pastel cubes with terracotta roofs and windows'],
  ['sea:O:far-island', 'O', 'low far island with a little striped tower, set against the sun'],
  ['sea:O:castle-ruin', 'O', 'stone castle ruin on the third range'],
  // lighthouse cape
  ['sea:O:cape', 'O', 'the headland: warm sandstone cliff with sunlit faces, painted grass mantle and ink outline'],
  ['sea:T:cliff-strata', 'T', 'dry-brush strata, fissures and fallen boulders on the cliff'],
  ['sea:O:cape-path', 'O', 'dotted footpath zig-zagging up the cape'],
  ['sea:O:cape-flowers', 'O', 'wildflowers dotted over the grass'],
  ['sea:O:cape-sheep', 'O', 'three woolly sheep grazing on the slope'],
  ['sea:O:cape-fence', 'O', 'white picket fence along the cliff edge'],
  ['sea:O:keeper-house', 'O', "keeper's cottage: cream walls, red tiled roof, chimney, windows with flower boxes, teal door"],
  ['sea:O:keeper-smoke', 'O', 'a lazy curl of chimney smoke'],
  ['sea:O:keeper-laundry', 'O', 'washing line with a red shirt, a sheet and a sock'],
  ['sea:O:lighthouse-keeper', 'O', 'the bearded lighthouse keeper in a navy coat (waves back when the pelican waves)'],
  ['sea:O:signal-mast', 'O', 'coastguard signal mast with yard and signal flags'],
  ['sea:O:lighthouse-tower', 'O', 'tapered cream tower with sun glaze, shade side, brush marks and stone plinth'],
  ['sea:O:lighthouse-stripes', 'O', 'three scarf-red bands with shade and light sides'],
  ['sea:O:lighthouse-windows', 'O', 'slit windows with sills and the arched teal door'],
  ['sea:O:lighthouse-gallery', 'O', 'gallery deck with corbels and railing'],
  ['sea:O:lantern-glow', 'O', 'soft golden glow round the lantern'],
  ['sea:O:lighthouse-lantern', 'O', 'glazed lantern room with astragals and the glowing lens'],
  ['sea:O:lighthouse-dome', 'O', 'red dome, ball vent and weather-vane'],
  ['sea:O:lighthouse-beam', 'O', 'soft sweeping beam + lantern glow (night only)'],
  // sea surface
  ['sea:O:sea-wash', 'O', 'painted wash from the lavender horizon to the deep bay'],
  ['sea:T:painted-streaks', 'T', 'long horizontal flat-brush streaks in three depths'],
  ['sea:O:horizon-glow', 'O', 'warm horizon glow line and glare dashes'],
  ['sea:T:far-ripples', 'T', 'tiny light ripple lenses near the horizon'],
  ['sea:T:wave-strokes', 'T', 'two-tone painted wave strokes (light crests) rolling at their own depth'],
  ['sea:T:wave-troughs', 'T', 'dark painted troughs under the crests'],
  ['sea:O:wave-curls', 'O', 'a few slow little curling crests'],
  ['sea:T:swell-lines', 'T', 'long thin dry-brush swell lines'],
  ['sea:T:near-wave-strokes', 'T', 'broad near wave strokes'],
  ['sea:O:whitecaps', 'O', 'breaking whitecaps with round spray drops'],
  ['sea:O:sun-sheen', 'O', 'soft warm sheen on the water under the sun'],
  ['sea:O:sun-glitter', 'O', 'glitter path of lens-shaped light dabs, swaying'],
  ['sea:O:glitter-sparkles', 'O', 'four-point sparkle glints in the glitter path'],
  ['sea:O:moon-glitter', 'O', 'moon glitter path and sheen (night)'],
  // harbour town
  ['sea:O:town-hill', 'O', 'sunny green harbour hill with a light rim'],
  ['sea:T:town-hill-brush', 'T', 'grass-tuft texture and shade dabs on the hill'],
  ['sea:O:houses-cubes', 'O', 'hillside row: whitewashed cubes with parapets, blue domes and arched windows'],
  ['sea:O:houses-gabled', 'O', 'middle row: pastel gabled houses with terracotta roofs'],
  ['sea:O:houses-tiled', 'O', 'waterfront row: tall pastel townhouses with hipped roofs'],
  ['sea:O:balconies', 'O', 'balcony railings with flower pots'],
  ['sea:O:town-windows', 'O', 'windows and arched doors in many colours'],
  ['sea:O:shutters', 'O', 'coloured shutters (teal, red, navy, green) per house'],
  ['sea:O:window-flowers', 'O', 'flower boxes under the windows'],
  ['sea:O:chimneys', 'O', 'chimney stacks'],
  ['sea:O:town-laundry', 'O', 'washing strung between two waterfront houses'],
  ['sea:O:church', 'O', 'church nave, bell tower with belfry arches and spire'],
  ['sea:O:church-bell', 'O', 'golden bell in the belfry'],
  ['sea:O:church-clock', 'O', 'clock face with hands'],
  ['sea:O:windmill', 'O', 'cream windmill with a red cap on the hilltop'],
  ['sea:O:windmill-sails', 'O', 'canvas sails on wooden lattice, turning slowly'],
  ['sea:O:town-trees', 'O', 'cypresses and round gouache trees between the houses'],
  ['sea:O:fish-market', 'O', 'fish market building with a tiled roof'],
  ['sea:O:market-awning', 'O', 'red-and-white striped scalloped awning'],
  ['sea:O:fish-crates', 'O', 'wooden crates of silver fish'],
  ['sea:O:quay-wall', 'O', 'quay wall with cream coping and bollards'],
  ['sea:T:quay-stones', 'T', 'hand-drawn stone blocks in the quay'],
  ['sea:O:quay-cat', 'O', 'a black cat sitting on the quay wall'],
  ['sea:O:harbour-mole', 'O', 'stone harbour arm'],
  ['sea:O:harbour-beacon', 'O', 'red-and-white harbour light tower at the end of the mole'],
  ['sea:O:moored-boats', 'O', 'pastel dinghies moored at the quay'],
  ['sea:O:pier-deck', 'O', 'wooden pier deck with railing'],
  ['sea:O:pier-pilings', 'O', 'pilings with cross-bracing'],
  ['sea:O:pier-pavilion', 'O', 'pier pavilion with a striped teal dome, red awning and flag'],
  ['sea:O:pier-lamps', 'O', 'pier lamp posts'],
  ['sea:O:pier-bunting', 'O', 'bunting in five colours strung between the lamps'],
  ['sea:O:pier-anglers', 'O', 'two anglers with bent rods, lines and floats'],
  ['sea:T:harbour-reflections', 'T', 'broken painted reflections of the town in the water'],
  // rocks
  ['sea:O:rocks', 'O', 'rounded gouache rocks with shade sides and ink outlines'],
  ['sea:T:rock-brushwork', 'T', 'light and shade dabs and cracks on the rocks'],
  ['sea:O:rock-rim-light', 'O', 'sunward rim light on the rocks'],
  ['sea:O:seaweed', 'O', 'seaweed hanging at the waterline'],
  ['sea:O:barnacles', 'O', 'barnacle speckles'],
  ['sea:O:sea-stack', 'O', 'tall sea stack with bird-lime streaks'],
  ['sea:O:rock-foam', 'O', 'surging foam collars and spray drops around the rocks'],
  ['sea:O:seal-basking', 'O', 'seal basking on the rock (head bobs), kind eye and whiskers'],
  ['sea:O:cormorants', 'O', 'cormorants on the sea stack with golden throats, one drying its wings'],
  ['sea:O:seal-head', 'O', 'seal that pops its head out of the water'],
  // boats and life on the water
  ['sea:O:steamer', 'O', 'coastal steamer: navy hull, red boot-topping, portholes, cream decks and bridge'],
  ['sea:O:steamer-funnels', 'O', 'raked yellow funnels with red bands and dark tops'],
  ['sea:O:steamer-bunting', 'O', 'dressing lines with coloured signal flags'],
  ['sea:O:steamer-lifeboats', 'O', 'lifeboats on davits'],
  ['sea:O:steamer-smoke', 'O', 'soft smoke puffs drifting astern'],
  ['sea:O:far-sloop', 'O', 'far sloop with cream and rose sails'],
  ['sea:O:red-sail-yawl', 'O', 'far yawl with red lug sails'],
  ['sea:O:trawler', 'O', 'teal fishing boat: numbered hull, wheelhouse, mast'],
  ['sea:T:fishing-net', 'T', 'drying net mesh with orange floats'],
  ['sea:O:fisherman', 'O', 'fisherman in yellow oilskins and sou’wester'],
  ['sea:O:net-gulls', 'O', 'gulls hovering over the net'],
  ['sea:O:rowboat', 'O', 'wooden rowing boat with oars'],
  ['sea:O:rowboat-kid', 'O', 'a child in a red coat fishing, line and float'],
  ['sea:O:rowboat-cat', 'O', 'a black-and-white cat in the bow'],
  ['sea:O:sailboat-hull', 'O', 'near sailboat hull with cream strake and cabin portholes'],
  ['sea:O:sailboat-mainsail', 'O', 'cream mainsail with a red panel and battens'],
  ['sea:T:sail-seams', 'T', 'sail-cloth seams'],
  ['sea:O:sailboat-jib', 'O', 'rose jib catching the light'],
  ['sea:O:sailboat-rigging', 'O', 'forestay, backstay, shrouds, sheets, spreaders'],
  ['sea:O:sailboat-flags', 'O', 'fluttering burgee and ensign'],
  ['sea:O:sailboat-crew', 'O', 'sailor in a Breton shirt and pompom cap at the tiller'],
  ['sea:O:lifebuoy', 'O', 'lifebuoy ring'],
  ['sea:O:boat-wake', 'O', 'bow wave and wake'],
  ['sea:O:bell-buoy', 'O', 'bell buoy: red float, cream lattice cage, swinging golden bell, lamp'],
  ['sea:O:buoy-gull', 'O', 'gull perched on the bell buoy'],
  ['sea:O:can-buoy', 'O', 'numbered can buoy with topmark'],
  ['sea:O:pot-floats', 'O', 'lobster-pot floats with flags'],
  ['sea:O:message-bottle', 'O', 'a message in a bottle bobbing past'],
  ['sea:O:dolphin', 'O', 'leaping dolphin with a smile'],
  ['sea:O:splash', 'O', 'splash crowns and rings'],
  ['sea:O:jumping-fish', 'O', 'fish jumping in the glitter'],
  ['sea:O:whale', 'O', 'a whale off the old fort, blowing (journey egg)'],
].map(([key, kind, what]) => ({ id: key.split(':')[2], layer: 'sea', kind, what, key }));

// ---------------------------------------------------------------------------------------------- attach
// composited strips (see core/sheets.js): far panorama, headland, the four rolling sea bands, harbour and rocks move by
// a pure translate every frame; the runtime moves each one as its own compositor layer instead of repainting it
export const isolate = ['[data-ref="sea-aerial"]'];
export const sheets = ['hills', 'cape', 'wash', 'w0', 'w1', 'w2', 'w3', 'sunG', 'moonG', 'harbour', 'rocks'].map(k => `[data-ref="sea-${k}"]`);
export function attach(svg, ctx) {
  const r = refs(svg, 'sea-');
  const st = new WeakMap();
  const set = (el, k, val) => {
    if (!el) return;
    let m = st.get(el); if (!m) st.set(el, (m = {}));
    if (m[k] !== val) { m[k] = val; el.setAttribute(k, val); }
  };
  const vis = (el, on) => set(el, 'visibility', on ? 'visible' : 'hidden');
  const obj = Object.fromEntries(Object.keys(BOATS).map(k => [k, r['o-' + k]]));
  const since = (fr, type) => { let best = Infinity; for (const e of fr.events || []) if (e.type === type && fr.t >= e.t0) best = Math.min(best, fr.t - e.t0); return best; };
  return {
    update(fr) {
      const t = fr.t, D = fr.distance || 0, red = fr.reduced || ctx.reduced;
      const cam = fr.cam || { fx: 800 };
      const lampOn = fr.pal && fr.pal.num ? fr.pal.num.lampOn : fr.night || 0;
      const nightK = fr.pal && fr.pal.num ? fr.pal.num.night : fr.night || 0;
      // ---- far layers
      set(r.hills, 'transform', `translate(${f(-(wrap((D - D0) * 0.05 + 2600, W_H) - 2600))} 0)`);
      const cx = clamp(routeX(D, ANCH.cape, LH.d), -6000, 6000);
      set(r.cape, 'transform', `translate(${f(cx)} 0)`);
      const night = lampOn > 0.02, dim = nightK > 0.02;
      vis(r.lhnight, night); vis(r.keeperlit, night); vis(r.townlit, night); vis(r.pierglow, night); vis(r['glow-beacon'], night);
      vis(r.steamlit, night); vis(r.trawlit, night); vis(r.nearlit, night); vis(r.bellglow, night);
      vis(r.capeveil, dim); vis(r.townveil, dim);
      if (night) {
        const th = red ? 0.35 : t * (Math.PI * 2 / 9);     // calm: one slow sweep every 9 s
        const c = Math.cos(th);
        r.beamRot.setAttribute('transform', `scale(${f(c)} 1)`);
        const flash = Math.max(0, 1 - Math.abs(c) * 3);
        r.lantern.setAttribute('transform', `scale(${f(0.7 + flash * 1.2)})`);
      }
      // the keeper waves back when the pelican waves (only while the cape is on screen)
      if (cx > -1300 && cx < 900) {
        const wv = since(fr, 'wave'), u = wv < 3.2 && !red ? Math.sin(Math.min(1, (wv - 0.3) / 0.35) * Math.PI / 2) * (1 - smooth01((wv - 2.6) / 0.6)) : 0;
        set(r.keeperArm, 'transform', `rotate(${f(u > 0 ? 8 - u * (160 + Math.sin(wv * 10) * 18) : 8)})`);
      }
      // ---- sea bands roll: each band scrolls at its own depth and bobs a little (slow, calm)
      for (let i = 0; i < BANDS.length; i++) {
        const [d, W] = BANDS[i];
        const bob = red ? 0 : Math.sin(t * (0.7 + i * 0.17) + i * 1.7) * (0.4 + i * 0.3);
        const drift = red ? 0 : t * (2.5 + i * 1.5);
        set(r['w' + i], 'transform', `translate(${f(-wrap(D * d + drift, W))} ${f(bob)})`);
      }
      // ---- glitter paths
      const sun = fr.sun || { x: 1465, elev: 0.3 }, moon = fr.moon || { x: 500, elev: -1 };
      const sunOn = sun.elev > -0.24;
      vis(r.sunG, sunOn);
      if (sunOn) {
        const gx = sun.x + (cam.fx - 800) * 0.1, len = clamp(0.45 + Math.abs(sun.elev - 0.1) * 1.4, 0.45, 1);
        set(r.sunG, 'transform', `translate(${f(gx)} ${HZ}) scale(${f(0.9 + 0.4 * (1 - len))} ${f(len)}) translate(0 ${-HZ})`);
        for (let k = 0; k < 3; k++) set(r['sg' + k], 'transform', `translate(${red ? 0 : f(Math.sin(t * (0.9 + k * 0.3) + k * 2.1) * 4)} 0)`);
        for (let k = 0; k < 3; k++) { const p = red ? 0.8 : Math.max(0, Math.sin(t * (1.2 + k * 0.4) + k * 1.9)); set(r['spk' + k], 'transform', `scale(${f(p)})`); }
      }
      const moonOn = moon.elev > 0.02 && lampOn > 0.2;
      vis(r.moonG, moonOn);
      if (moonOn) {
        set(r.moonG, 'transform', `translate(${f(moon.x + (cam.fx - 800) * 0.1)} 0)`);
        for (let k = 0; k < 3; k++) set(r['mg' + k], 'transform', `translate(${red ? 0 : f(Math.sin(t * (0.8 + k * 0.4) + k) * 3.5)} 0)`);
      }
      // ---- harbour + rocks
      const hx = clamp(routeX(D, ANCH.harbour, HB.d), -6000, 6000);
      set(r.harbour, 'transform', `translate(${f(hx)} 0)`);
      if (hx > -900 && hx < 1700) set(r.millSails, 'transform', `rotate(${f(red ? 20 : wrap(t * 24, 360))})`);
      const rx = clamp(routeX(D, ANCH.rocks, RK.d), -6000, 6000);
      set(r.rocks, 'transform', `translate(${f(rx)} -16)`);
      if (!red && rx > -800 && rx < 1700) {
        set(r.foam, 'transform', `translate(0 ${f(Math.sin(t * 1.6) * 1.2)})`);
        set(r.sealHead, 'transform', `rotate(${f(Math.sin(t * 0.8) * 6 - 2)})`);
      }
      // ---- boats and buoys
      for (const [k, B] of Object.entries(BOATS)) {
        const el = obj[k]; if (!el) continue;
        const d = depthAt(B.y), x = place(t, D, B.x, d, B.vx, B.e + 400, B.S);
        // each pass of a boat is a different day on the water: seeded by its wrap cycle, thinned by the stretch
        const cyc = Math.floor((B.x + B.vx * (t - T0) - (D - D0) * d + B.e + 400) / B.S), cyc0 = Math.floor((B.x + B.e + 400) / B.S);
        const busy = { harbour: 0.05, village: 0.2, return: 0.2, pier: 0.25, funfair: 0.3, cliffs: 0.6, lighthouse: 0.5, dunes: 0.45 }[stretchAt(D).key] ?? 0.4;
        const here = cyc === cyc0 || hash(cyc, k.length * 7 + B.x) > (k === 'bottle' ? 0.8 : busy);
        if (el.__here !== here) { el.__here = here; el.setAttribute('visibility', here ? 'visible' : 'hidden'); }
        if (!here) continue;
        const w = 0.8 + (B.y - 470) * 0.004, ph = B.x * 0.013;
        const bob = red ? 0 : Math.sin(t * w * 1.4 + ph) * (0.6 + B.s * 1.3);
        const rot = red ? 0 : Math.sin(t * w * 0.9 + ph) * (k === 'near' ? 2 : k === 'bell' || k === 'can' || k === 'bottle' ? 4 : 1.3);
        const on = x > -B.e - 60 && x < 1600 + B.e + 60;
        if (k === 'dolphin' || k === 'fish' || k === 'sealhead') { set(el, 'transform', `translate(${f(x)} ${B.y})`); continue; }
        set(el, 'transform', `translate(${f(x)} ${f(B.y + bob)}) rotate(${f(rot)}) scale(${B.s})`);
        if (!on) continue;
        if (k === 'steamer') for (let i = 0; i < 5; i++) {
          const u = wrap(t / 4.2 + i / 5, 1);
          set(r['smoke' + i], 'transform', `translate(${f(17 + u * 58)} ${f(-38 - u * 20 - Math.sin(u * 5) * 2)}) scale(${f(0.35 + u * 1.25)})`);
          set(r['smoke' + i], 'opacity', f(u < 0.75 ? 1 : (1 - u) * 4));
        }
        if (k === 'near' && !red) {
          const fl = Math.sin(t * 7) * 0.1;
          set(r.burgee, 'transform', `scale(${f(1 + fl)} ${f(1 - fl * 0.6)})`);
          set(r.ensign, 'transform', `skewY(${f(Math.sin(t * 6 + 1) * 6)}) scale(${f(1 + Math.sin(t * 8) * 0.05)} 1)`);
          const wv = since(fr, 'wave'), wa = wv < 3 ? Math.sin(Math.min(1, wv / 0.3) * Math.PI / 2) * (1 - smooth01((wv - 2.4) / 0.6)) : 0;
          set(r.crewArm, 'transform', `rotate(${f(wa ? wa * (-40 + Math.sin(wv * 12) * 16) : 0)})`);
        }
        if (k === 'trawler' && !red) {
          set(r.gA, 'transform', `scale(1 ${f(0.7 + 0.5 * Math.sin(t * 5))})`);
          set(r.gB, 'transform', `scale(1 ${f(0.7 + 0.5 * Math.sin(t * 4.4 + 2))})`);
        }
        if (k === 'bell') {
          const be = since(fr, 'bell'), ring = be < 2.5 ? 22 * Math.exp(-be * 1.6) * Math.sin(be * 14) : 0;
          set(r.bell, 'transform', `rotate(${f(red ? 0 : ring + Math.sin(t * 1.8) * 6)})`);
          const hop = Math.min(since(fr, 'bell'), since(fr, 'hop'));
          const hy = hop < 0.6 && !red ? -Math.sin(hop / 0.6 * Math.PI) * 7 : 0;
          set(r.buoyGull, 'transform', `translate(0 ${f(hy)})`);
        }
      }
      // whale (journey easter egg, off the old fort)
      {
        const wx = routeX(D, [20.5 * KM], 0.12) + 1060, on = wx > -200 && wx < 1800;
        vis(r.whale, on);
        if (on) {
          set(r.whale, 'transform', `translate(${f(wx)} ${f(548 + (red ? 0 : Math.sin(t * 0.8) * 1.5))})`);
          const ph = wrap(t, 5.2), sp = red ? 0.8 : ph < 1.4 ? Math.sin(ph / 1.4 * Math.PI) : 0;
          set(r.spout, 'transform', `translate(-14 -24) scale(${f(0.2 + sp)} ${f(sp)})`);
        }
      }
      // dolphin leap: every 12 s, 1.3 s arc (one is mid-air in the hero frame)
      {
        const P = 12, dur = 1.3, ph = wrap(t - (T0 - 0.62), P), cy = Math.floor((t - (T0 - 0.62)) / P), up = !red && ph < dur && (cy === 0 || hash(cy, 5) < 0.6);
        vis(r.dolph, up);
        if (up) {
          const u = ph / dur, x = (u - 0.5) * 120, y = -58 * Math.sin(Math.PI * u) + 6;
          const ang = Math.atan2(-58 * Math.PI * Math.cos(Math.PI * u) / dur, 120 / dur) / D2R;
          set(r.dolph, 'transform', `translate(${f(x)} ${f(y)}) rotate(${f(ang)})`);
        }
        const s0 = !red && ph < dur * 0.3, s1 = !red && ph > dur * 0.72 && ph < dur + 0.5;
        vis(r.spl0, s0); vis(r.spl1, s1);
        if (s0) set(r.spl0, 'transform', `translate(-58 0) scale(${f(0.5 + ph / (dur * 0.3) * 0.7)})`);
        if (s1) set(r.spl1, 'transform', `translate(58 0) scale(${f(0.4 + clamp((ph - dur * 0.72) / 0.6, 0, 1) * 0.9)})`);
      }
      // jumping fish (two, offset)
      for (let k = 0; k < 2; k++) {
        const P = 4.3 + k * 1.9, dur = 0.7, ph = wrap(t - (T0 - 0.3) + k * 2.2, P), up = !red && ph < dur;
        vis(r['fish' + k], up);
        if (up) { const u = ph / dur; set(r['fish' + k], 'transform', `translate(${f(k * 34 + (u - 0.5) * 30)} ${f(-24 * Math.sin(Math.PI * u) - k * 6)}) rotate(${f(-50 + 100 * u)})`); }
        if (k === 0) vis(r.fishRing, !red && ph < dur + 0.6);
      }
      // seal head: pops up every 9 s for ~3.4 s
      {
        const P = 9, ph = wrap(t - (T0 - 1.6), P), u = clamp(Math.min(ph / 0.5, (3.4 - ph) / 0.5), 0, 1);
        set(r.sealUp, 'transform', `translate(0 ${f(red ? 0 : (1 - u) * 18 + Math.sin(t * 1.4) * 0.8)})`);
      }
    },
  };
}
const smooth01 = x => { const u = clamp(x, 0, 1); return u * u * (3 - 2 * u); };
