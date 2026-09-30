// OWNER: sea. Layers L-hills-far (0.05), L-lighthouse (0.07), L-sea (0.10), L-boats (0.12).
// Style C (docs/STYLE-C.md): a screen-printed coast. Far layers are big flat shapes with a little halftone; the sea is
// stacked ink bands with static halftone seams, rolling wave-line bands (each band scrolls at its own depth), whitecaps
// and a sun / moon glitter path; the harbour town, the lighthouse cape, rocks and boats carry the fine detail.
// Design coordinates = the hero frame (t = 3.2 s at 60 rpm): every object is drawn where it sits in that frame and is
// scrolled by (distance − D0)·depth, wrapped over its own span. Everything is static markup built once; per frame we
// only write transforms (and a few visibility flags).
import { h, refs } from '../core/svg.js';
import { HORIZON_Y, DIST_PER_REV } from '../contract.js';
import { LAP, KM, stretchAt, relTo, hash } from './route.js';

export const id = 'sea';

// ---------------------------------------------------------------------------------------------- helpers
const f = x => { const r = Math.round(x * 100) / 100; return (r === 0 ? 0 : r).toString(); };
const f1 = x => (Math.round(x * 10) / 10).toString();
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const wrap = (x, m) => ((x % m) + m) % m;
const D2R = Math.PI / 180;
const circ = (x, y, r) => `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
const ell = (x, y, rx, ry) => `M${f(x - rx)} ${f(y)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0Z`;
const rect = (x, y, w, hh) => `M${f(x)} ${f(y)}h${f(w)}v${f(hh)}h${f(-w)}Z`;
const poly = pts => 'M' + pts.map(p => f(p[0]) + ' ' + f(p[1])).join('L') + 'Z';
const line = pts => 'M' + pts.map(p => f(p[0]) + ' ' + f(p[1])).join('L');
// Catmull-Rom-ish smoothing (from the draft)
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
// Halftone: round-capped zero-length strokes on a hex grid, radii quantised into bins (one <path> per bin).
function dots(R, x0, x1, y0, y1, r0, r1, s, stroke, o = {}) {
  const { jitter = 0, clip, rfn, q = 0.5 } = o;
  const bins = new Map(), dy = s * 0.866;
  for (let j = 0, y = y0; y <= y1 + 0.01; j++, y = y0 + j * dy) {
    const tr = (y - y0) / (y1 - y0 || 1);
    for (let x = x0 + (j % 2 ? s / 2 : 0); x <= x1; x += s) {
      const xx = x + (R() - 0.5) * jitter;
      if (clip && !clip(xx, y)) continue;
      const r = rfn ? rfn(xx, y) : lerp(r0, r1, tr);
      if (r < 0.3) continue;
      const k = Math.round(r / q) * q;
      if (!bins.has(k)) bins.set(k, []);
      bins.get(k).push(`M${f1(xx)} ${f1(y)}h0`);
    }
  }
  return [...bins].map(([k, a]) => h('path', { d: a.join(''), stroke, 'stroke-width': f(k * 2), 'stroke-linecap': 'round', fill: 'none' })).join('');
}
const DD = key => ({ 'data-detail': key });
// split a multi-subpath d into x-buckets (so the renderer can cull off-screen pieces of long scrolling tiles)
const chunks = (d, size = 520) => {
  const out = new Map();
  for (const sp of d.split(/(?=M)/)) { if (!sp) continue; const x = parseFloat(sp.slice(1)); const k = Math.floor(x / size); out.set(k, (out.get(k) || '') + sp); }
  return [...out.values()];
};
const S = (d, stroke, w, extra = {}) => h('path', { d, fill: 'none', stroke, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...extra });
const F = (d, fill, extra = {}) => h('path', { d, fill, ...extra });
// tiny stroke glyphs (box 6×10) for hull numbers / buoy numbers
const GLYPH = {
  3: 'M0 0H6L2.6 4Q6 4 6 7Q6 10 3 10Q0.6 10 0 8.4',
  7: 'M0 0H6L2 10',
  P: 'M0 10V0H3.4Q6 0 6 2.7Q6 5.4 3.4 5.4H0',
  B: 'M0 0V10H3.8Q6 10 6 7.6Q6 5.2 3.6 5.2H0M0 0H3.3Q5.6 0 5.6 2.6Q5.6 5.2 3.3 5.2',
};
const glyphs = (str, x, y, sc = 1, gap = 8.5) => [...str].map((c, i) => GLYPH[c] ? `<path transform="translate(${f(x + i * gap * sc)} ${f(y)}) scale(${sc})" d="${GLYPH[c]}"/>` : '').join('');

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
// wave-line bands: [depth, tile width (= depth·DIST_PER_REV·k, seamless in whole crank turns)]
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
  near: { x: 1150, y: 580, s: 0.95, vx: 45, S: 3700, e: 110 },
  can: { x: 1372, y: 566, s: 0.75, vx: 0, S: 3300, e: 20 },
  bell: { x: 1036, y: 596, s: 0.8, vx: 0, S: 3500, e: 30 },
  pots: { x: 1512, y: 592, s: 1, vx: 0, S: 3100, e: 30 },
  dolphin: { x: 1335, y: 562, s: 1, vx: 0, S: 3400, e: 90 },
  fish: { x: 1455, y: 596, s: 1, vx: 0, S: 3000, e: 40 },
  sealhead: { x: 380, y: 592, s: 1, vx: 0, S: 3200, e: 30 },
};
const place = (t, D, x0, d, vx, M, Sp) => wrap(x0 + vx * (t - T0) - (D - D0) * d + M, Sp) - M;

export const detailItems = [
  // far hills
  ['sea:O:far-ridge', 'O', 'distant periwinkle mountain ranges along the horizon'],
  ['sea:O:foothills', 'O', 'teal foothills in front of the ranges'],
  ['sea:T:ridge-halftone', 'T', 'dark-ink halftone pooling at the foot of every range'],
  ['sea:T:ridge-light-hatch', 'T', 'light-ink hatch strokes on the sunward slopes (draft motif)'],
  ['sea:T:terraced-fields', 'T', 'contour-stripe terraces on the foothills'],
  ['sea:O:cypresses', 'O', 'flame-shaped cypress silhouettes on the ridge'],
  ['sea:O:hill-chapel', 'O', 'tiny domed chapel on the ridge'],
  ['sea:O:far-village', 'O', 'hill village of paper-white cubes'],
  ['sea:O:far-island', 'O', 'low far island with a tower, set against the sun'],
  ['sea:O:castle-ruin', 'O', 'castle ruin on the third range'],
  // lighthouse cape
  ['sea:O:cape', 'O', 'lighthouse cape: grassy mantle over a sunlit cliff'],
  ['sea:T:cliff-strata', 'T', 'strata lines and dark fissures in the cliff face'],
  ['sea:T:cape-halftone', 'T', 'halftone on the shaded grassy slope'],
  ['sea:O:cape-path', 'O', 'dashed footpath zig-zagging up the cape'],
  ['sea:O:cape-fence', 'O', 'white picket fence along the cliff edge'],
  ['sea:O:lighthouse-tower', 'O', 'tapered paper-white tower with a shade side'],
  ['sea:O:lighthouse-stripes', 'O', 'three vermilion bands'],
  ['sea:O:lighthouse-windows', 'O', 'slit windows and the arched door'],
  ['sea:O:lighthouse-gallery', 'O', 'gallery deck with corbels and railing'],
  ['sea:O:lighthouse-lantern', 'O', 'glazed lantern room with astragals and the Fresnel lens'],
  ['sea:O:lighthouse-dome', 'O', 'dome, ball vent and weather-vane'],
  ['sea:O:keeper-house', 'O', "keeper's cottage with hipped roof, chimney, windows and door"],
  ['sea:O:signal-mast', 'O', 'coastguard signal mast with yard and signal flags'],
  ['sea:O:lighthouse-beam', 'O', 'rotating beam + quantised lantern glow (night only)'],
  // sea surface
  ['sea:O:horizon-line', 'O', 'dark horizon hairline + light glare dashes'],
  ['sea:O:band-far', 'O', 'far sea band'],
  ['sea:T:band-halftone', 'T', 'halftone seam from far band to deep band'],
  ['sea:O:band-deep', 'O', 'deep sea band'],
  ['sea:T:swell-halftone', 'T', 'lighter swell band printed as halftone on the deep band'],
  ['sea:T:ripple-ticks', 'T', 'far ripple ticks (light ink)'],
  ['sea:T:wave-ticks-mid', 'T', 'mid wave ticks'],
  ['sea:T:wave-lines', 'T', 'scalloped deco wave-line rows rolling at their own depth'],
  ['sea:O:whitecaps', 'O', 'breaking whitecaps with spray dots'],
  ['sea:O:sun-glitter', 'O', 'sun glitter path in two inks, swaying'],
  ['sea:O:glitter-sparkles', 'O', 'four-point sparkle glints in the glitter path'],
  ['sea:O:moon-glitter', 'O', 'moon glitter path (night)'],
  // harbour town
  ['sea:O:town-hill', 'O', 'harbour hill'],
  ['sea:T:town-hill-halftone', 'T', 'halftone on the lower hill'],
  ['sea:O:houses-cubes', 'O', 'hillside row: flat-roofed white cubes with parapets, little domes and arched windows'],
  ['sea:O:houses-gabled', 'O', 'middle row: paper-white houses with vermilion gables'],
  ['sea:O:houses-tiled', 'O', 'waterfront row: tall peach townhouses with amber hipped roofs and doors'],
  ['sea:O:balconies', 'O', 'balcony railings on the waterfront townhouses'],
  ['sea:O:town-windows', 'O', 'windows, doors and shutters'],
  ['sea:O:chimneys', 'O', 'chimney stacks'],
  ['sea:O:church', 'O', 'church nave, bell tower with belfry arches and spire'],
  ['sea:O:church-clock', 'O', 'clock face with hands'],
  ['sea:O:windmill', 'O', 'windmill tower and cap on the hilltop'],
  ['sea:O:windmill-sails', 'O', 'lattice sails turning slowly'],
  ['sea:O:town-trees', 'O', 'cypresses and round trees between the houses'],
  ['sea:O:fish-market', 'O', 'fish market with striped awning and crates'],
  ['sea:O:quay-wall', 'O', 'quay wall with coping and bollards'],
  ['sea:T:quay-masonry', 'T', 'masonry courses and joints'],
  ['sea:O:harbour-mole', 'O', 'harbour wall arm'],
  ['sea:O:harbour-beacon', 'O', 'striped harbour-light tower at the end of the mole'],
  ['sea:O:moored-boats', 'O', 'dinghies moored at the quay'],
  ['sea:O:pier-deck', 'O', 'pier deck with railing'],
  ['sea:O:pier-pilings', 'O', 'pilings with cross-bracing'],
  ['sea:O:pier-pavilion', 'O', 'domed pier pavilion with awning and flag'],
  ['sea:O:pier-lamps', 'O', 'pier lamp posts'],
  ['sea:O:pier-bunting', 'O', 'bunting strung between the lamps'],
  ['sea:T:harbour-reflections', 'T', 'broken reflections of the town in the water'],
  // rocks
  ['sea:O:rocks', 'O', 'faceted rocks with dark shade facets'],
  ['sea:O:rock-rim-light', 'O', 'sunward rim-light edges on the rocks'],
  ['sea:O:sea-stack', 'O', 'tall sea stack'],
  ['sea:O:rock-foam', 'O', 'surging foam collars and spray around the rocks'],
  ['sea:O:seal-basking', 'O', 'seal basking on the rock (head bobs)'],
  ['sea:O:cormorants', 'O', 'cormorants on the sea stack, one drying its wings'],
  ['sea:O:seal-head', 'O', 'seal that pops its head out of the water'],
  // boats and life on the water
  ['sea:O:steamer', 'O', 'coastal steamer: hull, boot-topping, portholes, deckhouses, bridge'],
  ['sea:O:steamer-funnels', 'O', 'raked funnels with bands'],
  ['sea:O:steamer-bunting', 'O', 'dressing lines with signal flags'],
  ['sea:O:steamer-lifeboats', 'O', 'lifeboats on davits'],
  ['sea:O:steamer-smoke', 'O', 'smoke puffs drifting astern'],
  ['sea:O:far-sloop', 'O', 'far sloop'],
  ['sea:O:red-sail-yawl', 'O', 'far yawl with red lug sails'],
  ['sea:O:trawler', 'O', 'fishing boat: hull with number, wheelhouse, mast'],
  ['sea:T:fishing-net', 'T', 'drying net mesh with floats'],
  ['sea:O:fisherman', 'O', 'fisherman in oilskins and sou’wester'],
  ['sea:O:net-gulls', 'O', 'gulls hovering over the net'],
  ['sea:O:sailboat-hull', 'O', 'near sailboat hull with strake, boot stripe and cabin'],
  ['sea:O:sailboat-mainsail', 'O', 'mainsail with vermilion panel and battens'],
  ['sea:T:sail-seams', 'T', 'sail-cloth seams'],
  ['sea:O:sailboat-jib', 'O', 'jib'],
  ['sea:O:sailboat-rigging', 'O', 'forestay, backstay, shrouds, sheets, spreaders'],
  ['sea:O:sailboat-flags', 'O', 'fluttering burgee and ensign'],
  ['sea:O:sailboat-crew', 'O', 'sailor in a Breton shirt and pompom cap at the tiller'],
  ['sea:O:lifebuoy', 'O', 'lifebuoy ring'],
  ['sea:O:boat-wake', 'O', 'bow wave and wake'],
  ['sea:O:bell-buoy', 'O', 'bell buoy: float, lattice cage, swinging brass bell, lamp'],
  ['sea:O:buoy-gull', 'O', 'gull perched on the bell buoy'],
  ['sea:O:can-buoy', 'O', 'numbered can buoy with topmark'],
  ['sea:O:pot-floats', 'O', 'lobster-pot floats with flags'],
  ['sea:O:dolphin', 'O', 'leaping dolphin'],
  ['sea:O:splash', 'O', 'splash crowns and rings'],
  ['sea:O:jumping-fish', 'O', 'fish jumping in the glitter'],
].map(([key, kind, what]) => ({ id: key.split(':')[2], layer: 'sea', kind, what, key }));

// ---------------------------------------------------------------------------------------------- build
export function build(ctx) {
  const { v, rng } = ctx;
  const I = r => v('ink' + r);
  let defs = '';
  // quantised night glow (3 hard rings) for lamps and the lantern
  defs += h('radialGradient', { id: 'sea-glowG' },
    h('stop', { offset: 0, 'stop-color': v('lampGlow'), 'stop-opacity': 0.55 }), h('stop', { offset: 0.34, 'stop-color': v('lampGlow'), 'stop-opacity': 0.55 }),
    h('stop', { offset: 0.34, 'stop-color': v('lampGlow'), 'stop-opacity': 0.3 }), h('stop', { offset: 0.66, 'stop-color': v('lampGlow'), 'stop-opacity': 0.3 }),
    h('stop', { offset: 0.66, 'stop-color': v('lampGlow'), 'stop-opacity': 0.12 }), h('stop', { offset: 1, 'stop-color': v('lampGlow'), 'stop-opacity': 0.12 }));
  const lampOn = { style: 'opacity:var(--pb-n-lampOn)' };

  const hills = buildHills(v, I, rng);
  const lh = buildLighthouse(v, I, rng, lampOn);
  const seaL = buildSea(v, I, rng, lampOn);
  const boats = buildBoats(v, I, rng, lampOn);
  defs += hills.defs + seaL.defs + boats.defs;
  return {
    defs,
    layers: { 'L-hills-far': hills.markup, 'L-lighthouse': lh, 'L-sea': seaL.markup, 'L-boats': boats.markup },
  };
}

// ============================================================================ L-hills-far: ranges, villages, island
function buildHills(v, I, rng) {
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
  let tile = '';
  const heroN = 3, acc = new Map();   // procedural ranges are merged per 3000 u bucket (few nodes, still culled)
  for (const [gi, g] of ranges.entries()) {
    const far = smooth(g.far, false) + `L${f(g.far[g.far.length - 1][0])} 480L${f(g.far[0][0])} 480Z`;
    const foot = smooth(g.foot, false) + `L${f(g.foot[g.foot.length - 1][0])} 480L${f(g.foot[0][0])} 480Z`;
    // hatch strokes under sunward (descending-to-the-right) ridge segments (the draft's motif)
    let hatch = '';
    for (let i = 1; i < g.far.length; i++) {
      const [a, b] = [g.far[i - 1], g.far[i]];
      if (b[1] - a[1] < 10) continue;
      const dx = b[0] - a[0], dy = b[1] - a[1];
      for (let k = 1; k <= 3; k++) {
        const o = k * 7, u0 = 0.12 + k * 0.1, u1 = 0.92 - k * 0.12;
        hatch += `M${f(a[0] + dx * u0 - 2)} ${f(a[1] + dy * u0 + o)}L${f(a[0] + dx * u1 - 2)} ${f(a[1] + dy * u1 + o)}`;
      }
    }
    // terraces: contour stripes following the foothill line
    let terr = '';
    const [xa, xb] = [g.foot[1][0], g.foot[g.foot.length - 2][0]];
    for (let k = 1; k <= 4; k++) for (let x = xa; x < xb; x += 34 + R() * 20) {
      const len = 18 + R() * 26, y0 = heightAt(g.foot, x) + 3 + k * 4.2, y1 = heightAt(g.foot, x + len) + 3 + k * 4.2;
      if (y0 > 469 || y1 > 469) continue;
      terr += `M${f(x)} ${f(y0)}L${f(x + len)} ${f(y1)}`;
    }
    const dotsS = dots(R, g.foot[0][0], g.foot[g.foot.length - 1][0], 446, 470, 0.4, 1.9, 5, I('N'), { clip: (x, y) => y > heightAt(g.foot, x) + 5 }) +
      dots(R, g.far[0][0], g.far[g.far.length - 1][0], 428, 470, 0.3, 1.6, 5.5, I('N'), { clip: (x, y) => y > heightAt(g.far, x) + 6 && y < heightAt(g.foot, x) - 1 });
    let cyp = '';
    for (let x = g.cyp[0]; x < g.cyp[1]; x += 11 + R() * 16) {
      const yb = heightAt(g.foot, x) + 2, hh = 11 + R() * 9, w = 2.4 + R() * 1.2;
      cyp += `M${f(x)} ${f(yb)}C${f(x - w)} ${f(yb - hh * 0.3)} ${f(x - w * 0.8)} ${f(yb - hh * 0.8)} ${f(x)} ${f(yb - hh)}C${f(x + w * 0.8)} ${f(yb - hh * 0.8)} ${f(x + w)} ${f(yb - hh * 0.3)} ${f(x)} ${f(yb)}Z`;
    }
    // hill village: paper cubes with a shade side
    let walls = '', shade = '', roofs = '';
    for (let i = 0; i < g.vil[1]; i++) {
      const x = g.vil[0] + i * 7.5 + R() * 3, yb = heightAt(g.far, x) + 7 + R() * 6, w = 5 + R() * 3, hh = 4 + R() * 3;
      walls += rect(x, yb - hh, w, hh); shade += rect(x + w * 0.62, yb - hh, w * 0.38, hh);
      if (R() < 0.5) roofs += poly([[x - 0.6, yb - hh], [x + w / 2, yb - hh - 2.6], [x + w + 0.6, yb - hh]]);
    }
    let chap = '';
    if (g.chapel) {
      const x = g.chapel, yb = heightAt(g.far, x) + 3;
      chap = h('g', DD('sea:O:hill-chapel'), F(rect(x - 5, yb - 8, 10, 8) + `M${f(x - 4)} ${f(yb - 8)}A4 4 0 0 1 ${f(x + 4)} ${f(yb - 8)}Z` + rect(x + 5, yb - 14, 3.2, 14), v('cloudHigh')),
        F(rect(x - 1, yb - 5, 2, 5) + rect(x + 5.8, yb - 12, 1.6, 2.4) + rect(x - 0.35, yb - 15.5, 0.7, 4) + rect(x - 1.6, yb - 14.5, 3.2, 0.7), I('N')));
    }
    if (g.castle) {
      const cx = g.castle, cy = heightAt(g.far, cx) + 2;
      chap = h('g', DD('sea:O:castle-ruin'), F(rect(cx - 16, cy - 10, 32, 10) + rect(cx - 16, cy - 20, 8, 10) + rect(cx + 6, cy - 16, 8, 6) + rect(cx - 16, cy - 23, 2.5, 3) + rect(cx - 11, cy - 23, 2.5, 3) + rect(cx + 6, cy - 19, 2.5, 3) + rect(cx + 11.5, cy - 19, 2.5, 3), v('cloudLit')),
        F(rect(cx - 13, cy - 17, 2, 3) + rect(cx - 3, cy - 7, 4, 7), I('N')));
    }
    if (gi >= heroN) {
      const k = Math.floor(g.far[0][0] / 3000); if (!acc.has(k)) acc.set(k, { far: '', hatch: '', foot: '', dots: '', terr: '', cyp: '', walls: '', shade: '', roofs: '', chap: '' });
      const A = acc.get(k); A.far += far; A.hatch += hatch; A.foot += foot; A.dots += dotsS; A.terr += terr; A.cyp += cyp; A.walls += walls; A.shade += shade; A.roofs += roofs; A.chap += chap;
      continue;
    }
    tile += h('g', DD('sea:O:far-ridge'), F(far, v('hillFar'))) +
      h('g', DD('sea:T:ridge-light-hatch'), S(hatch, v('cloudLit'), 1.6)) +
      h('g', DD('sea:O:foothills'), F(foot, v('hillNear'))) +
      h('g', DD('sea:T:ridge-halftone'), dotsS) +
      h('g', DD('sea:T:terraced-fields'), S(terr, v('cloudLit'), 0.9)) +
      h('g', DD('sea:O:cypresses'), F(cyp, I('N'))) +
      h('g', DD('sea:O:far-village'), F(walls, v('cloudHigh')), F(shade, I('B')), F(roofs, I('R'))) + chap;
  }
  for (const A of acc.values()) {
    const bins = new Map();
    for (const m of A.dots.matchAll(/<path d="([^"]*)" stroke="([^"]*)" stroke-width="([^"]*)"/g)) bins.set(m[2] + '|' + m[3], (bins.get(m[2] + '|' + m[3]) || '') + m[1]);
    tile += F(A.far, v('hillFar')) + S(A.hatch, v('cloudLit'), 1.6) + F(A.foot, v('hillNear')) +
      [...bins].map(([k, d]) => { const [st, w] = k.split('|'); return h('path', { d, stroke: st, 'stroke-width': w, 'stroke-linecap': 'round', fill: 'none' }); }).join('') +
      S(A.terr, v('cloudLit'), 0.9) + F(A.cyp, I('N')) + F(A.walls, v('cloudHigh')) + F(A.shade, I('B')) + F(A.roofs, I('R')) + A.chap.replace(/ data-detail="[^"]*"/g, '');
  }
  // far islands (one sits in front of the golden-hour sun)
  const island = (x, w, hh) => smooth([[x, 472], [x + w * 0.12, 466 - hh * 0.4], [x + w * 0.35, 470 - hh], [x + w * 0.6, 468 - hh * 0.8], [x + w * 0.85, 468 - hh * 0.3], [x + w, 472]], false) + 'Z';
  for (const [x, w, hh, tx] of [[1372, 96, 12, 1398], [3010, 150, 14, 3080]])
    tile += h('g', DD('sea:O:far-island'), F(island(x, w, hh) + rect(tx, 452, 3.6, 8) + `M${tx - 1} 452L${tx + 1.8} 447L${tx + 4.6} 452Z`, v('hillFar')), S(`M${x + 20} 466h${w * 0.25}`, v('cloudLit'), 1));
  // two real copies (not <use>) so each copy is its own hit-testable geometry
  const markup = h('g', { 'data-ref': 'sea-hills' }, h('g', { id: 'sea-pano' }, tile), h('use', { href: '#sea-pano', x: f(-W_H) }));
  return { markup, defs: '' };
}

// ============================================================================ L-lighthouse: the cape + lighthouse
function buildLighthouse(v, I, rng, lampOn) {
  const R = rng('sea-cape');
  const X = LAMP.x;       // tower axis
  const top = [[925, 472], [962, 460], [1000, 443], [1040, 423], [1072, 409], [1105, 403], [1160, 401], [1238, 402]];
  const cliff = [[1238, 402], [1246, 411], [1250, 428], [1258, 444], [1268, 458], [1282, 466], [1298, 472]];
  const outline = smooth(top, false) + cliff.slice(1).map(p => `L${f(p[0])} ${f(p[1])}`).join('') + 'L925 480Z';
  let g = '';
  // rock body (sunlit cliff) + grass mantle
  const grassPts = [...top, [1240, 409], [1236, 414], [1190, 415], [1130, 418], [1082, 432], [1052, 452], [1040, 472]];
  const grass = smooth(top, false) + `L1240 409L1236 414C1210 416 1170 414 1130 419C1100 424 1080 436 1062 452C1052 460 1046 468 1042 480L925 480Z`;
  const lit = poly([[1240, 409], [1246, 411], [1250, 428], [1258, 444], [1268, 458], [1282, 466], [1298, 472], [1272, 474], [1258, 460], [1248, 442], [1242, 424]]) +
    poly([[1214, 415], [1232, 414], [1236, 440], [1240, 474], [1222, 474], [1218, 446]]) +
    poly([[1184, 415], [1198, 415], [1200, 444], [1206, 474], [1192, 474], [1186, 444]]) +
    poly([[1152, 417], [1162, 416], [1164, 446], [1170, 474], [1160, 474], [1154, 446]]);
  g += h('g', DD('sea:O:cape'), F(outline, v('hillFar')), F(lit, v('cloudLit')), F(grass, v('hillNear')),
    S('M1236 403.5L1244 411L1249 428L1257 444L1267 457L1281 465L1297 471', v('cloudRim'), 1.2));
  // strata + fissures on the cliff
  let st = '';
  for (let k = 0; k < 6; k++) {
    const y = 424 + k * 8;
    st += `M${f(1078 + k * 12 + R() * 8)} ${f(y + 2)}Q${f(1150)} ${f(y - 3)} ${f(1238 + k * 6)} ${f(y + 1)}`;
  }
  const fis = 'M1232 418l-4 9l3 7l-5 10l2 8M1206 430l-3 8l2 6l-4 9M1250 432l-6 10l3 8M1188 452l-4 6l1 8M1266 452l-5 8';
  g += h('g', DD('sea:T:cliff-strata'), S(st, v('cloudShade'), 1, { 'stroke-dasharray': '26 5 12 4' }), S(fis, I('N'), 1.2),
    F(ell(1262, 470, 7, 3) + ell(1284, 471, 5, 2.5) + ell(1244, 471, 4, 2), I('N')), F(ell(1263, 469, 4, 1.6) + ell(1285, 470.2, 3, 1.2), v('hillFar')));
  g += h('g', DD('sea:T:cape-halftone'), dots(R, 925, 1080, 424, 472, 0.3, 1.9, 5, I('N'), { clip: (x, y) => y > heightAt(grassPts, x) + 5 && y < 478 && x < 1070 - (472 - y) * 0.2 }));
  g += h('g', DD('sea:O:cape-path'), S('M1082 408L1060 420L1074 428L1034 440L1048 450L1004 462L1014 470', v('cloudRim'), 1.3, { 'stroke-dasharray': '3 2.4' }));
  // picket fence along the cliff edge
  let fence = '';
  for (let x = 1172; x <= 1234; x += 4.2) fence += `M${f(x)} 401.5v-5.5`;
  g += h('g', DD('sea:O:cape-fence'), S(fence + 'M1171 397.6H1235M1171 399.8H1235', v('cloudHigh'), 0.9));
  // keeper's cottage
  g += h('g', DD('sea:O:keeper-house'),
    F(rect(1112, 378, 5, 10), I('N')),
    F(rect(1086, 386, 40, 16), I('P')), F(rect(1115, 386, 11, 16), v('cloudLit')),
    F('M1083 387L1094 376L1118 376L1129 387Z', I('R')),
    F(rect(1091, 390, 5, 5) + rect(1104, 390, 5, 5) + rect(1118, 392, 4, 10), I('N')),
    F(rect(1091, 390, 5, 5) + rect(1104, 390, 5, 5), v('lamp'), { 'data-ref': 'sea-keeperlit', ...lampOn }),
    S('M1093.5 390v5M1106.5 390v5', I('P'), 0.6));
  // signal mast with yard + flags
  g += h('g', DD('sea:O:signal-mast'),
    S('M1216 401V350M1205 360H1227M1216 372L1204 366', I('N'), 1.1), S('M1206 360V376M1226 360V372', I('N'), 0.45),
    F('M1216 350.5L1229 353.5L1216 356.5Z', I('R')), F(circ(1216, 349.5, 1.3), I('N')),
    F(rect(1203.8, 362, 4.4, 4.4), I('O')), F(rect(1203.8, 367.4, 4.4, 4.4), I('R')), F(rect(1203.8, 369, 4.4, 1.2), I('P')),
    F(rect(1223.8, 362, 4.4, 4.4), I('P')), F(rect(1223.8, 362, 2.2, 2.2) + rect(1226, 364.2, 2.2, 2.2), I('B')),
    F(rect(1211, 396, 10, 6), I('N')));
  // tower
  const yb = 402, yt = 284, wb = 13, wt = 8.5, tw = y => lerp(wb, wt, (yb - y) / (yb - yt));
  const band = (y0, y1) => poly([[X - tw(y0), y0], [X - tw(y1), y1], [X + tw(y1), y1], [X + tw(y0), y0]]);
  g += h('g', DD('sea:O:lighthouse-tower'), F(band(yb, 382) + band(366, 350) + band(334, 318) + band(302, yt), I('P')),
    F(poly([[X - wb, yb], [X - wt, yt], [X - wt + 3.2, yt], [X - wb + 4.2, yb]]), v('cloudLit')),
    F(rect(X - 16, yb - 3, 32, 4), I('B')),
    h('g', DD('sea:O:lighthouse-stripes'), F(band(382, 366) + band(350, 334) + band(318, 302), I('R')), F(poly([[X - tw(382), 382], [X - tw(366), 366], [X - tw(366) + 3.4, 366], [X - tw(382) + 4.3, 382]]) + poly([[X - tw(350), 350], [X - tw(334), 334], [X - tw(334) + 3.3, 334], [X - tw(350) + 3.9, 350]]) + poly([[X - tw(318), 318], [X - tw(302), 302], [X - tw(302) + 3.2, 302], [X - tw(318) + 3.6, 318]]), I('O'))),
    h('g', DD('sea:O:lighthouse-windows'), F(`M${X - 4} ${yb - 3}V${yb - 10}A4 4 0 0 1 ${X + 4} ${yb - 10}V${yb - 3}Z` + rect(X + 1, 356, 2.8, 6) + rect(X - 3, 326, 2.6, 5.5) + rect(X + 1.2, 294, 2.4, 5), I('N'))));
  // gallery + railing
  let rail = '';
  for (let x = X - 13; x <= X + 13.1; x += 3.25) rail += `M${f(x)} ${yt - 1}v-7`;
  g += h('g', DD('sea:O:lighthouse-gallery'),
    F(rect(X - 14, yt - 1, 28, 4) + poly([[X - 12, yt + 3], [X - 8, yt + 3], [X - 8, yt + 7]]) + poly([[X + 12, yt + 3], [X + 8, yt + 3], [X + 8, yt + 7]]) + poly([[X - 2, yt + 3], [X + 2, yt + 3], [X, yt + 6]]), I('N')),
    S(rail + `M${X - 13.5} ${yt - 8}H${X + 13.5}M${X - 13.5} ${yt - 4.5}H${X + 13.5}`, I('N'), 0.8));
  // lantern: glass + lens + astragals
  g += h('g', DD('sea:O:lighthouse-lantern'),
    F(rect(X - 8, 262, 16, 14), v('lamp')),
    F(`M${X - 3.4} 264h6.8v10h-6.8Z`, I('P')),
    S(`M${X - 3} 266.5h6M${X - 3} 269h6M${X - 3} 271.5h6`, v('cloudLit'), 0.7),
    S(`M${X - 8} 262h16v14h-16ZM${X - 4.5} 262v14M${X + 4.5} 262v14M${X - 8} 268.5l3.5 -6.5M${X + 8} 268.5l-3.5 -6.5`, I('N'), 1));
  g += h('g', DD('sea:O:lighthouse-dome'),
    F(`M${X - 10} 262Q${X} 246 ${X + 10} 262Z` + circ(X, 248.5, 2.2), I('N')),
    F(`M${X - 6} 258Q${X - 3} 252 ${X} 251.4L${X} 253Q${X - 3} 254 ${X - 4} 258Z`, I('R')),
    S(`M${X} 246V234M${X - 5} 238H${X + 5}`, I('N'), 0.9), F(`M${X + 5} 238l-3 -2.2v4.4Z`, I('N')));
  // night: glow + rotating beam (hidden by day)
  const beam = h('g', { 'data-ref': 'sea-beam', transform: `translate(${LAMP.x} ${LAMP.y})` },
    h('g', { 'data-ref': 'sea-beamRot' },
      F('M0 -3L900 -52L900 52L0 3Z', v('beacon'), { opacity: 0.13 }),
      F('M0 -2L900 -20L900 20L0 2Z', v('beacon'), { opacity: 0.2 }),
      S('M6 -2L900 -46M6 -1L900 -30M8 0L900 -10M8 0L900 10M6 1L900 30M6 2L900 46', v('beacon'), 1.1, { opacity: 0.55, 'stroke-dasharray': '60 14 30 10' })),
    h('circle', { 'data-ref': 'sea-lantern', r: 30, fill: 'url(#sea-glowG)' }));
  const night = h('g', { 'data-ref': 'sea-lhnight', ...DD('sea:O:lighthouse-beam'), ...lampOn, visibility: 'hidden' }, beam);
  return h('g', { 'data-ref': 'sea-cape' }, night, g);
}

// ============================================================================ L-sea: bands, waves, glitter, harbour, rocks
function buildSea(v, I, rng, lampOn) {
  const R = rng('sea-surface');
  let m = '', defs = '';
  // ---- static bands + halftone seams (x-invariant: they only follow the camera)
  const XS = 700;   // split under the rider so each half is its own (mostly unoccluded) geometry
  const halves = (key, fn) => h('g', DD(key), fn(X0, XS + 1)) + h('g', DD(key), fn(XS, X1));
  m += F(rect(X0, HZ, X1 - X0, 560), v('seaNear'));
  // graded halftone seams as static pattern tiles (one hex column per tile set, radius graded down the band) —
  // cached by the renderer, so the rolling wave rows above them don't force thousands of dots to repaint
  const htPat = (pid, sp, y0, y1, rOf, ink) => {
    const dy = sp * 0.866, TW = sp * 8; let d = '';
    for (let j = 0, y = y0; y <= y1 + 0.01; j++, y = y0 + j * dy) {
      const r = rOf(y); if (r < 0.3) continue;
      for (let x = (j % 2 ? sp / 2 : 0) - sp; x <= TW + sp; x += sp) d += circ(x, y, Math.round(r * 4) / 4);
    }
    defs += h('pattern', { id: pid, x: 0, y: 0, width: f(TW), height: 2000, patternUnits: 'userSpaceOnUse' }, F(d, ink));
    return `url(#${pid})`;
  };
  const patHT = htPat('sea-htSeam', 7.5, 506, 552, y => lerp(0.3, 4.1, (y - 506) / 46), v('seaNear'));
  const patSW = htPat('sea-htSwell', 7, 584, 626, y => 2.3 * Math.sin(Math.PI * clamp((y - 584) / 42, 0, 1)) ** 1.4, v('seaFar'));
  m += halves('sea:O:band-deep', (a, b) => F(rect(a, 548, b - a, 96), v('seaNear')) +
    h('g', DD('sea:T:swell-halftone'), F(rect(a, 580, b - a, 50), patSW)));
  m += halves('sea:O:band-far', (a, b) => F(rect(a, HZ, b - a, 80), v('seaFar')) +
    h('g', DD('sea:T:band-halftone'), F(rect(a, 502, b - a, 52), patHT)));
  m += h('g', DD('sea:O:horizon-line'), F(rect(X0, HZ - 1, X1 - X0, 2.4), v('seaNear')),
    S((() => { let d = ''; for (let x = X0; x < X1; x += 40 + R() * 70) d += `M${f(x)} ${f1(474.5 + R() * 2.5)}h${f(12 + R() * 34)}`; return d; })(), v('cloudRim'), 1));
  // ---- wave-line bands (each scrolls at its own depth; generated periodic over its tile)
  const bandTile = (i, gen) => {
    const W = BANDS[i][1]; let d = gen(W);
    return h('g', { 'data-ref': 'sea-w' + i }, h('g', {}, d), h('g', { transform: `translate(${f(W)} 0)` }, d));
  };
  const periodic = (W, x, len, fn) => fn(x) + (x + len > X0 + W ? fn(x - W) : '');
  const CF = (d, ink, o) => chunks(d).map(c => F(c, ink, o)).join(''), CS = (d, ink, w) => chunks(d).map(c => S(c, ink, w)).join('');
  // 0: far ripple ticks (light ink)
  m += bandTile(0, W => {
    let d = '';
    for (let y = 478; y < 503; y += 4.2 + (y - 470) * 0.05) {
      const t = (y - 470) / 40, len = 5 + t * 8;
      for (let x = X0 + R() * 50; x < X0 + W; x += 26 + R() * 60) {
        const hh = 0.8 + t * 1.4;
        d += periodic(W, x, len, xx => `M${f(xx)} ${f(y)}q${f(len / 2)} ${f(-hh * 1.6)} ${f(len)} 0q${f(-len / 2)} ${f(-hh * 0.5)} ${f(-len)} 0Z`);
      }
    }
    return h('g', DD('sea:T:ripple-ticks'), CF(d, v('cloudRim')));
  });
  // 1: mid wave ticks in the halftone seam
  m += bandTile(1, W => {
    let d = '';
    for (let y = 510; y < 548; y += 6 + (y - 470) * 0.04) {
      const t = (y - 500) / 50, len = 10 + t * 12;
      for (let x = X0 + R() * 60; x < X0 + W; x += 40 + R() * 70) {
        const hh = 1.4 + t * 1.6;
        d += periodic(W, x, len, xx => `M${f(xx)} ${f(y)}q${f(len / 2)} ${f(-hh * 1.6)} ${f(len)} 0q${f(-len / 2)} ${f(-hh * 0.5)} ${f(-len)} 0Z`);
      }
    }
    return h('g', DD('sea:T:wave-ticks-mid'), CF(d, v('cloudRim')));
  });
  // 2: scalloped deco wave-lines on the deep band
  const scallops = (W, y0, y1, step, a0, a1, segMin, segMax, gapMin, gapMax) => {
    let d = '';
    for (let y = y0; y < y1; y += step) {
      const t = (y - y0) / (y1 - y0), a = lerp(a0, a1, t);
      for (let x = X0 + R() * 80; x < X0 + W; ) {
        const n = segMin + Math.floor(R() * (segMax - segMin + 1)), len = n * 2 * a;
        d += periodic(W, x, len, xx => { let s = `M${f(xx)} ${f(y)}`; for (let k = 0; k < n; k++) s += `q${f(a)} ${f(a * 0.9)} ${f(2 * a)} 0`; return s; });
        x += len + gapMin + R() * (gapMax - gapMin);
      }
    }
    return d;
  };
  m += bandTile(2, W => h('g', DD('sea:T:wave-lines'), CS(scallops(W, 556, 590, 7.5, 4, 5.5, 2, 5, 40, 150), v('seaFar'), 1.5)));
  // 3: near wave-lines + whitecaps
  m += bandTile(3, W => {
    const lines = scallops(W, 628, 650, 9, 6, 7, 2, 4, 60, 190);
    let caps = '', spray = '';
    for (let y = 596; y < 652; y += 13) {
      for (let x = X0 + R() * 200; x < X0 + W; x += 150 + R() * 260) {
        const len = 14 + R() * 12, hh = 3 + R() * 2;
        caps += periodic(W, x, len, xx => `M${f(xx)} ${f(y)}q${f(len * 0.45)} ${f(-hh * 1.8)} ${f(len)} ${f(-hh * 0.3)}q${f(-len * 0.2)} ${f(hh * 0.4)} ${f(-len * 0.34)} ${f(hh * 0.9)}q${f(-len * 0.3)} ${f(-hh * 0.5)} ${f(-len * 0.66)} ${f(-hh * 0.6)}Z`);
        spray += periodic(W, x, len, xx => `M${f(xx + len + 3)} ${f(y - hh)}h0M${f(xx + len + 6)} ${f(y - hh * 0.4)}h0M${f(xx + len * 0.7)} ${f(y - hh * 1.9)}h0`);
      }
    }
    return h('g', DD('sea:T:wave-lines'), CS(lines, v('seaFar'), 1.7)) +
      h('g', DD('sea:O:whitecaps'), CF(caps, v('foam')), CS(spray, v('foam'), 1.6));
  });
  // ---- glitter paths (positioned under the sun / moon each frame)
  const glitter = (seed, w0, w1, inkA, inkB, refp) => {
    const G = rng(seed); const rows = [[], [], []];
    for (let y = 474, i = 0; y < 648; i++) {
      const t = (y - 470) / 175, hh = 1.8 + t * 4.4, w = lerp(w0, w1, t) + G() * 30;
      const cx = (G() - 0.5) * 24, segs = 1 + Math.floor(G() * 3);
      let x = cx - w / 2;
      for (let s = 0; s < segs; s++) {
        const sw = Math.max(4, w / segs - 6 - G() * 12), r = hh / 2;
        rows[i % 3].push([`M${f(x + r)} ${f(y)}h${f(sw)}a${f(r)} ${f(r)} 0 0 1 0 ${f(hh)}h${f(-sw)}a${f(r)} ${f(r)} 0 0 1 0 ${f(-hh)}Z`, (i + s) % 3 === 1]);
        x += w / segs;
      }
      y += hh + 2.6 + t * 5.5;
    }
    return rows.map((row, k) => h('g', { 'data-ref': `${refp}${k}` },
      F(row.filter(r => !r[1]).map(r => r[0]).join(''), inkA), F(row.filter(r => r[1]).map(r => r[0]).join(''), inkB))).join('');
  };
  const star = (x, y, r) => `M${f(x)} ${f(y - r)}Q${f(x + r * 0.16)} ${f(y - r * 0.16)} ${f(x + r)} ${f(y)}Q${f(x + r * 0.16)} ${f(y + r * 0.16)} ${f(x)} ${f(y + r)}Q${f(x - r * 0.16)} ${f(y + r * 0.16)} ${f(x - r)} ${f(y)}Q${f(x - r * 0.16)} ${f(y - r * 0.16)} ${f(x)} ${f(y - r)}Z`;
  const sparkles = [[-30, 492, 6], [38, 530, 8], [-12, 584, 9]].map(([x, y, r], k) =>
    h('g', { transform: `translate(${x} ${y})` }, h('g', { 'data-ref': 'sea-spk' + k }, F(star(0, 0, r), v('sunCore'))))).join('');
  m += h('g', { 'data-ref': 'sea-sunG' }, h('g', DD('sea:O:sun-glitter'), glitter('sea-sunglit', 150, 110, v('sunCore'), v('sunGlow'), 'sea-sg')),
    h('g', DD('sea:O:glitter-sparkles'), sparkles));
  m += h('g', { 'data-ref': 'sea-moonG', visibility: 'hidden' }, h('g', DD('sea:O:moon-glitter'), glitter('sea-moonglit', 70, 60, v('moon'), v('moonShade'), 'sea-mg')));
  // ---- harbour town, rocks
  const hb = buildHarbour(v, I, rng, lampOn);
  m += hb.markup; defs += hb.defs;
  m += buildRocks(v, I, rng);
  return { markup: m, defs };
}

