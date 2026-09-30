// OWNER: eggs. Easter eggs (彩蛋) for Pelican Bay, printed in the seven inks of the hour like everything else (STYLE-C).
// Spoilers: docs/EGGS.md. Test API: window.__pb.eggs = { list, trigger(id), found() }; tools/check-eggs.mjs shoots each one.
//
// Every egg is an X-sheet: a start time t0 (sim time) + a pure function of (frame.t - t0, frame.distance, pose). Live
// detection (keys, clicks, bus events, odometer crossings) only ever sets t0, so window.__pb.renderAt(t) stays exact
// and nothing is created or destroyed at run time: all art is built once and shown / hidden / moved by transform.
//
//   brown      ↑↑↓↓←→←→BA  the rider becomes Simon Willison's stricter benchmark: a California brown pelican in
//                          breeding plumage (ink override on the rider's slots; the code again turns it back)
//   velo       type GIMINI  a Gimini "Velocipedia" chain bolted to the front hub: the drivetrain jams, the chain SNAPs
//   cat        ring the bell while the ginger cat's bench is on screen: it leaps up and steals a fish
//   km         every whole kilometre on the odometer: a tiny travel-poster pops up in confetti
//   fortytwo   at 4.2 km: "42! DON'T PANIC"
//   sunwink    click the sun: it winks
//   moonwink   click the moon: it winks too
//   ufo        feed the pelican at night: a saucer beams a second fish out of the basket
//   chorus     ring the bell 7 times in 3.5 s: five gulls answer in chorus
//   splash     land a hop in a road puddle: SPLASH!
//   bottle     click the message in a bottle bobbing in the bay: a bilingual note unfolds
//   wish       click a shooting star while it is still glowing: make a wish
//   flight     type BIRD: a V of great white pelicans flies over the bay
import { fmt1, fmt2 } from '../core/math.js';
import { GROUND_Y, RIDER_X, BIKE, DIST_PER_REV } from '../contract.js';
import { h, refs } from '../core/svg.js';
import { TIMING } from '../rig/solve.js';
import { LAT, ZH } from './egg-glyphs.js';

export const id = 'eggs';
export const materials = {};

// ------------------------------------------------------------------------------------------------ list (bilingual)
export const EGGS = [
  ['brown', '褐鹈鹕', 'Brown pelican', '↑↑↓↓←→←→BA'],
  ['velo', '维洛西佩迪亚', 'Velocipedia', 'type GIMINI'],
  ['cat', '偷鱼猫', 'The fish thief', 'ring near the cat'],
  ['km', '一公里', 'First kilometre', 'ride 1 km'],
  ['fortytwo', '四十二', 'Forty-two', 'ride 4.2 km'],
  ['sunwink', '太阳眨眼', 'Winking sun', 'click the sun'],
  ['moonwink', '月亮眨眼', 'Winking moon', 'click the moon'],
  ['ufo', '夜空来客', 'Close encounter', 'feed at night'],
  ['chorus', '海鸥合唱', 'Gull chorus', 'ring 7×'],
  ['splash', '水花', 'Splash', 'hop into a puddle'],
  ['bottle', '漂流瓶', 'Message in a bottle', 'click the bottle'],
  ['wish', '流星许愿', 'Wish upon a star', 'click a shooting star'],
  ['flight', '鹈鹕雁阵', 'Pelican squadron', 'type BIRD'],
].map(([k, zh, en, how]) => ({ id: k, zh, en, how }));
const DUR = { brown: 6, velo: 3.4, cat: 2.6, km: 3.4, fortytwo: 4, sunwink: 2.4, moonwink: 2.4, ufo: 6.8, chorus: 3.6, splash: 1.5, bottle: 7, wish: 2.4, flight: 9 };

export const detailItems = [];   // eggs are hidden in the default shots (see docs/EGGS.md); nothing counted

