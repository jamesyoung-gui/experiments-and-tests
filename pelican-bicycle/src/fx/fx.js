// OWNER: fx. Layers: L-gulls-far (depth .15), L-shadow, L-fx-back, L-fx-front (depth 1).
// Style C (docs/STYLE-C.md): every effect is printed in the seven inks of the hour: flat shapes, hard-edged
// quantised glows (stacked flat rings, never gradients), key lines, letterpress sound words.
//
// Everything here is a PURE function of (t, distance, speed, cadence, events, pose, tod): particles live in fixed
// pools whose slots are re-used by a deterministic spawn schedule (slot k of a stream is born at k·dt, its look and
// path come from a hash of k), so renderAt(t) is exact, the loop can be scrubbed backwards, and there is zero DOM
// churn after build. Per frame we only write transforms / opacities / a few dash offsets, and only when they change.
//
//   L-gulls-far  far gull flock (4 flap frames by href), distant fireflies over the dunes at night
//   L-shadow     crisp N contact shadows (+ B penumbra ring) and a sun-projected cast shadow of bike + rider
//                (shear matrix from the sun / moon position, pelican parts follow the live joints)
//   L-fx-back    headlamp beam cone + road pool (3 quantised rings), escort gulls, wind curls, speed lines, fireflies
//   L-fx-front   dust puffs + grit from the rear tyre, landing burst + impact rays, feathers, dandelion seeds,
//                butterflies, a fly buzzing the fish basket, chrome glints, lamp flare + moths, event pops
//                (DING! / HOP! / GULP! on R/O bursts), bell notes, gulp drips, hearts, a spat-out fish bone,
//                wave action arcs
import { GROUND_Y, RIDER_X, BIKE } from '../contract.js';
import { h, refs, xf } from '../core/svg.js';
import { TIMING } from '../rig/solve.js';

export const id = 'fx';

// ------------------------------------------------------------------------------------------------ helpers
const f = x => { const r = Math.round(x * 100) / 100; return (r === 0 ? 0 : r).toString(); };
const f1 = x => { const r = Math.round(x * 10) / 10; return (r === 0 ? 0 : r).toString(); };
const TAU = Math.PI * 2, D2R = Math.PI / 180;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
const wrap = (x, m) => ((x % m) + m) % m;
const circ = (x, y, r) => `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
const poly = (pts, close = true) => 'M' + pts.map(p => f(p[0]) + ' ' + f(p[1])).join('L') + (close ? 'Z' : '');
const star4 = (r, w) => `M0 ${f(-r)}L${f(w)} ${f(-w)}L${f(r)} 0L${f(w)} ${f(w)}L0 ${f(r)}L${f(-w)} ${f(w)}L${f(-r)} 0L${f(-w)} ${f(-w)}Z`;
function smooth(pts, closed = true, k = 1 / 6) {
  const n = pts.length; const g = i => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  const m = closed ? n : n - 1;
  for (let i = 0; i < m; i++) {
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
    d += `C${f(p1[0] + (p2[0] - p0[0]) * k)} ${f(p1[1] + (p2[1] - p0[1]) * k)} ${f(p2[0] - (p3[0] - p1[0]) * k)} ${f(p2[1] - (p3[1] - p1[1]) * k)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + (closed ? 'Z' : '');
}
// integer hash -> [0,1): deterministic per particle id (no Math.random)
const hash = (a, b = 0) => {
  let x = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x632be5ab, 0xc2b2ae35);
  x ^= x >>> 15; x = Math.imul(x, 0x2c1b3c6d); x ^= x >>> 12; x = Math.imul(x, 0x297a2d39); x ^= x >>> 15;
  return (x >>> 0) / 4294967296;
};
const easeOutBack = u => { const c = 1.70158, v = u - 1; return 1 + (c + 1) * v * v * v + c * v * v; };
const DD = key => ({ 'data-detail': key });

// fly loop around the basket (rider-local): centre + half extents
const FLY_C = [198, -326], FLY_A = [54, 24];
// speed-line anchors (rider-local, just behind the trailing silhouette): scarf, back, tail, rear tyre
const SPEEDLINES = [[-96, -470], [-150, -402], [-182, -366], [-176, -344], [-232, -128], [-238, -100], [-230, -70], [-205, -36]];

// ------------------------------------------------------------------------------------------------ detail inventory
export const detailItems = [
  ['fx:O:gull-far', 'O', 'far flock of gulls: white bodies, grey mantles, black tips; 4-frame flap cycle, drifting with parallax'],
  ['fx:O:gull-escort', 'O', 'near companion gull (key-lined body, tail, tucked orange feet); the whole flock escorts the rider above 85 rpm'],
  ['fx:T:gull-wingtip-mirrors', 'T', 'white underwing with key line and covert line, black hand with primary separations and white "mirror" spots'],
  ['fx:O:gull-beak', 'O', 'yellow-orange gull bill with the red gonys spot (herring-gull field mark)'],
  ['fx:O:gull-eye', 'O', 'gull eye with catch-light'],
  ['fx:O:shadow-contact', 'O', 'crisp navy contact shadow under each tyre (shrinks / fades in a hop)'],
  ['fx:T:shadow-penumbra', 'T', 'second, hard-edged periwinkle penumbra ring around the contact shadow (quantised softness)'],
  ['fx:O:shadow-cast-bike', 'O', 'sun-projected cast shadow of the bicycle: elliptical wheel rings, hubs, frame tubes, saddle, bars, basket'],
  ['fx:O:shadow-cast-pelican', 'O', 'cast shadow of the pelican: body, neck, head, bill, pouch, crest, tail, wings and pedalling legs follow the live pose'],
  ['fx:O:dust-puff', 'O', 'dust puffs kicked from the rear tyre (paper puff with peach under-lobe), rate and size scale with speed'],
  ['fx:O:dust-grit', 'O', 'grit specks flicked up behind the rear tyre on ballistic arcs'],
  ['fx:O:feather-contour', 'O', 'drifting contour feather: vane, rachis, barbs, split notch'],
  ['fx:O:feather-down', 'O', 'drifting down plume (fluffy key-lined wisps)'],
  ['fx:O:seed-dandelion', 'O', 'dandelion seeds floating on the breeze: pappus rays with dot tips, stalk, seed'],
  ['fx:O:butterfly-monarch', 'O', 'monarch butterfly fluttering ahead of the bill (flap + glide), blown away when sprinting'],
  ['fx:T:butterfly-monarch-veins', 'T', 'black veins and border with white spots on the monarch wings'],
  ['fx:O:butterfly-white', 'O', 'cabbage-white butterfly chasing the scarf tail (black wing tip and spot)'],
  ['fx:O:dragonfly', 'O', 'dragonfly hovering and darting ahead of the front wheel: teal segmented abdomen, amber compound eye'],
  ['fx:T:dragonfly-venation', 'T', 'wing venation, cross-veins and pterostigma spots on the dragonfly wings'],
  ['fx:O:leaf-tumble', 'O', 'a teal almond leaf tumbling past on the breeze (3-D flip by scaleX)'],
  ['fx:O:basket-fly', 'O', 'a red-eyed fly buzzing figure-eights around the fish basket, wings flickering'],
  ['fx:T:fly-dotted-trail', 'T', 'cartoon dotted flight trail behind the fly'],
  ['fx:O:wind-curl', 'O', 'art-deco wind curls drawn on and wiped off behind the rider'],
  ['fx:O:glint-bell', 'O', 'four-point chrome glint twinkling on the bell (sun side)'],
  ['fx:O:glint-rim', 'O', 'eight-ray sparkle with ring on the rear rim, held on the sun side while the wheel turns under it'],
  ['fx:O:speed-lines', 'O', 'dry-brush speed lines above 80 rpm (toggle "speedlines")'],
  ['fx:O:land-dust-burst', 'O', 'landing dust burst spreading from both tyres'],
  ['fx:O:land-impact-rays', 'O', 'R/O impact ticks printed at both contact points on landing'],
  ['fx:O:pop-ding', 'O', 'letterpress DING! on an R burst with O/R impact rays'],
  ['fx:O:pop-hop', 'O', 'letterpress HOP! pop at take-off'],
  ['fx:O:pop-gulp', 'O', 'letterpress GULP! pop at the swallow'],
  ['fx:O:bell-notes', 'O', 'eighth note and beamed pair rising from the bell'],
  ['fx:O:gulp-drips', 'O', 'sea-water drips falling from the bill during the scoop'],
  ['fx:O:gulp-hearts', 'O', 'little hearts rising after the gulp'],
  ['fx:O:fish-bone', 'O', 'fish bone spat over the shoulder, landing on the road and scrolling away'],
  ['fx:O:wave-arcs', 'O', 'rubber-hose action arcs beside the waving wing'],
  ['fx:O:headlamp-beam', 'O', 'night headlamp cone and road pool in three hard-edged quantised rings'],
  ['fx:O:lamp-flare', 'O', 'quantised lamp flare rings and star on the headlamp at night'],
  ['fx:O:moths', 'O', 'moths circling the headlamp at night'],
  ['fx:O:fireflies', 'O', 'fireflies with 3-ring quantised glow, blinking out of phase at night'],
  ['fx:O:fireflies-far', 'O', 'distant firefly twinkles over the dunes'],
].map(([key, kind, what]) => ({ id: key.split(':')[2], layer: 'fx', kind, what, key }));

// ------------------------------------------------------------------------------------------------ lettering
// Stroke-built art-deco capitals (as drafts/C-poster/gen.mjs): monoline strokes in a 100-high box, clipped flush
// to cap- and base-line so the terminals are square.
const LET = {
  D: { w: 78, s: ['M12 -10V110', 'M12 12H40A26 38 0 0 1 40 88H12'] },
  I: { w: 24, s: ['M12 -10V110'] },
  N: { w: 82, s: ['M12 112V-2L70 102V-12'] },
  G: { w: 80, s: ['M78 12H46A34 38 0 0 0 46 88H68', 'M68 110V50', 'M44 56H80'] },
  H: { w: 80, s: ['M12 -10V110', 'M68 -10V110', 'M12 50H68'] },
  O: { w: 84, s: ['M42 12A30 38 0 1 0 42 88A30 38 0 1 0 42 12Z'] },
  P: { w: 76, s: ['M12 112V12H40A24 23 0 0 1 40 58H12'] },
  U: { w: 80, s: ['M12 -10V56A28 32 0 0 0 68 56V-10'] },
  L: { w: 60, s: ['M12 -10V88H60'] },
  '!': { w: 24, s: ['M12 -10V64', 'M12 78V110'] },
};
function wordDef(word) {
  let pen = 0, d = '';
  for (const ch of word) { const L = LET[ch]; for (const s of L.s) d += `<path transform="translate(${pen} 0)" d="${s}"/>`; pen += L.w + 11; }
  const w = pen - 11;
  const defs = h('clipPath', { id: `fx-wc-${word.replace('!', '')}` }, h('rect', { x: -30, y: 0, width: w + 60, height: 100 })) +
    `<g id="fx-wd-${word.replace('!', '')}" clip-path="url(#fx-wc-${word.replace('!', '')})" fill="none" stroke-miterlimit="12">${d}</g>`;
  return { w, defs };
}