// ---------------------------------------------------------------------------- harbour town (hero coords, L-sea)
function buildHarbour(v, I, rng, lampOn) {
  const R = rng('sea-town');
  const yHill = x => 506 - 78 * Math.exp(-(((x - 70) / 150) ** 2)) - 24 * Math.exp(-(((x + 260) / 110) ** 2));
  let g = '';
  // hill
  let land = `M${X0} 515`;
  for (let x = X0; x <= 300; x += 10) land += `L${f(x)} ${f(yHill(x))}`;
  land += 'L300 515Z';
  g += h('g', DD('sea:O:town-hill'), F(land, v('hillNear')));
  // hill halftone: a static pattern (graded by height) filling the hill outline dropped by 4 units
  let pd = '';
  for (let j = 0, y = 440; y <= 506; j++, y = 440 + j * 4.33) { const r = lerp(0.3, 1.8, (y - 440) / 64); if (r < 0.3) continue; for (let x = (j % 2 ? 2.5 : 0) - 5; x <= 45; x += 5) pd += circ(x, y, Math.round(r * 4) / 4); }
  let hillIn = `M${X0} 515`; for (let x = X0; x <= 300; x += 10) hillIn += `L${f(x)} ${f(yHill(x) + 4)}`; hillIn += 'L300 515Z';
  const hbDefs = h('pattern', { id: 'sea-htHill', x: 0, y: 0, width: 40, height: 2000, patternUnits: 'userSpaceOnUse' }, F(pd, I('N')));
  g += h('g', DD('sea:T:town-hill-halftone'), F(hillIn, 'url(#sea-htHill)'));
  // houses: three rows, each its own design (hillside cubes, gabled middle row, tiled waterfront townhouses),
  // drawn back to front; every row is merged into a handful of paths
  const row = () => ({ W: '', W2: '', roof: '', par: '', shade: '', win: '', lit: '', shut: '', chim: '', bal: '', door: '' });
  const rows = [row(), row(), row()];
  const house = (Q, x, yb, w, hh, kind) => {
    const top = yb - hh;
    if (kind === 'g') { Q.W += rect(x, top, w, hh); Q.roof += poly([[x - 1.6, top + 0.5], [x + w / 2, top - w * 0.46], [x + w + 1.6, top + 0.5]]); if (R() < 0.7) Q.chim += rect(x + w * 0.68, top - w * 0.4, 2.4, w * 0.3) + rect(x + w * 0.68 - 0.5, top - w * 0.4 - 1, 3.4, 1); }
    else if (kind === 't') { Q.W += rect(x, top, w, hh); Q.roof += poly([[x - 1.4, top + 0.5], [x + 3, top - 6], [x + w - 3, top - 6], [x + w + 1.4, top + 0.5]]); Q.bal += `M${f(x + 1.5)} ${f(top + 10.5)}h${f(w - 3)}`; for (let bx = x + 2; bx < x + w - 1.5; bx += 1.8) Q.bal += `M${f(bx)} ${f(top + 10.5)}v2.6`; }
    else { Q.W += rect(x, top, w, hh); Q.par += rect(x - 0.8, top - 1.6, w + 1.6, 1.6); if (R() < 0.45) Q.W2 += `M${f(x + w * 0.3)} ${f(top - 1.5)}a${f(w * 0.2)} ${f(w * 0.2)} 0 0 1 ${f(w * 0.4)} 0Z`; }
    if (kind !== 't') Q.shade += rect(x, top, w * 0.24, hh);
    const cols = Math.max(1, Math.floor((w - 3) / 5.5)), nr = Math.max(1, Math.floor((hh - 6) / 7));
    for (let r = 0; r < nr; r++) for (let c = 0; c < cols; c++) {
      const wx = x + 2.2 + c * ((w - 4.4) / cols) + ((w - 4.4) / cols - 2.4) / 2, wy = top + 3 + r * 7 + (kind === 't' && r > 0 ? 1.4 : 0);
      if (kind === 't' && r === nr - 1 && c === 0 && nr > 1) { Q.door += rect(wx, yb - 5.6, 2.8, 5.6); continue; }
      const win = kind === 'c' ? `M${f(wx)} ${f(wy + 3.8)}v-2.3a1.2 1.2 0 0 1 2.4 0v2.3Z` : rect(wx, wy, 2.4, 3.4);
      Q.win += win; if (R() < 0.55) Q.lit += win;
      if (kind !== 'c' && R() < 0.45) Q.shut += rect(wx - 1.1, wy, 0.9, 3.4) + rect(wx + 2.6, wy, 0.9, 3.4);
    }
  };
  for (let x = -70; x < 205; x += 16 + R() * 7) { if (Math.abs(x - 64) < 17) continue; house(rows[0], x, yHill(x + 8) + 3, 11 + R() * 6, 10 + R() * 6, 'c'); }
  for (let x = -40; x < 215; x += 18 + R() * 8) { if (x > 180 && x < 262) continue; house(rows[1], x, (yHill(x + 8) + 503) / 2 + 4, 15 + R() * 6, 14 + R() * 8, 'g'); }
  for (let x = 42; x < 196; x += 19 + R() * 5) house(rows[2], x, 503, 16 + R() * 4, 22 + R() * 8, 't');
  const rowMarkup = (Q, k, key, wall, roof) => h('g', DD(key),
    F(Q.W + Q.W2, wall), Q.par ? F(Q.par, v('cloudLit')) : '', Q.shade ? F(Q.shade, v('cloudLit')) : '', Q.roof ? F(Q.roof, roof) : '',
    Q.chim ? h('g', DD('sea:O:chimneys'), F(Q.chim, I('N'))) : '',
    h('g', DD('sea:O:town-windows'), F(Q.win + Q.door, I('N')), Q.shut ? F(Q.shut, I('T')) : ''),
    Q.bal ? h('g', DD('sea:O:balconies'), S(Q.bal, I('N'), 0.6)) : '',
    F(Q.lit, v('lamp'), { 'data-ref': 'sea-townlit' + k, visibility: 'hidden', ...lampOn }));
  const houses = rowMarkup(rows[0], 0, 'sea:O:houses-cubes', I('P'), '') + rowMarkup(rows[1], 1, 'sea:O:houses-gabled', I('P'), I('R')) + rowMarkup(rows[2], 2, 'sea:O:houses-tiled', v('cloudLit'), I('O'));
  // fish market (front left), church (front right)
  const fm = h('g', DD('sea:O:fish-market'),
    F(rect(-8, 484, 46, 19), I('P')), F('M-11 485L15 470L41 485Z', I('R')), F(`M9 503V494A6 6 0 0 1 21 494V503Z` + rect(30, 489, 4, 4) + rect(-4, 489, 4, 4), I('N')),
    F('M-10 485h50v3.2q-3.1 2.4 -6.25 0q-3.1 2.4 -6.25 0q-3.1 2.4 -6.25 0q-3.1 2.4 -6.25 0q-3.1 2.4 -6.25 0q-3.1 2.4 -6.25 0q-3.1 2.4 -6.25 0q-3.1 2.4 -6.25 0Z', I('O')),
    S('M-3.75 485v3M8.75 485v3M21.25 485v3M33.75 485v3', I('P'), 1.6),
    F(rect(40, 497, 6, 6) + rect(47, 499, 5, 4) + rect(42, 492, 5, 5), I('O')), S('M40 500h6M47 501h5M42 494.5h5', I('R'), 0.6));
  const church = h('g', DD('sea:O:church'),
    F(rect(206, 482, 32, 22) + rect(238, 446, 16, 58), I('P')), F(rect(248, 446, 6, 58), v('cloudLit')),
    F('M203 483L222 470L241 483Z' + 'M236.5 446L246 420L255.5 446Z', I('R')),
    F(`M241 460V454A3 3 0 0 1 247 454V460ZM249 460V455A2 2 0 0 1 253 455V460Z` + rect(213, 488, 3, 7) + rect(222, 488, 3, 7) + rect(231, 488, 3, 7) + `M242 504V497A4 4 0 0 1 250 497V504Z`, I('N')),
    S('M246 420V413M243.5 415.5H248.5', I('N'), 0.9), F(rect(236.5, 444.5, 19, 2), I('N')));
  const clock = h('g', DD('sea:O:church-clock'), F(circ(246, 470, 4.2), I('N')), F(circ(246, 470, 3.2), I('P')), S('M246 470V467.4M246 470L248 471', I('N'), 0.7));
  // windmill on the hilltop
  const wy = yHill(70);
  const mill = h('g', DD('sea:O:windmill'),
    F(poly([[62, wy + 2], [64.5, wy - 30], [75.5, wy - 30], [78, wy + 2]]), I('P')), F(poly([[72, wy + 2], [72.6, wy - 30], [75.5, wy - 30], [78, wy + 2]]), v('cloudLit')),
    F(`M62.5 ${f(wy - 29)}Q70 ${f(wy - 42)} 77.5 ${f(wy - 29)}Z`, I('R')),
    F(`M67.5 ${f(wy + 2)}V${f(wy - 6)}A2.5 2.5 0 0 1 72.5 ${f(wy - 6)}V${f(wy + 2)}Z` + rect(68.6, wy - 20, 2.8, 4), I('N')));
  // sails: 4 lattice blades around the hub
  let blades = '', lattice = '';
  for (let k = 0; k < 4; k++) {
    const a = k * 90;
    const pt = (u, s) => { const c = Math.cos(a * D2R), sn = Math.sin(a * D2R); return [u * c - s * sn, u * sn + s * c]; };
    blades += poly([pt(6, 0.8), pt(31, 0.8), pt(31, 6.5), pt(6, 5.5)]);
    lattice += line([pt(0, 0), pt(32, 0)]) + line([pt(6, 3.2), pt(31, 3.6)]) + line([pt(31, 0.8), pt(31, 6.5)]);
    for (let u = 11; u < 31; u += 5) lattice += line([pt(u, 0.8), pt(u, 5.5 + (u - 6) * 0.04)]);
  }
  const sails = h('g', { transform: `translate(70 ${f(wy - 31)})` }, h('g', { 'data-ref': 'sea-millSails', ...DD('sea:O:windmill-sails') }, F(blades, v('cloudHigh')), S(lattice, I('N'), 0.8), F(circ(0, 0, 2.2), I('N'))));
  // trees
  let cy = '', rt = '';
  for (const [x, hh] of [[112, 20], [124, 15], [162, 18], [-54, 17]]) { const yb = yHill(x) + 4; cy += `M${x} ${f(yb)}C${x - 3.4} ${f(yb - hh * 0.35)} ${x - 2.6} ${f(yb - hh * 0.8)} ${x} ${f(yb - hh)}C${x + 2.6} ${f(yb - hh * 0.8)} ${x + 3.4} ${f(yb - hh * 0.35)} ${x} ${f(yb)}Z`; }
  for (const [x, r] of [[20, 6], [185, 6.5], [-25, 5]]) { const yb = yHill(x) + 2; rt += circ(x, yb - r, r) + circ(x - r * 0.7, yb - r * 0.6, r * 0.7); }
  const trees = h('g', DD('sea:O:town-trees'), F(cy, I('N')), F(rt, I('T')), dots(R, -30, 195, 420, 500, 0.8, 0.8, 3.2, I('N'), { clip: (x, y) => [[20, 6], [185, 6.5], [-25, 5]].some(([tx, r]) => Math.hypot(x - tx + r * 0.3, y - (yHill(tx) + 2 - r * 0.4)) < r * 0.75) }));
  g += mill + sails + trees + houses + fm + church + clock;
  // quay wall with masonry + bollards
  let mas = 'M-420 508.5H300M-420 512H300';
  for (let x = -416, r = 0; x < 300; x += 9, r++) mas += `M${x} 505V508.5M${x + 4.5} 508.5V512M${x} 512V515`;
  g += h('g', DD('sea:O:quay-wall'), F(rect(-420, 503, 720, 12), v('cloudLit')), F(rect(-420, 502, 720, 2), I('P')),
    F([60, 104, 150, 196, 280].map(x => rect(x, 499, 2.4, 3) + rect(x - 0.6, 498.4, 3.6, 1)).join(''), I('N')));
  g += h('g', DD('sea:T:quay-masonry'), S(mas, I('O'), 0.6));
  // harbour mole in front + beacon tower
  let mm = 'M-90 520.5H112';
  for (let x = -86; x < 112; x += 8) mm += `M${x} 517.5V520.5M${x + 4} 520.5V523.5`;
  g += h('g', DD('sea:O:harbour-mole'), F('M-420 517L110 517L114 524L-420 524Z', v('cloudLit')), F(rect(-420, 516, 532, 1.8), I('P')), S(mm, I('O'), 0.6));
  g += h('g', DD('sea:O:harbour-beacon'), F(rect(100, 494, 9, 23), I('P')), F(rect(100, 499, 9, 4) + rect(100, 507, 9, 4), I('R')), F(rect(99, 491, 11, 3) + `M100.5 491L104.5 486L108.5 491Z`, I('N')),
    F(rect(102, 488, 5, 3), v('lamp')), h('circle', { cx: 104.5, cy: 489.5, r: 9, fill: 'url(#sea-glowG)', 'data-ref': 'sea-glow-beacon', ...lampOn, visibility: 'hidden' }));
  // moored dinghies
  const dinghy = (x, w, ink) => F(`M${x} 510.5L${x + w} 510L${x + w - 3} 514.5L${x + 3} 514.8Z`, ink);
  g += h('g', DD('sea:O:moored-boats'), dinghy(128, 16, I('R')), dinghy(150, 13, I('T')), dinghy(170, 18, I('P')), dinghy(196, 14, I('O')),
    S('M178 510V496M178 498L190 509M132 510.5L126 503M157 510L150 504', I('N'), 0.8), F('M178.8 498L188 508.5L178.8 508.5Z', I('P')));
  // pier: deck + railing, pilings + bracing, lamps + bunting, pavilion
  let pil = '', brace = '', rails = '';
  for (let x = 304; x <= 452; x += 11) { pil += rect(x - 0.9, 496, 1.8, 20); if (x + 11 <= 452) brace += `M${x} 500L${x + 11} 510M${x + 11} 500L${x} 510`; }
  for (let x = 300; x <= 418; x += 5) rails += `M${x} 494v-5.5`;
  g += h('g', DD('sea:O:pier-pilings'), F(pil, I('N')), S(brace + 'M300 505H452', I('N'), 0.6));
  g += h('g', DD('sea:O:pier-deck'), F(rect(298, 493.5, 160, 3.2), I('N')), S(rails + 'M299 488.6H420', v('cloudHigh'), 0.8));
  const lamps = [322, 352, 382, 410];
  g += h('g', DD('sea:O:pier-lamps'), S(lamps.map(x => `M${x} 494V482M${x - 2} 482H${x + 2}`).join(''), I('N'), 0.9), F(lamps.map(x => circ(x, 480.6, 1.7)).join(''), v('lamp')));
  let bunt = '', flagsA = '', flagsB = '';
  for (let i = 0; i < lamps.length - 1; i++) {
    const [a, b] = [lamps[i], lamps[i + 1]];
    bunt += `M${a} 482Q${(a + b) / 2} 488 ${b} 482`;
    for (let k = 1; k < 6; k++) { const u = k / 6, x = lerp(a, b, u), y = 482 + 12 * u * (1 - u), fl = poly([[x - 1.6, y], [x + 1.6, y], [x, y + 3.4]]); if (k % 2) flagsA += fl; else flagsB += fl; }
  }
  g += h('g', DD('sea:O:pier-bunting'), S(bunt, I('N'), 0.5), F(flagsA, I('R')), F(flagsB, I('O')));
  g += h('g', DD('sea:O:pier-pavilion'),
    F(rect(420, 478, 32, 16), I('P')), F(`M420 478Q420 466 436 461Q452 466 452 478Z`, I('O')), F(`M430 478Q431 468 436 461Q441 468 442 478Z`, I('K')),
    F(`M424 492V485A2.5 2.5 0 0 1 429 485V492ZM433.5 492V485A2.5 2.5 0 0 1 438.5 485V492ZM443 492V485A2.5 2.5 0 0 1 448 485V492Z`, I('N')),
    F('M418 477h36v2.6q-2.25 2 -4.5 0q-2.25 2 -4.5 0q-2.25 2 -4.5 0q-2.25 2 -4.5 0q-2.25 2 -4.5 0q-2.25 2 -4.5 0q-2.25 2 -4.5 0q-2.25 2 -4.5 0Z', I('R')),
    S('M436 461V451', I('N'), 0.8), F('M436 451L444 453L436 455Z', I('R')));
  // reflections under the waterline
  let refP = '', refK = '', refR = '';
  for (let x = -60; x < 452; x += 4 + R() * 7) {
    const y = 517 + R() * 16, w = 3 + R() * 9, which = R();
    if (x < 114 && y < 525) continue;
    const d = rect(x, y, w, 1.1);
    if (which < 0.45) refP += d; else if (which < 0.8) refK += d; else refR += d;
  }
  g += h('g', DD('sea:T:harbour-reflections'), F(refP, I('P')), F(refK, I('K')), F(refR, I('R')));
  // night: lamp glows on the pier
  g += h('g', { 'data-ref': 'sea-pierglow', ...lampOn, visibility: 'hidden' }, lamps.map(x => h('circle', { cx: x, cy: 480.6, r: 8, fill: 'url(#sea-glowG)' })).join(''));
  return { markup: h('g', { 'data-ref': 'sea-harbour' }, g), defs: hbDefs };
}