// ------------------------------------------------------------------------------------------------ helpers
const f = fmt1;   // = String(Math.round(x * 10) / 10), fast (core/math.js)
const f2 = fmt2;   // = String(Math.round(x * 100) / 100), fast (core/math.js)
const TAU = Math.PI * 2, D2R = Math.PI / 180;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
const wrap = (x, m) => ((x % m) + m) % m;
const easeOutBack = u => { const c = 1.9, v = u - 1; return 1 + (c + 1) * v * v * v + c * v * v; };
const hash = (a, b = 0) => {
  let x = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x632be5ab, 0xc2b2ae35);
  x ^= x >>> 15; x = Math.imul(x, 0x2c1b3c6d); x ^= x >>> 12; x = Math.imul(x, 0x297a2d39); x ^= x >>> 15;
  return (x >>> 0) / 4294967296;
};
const circ = (x, y, r) => `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
const poly = (pts, close = true) => 'M' + pts.map(p => f(p[0]) + ' ' + f(p[1])).join('L') + (close ? 'Z' : '');
const star4 = (r, w) => `M0 ${f(-r)}L${f(w)} ${f(-w)}L${f(r)} 0L${f(w)} ${f(w)}L0 ${f(r)}L${f(-w)} ${f(w)}L${f(-r)} 0L${f(-w)} ${f(-w)}Z`;
const burstD = (rx, ry, n, seed) => {
  const pts = [];
  for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * TAU, r = i % 2 ? 0.74 + hash(seed, i) * 0.06 : 1 + hash(seed, i + 99) * 0.12; pts.push([Math.cos(a) * rx * r, Math.sin(a) * ry * r]); }
  return poly(pts);
};
// halftone dots as one stroked path of zero-length segments (static art only)
function dots(x0, x1, y0, y1, s, clip) {
  let d = '';
  for (let j = 0, y = y0; y <= y1; j++, y = y0 + j * s * 0.866)
    for (let x = x0 + (j % 2 ? s / 2 : 0); x <= x1; x += s) if (!clip || clip(x, y)) d += `M${f(x)} ${f(y)}h0`;
  return d;
}
// glyph run -> one merged path (em 1000 outlines scaled to `size`, anchored by `align` at (ox, oy) on the baseline)
function text(str, size, ox = 0, oy = 0, { align = 'middle', track = 30 } = {}) {
  const s = size / 1000;
  let pen = 0; const parts = [];
  for (const ch of str) {
    if (ch === ' ') { pen += 320 + track; continue; }
    const g = LAT[ch] || ZH[ch];
    if (!g) continue;
    parts.push([pen, g[1]]); pen += g[0] + track;
  }
  const w = (pen - track) * s, x0 = ox - (align === 'middle' ? w / 2 : align === 'end' ? w : 0);
  let d = '';
  for (const [p, gd] of parts) {
    let i = 0;
    d += gd.replace(/-?\d+(\.\d+)?/g, m => { const v = +m; const out = i % 2 === 0 ? x0 + (v + p) * s : oy + v * s; i++; return ' ' + f(out); });
  }
  return { d, w };
}

// ------------------------------------------------------------------------------------------------ build
let I, V;   // ink helpers (set in build)
function letterpress(str, size, x, y, fill = 'P', opts) {
  const t = text(str, size, x, y, opts);
  return h('path', { d: t.d, fill: I('N'), transform: 'translate(2.4 2.4)' }) + h('path', { d: t.d, fill: I(fill), stroke: I('N'), 'stroke-width': 1.3, 'paint-order': 'stroke', 'stroke-linejoin': 'round' });
}
// a letterpress pop word on a vermilion burst with O/R rays
function pop(ref, word, sub, rx, ry, seed, burstInk = 'R') {
  let rays = '', rO = '', rR = '';
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * TAU + 0.1, p = (r, da) => [Math.cos(a + da) * rx * r, Math.sin(a + da) * ry * r];
    const d = poly([p(1.04, -0.06), p(i % 2 ? 1.3 : 1.46, 0), p(1.04, 0.06)]);
    if (i % 2) rO += d; else rR += d;
  }
  rays = h('g', { 'data-ref': `egg-${ref}Rays` }, h('path', { d: rR, fill: I('R') }), h('path', { d: rO, fill: I('O') }));
  return h('g', { 'data-ref': 'egg-' + ref, visibility: 'hidden' }, rays,
    h('path', { d: burstD(rx, ry, 11, seed), fill: I('N'), transform: 'translate(4 4)' }),
    h('path', { d: burstD(rx, ry, 11, seed), fill: I(burstInk) }),
    h('path', { d: burstD(rx * 0.84, ry * 0.8, 11, seed + 1), fill: 'none', stroke: I('P'), 'stroke-width': 1.5, 'stroke-linejoin': 'round' }),
    letterpress(word, sub ? 30 : 34, 0, sub ? 2 : 12),
    sub ? letterpress(sub, 22, 0, 28, 'K') : '');
}

// ---- art: the ginger cat (sitting, facing +x, origin = between the hind feet on the seat) ----
function catSit(pfx) {
  const O = I('O'), N = I('N'), P = I('P'), R = I('R'), K = I('K');
  const kl = { stroke: N, 'stroke-width': 2, 'stroke-linejoin': 'round' };
  return h('g', {},
    h('g', { 'data-ref': pfx + 'Tail' }, h('path', { d: 'M-18 -4C-40 -2 -48 -16 -44 -30C-42 -38 -34 -40 -32 -34C-36 -24 -30 -14 -16 -14Z', fill: O, ...kl }),
      h('path', { d: 'M-42 -22L-35 -24M-38 -32L-32 -30', stroke: R, 'stroke-width': 3, 'stroke-linecap': 'round' })),
    // body (loaf, chest to the right) + haunch
    h('path', { d: 'M-22 0C-30 -14 -26 -38 -8 -46C4 -52 16 -48 20 -38C24 -26 22 -10 18 0Z', fill: O, ...kl }),
    h('path', { d: 'M-18 -6C-20 -20 -12 -30 -2 -30C6 -28 8 -16 4 -4', fill: 'none', stroke: N, 'stroke-width': 1.6, 'stroke-linecap': 'round' }),
    // tabby stripes
    h('path', { d: 'M-16 -36L-8 -32M-22 -26L-13 -24M-24 -15L-15 -15M-3 -46L-1 -39M6 -48L7 -41', stroke: R, 'stroke-width': 3.2, 'stroke-linecap': 'round' }),
    // chest bib + front paws
    h('path', { d: 'M12 -40C22 -34 22 -12 18 0H6C8 -14 6 -28 12 -40Z', fill: P, stroke: N, 'stroke-width': 1.4 }),
    h('path', { d: 'M4 0C4 -4 8 -5 12 -4C13 -2 13 0 12 0ZM13 0C13 -4 17 -5 21 -4C22 -2 22 0 21 0Z', fill: P, stroke: N, 'stroke-width': 1.3 }),
    // head
    h('g', { 'data-ref': pfx + 'Head', transform: 'translate(14 -50)' },
      h('path', { d: 'M-15 -6L-13 -24L-4 -14ZM6 -15L15 -24L16 -6Z', fill: O, ...kl }),
      h('path', { d: 'M-11 -12L-11 -20L-6 -14ZM9 -14L13 -20L13 -12Z', fill: K }),
      h('path', { d: 'M-17 -2C-18 -14 -8 -18 0 -18C8 -18 18 -14 17 -2C16 8 8 12 0 12C-8 12 -16 8 -17 -2Z', fill: O, ...kl }),
      h('path', { d: 'M-5 -17L-3 -10M1 -18L1 -11M6 -17L4 -10', stroke: R, 'stroke-width': 2.4, 'stroke-linecap': 'round' }),
      h('path', { d: 'M-6 4C-6 0 -2 -1 0 1C2 -1 6 0 6 4C6 9 -6 9 -6 4Z', fill: P }),
      h('path', { d: 'M-2 2L2 2L0 4.4Z', fill: R }),
      h('g', { 'data-ref': pfx + 'Eyes' }, h('path', { d: 'M-9 -5.5A3 3.4 0 1 0 -8.99 -5.5ZM7 -5.5A3 3.4 0 1 0 7.01 -5.5Z', fill: N }), h('path', { d: circ(-8, -6.2, 1) + circ(8, -6.2, 1), fill: P })),
      h('path', { d: 'M-8 5H-22M-8 7L-21 10M8 5H22M8 7L21 10', stroke: N, 'stroke-width': 0.9, 'stroke-linecap': 'round' })));
}
// leaping cat (stretched, facing +x, origin = body centre)
// paper halo under a figure so it reads against any sky band (a screen-print "knock-out")
const halo = (mk, w = 7) => h('g', { 'aria-hidden': 'true' }, mk.replace(/(fill|stroke)="var\(--pb-ink[A-Z]\)"/g, '$1="' + I('P') + '"').replace(/stroke-width="[\d.]+"/g, `stroke-width="${w}"`).replace(/fill="none"/g, `fill="${I('P')}"`));
function catLeap() {
  const mk = catLeapInner();
  return halo(mk) + mk;
}
function catLeapInner() {
  const O = I('O'), N = I('N'), P = I('P'), R = I('R'), K = I('K');
  const kl = { stroke: N, 'stroke-width': 2, 'stroke-linejoin': 'round' };
  return h('g', {},
    h('path', { d: 'M-30 -2C-48 -4 -60 -14 -66 -26C-62 -28 -56 -22 -50 -16C-44 -10 -36 -8 -28 -8Z', fill: O, ...kl }),
    h('path', { d: 'M-26 2L-44 14L-40 18L-20 8ZM-18 4L-30 20L-24 22L-10 8Z', fill: O, ...kl }),
    h('path', { d: 'M-32 -6C-30 -18 -10 -22 8 -20C22 -18 30 -12 32 -4C30 6 16 10 0 10C-16 10 -30 6 -32 -6Z', fill: O, ...kl }),
    h('path', { d: 'M-20 -18L-18 -8M-10 -20L-9 -10M0 -21L0 -12M10 -20L9 -12', stroke: R, 'stroke-width': 3, 'stroke-linecap': 'round' }),
    h('path', { d: 'M10 6L34 16L36 11L22 0ZM20 4L42 6L42 1L26 -4Z', fill: O, ...kl }),
    h('path', { d: 'M8 8C18 10 26 6 28 0L18 -2C12 2 8 4 8 8Z', fill: P, stroke: N, 'stroke-width': 1.2 }),
    h('g', { transform: 'translate(40 -12) rotate(8)' },
      h('path', { d: 'M-12 -6L-12 -22L-3 -13ZM4 -14L13 -21L14 -5Z', fill: O, ...kl }),
      h('path', { d: 'M-9 -11L-9 -18L-5 -13Z', fill: K }),
      h('path', { d: 'M-14 -2C-15 -12 -7 -16 0 -16C8 -16 16 -12 15 -2C14 7 7 10 0 10C-7 10 -13 7 -14 -2Z', fill: O, ...kl }),
      h('path', { d: 'M-6 -9L-4 -3M4 -9L3 -3', stroke: N, 'stroke-width': 2.4, 'stroke-linecap': 'round' }),
      h('path', { d: 'M2 3C6 6 12 4 14 1', fill: 'none', stroke: N, 'stroke-width': 1.4, 'stroke-linecap': 'round' }),
      h('path', { d: 'M6 2H22M6 4L20 8', stroke: N, 'stroke-width': 0.9 })));
}
// a fish (facing +x, origin = centre), B back / P belly / N key line, R gill
function fish(len = 34, pfx) {
  const B = I('B'), N = I('N'), P = I('P'), R = I('R');
  const L = len / 2;
  return h('g', pfx ? { 'data-ref': pfx } : {},
    h('path', { d: `M${f(-L)} 0L${f(-L - 10)} -8L${f(-L - 8)} 0L${f(-L - 10)} 8Z`, fill: B, stroke: N, 'stroke-width': 1.4, 'stroke-linejoin': 'round' }),
    h('path', { d: `M${f(-L)} 0C${f(-L * 0.4)} -12 ${f(L * 0.5)} -11 ${f(L)} 0C${f(L * 0.5)} 10 ${f(-L * 0.4)} 10 ${f(-L)} 0Z`, fill: B, stroke: N, 'stroke-width': 1.5 }),
    h('path', { d: `M${f(-L * 0.8)} 2C${f(-L * 0.2)} 7 ${f(L * 0.4)} 7 ${f(L * 0.85)} 1`, fill: P }),
    h('path', { d: `M${f(L * 0.45)} -6C${f(L * 0.3)} -2 ${f(L * 0.3)} 2 ${f(L * 0.45)} 5`, fill: 'none', stroke: R, 'stroke-width': 1.6 }),
    h('path', { d: circ(L * 0.66, -2, 1.6), fill: N }));
}
// a gull in glide (facing +x, origin = body), wing is a separate flapping group
function gull(pfx) {
  const P = I('P'), N = I('N'), B = I('B'), O = I('O'), R = I('R');
  return h('g', {},
    h('g', { 'data-ref': pfx + 'WingF' }, h('path', { d: 'M-6 -4L-24 -30L-40 -36L-20 -8Z', fill: B, stroke: N, 'stroke-width': 1.2 })),
    h('path', { d: 'M-26 2L-38 -4L-36 6Z', fill: P, stroke: N, 'stroke-width': 1.2 }),
    h('path', { d: 'M-28 2C-18 -6 4 -8 14 -4C20 -2 22 4 16 7C4 10 -16 9 -28 2Z', fill: P, stroke: N, 'stroke-width': 1.5 }),
    h('path', { d: 'M12 -8C18 -12 26 -10 26 -4C26 0 20 2 14 1Z', fill: P, stroke: N, 'stroke-width': 1.4 }),
    h('g', { 'data-ref': pfx + 'Beak' }, h('path', { d: 'M25 -5L35 -3L25 -1Z', fill: O, stroke: N, 'stroke-width': 1 }), h('path', { d: 'M31 -3.5L33 -3.2L31.5 -2Z', fill: R })),
    h('g', { 'data-ref': pfx + 'Jaw', visibility: 'hidden' }, h('path', { d: 'M25 -1L33 5L24 1Z', fill: O, stroke: N, 'stroke-width': 1 })),
    h('path', { d: circ(20, -6, 1.6), fill: N }),
    h('g', { 'data-ref': pfx + 'Wing' },
      h('path', { d: 'M-8 -2C-14 -16 -22 -30 -38 -44C-26 -44 -8 -30 6 -6Z', fill: B, stroke: N, 'stroke-width': 1.5, 'stroke-linejoin': 'round' }),
      h('path', { d: 'M-26 -34L-38 -44C-32 -44 -26 -41 -20 -36Z', fill: N }),
      h('path', { d: circ(-33, -41, 1.5), fill: P })));
}
// great white pelican in flight (facing +x, neck folded; origin = body)
function pelFly(pfx) {
  const P = I('P'), N = I('N'), B = I('B'), O = I('O'), K = I('K');
  return h('g', {},
    h('g', { 'data-ref': pfx + 'WingF' }, h('path', { d: 'M-2 -4C-12 -24 -26 -40 -50 -48C-40 -30 -24 -12 -12 -2Z', fill: N })),
    h('path', { d: 'M-34 0C-24 -10 4 -12 18 -8C28 -5 30 4 22 8C6 12 -20 10 -34 0Z', fill: P, stroke: N, 'stroke-width': 1.6 }),
    h('path', { d: 'M-34 0L-44 -4L-42 4Z', fill: P, stroke: N, 'stroke-width': 1.2 }),
    h('path', { d: 'M22 -2C26 -12 34 -16 40 -12C44 -8 40 -2 34 0Z', fill: P, stroke: N, 'stroke-width': 1.4 }),
    h('path', { d: 'M38 -12L74 -2L40 -4Z', fill: K, stroke: N, 'stroke-width': 1.1, 'stroke-linejoin': 'round' }),
    h('path', { d: 'M40 -5L70 -1C60 6 46 6 38 0Z', fill: O, stroke: N, 'stroke-width': 1.1 }),
    h('path', { d: circ(36, -10, 1.5), fill: N }),
    h('path', { d: 'M-12 8L-22 14L-16 15L-8 10Z', fill: O }),
    h('g', { 'data-ref': pfx + 'Wing' },
      h('path', { d: 'M-4 -6C-10 -26 -22 -44 -46 -58C-24 -58 0 -34 12 -8Z', fill: P, stroke: N, 'stroke-width': 1.5, 'stroke-linejoin': 'round' }),
      h('path', { d: 'M-24 -40C-30 -48 -38 -54 -46 -58C-34 -58 -24 -52 -16 -44ZM-10 -18C-16 -30 -22 -36 -30 -44', fill: N, stroke: N, 'stroke-width': 1.2 })));
}

export function build(ctx) {
  const v = ctx.v; V = v;
  I = r => v('ink' + r);
  const P = I('P'), N = I('N'), B = I('B'), O = I('O'), R = I('R'), K = I('K'), T = I('T');
  const L = { sun: '', stars: '', clouds: '', sea: '', roadside: '', road: '', front: '' };
  let defs = '';

  // ---- brown pelican ink override (Konami). Pure CSS: custom properties re-pointed on the rider's slots.
  const slotSel = (names) => names.map(n => `#scene.egg-brown #j-${n}`).join(',');
  const inkv = r => `var(--pb-ink${r})`;
  defs += `<style>${slotSel(['body', 'tail', 'wingNearUpper', 'wingNearLower', 'wingNearHand', 'wingFarUpper', 'wingFarLower', 'wingFarHand', 'thighNear', 'thighFar'])}{--pb-plume:${inkv('B')};--pb-plume-far:${inkv('N')};--pb-plumeShade:${inkv('N')};--pb-plumeShade-far:${inkv('N')};--pb-flight:${inkv('N')}}`
    + `${slotSel(['neck'])}{--pb-plume:${inkv('R')};--pb-plume-far:${inkv('N')};--pb-plumeShade:${inkv('N')}}`
    + `${slotSel(['crest'])}{--pb-plume:${inkv('O')};--pb-plumeShade:${inkv('R')}}`
    + `${slotSel(['head'])}{--pb-plume:${inkv('P')};--pb-skin:${inkv('P')};--pb-plumeShade:${inkv('O')}}`
    + `${slotSel(['pouch', 'billLower'])}{--pb-pouch:${inkv('N')};--pb-pouchDeep:${inkv('R')}}`
    + `${slotSel(['billUpper', 'billLower'])}{--pb-bill:${inkv('B')};--pb-billEdge:${inkv('R')}}`
    + `${slotSel(['eye'])}{--pb-iris:${inkv('P')}}`
    + `${slotSel(['footNear', 'footFar', 'shankNear', 'shankFar'])}{--pb-foot:${inkv('N')};--pb-web:${inkv('N')};--pb-foot-far:${inkv('N')};--pb-web-far:${inkv('N')}}`
    + `</style>`;
  defs += h('symbol', { id: 'egg-catsit', overflow: 'visible' }, catSit('egg-cs'));

  // ---- caption card (screen-ish, upper left): brown / velo
  const card = (ref, l1, l2, l3) => {
    const w = 440, hh = 92;
    return h('g', { 'data-ref': 'egg-' + ref, visibility: 'hidden' },
      h('path', { d: `M${-w / 2 + 4} ${-hh / 2 + 4}h${w}v${hh}h${-w}Z`, fill: N }),
      h('path', { d: `M${-w / 2} ${-hh / 2}h${w}v${hh}h${-w}Z`, fill: P, stroke: N, 'stroke-width': 2 }),
      h('path', { d: `M${-w / 2 + 6} ${-hh / 2 + 6}h${w - 12}v${hh - 12}h${-(w - 12)}Z`, fill: 'none', stroke: R, 'stroke-width': 1.2 }),
      h('path', { d: `M${-w / 2 + 6} ${-hh / 2 + 6}h${w - 12}v26h${-(w - 12)}Z`, fill: N }),
      h('path', { d: text(l1, 17, 0, -hh / 2 + 26, { track: 60 }).d, fill: P }),
      h('path', { d: text(l2, 22, 0, 12).d, fill: R }),
      h('path', { d: text(l3, 12.5, 0, 34, { track: 50 }).d, fill: N }),
      h('path', { d: star4(7, 2) , fill: O, transform: `translate(${-w / 2 + 22} 11)` }), h('path', { d: star4(7, 2), fill: O, transform: `translate(${w / 2 - 22} 11)` }));
  };
  L.front += card('capBrown', 'SIMON WILLISON · BENCHMARK', '褐鹈鹕 · 繁殖羽', 'CALIFORNIA BROWN PELICAN · BREEDING PLUMAGE');
  L.front += card('capVelo', 'VELOCIPEDIA', '链条接错啦！', 'AFTER GIANLUCA GIMINI · BIKES DRAWN FROM MEMORY');

  // ---- sun + moon faces (L-sunmoon, depth 0; placed on the discs every frame while shown)
  const face = (ref, s, ink, cheek) => h('g', { 'data-ref': 'egg-' + ref, visibility: 'hidden' }, h('g', { transform: `scale(${s})` },
    h('path', { d: circ(-44, 14, 12) + circ(44, 14, 12), fill: cheek }),
    h('path', { d: 'M-26 -14m-7 0a7 10 0 1 0 14 0a7 10 0 1 0 -14 0Z', fill: ink }),
    h('path', { d: circ(-24, -18, 2.6), fill: P }),
    h('g', { 'data-ref': `egg-${ref}Open` }, h('path', { d: 'M26 -14m-7 0a7 10 0 1 0 14 0a7 10 0 1 0 -14 0Z', fill: ink }), h('path', { d: circ(28, -18, 2.6), fill: P })),
    h('path', { 'data-ref': `egg-${ref}Shut`, visibility: 'hidden', d: 'M14 -12Q26 -24 40 -12', fill: 'none', stroke: ink, 'stroke-width': 5, 'stroke-linecap': 'round' }),
    h('path', { d: 'M-38 -34Q-26 -40 -14 -34M14 -36Q26 -42 38 -34', fill: 'none', stroke: ink, 'stroke-width': 3.4, 'stroke-linecap': 'round' }),
    h('path', { d: 'M-30 16Q0 46 30 16', fill: 'none', stroke: ink, 'stroke-width': 5, 'stroke-linecap': 'round' }),
    h('path', { d: 'M-30 16Q-34 12 -37 13M30 16Q34 12 37 13', fill: 'none', stroke: ink, 'stroke-width': 3, 'stroke-linecap': 'round' }),
    h('path', { 'data-ref': `egg-${ref}Spark`, d: star4(16, 3.4), fill: P, stroke: ink, 'stroke-width': 1.2, transform: 'translate(64 -40)' })));
  L.sun += face('sunFace', 1, N, R) + face('moonFace', 0.54, N, R);

  // ---- wish sparkle (L-stars, depth 0)
  let wishRays = '';
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, r0 = 12, r1 = i % 2 ? 36 : 58, w = 0.2; wishRays += poly([[Math.cos(a - w) * r0, Math.sin(a - w) * r0], [Math.cos(a) * r1, Math.sin(a) * r1], [Math.cos(a + w) * r0, Math.sin(a + w) * r0]]); }
  L.stars += h('g', { 'data-ref': 'egg-wish', visibility: 'hidden' },
    h('g', { 'data-ref': 'egg-wishRays' }, h('path', { d: wishRays, fill: K })),
    h('path', { d: circ(0, 0, 22), fill: 'none', stroke: P, 'stroke-width': 1.6, 'stroke-dasharray': '2 4' }),
    h('path', { d: star4(20, 5), fill: P, stroke: N, 'stroke-width': 1.2 }),
    h('g', { 'data-ref': 'egg-wishFall' }, [0, 1, 2, 3, 4].map(i => h('path', { d: star4(6 - i, 1.4), fill: i % 2 ? K : P, transform: `translate(${-i * 16} ${i * 20})` }))),
    letterpress('许愿！WISH!', 22, 0, 80, 'K'));

  // ---- pelican squadron (L-clouds)
  let sq = '';
  for (let i = 0; i < 7; i++) sq += h('g', { 'data-ref': 'egg-pf' + i }, pelFly('egg-pf' + i));
  L.clouds += h('g', { 'data-ref': 'egg-flight', visibility: 'hidden' }, sq);

  // ---- message in a bottle (L-sea, depth .1)
  L.sea += h('g', { 'data-ref': 'egg-bottle', visibility: 'hidden' },
    h('path', { 'data-ref': 'egg-bottleRip', d: 'M-40 8Q-30 4 -20 8M18 8Q28 4 38 8M-26 13Q0 9 24 13', fill: 'none', stroke: P, 'stroke-width': 1.6, 'stroke-linecap': 'round' }),
    h('g', { 'data-ref': 'egg-bottleB' },
      h('path', { d: 'M-24 -6C-24 -12 -18 -14 -8 -14H8C12 -14 14 -10 20 -9H28V-3H20C14 -2 12 2 8 2H-8C-18 2 -24 0 -24 -6Z', fill: T, stroke: N, 'stroke-width': 1.6, 'stroke-linejoin': 'round' }),
      h('path', { d: 'M-16 -8H6C8 -8 8 -4 6 -4H-16C-18 -4 -18 -8 -16 -8Z', fill: P }),
      h('path', { d: 'M-6 -9V-3', stroke: R, 'stroke-width': 1.6 }),
      h('path', { d: 'M-20 -11H0', stroke: P, 'stroke-width': 1.4, 'stroke-linecap': 'round' }),
      h('path', { d: 'M28 -4.5H34V-7.5H28Z', fill: O, stroke: N, 'stroke-width': 1.2 }),
      // visible clue: a four-point glint winks on the glass every ~22 s
      h('path', { 'data-ref': 'egg-bottleGlint', visibility: 'hidden', d: 'M-12 -30L-9.6 -13.4L6 -11L-9.6 -8.6L-12 8L-14.4 -8.6L-30 -11L-14.4 -13.4Z', fill: P, stroke: N, 'stroke-width': 0.8, 'stroke-linejoin': 'round' })));
  const nw = 380, nh = 164;
  L.sea += h('g', { 'data-ref': 'egg-note', visibility: 'hidden' },
    h('g', { 'data-ref': 'egg-noteIn' },
      h('path', { d: `M${-nw / 2 + 5} ${-nh / 2 + 5}h${nw}v${nh - 16}l-16 16h${-(nw - 16)}Z`, fill: N }),
      h('path', { d: `M${-nw / 2} ${-nh / 2}h${nw}v${nh - 16}l-16 16h${-(nw - 16)}Z`, fill: P, stroke: N, 'stroke-width': 2 }),
      h('path', { d: `M${nw / 2} ${nh / 2 - 16}h-16v16Z`, fill: K, stroke: N, 'stroke-width': 1.6, 'stroke-linejoin': 'round' }),
      h('path', { d: `M${-nw / 2 + 8} ${-nh / 2 + 8}h${nw - 16}v${nh - 16}h${-(nw - 16)}Z`, fill: 'none', stroke: R, 'stroke-width': 1, 'stroke-dasharray': '6 3' }),
      h('path', { d: dots(-nw / 2 + 16, nw / 2 - 16, -nh / 2 + 14, -nh / 2 + 22, 6), stroke: K, 'stroke-width': 2.2, 'stroke-linecap': 'round' }),
      h('path', { d: text('你好，海边的朋友！', 24, 0, -34).d, fill: N }),
      h('path', { d: text('来鹈鹕湾，一起骑车吧！', 24, 0, -2).d, fill: R }),
      h('path', { d: text('HELLO, FRIEND BY THE SEA!', 15, 0, 26, { track: 40 }).d, fill: N }),
      h('path', { d: text('COME RIDE WITH US AT PELICAN BAY.', 13, 0, 46, { track: 40 }).d, fill: B }),
      h('path', { d: text('— P.', 15, nw / 2 - 30, 66, { align: 'end' }).d, fill: R }),
      h('path', { d: 'M-160 60C-150 50 -140 70 -130 60S-110 50 -100 60', fill: 'none', stroke: T, 'stroke-width': 1.6, 'stroke-linecap': 'round' })));

  // ---- bench + cat (L-roadside, depth .9)
  const bench = h('g', {},
    h('path', { d: 'M-58 0L-54 -22H-50L-48 0ZM48 0L50 -22H54L58 0Z', fill: N }),
    h('path', { d: 'M-64 -24H64V-18H-64ZM-62 -30H62V-26H-62Z', fill: T, stroke: N, 'stroke-width': 1.4 }),
    h('path', { d: 'M-60 -34V-58M60 -34V-58', stroke: N, 'stroke-width': 3 }),
    h('path', { d: 'M-62 -44H62V-38H-62ZM-62 -56H62V-50H-62Z', fill: T, stroke: N, 'stroke-width': 1.4 }),
    h('path', { d: 'M-54 -18C-60 -12 -64 -6 -58 -2M54 -18C60 -12 64 -6 58 -2', fill: 'none', stroke: N, 'stroke-width': 2 }),
    h('path', { d: 'M-40 -22V-29M-20 -22V-29M0 -22V-29M20 -22V-29M40 -22V-29', stroke: N, 'stroke-width': 0.8 }));
  L.roadside += h('g', { 'data-ref': 'egg-bench', visibility: 'hidden' }, bench,
    h('g', { 'data-ref': 'egg-benchCat', transform: 'translate(-18 -30)' }, h('use', { href: '#egg-catsit' })),
    h('path', { d: 'M28 -34L34 -30M40 -32L44 -26', stroke: N, 'stroke-width': 1.2, 'stroke-linecap': 'round' }));
  L.front += h('g', { 'data-ref': 'egg-catJump', visibility: 'hidden' },
    h('g', { 'data-ref': 'egg-catLeap' }, catLeap()),
    h('g', { 'data-ref': 'egg-catPerch', visibility: 'hidden' }, h('use', { href: '#egg-catsit', transform: 'translate(0 30)' })),
    h('g', { 'data-ref': 'egg-catFish', visibility: 'hidden' }, fish(30)));
  L.front += pop('popMeow', 'MEOW!', '喵！', 66, 42, 7, 'O');

  // ---- puddles (L-road, depth 1)
  L.road += h('g', { 'data-ref': 'egg-puddle', visibility: 'hidden' },
    h('path', { d: 'M-150 2C-140 -12 -60 -16 0 -14C70 -16 150 -10 156 2C150 16 60 18 0 16C-70 18 -150 14 -150 2Z', fill: B, stroke: N, 'stroke-width': 1.6 }),
    h('path', { d: 'M-110 -2H-40M-20 -6H60M80 0H130M-70 7H10', stroke: P, 'stroke-width': 2, 'stroke-linecap': 'round' }),
    h('path', { d: 'M40 5H110M-130 -8H-100', stroke: K, 'stroke-width': 1.6, 'stroke-linecap': 'round' }));
  // splash crowns + drops (L-fx-front)
  const crown = h('path', { d: 'M-40 0C-36 -16 -30 -26 -34 -40C-24 -28 -20 -22 -16 -34C-12 -22 -6 -18 0 -46C6 -18 12 -22 16 -34C20 -22 24 -28 34 -40C30 -26 36 -16 40 0Z', fill: P, stroke: N, 'stroke-width': 1.6, 'stroke-linejoin': 'round' })
    + h('path', { d: 'M-24 -6C-22 -14 -18 -20 -16 -26M8 -8C10 -18 12 -24 16 -30', stroke: B, 'stroke-width': 2, fill: 'none', 'stroke-linecap': 'round' });
  let drops = '';
  for (let i = 0; i < 10; i++) drops += h('path', { 'data-ref': 'egg-dr' + i, d: 'M0 -7C3 -3 4 0 4 2A4 4 0 0 1 -4 2C-4 0 -3 -3 0 -7Z', fill: i % 3 ? P : B, stroke: N, 'stroke-width': 1.2 });
  L.front += h('g', { 'data-ref': 'egg-splash', visibility: 'hidden' }, h('g', { 'data-ref': 'egg-crownR' }, crown), h('g', { 'data-ref': 'egg-crownF' }, crown), drops);
  L.front += pop('popSplash', 'SPLASH!', '哗啦！', 90, 46, 11, 'B');

  // ---- milestone posters + confetti (L-fx-front)
  const poster = (ref, big, l2, l3) => {
    const w = 270, hh = 160;
    let rays = '';
    for (let i = 0; i < 14; i++) { const a = Math.PI + (i / 13) * Math.PI; if (i % 2) continue; rays += poly([[0, 30], [Math.cos(a - 0.1) * 200, 30 + Math.sin(a - 0.1) * 200], [Math.cos(a + 0.1) * 200, 30 + Math.sin(a + 0.1) * 200]]); }
    const clip = 'egg-clip-' + ref;
    defs += h('clipPath', { id: clip }, h('path', { d: `M${-w / 2 + 8} ${-hh / 2 + 8}h${w - 16}v${hh - 16}h${-(w - 16)}Z` }));
    return h('g', { 'data-ref': 'egg-' + ref, visibility: 'hidden' }, h('g', { 'data-ref': `egg-${ref}In` },
      h('path', { d: `M${-w / 2 + 5} ${-hh / 2 + 5}h${w}v${hh}h${-w}Z`, fill: N }),
      h('path', { d: `M${-w / 2} ${-hh / 2}h${w}v${hh}h${-w}Z`, fill: P, stroke: N, 'stroke-width': 2 }),
      h('g', { 'clip-path': `url(#${clip})` },
        h('path', { d: `M${-w / 2} ${-hh / 2}h${w}v${hh}h${-w}Z`, fill: O }),
        h('path', { d: rays, fill: K }),
        h('path', { d: dots(-w / 2 + 10, w / 2 - 10, -hh / 2 + 10, 10, 7, (x, y) => (x * x + (y - 30) ** 2) > 60 ** 2), stroke: R, 'stroke-width': 2.2, 'stroke-linecap': 'round' }),
        h('path', { d: circ(0, 30, 34), fill: P }),
        h('path', { d: `M${-w / 2} 40h${w}v40h${-w}Z`, fill: B }),
        h('path', { d: `M${-w / 2} 48h${w}M${-w / 2} 56h${w}`, stroke: P, 'stroke-width': 1.4, 'stroke-dasharray': '10 6' }),
        h('path', { d: `M${-w / 2} 62h${w}v20h${-w}Z`, fill: N })),
      h('path', { d: `M${-w / 2 + 8} ${-hh / 2 + 8}h${w - 16}v${hh - 16}h${-(w - 16)}Z`, fill: 'none', stroke: N, 'stroke-width': 1.4 }),
      h('g', { 'data-ref': `egg-${ref}Big` }, letterpress(big, 52, 0, 6)),
      h('path', { d: text(l3, 10.5, 0, 75, { track: 60 }).d, fill: P }),
      h('path', { d: text(l2, 14, 0, -52, { track: 40 }).d, fill: N })));
  };
  L.front += poster('posterKm', '1 KM!', '一公里 · ONE KILOMETRE', 'PELICAN BAY CYCLING CLUB');
  L.front += poster('poster42', '42!', "别慌 · DON'T PANIC", 'THE ANSWER · 4.2 KM');
  let conf = '';
  const CI = [R, O, T, B, P, K];
  for (let i = 0; i < 28; i++) {
    const k = i % 3, c = CI[i % CI.length];
    const d = k === 0 ? 'M-7 -3.5H7V3.5H-7Z' : k === 1 ? circ(0, 0, 5) : 'M-9 0Q-4.5 -7 0 0T9 0';
    conf += h('path', { 'data-ref': 'egg-cf' + i, d, fill: k === 2 ? 'none' : c, stroke: k === 2 ? c : 'none', 'stroke-width': 3.4, 'stroke-linecap': 'round' });
  }
  L.front += h('g', { 'data-ref': 'egg-confetti', visibility: 'hidden' }, conf);

  // ---- velocipedia chain (rider-attached, L-fx-front)
  const ringC = BIKE.bb, hub = BIKE.frontHub, rr = 30, rh = 11;
  const dx = hub[0] - ringC[0], dy = hub[1] - ringC[1], dist = Math.hypot(dx, dy), a0 = Math.atan2(dy, dx), beta = Math.acos((rr - rh) / dist);
  const tp = (c, r, a) => [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r];
  const [p1, p2, p3, p4] = [tp(ringC, rr, a0 - beta), tp(hub, rh, a0 - beta), tp(hub, rh, a0 + beta), tp(ringC, rr, a0 + beta)];
  const chainD = `M${f(p1[0])} ${f(p1[1])}L${f(p2[0])} ${f(p2[1])}A${rh} ${rh} 0 0 1 ${f(p3[0])} ${f(p3[1])}L${f(p4[0])} ${f(p4[1])}A${rr} ${rr} 0 1 1 ${f(p1[0])} ${f(p1[1])}Z`;
  let cog = '';
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; cog += poly([tp(hub, 10, a - 0.16), tp(hub, 14, a - 0.1), tp(hub, 14, a + 0.1), tp(hub, 10, a + 0.16)]); }
  let links = '';
  for (let i = 0; i < 8; i++) links += h('path', { 'data-ref': 'egg-lk' + i, d: 'M-5 -2.5H5A2.5 2.5 0 0 1 5 2.5H-5A2.5 2.5 0 0 1 -5 -2.5Z', fill: B, stroke: N, 'stroke-width': 1.2 });
  L.front += h('g', { 'data-ref': 'egg-riderF' },
    h('g', { 'data-ref': 'egg-velo', visibility: 'hidden' },
      h('g', { 'data-ref': 'egg-veloChain' },
        h('path', { d: circ(hub[0], hub[1], 11) + cog, fill: O, stroke: N, 'stroke-width': 1.2 }),
        h('path', { d: circ(hub[0], hub[1], 4), fill: N }),
        h('path', { d: chainD, fill: 'none', stroke: N, 'stroke-width': 5.4, 'stroke-linejoin': 'round' }),
        h('path', { d: chainD, fill: 'none', stroke: O, 'stroke-width': 2.2, 'stroke-dasharray': '3.4 2.2' }),
        h('path', { d: 'M150 -120L160 -132M196 -120L186 -132M150 -80L160 -68M196 -80L186 -68', stroke: R, 'stroke-width': 3, 'stroke-linecap': 'round' })),
      h('g', { 'data-ref': 'egg-veloLinks' }, links),
      h('g', { 'data-ref': 'egg-veloQ', transform: 'translate(-30 -515)' }, letterpress('?!', 60, 0, 0, 'R'))),
    // UFO's fish + cat target live in rider space too
    h('g', { 'data-ref': 'egg-ufoFish', visibility: 'hidden' }, fish(32)));
  L.front += pop('popSnap', 'SNAP!', null, 70, 40, 21, 'R');

  // ---- UFO (L-fx-front, world)
  let beam = '';
  const bw = [[70, 150], [52, 110], [30, 70]], bInk = [B, K, P], bOp = [0.28, 0.32, 0.4];
  bw.forEach(([t0, b0], i) => { beam += h('path', { d: `M${-t0 / 2} 0L${t0 / 2} 0L${b0} 270L${-b0} 270Z`, fill: bInk[i], opacity: bOp[i] }); });
  L.front += h('g', { 'data-ref': 'egg-ufo', visibility: 'hidden' },
    h('g', { 'data-ref': 'egg-ufoBeam', transform: 'translate(0 12)' }, beam,
      h('path', { d: dots(-120, 120, 20, 260, 12, (x, y) => Math.abs(x) < 30 + y * 0.35), stroke: P, 'stroke-width': 2, 'stroke-linecap': 'round', opacity: 0.6 })),
    h('g', { 'data-ref': 'egg-ufoBody' },
      h('path', { d: 'M0 -40V-54', stroke: N, 'stroke-width': 2 }), h('path', { 'data-ref': 'egg-ufoTip', d: circ(0, -56, 4), fill: R, stroke: N, 'stroke-width': 1.2 }),
      h('path', { d: 'M-34 -12C-34 -34 -18 -42 0 -42C18 -42 34 -34 34 -12Z', fill: B, stroke: N, 'stroke-width': 2 }),
      h('path', { d: 'M-22 -18C-22 -30 -12 -36 -2 -36', fill: 'none', stroke: P, 'stroke-width': 3.2, 'stroke-linecap': 'round' }),
      h('path', { d: 'M-8 -24C-8 -30 -4 -31 0 -31C4 -31 8 -30 8 -24Z', fill: T, stroke: N, 'stroke-width': 1.2 }),
      h('path', { d: circ(-2, -28, 1.3) + circ(3, -28, 1.3), fill: P }),
      h('path', { d: 'M-80 0C-60 -18 60 -18 80 0C60 16 -60 16 -80 0Z', fill: P, stroke: N, 'stroke-width': 2 }),
      h('path', { d: 'M-78 0C-58 8 58 8 78 0', fill: 'none', stroke: R, 'stroke-width': 4 }),
      h('path', { d: 'M-60 6C-40 20 40 20 60 6C40 14 -40 14 -60 6Z', fill: B, stroke: N, 'stroke-width': 1.4 }),
      [0, 1, 2].map(k => h('path', { 'data-ref': 'egg-ufoL' + k, d: [-50, -25, 0, 25, 50].filter((_, j) => j % 3 === k || (k === 2 && j === 4)).map(x => circ(x, -6, 4)).join(''), fill: O, stroke: N, 'stroke-width': 1.2 }))),
    h('path', { 'data-ref': 'egg-ufoLines', d: 'M100 -10H170M110 4H200M96 18H150', stroke: P, 'stroke-width': 3, 'stroke-linecap': 'round', visibility: 'hidden' }));
  L.front += pop('popBleep', 'BLEEP?', '哔哔？', 74, 44, 31, 'T');

  // ---- gull chorus (L-fx-front)
  let ch = '';
  for (let i = 0; i < 5; i++) ch += h('g', { 'data-ref': 'egg-g' + i }, gull('egg-g' + i),
    h('g', { 'data-ref': `egg-g${i}Kaw`, visibility: 'hidden', transform: 'translate(46 -30)' },
      h('path', { d: burstD(34, 19, 8, 40 + i), fill: i % 2 ? O : R, stroke: N, 'stroke-width': 1.4 }),
      h('path', { d: text(i % 2 ? '嘎！' : 'KAW!', i % 2 ? 17 : 14, 0, 5).d, fill: P, stroke: N, 'stroke-width': 0.8, 'paint-order': 'stroke' })));
  L.front += h('g', { 'data-ref': 'egg-chorus', visibility: 'hidden' }, ch,
    h('path', { 'data-ref': 'egg-chNotes', d: 'M0 0A5.6 4 -20 1 1 -0.1 0.1ZM4.6 -2.4V-24C8 -21 12 -19 12.4 -13C11 -16 8.4 -17.4 6.8 -17.6V-2.4Z', fill: P, stroke: N, 'stroke-width': 2, 'paint-order': 'stroke' }));

  return {
    defs,
    layers: {
      'L-sunmoon': L.sun, 'L-stars': L.stars, 'L-clouds': L.clouds, 'L-sea': L.sea,
      'L-roadside': L.roadside, 'L-road': L.road, 'L-fx-front': L.front,
    },
  };
}