// ------------------------------------------------------------------------------------------------ build
export function build(ctx) {
  const { v, rng } = ctx;
  const I = k => v('ink' + k);
  let defs = '';
  const L = { far: '', shadow: '', back: '', front: '' };

  // ============================================== gull (side view, facing +x). Wings drawn raised; flap = scaleY.
  const GBODY = smooth([[21.5, -4.6], [15, -8.6], [8, -7.2], [-4, -5], [-18, -3.2], [-31, -2.8], [-31.5, 0.6], [-18, 3.4], [-4, 6.6], [10, 5.6], [19, 1.8], [22, 0.4]]);
  const GBEAK = poly([[21.2, -4.3], [29, -2.8], [33.6, -0.8], [32.2, 1.1], [29.6, 0.6], [21.6, 0.8]]);
  const wingNear = (s, far) => {
    // raised wing seen from the side: white arm (underwing) with a B key line, black hand with white mirrors;
    // pivot = shoulder (0,0). The far wing prints flat N (STYLE-C far-side rule).
    const arm = smooth([[6, 0.6], [5, -12], [2.4, -24.5], [-3, -25.5], [-8.6, -24], [-12.4, -13], [-16.5, -2.6], [-6, 1.6]]);
    const hand = poly([[2.4, -24.5], [-4.4, -34], [-11, -42], [-17.6, -48.6], [-19.6, -45.4], [-16.4, -38], [-12, -29.5], [-8.6, -24]]);
    const primaries = 'M-4.4 -34L-8.8 -30.4M-8 -38.4L-12.2 -34.6M-11.8 -42.6L-15.4 -39.8';
    if (far) return h('g', { transform: `scale(1 ${f(s)})` }, h('path', { d: arm + hand, fill: I('N') }));
    return h('g', { transform: `scale(1 ${f(s)})` },
      h('path', { d: arm, fill: I('P'), stroke: I('B'), 'stroke-width': 1.2, 'stroke-linejoin': 'round' }),
      h('path', { d: 'M-12 -13.4Q-5 -12 1.8 -14.2', fill: 'none', stroke: I('B'), 'stroke-width': 0.7, 'stroke-linecap': 'round' }),
      h('g', DD('fx:T:gull-wingtip-mirrors'),
        h('path', { d: hand, fill: I('N') }),
        h('path', { d: primaries, fill: 'none', stroke: I('B'), 'stroke-width': 0.6 }),
        h('path', { d: circ(-15.6, -44.4, 1.3) + circ(-11.2, -37.4, 0.9), fill: I('P') })));
  };
  const gullBody = (detail) => h('g', {},
    h('path', { d: GBODY, fill: I('P'), stroke: I('B'), 'stroke-width': 1.3, 'stroke-linejoin': 'round' }),
    h('path', { d: 'M-24 -1.3L-31 -1.2', stroke: I('B'), 'stroke-width': 0.8, fill: 'none' }),
    h('path', { d: 'M-5 5.6L-14.5 7.6M-2.5 6L-12 9', fill: 'none', stroke: I('O'), 'stroke-width': 1.5, 'stroke-linecap': 'round' }),
    h('g', detail ? DD('fx:O:gull-beak') : {}, h('path', { d: GBEAK, fill: I('O') }), h('path', { d: circ(30.2, 0.4, 1.05), fill: I('R') })),
    h('g', detail ? DD('fx:O:gull-eye') : {}, h('path', { d: circ(15.2, -4.6, 1.45), fill: I('N') }), h('path', { d: circ(15.6, -5, 0.45), fill: I('P') })));
  // far gull frames (4 flap positions), used by <use href> swap
  const FRAMES = [1, 0.4, -0.35, -0.9];
  FRAMES.forEach((s, i) => {
    defs += h('g', { id: 'fx-gf' + i },
      h('g', { transform: 'translate(3 -4.5) scale(0.86)' }, wingNear(s, true)), gullBody(false), h('g', { transform: 'translate(1 -4)' }, wingNear(s, false)));
  });
  // far flock: two loose groups (L-gulls-far)
  const R = rng('fx-gulls');
  const FAR = [];
  for (let i = 0; i < 7; i++) {
    const grp = i < 4 ? 0 : 1;
    FAR.push({ x0: grp * 1300 + i * 70 + R() * 50, y: (grp ? 150 : 205) + (i % 4) * 22 + R() * 18, s: 0.34 + R() * 0.14, f: 2.4 + R() * 1.2, ph: R() * 10, gl: R() * 10 });
  }
  L.far += h('g', {}, FAR.map((g, i) => h('use', { 'data-ref': 'fx-gfar' + i, ...DD('fx:O:gull-far'), href: '#fx-gf1', transform: `translate(${f(g.x0)} ${f(g.y)}) scale(${f(g.s)})` })));
  // escort gulls (L-fx-back): continuous flap
  const ESC = [
    { idle: [400, 262], st: [455, 318], s: 1.15 },
    { idle: [-300, 420], st: [300, 405], s: 1.0 },
    { idle: [-300, 200], st: [612, 178], s: 0.92 },
    { idle: [-300, 120], st: [1115, 168], s: 0.85 },
  ];
  L.back += h('g', { 'data-ref': 'fx-escort' }, ESC.map((g, i) => h('g', { 'data-ref': 'fx-esc' + i, transform: `translate(${g.idle[0]} ${g.idle[1]}) scale(${g.s})`, ...(i === 0 ? DD('fx:O:gull-escort') : {}) },
    h('g', { transform: 'translate(3 -4.5) scale(0.86)' }, h('g', { 'data-ref': 'fx-escWf' + i }, wingNear(1, true))),
    gullBody(i === 0),
    h('g', { transform: 'translate(1 -4)' }, h('g', { 'data-ref': 'fx-escWn' + i }, wingNear(1, false))))));

  // ============================================== shadow (L-shadow)
  // contact shadows (world), cast shadow group (rider-local coordinates under a sun-projection matrix)
  const [rhx] = BIKE.rearHub, [fhx] = BIKE.frontHub;
  const contact = (ref, x) => h('g', { 'data-ref': ref, transform: `translate(${RIDER_X + x} ${GROUND_Y + 1})` },
    h('ellipse', { cy: 1.6, rx: 62, ry: 7, fill: I('B'), ...DD('fx:T:shadow-penumbra') }),
    h('ellipse', { rx: 33, ry: 4.2, fill: I('N'), ...DD('fx:O:shadow-contact') }));
  const B = BIKE;
  const tube = (a, b) => `M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}`;
  const frameD = [tube(B.rearHub, B.bb), tube(B.rearHub, B.seatTubeTop), tube(B.bb, B.seatClamp), tube(B.seatTubeTop, B.headTop), tube(B.bb, B.headBottom),
    tube(B.headTop, B.frontHub), tube(B.steererTop, B.stem), tube(B.stem, B.gripNear), tube(B.seatClamp, [-60.5, -287])].join('');
  const bikeShadow = h('g', { ...DD('fx:O:shadow-cast-bike') },
    h('path', { d: circ(rhx, -100, 95.5) + circ(fhx, -100, 95.5), fill: 'none', stroke: 'currentColor', 'stroke-width': 10 }),
    h('path', { d: circ(rhx, -100, 7) + circ(fhx, -100, 7) + circ(0, -80, 30), fill: 'currentColor' }),
    h('path', { d: frameD, fill: 'none', stroke: 'currentColor', 'stroke-width': 7, 'stroke-linecap': 'round' }),
    h('path', { d: 'M-101 -287Q-60 -296 -23 -287L-40 -279H-90Z', fill: 'currentColor' }),
    h('path', { d: poly([[B.basket.x0, B.basket.y0], [B.basket.x1, B.basket.y0], [B.basket.x1 - 6, B.basket.y1], [B.basket.x0 + 6, B.basket.y1]]), fill: 'currentColor' }));
  // pelican: one capsule per slot, sized from the slot art's bbox in attach(); the neck is a live thick stroke
  const PSLOTS = ['tail', 'wingFarUpper', 'thighFar', 'shankFar', 'footFar', 'body', 'crest', 'head', 'pouch', 'billLower', 'billUpper', 'thighNear', 'shankNear', 'footNear', 'wingNearUpper', 'wingNearLower'];
  const pelShadow = h('g', { ...DD('fx:O:shadow-cast-pelican') },
    h('path', { 'data-ref': 'fx-shNeck', d: 'M0 0L0 0', fill: 'none', stroke: 'currentColor', 'stroke-width': 34, 'stroke-linecap': 'round' }),
    PSLOTS.map(s => h('g', { 'data-ref': 'fx-sh-' + s }, h('rect', { 'data-ref': 'fx-shr-' + s, x: 0, y: 0, width: 0, height: 0, fill: 'currentColor' }))));
  L.shadow += h('g', { 'data-ref': 'fx-cast', style: 'opacity:calc(var(--pb-n-shadowAlpha) * 1.75)', color: I('B') },
    h('g', { 'data-ref': 'fx-castM' }, h('g', { 'data-ref': 'fx-castP' }, bikeShadow, pelShadow)));
  L.shadow += h('g', { style: 'opacity:calc(0.5 + var(--pb-n-shadowAlpha))' }, contact('fx-cR', rhx), contact('fx-cF', fhx));

  // ============================================== headlamp beam (L-fx-back, rider-local)
  const lamp = B.lamp;
  const beamRing = (cx, rx, ry, reach, op) => h('g', { opacity: op },
    h('path', { d: poly([[lamp[0] + 2, lamp[1] - 5], [cx + rx * 0.92, -ry * 0.4], [cx, ry], [cx - rx * 0.9, ry * 0.2], [lamp[0] + 2, lamp[1] + 5]]), fill: v('headlamp') }),
    h('ellipse', { cx, cy: 4, rx, ry, fill: v('headlamp') }));
  L.back += h('g', { 'data-ref': 'fx-riderB' },
    h('g', { 'data-ref': 'fx-beam', style: 'opacity:var(--pb-n-lampOn)', ...DD('fx:O:headlamp-beam') },
      beamRing(620, 330, 22, 0, 0.13), beamRing(590, 245, 16, 0, 0.14), beamRing(560, 150, 10, 0, 0.18)));

  // ============================================== fireflies (L-fx-back near) + far twinkles (L-gulls-far)
  const glowDot = (a, b, c) => h('path', { d: circ(0, 0, a), fill: v('lampGlow'), opacity: 0.22 }) + h('path', { d: circ(0, 0, b), fill: v('lamp'), opacity: 0.5 }) + h('path', { d: circ(0, 0, c), fill: v('headlamp') });
  const FF = [];
  const Rf = rng('fx-ff');
  for (let i = 0; i < 8; i++) FF.push({ x: 180 + i * 150 + Rf() * 60, y: 360 + Rf() * 380, ax: 20 + Rf() * 30, ay: 12 + Rf() * 22, w: 0.4 + Rf() * 0.5, p: 2.2 + Rf() * 2.4, ph: Rf() });
  L.back += h('g', { 'data-ref': 'fx-ffG', visibility: 'hidden' }, FF.map((q, i) => h('g', { 'data-ref': 'fx-ff' + i, ...DD('fx:O:fireflies') }, glowDot(12, 6.5, 2.6))));
  const FFF = [];
  for (let i = 0; i < 6; i++) FFF.push({ x: Rf() * 2600 - 500, y: 500 + Rf() * 70, p: 1.6 + Rf() * 2, ph: Rf() });
  L.far += h('g', { 'data-ref': 'fx-fffG', visibility: 'hidden' }, FFF.map((q, i) => h('g', { 'data-ref': 'fx-fff' + i, ...DD('fx:O:fireflies-far') }, glowDot(5, 2.6, 1.2))));

  // ============================================== wind curls + speed lines (L-fx-back)
  const CURL = ['M0 0C-28 -3 -52 3 -70 -3C-84 -8 -82 -24 -70 -23C-61 -22 -61 -12 -69 -13', 'M-10 9C-26 7 -38 11 -50 8'];
  L.back += h('g', { ...DD('fx:O:wind-curl') }, [0, 1, 2].map(i => h('g', { 'data-ref': 'fx-curl' + i, visibility: 'hidden' },
    CURL.map((d, k) => h('path', { 'data-ref': `fx-curl${i}p${k}`, d, pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, fill: 'none', stroke: I('P'), 'stroke-width': k ? 1.8 : 2.4, 'stroke-linecap': 'round' })))));
  const SL = [];
  for (let i = 0; i < 8; i++) SL.push(i);
  // tapered dry-brush strokes: heavy where they leave the silhouette, hairline tails, a broken second bristle
  const SLD = ['M0 -2.6C-30 -1.8 -70 -0.5 -100 0C-70 0.5 -30 1.8 0 2.6ZM-14 5.4L-17 4.2L-58 5.1L-17 6.6Z', 'M0 -2.1C-26 -1.4 -60 -0.4 -86 0C-60 0.4 -26 1.4 0 2.1ZM-30 -4.4L-33 -5.6L-74 -4.9L-33 -3.4Z'];
  L.front += h('g', { 'data-ref': 'fx-slG', visibility: 'hidden', ...DD('fx:O:speed-lines') }, SL.map(i => h('path', {
    'data-ref': 'fx-sl' + i, d: SLD[i % 2], fill: I('N'), visibility: 'hidden',
  })));


  // escort gulls go behind the rider but above the beam (already appended)

  // ============================================== dust + grit + landing (L-fx-front)
  const PUFF = circ(0, -0.6, 5.6) + circ(5.6, -1.6, 4.2) + circ(-5.2, 0.8, 3.8) + circ(1.2, -4.8, 3.4);
  const puff = (ref, key) => h('g', { 'data-ref': ref, visibility: 'hidden', ...DD(key) },
    h('path', { d: PUFF, fill: I('P') }),
    h('path', { d: 'M-8.8 2.2Q0 6.4 9.6 0.8Q9 3.4 5 4Q0 6 -5 4.6Q-8 4 -8.8 2.2Z', fill: I('O') }),
    h('path', { d: 'M-3 -3.2A4 4 0 0 1 2.4 -6.4', fill: 'none', stroke: I('K'), 'stroke-width': 0.9, 'stroke-linecap': 'round' }));
  const NDUST = 10, NGRIT = 10, NBURST = 8;
  L.front += h('g', {}, Array.from({ length: NDUST }, (_, i) => puff('fx-dust' + i, 'fx:O:dust-puff')));
  L.front += h('g', {}, Array.from({ length: NGRIT }, (_, i) => h('path', {
    'data-ref': 'fx-grit' + i, ...DD('fx:O:dust-grit'), visibility: 'hidden', d: i % 3 ? circ(0, 0, 1.5) : 'M-1.8 -1.2L1.9 -0.6L0.4 1.8Z', fill: i % 3 === 1 ? I('O') : I('N'),
  })));
  L.front += h('g', { 'data-ref': 'fx-burstG', visibility: 'hidden' }, Array.from({ length: NBURST }, (_, i) => puff('fx-bp' + i, 'fx:O:land-dust-burst')));
  const tick = (a, r0, r1, w) => { const c = Math.cos(a * D2R), s = Math.sin(a * D2R), n = [-s * w, c * w]; return poly([[c * r0 - n[0], s * r0 - n[1]], [c * r1, s * r1], [c * r0 + n[0], s * r0 + n[1]]]); };
  const impact = ref => h('g', { 'data-ref': ref },
    h('path', { d: [-160, -120, -80, -40].map(a => tick(a, 14, 34, 2.6)).join(''), fill: I('R') }),
    h('path', { d: [-140, -100, -60, -20].map(a => tick(a, 16, 28, 2)).join(''), fill: I('O') }));
  L.front += h('g', { 'data-ref': 'fx-impG', visibility: 'hidden', ...DD('fx:O:land-impact-rays') }, impact('fx-impR'), impact('fx-impF'));

  // ============================================== feathers, seeds (L-fx-front)
  const contourFeather = h('g', { ...DD('fx:O:feather-contour') },
    h('path', { d: 'M0 0C3 -4 10 -7 18 -6.4C23 -6 26 -3.6 27 -1C24 1.6 19 3.2 12 3.2L10.6 1.2L9 3.2C5 3 2 2 0 0Z', fill: I('P'), stroke: I('B'), 'stroke-width': 1, 'stroke-linejoin': 'round' }),
    h('path', { d: 'M-4 1.2C4 0 14 -0.8 26.4 -1.2', fill: 'none', stroke: I('B'), 'stroke-width': 0.9, 'stroke-linecap': 'round' }),
    h('path', { d: 'M8 -0.4L12 -5M13 -0.7L17 -5.6M18 -0.9L21.4 -5M14 -0.6L17 2.8M20 -1L22.6 1.8', fill: 'none', stroke: I('B'), 'stroke-width': 0.55, 'stroke-linecap': 'round' }));
  const downD = [[0, 0, -8, -9], [0, 0, 0, -12], [0, 0, 8, -9], [0, 0, 11, -2], [0, 0, -11, -2], [0, 0, -5, -11], [0, 0, 5, -11]]
    .map(([x0, y0, x1, y1]) => `M${x0} ${y0}Q${f(x1 * 0.3 + y1 * 0.25)} ${f(y1 * 0.55 - x1 * 0.2)} ${x1} ${y1}`).join('');
  const downFeather = h('g', { ...DD('fx:O:feather-down') },
    h('path', { d: downD + 'M0 0L0.6 5', fill: 'none', stroke: I('B'), 'stroke-width': 3, 'stroke-linecap': 'round' }),
    h('path', { d: downD + 'M0 0L0.6 5', fill: 'none', stroke: I('P'), 'stroke-width': 1.7, 'stroke-linecap': 'round' }));
  L.front += h('g', {}, [contourFeather, downFeather, contourFeather].map((fe, i) => h('g', { 'data-ref': 'fx-fea' + i, visibility: 'hidden' }, i === 2 ? fe.replace(/ data-detail="[^"]*"/, '') : fe)));
  const seedRays = Array.from({ length: 9 }, (_, i) => { const a = (-165 + i * (150 / 8)) * D2R; return [Math.cos(a) * 6, Math.sin(a) * 6]; });
  const seed = h('g', {},
    h('path', { d: seedRays.map(([x, y]) => `M0 0L${f(x)} ${f(y)}`).join('') + 'M0 0L0.4 9', fill: 'none', stroke: I('P'), 'stroke-width': 0.7, 'stroke-linecap': 'round' }),
    h('path', { d: seedRays.map(([x, y]) => circ(x, y, 0.75)).join(''), fill: I('P') }),
    h('ellipse', { cx: 0.45, cy: 10.4, rx: 0.9, ry: 1.9, fill: I('O') }));
  L.front += h('g', { 'data-ref': 'fx-seedG' }, [0, 1, 2, 3].map(i => h('g', { 'data-ref': 'fx-seed' + i, ...DD('fx:O:seed-dandelion') }, seed)));

  // ============================================== butterflies + fly (L-fx-front)
  const FW = 'M0.5 -1C2 -6 5 -13 7.5 -17C4 -18.8 -2 -17.8 -5 -14C-4.5 -9 -2.5 -4 0.5 -1Z';
  const HW = 'M-0.5 -0.8C-3 -3 -6 -6 -8.5 -10.4C-10.4 -7 -10.2 -3.4 -7.5 -1.4C-5 -0.4 -2.5 -0.4 -0.5 -0.8Z';
  const bfBody = h('path', { d: 'M-5 0.4C-3 -0.9 3 -1.1 5 -0.2C3 1.1 -3 1.4 -5 0.4Z' + circ(5.9, -0.4, 1.35), fill: I('N') }) +
    h('path', { d: 'M6 -1.2Q8.4 -5.4 10.6 -7.2M6.3 -0.8Q9.6 -4.4 12.2 -5.2', fill: 'none', stroke: I('N'), 'stroke-width': 0.5, 'stroke-linecap': 'round' }) +
    h('path', { d: circ(10.6, -7.2, 0.6) + circ(12.2, -5.2, 0.6), fill: I('N') });
  const monarch = h('g', { 'data-ref': 'fx-bf0', ...DD('fx:O:butterfly-monarch') },
    h('g', { 'data-ref': 'fx-bfw0' },
      h('path', { d: FW + HW, fill: I('O'), stroke: I('N'), 'stroke-width': 1.5, 'stroke-linejoin': 'round' }),
      h('g', { ...DD('fx:T:butterfly-monarch-veins') },
        h('path', { d: 'M0.5 -1.4L6 -15.4M0 -1.6L1.6 -16.8M-0.6 -1.6L-3.6 -14M-0.5 -1L-7.6 -9.2M-0.8 -0.9L-9 -4.6M1.2 -9L4.4 -8.2', fill: 'none', stroke: I('N'), 'stroke-width': 0.6, 'stroke-linecap': 'round' }),
        h('path', { d: [[6.2, -16.2], [3.4, -17.9], [0.4, -17.8], [-2.6, -16.6], [-8, -8.6], [-9.4, -5.2], [-8.4, -2.4]].map(([x, y]) => circ(x, y, 0.42)).join('') + circ(4.6, -15.2, 0.7), fill: I('P') }))),
    bfBody);
  const white = h('g', { 'data-ref': 'fx-bf1', ...DD('fx:O:butterfly-white') },
    h('g', { 'data-ref': 'fx-bfw1' },
      h('path', { d: FW + HW, fill: I('P'), stroke: I('B'), 'stroke-width': 1.1, 'stroke-linejoin': 'round' }),
      h('path', { d: 'M7.5 -17C5 -18.6 2.6 -18.3 1 -17.4L3 -13.2C4.8 -14.2 6.4 -15.4 7.5 -17Z' + circ(0.6, -10, 1.15) + circ(-5.4, -6.2, 0.8), fill: I('N') })),
    bfBody);
  L.front += monarch + white;
  // dragonfly (hover-and-dart ahead of the front wheel): segmented teal abdomen, big compound eyes, veined wings
  const dWing = (x, y, len, w, rot) => `M${x} ${y}C${f(x - w * 0.6)} ${f(y - len * 0.35)} ${f(x - w * 0.5)} ${f(y - len)} ${f(x + w * 0.2)} ${f(y - len)}C${f(x + w * 0.6)} ${f(y - len * 0.8)} ${f(x + w * 0.4)} ${f(y - len * 0.3)} ${x} ${y}Z`;
  const dragonfly = h('g', { 'data-ref': 'fx-dfly', ...DD('fx:O:dragonfly') },
    h('g', { 'data-ref': 'fx-dflyW' },
      h('path', { d: dWing(1, -1, 15, 5, 0) + dWing(-2.4, -1, 13.5, 5, 0), fill: I('P'), stroke: I('B'), 'stroke-width': 0.7, 'stroke-linejoin': 'round', opacity: 0.92 }),
      h('path', { ...DD('fx:T:dragonfly-venation'), d: 'M1 -1L0.8 -15M-2.4 -1L-3.2 -13.4M-0.6 -7L2.6 -8.4M-0.6 -11L2.2 -12.6M-3.8 -6.4L-0.6 -7.4M-4 -10.2L-1 -11', fill: 'none', stroke: I('B'), 'stroke-width': 0.5 }),
      h('path', { d: circ(2.3, -13.6, 0.8) + circ(-1.4, -12, 0.8), fill: I('N') })),
    h('path', { d: 'M-2 -0.9L-22 -0.5L-23.4 0.3L-22 1L-2 1.2Z', fill: I('T') }),
    h('path', { d: [-5, -8, -11, -14, -17, -20].map(x => `M${x} -0.8V1.1`).join(''), stroke: I('N'), 'stroke-width': 0.8, fill: 'none' }),
    h('path', { d: 'M-2.6 -1.8C0 -2.8 3.6 -2.6 4.6 -0.8C3.8 1.2 0 1.8 -2.6 1.2Z', fill: I('T') }),
    h('path', { d: circ(5.6, -0.4, 2.3), fill: I('O') }), h('path', { d: circ(6.2, -1.1, 0.7), fill: I('P') }));
  L.front += dragonfly;
  // tumbling almond leaf carried on the breeze
  L.front += h('g', { 'data-ref': 'fx-leaf', visibility: 'hidden', ...DD('fx:O:leaf-tumble') }, h('g', { 'data-ref': 'fx-leafS' },
    h('path', { d: 'M-12 0C-6 -7 6 -7.6 13 0C6 6.6 -6 6.4 -12 0Z', fill: I('T') }),
    h('path', { d: 'M-15 0.6L12 0M-6 0.3L-2.6 -4.2M-1 0.2L2.6 -4.6M4 0.1L7 -3.6M-4 0.3L-1 4.2M1.6 0.2L4.6 4.2', fill: 'none', stroke: I('N'), 'stroke-width': 0.8, 'stroke-linecap': 'round' })));
  // fly loop around the basket (rider-local), with a cartoon dotted trail
  const flyPt = u => [FLY_C[0] + FLY_A[0] * Math.sin(TAU * u), FLY_C[1] + FLY_A[1] * Math.sin(2 * TAU * u) - 10 * Math.cos(TAU * u)];
  const FLYN = 120, flyPts = Array.from({ length: FLYN }, (_, i) => flyPt(i / FLYN));
  const flyLen = [0]; for (let i = 1; i <= FLYN; i++) { const a = flyPts[i - 1], b = flyPts[i % FLYN]; flyLen.push(flyLen[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const flyTotal = flyLen[FLYN];
  const flyG = h('g', { 'data-ref': 'fx-flyG' },
    h('path', { 'data-ref': 'fx-flyTrail', d: poly(flyPts), fill: 'none', stroke: I('N'), 'stroke-width': 1.9, 'stroke-linecap': 'round', 'stroke-dasharray': `${'0 5.5 '.repeat(7)}0 ${f(flyTotal - 38.5)}`, ...DD('fx:T:fly-dotted-trail') }),
    h('g', { 'data-ref': 'fx-fly', ...DD('fx:O:basket-fly') },
      h('g', { 'data-ref': 'fx-flyW' }, h('path', { d: 'M-0.5 -1.2C-3 -6 -7 -6.4 -6.4 -3.6C-6 -2 -3 -1.2 -0.5 -1.2ZM0.4 -1.2C0 -6.4 3.2 -7.6 3.6 -4.8C3.8 -3 2 -1.6 0.4 -1.2Z', fill: I('P'), stroke: I('B'), 'stroke-width': 0.5 })),
      h('path', { d: 'M-3.4 0C-3.4 -1.6 1.6 -2 2.6 -0.4C2 1.6 -3 1.6 -3.4 0Z' + circ(3.6, -0.6, 1.5), fill: I('N') }),
      h('path', { d: circ(4.3, -1.1, 0.7), fill: I('R') })));

  // ============================================== glints, lamp flare, moths, wave arcs (L-fx-front, rider-local)
  const flare = h('g', { 'data-ref': 'fx-flare', transform: `translate(${lamp[0] + 5} ${lamp[1]})`, style: 'opacity:var(--pb-n-lampOn)', ...DD('fx:O:lamp-flare') },
    h('path', { d: circ(0, 0, 30), fill: v('lampGlow'), opacity: 0.2 }), h('path', { d: circ(0, 0, 18), fill: v('lamp'), opacity: 0.35 }),
    h('path', { d: circ(0, 0, 8.5), fill: v('headlamp'), opacity: 0.85 }),
    h('path', { 'data-ref': 'fx-flareStar', d: star4(26, 1.4), fill: v('headlamp') }));
  const moth = i => h('g', { 'data-ref': 'fx-moth' + i },
    h('g', { 'data-ref': 'fx-mothW' + i }, h('path', { d: 'M1 -0.6L-3.4 -6.4L-6.2 -4.6L-4.6 -0.4Z', fill: I('P'), stroke: I('B'), 'stroke-width': 0.7, 'stroke-linejoin': 'round' })),
    h('path', { d: 'M-4.2 0.4C-3 -1 2 -1.2 3 0C2 1.1 -3 1.3 -4.2 0.4Z', fill: I('B') }));
  const glintBell = h('g', { 'data-ref': 'fx-glB', ...DD('fx:O:glint-bell') }, h('path', { d: star4(12.5, 1.5) + circ(0, 0, 2), fill: I('P') }));
  const glintRim = h('g', { 'data-ref': 'fx-glR', ...DD('fx:O:glint-rim') },
    h('path', { d: star4(14, 1.4), fill: I('P') }), h('path', { d: star4(6.6, 1), fill: I('P'), transform: 'rotate(45)' }),
    h('path', { d: circ(0, 0, 3.4), fill: 'none', stroke: I('P'), 'stroke-width': 0.9 }));
  const waveArcs = h('g', { 'data-ref': 'fx-waveArcs', visibility: 'hidden', ...DD('fx:O:wave-arcs') },
    h('path', { d: 'M-8 -40A42 42 0 0 1 30 -44M-2 -52A54 54 0 0 1 36 -58M14 -30A30 30 0 0 1 34 -32', fill: 'none', stroke: I('N'), 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-dasharray': '14 5 40' }));
  L.front += h('g', { 'data-ref': 'fx-riderF' }, flyG, glintBell, glintRim, flare, h('g', { 'data-ref': 'fx-mothG', visibility: 'hidden', ...DD('fx:O:moths') }, [0, 1, 2].map(moth)), waveArcs);

  // ============================================== pops (L-fx-front, world)
  const burst = (rx, ry, n, seed) => {
    const Rb = rng('fx-burst' + seed), pts = [];
    for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * TAU, r = i % 2 ? 0.74 + Rb() * 0.06 : 1 + Rb() * 0.12; pts.push([Math.cos(a) * rx * r, Math.sin(a) * ry * r]); }
    return poly(pts);
  };
  const rays = (rx, ry, n) => {
    let dR = '', dO = '';
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + 0.12, c = Math.cos(a), s = Math.sin(a), w = 0.07;
      const p = (r, da) => [Math.cos(a + da) * rx * r, Math.sin(a + da) * ry * r];
      const d = poly([p(1.02, -w * 0.8), p(i % 2 ? 1.34 : 1.5, 0), p(1.02, w * 0.8)]);
      if (i % 2) dO += d; else dR += d;
      void c; void s;
    }
    return h('path', { d: dR, fill: I('R') }) + h('path', { d: dO, fill: I('O') });
  };
  const words = {};
  for (const w of ['DING!', 'HOP!', 'GULP!']) { const wd = wordDef(w); defs += wd.defs; words[w] = wd.w; }
  const pop = (word, ref, key, rx, ry, sc) => {
    const k = word.replace('!', ''), w = words[word];
    const tx = -w * sc / 2, ty = -50 * sc;
    let letters = '';
    for (let i = 5; i >= 1; i--) letters += h('use', { href: '#fx-wd-' + k, x: i * 1.5, y: i * 1.5, stroke: I('N'), 'stroke-width': 22 });
    letters += h('use', { href: '#fx-wd-' + k, stroke: I('P'), 'stroke-width': 22 }) + h('use', { href: '#fx-wd-' + k, stroke: I('R'), 'stroke-width': 2.6 });
    return h('g', { 'data-ref': 'fx-' + ref, visibility: 'hidden', ...DD(key) },
      h('g', { 'data-ref': `fx-${ref}Rays` }, rays(rx, ry, 22)),
      h('path', { d: burst(rx, ry, 11, ref), fill: I('N'), transform: 'translate(4.5 4.5)' }),
      h('path', { d: burst(rx, ry, 11, ref), fill: I('R') }),
      h('path', { d: burst(rx * 0.84, ry * 0.8, 11, ref), fill: 'none', stroke: I('P'), 'stroke-width': 1.6, 'stroke-linejoin': 'round' }),
      h('g', { transform: `translate(${f(tx)} ${f(ty)}) scale(${sc})` }, letters));
  };
  L.front += pop('DING!', 'popDing', 'fx:O:pop-ding', 84, 50, 0.33) + pop('HOP!', 'popHop', 'fx:O:pop-hop', 70, 46, 0.34) + pop('GULP!', 'popGulp', 'fx:O:pop-gulp', 86, 50, 0.32);
  // bell notes (eighth + beamed pair)
  const noteStyle = { fill: I('P'), stroke: I('N'), 'stroke-width': 2.4, 'paint-order': 'stroke', 'stroke-linejoin': 'round' };
  const note1 = h('path', { d: 'M0 0A5.6 4 -20 1 1 -0.1 0.1ZM4.6 -2.4V-24C8 -21 12 -19 12.4 -13C11 -16 8.4 -17.4 6.8 -17.6V-2.4Z', ...noteStyle });
  const note2 = h('path', { d: 'M0 0A5.4 3.9 -20 1 1 -0.1 0.1ZM16 -4A5.4 3.9 -20 1 1 15.9 -3.9ZM4.4 -2.2V-24L20.4 -28V-6.2H18.2V-22.4L6.6 -19.4V-2.2Z', ...noteStyle });
  L.front += h('g', {}, h('g', { 'data-ref': 'fx-note0', visibility: 'hidden', ...DD('fx:O:bell-notes') }, h('g', { transform: 'translate(0 3.5) scale(1)' }, note1.replace('M0 0A', 'M-5.4 1.6A'))), h('g', { 'data-ref': 'fx-note1', visibility: 'hidden', ...DD('fx:O:bell-notes') }, note2));
  // gulp drips, hearts, fish bone
  L.front += h('g', {}, [0, 1, 2, 3].map(i => h('path', { 'data-ref': 'fx-drip' + i, ...DD('fx:O:gulp-drips'), visibility: 'hidden', d: 'M0 -4.6C1.6 -1.8 2.8 -0.2 2.8 1.4A2.8 2.8 0 0 1 -2.8 1.4C-2.8 -0.2 -1.6 -1.8 0 -4.6Z', fill: I('P'), stroke: I('B'), 'stroke-width': 1 })));
  const heart = h('path', { d: 'M0 4.6C-5 1 -8 -1.6 -8 -4.6C-8 -7.2 -6 -8.6 -4 -8.6C-2.2 -8.6 -0.8 -7.6 0 -6C0.8 -7.6 2.2 -8.6 4 -8.6C6 -8.6 8 -7.2 8 -4.6C8 -1.6 5 1 0 4.6Z', fill: I('R'), stroke: I('N'), 'stroke-width': 1.4, 'paint-order': 'stroke', 'stroke-linejoin': 'round' }) +
    h('path', { d: 'M-5.4 -5.2A2.6 2.6 0 0 1 -3 -7', fill: 'none', stroke: I('P'), 'stroke-width': 1.3, 'stroke-linecap': 'round' });
  L.front += h('g', {}, [0, 1, 2].map(i => h('g', { 'data-ref': 'fx-heart' + i, visibility: 'hidden', ...DD('fx:O:gulp-hearts') }, heart)));
  const boneD = 'M-16 0H13M-10 0L-13 -5M-10 0L-13 5M-4 0L-7 -6M-4 0L-7 6M2 0L-1 -6.4M2 0L-1 6.4M8 0L5 -5.6M8 0L5 5.6M-16 0L-22 -5M-16 0L-22 5';
  L.front += h('g', { 'data-ref': 'fx-bone', visibility: 'hidden', ...DD('fx:O:fish-bone') },
    h('path', { d: boneD, fill: 'none', stroke: I('N'), 'stroke-width': 4, 'stroke-linecap': 'round' }),
    h('path', { d: 'M12 -5.6C17 -6 21 -3 21.6 0C21 3 17 6 12 5.6Z', fill: I('P'), stroke: I('N'), 'stroke-width': 1.6, 'paint-order': 'stroke' }),
    h('path', { d: boneD, fill: 'none', stroke: I('P'), 'stroke-width': 1.7, 'stroke-linecap': 'round' }),
    h('path', { d: circ(16.4, -1.2, 1.3), fill: I('N') }));

  // stash layout data for attach (plain JSON in a data attribute would be overkill: recompute there instead)
  return {
    defs,
    layers: {
      'L-gulls-far': L.far,
      'L-shadow': L.shadow,
      'L-fx-back': L.back,
      'L-fx-front': L.front,
    },
  };
}

// ------------------------------------------------------------------------------------------------ attach
export function attach(svg, ctx) {
  if (typeof location !== 'undefined' && /[?&]fxoff\b/.test(location.search)) { for (const id of ['L-gulls-far--fx', 'L-shadow--fx', 'L-fx-back--fx', 'L-fx-front--fx']) { const g = svg.querySelector('#' + id); if (g) g.setAttribute('display', 'none'); } return {}; }
  const r = refs(svg, 'fx-');
  const cache = new Map();
  const set = (el, k, val) => { if (!el) return; let c = cache.get(el); if (!c) cache.set(el, c = {}); if (c[k] !== val) { c[k] = val; el.setAttribute(k, val); } };
  const vis = (el, on) => set(el, 'visibility', on ? 'visible' : 'hidden');
  const nofx = typeof location !== 'undefined' && /[?&]nofx\b/.test(location.search);

  // same layout constants as build()
  const R = ctx.rng('fx-gulls');
  const FAR = [];
  for (let i = 0; i < 7; i++) { const grp = i < 4 ? 0 : 1; FAR.push({ x0: grp * 1300 + i * 70 + R() * 50, y: (grp ? 150 : 205) + (i % 4) * 22 + R() * 18, s: 0.34 + R() * 0.14, f: 2.4 + R() * 1.2, ph: R() * 10, gl: R() * 10 }); }
  const ESC = [
    { idle: [400, 262], st: [455, 318], s: 1.15 },
    { idle: [-300, 420], st: [300, 405], s: 1.0 },
    { idle: [-300, 200], st: [612, 178], s: 0.92 },
    { idle: [-300, 120], st: [1115, 168], s: 0.85 },
  ];
  const Rf = ctx.rng('fx-ff');
  const FF = []; for (let i = 0; i < 8; i++) FF.push({ x: 180 + i * 150 + Rf() * 60, y: 360 + Rf() * 380, ax: 20 + Rf() * 30, ay: 12 + Rf() * 22, w: 0.4 + Rf() * 0.5, p: 2.2 + Rf() * 2.4, ph: Rf() });
  const FFF = []; for (let i = 0; i < 6; i++) FFF.push({ x: Rf() * 2600 - 500, y: 500 + Rf() * 70, p: 1.6 + Rf() * 2, ph: Rf() });
  const FRAME_SEQ = [0, 1, 2, 3, 2, 1];
  const flyPt = u => [FLY_C[0] + FLY_A[0] * Math.sin(TAU * u), FLY_C[1] + FLY_A[1] * Math.sin(2 * TAU * u) - 10 * Math.cos(TAU * u)];
  const FLYN = 120, flyPts = Array.from({ length: FLYN }, (_, i) => flyPt(i / FLYN));
  const flyLen = [0]; for (let i = 1; i <= FLYN; i++) { const a = flyPts[i - 1], b = flyPts[i % FLYN]; flyLen.push(flyLen[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const flyTotal = flyLen[FLYN];

  // cast-shadow capsules sized from each pelican slot's own art (bbox in joint-local space)
  const PSLOTS = ['tail', 'wingFarUpper', 'thighFar', 'shankFar', 'footFar', 'body', 'crest', 'head', 'pouch', 'billLower', 'billUpper', 'thighNear', 'shankNear', 'footNear', 'wingNearUpper', 'wingNearLower'];
  const shOK = {};
  for (const s of PSLOTS) {
    const el = svg.querySelector('#j-' + s), rect = r['shr-' + s];
    let bb = null;
    try { bb = el && el.getBBox(); } catch (e) { bb = null; }
    if (!bb || !(bb.width > 1 && bb.height > 1) || !rect) { shOK[s] = false; if (r['sh-' + s]) r['sh-' + s].setAttribute('visibility', 'hidden'); continue; }
    // trim the capsule a little (key lines, loose feather tips) so the flattened silhouette stays compact
    const k = s === 'body' ? 0.9 : 0.94, w = bb.width * k, hh = bb.height * k;
    rect.setAttribute('x', f1(bb.x + (bb.width - w) / 2)); rect.setAttribute('y', f1(bb.y + (bb.height - hh) / 2));
    rect.setAttribute('width', f1(w)); rect.setAttribute('height', f1(hh)); rect.setAttribute('rx', f1(Math.min(w, hh) / 2));
    shOK[s] = true;
  }
  const NDUST = 10, NGRIT = 10, NBURST = 8;
  const dust = Array.from({ length: NDUST }, (_, i) => r['dust' + i]);
  const grit = Array.from({ length: NGRIT }, (_, i) => r['grit' + i]);
  const bps = Array.from({ length: NBURST }, (_, i) => r['bp' + i]);
  const RC = BIKE.rearContact;
  const latest = (evs, type, t, win) => { let best = null; for (const e of evs || []) if (e.type === type) { const tau = t - e.t0; if (tau >= 0 && tau < win && (!best || e.t0 > best.t0)) best = e; } return best ? t - best.t0 : -1; };

  return {
    update(fr) {
      const t = fr.t, pose = fr.pose || {}, J = pose.joints || {};
      const reduced = !!(fr.reduced || ctx.reduced);
      const sp = fr.speed || 0, cad = fr.cadence || 0, D = fr.distance || 0;
      const night = fr.night || 0, day = 1 - night;
      const tg = fr.toggles || {};
      const ry = pose.riderY || 0, pitch = pose.bikePitch || 0, pr = pitch * D2R, pc = Math.cos(pr), ps = Math.sin(pr);
      // rider-local -> world
      const W = (x, y) => { const dx = x - RC[0], dy = y - RC[1]; return [RIDER_X + RC[0] + dx * pc - dy * ps, GROUND_Y + ry + RC[1] + dx * ps + dy * pc]; };
      const riderXf = `translate(${RIDER_X} ${f(GROUND_Y + ry)}) rotate(${f(pitch)} ${RC[0]} ${RC[1]})`;
      set(r.riderB, 'transform', riderXf); set(r.riderF, 'transform', riderXf);

      // ================= shadow
      const sun = fr.sun || { x: 1450, y: 330, elev: 0.3 }, moon = fr.moon || { x: 0, y: 0, elev: -1 };
      const src = sun.elev > -0.06 ? sun : (moon.elev > 0 ? moon : { x: RIDER_X + 200, elev: 0.6 });
      const low = 1 - clamp(src.elev, 0, 1);
      const c = clamp((src.x - RIDER_X) / 700, -1.3, 1.3) * (0.18 + 0.82 * low) * 0.8;
      const d = 0.03 + 0.055 * low;
      set(r.castM, 'transform', `matrix(1 0 ${f(c)} ${f(-d)} ${f(RIDER_X + c * ry)} ${f(GROUND_Y - d * ry)})`);
      set(r.castP, 'transform', `rotate(${f(pitch)} ${RC[0]} ${RC[1]})`);
      for (const s of PSLOTS) if (shOK[s] && J[s]) set(r['sh-' + s], 'transform', xf(J[s]));
      if (J.body && J.head) {
        const b = J.body, br = (b.rot || 0) * D2R, nb = [b.x + 112 * Math.cos(br) + 92 * Math.sin(br), b.y + 112 * Math.sin(br) - 92 * Math.cos(br)];
        const hd = J.head, mid = [(nb[0] + hd.x) / 2 + 22, (nb[1] + hd.y) / 2];
        set(r.shNeck, 'd', `M${f1(nb[0])} ${f1(nb[1])}Q${f1(mid[0])} ${f1(mid[1])} ${f1(hd.x)} ${f1(hd.y + 10)}`);
      }
      const lift = clamp(-ry / 48, 0, 1.2);
      set(r.cast, 'opacity', f(1 - 0.3 * lift));
      const hF = clamp(-(ry + 298 * ps) / 48, 0, 1.4);
      const cShadow = (el, x, hh, sq) => {
        const s = 1 - 0.55 * Math.min(1, hh);
        set(el, 'transform', `translate(${f(RIDER_X + x - c * hh * 48)} ${GROUND_Y + 1}) scale(${f(s * (1 + 0.06 * sq))} ${f(s)})`);
        set(el, 'opacity', f(1 - 0.7 * Math.min(1, hh)));
      };
      cShadow(r.cR, BIKE.rearHub[0], lift, (pose.tyre && pose.tyre.rear) || 0);
      cShadow(r.cF, BIKE.frontHub[0], hF, (pose.tyre && pose.tyre.front) || 0);

      // ================= far gulls
      const gullsOn = tg.gulls !== false;
      const escW = gullsOn ? sstep(83, 92, cad) : 0;
      for (let i = 0; i < FAR.length; i++) {
        const g = FAR[i], el = r['gfar' + i];
        if (!gullsOn) { vis(el, false); continue; }
        vis(el, true);
        const x = wrap(g.x0 + 170 * t - 0.15 * D, 2800) - 600;
        const y = g.y + 6 * Math.sin(0.6 * t + g.ph);
        const flapping = reduced ? true : Math.sin(0.35 * t + g.gl) > -0.35;
        const fi = flapping ? FRAME_SEQ[Math.floor(wrap((t * g.f + g.ph) * 6, 6))] : 1;
        set(el, 'href', '#fx-gf' + fi);
        set(el, 'transform', `translate(${f1(x)} ${f1(y)}) scale(${f(g.s)})`);
      }
      // escort gulls: companion glides at cruise; the whole flock swoops in above 85 rpm (staggered)
      for (let i = 0; i < ESC.length; i++) {
        const g = ESC[i], el = r['esc' + i];
        if (!gullsOn) { vis(el, false); continue; }
        const w = i === 0 ? escW : sstep(0, 1, (escW - i * 0.12) / 0.64);
        if (i > 0 && w <= 0.001) { vis(el, false); continue; }
        vis(el, true);
        const ew = w * w * (3 - 2 * w);
        const bobA = lerp(10, 14, ew), bobX = lerp(22, 16, ew);
        let x = lerp(g.idle[0], g.st[0], ew) + bobX * Math.sin(0.55 * t + i * 1.7);
        let y = lerp(g.idle[1], g.st[1], ew) + bobA * Math.sin(0.9 * t + i * 2.3) - 60 * Math.sin(Math.PI * ew) * (i ? 1 : 0.3);
        if (i === 0 && !ew) { x += 30 * Math.sin(0.23 * t); }
        // flap: continuous while escorting / arriving, glide + short bursts at cruise
        const burst = reduced ? 0 : Math.max(ew, sstep(0.55, 0.85, Math.sin(0.42 * t + 1.1 * i)));
        const ph = TAU * (i === 0 && ew < 0.5 ? 2.6 : 3.3) * t + i * 1.3;
        const s = lerp(0.3 + 0.05 * Math.sin(1.7 * t), Math.cos(ph) * 0.95 + 0.05, burst);
        const vy = bobA * 0.9 * Math.cos(0.9 * t + i * 2.3);
        set(el, 'transform', `translate(${f1(x)} ${f1(y)}) rotate(${f1(clamp(vy * 0.35, -6, 6) - 4 * burst * Math.sin(ph))}) scale(${f(g.s)})`);
        set(r['escWn' + i], 'transform', `scale(1 ${f(s)})`); set(r['escWf' + i], 'transform', `scale(1 ${f(s)})`);
      }

      // ================= headlamp / night
      const lampOn = sstep(0.2, 0.55, night);
      vis(r.beam, lampOn > 0.01); vis(r.flare, lampOn > 0.01);
      if (lampOn > 0.01) set(r.flareStar, 'transform', `rotate(${reduced ? 0 : f1(8 * Math.sin(t * 0.9))}) scale(${f(0.8 + 0.2 * Math.sin(t * 3.1))})`);
      vis(r.mothG, lampOn > 0.05); vis(r.ffG, night > 0.3); vis(r.fffG, night > 0.3);
      if (lampOn > 0.05) for (let i = 0; i < 3; i++) {
        const a = t * (2.2 + i * 0.7) + i * 2.1, rr = 22 + 12 * Math.sin(t * 1.3 + i * 4);
        const x = BIKE.lamp[0] + 8 + rr * Math.cos(a) + 6 * Math.sin(t * 7.1 + i), y = BIKE.lamp[1] - 4 + rr * 0.7 * Math.sin(a * 1.3);
        set(r['moth' + i], 'transform', `translate(${f1(x)} ${f1(y)}) rotate(${f1(Math.cos(a) * 25)})`);
        set(r['mothW' + i], 'transform', `scale(1 ${f(0.25 + 0.75 * Math.abs(Math.cos(t * 26 + i * 2)))})`);
      }
      if (night > 0.3) {
        const nf = reduced ? 5 : FF.length;
        for (let i = 0; i < FF.length; i++) {
          const q = FF[i], el = r['ff' + i];
          if (i >= nf) { vis(el, false); continue; }
          const x = wrap(q.x - 36 * t, 1500) + 50 + q.ax * Math.sin(q.w * t * 2.1 + i), y = q.y + q.ay * Math.sin(q.w * t * 1.3 + i * 2);
          const ph = wrap(t / q.p + q.ph, 1), blink = sstep(0, 0.1, ph) * (1 - sstep(0.5, 0.66, ph));
          vis(el, blink > 0.02);
          set(el, 'transform', `translate(${f1(x)} ${f1(y)})`); set(el, 'opacity', f(blink * sstep(0.3, 0.7, night)));
        }
        for (let i = 0; i < FFF.length; i++) {
          const q = FFF[i], el = r['fff' + i];
          const x = wrap(q.x - 0.15 * D * 0.5, 2600) - 500, ph = wrap(t / q.p + q.ph, 1), blink = sstep(0, 0.1, ph) * (1 - sstep(0.25, 0.4, ph));
          set(el, 'transform', `translate(${f1(x)} ${f1(q.y)})`); set(el, 'opacity', f(blink));
        }
      }

      // ================= dust puffs (rear tyre), rate & size by speed
      const sN = clamp(sp / 1885, 0, 1.8);        // 1 at 60 rpm
      const dens = clamp(0.25 + 0.5 * sN, 0, 1) * (reduced ? 0.4 : 1) * (lift > 0.05 ? 0 : 1);
      const DT = 0.085, LIFE = 0.62;
      for (let j = 0; j < NDUST; j++) {
        const k = Math.floor((t - j * DT) / (NDUST * DT)) * NDUST + j, age = t - k * DT, el = dust[j];
        const on = age >= 0 && age < LIFE && hash(k, 7) < dens;
        if (!on) { vis(el, false); continue; }
        vis(el, true);
        const u = age / LIFE, hk = hash(k, 3);
        const x = RIDER_X + RC[0] - 16 - (0.12 + 0.1 * hk) * sp * age * (1 - 0.3 * u) - 40 * age;
        const y = GROUND_Y - 3 - (22 + 30 * hk) * u - 6 * Math.sin(u * 3 + hk * 6);
        const s = (0.6 + 1.1 * Math.sqrt(u)) * (0.75 + 0.45 * Math.min(1.4, sN)) * (0.8 + 0.4 * hash(k, 5));
        // solid ink puff: swells, then breaks up by shrinking (no transparency, it is a print)
        set(el, 'transform', `translate(${f1(x)} ${f1(y)}) scale(${f(s * (1 - sstep(0.55, 1, u)))})`);
      }
      const gdens = clamp(-0.1 + 0.6 * sN, 0, 1) * (reduced ? 0.3 : 1) * (lift > 0.05 ? 0 : 1);
      const GDT = 0.05;
      for (let j = 0; j < NGRIT; j++) {
        const k = Math.floor((t - j * GDT) / (NGRIT * GDT)) * NGRIT + j, age = t - k * GDT, el = grit[j];
        const hk = hash(k, 11), vy0 = 260 + 280 * hash(k, 12), g = 2885;
        const tl = (2 * vy0) / g;
        const on = age >= 0 && age < tl && hash(k, 13) < gdens;
        if (!on) { vis(el, false); continue; }
        vis(el, true);
        const x = RIDER_X + RC[0] - 12 - (0.25 + 0.35 * hk) * sp * age - 90 * age;
        const y = GROUND_Y - 2 - (vy0 * age - 0.5 * g * age * age);
        set(el, 'transform', `translate(${f1(x)} ${f1(y)}) rotate(${f1(age * 900 * (hk - 0.5))})`);
      }

      // ================= landing burst + impact rays
      const tLand = latest(fr.events, 'hop', t, TIMING.hop.land + 1.2);
      const tl = tLand < 0 ? -1 : tLand - TIMING.hop.land;
      vis(r.burstG, tl >= 0 && tl < 0.9);
      if (tl >= 0 && tl < 0.9) {
        const u = tl / 0.9;
        for (let i = 0; i < NBURST; i++) {
          const side = i % 2 ? 1 : -1, wheelX = i < 4 ? BIKE.rearHub[0] : BIKE.frontHub[0];
          const hk = hash(i, 21), spd = (130 + 170 * hk) * side;
          const x = RIDER_X + wheelX + side * 22 + spd * (1 - Math.exp(-tl * 4)) / 4 * 3 - 0.3 * sp * tl;
          const y = GROUND_Y - 4 - (10 + 22 * hk) * (1 - Math.exp(-tl * 5));
          set(bps[i], 'transform', `translate(${f1(x)} ${f1(y)}) scale(${f((1.1 + 1.6 * u) * (0.8 + 0.4 * hk))})`);
          set(bps[i], 'opacity', f(1 - u)); vis(bps[i], true);
        }
      }
      const ti = tl >= 0 && tl < 0.22 && !nofx;
      vis(r.impG, ti);
      if (ti) {
        const u = tl / 0.22, s = reduced ? 1 : 0.7 + 0.5 * u;
        set(r.impR, 'transform', `translate(${RIDER_X + BIKE.rearHub[0]} ${GROUND_Y - 1}) scale(${f(s)})`);
        set(r.impF, 'transform', `translate(${RIDER_X + BIKE.frontHub[0]} ${GROUND_Y - 1}) scale(${f(s)})`);
        set(r.impG, 'opacity', f(1 - u * u));
      }

      // ================= wind curls (draw on / wipe off) + speed lines
      const curlOn = !reduced && cad > 40;
      for (let i = 0; i < 3; i++) {
        const P = 1.7, k = Math.floor((t - i * P / 3) / P), age = t - (k * P + i * P / 3), el = r['curl' + i];
        const act = curlOn && hash(k, 30 + i) < clamp((cad - 40) / 30, 0, 1) * 0.9 + 0.1;
        if (!act) { vis(el, false); continue; }
        vis(el, true);
        const u = age / P, hk = hash(k, 40 + i);
        const x = RIDER_X - 150 - 40 * hk - (160 + 0.08 * sp) * age, y = GROUND_Y - 470 + 110 * hk - 16 * u;
        set(el, 'transform', `translate(${f1(x)} ${f1(y)}) scale(${f(0.8 + 0.35 * hk)})`);
        const draw = sstep(0, 0.45, u), wipe = sstep(0.55, 1, u);
        for (let p = 0; p < 2; p++) set(r[`curl${i}p${p}`], 'stroke-dashoffset', f(p ? 1 - sstep(0.1, 0.55, u) - wipe : 1 - draw - wipe));
      }
      const slW = (tg.speedlines !== false && !reduced) ? sstep(78, 88, cad) : 0;
      vis(r.slG, slW > 0.01);
      if (slW > 0.01) {
        for (let i = 0; i < SPEEDLINES.length; i++) {
          const [ax, ay] = SPEEDLINES[i], [xe, yy] = W(ax, ay);
          const P = 0.36, k = Math.floor((t + i * 0.117) / P), age = t + i * 0.117 - k * P, el = r['sl' + i];
          const on = hash(k, 50 + i) < 0.5 + 0.45 * slW;
          if (!on) { vis(el, false); continue; }
          vis(el, true);
          const u = age / P, hk = hash(k, 60 + i);
          // the stroke is pulled out of the silhouette (grow), then its head lets go and the whole line slides off
          const grow = sstep(0, 0.3, u), go = sstep(0.45, 1, u);
          const len = (110 + 190 * hk) * (0.25 + 0.75 * grow) * (1 - 0.55 * go);
          const x0 = xe - 6 - 14 * hk - 380 * go * go;
          set(el, 'transform', `translate(${f1(x0)} ${f1(yy + 6 * (hk - 0.5))}) scale(${f(len / 100)} ${f(0.8 + 0.5 * hk)})`);
          set(el, 'opacity', f(slW * (1 - sstep(0.75, 1, u))));
        }
      }

      // ================= feathers (now and then) + seeds
      for (let i = 0; i < 3; i++) {
        const P = 7.4, off = 0.6 + i * 2.5, k = Math.floor((t - off) / P), age = t - off - k * P, el = r['fea' + i];
        const LIFE_F = 5.2;
        const on = age >= 0 && age < LIFE_F && (k === 0 || hash(k, 70 + i) < 0.7) && !(reduced && i === 2);
        if (!on) { vis(el, false); continue; }
        vis(el, true);
        const u = age / LIFE_F, hk = hash(k, 80 + i);
        const vx = 70 + 0.05 * sp + 40 * hk;
        const x = RIDER_X - 40 - vx * age - 14 * Math.sin(age * 2.2 + hk * 5);
        const y = GROUND_Y - 350 + (i === 1 ? -30 : 20) - 30 * Math.sin(Math.min(1, age * 0.9) * Math.PI / 2) + 60 * age * age / LIFE_F + 10 * Math.sin(age * 3.1 + hk * 4);
        const rot = (i === 1 ? 0 : -15) + 35 * Math.sin(age * 2.2 + hk * 5);
        set(el, 'transform', `translate(${f1(x)} ${f1(y)}) rotate(${f1(rot)}) scale(${i === 1 ? 1.6 : 1.25})`);
        set(el, 'opacity', f(sstep(0, 0.25, age) * (1 - sstep(0.8, 1, u))));
      }
      for (let i = 0; i < 4; i++) {
        const el = r['seed' + i], hk = hash(i, 90);
        const x = wrap(1700 - (60 + 0.035 * sp + 30 * hk) * t - i * 520, 2000) - 200;
        const y = 250 + 90 * i + 40 * Math.sin(0.5 * t + i * 2) + 12 * Math.sin(1.7 * t + i);
        set(el, 'transform', `translate(${f1(x)} ${f1(y)}) rotate(${f1(-20 + 18 * Math.sin(1.1 * t + i))}) scale(${f(1.35 + 0.3 * hk)})`);
        set(el, 'opacity', f(clamp(day * 1.2 - 0.2, 0, 1)));
      }
      vis(r.seedG, day > 0.2);

      // ================= butterflies (day; blown off when sprinting)
      const bfPres = clamp(day * 1.4 - 0.4, 0, 1);
      for (let i = 0; i < 2; i++) {
        const el = r['bf' + i];
        const blow = sstep(70, 90, cad);
        if (bfPres <= 0.01 || blow > 0.98) { vis(el, false); continue; }
        vis(el, true);
        const home = i === 0 ? [1012, 392] : [458, 468];
        const x = home[0] + 34 * Math.sin(0.9 * t + i * 3) + 12 * Math.sin(2.3 * t + i) - blow * blow * 1400;
        const y = home[1] + 22 * Math.sin(1.4 * t + i * 1.3) + 8 * Math.sin(3.7 * t + i * 2) - 40 * blow;
        const glide = reduced ? 1 : sstep(0.6, 0.9, Math.sin(0.7 * t + i * 2.4));
        const flap = 0.2 + 0.8 * (0.5 + 0.5 * Math.cos(TAU * (i ? 9 : 7.5) * t));
        const s = lerp(flap, 0.42, glide);
        const dir = Math.cos(0.9 * t + i * 3) >= -0.2 ? 1 : 1;
        set(el, 'transform', `translate(${f1(x)} ${f1(y)}) rotate(${f1(-8 + 10 * Math.sin(1.4 * t + i))}) scale(${f(dir * (i ? 1.35 : 1.55))} ${i ? 1.35 : 1.55})`);
        set(r['bfw' + i], 'transform', `translate(0 -1) scale(1 ${f(s)}) translate(0 1)`);
        set(el, 'opacity', f(bfPres));
      }

      // ================= dragonfly: hover, then dart to the next hover point (quick ease), wings a blur
      {
        const on = day > 0.3 && cad < 92;
        vis(r.dfly, on);
        if (on) {
          const P = 1.9, k = Math.floor(t / P), u = t / P - k;
          const pt = kk => [1120 + 150 * (hash(kk, 201) - 0.5), 610 + 90 * (hash(kk, 202) - 0.5)];
          const a = pt(k), b = pt(k + 1), dart = sstep(0.72, 0.9, u);
          const x = lerp(a[0], b[0], dart) + 2.5 * Math.sin(t * 5.3), y = lerp(a[1], b[1], dart) + 3 * Math.sin(t * 3.7);
          const tilt = (b[1] - a[1]) * 0.12 * Math.sin(Math.PI * dart);
          set(r.dfly, 'transform', `translate(${f1(x)} ${f1(y)}) rotate(${f1(tilt - 4)}) scale(1.6)`);
          set(r.dflyW, 'transform', `translate(0 -1) scale(1 ${f(reduced ? 0.8 : 0.35 + 0.65 * Math.abs(Math.sin(t * 63)))}) translate(0 1)`);
        }
      }
      // ================= tumbling leaf (every ~9 s, crosses the frame on the breeze)
      {
        const P = 9.3, off = 1.2, k = Math.floor((t - off) / P), age = t - off - k * P, LIFE_L = 4.4;
        const on = day > 0.2 && age < LIFE_L && (k === 0 || hash(k, 210) < 0.75);
        vis(r.leaf, on);
        if (on) {
          const hk = hash(k, 211);
          const x = 1500 - (260 + 0.12 * sp) * age, y = 380 + 120 * hk + 140 * (age / LIFE_L) ** 1.4 + 18 * Math.sin(age * 2.6);
          set(r.leaf, 'transform', `translate(${f1(x)} ${f1(y)}) rotate(${f1(age * 140 + hk * 90)}) scale(1.5)`);
          set(r.leafS, 'transform', `scale(${f(reduced ? 1 : Math.cos(age * 5.2))} 1)`);
        }
      }

      // ================= fly around the basket (with a dotted trail)
      {
        const on = day > 0.25;
        vis(r.flyG, on);
        if (on) {
          const uu = wrap(t * 0.52, 1), p = flyPt(uu);
          const jit = reduced ? 0 : 1.6;
          set(r.fly, 'transform', `translate(${f1(p[0] + jit * Math.sin(t * 41))} ${f1(p[1] + jit * Math.cos(t * 37))}) scale(2)`);
          set(r.flyW, 'transform', `rotate(${f1(reduced ? 0 : 22 * Math.sin(t * 90))} 0 -1.2)`);
          const idx = uu * FLYN, i0 = Math.floor(idx), cur = lerp(flyLen[i0], flyLen[i0 + 1], idx - i0);
          set(r.flyTrail, 'stroke-dashoffset', f1(wrap(-(cur - 46), flyTotal)));
        }
      }

      // ================= glints on the bell and the rear rim (sun side)
      {
        const gl = clamp(sun.elev * 5 + 0.5, 0, 1) * clamp(1 - night * 2, 0, 1);
        vis(r.glB, gl > 0.02); vis(r.glR, gl > 0.02);
        if (gl > 0.02) {
          const tw = reduced ? 0.85 : 0.5 + 0.5 * Math.max(0, Math.sin(TAU * 0.55 * t)) ** 2;
          set(r.glB, 'transform', `translate(${BIKE.bell[0] + 3} ${BIKE.bell[1] - 9}) rotate(${f1(12 * Math.sin(t * 0.8))}) scale(${f(0.5 + 0.55 * tw)})`);
          set(r.glB, 'opacity', f(gl));
          const hubW = W(BIKE.rearHub[0], BIKE.rearHub[1]), a = Math.atan2(sun.y - hubW[1], sun.x - hubW[0]);
          const tw2 = reduced ? 0.85 : 0.5 + 0.5 * Math.max(0, Math.sin(TAU * 0.43 * t + 2)) ** 2;
          set(r.glR, 'transform', `translate(${f1(BIKE.rearHub[0] + 92 * Math.cos(a))} ${f1(BIKE.rearHub[1] + 92 * Math.sin(a))}) rotate(${f1(-8 * t % 90)}) scale(${f(0.45 + 0.6 * tw2)})`);
          set(r.glR, 'opacity', f(gl));
        }
      }

      // ================= event pops
      const popAnim = (el, rays, tau, dur, x, y, rot) => {
        const on = !nofx && tau >= 0 && tau < dur;
        vis(el, on);
        if (!on) return;
        const uin = clamp(tau / 0.16, 0, 1), uout = sstep(dur - 0.24, dur, tau);
        const s = reduced ? 1 : (uin < 1 ? easeOutBack(uin) : 1) * (1 - 0.35 * uout);
        const wob = reduced ? 0 : 3 * Math.exp(-tau * 5) * Math.sin(tau * 30);
        set(el, 'transform', `translate(${f1(x)} ${f1(y - 14 * uout)}) rotate(${f1(rot + wob)}) scale(${f(Math.max(0.01, s))})`);
        set(el, 'opacity', f(reduced ? Math.min(1, tau / 0.12) * (1 - uout) : 1 - uout));
        const ur = clamp(tau / 0.34, 0, 1);
        vis(rays, ur < 1);
        if (ur < 1) { set(rays, 'transform', `scale(${f(reduced ? 1 : 0.75 + 0.5 * ur)})`); set(rays, 'opacity', f(1 - ur * ur)); }
      };
      const tb = latest(fr.events, 'bell', t, 3);
      popAnim(r.popDing, r.popDingRays, tb - TIMING.bell.strike, 1.0, RIDER_X + 330, GROUND_Y - 360, -7);
      const th = latest(fr.events, 'hop', t, 3);
      popAnim(r.popHop, r.popHopRays, th - TIMING.hop.takeoff + 0.04, 0.95, RIDER_X - 330, GROUND_Y - 190, -9);
      const tgp = latest(fr.events, 'gulp', t, 8);
      popAnim(r.popGulp, r.popGulpRays, tgp - TIMING.gulp.swallow[0], 1.05, RIDER_X + 385, GROUND_Y - 545, 6);
      // bell notes
      for (let i = 0; i < 2; i++) {
        const tau = tb - TIMING.bell.strike - i * 0.18, el = r['note' + i];
        const on = !nofx && tau >= 0 && tau < 1.6;
        vis(el, on);
        if (!on) continue;
        const u = tau / 1.6, bw = W(BIKE.bell[0], BIKE.bell[1]);
        const x = bw[0] + 18 + i * 10 - (60 + 0.02 * sp) * tau + 8 * Math.sin(tau * 6 + i);
        const y = bw[1] - 22 - 95 * tau + 18 * tau * tau;
        set(el, 'transform', `translate(${f1(x)} ${f1(y)}) rotate(${f1(-10 + 14 * Math.sin(tau * 5 + i))}) scale(${f((reduced ? 1 : Math.min(1, easeOutBack(clamp(tau / 0.18, 0, 1)))) * 1.05)})`);
        set(el, 'opacity', f(1 - sstep(0.65, 1, u)));
      }
      // gulp drips (during scoop / lift) from the lower bill tip
      for (let i = 0; i < 4; i++) {
        const tau = tgp - 0.62 - i * 0.13, el = r['drip' + i];
        const on = tau >= 0 && tau < 0.42 && pose.fish;
        vis(el, !!on);
        if (!on) continue;
        const p = W(pose.fish.x, pose.fish.y);
        set(el, 'transform', `translate(${f1(p[0] - 6 + 5 * i - (0.25 * sp + 40) * tau)} ${f1(p[1] + 4 + 0.5 * 1800 * tau * tau)}) scale(${f(0.9 + 0.2 * (i % 2))} ${f(1 + 0.4 * Math.min(1, tau * 5))})`);
        set(el, 'opacity', f(1 - sstep(0.3, 0.42, tau)));
      }
      // hearts after the gulp
      for (let i = 0; i < 3; i++) {
        const tau = tgp - 1.9 - i * 0.28, el = r['heart' + i];
        const on = !nofx && tau >= 0 && tau < 1.9;
        vis(el, on);
        if (!on) continue;
        const u = tau / 1.9, hx = J.head ? W(J.head.x, J.head.y) : [RIDER_X + 125, GROUND_Y - 520];
        const x = hx[0] + 20 + i * 22 + 12 * Math.sin(tau * 3.4 + i * 2), y = hx[1] - 50 - 70 * tau - i * 6;
        const s = (reduced ? 1 : easeOutBack(clamp(tau / 0.22, 0, 1))) * (1.05 - 0.2 * i) * (1 + 0.06 * Math.sin(tau * 12));
        set(el, 'transform', `translate(${f1(x)} ${f1(y)}) rotate(${f1(10 * Math.sin(tau * 3 + i))}) scale(${f(Math.max(0.01, s))})`);
        set(el, 'opacity', f(1 - sstep(0.7, 1, u)));
      }
      // fish bone: spat back over the shoulder, lands on the road, scrolls away
      {
        const tau = tgp - 2.35, el = r.bone;
        const on = !nofx && tau >= 0 && tau < 3.2;
        vis(el, on);
        if (on) {
          const x0 = RIDER_X + 250, y0 = GROUND_Y - 490, vx = -180, vy = -330, g = 1500;
          const tHit = (-vy + Math.sqrt(vy * vy + 2 * g * (GROUND_Y + 8 - y0))) / g;
          let x, y, rot;
          if (tau < tHit) { x = x0 + vx * tau; y = y0 + vy * tau + 0.5 * g * tau * tau; rot = -tau * 620; }
          else { const a = tau - tHit, bounce = Math.abs(Math.sin(a * 9)) * 12 * Math.exp(-a * 6); x = x0 + vx * tHit - sp * a - 60 * (1 - Math.exp(-a * 5)); y = GROUND_Y + 8 - bounce; rot = -tHit * 620 - 40 * (1 - Math.exp(-a * 6)); rot = Math.round(rot / 180) * 180 * sstep(0, 0.3, a) + rot * (1 - sstep(0, 0.3, a)); }
          set(el, 'transform', `translate(${f1(x)} ${f1(y)}) rotate(${f1(rot)}) scale(1.3)`);
          set(el, 'opacity', f(1 - sstep(2.8, 3.2, tau)));
        }
      }
      // wave action arcs beside the waving wing
      {
        const tw = latest(fr.events, 'wave', t, 3);
        const on = !nofx && tw >= TIMING.wave.wave[0] && tw < TIMING.wave.wave[1] && J.wingNearHand;
        vis(r.waveArcs, !!on);
        if (on) {
          const j = J.wingNearHand, u = (tw - TIMING.wave.wave[0]) / (TIMING.wave.wave[1] - TIMING.wave.wave[0]);
          set(r.waveArcs, 'transform', `translate(${f1(j.x + 10)} ${f1(j.y - 20)}) rotate(${f1((j.rot || 0) * 0.3 - 10)})`);
          set(r.waveArcs, 'opacity', f(sstep(0, 0.12, u) * (1 - sstep(0.85, 1, u))));
        }
      }
    },
  };
}