// ---------------------------------------------------------------------------- rocks, seal, cormorants (L-sea)
function buildRocks(v, I, rng) {
  const R = rng('sea-rocks');
  let g = '';
  const bodies = poly([[58, 634], [66, 606], [84, 592], [104, 586], [130, 584], [152, 590], [170, 600], [186, 616], [196, 634]]) +
    poly([[206, 636], [212, 618], [224, 612], [238, 620], [244, 636]]) +
    poly([[298, 638], [304, 626], [318, 622], [330, 630], [334, 638]]);
  const stack = poly([[250, 636], [254, 600], [258, 572], [262, 556], [272, 550], [282, 554], [286, 574], [290, 606], [294, 636]]);
  const shade = poly([[58, 634], [66, 606], [84, 592], [98, 600], [92, 618], [100, 634]]) + poly([[206, 636], [212, 618], [218, 624], [216, 636]]) +
    poly([[250, 636], [254, 600], [258, 572], [262, 556], [266, 566], [264, 600], [268, 636]]) + poly([[298, 638], [304, 626], [310, 630], [308, 638]]);
  const facets = poly([[130, 584], [152, 590], [140, 604], [122, 598]]) + poly([[170, 600], [186, 616], [172, 616]]) + poly([[272, 550], [282, 554], [278, 580], [272, 570]]);
  g += h('g', DD('sea:O:rocks'), F(bodies, v('seaFar')), F(shade, I('N')), F(facets, v('hillFar')),
    S('M108 600l10 14M128 606l6 12M150 604l10 18M112 616l-4 12M226 620l4 10', I('N'), 1));
  g += h('g', DD('sea:O:sea-stack'), F(stack, v('seaFar')), F(poly([[262, 556], [266, 566], [264, 600], [268, 636], [250, 636], [254, 600], [258, 572]]), I('N')),
    S('M270 572l8 3M268 590l12 3M270 610l14 2', I('N'), 1));
  g += h('g', DD('sea:O:rock-rim-light'), S('M104 586L130 584L152 590L170 600L186 616M224 612L238 620M272 550L282 554L286 574M318 622L330 630', v('cloudRim'), 1.6));
  // seal basking on the big rock (head bobs)
  g += h('g', DD('sea:O:seal-basking'),
    F('M92 590C96 578 118 574 138 578C148 580 154 582 158 584L150 590C130 592 108 594 92 590Z', I('N')),
    F('M100 586C112 582 128 581 142 582', 'none', { stroke: I('B'), 'stroke-width': 1.2, 'stroke-linecap': 'round' }),
    F('M96 589L86 584L90 591Z', I('N')),
    h('g', { transform: 'translate(152 582)' }, h('g', { 'data-ref': 'sea-sealHead' },
      F('M-4 1C-4 -8 2 -14 10 -13C15 -12 17 -8 17 -5C17 -2 13 0 8 1Z', I('N')), F(circ(8.5, -9, 1.1), I('P')), F(ell(15.6, -5.4, 1.4, 1), I('B')),
      S('M13 -3.5l6 -1M13 -2.8l6 0.6', I('P'), 0.45))));
  // cormorants on the stack: one drying its wings, one sitting
  g += h('g', DD('sea:O:cormorants'),
    F('M268 551C267 545 268 540 270 536C271 533 273 532 274 534C275 536 274 539 273 541C276 543 277 547 276 551Z' +
      'M270 540C264 536 259 531 256 526C261 528 265 530 270 537ZM273 540C279 536 284 531 287 526C282 528 278 530 273 537Z' +
      'M274 534L278 535L274 535.8Z', I('N')),
    F('M280 553C279 548 281 545 284 545C285 543 287 542 288 543C289 545 288 546 287 547C289 549 289 552 287 553Z M288 543.4L291 544L288 544.6Z', I('N')),
    F(circ(273.3, 533.6, 0.5) + circ(287.3, 543.2, 0.45), I('K')));
  // surging foam collars + spray
  let foam = '', spray = '';
  for (const [x0, x1, y] of [[52, 202, 633], [202, 250, 635], [246, 298, 635], [294, 340, 637]]) {
    foam += `M${x0} ${y}`;
    for (let x = x0; x < x1; x += 6) foam += `q3 -3.2 6 0`;
    foam += `L${x1} ${y + 4}L${x0} ${y + 4}Z`;
    for (let k = 0; k < 5; k++) spray += `M${f(x0 + R() * (x1 - x0))} ${f(y - 3 - R() * 7)}h0`;
  }
  g += h('g', DD('sea:O:rock-foam'), h('g', { 'data-ref': 'sea-foam' }, F(foam, v('foam')), S(spray, v('foam'), 1.8)),
    S('M40 642q10 -3 20 0M186 644q12 -3 24 0M336 643q10 -3 20 0', v('foam'), 1.3));
  return h('g', { 'data-ref': 'sea-rocks' }, g);
}