// ------------------------------------------------------------------------------------------------ schedules (pure)
const BENCH = { P: 34000, X0: 15600, d: 0.9 };       // roadside coords
const PUDDLE = { P: 21000, X0: 30000 };              // road coords
const BOTTLE = { P: 2700, X0: 2100, d: 0.1, y: 526 }; // sea coords
const nearest = (S, dd) => { const k = Math.max(0, Math.round((dd - S.X0 + 800) / S.P)); return [k, S.X0 + k * S.P - dd]; };
export const benchAt = distance => nearest(BENCH, distance * BENCH.d);
export const puddleAt = distance => nearest(PUDDLE, distance);
export const bottleAt = (distance, t) => { const [k, x] = nearest(BOTTLE, distance * BOTTLE.d); return [k, x + 8 * Math.sin(t * 0.4 + k)]; };
const KM_UNITS = 1000 / (0.34 / BIKE.R);            // odometer: wheel R = 100 units ≈ 0.34 m (as ui.js)

// ------------------------------------------------------------------------------------------------ attach
let inst = null;
export function attach(svg, ctx) {
  const r = refs(svg, 'egg-');
  const st = new WeakMap();    // last written attribute values per element (write only on change)
  const set = (el, k, val) => { let m = st.get(el); if (!m) st.set(el, m = {}); if (m[k] !== val) { m[k] = val; el.setAttribute(k, val); } };
  const vis = (el, on) => set(el, 'visibility', on ? 'inherit' : 'hidden');   // 'inherit': a shown child never overrides a hidden egg group
  const reduced = ctx.reduced;
  const E = {};                  // id -> { t0, ...params }
  const found = new Set();
  let catTaken = -1, lastFrame = null, onFound = () => {};
  try { for (const k of JSON.parse(localStorage.getItem('pb-eggs') || '[]')) if (DUR[k]) found.add(k); } catch (e) { /* storage blocked */ }
  const markFound = k => {
    if (found.has(k)) return;
    found.add(k);
    try { localStorage.setItem('pb-eggs', JSON.stringify([...found])); } catch (e) { /* ignore */ }
    onFound(k);
  };
  const start = (k, p = {}) => { E[k] = { t0: lastFrame ? lastFrame.t : 0, ...p }; markFound(k); };
  const tau = (k, t) => (E[k] ? t - E[k].t0 : -1);
  let brown = false;

  // live detectors -------------------------------------------------------------
  const api = {
    start, E, found, get brown() { return brown; },
    setBrown(on) { brown = on; svg.classList.toggle('egg-brown', on); if (on) start('brown'); },
    frame: () => lastFrame,
    onFound(fn) { onFound = fn; },
    catTake(k) { catTaken = k; },
  };
  inst = api;

  // depth-1 layers carry the camera: screen point -> layer coords (+ 1/zoom), so cards keep their screen size and place
  const scr = (fr, sx, sy) => { const c = fr.cam || { zoom: 1, fx: 800, fy: 450 }, z = c.zoom || 1; return [(sx - 800) / z + c.fx, (sy - 450) / z + c.fy, 1 / z]; };
  function riderXf(fr) {
    const [rcx, rcy] = BIKE.rearContact;
    return `translate(${RIDER_X} ${f2(GROUND_Y + fr.pose.riderY)}) rotate(${f2(fr.pose.bikePitch)} ${rcx} ${rcy})`;
  }

  return {
    update(fr) {
      lastFrame = fr;
      const t = fr.t, D = fr.distance;
      // forget eggs that have run out (keeps renderAt scrubs exact: E only holds t0s)
      // odometer milestones (live only)
      if (fr.dt > 0 && api.prevD !== undefined) {
        const a = Math.floor(api.prevD / KM_UNITS), b = Math.floor(D / KM_UNITS);
        if (b > a && b >= 1) start('km', { n: b });
        if (api.prevD < 4.2 * KM_UNITS && D >= 4.2 * KM_UNITS) start('fortytwo');
      }
      api.prevD = D;
      // splash: a pending hop lands in a puddle
      if (api.hopT0 !== undefined && t >= api.hopT0 + TIMING.hop.land && t < api.hopT0 + TIMING.hop.land + 0.3) {
        const [, px] = puddleAt(D);
        if (Math.abs(px - (RIDER_X + 24)) < 270) start('splash', { d0: D, x0: px });
        api.hopT0 = undefined;
      }
      set(r.riderF, 'transform', riderXf(fr));

      // ---- brown caption / velo caption (upper left)
      const capAnim = (el, k, x, y) => {
        const u = tau(k, t), on = u >= 0 && u < DUR[k];
        vis(el, on); if (!on) return;
        const s = reduced ? 1 : easeOutBack(clamp(u / 0.35, 0, 1)), o = 1 - sstep(DUR[k] - 0.4, DUR[k], u);
        const [wx, wy, iz] = scr(fr, x, y);
        set(el, 'transform', `translate(${f(wx)} ${f(wy)}) rotate(-2) scale(${f2(Math.max(0.01, s) * iz)})`); set(el, 'opacity', f2(o));
      };
      capAnim(r.capBrown, 'brown', 350, 180);
      capAnim(r.capVelo, 'velo', 350, 180);

      // ---- sun / moon wink
      const faceAnim = (el, k, pos, pfx) => {
        const u = tau(k, t), on = u >= 0 && u < DUR[k];
        vis(el, on); if (!on) return;
        const o = sstep(0, 0.25, u) * (1 - sstep(DUR[k] - 0.4, DUR[k], u));
        set(el, 'transform', `translate(${f(pos.x)} ${f(pos.y)})`); set(el, 'opacity', f2(o));
        const shut = (u > 0.6 && u < 1.05) || (u > 1.35 && u < 1.55);
        vis(r[pfx + 'Open'], !shut); vis(r[pfx + 'Shut'], shut);
        const sp = sstep(0.62, 0.8, u) * (1 - sstep(1.1, 1.4, u));
        vis(r[pfx + 'Spark'], sp > 0.02);
        if (sp > 0.02) set(r[pfx + 'Spark'], 'transform', `translate(64 -40) rotate(${f(u * 90)}) scale(${f2(sp)})`);
      };
      faceAnim(r.sunFace, 'sunwink', fr.sun, 'sunFace');
      faceAnim(r.moonFace, 'moonwink', fr.moon, 'moonFace');

      // ---- wish
      {
        const u = tau('wish', t), on = u >= 0 && u < DUR.wish;
        vis(r.wish, on);
        if (on) {
          const p = E.wish;
          const s = reduced ? 1 : easeOutBack(clamp(u / 0.3, 0, 1));
          set(r.wish, 'transform', `translate(${f(p.x)} ${f(p.y)}) scale(${f2(Math.max(0.01, s) * 1.35)})`);
          set(r.wish, 'opacity', f2(1 - sstep(DUR.wish - 0.5, DUR.wish, u)));
          set(r.wishRays, 'transform', `rotate(${f(u * 40)}) scale(${f2(0.8 + 0.2 * Math.sin(u * 9))})`);
          set(r.wishFall, 'transform', `translate(${f(-u * 30)} ${f(u * 60)})`);
        }
      }

      // ---- pelican squadron: a V from the left, overtaking the rider, flying +x across the upper sky
      {
        const u = tau('flight', t), on = u >= 0 && u < DUR.flight;
        vis(r.flight, on);
        if (on) {
          const lead = -250 + u * 250;   // lead bird x
          for (let i = 0; i < 7; i++) {
            const side = i === 0 ? 0 : (i % 2 ? 1 : -1), rank = Math.ceil(i / 2);
            const x = lead - rank * 84, y = 132 + side * rank * 22 + 6 * Math.sin(u * 1.3 + i);
            const ph = u * 5.2 - rank * 0.5;
            const flap = reduced ? 1 : Math.cos(ph);
            const s = 0.95 - rank * 0.04;
            set(r['pf' + i], 'transform', `translate(${f(x)} ${f(y)}) scale(${f2(s)})`);
            set(r[`pf${i}Wing`], 'transform', `scale(1 ${f2(0.2 + 0.8 * flap)})`);
            set(r[`pf${i}WingF`], 'transform', `scale(1 ${f2(0.25 + 0.75 * flap)})`);
          }
        }
      }

      // ---- message in a bottle
      {
        const [k, bx] = bottleAt(D, t);
        const show = bx > -200 && bx < 1800;
        vis(r.bottle, show);
        api.bottle = show ? { k, x: bx, y: BOTTLE.y } : null;
        if (show) {
          set(r.bottle, 'transform', `translate(${f(bx)} ${f(BOTTLE.y + 2.5 * Math.sin(t * 2.1))})`);
          set(r.bottleB, 'transform', `rotate(${f(-8 + 7 * Math.sin(t * 2.1 + 0.6))})`);
          set(r.bottleRip, 'transform', `scale(${f2(1 + 0.12 * Math.sin(t * 2.1))} 1)`);
          const gp = t % 22, gOn = !fr.reduced && gp < 0.9;
          vis(r.bottleGlint, gOn);
          if (gOn) set(r.bottleGlint, 'transform', `translate(-12 -11) scale(${f2(0.25 + Math.sin(Math.PI * gp / 0.9))}) translate(12 11)`);
        }
        const u = tau('bottle', t), on = u >= 0 && u < DUR.bottle;
        vis(r.note, on);
        if (on) {
          const p = E.bottle;
          set(r.note, 'transform', `translate(${f(p.nx)} ${f(p.ny)}) rotate(-1.5)`);
          const sy = reduced ? 1 : easeOutBack(clamp(u / 0.45, 0, 1));
          set(r.noteIn, 'transform', `scale(${f2(clamp(u / 0.2, 0.1, 1))} ${f2(Math.max(0.02, sy))})`);
          set(r.note, 'opacity', f2(1 - sstep(DUR.bottle - 0.5, DUR.bottle, u)));
        }
      }

      // ---- bench + cat
      {
        const [k, bx] = benchAt(D);
        const show = bx > -300 && bx < 1900;
        vis(r.bench, show);
        api.bench = show ? { k, x: bx } : null;
        const u = tau('cat', t), jumping = u >= 0 && u < DUR.cat;
        if (show) {
          set(r.bench, 'transform', `translate(${f(bx)} 750)`);
          const gone = catTaken === k && (!jumping || u > 0.05);
          vis(r.benchCat, !gone);
          // idle: head tilts toward the rider as it approaches, tail swishes
          const look = clamp((RIDER_X - bx) / 900, -1, 1);
          set(r.csHead, 'transform', `translate(14 -50) rotate(${f(look * 8 + 3 * Math.sin(t * 1.3))})`);
          set(r.csTail, 'transform', `rotate(${f(reduced ? 0 : 10 * Math.sin(t * 2.4))} -18 -8)`);
          vis(r.csEyes, wrap(t, 3.1) > 0.12);
        }
        vis(r.catJump, jumping);
        if (jumping) {
          const p = E.cat, basket = [RIDER_X + 172, GROUND_Y + fr.pose.riderY - 300];
          let x, y, pose = 'leap', flip = 1, rot = 0;
          const bench = [p.x0, 700];
          if (u < 0.5) { const s = sstep(0, 0.5, u); x = lerp(bench[0], basket[0], s); y = lerp(bench[1], basket[1], s) - 180 * Math.sin(Math.PI * s); flip = basket[0] >= bench[0] ? 1 : -1; rot = -20 + 40 * s; }
          else if (u < 0.85) { x = basket[0] - 6; y = basket[1] - 6; pose = 'perch'; }
          else if (u < 1.45) { const s = sstep(0.85, 1.45, u); x = lerp(basket[0], RIDER_X - 380, s); y = lerp(basket[1], GROUND_Y - 30, s) - 160 * Math.sin(Math.PI * s); flip = -1; rot = -10 + 40 * s; }
          else { const s = u - 1.45; x = RIDER_X - 380 - s * 900; y = GROUND_Y - 30 - Math.abs(Math.sin(s * 14)) * 10; flip = -1; rot = 0; }
          set(r.catJump, 'transform', `translate(${f(x)} ${f(y)}) scale(${flip} 1) rotate(${f(rot)})`);
          vis(r.catLeap, pose === 'leap'); vis(r.catPerch, pose === 'perch');
          vis(r.catFish, u > 0.7);
          set(r.catFish, 'transform', pose === 'perch' ? 'translate(30 -26) rotate(80)' : 'translate(50 -2) rotate(90) scale(0.9)');
        }
        popAnim(r.popMeow, r.popMeowRays, u - 0.5, 1.1, RIDER_X + 380, GROUND_Y - 470, 6);
      }

      // ---- puddle + splash
      {
        const [, px] = puddleAt(D);
        const show = px > -300 && px < 1900;
        vis(r.puddle, show);
        if (show) set(r.puddle, 'transform', `translate(${f(px)} ${GROUND_Y + 14})`);
        const u = tau('splash', t), on = u >= 0 && u < DUR.splash;
        vis(r.splash, on);
        if (on) {
          const p = E.splash, sx = -(D - p.d0);   // world scroll since landing
          set(r.splash, 'transform', `translate(${f(sx)} 0)`);
          const cs = Math.sin(Math.PI * clamp(u / 0.7, 0, 1));
          set(r.crownR, 'transform', `translate(${RIDER_X - 125} ${GROUND_Y + 6}) scale(${f2(0.4 + 1.2 * cs)} ${f2(Math.max(0.01, cs * 1.4))})`);
          set(r.crownF, 'transform', `translate(${RIDER_X + 173} ${GROUND_Y + 6}) scale(${f2(0.4 + 1.1 * cs)} ${f2(Math.max(0.01, cs * 1.2))})`);
          for (let i = 0; i < 10; i++) {
            const w = i < 5 ? RIDER_X - 125 : RIDER_X + 173, a = (-150 + 120 * hash(i, 3)) * D2R, sp = 340 + 260 * hash(i, 5);
            const x = w + Math.cos(a) * sp * u, y = GROUND_Y + Math.sin(a) * sp * u + 900 * u * u;
            vis(r['dr' + i], y < GROUND_Y + 10);
            set(r['dr' + i], 'transform', `translate(${f(x)} ${f(y)}) rotate(${f(Math.atan2(Math.sin(a) * sp + 1800 * u, Math.cos(a) * sp) / D2R + 90)})`);
          }
        }
        popAnim(r.popSplash, r.popSplashRays, u, 1.2, RIDER_X + 430, GROUND_Y - 150, -6);
      }

      // ---- milestones + confetti
      {
        const uk = tau('km', t), u42 = tau('fortytwo', t);
        const [PX, PY, PZ] = scr(fr, 330, 350);
        const posterAnim = (el, inner, u, dur) => {
          const on = u >= 0 && u < dur;
          vis(el, on); if (!on) return;
          const s = reduced ? 1 : easeOutBack(clamp(u / 0.4, 0, 1));
          set(el, 'transform', `translate(${f(PX)} ${f(PY)}) rotate(${f(-4 + (reduced ? 0 : 2 * Math.sin(u * 3)))}) scale(${f2(PZ)})`);
          set(inner, 'transform', `scale(${f2(Math.max(0.01, s))})`);
          set(el, 'opacity', f2(1 - sstep(dur - 0.4, dur, u)));
        };
        posterAnim(r.posterKm, r.posterKmIn, uk, DUR.km);
        posterAnim(r.poster42, r.poster42In, u42, DUR.fortytwo);
        if (E.km && uk >= 0 && uk < DUR.km && E.km.n !== api.kmShown) {
          api.kmShown = E.km.n;
          const big = r.posterKmBig;
          const tt = text(`${E.km.n} KM!`, 52, 0, 6);
          big.children[0].setAttribute('d', tt.d); big.children[1].setAttribute('d', tt.d);
        }
        const uc = Math.max(uk >= 0 && uk < DUR.km ? uk : -1, u42 >= 0 && u42 < DUR.fortytwo ? u42 : -1);
        const con = uc >= 0 && uc < 3.2 && !reduced;
        vis(r.confetti, con);
        if (con) for (let i = 0; i < 28; i++) {
          const a = (-90 + (hash(i, 1) - 0.5) * 220) * D2R, sp = 260 + 320 * hash(i, 2);
          const drag = 1 - Math.exp(-uc * 2.2);
          const x = PX + PZ * (Math.cos(a) * sp * drag / 2.2 + 14 * Math.sin(uc * (4 + 3 * hash(i, 4)) + i));
          const y = PY + PZ * (Math.sin(a) * sp * drag / 2.2 + 70 * uc * uc);
          set(r['cf' + i], 'transform', `translate(${f(x)} ${f(y)}) rotate(${f(uc * 360 * (hash(i, 6) - 0.5) * 3)}) scale(${f2(1 - 0.7 * Math.abs(Math.sin(uc * 6 + i)))} 1)`);
          set(r['cf' + i], 'opacity', f2(1 - sstep(2.4, 3.2, uc)));
        }
      }

      // ---- velocipedia
      {
        const u = tau('velo', t), on = u >= 0 && u < DUR.velo;
        vis(r.velo, on);
        if (on) {
          const snap = u > 2.3;
          vis(r.veloChain, !snap);
          const sh = snap || reduced ? 0 : 1.6 * Math.sin(u * 70) * sstep(0.3, 0.6, u);
          set(r.veloChain, 'transform', `translate(${f(sh)} ${f(-sh * 0.5)})`);
          vis(r.veloLinks, snap);
          if (snap) for (let i = 0; i < 8; i++) {
            const s = u - 2.3, a = (-160 + 140 * hash(i, 8)) * D2R, sp = 260 + 200 * hash(i, 9);
            set(r['lk' + i], 'transform', `translate(${f(90 + Math.cos(a) * sp * s)} ${f(-90 + Math.sin(a) * sp * s + 700 * s * s)}) rotate(${f(s * 720 * (hash(i, 10) - 0.5))})`);
          }
          const q = sstep(0.4, 0.6, u) * (1 - sstep(2.1, 2.3, u));
          vis(r.veloQ, q > 0.02);
          if (q > 0.02) set(r.veloQ, 'transform', `translate(-30 -515) rotate(${f(8 * Math.sin(u * 6))}) scale(${f2(q)})`);
        }
        popAnim(r.popSnap, r.popSnapRays, u - 2.3, 0.9, RIDER_X + 330, GROUND_Y - 260, -8);
      }

      // ---- UFO
      {
        const u = tau('ufo', t) - 2.0, on = u >= 0 && u < DUR.ufo - 2;   // arrives once the pelican's GULP! has cleared
        vis(r.ufo, on);
        const fishOn = on && u > 1.3 && u < 2.9;
        vis(r.ufoFish, fishOn);
        if (on) {
          const hover = [RIDER_X + 180, 230];
          let x, y, tilt = 0;
          if (u < 1.1) { const s = sstep(0, 1.1, u); x = lerp(1500, hover[0], s); y = lerp(-120, hover[1], s) + 30 * Math.sin(s * Math.PI); tilt = -12 * (1 - s); }
          else if (u < 3.6) { x = hover[0] + 6 * Math.sin(u * 3); y = hover[1] + 5 * Math.sin(u * 4.3); tilt = 3 * Math.sin(u * 2.6); }
          else { const s = (u - 3.6) / 1.2; x = hover[0] - 1800 * s * s; y = hover[1] - 400 * s * s; tilt = -18; }
          set(r.ufo, 'transform', `translate(${f(x)} ${f(y)}) rotate(${f(tilt)})`);
          const bOn = u > 1.1 && u < 3.0;
          vis(r.ufoBeam, bOn);
          if (bOn) set(r.ufoBeam, 'transform', `translate(0 12) scale(1 ${f2(sstep(1.1, 1.3, u) * (1 - sstep(2.85, 3.0, u)))})`);
          vis(r.ufoLines, u > 3.6);
          const blink = Math.floor(u * 6) % 3;
          for (let k = 0; k < 3; k++) set(r['ufoL' + k], 'opacity', k === blink ? '1' : '0.45');
          if (fishOn) {
            const s = sstep(1.3, 2.8, u);
            const by = -300 - s * (GROUND_Y + fr.pose.riderY - 300 - hover[1] - 10);
            set(r.ufoFish, 'transform', `translate(${f(184 + 6 * Math.sin(u * 7))} ${f(by)}) rotate(${f(-30 + 70 * Math.sin(u * 5))}) scale(${f2(1 - 0.5 * s)})`);
          }
        }
        popAnim(r.popBleep, r.popBleepRays, u - 3.0, 1.0, RIDER_X + 420, 330, 6);
      }

      // ---- gull chorus
      {
        const u = tau('chorus', t), on = u >= 0 && u < DUR.chorus;
        vis(r.chorus, on);
        if (on) {
          const POS = [[380, 330], [520, 262], [650, 214], [1030, 236], [1170, 300]];
          for (let i = 0; i < 5; i++) {
            const [hx, hy] = POS[i];
            const inU = sstep(0 + i * 0.08, 0.8 + i * 0.08, u), outU = sstep(2.8, 3.6, u);
            const x = lerp(1800 + i * 80, hx, inU) - outU * 1900, y = hy - 60 * (1 - inU) + 4 * Math.sin(u * 5 + i) - outU * 120;
            set(r['g' + i], 'transform', `translate(${f(x)} ${f(y)}) scale(${f2(1.45 - 0.05 * i)})`);
            const flapping = inU < 1 || outU > 0;
            const fl = reduced ? 1 : flapping ? Math.cos(u * 14 + i) : 0.25 + 0.1 * Math.sin(u * 3 + i);
            set(r[`g${i}Wing`], 'transform', `scale(1 ${f2(fl)})`);
            set(r[`g${i}WingF`], 'transform', `scale(1 ${f2(fl)})`);
            // choir: each gull sings on its beat
            const beat = u - 0.9 - i * 0.28, sing = beat > 0 && wrap(beat, 1.4) < 0.45 && u < 2.9;
            vis(r[`g${i}Jaw`], sing); vis(r[`g${i}Kaw`], sing);
          }
          const nu = wrap(u, 1.2);
          set(r.chNotes, 'transform', `translate(${f(820 + 40 * nu)} ${f(210 - 60 * nu)})`);
          set(r.chNotes, 'opacity', f2(u < 2.9 ? Math.sin(Math.PI * nu / 1.2) : 0));
        }
      }
    },
  };

  function popAnim(el, rays, u, dur, x, y, rot) {
    const on = u >= 0 && u < dur;
    vis(el, on);
    if (!on) return;
    const uin = clamp(u / 0.16, 0, 1), uout = sstep(dur - 0.24, dur, u);
    const s = reduced ? 1 : (uin < 1 ? easeOutBack(uin) : 1) * (1 - 0.35 * uout);
    const wob = reduced ? 0 : 3 * Math.exp(-u * 5) * Math.sin(u * 30);
    set(el, 'transform', `translate(${f(x)} ${f(y - 14 * uout)}) rotate(${f(rot + wob)}) scale(${f2(Math.max(0.01, s))})`);
    set(el, 'opacity', f2(1 - uout));
    const ur = clamp(u / 0.34, 0, 1);
    vis(rays, ur < 1);
    if (ur < 1) { set(rays, 'transform', `scale(${f2(0.75 + 0.5 * ur)})`); set(rays, 'opacity', f2(1 - ur * ur)); }
  }
}

