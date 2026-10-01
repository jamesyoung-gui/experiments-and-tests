// OWNER: eggs. Egg #1 (Konami ↑↑↓↓←→←→BA): the pelican suits up in an ORIGINAL cyber mech armour, "鹈鹕-01".
// The plates grow out of the rider mechanically while it keeps riding: compact seeds (joint hubs) pop out first, then
// hinged plates swing over, shin and bill sheaths telescope, back plates slide along a rail, feather blades fan out,
// collars telescope up the S-neck, the helmet folds over the skull from the nape and the visor slams down.
// Design language (STYLE-X §1): gunmetal + chrome plates with ink key lines, magenta / cyan energy seams that light in a
// wave from the chest reactor (a fish glyph, ours), an acid status light. The pelican must still read as a pelican:
// white plumage shows between plates, the bill keeps its silhouette under segmented sheaths and its chrome nail, the
// pouch keeps its colour under a flexible mesh, the crest streams out of the helmet's back vent, the webs show through
// the boots' slots.
//
// Rig: every plate group lives INSIDE a rider joint slot (scene.js `overlay`), drawn in that joint's local frame, so it
// rides every pedal stroke, hop, wave and gulp exactly. The collars follow pose.neck via pelican-body.neckAt (the same
// curve the neck outline uses); the helmet lives in the crest slot under inverse(crest)·head (like the body module's
// visor), so it sits above the eye in exact head space.
// Timing: a pure function of a = (t − t0) (or of the rewind after the code is entered again / Esc), so renderAt stays
// exact. Performance: no filters (glows are stacked strokes + static gradients); all art is built once, hidden with
// display:none, animated by transform / opacity only; in the steady state only the collars, the helmet carrier, the
// reactor breath and the thruster flicker are written each frame, all in slots that repaint anyway.
import { fmt1, fmt2 } from '../core/math.js';
import { h } from '../core/svg.js';
import { neckAt } from '../art/pelican-body.js';