// ============================================================================ L-boats: boats, buoys, dolphin, fish, seal
function buildBoats(v, I, rng, lampOn) {
  let m = '', defs = '';
  const wrapObj = (key, inner, extra = {}) => h('g', { 'data-ref': 'sea-o-' + key, ...extra }, inner);
  // ---- steamer (bow to the left; heading -x)
  {
    const hull = 'M-56 -10L50 -10L52.5 -9L47 1L-46 1Q-52 -3 -56 -10Z';
    let ports = ''; for (let x = -40; x <= 42; x += 5) ports += `M${x} -6h0`;
    let dw = ''; for (let x = -21; x <= 30; x += 3.6) dw += rect(x, -14.4, 1.6, 2);
    const smoke = [0, 1, 2, 3, 4].map(k => h('g', { 'data-ref': 'sea-smoke' + k, transform: 'translate(17 -38)' },
      F(circ(0, 0, 4) + circ(3.5, -1.5, 3.2) + circ(-3, 1, 2.8), I('B')))).join('');
    const art = h('g', DD('sea:O:steamer-smoke'), smoke) +
      h('g', DD('sea:O:steamer'), F(hull, I('N')), F('M-48 -1.8L48.2 -1.8L47 1L-46 1Z', I('R')), S('M-55 -10H51', v('cloudRim'), 0.9), S(ports, v('cloudRim'), 1.5),
        F(rect(-26, -16, 58, 6) + rect(-16, -21, 38, 5) + rect(-26, -27, 12, 11), v('cloudHigh')), F(dw + rect(-25, -25, 10, 2), I('N')),
        F(rect(-27, -28, 14, 1.4) + rect(-17, -22, 40, 1.2), I('N'))) +
      h('g', DD('sea:O:steamer-funnels'), F(poly([[0, -21], [6.5, -21], [8.5, -36], [2, -36]]) + poly([[12, -21], [18.5, -21], [20.5, -37], [14, -37]]), I('R')),
        F(poly([[1.6, -33], [8.1, -33], [8.5, -36], [2, -36]]) + poly([[13.6, -34], [20.1, -34], [20.5, -37], [14, -37]]), I('N')),
        F(poly([[0.8, -28], [7.3, -28], [7.45, -29.2], [0.95, -29.2]]) + poly([[12.9, -28.4], [19.4, -28.4], [19.55, -29.6], [13.05, -29.6]]), I('P'))) +
      h('g', DD('sea:O:steamer-lifeboats'), F('M-12 -24h8l-1.2 2.4h-5.6ZM24 -24h8l-1.2 2.4h-5.6Z', I('O')), S('M-12 -21v-5h1.5M-4 -21v-5h-1.5M24 -21v-5h1.5M32 -21v-5h-1.5', I('N'), 0.6)) +
      h('g', DD('sea:O:steamer-bunting'), S('M-40 -10V-42M38 -10V-40M-56 -10L-40 -42L-2 -44M22 -44L38 -40L51 -10', I('N'), 0.6),
        F([...Array(6)].map((_, i) => { const u = (i + 0.5) / 6, x = lerp(-56, -40, u), y = lerp(-10, -42, u); return poly([[x, y], [x + 2.2, y + 0.4], [x + 0.6, y + 2.6]]); }).join('') +
          [...Array(5)].map((_, i) => { const u = (i + 0.5) / 5, x = lerp(38, 51, u), y = lerp(-40, -10, u); return poly([[x, y], [x + 2.2, y + 0.4], [x + 0.9, y + 2.6]]); }).join(''), I('R')),
        F([...Array(5)].map((_, i) => { const u = (i + 0.5) / 5, x = lerp(-40, -2, u), y = -42 - 2 * u; return poly([[x, y], [x + 2.2, y], [x + 1.1, y + 2.8]]); }).join(''), I('O'))) +
      h('g', { ...lampOn, 'data-ref': 'sea-steamlit', visibility: 'hidden' }, F(circ(-40, -43, 1.3) + circ(38, -41, 1.3) + dw, v('lamp')));
    m += wrapObj('steamer', art);
  }
  // ---- far sloop and red-sail yawl (drawn at near-boat units, placed small)
  m += wrapObj('sloop', h('g', DD('sea:O:far-sloop'),
    F('M-50 -10L54 -12L42 4L-38 4Z', I('N')), F(rect(-2, -130, 5, 120), I('N')),
    F('M-3 -126Q-30 -70 -44 -16L-3 -16Z', v('cloudHigh')), F('M4 -114L46 -14L4 -14Z', I('B')), F('M-1 -138l18 5l-18 5Z', I('R')),
    S('M-54 10h110M-36 16h70', v('foam'), 3)));
  m += wrapObj('yawl', h('g', DD('sea:O:red-sail-yawl'),
    F('M-46 -12L50 -14Q46 -2 36 4L-34 4Q-42 -2 -46 -12Z', I('T')), S('M-46 -12L50 -14', I('P'), 3),
    S('M4 -12V-120M-34 -12V-80', I('N'), 5), F('M6 -112L-26 -106L-30 -18L40 -20Z', I('R')), F('M-32 -76L-56 -72L-54 -18L-34 -18Z', I('R')),
    S('M6 -112L-26 -106M-32 -76L-56 -72', I('N'), 3), S('M-50 10h100', v('foam'), 3)));
  // ---- trawler with drying net, fisherman and gulls
  {
    defs += h('clipPath', { id: 'sea-netclip' }, F('M-52 -50L-20 -64L-18 -22L-44 -18Z', '#000'));
    let mesh = ''; for (let k = -80; k < 60; k += 5) mesh += `M${k} -70L${k + 60} -10M${k + 60} -70L${k} -10`;
    const gull = (x, y, s, ref) => h('g', { transform: `translate(${x} ${y}) scale(${s})` }, h('g', { 'data-ref': ref },
      F('M-14 -3Q-7 -10 0 0Q7 -10 14 -3Q7 -5.5 0 3Q-7 -5.5 -14 -3Z', v('cloudHigh')), F('M-14 -3Q-12 -5 -10 -5.6L-11 -3.8ZM14 -3Q12 -5 10 -5.6L11 -3.8Z', I('N')), F('M-1.2 0.5l1.2 3l1.2 -3Z', I('O'))));
    const art = h('g', DD('sea:O:trawler'),
      F('M-48 -18L50 -22Q48 -6 36 2L-38 2Q-46 -6 -48 -18Z', I('T')), F('M-45 -3L42 -3L38 2L-38 2Z', I('R')), S('M-48 -18L50 -22', v('cloudHigh'), 2),
      h('g', { fill: 'none', stroke: v('cloudHigh'), 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, glyphs('PB7', -34, -15, 0.95)),
      F(rect(8, -44, 22, 24), v('cloudHigh')), F(rect(11, -40, 6, 6) + rect(21, -40, 6, 6) + rect(26, -54, 3, 7), I('N')), F(rect(5, -48, 28, 4), I('R')),
      F(rect(11, -40, 6, 6) + rect(21, -40, 6, 6), v('lamp'), { ...lampOn, 'data-ref': 'sea-trawlit', visibility: 'hidden' }),
      S('M-6 -20V-88M-6 -72L-54 -50M-6 -88L-54 -50', I('N'), 2.4), F('M-6 -88l14 4l-14 4Z', I('R')),
      S('M-48 -18L-84 4', I('N'), 1.4, { 'stroke-dasharray': '4 3' })) +
      h('g', DD('sea:T:fishing-net'), h('g', { 'clip-path': 'url(#sea-netclip)' }, F('M-52 -50L-20 -64L-18 -22L-44 -18Z', I('B')), S(mesh, I('N'), 1.2)),
        F(circ(-44, -18, 2.6) + circ(-36, -19, 2.6) + circ(-27, -20.5, 2.6) + circ(-19, -22, 2.6), I('O'))) +
      h('g', DD('sea:O:fisherman'), F(poly([[-24, -20], [-23, -36], [-15, -36], [-14, -20]]), I('O')), F(circ(-19, -40, 3.6), I('K')), F('M-25 -41Q-19 -49 -13 -41Z', I('O')),
        S('M-22 -32L-30 -46M-16 -32L-26 -50', I('O'), 2.6)) +
      h('g', DD('sea:O:net-gulls'), gull(-40, -104, 1, 'sea-gA'), gull(-8, -124, 0.8, 'sea-gB'));
    m += wrapObj('trawler', art);
  }
  // ---- the near sailboat with rigging, flags, crew and wake
  {
    const xl = y => -56 * ((y + 154) / 123) ** 0.85;
    let seams = ''; for (let y = -142; y < -34; y += 11) seams += `M-1 ${y}L${f(xl(y) + 1)} ${f(y + 1)}`;
    const art = h('g', DD('sea:O:boat-wake'), F('M52 -2Q66 -8 76 0Q66 -3 58 2ZM60 1Q72 -3 82 3Q72 1 64 4Z', v('foam')),
      S('M-62 3Q-86 1 -118 4M-64 6Q-92 5 -140 9M-60 9Q-80 10 -100 12', v('foam'), 2)) +
      h('g', DD('sea:O:sailboat-hull'), F('M-58 -16L64 -18Q60 -6 46 3L-46 3Q-56 -4 -58 -16Z', I('N')), F('M-57 -13L62 -15L61 -11.4L-56.4 -9.4Z', I('R')),
        F('M-47 -1L49 -1L47.6 1.4L-45.6 1.4Z', I('P')), S('M-58 -16L64 -18', v('cloudRim'), 1.4),
        F('M-12 -24L20 -24L24 -17L-12 -17Z', v('cloudLit')), F(circ(-4, -20.5, 1.3) + circ(4, -20.5, 1.3) + circ(12, -20.5, 1.3), I('N'))) +
      h('g', DD('sea:O:lifebuoy'), F(circ(34, -9, 4.2), I('R')), F(circ(34, -9, 2), I('N')), S('M34 -13.2v2M34 -4.8v-2M29.8 -9h2M38.2 -9h-2', I('P'), 2)) +
      h('g', DD('sea:O:sailboat-jib'), F('M5 -140L60 -19L18 -27Z', I('B')), S('M5 -140L18 -27', I('N'), 0.8), S('M9 -128L22 -30', I('P'), 0.5)) +
      h('g', DD('sea:O:sailboat-mainsail'), F(`M0 -154C-10 -120 -36 -70 -56 -31L-1 -31Z`, v('cloudHigh')),
        F(poly([[-1, -88], [xl(-88), -88], [xl(-70), -70], [-1, -70]]), I('R')),
        S([-128, -106, -56].map(y => `M${f(xl(y) + 1)} ${y}l12 -0.6`).join(''), I('N'), 1.1)) +
      h('g', DD('sea:T:sail-seams'), S(seams, I('B'), 0.55)) +
      h('g', DD('sea:O:sailboat-rigging'), F(rect(1, -158, 2.6, 142) + 'M3 -30L-60 -26.8L-60 -25L3 -28Z', I('N')),
        S('M2 -156L63 -18M2 -156L-57 -16M2 -118L-8 -17M2 -118L12 -17M-7 -112H11M-54 -26.5L-50 -16M18 -27L-4 -18M2 -156L-60 -27', I('N'), 0.7),
        F(circ(-52, -21, 1.1) + circ(8, -22.5, 1.1), I('N'))) +
      h('g', DD('sea:O:sailboat-flags'), h('g', { transform: 'translate(3 -158)' }, h('g', { 'data-ref': 'sea-burgee' }, F('M0 0L20 3.6L0 7.2Z', I('R')), F('M0 2.6L10 3.6L0 4.6Z', I('P'))))) +
      h('g', DD('sea:O:sailboat-flags'), S('M-58 -16L-64 -32', I('N'), 1),
        h('g', { transform: 'translate(-64 -32)' }, h('g', { 'data-ref': 'sea-ensign' }, F(rect(-13, 0, 13, 8.5), I('R')), F(rect(-13, 3.3, 13, 1.9) + rect(-8, 0, 1.9, 8.5), I('P'))))) +
      h('g', DD('sea:O:sailboat-crew'),
        F(rect(-40.5, -31, 9, 14), I('P')), F(rect(-40.5, -28.5, 9, 1.4) + rect(-40.5, -25.2, 9, 1.4) + rect(-40.5, -21.9, 9, 1.4), I('B')),
        F(circ(-36, -35, 3.8), I('K')), F('M-40.4 -37.4Q-36 -42.4 -31.6 -37.4Z', I('P')), F(rect(-40.6, -38.2, 9.2, 1.4), I('N')), F(circ(-36, -41.8, 1.3), I('R')),
        S('M-37 -26L-48 -21', I('P'), 2.6), S('M-50 -18.6L-40 -22', I('O'), 1.6),
        h('g', { transform: 'translate(-33 -28)' }, h('g', { 'data-ref': 'sea-crewArm' }, S('M0 0L6 -8', I('P'), 2.6), F(circ(6.6, -8.8, 1.5), I('K'))))) +
      h('g', { ...lampOn, 'data-ref': 'sea-nearlit', visibility: 'hidden' }, F(circ(2, -160, 1.8) + circ(-4, -20.5, 1.3) + circ(4, -20.5, 1.3) + circ(12, -20.5, 1.3), v('lamp')));
    m += wrapObj('near', art);
  }
  // ---- numbered can buoy, bell buoy with gull, pot floats
  m += wrapObj('can', h('g', DD('sea:O:can-buoy'),
    S('M0 -24V-33', I('N'), 1.4), F('M-4.4 -32L0 -40L4.4 -32Z', I('N')),
    F('M-8 -24H8V-1Q0 2 -8 -1Z', I('R')), F(rect(-8, -8, 16, 3.4), I('P')),
    h('g', { fill: 'none', stroke: I('P'), 'stroke-width': 1.7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, glyphs('3', -2.8, -21.5, 1)),
    S('M-14 1q7 -3 14 0q7 3 14 0', v('foam'), 1.4)));
  {
    let lat = 'M-12 -16L-5 -56M12 -16L5 -56M0 -16V-56';
    for (let k = 0; k < 3; k++) { const y0 = -16 - k * 13, y1 = y0 - 13, w0 = 12 - k * 2.3, w1 = 12 - (k + 1) * 2.3; lat += `M${f(-w0)} ${y0}L${f(w1)} ${y1}M${f(w0)} ${y0}L${f(-w1)} ${y1}`; }
    const gullStand = h('g', { transform: 'translate(0 -64)' }, h('g', { 'data-ref': 'sea-buoyGull', ...DD('sea:O:buoy-gull') },
      S('M-1 -1L-2 4M2 -1L2 4', I('O'), 1), F('M-9 -6C-9 -12 -2 -14 3 -12C6 -16 11 -16 12 -12C13 -10 12 -8 10 -7C8 -2 2 0 -3 -1C-7 -2 -11 -2 -14 -4Z', I('P')),
      F('M-10 -7C-6 -11 2 -11 6 -8C2 -5 -4 -4 -10 -5Z', I('B')), F('M-14 -4L-9 -6L-10 -4Z', I('N')), F('M12 -13l5 1.4l-5 1.2Z', I('O')), F(circ(9.4, -13, 0.8), I('N'))));
    m += wrapObj('bell', h('g', DD('sea:O:bell-buoy'),
      S('M-18 1q9 -4 18 0q9 4 18 0M-24 5q12 -3 24 0q12 3 24 0', v('foam'), 1.4),
      F('M-18 -6Q-18 -16 0 -18Q18 -16 18 -6L14 2L-14 2Z', I('R')), F('M-17.6 -10L17.6 -10L17.9 -6.6L-17.9 -6.6Z', I('P')),
      S(lat, v('cloudHigh'), 1.5), F(rect(-7, -59, 14, 3), v('cloudHigh')), F(rect(-3.5, -64, 7, 5), I('N')), F(rect(-2, -63, 4, 3), v('lamp')),
      h('g', { transform: 'translate(0 -48)' }, h('g', { 'data-ref': 'sea-bell' }, S('M0 0V3', I('N'), 1), F('M-5.4 13Q-5.4 3 0 2.4Q5.4 3 5.4 13L7 15L-7 15Z', I('O')), F('M-3.6 12Q-3.4 5 -0.6 4L0.4 4.2Q-2 6 -2 12Z', I('K')), F(circ(0, 16.6, 1.6), I('N')))),
      h('circle', { cy: -61.5, r: 10, fill: 'url(#sea-glowG)', ...lampOn, 'data-ref': 'sea-bellglow', visibility: 'hidden' })) + gullStand);
  }
  m += wrapObj('pots', h('g', DD('sea:O:pot-floats'),
    S('M-24 0V-14M2 0V-12M24 0V-16', I('N'), 1), F('M-24 -14l7 2l-7 2ZM2 -12l7 2l-7 2ZM24 -16l7 2l-7 2Z', I('T')),
    F(ell(-24, 0, 3.4, 2.6) + ell(24, 0, 3.4, 2.6), I('O')), F(ell(2, 0, 3.4, 2.6), I('R')), S('M-30 3q6 -2 12 0M-4 3q6 -2 12 0M18 3q6 -2 12 0', v('foam'), 1.1)));
  // ---- dolphin (leaps along an arc), splashes, fish, seal head
  const dolphin = h('g', { 'data-ref': 'sea-dolph' }, h('g', DD('sea:O:dolphin'),
    F('M-32 0C-24 -7 -4 -11 14 -9C24 -8 30 -5 34 -2L41 -1L34 1C26 4 12 6 -4 5C-16 4 -26 3 -32 0Z' + 'M-2 -10L-11 -20L7 -9Z' + 'M-30 0L-43 -9L-38 0L-43 9Z', I('N')),
    F('M-24 0.5C-12 -2 8 -3 30 -1.4L33 0.2C14 1.4 -6 2.6 -24 2.4Z', I('B')),
    F('M-20 3C-6 5 14 5 31 1L29 3C12 7 -6 6 -20 4.5Z', I('P')), F('M10 4L4 11L16 5Z', I('B')), F(circ(27, -3.4, 1.1), I('P')),
    S('M4 -8.4C14 -8.4 22 -6.4 29 -3.8', v('cloudRim'), 0.9)));
  const splash = k => h('g', { 'data-ref': 'sea-spl' + k, visibility: 'hidden' },
    F('M-10 0Q-8 -8 -5 -12Q-5 -5 -3 0ZM-2 0Q0 -14 2 -18Q3 -8 4 0ZM5 0Q8 -9 12 -11Q10 -4 9 0Z', v('foam')), S('M-18 2q9 -3 18 0q9 3 18 0', v('foam'), 1.4));
  m += wrapObj('dolphin', h('g', DD('sea:O:splash'), splash(0), splash(1)) + dolphin);
  const fish = k => h('g', { 'data-ref': 'sea-fish' + k, visibility: 'hidden' },
    F('M-7 0C-4 -3.4 3 -3.6 6 -0.6L9 -3L8.6 0L9 3L6 0.6C3 3.6 -4 3.4 -7 0Z', I('O')), S('M-5 0.6C-1 1.6 3 1.2 5 0.2', I('P'), 0.8), F(circ(-4.2, -0.8, 0.7), I('N')));
  m += wrapObj('fish', h('g', DD('sea:O:jumping-fish'), fish(0), fish(1)) + h('g', { 'data-ref': 'sea-fishRing', visibility: 'hidden' }, S('M-10 1q10 -3 20 0', v('foam'), 1.2)));
  defs += h('clipPath', { id: 'sea-sealclip' }, F(rect(-30, -40, 60, 40.5), '#000'));
  m += wrapObj('sealhead', h('g', DD('sea:O:seal-head'),
    h('g', { 'clip-path': 'url(#sea-sealclip)' }, h('g', { 'data-ref': 'sea-sealUp' },
      F('M-9 6C-10 -6 -7 -15 0 -16C7 -15 10 -6 9 6Z', I('B'), { stroke: I('N'), 'stroke-width': 1 }),
      F(ell(0, -8, 4.6, 3.2), v('cloudLit')), F(ell(0, -10.2, 1.6, 1.1), I('N')), F(circ(-3.4, -12.6, 1) + circ(3.4, -12.6, 1), I('N')),
      S('M2.6 -8.4l7 -1.4M2.6 -7.4l7 0.6M-2.6 -8.4l-7 -1.4M-2.6 -7.4l-7 0.6', I('P'), 0.45))),
    S('M-14 1q7 -3 14 0q7 3 14 0M-20 5q10 -2.6 20 0q10 2.6 20 0', v('foam'), 1.3)));
  // (journey easter egg) a whale off the old fort: back, flukes and a spout that blows every few seconds
  m += h('g', { 'data-ref': 'sea-whale', visibility: 'hidden' },
    F('M-60 0Q-50 -22 -6 -24Q30 -24 44 -6L52 0Z', I('N')) + F('M-44 -8Q-20 -18 20 -16', 'none', { stroke: I('B'), 'stroke-width': 1.6 }) + F('M-30 -21l6 -6l4 5z', I('N')) +
    F('M70 -4Q76 -22 92 -26Q84 -14 88 -4Q80 -10 70 -4Z', I('N')) + S('M-66 1q30 -4 60 0t60 0t40 0', v('foam'), 1.6) +
    h('g', { 'data-ref': 'sea-spout', transform: 'translate(-14 -24)' }, S('M0 0V-26M0 -20q-10 -8 -16 -4M0 -20q10 -8 16 -4M0 -12q-8 -4 -12 0M0 -12q8 -4 12 0', v('foam'), 2.2) +
      F('M-3 -30a3 3 0 0 1 6 0zM-18 -24a2.4 2.4 0 0 1 4.8 0zM13 -24a2.4 2.4 0 0 1 4.8 0z', v('foam'))));
  return { markup: m, defs };
}

// ---------------------------------------------------------------------------------------------- attach
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
      // ---- far layers
      set(r.hills, 'transform', `translate(${f(-(wrap((D - D0) * 0.05 + 2600, W_H) - 2600))} 0)`);
      const cx = clamp(routeX(D, ANCH.cape, LH.d), -6000, 6000);
      set(r.cape, 'transform', `translate(${f(cx)} 0)`);
      const night = lampOn > 0.02;
      vis(r.lhnight, night); vis(r.keeperlit, night); for (let k = 0; k < 3; k++) vis(r['townlit' + k], night); vis(r.pierglow, night); vis(r['glow-beacon'], night);
      vis(r.steamlit, night); vis(r.trawlit, night); vis(r.nearlit, night); vis(r.bellglow, night);
      if (night) {
        const th = red ? 0.35 : t * (Math.PI * 2 / 7.5);
        const c = Math.cos(th);
        r.beamRot.setAttribute('transform', `scale(${f(c)} 1)`);
        const flash = Math.max(0, 1 - Math.abs(c) * 3);
        r.lantern.setAttribute('transform', `scale(${f(0.7 + flash * 1.4)})`);
      }
      // ---- sea bands roll: each band scrolls at its own depth and bobs a little
      for (let i = 0; i < BANDS.length; i++) {
        const [d, W] = BANDS[i];
        const bob = red ? 0 : Math.sin(t * (0.9 + i * 0.23) + i * 1.7) * (0.5 + i * 0.35);
        const drift = red ? 0 : t * (3 + i * 2);
        set(r['w' + i], 'transform', `translate(${f(-wrap(D * d + drift, W))} ${f(bob)})`);
      }
      // ---- glitter paths
      const sun = fr.sun || { x: 1465, elev: 0.3 }, moon = fr.moon || { x: 500, elev: -1 };
      const sunOn = sun.elev > -0.24;
      vis(r.sunG, sunOn);
      if (sunOn) {
        const gx = sun.x + (cam.fx - 800) * 0.1, len = clamp(0.45 + Math.abs(sun.elev - 0.1) * 1.4, 0.45, 1);
        set(r.sunG, 'transform', `translate(${f(gx)} ${HZ}) scale(${f(0.9 + 0.4 * (1 - len))} ${f(len)}) translate(0 ${-HZ})`);
        for (let k = 0; k < 3; k++) set(r['sg' + k], 'transform', `translate(${red ? 0 : f(Math.sin(t * (1.3 + k * 0.4) + k * 2.1) * 5)} 0)`);
        for (let k = 0; k < 3; k++) { const p = red ? 0.8 : Math.max(0, Math.sin(t * (1.7 + k * 0.6) + k * 1.9)); set(r['spk' + k], 'transform', `scale(${f(p)})`); }
      }
      const moonOn = moon.elev > 0.02 && lampOn > 0.2;
      vis(r.moonG, moonOn);
      if (moonOn) {
        set(r.moonG, 'transform', `translate(${f(moon.x + (cam.fx - 800) * 0.1)} 0)`);
        for (let k = 0; k < 3; k++) set(r['mg' + k], 'transform', `translate(${red ? 0 : f(Math.sin(t * (1.1 + k * 0.5) + k) * 4)} 0)`);
      }
      // ---- harbour + rocks
      const hx = clamp(routeX(D, ANCH.harbour, HB.d), -6000, 6000);
      set(r.harbour, 'transform', `translate(${f(hx)} 0)`);
      if (hx > -900 && hx < 1700) set(r.millSails, 'transform', `rotate(${f(red ? 20 : wrap(t * 40, 360))})`);
      const rx = clamp(routeX(D, ANCH.rocks, RK.d), -6000, 6000);
      set(r.rocks, 'transform', `translate(${f(rx)} -16)`);
      if (!red) {
        set(r.foam, 'transform', `translate(0 ${f(Math.sin(t * 2.1) * 1.4)})`);
        set(r.sealHead, 'transform', `rotate(${f(Math.sin(t * 0.9) * 6 - 2)})`);
      }
      // ---- boats and buoys
      for (const [k, B] of Object.entries(BOATS)) {
        const el = obj[k]; if (!el) continue;
        const d = depthAt(B.y), x = place(t, D, B.x, d, B.vx, B.e + 400, B.S);
        // each pass of a boat is a different day on the water: seeded by its wrap cycle, thinned by the stretch
        const cyc = Math.floor((B.x + B.vx * (t - T0) - (D - D0) * d + B.e + 400) / B.S), cyc0 = Math.floor((B.x + B.e + 400) / B.S);
        const busy = { harbour: 0.05, village: 0.2, return: 0.2, pier: 0.25, funfair: 0.3, cliffs: 0.6, lighthouse: 0.5, dunes: 0.45 }[stretchAt(D).key] ?? 0.4;
        const here = cyc === cyc0 || hash(cyc, k.length * 7 + B.x) > busy;
        if (el.__here !== here) { el.__here = here; el.setAttribute('visibility', here ? 'visible' : 'hidden'); }
        if (!here) continue;
        const w = 0.8 + (B.y - 470) * 0.004, ph = B.x * 0.013;
        const bob = red ? 0 : Math.sin(t * w * 1.6 + ph) * (0.6 + B.s * 1.4);
        const rot = red ? 0 : Math.sin(t * w + ph) * (k === 'near' ? 2.2 : k === 'bell' || k === 'can' ? 4 : 1.4);
        const on = x > -B.e - 60 && x < 1600 + B.e + 60;
        if (k === 'dolphin' || k === 'fish' || k === 'sealhead') { set(el, 'transform', `translate(${f(x)} ${B.y})`); continue; }
        set(el, 'transform', `translate(${f(x)} ${f(B.y + bob)}) rotate(${f(rot)}) scale(${B.s})`);
        if (!on) continue;
        if (k === 'steamer') for (let i = 0; i < 5; i++) {
          const u = wrap(t / 3.2 + i / 5, 1);
          set(r['smoke' + i], 'transform', `translate(${f(17 + u * 58)} ${f(-38 - u * 20 - Math.sin(u * 5) * 2)}) scale(${f(0.35 + u * 1.25)})`);
          set(r['smoke' + i], 'opacity', f(u < 0.75 ? 1 : (1 - u) * 4));
        }
        if (k === 'near' && !red) {
          const fl = Math.sin(t * 11) * 0.12;
          set(r.burgee, 'transform', `scale(${f(1 + fl)} ${f(1 - fl * 0.6)})`);
          set(r.ensign, 'transform', `skewY(${f(Math.sin(t * 9 + 1) * 8)}) scale(${f(1 + Math.sin(t * 13) * 0.06)} 1)`);
          const wv = since(fr, 'wave'), wa = wv < 3 ? Math.sin(Math.min(1, wv / 0.3) * Math.PI / 2) * (1 - smooth01((wv - 2.4) / 0.6)) : 0;
          set(r.crewArm, 'transform', `rotate(${f(wa ? wa * (-40 + Math.sin(wv * 12) * 16) : 0)})`);
        }
        if (k === 'trawler' && !red) {
          set(r.gA, 'transform', `scale(1 ${f(0.7 + 0.5 * Math.sin(t * 7))})`);
          set(r.gB, 'transform', `scale(1 ${f(0.7 + 0.5 * Math.sin(t * 6.3 + 2))})`);
        }
        if (k === 'bell') {
          const be = since(fr, 'bell'), ring = be < 2.5 ? 22 * Math.exp(-be * 1.6) * Math.sin(be * 14) : 0;
          set(r.bell, 'transform', `rotate(${f(red ? 0 : ring + Math.sin(t * 2.3) * 7)})`);
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