// ------------------------------------------------------------------------------------------------ connect (runtime)
// Called once by main.js after attach: wires keys, clicks and bus events to the X-sheets; returns the test API.
export function connect({ bus, state, svg }) {
  const A = inst;
  if (!A) return null;
  const win = svg.ownerDocument.defaultView;
  const now = () => (A.frame() ? A.frame().t : state.t);
  const emitFound = id => {
    const e = EGGS.find(x => x.id === id);
    bus.emit('egg:found', { id, zh: e.zh, en: e.en, count: A.found.size, total: EGGS.length });
  };
  // the rider reacts to a discovery (live play only; screenshot mode stays deterministic)
  const REACT = { km: ['ui:bell', 250], fortytwo: ['ui:wave', 400], bottle: ['ui:wave', 900], wish: ['ui:bell', 300], sunwink: ['ui:wave', 300] };
  const live = !new URLSearchParams(win.location.search).has('freeze');
  A.onFound(id => { emitFound(id); const rc = live && REACT[id]; if (rc) win.setTimeout(() => bus.emit(rc[0], {}), rc[1]); });
  if (A.found.size) queueMicrotask(() => bus.emit('egg:found', { id: null, count: A.found.size, total: EGGS.length }));
  // clue tier: after a minute of riding, show the empty tally so players know there is something to find
  else if (!new URLSearchParams(win.location.search).has('freeze')) win.setTimeout(() => { if (!A.found.size) bus.emit('egg:found', { id: null, count: 0, total: EGGS.length }); }, 60000);

  // keys: Konami + typed words (never steals keys: the ride shortcuts still fire; side effects are undone on success)
  const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let seq = [], typed = '';
  let autoBeforeA = null;
  win.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    const tg = e.target; if (tg && (tg.isContentEditable || (tg.tagName === 'INPUT' && !/range|checkbox|radio|button/.test(tg.type)) || tg.tagName === 'TEXTAREA')) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === 'b') autoBeforeA = state.todAuto;   // 'a' (auto day) fires next: remember the value to restore
    seq.push(k); if (seq.length > KONAMI.length) seq.shift();
    if (seq.length === KONAMI.length && seq.every((x, i) => x === KONAMI[i])) {
      seq = [];
      queueMicrotask(() => { if (autoBeforeA !== null && state.todAuto !== autoBeforeA) bus.emit('ui:tod', { auto: autoBeforeA }); });
      A.setBrown(!A.brown);
    }
    if (k.length === 1) {
      typed = (typed + k).slice(-8);
      if (typed.endsWith('gimini')) {
        typed = '';
        // 'm' toggled the sound on the way: put it back
        queueMicrotask(() => bus.emit('ui:sound', { on: !state.toggles.sound }));
        velo();
      }
      if (typed.endsWith('bird')) { typed = ''; A.start('flight'); }
    }
  });
  function velo() {
    A.start('velo');
    if (state.coasting) return;
    bus.emit('ui:coast', { on: true });                  // the drivetrain jams: the cranks lock, the bike rolls on
    setTimeout(() => bus.emit('ui:coast', { on: false }), 2300);   // SNAP! the chain flies off and we pedal again
  }

  // bus: bell (cat, chorus), hop (puddle), gulp (UFO at night)
  const bells = [];
  bus.on('rig:event', ev => {
    const t = ev.t0;
    if (ev.type === 'bell') {
      bells.push(t); while (bells.length && t - bells[0] > 3.5) bells.shift();
      if (bells.length >= 7) { bells.length = 0; A.start('chorus'); }
      const b = A.bench;
      if (b && b.x > 60 && b.x < 1560 && b.k !== undefined && !(A.E.cat && t - A.E.cat.t0 < DUR.cat)) { A.catTake(b.k); A.start('cat', { x0: b.x }); }
    }
    if (ev.type === 'hop') A.hopT0 = t;
    if (ev.type === 'gulp') { const fr = A.frame(); if (fr && fr.night > 0.6 && !(A.E.ufo && t - A.E.ufo.t0 < DUR.ufo + 4)) A.start('ufo'); }
  });

  // clicks on the sky and the sea (hit-tested in each layer's own coordinates)
  const layerPt = (id, e) => { const el = svg.querySelector('#' + id); const m = el.getScreenCTM(); if (!m) return null; return new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()); };
  const shoots = [...svg.querySelectorAll('[data-ref^="sky-shoot"]')];
  let shootSeen = [];
  const watchShoots = () => {
    for (let i = 0; i < shoots.length; i++) {
      const o = +(shoots[i].getAttribute('opacity') || 0);
      if (o > 0.15) shootSeen[i] = { t: now(), box: shoots[i].getBoundingClientRect() };
    }
    win.requestAnimationFrame(watchShoots);
  };
  win.requestAnimationFrame(watchShoots);
  svg.addEventListener('click', e => {
    const fr = A.frame(); if (!fr) return;
    for (const s of shootSeen) {
      if (!s || now() - s.t > 0.7) continue;
      const b = s.box, m = 70;
      if (e.clientX > b.left - m && e.clientX < b.right + m && e.clientY > b.top - m && e.clientY < b.bottom + m) {
        const p = layerPt('L-stars', e); if (p) { A.start('wish', { x: p.x, y: p.y }); return; }
      }
    }
    const ps = layerPt('L-sunmoon', e);
    if (ps) {
      if (fr.sun.elev > -0.08 && Math.hypot(ps.x - fr.sun.x, ps.y - fr.sun.y) < 95) { A.start('sunwink'); return; }
      if (fr.night > 0.3 && Math.hypot(ps.x - fr.moon.x, ps.y - fr.moon.y) < 60) { A.start('moonwink'); return; }
    }
    const b = A.bottle;
    if (b) {
      const p = layerPt('L-sea', e);
      if (p && Math.hypot(p.x - b.x, p.y - b.y) < 46) { openNote(b); }
    }
  });
  function openNote(b) {
    let nx = clamp(b.x, 220, 1380);
    if (nx > 520 && nx < 1060) nx = nx < 790 ? 520 : 1060;
    A.start('bottle', { nx, ny: 370 });
  }

  // ---- test API
  const trig = {
    brown: () => A.setBrown(true),
    velo: () => velo(),
    cat: () => { const b = A.bench; A.catTake(b ? b.k : -2); A.start('cat', { x0: b ? b.x : 1150 }); },
    km: () => A.start('km', { n: 1 }),
    fortytwo: () => A.start('fortytwo'),
    sunwink: () => A.start('sunwink'),
    moonwink: () => A.start('moonwink'),
    ufo: () => A.start('ufo'),
    chorus: () => A.start('chorus'),
    splash: () => { const fr = A.frame(); A.start('splash', { d0: fr ? fr.distance : 0, x0: RIDER_X }); },
    bottle: () => openNote(A.bottle || { x: 300, y: BOTTLE.y }),
    wish: () => A.start('wish', { x: 1180, y: 150 }),
    flight: () => A.start('flight'),
  };
  return {
    list: EGGS.map(e => ({ ...e })),
    trigger(id) { if (!trig[id]) throw new Error('unknown egg ' + id); trig[id](); return [...A.found]; },
    found: () => [...A.found],
    stopAll() { for (const k in A.E) delete A.E[k]; if (A.brown) A.setBrown(false); },   // end running eggs (keeps found)
    reset() { A.found.clear(); try { localStorage.removeItem('pb-eggs'); } catch (e) { /* ignore */ } for (const k in A.E) delete A.E[k]; if (A.brown) A.setBrown(false); },
    setBrown: on => A.setBrown(on),
  };
}