const f = fmt1, f2 = fmt2;
const D2R = Math.PI / 180;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
const bump = (a, b, x) => (x <= a || x >= b ? 0 : Math.sin(Math.PI * (x - a) / (b - a)));
const hsh = (a, b) => { let x = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x632be5ab, 0xc2b2ae35); x ^= x >>> 15; x = Math.imul(x, 0x2c1b3c6d); x ^= x >>> 13; return (x >>> 0) / 4294967296; };
const P = (pts, z = true) => 'M' + pts.map(p => f(p[0]) + ' ' + f(p[1])).join('L') + (z ? 'Z' : '');
const circ = (x, y, r) => `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
const star4 = (r, w) => `M0 ${f(-r)}L${f(w)} ${f(-w)}L${f(r)} 0L${f(w)} ${f(w)}L0 ${f(r)}L${f(-w)} ${f(w)}L${f(-r)} 0L${f(-w)} ${f(-w)}Z`;

// ------------------------------------------------------------------------------------------------ the X-sheet
// beats (s from t0): arming 0–0.4 · growth 0.4–2.6 · power-up 2.6–3.2 · hero 3.2–4.0 · then the suit stays on
export const MK = { arm: 0.4, grow: 2.6, power: 3.2, hero: 4.0, rev: 1.6, done: 4.6 };
// growth stages (start times, staggered and overlapping): feet → shins → thighs → chest → back → wings → neck → helmet → visor
const STG = { boots: 0.4, shins: 0.6, thighs: 0.82, chest: 1.02, back: 1.24, wings: 1.44, neck: 1.66, helmet: 1.92, visor: 2.36 };
// spring with anticipation: a small dip the wrong way, a fast throw, ~14 % overshoot, settle (exactly 0 → 1)
export function mechE(u) {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  const A = 0.16;
  if (u < A) return -0.08 * Math.sin(Math.PI * u / A);
  const v = (u - A) / (1 - A);
  return 1 - Math.exp(-5 * v) * Math.cos(8 * v) * (1 - v ** 4);
}

// ------------------------------------------------------------------------------------------------ inks
const INK = '#0A0816';
const C = { mag: '#FF2E88', magC: '#FFD3E7', cy: '#19E6FF', cyC: '#D8FBFF', acid: '#C6FF3D', acidC: '#F1FFD0', amber: '#FFB547', amberC: '#FFF0D2', white: '#FFFFFF' };
// plate gradients read CSS variables, so the 888 egg re-plates the suit in gold (#scene.egg-gold, see css below)
const V = (k, d) => `var(--mk-${k},${d})`;
const PL = { hi: V('hi', '#DCE2FA'), mid: V('mid', '#7079A6'), lo: V('lo', '#2C3150'), fhi: V('fhi', '#5E668C'), fmid: V('fmid', '#343A58'), flo: V('flo', '#141628'),
  ch: V('ch', '#EEF2FF'), chM: V('chM', '#8A92B8'), chD: V('chD', '#2C3150'), panel: V('panel', '#14162A') };
export const MECH_CSS = '#scene.egg-gold{--mk-hi:#FFEFB0;--mk-mid:#B8862B;--mk-lo:#4A300A;--mk-fhi:#8A6A2A;--mk-fmid:#5A3E10;--mk-flo:#241604;--mk-ch:#FFF8DC;--mk-chM:#D8A640;--mk-chD:#5E3F0C;--mk-panel:#2E1E04}';

// ------------------------------------------------------------------------------------------------ build
// piece registry (built once; attach reads it): { ref, at, dur, m: motion, ... }
let PIECES = [], SEAMS = [], ROOTS = [];
const PLATE = 'url(#egg-mkG)', PLATEF = 'url(#egg-mkGF)', CHROME = 'url(#egg-mkC)';
let nId = 0;
// a plate: fill + ink key line (+ optional panel-line / rivet detail that moves with it)
function plate(d, anim, { fill = PLATE, det = '', hi = '', sw = 1.2, extra = {} } = {}) {
  const ref = 'egg-mkp' + (nId++);
  PIECES.push({ ref, ...anim });
  const body = h('path', { d, fill, stroke: INK, 'stroke-width': sw, 'stroke-linejoin': 'round', 'fill-rule': 'evenodd' });
  if (!det && !hi) return h('path', { 'data-ref': ref, display: 'none', d, fill, stroke: INK, 'stroke-width': sw, 'stroke-linejoin': 'round', 'fill-rule': 'evenodd', ...extra });
  return h('g', { 'data-ref': ref, display: 'none', ...extra }, body,
    hi ? h('path', { d: hi, fill: 'none', stroke: PL.ch, 'stroke-width': 0.9, 'stroke-linecap': 'round', opacity: 0.85 }) : '',
    det ? h('path', { d: det, fill: 'none', stroke: PL.panel, 'stroke-width': 0.8, 'stroke-linecap': 'round' }) : '');
}
// an energy seam set for one group: soft colour glow + hot core; lit by the power-up wave (dist 0 = the reactor)
function seam(dist, d, col = C.cy, core = C.cyC, w = 1, d2 = '', col2 = C.mag, core2 = C.magC) {
  const ref = 'egg-mks' + SEAMS.length;
  SEAMS.push({ ref, dist });
  const k = { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
  return h('g', { 'data-ref': ref, display: 'none' },
    h('path', { d, ...k, stroke: col, 'stroke-width': f2(3.6 * w), opacity: 0.4 }), h('path', { d, ...k, stroke: core, 'stroke-width': f2(0.9 * w) }),
    d2 ? h('path', { d: d2, ...k, stroke: col2, 'stroke-width': f2(3.6 * w), opacity: 0.4 }) : '', d2 ? h('path', { d: d2, ...k, stroke: core2, 'stroke-width': f2(0.9 * w) }) : '');
}
// a slot root (hidden until the suit is armed)
function root(slot, kids, extra = {}) { ROOTS.push(slot); return h('g', { 'data-ref': 'egg-mkJ' + slot, display: 'none', ...extra }, kids); }
// joint hub ("seed"): the compact capsule each group unfolds from; it stays as the joint bolt
function hub(x, y, r, at, far = false) {
  return plate(circ(x, y, r) + circ(x, y, r * 0.48), { at, dur: 0.22, m: 'pop', p: [x, y] }, { fill: far ? PLATEF : CHROME, sw: 1 });
}

export function buildMech() {
  PIECES = []; SEAMS = []; ROOTS = []; nId = 0;
  const S = STG, ov = {};
  const stop = (o, c, a) => h('stop', { offset: o, style: `stop-color:${c}${a !== undefined ? ';stop-opacity:' + a : ''}` });
  let defs = h('linearGradient', { id: 'egg-mkG', x1: 0.2, y1: 0, x2: 0.45, y2: 1 }, stop(0, PL.hi), stop(0.34, PL.mid), stop(0.72, PL.lo), stop(1, PL.mid))
    + h('linearGradient', { id: 'egg-mkGF', x1: 0.2, y1: 0, x2: 0.45, y2: 1 }, stop(0, PL.fhi), stop(0.4, PL.fmid), stop(1, PL.flo))
    + h('linearGradient', { id: 'egg-mkC', x1: 0, y1: 0, x2: 0, y2: 1 }, stop(0, PL.ch), stop(0.42, PL.chM), stop(0.52, PL.chD), stop(0.7, PL.chM), stop(1, PL.ch))
    + h('radialGradient', { id: 'egg-mkCore' }, stop(0, C.cyC), stop(0.3, C.cy, 0.8), stop(1, C.cy, 0))
    + h('radialGradient', { id: 'egg-mkFl' }, stop(0, C.white), stop(0.3, C.cyC, 0.9), stop(0.65, C.cy, 0.5), stop(1, C.mag, 0))
    + h('radialGradient', { id: 'egg-mkUG' }, stop(0, C.cy, 0.55), stop(0.5, C.mag, 0.25), stop(1, C.mag, 0));

  // ---- FEET (foot-local: ankle pivot 0,0; sole y 6; toes to x ≈ 41): a sabaton that leaves the webs bare
  const boot = (far) => {
    const fl = far ? PLATEF : PLATE;
    return hub(0, 0, 5, S.boots - 0.06, far)
      + plate(P([[-10, -9], [-2, -12], [8, -10.4], [14.6, -5], [15.4, 2], [12.4, 7.4], [-7, 7.4], [-11, 3]]), { at: S.boots, m: 'hinge', p: [-7, 6], a0: -120 },
        { fill: fl, hi: far ? '' : 'M-8 -8.6L-2 -10.8L7.4 -9.2', det: far ? '' : 'M-9 2.6H13M2 -11V7' })
      + plate(P([[12, -6.4], [24, -7], [31, -3.6], [31.6, 3.6], [25, 7.2], [13, 7.2]]) + P([[17, -3.4], [19, -3.4], [19, 4.4], [17, 4.4]]) + P([[22.4, -3.6], [24.4, -3.6], [24.4, 4.6], [22.4, 4.6]]),
        { at: S.boots + 0.1, m: 'slide', v: [-15, 1] }, { fill: fl, hi: far ? '' : 'M13 -5.4L24 -6L30 -3' })
      + plate(P([[-10, 0.6], [-18, 4.6], [-16.4, 7], [-9, 6.6]]), { at: S.boots + 0.18, m: 'hinge', p: [-9, 4], a0: 95 }, { fill: fl, sw: 0.9 })
      + (far ? '' : seam(0.95, 'M-8.6 -6.6L-2 -9.4L7 -8L12.6 -3.6M-8 5H11', C.cy, C.cyC, 0.9, 'M18 -2.4V3.4M23.4 -2.6V3.6', C.mag, C.magC));
  };
  ov.footNear = root('footNear', boot(false));
  ov.footFar = root('footFar', boot(true));

  // ---- SHINS (knee-local: +x to the ankle 134; −y = the front of the shin): telescoping greaves + an ankle ring
  const greave = (far) => {
    const fl = far ? PLATEF : PLATE;
    return plate(P([[16, -11], [70, -10.4], [74, -6], [72, 4.6], [18, 5.4], [12, -3]]), { at: S.shins, m: 'tele', p: [12, 0], s0: 0.12 },
      { fill: fl, hi: far ? '' : 'M18 -9.6L69 -9', det: far ? '' : 'M30 -10V5M54 -10V4.8' })
      + plate(P([[66, -9.6], [118, -8.6], [124, -4.6], [122, 4], [68, 4.6]]), { at: S.shins + 0.1, m: 'tele', p: [66, 0], s0: 0.1 },
        { fill: fl, hi: far ? '' : 'M70 -8.4L117 -7.4', det: far ? '' : 'M92 -9V4.4M106 -8.8V4.2' })
      + plate(P([[120, -9.4], [134, -9.8], [138, -4], [138, 5], [133, 9], [121, 8]]), { at: S.shins + 0.2, m: 'flip', p: [129, 0] }, { fill: far ? PLATEF : CHROME, sw: 1 })
      + (far ? '' : seam(0.8, 'M20 -6.6H68M72 -5.4H118', C.cy, C.cyC, 1, 'M24 1.8H66M74 1H116', C.mag, C.magC));
  };
  ov.shankNear = root('shankNear', greave(false));
  ov.shankFar = root('shankFar', greave(true));

  // ---- THIGHS (hip-local: +x to the knee 142): a two-piece cuisse over the feathered trousers + the knee cop
  const cuisse = (far) => {
    const fl = far ? PLATEF : PLATE;
    return hub(0, -6, 8, S.thighs - 0.06, far)
      + plate(P([[-8, -31], [40, -27.4], [76, -19], [84, -8], [64, -2], [22, -3], [-10, -10]]), { at: S.thighs, m: 'hinge', p: [-2, -8], a0: -75 },
        { fill: fl, hi: far ? '' : 'M-4 -29.2L40 -25.8L74 -17.8', det: far ? '' : 'M18 -28.6L22 -3.4M50 -24L56 -2.6' })
      + plate(P([[66, -19], [110, -14.4], [124, -13], [126, 1], [112, 5], [74, 2]]), { at: S.thighs + 0.12, m: 'tele', p: [66, 0], s0: 0.12 },
        { fill: fl, hi: far ? '' : 'M70 -17.6L122 -11.8', det: far ? '' : 'M96 -15.6V3.6' })
      + plate(P([[126, -19], [146, -21.4], [159, -11], [161, 4], [151, 15], [133, 13.6], [124, 1]]) + circ(143, -2, 4.2), { at: S.thighs + 0.24, m: 'pop', p: [143, -2] },
        { fill: far ? PLATEF : CHROME, hi: far ? '' : 'M129 -16.6L146 -19.2L156 -10.6' })
      + (far ? '' : seam(0.62, 'M2 -22L38 -19.6L70 -12.6M78 -8.4L120 -4.6', C.cy, C.cyC, 1.1, 'M133 6.4Q143 12 153 4.6', C.mag, C.magC));
  };
  ov.thighNear = root('thighNear', cuisse(false));
  ov.thighFar = root('thighFar', cuisse(true));

  // ---- BODY (pelvis-local; ellipse centre (32,−50), front (125,−80), breast (127,−57), back (−64,−35)):
  // the fish reactor with rib plates closing over it, three dorsal plates on a rail, a twin-nozzle thruster pack
  {
    const k = [118, -72];
    const fishD = 'M-9 0C-5 -6.4 4 -6.6 8 -1.6L12 -5.6L11 0L12 5.6L8 1.6C4 6.6 -5 6.4 -9 0Z';
    const hex = r => P(Array.from({ length: 6 }, (_, i) => [k[0] + r * Math.cos((i * 60 + 30) * D2R), k[1] + r * Math.sin((i * 60 + 30) * D2R)]));
    const core = h('g', { 'data-ref': 'egg-mkCoreG', display: 'none' },
      h('path', { d: hex(15.6), fill: PL.lo, stroke: INK, 'stroke-width': 1.4, 'stroke-linejoin': 'round' }),
      h('path', { d: hex(15.6), fill: 'none', stroke: CHROME, 'stroke-width': 2.4, 'stroke-linejoin': 'round' }),
      h('g', { 'data-ref': 'egg-mkCoreL' }, h('path', { d: circ(k[0], k[1], 26), fill: 'url(#egg-mkCore)' }),
        h('path', { d: fishD, transform: `translate(${k[0]} ${k[1]})`, fill: C.cyC, stroke: C.cy, 'stroke-width': 1.6, 'stroke-linejoin': 'round' })),
      h('path', { d: circ(k[0] - 4, k[1] - 1, 1.1), fill: INK }));
    PIECES.push({ ref: 'egg-mkCoreG', at: S.chest - 0.04, dur: 0.26, m: 'pop', p: k });
    // ribs: hinged at the back (x ≈ 66), they swing shut over the chest from above and below, leaving the core window
    const ribs = [
      [[[64, -100], [92, -107], [116, -100], [127, -86], [117, -82], [96, -91], [66, -90]], [64, -95], -38, 0],
      [[[66, -88], [96, -89], [117, -80], [124, -73], [117, -70], [104, -76], [88, -76], [66, -77]], [64, -82], -52, 0.06],
      [[[70, -44], [92, -41], [104, -42], [120, -43], [117, -32], [96, -27], [70, -31]], [68, -37], 50, 0.06],
      [[[72, -28], [96, -24], [114, -29], [107, -17], [88, -10], [72, -15]], [70, -22], 64, 0.12]];
    let ribM = '';
    ribs.forEach(([pts, p, a0, dl], i) => { ribM += plate(P(pts), { at: S.chest + 0.08 + dl, m: 'hinge', p, a0 }, { hi: i < 2 ? `M${f(pts[0][0] + 2)} ${f(pts[0][1] + 1.6)}L${f(pts[1][0])} ${f(pts[1][1] + 1.6)}L${f(pts[2][0] - 1)} ${f(pts[2][1] + 1.8)}` : '' }); });
    // dorsal plates: slide up the back rail from the tail, each from under the previous one
    const dors = [
      [[[-68, -30], [-62, -47], [-46, -63], [-34, -54], [-48, -38], [-57, -22]], [-14, 18]],
      [[[-48, -62], [-28, -85], [-8, -96], [0, -82], [-17, -69], [-36, -55]], [-20, 22]],
      [[[-10, -96], [16, -108], [42, -113], [44, -98], [18, -91], [0, -83]], [-24, 14]]];
    let dorM = '';
    dors.forEach(([pts, v], i) => { dorM += plate(P(pts), { at: S.back + 0.08 * i, m: 'slide', v, s0: 0.55, p: pts[0] }, { hi: `M${f(pts[0][0] + 1)} ${f(pts[0][1] - 1)}L${f(pts[1][0])} ${f(pts[1][1] - 1)}L${f(pts[2][0])} ${f(pts[2][1] - 1)}`, det: `M${f((pts[1][0] + pts[4][0]) / 2)} ${f((pts[1][1] + pts[4][1]) / 2)}m-1.4 0a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0 -2.8 0` }); });
    // thruster pack: a chrome box with two nozzles venting back; its flames idle-flicker in the steady state
    const pack = plate(P([[-44, -92], [-20, -110], [4, -106], [8, -96], [-12, -80], [-34, -74]]) + P([[-26, -96], [-14, -103], [-12, -99], [-24, -92]]),
      { at: S.back + 0.22, m: 'tele', p: [-6, -94], s0: 0.15 }, { fill: PLATE, hi: 'M-40 -92L-20 -107.4L2 -104', det: 'M-28 -78L-6 -100' });
    const noz = plate(P([[-40, -97], [-46, -100], [-58, -102], [-58, -82], [-46, -84], [-40, -87]]) + P([[-32, -82], [-38, -85], [-50, -87], [-50, -68], [-38, -70], [-32, -73]]),
      { at: S.back + 0.32, m: 'slide', v: [16, -4] }, { fill: CHROME, sw: 1 });
    const flame = () => h('path', { d: 'M0 -9Q-22 -10 -50 0Q-22 10 0 9Z', fill: C.cy, opacity: 0.45 }) + h('path', { d: 'M0 -6Q-16 -6 -34 0Q-16 6 0 6Z', fill: 'url(#egg-mkFl)' }) + h('path', { d: 'M0 -3Q-9 -3 -18 0Q-9 3 0 3Z', fill: C.white });
    const flames = h('g', { 'data-ref': 'egg-mkFlame', display: 'none' },
      h('g', { 'data-ref': 'egg-mkFl0', transform: 'translate(-58 -92)' }, flame()), h('g', { 'data-ref': 'egg-mkFl1', transform: 'translate(-50 -77.5)' }, flame()));
    const vents = h('g', { 'data-ref': 'egg-mkVent', display: 'none' },
      h('path', { d: 'M-22 -96.6L-15 -100.4M-20.6 -94.2L-13.6 -98', fill: 'none', stroke: C.amber, 'stroke-width': 3.6, opacity: 0.45, 'stroke-linecap': 'round' }),
      h('path', { d: 'M-22 -96.6L-15 -100.4M-20.6 -94.2L-13.6 -98', fill: 'none', stroke: C.amberC, 'stroke-width': 1.1, 'stroke-linecap': 'round' }));
    const stat = h('path', { 'data-ref': 'egg-mkStat', display: 'none', d: circ(84, -96, 2.2), fill: C.acid, stroke: INK, 'stroke-width': 0.6 });
    ov.body = root('body', flames + dorM + pack + noz + vents + ribM + core + stat
      + seam(0.08, `M${k[0] - 22} ${k[1]}H${k[0] - 16}M${k[0] + 16} ${k[1]}H${k[0] + 22}M70 -84L96 -84L116 -76M74 -36L98 -34L116 -38`, C.cy, C.cyC, 1.2, 'M68 -96L92 -102L114 -96M76 -24L96 -20L108 -24', C.mag, C.magC)
      + seam(0.4, 'M-62 -34L-48 -50L-40 -46M-42 -64L-22 -84L-12 -78M-4 -94L18 -103L40 -106', C.mag, C.magC, 1.1, 'M-34 -86L-20 -100L-6 -98', C.cy, C.cyC));
  }

  // ---- WINGS (upper: shoulder-local, sleeve to the elbow 78; lower: elbow-local to the wrist 74; hand: wrist on the grip)
  const pauldron = (far) => {
    const fl = far ? PLATEF : PLATE;
    return hub(0, -2, 7, S.back + 0.1, far)
      + plate(P([[-38, -4], [-32, -24], [-12, -32], [14, -30], [27, -20], [16, -10], [-12, -11], [-28, 6]]), { at: S.back + 0.14, m: 'hinge', p: [-32, 2], a0: -100 },
        { fill: fl, hi: far ? '' : 'M-34 -8L-30 -22L-12 -29.6L12 -27.6', det: far ? '' : 'M-20 -27L-8 -10M2 -30L8 -10' })
      + plate(P([[-30, 2], [-22, -10], [0, -14], [20, -12], [26, -4], [6, 0], [-14, 2], [-24, 12]]), { at: S.back + 0.24, m: 'hinge', p: [-26, 6], a0: -70 }, { fill: fl, hi: far ? '' : 'M-26 -2L-20 -8.4L0 -12' })
      + plate(P([[24, -22], [62, -19.4], [72, -12], [64, -4], [26, -6]]), { at: S.wings, m: 'slide', v: [-26, 2] }, { fill: fl, hi: far ? '' : 'M27 -20.6L61 -18' })
      + (far ? '' : seam(0.3, 'M-30 -14L-12 -22L12 -21M28 -13L64 -11.6', C.cy, C.cyC, 1, 'M-20 4L0 -2L18 -4', C.mag, C.magC));
  };
  ov.wingNearUpper = root('wingNearUpper', pauldron(false));
  ov.wingFarUpper = root('wingFarUpper', pauldron(true));
  const gauntlet = (far) => {
    const fl = far ? PLATEF : PLATE;
    let blades = '';
    for (let i = 0; i < 5; i++) {
      const bx = 10 + i * 14, by = 3, a = (104 - 9 * i) * D2R, L = 30 + i * 4, w = 4.2, c = Math.cos(a), s = Math.sin(a);
      const pt = (u, v) => [bx + c * u - s * v, by + s * u + c * v];
      blades += plate(P([pt(0, -w), pt(L * 0.78, -w * 1.05), pt(L, 0), pt(L * 0.8, w * 0.95), pt(0, w)]), { at: S.wings + 0.12 + 0.06 * i, m: 'hinge', p: [bx, by], a0: -(104 - 9 * i) + 6 },
        { fill: fl, sw: 1, hi: far ? '' : P([pt(3, -w + 1.2), pt(L * 0.74, -w + 0.8)], false) });
    }
    return blades
      + plate(P([[4, -14], [56, -12.6], [74, -7], [72, 5], [8, 7], [0, -4]]), { at: S.wings, m: 'tele', p: [2, 0], s0: 0.14 },
        { fill: fl, hi: far ? '' : 'M6 -12.6L55 -11.2L71 -6.4', det: far ? '' : 'M24 -13.4V6.6M44 -12.8V6' })
      + (far ? '' : seam(0.5, 'M8 -7H70', C.cy, C.cyC, 1, 'M10 3.4H68', C.mag, C.magC));
  };
  ov.wingNearLower = root('wingNearLower', gauntlet(false));
  ov.wingFarLower = root('wingFarLower', gauntlet(true));
  ov.wingNearHand = root('wingNearHand', plate(P([[-21, -11], [-9, -18], [3, -17], [9.6, -10], [5, -5.4], [-6, -7.6], [-18, -5.6]]), { at: S.wings + 0.36, m: 'hinge', p: [-18, -6], a0: -60 },
    { hi: 'M-18 -11.4L-9 -16.4L2 -15.6', det: 'M-8 -17L-5 -7.4' }) + seam(0.62, 'M-16 -9L-6 -12.4L4 -11', C.cy, C.cyC, 0.9));

  // ---- NECK: five stacked collars, built at a nominal half width of 20 (scaled per frame to the live neck width)
  {
    let rings = '';
    for (let i = 0; i < 5; i++) {
      const ref = 'egg-mkN' + i;
      rings += h('g', { 'data-ref': ref, display: 'none' },
        h('path', { d: P([[-4.6, -23], [4.6, -22], [6.4, -18], [6.4, 18], [4.6, 22], [-4.6, 23], [-6.4, 19], [-6.4, -19]]), fill: PLATE, stroke: INK, 'stroke-width': 1.2, 'stroke-linejoin': 'round' }),
        h('path', { d: 'M-4.4 -21L-4.4 21M3.6 -20.4V20.4', fill: 'none', stroke: PL.ch, 'stroke-width': 0.8, opacity: 0.7 }),
        h('path', { 'data-ref': ref + 'S', d: 'M0.2 -19.6V19.6', fill: 'none', stroke: i % 2 ? C.mag : C.cy, 'stroke-width': 1.6, opacity: 0 }));
    }
    ov.neck = root('neck', rings);
  }

  // ---- BILL: segmented sheaths that telescope out along the culmen (the yellow cutting edge + the chrome nail stay bare)
  {
    const topY = x => (x < 20 ? lerp(-13, -13.6, (x + 4) / 24) : x < 60 ? lerp(-13.6, -9.8, (x - 20) / 40) : x < 100 ? lerp(-9.8, -7.1, (x - 60) / 40) : lerp(-7.1, -6.7, (x - 100) / 21));
    let up = '', segs = [];
    for (let i = 0; i < 5; i++) {
      const x0 = 8 + i * 21, x1 = x0 + 19;
      segs.push([x0, x1]);
      up += plate(P([[x0, topY(x0) - 1.6], [x1, topY(x1) - 1.5], [x1 + 2.2, (topY(x1) - 1.5 - 1.2) / 2], [x1, -1.2], [x0, -1.2]]),
        { at: S.helmet + 0.02 + 0.05 * i, m: 'slide', v: [8 - x0, 0], dur: 0.32 }, { fill: CHROME, sw: 1, hi: `M${f(x0 + 1)} ${f(topY(x0) - 0.4)}L${f(x1 - 1)} ${f(topY(x1) - 0.3)}` });
    }
    ov.billUpper = root('billUpper', up + seam(0.9, segs.map(([a, b]) => `M${f(a + 2)} ${f((topY(a) - 1.2) / 2 - 0.4)}L${f(b - 2)} ${f((topY(b) - 1.2) / 2 - 0.4)}`).join(''), C.cy, C.cyC, 0.6));
    let lo = '';
    for (let i = 0; i < 3; i++) {
      const x0 = 18 + i * 31, x1 = x0 + 28;
      lo += plate(P([[x0, 1.6], [x1, 1.2], [x1 + 2, 3.2], [x1, 5.2], [x0, 6.2]]), { at: S.helmet + 0.06 + 0.06 * i, m: 'slide', v: [18 - x0, 0], dur: 0.3 }, { fill: CHROME, sw: 0.8 });
    }
    ov.billLower = root('billLower', lo);
    // pouch: a flexible diamond mesh unrolling down from the mandible (clipped to the pouch's own outline)
    let mesh = '';
    for (let x = -60; x < 130; x += 9) mesh += `M${x} -4L${x + 26} 34M${x + 26} -4L${x} 34`;
    ov.pouch = root('pouch', h('g', { 'data-ref': 'egg-mkMesh', display: 'none' },
      h('g', { 'clip-path': 'url(#pb-pouchclip)' },
        h('path', { d: 'M-40 -4H110V34H-40Z', fill: PL.lo, opacity: 0.32 }),
        h('path', { d: mesh, fill: 'none', stroke: PL.lo, 'stroke-width': 1.6 }),
        h('path', { d: mesh, fill: 'none', stroke: PL.chM, 'stroke-width': 0.55 })),
      h('path', { d: 'M-27 -4.2L107 -4.2L104 0.6L-26 1.2Z', fill: CHROME, stroke: INK, 'stroke-width': 0.8 })));
    PIECES.push({ ref: 'egg-mkMesh', at: S.helmet + 0.1, dur: 0.4, m: 'unroll', p: [0, -4] });
  }

  // ---- HELMET (head space via the crest slot): back shell folds over the skull from the nape, the crown slides
  // forward on its rail, the jaw guard flips up, a crest vent at the back, then the visor slams down over the eye
  {
    const hl = plate(P([[-34, -6], [-29, -23], [-15, -33], [2, -35.4], [7, -24], [-5, -14], [-13, 1], [-19, 14], [-30, 13]]),
      { at: S.helmet, m: 'hinge', p: [-27, 12], a0: 130 }, { hi: 'M-31 -8L-27 -21L-15 -30.6L1 -33', det: 'M-24 -20L-10 -10M-12 -31L-4 -16' });
    const crown = plate(P([[-3, -36], [15, -34], [29, -25], [38, -15], [31, -12.6], [17, -21], [1, -25]]),
      { at: S.helmet + 0.1, m: 'slide', v: [-22, 8], s0: 0.6, p: [-3, -36] }, { hi: 'M0 -34.4L15 -32.4L28 -24' });
    const jaw = plate(P([[-14, 5], [2, 7.4], [17, 5], [24, 0], [28, 3.4], [20, 12.6], [3, 18.4], [-11, 16.6]]),
      { at: S.helmet + 0.16, m: 'flip', p: [6, 5] }, { hi: 'M-11 7L2 9L16 7' });
    const fin = plate(P([[-24, -27], [-14, -40], [-6, -37], [-10, -30]]), { at: S.helmet + 0.22, m: 'hinge', p: [-14, -29], a0: -80 }, { fill: CHROME, sw: 0.9 });
    const visor = h('g', { 'data-ref': 'egg-mkVisor', display: 'none' },
      h('path', { d: P([[-16, -18.4], [6, -20.6], [31, -16.2], [42, -9.4], [35, -4.4], [14, -3.4], [-6, -5], [-16, -8]]), fill: C.cy, 'fill-opacity': 0.32, stroke: INK, 'stroke-width': 1.5, 'stroke-linejoin': 'round' }),
      h('path', { d: 'M-15 -15.6L6 -17.6L30 -13.6L39 -9', fill: 'none', stroke: C.cyC, 'stroke-width': 0.9, opacity: 0.9 }),
      h('path', { d: P([[-17, -18.6], [6, -21], [31, -16.6], [37, -13], [30, -14.6], [6, -18], [-15, -16]]), fill: PL.lo, stroke: INK, 'stroke-width': 0.8 }),
      h('path', { 'data-ref': 'egg-mkGlint', d: star4(7, 1.3), fill: C.white, stroke: C.cy, 'stroke-width': 0.6, transform: 'translate(8 -12)', display: 'none' }));
    PIECES.push({ ref: 'egg-mkVisor', at: S.visor, dur: 0.2, m: 'slam', p: [-17, -16], a0: -62 });
    const vflash = h('path', { 'data-ref': 'egg-mkVFlash', display: 'none', d: circ(12, -11, 30), fill: 'url(#egg-mkCore)' });
    const stat = h('path', { 'data-ref': 'egg-mkHStat', display: 'none', d: P([[-27, -12], [-23, -13], [-22.6, -10], [-26.6, -9]]), fill: C.acid, stroke: INK, 'stroke-width': 0.5 });
    ov.crest = root('crest', h('g', { 'data-ref': 'egg-mkHead' }, hl + crown + fin + jaw + stat + visor + vflash
      + seam(0.92, 'M-30 -10L-26 -20L-14 -29L0 -31', C.cy, C.cyC, 0.9, 'M2 -30L14 -29L26 -21M-9 12L4 15L16 10', C.mag, C.magC)));
  }

  // ---- BIKE fairing (frame slot = rider space): it slides on during the power-up, with an upgraded underglow bar
  ov.frame = root('frame',
    plate(P([[100, -268], [128, -265], [146, -248], [151, -214], [137, -196], [121, -200], [111, -240]]), { at: 2.62, m: 'slide', v: [-30, 6], s0: 0.5, p: [125, -230] }, { hi: 'M104 -264L127 -262L143 -247' })
    + plate(P([[117, -192], [129, -186], [62, -110], [36, -91], [24, -99], [42, -118], [100, -180]]), { at: 2.7, m: 'slide', v: [44, -50] }, { hi: 'M118 -189L44 -113' })
    + plate(P([[-104, -270], [-26, -265], [-34, -250], [-72, -244], [-98, -254]]), { at: 2.78, m: 'slide', v: [24, 10], s0: 0.4, p: [-60, -258] }, { fill: CHROME, sw: 1, hi: 'M-98 -268L-30 -263' })
    + seam(0.75, 'M120 -186L40 -100M-92 -258L-40 -256', C.cy, C.cyC, 1.3, 'M112 -236L136 -246L146 -218', C.mag, C.magC));

  // ---- rider-space fx (L-fx-front, under the eggs' rider frame): lock-on reticle, scan ring, joint sparks, hero rays
  let fx = '';
  {
    const bx0 = -236, bx1 = 304, by0 = -616, by1 = 8, L = 34;
    const br = `M${bx0} ${by0 + L}V${by0}H${bx0 + L}M${bx1 - L} ${by0}H${bx1}V${by0 + L}M${bx1} ${by1 - L}V${by1}H${bx1 - L}M${bx0 + L} ${by1}H${bx0}V${by1 - L}`;
    fx += h('g', { 'data-ref': 'egg-mkRet', display: 'none' },
      h('g', { 'data-ref': 'egg-mkRetB' }, h('path', { d: br, fill: 'none', stroke: C.cy, 'stroke-width': 7, opacity: 0.2 }), h('path', { d: br, fill: 'none', stroke: C.cyC, 'stroke-width': 2 })),
      h('g', { 'data-ref': 'egg-mkRetC', transform: 'translate(34 -330)' },
        h('path', { d: circ(0, 0, 214), fill: 'none', stroke: C.acid, 'stroke-width': 1.3, 'stroke-dasharray': '22 10 4 10', opacity: 0.85 }),
        h('path', { d: 'M-236 0H-196M196 0H236M0 -236V-196M0 196V236', stroke: C.acid, 'stroke-width': 2.4 })));
    fx += h('g', { 'data-ref': 'egg-mkScan', display: 'none' },
      h('path', { d: 'M-220 -60H260V0H-220Z', fill: 'url(#egg-scanG)', opacity: 0.8 }),
      h('path', { d: 'M-200 0a220 22 0 1 0 440 0a220 22 0 1 0 -440 0', fill: 'none', stroke: C.cy, 'stroke-width': 12, opacity: 0.3 }),
      h('path', { d: 'M-200 0a220 22 0 1 0 440 0a220 22 0 1 0 -440 0', fill: 'none', stroke: C.cyC, 'stroke-width': 2.6 }));
    let sp = '';
    for (let i = 0; i < 8; i++) { const a = (i / 8) * 2 * Math.PI + 0.3, r0 = 6, r1 = 14 + 6 * hsh(i, 2); sp += `M${f(Math.cos(a) * r0)} ${f(Math.sin(a) * r0)}L${f(Math.cos(a) * r1)} ${f(Math.sin(a) * r1)}`; }
    for (let j = 0; j < 6; j++) fx += h('g', { 'data-ref': 'egg-mkSp' + j, display: 'none' },
      h('path', { d: circ(-4, -10, 13), fill: '#C9C6E8', opacity: 0.32 }),
      h('path', { d: sp, fill: 'none', stroke: C.amber, 'stroke-width': 1.6, 'stroke-linecap': 'round' }),
      h('path', { d: star4(7, 1.4), fill: C.white }));
    let rays = '';
    for (let i = 0; i < 28; i++) { const a = (i / 28) * 2 * Math.PI, r0 = 250 + 40 * hsh(i, 7), r1 = r0 + 60 + 70 * hsh(i, 8); rays += `M${f(Math.cos(a) * r0)} ${f(Math.sin(a) * r0 * 0.9)}L${f(Math.cos(a) * r1)} ${f(Math.sin(a) * r1 * 0.9)}`; }
    fx += h('g', { 'data-ref': 'egg-mkRays', display: 'none', transform: 'translate(40 -330)' },
      h('path', { d: rays, fill: 'none', stroke: C.cy, 'stroke-width': 3, opacity: 0.35, 'stroke-linecap': 'round' }),
      h('path', { d: rays, fill: 'none', stroke: C.cyC, 'stroke-width': 1, 'stroke-linecap': 'round' }));
  }
  // road (L-fx-back, rider space): the power-up shockwave ring and the upgraded underglow
  const back = h('g', { 'data-ref': 'egg-mkRoad', display: 'none' },
    h('path', { 'data-ref': 'egg-mkUGlow', d: 'M-260 -2a284 20 0 1 0 568 0a284 20 0 1 0 -568 0', fill: 'url(#egg-mkUG)', opacity: 0 }),
    h('g', { 'data-ref': 'egg-mkShock', display: 'none' },
      h('path', { d: 'M-100 0a100 9 0 1 0 200 0a100 9 0 1 0 -200 0', fill: 'none', stroke: C.cy, 'stroke-width': 9, opacity: 0.3 }),
      h('path', { d: 'M-100 0a100 9 0 1 0 200 0a100 9 0 1 0 -200 0', fill: 'none', stroke: C.cyC, 'stroke-width': 2.2 })));
  return { defs, overlay: ov, fx, back };
}

// ------------------------------------------------------------------------------------------------ runtime
// progress: a = seconds of assembly shown now (a pure function of the egg state and t); power = level of the
// powered-up suit (0 while growing / rewinding)
export function mechProgress(m, t) {
  if (!m) return null;
  if (m.off === undefined) return { a: t - m.t0, rev: false, pw: 1 };
  const a1 = Math.min(m.off - m.t0, MK.grow), a = a1 - (t - m.off) * MK.rev;
  return { a, rev: true, pw: 1 - sstep(0, 0.35, t - m.off), aOn: m.off - m.t0 };
}

// sparks + steam puffs: one as each growth stage locks (at its joint), then a burst at the joints for the power-up.
// [joint, s from t0]; six pooled sprites take every 6th event (events on one sprite are ≥ 0.42 s apart)
const SPARK = [['footNear', 0.74], ['shankNear', 0.94], ['thighNear', 1.16], ['wingNearUpper', 1.4], ['crest', 1.62], ['wingNearLower', 1.86],
  ['head', 2.16], ['billUpper', 2.36], ['footNear', 2.82], ['shankNear', 2.74], ['thighNear', 2.66], ['wingNearUpper', 2.64], ['wingNearLower', 2.72], ['head', 2.8]];
const SPARK_DUR = 0.42;

export function attachMech(r, set, reduced) {
  const disp = (el, on) => { if (el) set(el, 'display', on ? 'inline' : 'none'); };
  const roots = ROOTS.map(s => r['mkJ' + s]);
  const pieces = PIECES.map(p => ({ ...p, el: r[p.ref.slice(4)], dur: p.dur || 0.36 }));
  const seams = SEAMS.map(s => ({ ...s, el: r[s.ref.slice(4)] }));
  const rings = [0, 1, 2, 3, 4].map(i => ({ el: r['mkN' + i], s: r['mkN' + i + 'S'] }));
  const RING_T = [0.24, 0.38, 0.52, 0.66, 0.8];
  let settled = false, wasOn = false;
  const pieceXf = (p, a) => {
    const u = (a - p.at) / p.dur;
    if (u <= 0) return null;
    if (u >= 1) return '';
    const e = reduced ? sstep(0, 1, u) : mechE(u), k = 1 - e, [px, py] = p.p || [0, 0];
    switch (p.m) {
      case 'hinge': return `rotate(${f(p.a0 * k)} ${px} ${py})`;
      case 'slide': { const s = p.s0 ? lerp(p.s0, 1, Math.min(1, e)) : 1; return `translate(${f(p.v[0] * k)} ${f(p.v[1] * k)})` + (s !== 1 ? ` translate(${px} ${py}) scale(${f2(s)}) translate(${-px} ${-py})` : ''); }
      case 'tele': return `translate(${px} ${py}) scale(${f2(Math.max(0.02, lerp(p.s0, 1, e)))} 1) translate(${-px} ${-py})`;
      case 'flip': return `translate(${px} ${py}) scale(1 ${f2(Math.max(0.02, Math.abs(Math.cos(Math.PI * k * 0.98))))}) translate(${-px} ${-py})`;
      case 'pop': { const s = Math.max(0.02, e); return `translate(${px} ${py}) scale(${f2(s)}) translate(${-px} ${-py})`; }
      case 'unroll': return `translate(0 ${py}) scale(1 ${f2(Math.max(0.02, Math.min(1.06, e)))}) translate(0 ${-py})`;
      case 'slam': { const v = Math.min(1, u * u * 1.4); return `rotate(${f(p.a0 * (1 - v))} ${px} ${py})`; }   // accelerates into the stop (no ease-out: a slam)
      default: return '';
    }
  };
  return {
    // fr: frame, st: mechProgress(...) or null, extra: { riderF } refs written by the caller
    update(fr, st) {
      const on = !!st && st.a > STG.boots - 0.08 - 0.001;
      if (!on) {
        if (wasOn) { for (const el of roots) disp(el, false); for (const k of ['mkRet', 'mkScan', 'mkRays', 'mkRoad']) disp(r[k], false); for (let j = 0; j < 6; j++) disp(r['mkSp' + j], false); }
        wasOn = false; settled = false;
        // arming happens before any plate: the reticle + scan still run
        if (st && !st.rev) this.arming(fr, st.a); else { disp(r.mkRet, false); disp(r.mkScan, false); }
        return;
      }
      if (!wasOn) { for (const el of roots) disp(el, true); disp(r.mkRoad, true); settled = false; }
      wasOn = true;
      const a = st.a, t = fr.t, J = fr.pose.joints;
      this.arming(fr, st.rev ? 99 : a);
      // ---- plates (skipped once everything has settled: nothing left to write)
      const allDone = !st.rev && a > MK.power;
      if (!(allDone && settled)) {
        for (const p of pieces) {
          const x = pieceXf(p, a);
          disp(p.el, x !== null);
          if (x !== null) set(p.el, 'transform', x);
        }
        settled = allDone;
      }
      // ---- neck collars: telescoping up the live neck curve, each out of the one below
      const n = fr.pose.neck;
      for (let i = 0; i < 5; i++) {
        const u = (a - (STG.neck + 0.07 * i)) / 0.34, rg = rings[i];
        if (u <= 0) { disp(rg.el, false); continue; }
        disp(rg.el, true);
        const e = u >= 1 ? 1 : (reduced ? sstep(0, 1, u) : mechE(u));
        const t0 = i ? RING_T[i - 1] : 0.1, tt = clamp(lerp(t0, RING_T[i], e), 0.04, 0.96);
        const q = neckAt(n, tt), ang = Math.atan2(q.tn[1], q.tn[0]) / D2R;
        const sc = Math.max(0.05, Math.min(1.12, 0.4 + 0.6 * e));
        set(rg.el, 'transform', `translate(${f(q.c[0])} ${f(q.c[1])}) rotate(${f(ang)}) scale(${f2(sc)} ${f2(sc * (q.w + 2.2) / 20)})`);
      }
      // ---- helmet carrier: inverse(crest)·head, so the helmet sits in head space above the eye
      const hj = J.head, cj = J.crest;
      if (hj && cj) set(r.mkHead, 'transform', `scale(${f2(1 / (cj.sx ?? 1))} ${f2(1 / (cj.sy ?? 1))}) rotate(${f2(-(cj.rot || 0))}) translate(${f2(hj.x - cj.x)} ${f2(hj.y - cj.y)}) rotate(${f2(hj.rot || 0)})`);
      // ---- power: seams light in a wave from the reactor outward; vents flare; the core breathes
      const aP = st.rev ? st.aOn : a, pw = st.pw;
      for (const s of seams) {
        const L0 = sstep(MK.grow + 0.32 * s.dist, MK.grow + 0.12 + 0.32 * s.dist, aP) * pw;
        disp(s.el, L0 > 0.01);
        if (L0 > 0.01) set(s.el, 'opacity', f2(L0));
      }
      for (let i = 0; i < 5; i++) set(rings[i].s, 'opacity', f2(sstep(MK.grow + 0.3 + 0.06 * i, MK.grow + 0.42 + 0.06 * i, aP) * pw));
      const coreLv = (0.35 * sstep(STG.chest, STG.chest + 0.3, a) + 0.65 * sstep(MK.grow - 0.05, MK.grow + 0.1, aP) * pw) * (aP > MK.hero ? 0.82 + 0.18 * Math.sin(t * 2.6) : 1);
      set(r.mkCoreL, 'opacity', f2(clamp(coreLv, 0, 1)));
      const flare = bump(MK.grow + 0.12, MK.grow + 0.55, aP) * pw;
      disp(r.mkVent, pw > 0.01 && aP > MK.grow + 0.1);
      set(r.mkVent, 'opacity', f2(clamp(0.45 + 0.55 * flare, 0, 1) * pw));
      disp(r.mkStat, a > STG.chest + 0.2); disp(r.mkHStat, a > STG.visor + 0.2);
      if (aP > MK.grow) set(r.mkStat, 'opacity', (Math.floor(t * 2.2) % 2 || aP < MK.hero) ? '1' : '0.35');
      // thrusters: ignite with a burst at 2.8 s, then a flickering idle (quantised to 30 Hz so stills are exact)
      const ign = sstep(MK.grow + 0.18, MK.grow + 0.3, aP) * pw;
      disp(r.mkFlame, ign > 0.01);
      if (ign > 0.01) {
        const burst = 1 + 0.9 * bump(MK.grow + 0.2, MK.grow + 0.7, aP);
        for (let i = 0; i < 2; i++) {
          const q = Math.floor(t * 30), fl = reduced ? 0.9 : 0.78 + 0.22 * hsh(q, 11 + i);
          set(r['mkFl' + i], 'transform', `translate(${i ? '-50 -77.5' : '-58 -92'}) scale(${f2(ign * burst * fl)} ${f2(Math.min(1.3, 0.7 + 0.3 * ign * burst))})`);
        }
      }
      // ---- visor slam flash + hero glint
      const vf = bump(STG.visor + 0.17, STG.visor + 0.42, a) * (st.rev ? 0 : 1);
      disp(r.mkVFlash, vf > 0.01); if (vf > 0.01) set(r.mkVFlash, 'opacity', f2(vf));
      const gl = st.rev ? -1 : (a - 3.3) / 0.36;
      disp(r.mkGlint, gl > 0 && gl < 1);
      if (gl > 0 && gl < 1) set(r.mkGlint, 'transform', `translate(${f(lerp(-10, 34, gl))} ${f(lerp(-14, -9, gl))}) rotate(${f(gl * 90)}) scale(${f2(Math.sin(Math.PI * gl) * 1.5)})`);
      // ---- sparks + steam at the joints (power-up), the shockwave on the road, the underglow
      for (let j = 0; j < 6; j++) {
        const el = r['mkSp' + j];
        let ev = null, u = 0;
        for (let k = j; k < SPARK.length; k += 6) { const uu = ((k < 8 ? a : aP) - SPARK[k][1]) / SPARK_DUR; if (uu > 0 && uu < 1) { ev = SPARK[k]; u = uu; } }
        const jj = ev && J[ev[0]], vis = !reduced && !st.rev && !!jj;
        disp(el, vis);
        if (vis) { set(el, 'transform', `translate(${f(jj.x)} ${f(jj.y - 18 * u)}) rotate(${f(u * 60 + j * 40)}) scale(${f2(0.5 + 0.9 * Math.sin(Math.PI * Math.min(1, u * 1.4)))})`); set(el, 'opacity', f2(1 - u * u)); }
      }
      const sw = (aP - MK.grow - 0.02) / 0.6;
      disp(r.mkShock, !st.rev && sw > 0 && sw < 1);
      if (!st.rev && sw > 0 && sw < 1) { set(r.mkShock, 'transform', `translate(24 0) scale(${f2(0.3 + 3.2 * sstep(0, 1, sw))})`); set(r.mkShock, 'opacity', f2(1 - sw)); }
      set(r.mkUGlow, 'opacity', f2(sstep(MK.grow + 0.1, MK.grow + 0.4, aP) * pw * (aP > MK.hero ? 0.85 + 0.15 * Math.sin(t * 5.3) : 1)));
      const ry = st.rev ? -1 : (a - MK.power) / 0.42;
      disp(r.mkRays, !reduced && ry > 0 && ry < 1);
      if (!reduced && ry > 0 && ry < 1) { set(r.mkRays, 'transform', `translate(40 -330) scale(${f2(1.25 - 0.3 * ry)})`); set(r.mkRays, 'opacity', f2(Math.sin(Math.PI * ry))); }
    },
    // arming: lock-on reticle closes on the rider, a ring of light sweeps down the body
    arming(fr, a) {
      const ret = a >= 0 && a < 1.0;
      disp(r.mkRet, ret);
      if (ret) {
        const k = 1 - mechE(clamp(a / 0.3, 0, 1));
        set(r.mkRetB, 'transform', `translate(34 -304) scale(${f2(1 + 0.35 * k)}) translate(-34 304)`);
        set(r.mkRetC, 'transform', `translate(34 -330) rotate(${f(a * 120)}) scale(${f2(1 + 0.25 * k)})`);
        set(r.mkRet, 'opacity', f2(sstep(0, 0.08, a) * (1 - sstep(0.7, 1.0, a))));
      }
      const su = (a - 0.06) / 0.36;
      disp(r.mkScan, !reduced && su > 0 && su < 1);
      if (!reduced && su > 0 && su < 1) { set(r.mkScan, 'transform', `translate(34 ${f(lerp(-600, -10, su))})`); set(r.mkScan, 'opacity', f2(Math.sin(Math.PI * su) * 0.9 + 0.1)); }
    },
  };
}
