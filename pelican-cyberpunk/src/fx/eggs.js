// OWNER: eggs. Easter eggs (彩蛋) for Neon Pelican, drawn in the neon HUD language of STYLE-X (acid = the egg accent).
// Spoilers: docs/EGGS.md. Test API: window.__pb.eggs = { list, trigger(id), found() }; tools/check-eggs.mjs shoots each one.
//
// Every egg is an X-sheet: a start time t0 (sim time) + a pure function of (frame.t - t0, frame.distance, pose). Live
// detection (keys, clicks, bus events, odometer crossings) only ever sets t0, so window.__pb.renderAt(t) stays exact
// and nothing is created or destroyed at run time: all art is built once and shown / hidden / moved by transform.
// Performance (STYLE-X §2): no filters anywhere in this module — every glow is stacked strokes or a static gradient.
//
//   mech       ↑↑↓↓←→←→BA  the pelican suits up in an original cyber mech armour that grows out of it plate by plate
//                          while it rides (fx/mech.js); the code again (or Esc) rewinds the suit off
//   velo       type GIMINI  a Gimini "Velocipedia" chain bolted to the front hub: the drivetrain jams, the chain SNAPs
//   cat        ring the bell while the ginger street cat's bench is on screen: it leaps up and steals a glowing fish
//   km         every whole kilometre on the odometer: a hologram billboard pops up in a shower of data bits
//   fortytwo   at 4.2 km: "42! DON'T PANIC"
//   sunwink    click the smog sun: it puts on pixel shades and winks
//   moonwink   click the moon: it winks too
//   ufo        feed the pelican at night: a saucer beams a second fish out of the delivery box
//   chorus     ring the bell 7 times in 3.5 s: five gulls answer in chorus
//   splash     land a hop in a neon puddle: SPLASH!
//   bottle     click the glowing bottle bobbing in the harbour: a hologram message unfolds
//   wish       click a shooting star while it is still glowing (night): make a wish
//   flight     type BIRD: a V of great white pelicans flies over the bay
//   hack       type HACK: the whole city glitches into its wireframe for 3 s; only the pelican stays solid (it's real)
//   welcome    ring the bell next to the 禁止鹈鹕 NO PELICANS sign: it flickers to 欢迎鹈鹕 PELICANS WELCOME
//   gold       type 888 (发发发): a golden chrome suit (恭喜发财); 888 again takes it off. Combines with brown + mech.
//   brown      type BROWN: the rider becomes Simon Willison's stricter benchmark, a California brown pelican in
//              breeding plumage (colour override on the rider's slots; BROWN again turns it back)
import { fmt1, fmt2 } from '../core/math.js';
import { GROUND_Y, RIDER_X, BIKE } from '../contract.js';
import { h, refs } from '../core/svg.js';
import { TIMING } from '../rig/solve.js';
import { LAT, MONO, ZH } from './egg-glyphs.js';
import { buildMech, attachMech, mechProgress, MECH_CSS, MK } from './mech.js';

export const id = 'eggs';
export const materials = {};

// ------------------------------------------------------------------------------------------------ list (bilingual)
export const EGGS = [
  ['mech', '机甲', 'Mech suit', '↑↑↓↓←→←→BA'],
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
  ['hack', '系统骇入', 'Wireframe city', 'type HACK'],
  ['welcome', '欢迎鹈鹕', 'Pelicans welcome', 'ring at the NO PELICANS sign'],
  ['gold', '发发发', 'Gold chrome', 'type 888'],
  ['brown', '褐鹈鹕', 'Brown pelican', 'type BROWN'],
].map(([k, zh, en, how]) => ({ id: k, zh, en, how }));
const DUR = { mech: 6.6, brown: 6, velo: 3.4, cat: 2.6, km: 3.4, fortytwo: 4, sunwink: 2.4, moonwink: 2.4, ufo: 6.8, chorus: 3.6, splash: 1.5, bottle: 7, wish: 2.4, flight: 9, hack: 3.6, welcome: 2.6, gold: 6 };

// the two eggs whose props are part of the street at all times (the clue tier): counted as street detail
export const detailItems = [
  { id: 'land:O:egg-cat-bench', layer: 'land', kind: 'O', what: 'LED street bench with a 猫咖 CAT CAFE holo ad and a ginger street cat (cyan LED eyes, collar tag, ear implant) who watches the rider' },
  { id: 'land:O:egg-no-pelicans', layer: 'land', kind: 'O', what: 'neon 禁止鹈鹕 NO PELICANS lamp-post sign with a 按铃 RING doorbell box (it flips to 欢迎鹈鹕 when you ring)' },
];

// ------------------------------------------------------------------------------------------------ helpers
const f = fmt1;   // = String(Math.round(x * 10) / 10), fast (core/math.js)
const f2 = fmt2;
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
const rect = (x, y, w, hh) => `M${f(x)} ${f(y)}h${f(w)}v${f(hh)}h${f(-w)}Z`;
const chamf = (w, hh, c = 8) => poly([[-w / 2 + c, -hh / 2], [w / 2, -hh / 2], [w / 2, hh / 2 - c], [w / 2 - c, hh / 2], [-w / 2, hh / 2], [-w / 2, -hh / 2 + c]]);
const star4 = (r, w) => `M0 ${f(-r)}L${f(w)} ${f(-w)}L${f(r)} 0L${f(w)} ${f(w)}L0 ${f(r)}L${f(-w)} ${f(w)}L${f(-r)} 0L${f(-w)} ${f(-w)}Z`;
const heart = s => `M0 ${f(3 * s)}C${f(-7 * s)} ${f(-2 * s)} ${f(-6 * s)} ${f(-8 * s)} ${f(-3 * s)} ${f(-8 * s)}C${f(-1 * s)} ${f(-8 * s)} 0 ${f(-6.5 * s)} 0 ${f(-5 * s)}C0 ${f(-6.5 * s)} ${f(1 * s)} ${f(-8 * s)} ${f(3 * s)} ${f(-8 * s)}C${f(6 * s)} ${f(-8 * s)} ${f(7 * s)} ${f(-2 * s)} 0 ${f(3 * s)}Z`;

// STYLE-X §1 neon (emissive: the same at every city mood) + hardware
const NX = {
  mag: '#FF2E88', magC: '#FFD3E7', cy: '#19E6FF', cyC: '#D8FBFF', acid: '#C6FF3D', acidC: '#F1FFD0', amber: '#FFB547', amberC: '#FFF0D2',
  red: '#FF3B4E', redC: '#FFD0D6', violet: '#9B5CFF', violetC: '#E4D4FF', coral: '#FF6A5C',
  void: '#07060F', ink: '#0B0918', night: '#141029', night2: '#261A45', haze: '#5B3F7A',
  steel: '#3A3F5C', steelHi: '#8A90B0', steelLo: '#1E2136', chrome: '#C4CBE6', chromeHi: '#F2F5FF', chromeLo: '#5A607E', plume: '#E9E6F2', white: '#FFFFFF',
};
// stacked-stroke neon tube: halo / bloom / tube / hot core (no filter)
function neon(d, c, core, w = 1, o = {}) {
  const k = { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
  return h('g', o,
    h('path', { d, ...k, stroke: c, 'stroke-width': f2(w * 7), opacity: 0.1 }),
    h('path', { d, ...k, stroke: c, 'stroke-width': f2(w * 3.2), opacity: 0.28 }),
    h('path', { d, ...k, stroke: c, 'stroke-width': f2(w * 1.4) }),
    core ? h('path', { d, ...k, stroke: core, 'stroke-width': f2(w * 0.55) }) : '');
}
// glyph run -> one merged path (em 1000 outlines scaled to `size`, anchored by `align` at (ox, oy) on the baseline)
function text(str, size, ox = 0, oy = 0, { align = 'middle', track = 30, font = 'lat' } = {}) {
  const s = size / 1000, T = font === 'mono' ? MONO : LAT;
  let pen = 0; const parts = [];
  for (const ch of str) {
    const g = T[ch] || ZH[ch];
    if (!g) { pen += 320 + track; continue; }
    if (g[1]) parts.push([pen, g[1]]);
    pen += g[0] + track;
  }
  const w = (pen - track) * s, x0 = ox - (align === 'middle' ? w / 2 : align === 'end' ? w : 0);
  let d = '';
  for (const [p, gd] of parts) {
    let i = 0;
    d += gd.replace(/-?\d+(\.\d+)?/g, m => { const v = +m; const out = i % 2 === 0 ? x0 + (v + p) * s : oy + v * s; i++; return ' ' + f(out); });
  }
  return { d, w };
}
const mono = (str, size, x, y, fill, align = 'start', extra = {}) => h('path', { d: text(str, size, x, y, { align, track: 0, font: 'mono' }).d, fill, ...extra });
// neon lettering: soft halo + filled core with a coloured tube edge
function glow(str, size, x, y, c, core, opts = {}, extra = {}) {
  const d = text(str, size, x, y, opts).d;
  return h('path', { d, fill: 'none', stroke: c, 'stroke-width': f2(size * 0.2), opacity: 0.2, 'stroke-linejoin': 'round' }) +
    h('path', { d, fill: core, stroke: c, 'stroke-width': f2(Math.max(0.6, size * 0.05)), 'paint-order': 'stroke', 'stroke-linejoin': 'round', ...extra });
}
// chromatic-aberration word (cyan left, magenta right, white core)
const chroma = (d, dx = 3) => h('path', { d, fill: 'none', stroke: NX.mag, 'stroke-width': 7, opacity: 0.22, 'stroke-linejoin': 'round' }) +
  h('path', { d, fill: NX.cy, transform: `translate(${-dx} 0)`, opacity: 0.85 }) + h('path', { d, fill: NX.mag, transform: `translate(${dx} 0)`, opacity: 0.85 }) + h('path', { d, fill: NX.white });
const brackets = (w, hh, c, len = 9, o = 5) => {
  const br = (sx, sy) => `M${f(sx * (w / 2 + o))} ${f(sy * (hh / 2 + o - len))}V${f(sy * (hh / 2 + o))}H${f(sx * (w / 2 + o - len))}`;
  return h('path', { d: br(-1, -1) + br(1, -1) + br(-1, 1) + br(1, 1), fill: 'none', stroke: c, 'stroke-width': 1.8 });
};
const scan = (w, hh, step = 3) => { let d = ''; for (let y = -hh / 2 + 2; y < hh / 2; y += step) d += `M${f(-w / 2)} ${f(y)}h${f(w)}`; return d; };
// translucent HUD panel: chamfered plate, bloom edge, scanlines, acid corner brackets
function hud(w, hh, acc, { alpha = 0.82, c = 10, fillC = NX.void } = {}) {
  const P = chamf(w, hh, c);
  return h('path', { d: P, fill: fillC, 'fill-opacity': alpha }) +
    h('path', { d: scan(w - 4, hh - 4), stroke: acc, 'stroke-width': 0.6, opacity: 0.13 }) +
    h('path', { d: P, fill: 'none', stroke: acc, 'stroke-width': 5, opacity: 0.18 }) +
    h('path', { d: P, fill: 'none', stroke: acc, 'stroke-width': 1.2 }) +
    brackets(w, hh, NX.acid);
}
// the egg glyph that brands every egg HUD (an acid neon egg with a zig-zag crack)
const EGG_D = 'M0 -12C6.5 -12 10 -3 10 3C10 9 5.5 12 0 12C-5.5 12 -10 9 -10 3C-10 -3 -6.5 -12 0 -12Z';
const eggIcon = (x, y, s = 1, c = NX.acid, core = NX.acidC) => h('g', { transform: `translate(${f(x)} ${f(y)}) scale(${s})` },
  h('path', { d: EGG_D, fill: c, opacity: 0.16 }), neon(EGG_D, c, core, 0.8), h('path', { d: 'M-9 1L-5 -2L-1 2L3 -2L6 1L9 -1', fill: 'none', stroke: core, 'stroke-width': 1.3, 'stroke-linejoin': 'round' }));
const bellD = 'M-6 4C-6 -2 -5 -7 0 -7C5 -7 6 -2 6 4L8 6H-8ZM-2.2 7.5A2.2 2.2 0 0 0 2.2 7.5Z';

// ------------------------------------------------------------------------------------------------ build
let defs = '';
// glitch HUD pop (same family as the fx pops DING!/HOP!/GULP!, egg accent = acid): three clip slices that shear, a
// chromatic word, a zh tag, a mono system line, glitch bars and radiating data shards
function gpop(ref, word, zh, sys, tag, acc = NX.acid, tagC = NX.mag, size = 46) {
  const cap = 0.73 * size, ww = text(word, size, 0, 0, { track: 20 }).w;
  const wd = text(word, size, 0, cap / 2, { track: 20 }).d;
  const W2 = ww / 2 + 22, H2 = cap / 2 + 15;
  const panel = poly([[-W2 + 8, -H2], [W2, -H2], [W2, H2 - 8], [W2 - 8, H2], [-W2, H2], [-W2, -H2 + 8]]);
  const cuts = [[-H2 - 10, -cap * 0.18], [-cap * 0.18, cap * 0.16], [cap * 0.16, H2 + 10]];
  cuts.forEach(([a, b], i) => { defs += h('clipPath', { id: `egg-pc-${ref}${i}` }, h('path', { d: rect(-W2 - 20, a, 2 * W2 + 40, b - a) })); });
  const letters = chroma(wd);
  let sh = '';
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU + 0.2, r0 = 1.08 + 0.1 * hash(i, 5), r1 = r0 + 0.22 + 0.25 * hash(i, 6);
    sh += `M${f(Math.cos(a) * W2 * r0)} ${f(Math.sin(a) * (H2 + 14) * r0)}L${f(Math.cos(a) * W2 * r1)} ${f(Math.sin(a) * (H2 + 14) * r1)}`;
  }
  const zw = text(zh, 22, 0, 0).w;
  return h('g', { 'data-ref': 'egg-' + ref, visibility: 'hidden' },
    h('g', { 'data-ref': `egg-${ref}Rays` }, h('path', { d: sh, stroke: acc, 'stroke-width': 4, opacity: 0.25, 'stroke-linecap': 'round' }), h('path', { d: sh, stroke: NX.acidC, 'stroke-width': 1.4, 'stroke-linecap': 'round' })),
    h('path', { d: panel, fill: NX.void, 'fill-opacity': 0.76 }),
    h('path', { d: panel, fill: 'none', stroke: acc, 'stroke-width': 4, opacity: 0.2 }),
    h('path', { d: panel, fill: 'none', stroke: acc, 'stroke-width': 1.1 }),
    brackets(2 * W2, 2 * H2, NX.cy, 8, 6),
    cuts.map((_, i) => h('g', { 'clip-path': `url(#egg-pc-${ref}${i})` }, h('g', { 'data-ref': `egg-${ref}S${i}` }, letters))),
    h('path', { d: scan(2 * W2, 2 * H2), stroke: NX.void, 'stroke-width': 1, opacity: 0.45 }),
    h('g', { transform: `translate(${f(W2 + 10)} ${f(-H2)})` },
      h('path', { d: rect(0, 0, zw + 10, 30), fill: tagC }), h('path', { d: rect(0, 0, zw + 10, 30), fill: 'none', stroke: tagC, 'stroke-width': 5, opacity: 0.25 }),
      h('path', { d: text(zh, 22, 5, 23, { align: 'start' }).d, fill: NX.white })),
    eggIcon(-W2 + 6, -H2 - 10, 0.55),
    mono(sys, 7.5, -W2 + 16, -H2 - 4, NX.cy),
    h('path', { d: rect(W2 - 34, -H2 - 9.5, 5, 5) + rect(W2 - 27, -H2 - 9.5, 5, 5) + rect(W2 - 20, -H2 - 9.5, 5, 5), fill: acc }),
    mono(tag, 7.5, W2 - 8, H2 + 11, acc, 'end'),
    h('path', { d: `M${f(-W2 + 8)} ${f(H2 + 7)}H${f(-W2 + 44)}`, stroke: NX.mag, 'stroke-width': 2 }),
    h('g', { 'data-ref': `egg-${ref}G`, visibility: 'hidden' },
      h('path', { d: rect(-W2, -2, 2 * W2, 3.4), fill: NX.mag, opacity: 0.8 }),
      h('path', { d: rect(-W2 * 0.6, 5, W2 * 1.1, 2), fill: NX.cy, opacity: 0.8 })));
}

// ---- the ginger street cat (sitting, facing +x, origin = between the hind feet on the seat) ----
const CAT = { fur: '#E8793A', furHi: '#FFB070', stripe: '#8E3516', belly: '#F4E4DA', ear: '#FF8FB8', line: NX.ink };
function catEyes() {
  return h('path', { d: circ(-8, -5.5, 4.6) + circ(8, -5.5, 4.6), fill: NX.cy, opacity: 0.25 }) +
    h('path', { d: 'M-11 -5.5A3 3.4 0 1 0 -5 -5.5A3 3.4 0 1 0 -11 -5.5ZM5 -5.5A3 3.4 0 1 0 11 -5.5A3 3.4 0 1 0 5 -5.5Z', fill: NX.cy, stroke: CAT.line, 'stroke-width': 0.8 }) +
    h('path', { d: 'M-8 -8V-3M8 -8V-3', stroke: CAT.line, 'stroke-width': 1.3, 'stroke-linecap': 'round' }) +
    h('path', { d: circ(-9.2, -7, 0.9) + circ(6.8, -7, 0.9), fill: NX.white });
}
function catSit(pfx) {
  const { fur: O, line: N, belly: P, stripe: R, ear: K } = CAT;
  const kl = { stroke: N, 'stroke-width': 2, 'stroke-linejoin': 'round' };
  return h('g', {},
    h('g', { 'data-ref': pfx + 'Tail' }, h('path', { d: 'M-18 -4C-40 -2 -48 -16 -44 -30C-42 -38 -34 -40 -32 -34C-36 -24 -30 -14 -16 -14Z', fill: O, ...kl }),
      h('path', { d: 'M-42 -22L-35 -24M-38 -32L-32 -30', stroke: R, 'stroke-width': 3, 'stroke-linecap': 'round' }),
      h('path', { d: 'M-43.5 -28C-43 -35 -38 -38 -34 -36', fill: 'none', stroke: NX.cy, 'stroke-width': 1.2, 'stroke-linecap': 'round' })),
    // body (loaf, chest to the right) + haunch
    h('path', { d: 'M-22 0C-30 -14 -26 -38 -8 -46C4 -52 16 -48 20 -38C24 -26 22 -10 18 0Z', fill: O, ...kl }),
    h('path', { d: 'M-18 -6C-20 -20 -12 -30 -2 -30C6 -28 8 -16 4 -4', fill: 'none', stroke: N, 'stroke-width': 1.6, 'stroke-linecap': 'round' }),
    h('path', { d: 'M-16 -36L-8 -32M-22 -26L-13 -24M-24 -15L-15 -15M-3 -46L-1 -39M6 -48L7 -41', stroke: R, 'stroke-width': 3.2, 'stroke-linecap': 'round' }),
    // city rim light: cyan on the back, magenta on the chest
    h('path', { d: 'M-23.5 -3C-29 -15 -26 -36 -9 -44.5', fill: 'none', stroke: NX.cy, 'stroke-width': 1.4, 'stroke-linecap': 'round', opacity: 0.9 }),
    h('path', { d: 'M12 -40C22 -34 22 -12 18 0H6C8 -14 6 -28 12 -40Z', fill: P, stroke: N, 'stroke-width': 1.4 }),
    h('path', { d: 'M20.5 -30C21.5 -20 21 -10 19 -2', fill: 'none', stroke: NX.mag, 'stroke-width': 1.3, 'stroke-linecap': 'round' }),
    h('path', { d: 'M4 0C4 -4 8 -5 12 -4C13 -2 13 0 12 0ZM13 0C13 -4 17 -5 21 -4C22 -2 22 0 21 0Z', fill: P, stroke: N, 'stroke-width': 1.3 }),
    // LED collar + acid tag
    h('path', { d: 'M3 -41Q14 -35 25 -41', fill: 'none', stroke: NX.mag, 'stroke-width': 3.2, 'stroke-linecap': 'round' }),
    h('path', { d: 'M3 -41Q14 -35 25 -41', fill: 'none', stroke: NX.magC, 'stroke-width': 1, 'stroke-dasharray': '1.5 3' }),
    h('path', { d: 'M12 -37h5l1 5l-3.5 2l-3.5 -2Z', fill: NX.acid, stroke: N, 'stroke-width': 0.9 }),
    // head
    h('g', { 'data-ref': pfx + 'Head', transform: 'translate(14 -50)' },
      h('path', { d: 'M-15 -6L-13 -24L-4 -14ZM6 -15L15 -24L16 -6Z', fill: O, ...kl }),
      h('path', { d: 'M-11 -12L-11 -20L-6 -14ZM9 -14L13 -20L13 -12Z', fill: K }),
      // ear implant: chrome ring + a cyan status LED
      h('path', { d: circ(14.2, -17, 2.4), fill: 'none', stroke: NX.chrome, 'stroke-width': 1.4 }), h('path', { d: circ(14.2, -17, 0.9), fill: NX.cy }),
      h('path', { d: 'M-17 -2C-18 -14 -8 -18 0 -18C8 -18 18 -14 17 -2C16 8 8 12 0 12C-8 12 -16 8 -17 -2Z', fill: O, ...kl }),
      h('path', { d: 'M-5 -17L-3 -10M1 -18L1 -11M6 -17L4 -10', stroke: R, 'stroke-width': 2.4, 'stroke-linecap': 'round' }),
      h('path', { d: 'M-6 4C-6 0 -2 -1 0 1C2 -1 6 0 6 4C6 9 -6 9 -6 4Z', fill: P }),
      h('path', { d: 'M-2 2L2 2L0 4.4Z', fill: K, stroke: N, 'stroke-width': 0.6 }),
      h('g', { 'data-ref': pfx + 'Eyes' }, catEyes()),
      h('path', { d: 'M-8 5H-22M-8 7L-21 10M8 5H22M8 7L21 10', stroke: NX.cyC, 'stroke-width': 0.8, 'stroke-linecap': 'round', opacity: 0.85 })));
}
// dark knock-out outline under a figure so it reads against any neon band
const halo = (mk, w = 6) => h('g', { 'aria-hidden': 'true' }, mk.replace(/(fill|stroke)="#[0-9A-Fa-f]{6}"/g, '$1="' + NX.void + '"').replace(/stroke-width="[\d.]+"/g, `stroke-width="${w}"`).replace(/fill="none"/g, `fill="${NX.void}"`).replace(/ opacity="[\d.]+"/g, ''));
function catLeap() { const mk = catLeapInner(); return halo(mk) + mk; }
function catLeapInner() {
  const { fur: O, line: N, belly: P, stripe: R, ear: K } = CAT;
  const kl = { stroke: N, 'stroke-width': 2, 'stroke-linejoin': 'round' };
  return h('g', {},
    h('path', { d: 'M-30 -2C-48 -4 -60 -14 -66 -26C-62 -28 -56 -22 -50 -16C-44 -10 -36 -8 -28 -8Z', fill: O, ...kl }),
    h('path', { d: 'M-26 2L-44 14L-40 18L-20 8ZM-18 4L-30 20L-24 22L-10 8Z', fill: O, ...kl }),
    h('path', { d: 'M-32 -6C-30 -18 -10 -22 8 -20C22 -18 30 -12 32 -4C30 6 16 10 0 10C-16 10 -30 6 -32 -6Z', fill: O, ...kl }),
    h('path', { d: 'M-20 -18L-18 -8M-10 -20L-9 -10M0 -21L0 -12M10 -20L9 -12', stroke: R, 'stroke-width': 3, 'stroke-linecap': 'round' }),
    h('path', { d: 'M-30 -9C-27 -17 -12 -21 6 -19.5', fill: 'none', stroke: NX.cy, 'stroke-width': 1.4, 'stroke-linecap': 'round' }),
    h('path', { d: 'M10 6L34 16L36 11L22 0ZM20 4L42 6L42 1L26 -4Z', fill: O, ...kl }),
    h('path', { d: 'M8 8C18 10 26 6 28 0L18 -2C12 2 8 4 8 8Z', fill: P, stroke: N, 'stroke-width': 1.2 }),
    h('path', { d: 'M24 -14Q30 -8 28 -1', fill: 'none', stroke: NX.mag, 'stroke-width': 3, 'stroke-linecap': 'round' }),
    h('g', { transform: 'translate(40 -12) rotate(8)' },
      h('path', { d: 'M-12 -6L-12 -22L-3 -13ZM4 -14L13 -21L14 -5Z', fill: O, ...kl }),
      h('path', { d: 'M-9 -11L-9 -18L-5 -13Z', fill: K }),
      h('path', { d: 'M-14 -2C-15 -12 -7 -16 0 -16C8 -16 16 -12 15 -2C14 7 7 10 0 10C-7 10 -13 7 -14 -2Z', fill: O, ...kl }),
      h('path', { d: 'M-6 -9L-4 -3M4 -9L3 -3', stroke: NX.cy, 'stroke-width': 2.6, 'stroke-linecap': 'round' }),
      h('path', { d: 'M2 3C6 6 12 4 14 1', fill: 'none', stroke: N, 'stroke-width': 1.4, 'stroke-linecap': 'round' }),
      h('path', { d: 'M6 2H22M6 4L20 8', stroke: NX.cyC, 'stroke-width': 0.8 })));
}
// a glowing delivery fish (facing +x, origin = centre)
function fish(len = 34, pfx) {
  const L = len / 2, body = `M${f(-L)} 0C${f(-L * 0.4)} -12 ${f(L * 0.5)} -11 ${f(L)} 0C${f(L * 0.5)} 10 ${f(-L * 0.4)} 10 ${f(-L)} 0Z`;
  return h('g', pfx ? { 'data-ref': pfx } : {},
    h('path', { d: circ(0, 0, L + 6), fill: NX.cy, opacity: 0.12 }),
    h('path', { d: `M${f(-L)} 0L${f(-L - 10)} -8L${f(-L - 8)} 0L${f(-L - 10)} 8Z`, fill: '#1F7A96', stroke: NX.cy, 'stroke-width': 1.3, 'stroke-linejoin': 'round' }),
    h('path', { d: body, fill: '#1F7A96', stroke: NX.cy, 'stroke-width': 1.5 }),
    h('path', { d: `M${f(-L * 0.8)} 2C${f(-L * 0.2)} 7 ${f(L * 0.4)} 7 ${f(L * 0.85)} 1`, fill: NX.cyC }),
    h('path', { d: `M${f(-L * 0.5)} -3L${f(-L * 0.1)} 0L${f(L * 0.2)} -3`, fill: 'none', stroke: NX.amber, 'stroke-width': 1.1 }),
    h('path', { d: `M${f(L * 0.45)} -6C${f(L * 0.3)} -2 ${f(L * 0.3)} 2 ${f(L * 0.45)} 5`, fill: 'none', stroke: NX.mag, 'stroke-width': 1.6 }),
    h('path', { d: circ(L * 0.66, -2, 1.7), fill: NX.void }), h('path', { d: circ(L * 0.62, -2.5, 0.6), fill: NX.white }));
}
// a harbour gull in glide (facing +x, origin = body), wing is a separate flapping group; cyan rim on the leading edges
function gull(pfx) {
  const P = NX.plume, N = NX.ink, B = '#6E6A90';
  return h('g', {},
    h('g', { 'data-ref': pfx + 'WingF' }, h('path', { d: 'M-6 -4L-24 -30L-40 -36L-20 -8Z', fill: '#4A4668', stroke: N, 'stroke-width': 1.2 })),
    h('path', { d: 'M-26 2L-38 -4L-36 6Z', fill: P, stroke: N, 'stroke-width': 1.2 }),
    h('path', { d: 'M-28 2C-18 -6 4 -8 14 -4C20 -2 22 4 16 7C4 10 -16 9 -28 2Z', fill: P, stroke: N, 'stroke-width': 1.5 }),
    h('path', { d: 'M-24 5C-12 9 6 9 15 6', fill: 'none', stroke: NX.mag, 'stroke-width': 1.3, 'stroke-linecap': 'round' }),
    h('path', { d: 'M12 -8C18 -12 26 -10 26 -4C26 0 20 2 14 1Z', fill: P, stroke: N, 'stroke-width': 1.4 }),
    h('g', { 'data-ref': pfx + 'Beak' }, h('path', { d: 'M25 -5L35 -3L25 -1Z', fill: NX.amber, stroke: N, 'stroke-width': 1 }), h('path', { d: 'M31 -3.5L33 -3.2L31.5 -2Z', fill: NX.red })),
    h('g', { 'data-ref': pfx + 'Jaw', visibility: 'hidden' }, h('path', { d: 'M25 -1L33 5L24 1Z', fill: NX.amber, stroke: N, 'stroke-width': 1 })),
    h('path', { d: circ(20, -6, 1.6), fill: N }),
    h('g', { 'data-ref': pfx + 'Wing' },
      h('path', { d: 'M-8 -2C-14 -16 -22 -30 -38 -44C-26 -44 -8 -30 6 -6Z', fill: B, stroke: N, 'stroke-width': 1.5, 'stroke-linejoin': 'round' }),
      h('path', { d: 'M-26 -34L-38 -44C-32 -44 -26 -41 -20 -36Z', fill: N }),
      h('path', { d: 'M-36 -43C-24 -42 -8 -30 5 -7', fill: 'none', stroke: NX.cy, 'stroke-width': 1.2, 'stroke-linecap': 'round' }),
      h('path', { d: circ(-33, -41, 1.5), fill: P })));
}
// great white pelican in flight (facing +x, neck folded; origin = body), neon rim + a nav light on the far wing
function pelFly(pfx) {
  const P = NX.plume, N = NX.ink;
  return h('g', {},
    h('g', { 'data-ref': pfx + 'WingF' }, h('path', { d: 'M-2 -4C-12 -24 -26 -40 -50 -48C-40 -30 -24 -12 -12 -2Z', fill: N }), h('path', { d: circ(-50, -48, 2.2), fill: NX.red })),
    h('path', { d: 'M-34 0C-24 -10 4 -12 18 -8C28 -5 30 4 22 8C6 12 -20 10 -34 0Z', fill: P, stroke: N, 'stroke-width': 1.6 }),
    h('path', { d: 'M-30 3C-16 10 8 10 22 6', fill: 'none', stroke: NX.mag, 'stroke-width': 1.5, 'stroke-linecap': 'round' }),
    h('path', { d: 'M-34 0L-44 -4L-42 4Z', fill: P, stroke: N, 'stroke-width': 1.2 }),
    h('path', { d: 'M22 -2C26 -12 34 -16 40 -12C44 -8 40 -2 34 0Z', fill: P, stroke: N, 'stroke-width': 1.4 }),
    h('path', { d: 'M38 -12L74 -2L40 -4Z', fill: NX.amber, stroke: N, 'stroke-width': 1.1, 'stroke-linejoin': 'round' }),
    h('path', { d: 'M40 -5L70 -1C60 6 46 6 38 0Z', fill: NX.coral, stroke: N, 'stroke-width': 1.1 }),
    h('path', { d: 'M44 -4L52 -2L58 -3', fill: 'none', stroke: NX.cy, 'stroke-width': 0.9 }),
    h('path', { d: circ(36, -10, 1.5), fill: N }),
    h('path', { d: 'M-12 8L-22 14L-16 15L-8 10Z', fill: NX.coral }),
    h('g', { 'data-ref': pfx + 'Wing' },
      h('path', { d: 'M-4 -6C-10 -26 -22 -44 -46 -58C-24 -58 0 -34 12 -8Z', fill: P, stroke: N, 'stroke-width': 1.5, 'stroke-linejoin': 'round' }),
      h('path', { d: 'M-24 -40C-30 -48 -38 -54 -46 -58C-34 -58 -24 -52 -16 -44ZM-10 -18C-16 -30 -22 -36 -30 -44', fill: N, stroke: N, 'stroke-width': 1.2 }),
      h('path', { d: 'M-44 -57.5C-24 -56 0 -34 11 -9', fill: 'none', stroke: NX.cy, 'stroke-width': 1.3, 'stroke-linecap': 'round' }),
      h('path', { d: circ(-46, -58, 2.2), fill: '#3BFF8A' })));
}

export function build(ctx) {
  defs = '';
  const L = { sky: '', gulls: '', stars: '', clouds: '', sea: '', roadside: '', road: '', front: '' };

  // ---- colour overrides on the rider's slots (pure CSS custom properties re-pointed; follow every frame for free)
  const sel = (cls, names) => names.map(n => `#scene.${cls} #j-${n}`).join(',');
  const WINGS = ['wingNearUpper', 'wingNearLower', 'wingNearHand', 'wingFarUpper', 'wingFarLower', 'wingFarHand'];
  const LEGS = ['thighNear', 'thighFar', 'shankNear', 'shankFar', 'footNear', 'footFar'];
  // brown pelican (Konami): real Pelecanus occidentalis colours, lit cool by the city
  let css = `${sel('egg-brown', ['body', 'tail', ...WINGS, 'thighNear', 'thighFar'])}{--pb-plume:#7C7068;--pb-plume-far:#4E4642;--pb-plumeShade:#4A403C;--pb-plumeShade-far:#342C2A;--pb-plumeDeep:#2E2624;--pb-flight:#221C1E;--pb-flight-far:#161214;--pb-flightSheen:#5A4E48}`
    + `${sel('egg-brown', ['neck'])}{--pb-plume:#6B3524;--pb-plume-far:#4A2418;--pb-plumeShade:#40180E;--pb-plumeDeep:#2E1008}`
    + `${sel('egg-brown', ['crest'])}{--pb-plume:#F2D56A;--pb-plumeShade:#B8923A}`
    + `${sel('egg-brown', ['head'])}{--pb-plume:#F4EEDC;--pb-skin:#EDE3C8;--pb-plumeShade:#E8C860}`
    + `${sel('egg-brown', ['pouch', 'billLower'])}{--pb-pouch:#3A3236;--pb-pouchDeep:#B8323A}`
    + `${sel('egg-brown', ['billUpper', 'billLower'])}{--pb-bill:#8A7E76;--pb-billEdge:#C25048;--pb-billNail:#D8A060}`
    + `${sel('egg-brown', ['eye'])}{--pb-iris:#F4F0E6}`
    + `${sel('egg-brown', ['footNear', 'footFar', 'shankNear', 'shankFar'])}{--pb-foot:#2A2428;--pb-web:#1E1A1E;--pb-foot-far:#1A1618;--pb-web-far:#141012}`;
  // golden chrome suit (888): the techwear re-pointed to polished gold; the limbs' sleeves are fixed hexes, matched by value
  const GOLD = { jk: '#B8862B', hi: '#FFE39A', lo: '#5E3F0C', seam: '#2A1B04' };
  css += `${sel('egg-gold', ['body', 'neck', 'head', 'tail', 'crest', 'pouch', 'billUpper', 'billLower', 'eye'])}{--pb-pbJacket:${GOLD.jk};--pb-pbJacketHi:${GOLD.hi};--pb-pbJacketLo:${GOLD.lo};--pb-pbSeam:${GOLD.seam};--pb-pbPatch:#3A2606;--pb-pbChrome:#F2C85A;--pb-pbChromeHi:#FFF6D0;--pb-pbChromeDk:#6A4A12;--pb-pbChromeMid:#C09030}`;
  const sleeve = { '#1C1932': GOLD.jk, '#2E2A52': GOLD.hi, '#110F20': GOLD.lo, '#2A2646': '#D8A640', '#15122A': '#7A5412', '#262240': '#9A6E1E', '#1A1730': '#C8962E', '#34305A': '#FFE9A8',
    '#100E1E': '#6E4E14', '#0A0914': '#3A2606', '#17142A': '#7A5818', '#0C0A18': '#3A2606', '#151226': '#5E4212', '#0D0B16': '#4A320A' };
  const limbSel = [...WINGS, ...LEGS].map(n => `#scene.egg-gold #j-${n}`);
  for (const [a, b] of Object.entries(sleeve)) css += `${limbSel.map(s => `${s} [fill="${a.trim()}" i]`).join(',')}{fill:${b}}`;
  // the wireframe city (HACK): every sheet except the rider, the front fx and the HUD loses its paint and keeps its
  // geometry as 0.7 px neon lines coloured by depth. Only classes flip: each sheet repaints once going in and once out
  // (one class on #scene: a single style invalidation; converting sheet by sheet measured slower)
  const SH = '#scene.egg-wire > svg.pb-sheet';
  const NOT = ':not([data-sheet="defs"]):not([data-sheet^="j-"]):not([data-sheet="L-rider"]):not([data-sheet="L-fx-front"]):not([data-sheet="L-letterbox"])';
  const SHAPES = ':is(path,rect,circle,ellipse,polygon,polyline,line,use):not(mask *,clipPath *,pattern *,linearGradient *,radialGradient *)';
  const wf = (extra, c, o) => `${SH}${NOT}${extra} ${SHAPES}{fill:none!important;stroke:${c}!important;stroke-opacity:${o}!important;stroke-width:0.7px!important;stroke-dasharray:none!important;vector-effect:non-scaling-stroke;filter:none!important}`;
  css += `#scene.egg-hack{background:${NX.void}}`
    + wf('', NX.cy, 0.62)
    + wf(':is([data-sheet^="sky-"],[data-sheet="L-sky"],[data-sheet="L-stars"],[data-sheet="L-sunmoon"],[data-sheet="L-clouds"],[data-sheet^="wx-shaft"],[data-sheet^="wx-clear"])', NX.violet, 0.5)
    + wf(':is([data-sheet^="sea-"],[data-sheet="L-hills-far"],[data-sheet="L-sea"],[data-sheet="L-boats"],[data-sheet="L-gulls-far"])', NX.cy, 0.42)
    + wf(':is([data-sheet$="-fg"],[data-sheet="L-foreground"],[data-sheet="land-sphost-fg"])', NX.mag, 0.7)
    + wf(':is([data-sheet$="road"],[data-sheet="L-road"],[data-sheet="L-shadow"],[data-sheet="L-fx-back"])', NX.acid, 0.55);
  defs += `<style>${css}${MECH_CSS}</style>`;
  const MECH = buildMech();
  defs += MECH.defs;
  defs += h('symbol', { id: 'egg-catsit', overflow: 'visible' }, catSit('egg-cs'));
  defs += h('linearGradient', { id: 'egg-scanG', x1: 0, y1: 0, x2: 0, y2: 1 }, h('stop', { offset: 0, 'stop-color': NX.acid, 'stop-opacity': 0 }), h('stop', { offset: 1, 'stop-color': NX.acid, 'stop-opacity': 0.28 }));
  defs += h('linearGradient', { id: 'egg-holoG', x1: 0, y1: 0, x2: 0, y2: 1 }, h('stop', { offset: 0, 'stop-color': NX.cy, 'stop-opacity': 0.26 }), h('stop', { offset: 1, 'stop-color': NX.cy, 'stop-opacity': 0.08 }));
  defs += h('linearGradient', { id: 'egg-coneG', x1: 0, y1: 0, x2: 0, y2: 1 }, h('stop', { offset: 0, 'stop-color': NX.cy, 'stop-opacity': 0.3 }), h('stop', { offset: 1, 'stop-color': NX.cy, 'stop-opacity': 0 }));
  defs += h('linearGradient', { id: 'egg-tailG', gradientUnits: 'userSpaceOnUse', x1: 0, y1: 0, x2: 170, y2: -54 }, h('stop', { offset: 0, 'stop-color': NX.cyC }), h('stop', { offset: 0.25, 'stop-color': NX.cy, 'stop-opacity': 0.7 }), h('stop', { offset: 1, 'stop-color': NX.mag, 'stop-opacity': 0 }));
  defs += h('radialGradient', { id: 'egg-sunHolo' }, h('stop', { offset: 0, 'stop-color': '#FFF3D6', 'stop-opacity': 0.95 }), h('stop', { offset: 0.55, 'stop-color': NX.amber, 'stop-opacity': 0.85 }), h('stop', { offset: 1, 'stop-color': NX.mag, 'stop-opacity': 0.75 }));
  defs += h('clipPath', { id: 'egg-sunClip' }, h('path', { d: circ(0, 0, 70) }));
  defs += h('radialGradient', { id: 'egg-glowM' }, h('stop', { offset: 0, 'stop-color': NX.mag, 'stop-opacity': 0.45 }), h('stop', { offset: 1, 'stop-color': NX.mag, 'stop-opacity': 0 }));
  defs += h('radialGradient', { id: 'egg-glowC' }, h('stop', { offset: 0, 'stop-color': NX.cy, 'stop-opacity': 0.5 }), h('stop', { offset: 1, 'stop-color': NX.cy, 'stop-opacity': 0 }));
  defs += h('radialGradient', { id: 'egg-glowR' }, h('stop', { offset: 0, 'stop-color': NX.red, 'stop-opacity': 0.4 }), h('stop', { offset: 1, 'stop-color': NX.red, 'stop-opacity': 0 }));
  defs += h('radialGradient', { id: 'egg-glowA' }, h('stop', { offset: 0, 'stop-color': NX.acid, 'stop-opacity': 0.4 }), h('stop', { offset: 1, 'stop-color': NX.acid, 'stop-opacity': 0 }));

  // ---- HUD notification cards (screen-ish, upper left): brown / velo / gold
  const card = (ref, sys, big, l3, acc, bigC, bigCore) => {
    const w = 470, hh = 108;
    return h('g', { 'data-ref': 'egg-' + ref, visibility: 'hidden' }, h('g', { 'data-ref': `egg-${ref}In` },
      hud(w, hh, acc),
      h('path', { d: rect(-w / 2 + 10, -hh / 2 + 8, w - 20, 20), fill: acc, opacity: 0.9 }),
      mono(sys, 10, -w / 2 + 40, -hh / 2 + 22, NX.void),
      eggIcon(-w / 2 + 24, -hh / 2 + 18, 0.62, NX.void, NX.void),
      mono('EGG ' + String(EGGS.findIndex(e => e.id === { capBrown: 'brown', capVelo: 'velo', capGold: 'gold', capMech: 'mech' }[ref]) + 1).padStart(2, '0') + '/' + EGGS.length, 10, w / 2 - 18, -hh / 2 + 22, NX.void, 'end'),
      glow(big, 26, 0, 12, bigC, bigCore),
      mono(l3, 10.5, 0, 38, NX.plume, 'middle', { opacity: 0.85 }),
      h('path', { d: `M${-w / 2 + 14} ${hh / 2 - 8}h60M${w / 2 - 74} ${hh / 2 - 8}h60`, stroke: acc, 'stroke-width': 2 }),
      h('path', { d: rect(-w / 2 + 80, hh / 2 - 10, 4, 4) + rect(-w / 2 + 88, hh / 2 - 10, 4, 4) + rect(-w / 2 + 96, hh / 2 - 10, 4, 4), fill: NX.acid })));
  };
  L.front += card('capBrown', 'SKIN PATCH // SIMON WILLISON BENCHMARK', '褐鹈鹕 · 繁殖羽', 'CALIFORNIA BROWN PELICAN · BREEDING PLUMAGE', NX.amber, NX.amber, NX.amberC);
  L.front += card('capVelo', 'ERR 0x6E // CHAIN_LOOP · VELOCIPEDIA', '链条接错啦！', 'AFTER GIANLUCA GIMINI · BIKES DRAWN FROM MEMORY', NX.mag, NX.mag, NX.magC);
  L.front += card('capMech', 'MECH PROTOCOL 鹈鹕-01 // ALL PLATES LOCKED', '机甲上线 · MECH ONLINE', 'ARMOR 100% · REACTOR STABLE · THRUSTERS IDLE', NX.cy, NX.cy, NX.cyC);
  L.front += card('capGold', 'FIRMWARE 8.8.8 // 发发发', '恭喜发财 · 金色铬甲', 'GOLD CHROME EDITION · PROSPERITY PATCH INSTALLED', NX.amber, NX.amber, '#FFF3C4');

  // ---- sun + moon faces (L-sunmoon, depth 0; placed on the discs every frame while shown)
  const face = (ref, s, shades) => h('g', { 'data-ref': 'egg-' + ref, visibility: 'hidden' }, h('g', { transform: `scale(${s})` },
    // the sun sits low behind the towers: its face is a hologram disc projected in front of them
    shades ? h('path', { d: circ(0, 0, 70), fill: 'url(#egg-sunHolo)' }) + h('path', { d: scan(140, 140, 5), stroke: NX.void, 'stroke-width': 1.2, opacity: 0.25, 'clip-path': 'url(#egg-sunClip)' }) + neon(circ(0, 0, 70), NX.amber, NX.amberC, 0.9) : '',
    // HUD target reticle around the disc
    h('path', { d: circ(0, 0, 78), fill: 'none', stroke: NX.cy, 'stroke-width': 1.2, 'stroke-dasharray': '10 7', opacity: 0.8 }),
    h('path', { d: 'M-92 0H-80M80 0H92M0 -92V-80M0 80V92', stroke: NX.acid, 'stroke-width': 2 }),
    h('path', { d: circ(-38, 16, 11) + circ(38, 16, 11), fill: NX.mag, opacity: 0.55 }),
    h('path', { d: 'M-26 -12m-7 0a7 10 0 1 0 14 0a7 10 0 1 0 -14 0Z', fill: NX.ink }),
    h('path', { d: circ(-24, -16, 2.6), fill: NX.white }),
    h('g', { 'data-ref': `egg-${ref}Open` }, h('path', { d: 'M26 -12m-7 0a7 10 0 1 0 14 0a7 10 0 1 0 -14 0Z', fill: NX.ink }), h('path', { d: circ(28, -16, 2.6), fill: NX.white })),
    h('path', { 'data-ref': `egg-${ref}Shut`, visibility: 'hidden', d: 'M14 -10Q26 -22 40 -10', fill: 'none', stroke: NX.ink, 'stroke-width': 5, 'stroke-linecap': 'round' }),
    h('path', { d: 'M-38 -32Q-26 -38 -14 -32M14 -34Q26 -40 38 -32', fill: 'none', stroke: NX.ink, 'stroke-width': 3.4, 'stroke-linecap': 'round' }),
    h('path', { d: 'M-28 16Q0 44 30 14', fill: 'none', stroke: NX.ink, 'stroke-width': 5, 'stroke-linecap': 'round' }),
    h('path', { d: 'M30 14Q35 10 38 11', fill: 'none', stroke: NX.ink, 'stroke-width': 3, 'stroke-linecap': 'round' }),
    // pixel shades that drop in (sun only); hinged at the left lens so the right one can lift for the wink
    shades ? h('g', { 'data-ref': `egg-${ref}Shades` }, h('g', { 'data-ref': `egg-${ref}Lift` },
      h('path', { d: 'M-46 -22H46V-16H40V-4H34V2H14V-4H8V-16H-8V-4H-14V2H-34V-4H-40V-16H-46Z', fill: NX.ink, stroke: NX.void, 'stroke-width': 1 }),
      h('path', { d: 'M-34 -14h6v6h-6ZM-28 -8h6v6h-6ZM14 -14h6v6h-6ZM20 -8h6v6h-6Z', fill: NX.cy }),
      h('path', { d: 'M-40 -21H40', stroke: NX.mag, 'stroke-width': 1.4 }))) : '',
    h('path', { 'data-ref': `egg-${ref}Spark`, d: star4(16, 3.4), fill: NX.white, stroke: NX.cy, 'stroke-width': 1.4, transform: 'translate(64 -40)' }),
    mono(shades ? 'DEAL WITH IT ;)' : '^_~ 晚安', shades ? 12 : 16, 0, 108, NX.cyC, 'middle')));
  // drawn as holograms in L-gulls-far (depth .15) so they project in front of the skyline that hides the low smog sun
  L.gulls = face('sunFace', 0.8, true) + face('moonFace', 0.5, false);

  // ---- shooting stars (L-stars): the egg's own, a rare neon meteor at night; click it while it still glows
  L.stars += h('g', { 'data-ref': 'egg-shoot', visibility: 'hidden' },
    h('path', { d: 'M0 0L170 -54', stroke: 'url(#egg-tailG)', 'stroke-width': 3.2, 'stroke-linecap': 'round' }),
    h('path', { d: 'M4 -1L120 -38', stroke: NX.white, 'stroke-width': 1, 'stroke-linecap': 'round', opacity: 0.8 }),
    h('path', { d: circ(0, 0, 12), fill: 'url(#egg-glowC)' }),
    h('path', { d: star4(8, 1.8), fill: NX.white }));
  // ---- wish sparkle (L-stars, depth 0)
  let wishRays = '', wishRays2 = '';
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, r0 = 12, r1 = i % 2 ? 36 : 58, w = 0.16; const p = poly([[Math.cos(a - w) * r0, Math.sin(a - w) * r0], [Math.cos(a) * r1, Math.sin(a) * r1], [Math.cos(a + w) * r0, Math.sin(a + w) * r0]]); if (i % 2) wishRays2 += p; else wishRays += p; }
  L.stars += h('g', { 'data-ref': 'egg-wish', visibility: 'hidden' },
    h('path', { d: circ(0, 0, 70), fill: 'url(#egg-glowC)' }),
    h('g', { 'data-ref': 'egg-wishRays' }, h('path', { d: wishRays, fill: NX.cy, opacity: 0.85 }), h('path', { d: wishRays2, fill: NX.mag, opacity: 0.85 })),
    neon(circ(0, 0, 24), NX.acid, NX.acidC, 0.6, { 'stroke-dasharray': '2 5' }),
    h('path', { d: star4(20, 5), fill: NX.white, stroke: NX.cy, 'stroke-width': 1.4 }),
    h('g', { 'data-ref': 'egg-wishFall' }, [0, 1, 2, 3, 4].map(i => h('path', { d: star4(6 - i, 1.4), fill: i % 2 ? NX.mag : NX.cyC, transform: `translate(${-i * 16} ${i * 20})` }))),
    h('path', { d: rect(-74, 58, 148, 32), fill: NX.void, 'fill-opacity': 0.7 }),
    glow('许愿！WISH!', 22, 0, 82, NX.amber, NX.amberC));

  // ---- pelican squadron (L-clouds)
  let sq = '';
  for (let i = 0; i < 7; i++) sq += h('g', { 'data-ref': 'egg-pf' + i }, pelFly('egg-pf' + i));
  L.clouds += h('g', { 'data-ref': 'egg-flight', visibility: 'hidden' }, sq);

  // ---- message in a bottle (L-sea, depth .1): a glowing bottle with a lit scroll inside; the note is a hologram
  L.sea += h('g', { 'data-ref': 'egg-bottle', visibility: 'hidden' },
    h('path', { d: 'M-46 8a46 10 0 1 0 92 0a46 10 0 1 0 -92 0Z', fill: 'url(#egg-glowC)' }),
    h('path', { 'data-ref': 'egg-bottleRip', d: 'M-40 8Q-30 4 -20 8M18 8Q28 4 38 8M-26 13Q0 9 24 13', fill: 'none', stroke: NX.cy, 'stroke-width': 1.4, 'stroke-linecap': 'round' }),
    h('g', { 'data-ref': 'egg-bottleB' },
      h('path', { d: 'M-24 -6C-24 -12 -18 -14 -8 -14H8C12 -14 14 -10 20 -9H28V-3H20C14 -2 12 2 8 2H-8C-18 2 -24 0 -24 -6Z', fill: '#0E4A5A', 'fill-opacity': 0.85, stroke: NX.cy, 'stroke-width': 1.5, 'stroke-linejoin': 'round' }),
      h('path', { d: 'M-16 -8H6C8 -8 8 -4 6 -4H-16C-18 -4 -18 -8 -16 -8Z', fill: NX.amberC }),
      h('path', { d: 'M-16 -8H6C8 -8 8 -4 6 -4H-16C-18 -4 -18 -8 -16 -8Z', fill: 'none', stroke: NX.amber, 'stroke-width': 2.4, opacity: 0.4 }),
      h('path', { d: 'M-6 -9V-3', stroke: NX.mag, 'stroke-width': 1.6 }),
      h('path', { d: 'M-20 -11H0', stroke: NX.cyC, 'stroke-width': 1.4, 'stroke-linecap': 'round' }),
      h('path', { d: 'M28 -4.5H34V-7.5H28Z', fill: NX.steel, stroke: NX.cy, 'stroke-width': 1 }),
      h('path', { 'data-ref': 'egg-bottleLed', d: circ(35.5, -6, 1.6), fill: NX.acid }),
      // visible clue: a four-point glint winks on the glass every ~22 s
      h('path', { 'data-ref': 'egg-bottleGlint', visibility: 'hidden', d: 'M-12 -30L-9.6 -13.4L6 -11L-9.6 -8.6L-12 8L-14.4 -8.6L-30 -11L-14.4 -13.4Z', fill: NX.white, stroke: NX.cy, 'stroke-width': 0.8, 'stroke-linejoin': 'round' })));
  const nw = 390, nh = 172;
  L.sea += h('g', { 'data-ref': 'egg-note', visibility: 'hidden' },
    h('path', { d: `M-18 ${nh / 2}L18 ${nh / 2}L60 ${nh / 2 + 150}H-60Z`, fill: 'url(#egg-coneG)' }),
    h('g', { 'data-ref': 'egg-noteIn' },
      h('path', { d: chamf(nw, nh, 14), fill: 'url(#egg-holoG)' }),
      hud(nw, nh, NX.cy, { alpha: 0.55, c: 14 }),
      h('path', { d: rect(-nw / 2 + 10, -nh / 2 + 8, nw - 20, 18), fill: NX.cy, opacity: 0.85 }),
      mono('INCOMING MESSAGE // 漂流瓶 · BOTTLE-MAIL 0719', 9.5, -nw / 2 + 34, -nh / 2 + 21, NX.void),
      eggIcon(-nw / 2 + 21, -nh / 2 + 17, 0.55, NX.void, NX.void),
      glow('你好，海边的朋友！', 24, 0, -28, NX.cy, NX.cyC),
      glow('来鹈鹕湾，一起骑车吧！', 24, 0, 4, NX.mag, NX.magC),
      mono('HELLO, FRIEND BY THE SEA!', 13, 0, 32, NX.plume, 'middle'),
      mono('COME RIDE WITH US AT PELICAN BAY.', 11, 0, 50, NX.cyC, 'middle', { opacity: 0.85 }),
      glow('— P.', 16, nw / 2 - 26, 72, NX.amber, NX.amberC, { align: 'end' }),
      h('path', { d: 'M-170 66C-160 56 -150 76 -140 66S-120 56 -110 66', fill: 'none', stroke: NX.acid, 'stroke-width': 1.4, 'stroke-linecap': 'round' })));

  // ---- LED bench + street cat (L-roadside, depth .9)
  const bench = h('g', {},
    h('path', { d: 'M-80 2a80 10 0 1 0 160 0a80 10 0 1 0 -160 0Z', fill: 'url(#egg-glowM)' }),
    h('path', { d: 'M-58 0L-54 -22H-50L-48 0ZM48 0L50 -22H54L58 0Z', fill: NX.steel, stroke: NX.ink, 'stroke-width': 1.2 }),
    h('path', { d: 'M-64 -24H64V-18H-64ZM-62 -30H62V-26H-62Z', fill: '#2A2448', stroke: NX.ink, 'stroke-width': 1.4 }),
    h('path', { d: 'M-62 -29.4H62', stroke: NX.steelHi, 'stroke-width': 0.8 }),
    neon('M-60 -16.5H60', NX.mag, NX.magC, 0.8),
    h('path', { d: 'M-60 -34V-58M60 -34V-58', stroke: NX.steel, 'stroke-width': 3 }),
    // backrest: a holo ad strip
    h('path', { d: rect(-62, -60, 124, 24), fill: NX.void, 'fill-opacity': 0.9, stroke: NX.steel, 'stroke-width': 1.4 }),
    neon(rect(-59, -57.5, 118, 19), NX.cy, null, 0.5),
    glow('猫咖', 13, -42, -43, NX.amber, NX.amberC),
    mono('CAFE', 8, -27, -44.5, NX.cyC),
    h('path', { d: 'M-3 -48l4 -3v6Z', fill: NX.acid }),
    h('path', { d: 'M-54 -18C-60 -12 -64 -6 -58 -2M54 -18C60 -12 64 -6 58 -2', fill: 'none', stroke: NX.steelHi, 'stroke-width': 1.6 }),
    h('path', { d: 'M-40 -22V-29M-20 -22V-29M0 -22V-29M20 -22V-29M40 -22V-29', stroke: NX.ink, 'stroke-width': 0.8 }));
  L.roadside += h('g', { 'data-ref': 'egg-bench', visibility: 'hidden', 'data-detail': 'land:O:egg-cat-bench' }, bench,
    h('g', { 'data-ref': 'egg-benchCat', transform: 'translate(22 -30)' }, h('use', { href: '#egg-catsit' }),
      // the clue: now and then the cat eyes your bell (a tiny HUD bubble: bell + ?)
      h('g', { 'data-ref': 'egg-benchClue', visibility: 'hidden', transform: 'translate(44 -100)' },
        h('path', { d: 'M-22 -14H22V10H4L-2 17L-4 10H-22Z', fill: NX.void, 'fill-opacity': 0.85, stroke: NX.acid, 'stroke-width': 1.2 }),
        neon(bellD, NX.amber, NX.amberC, 0.7, { transform: 'translate(-8 -1)' }),
        glow('?', 15, 10, 5, NX.acid, NX.acidC))),
    h('path', { d: 'M28 -34L34 -30M40 -32L44 -26', stroke: NX.ink, 'stroke-width': 1.2, 'stroke-linecap': 'round' }));
  L.front += h('g', { 'data-ref': 'egg-catJump', visibility: 'hidden' },
    h('g', { 'data-ref': 'egg-catLeap' }, catLeap()),
    h('g', { 'data-ref': 'egg-catPerch', visibility: 'hidden' }, h('use', { href: '#egg-catsit', transform: 'translate(0 30)' })),
    h('g', { 'data-ref': 'egg-catFish', visibility: 'hidden' }, fish(30)));
  L.front += gpop('popMeow', 'MEOW!', '喵！', 'SYS//CAT.EXE', '-1 FISH', NX.acid, NX.mag);

  // ---- 禁止鹈鹕 NO PELICANS lamp-post sign + doorbell (L-roadside, depth .9)
  const PEL_D = 'M-12 16C-13 8 -11 0 -8 -4C-10 -8 -8 -13 -3 -13C1 -13 3 -11 4 -9L22 -4L22 -2.5L5 -3C5 1 9 3 16 0C12 5 6 7 1 5C-1 7 -3 11 -2 16Z';
  const pelIcon = (c, core) => h('path', { d: PEL_D, fill: NX.plume, stroke: NX.void, 'stroke-width': 1 }) + h('path', { d: circ(-3, -9, 1.3), fill: NX.void }) + neon(PEL_D, c, core, 0.45);
  L.roadside += h('g', { 'data-ref': 'egg-sign', visibility: 'hidden', 'data-detail': 'land:O:egg-no-pelicans' },
    h('path', { d: 'M-60 2a60 8 0 1 0 120 0a60 8 0 1 0 -120 0Z', fill: 'url(#egg-glowR)' }),
    h('path', { d: 'M-5 0V-196H5V0Z', fill: NX.steel, stroke: NX.ink, 'stroke-width': 1.2 }),
    h('path', { d: 'M-5 -40H5M-5 -44H5M-5 -150H5', stroke: NX.steelHi, 'stroke-width': 1 }),
    h('path', { d: 'M-12 0H12L9 -8H-9Z', fill: NX.steelLo, stroke: NX.ink, 'stroke-width': 1 }),
    // doorbell box (the clue): 按铃 RING
    h('g', { 'data-ref': 'egg-signBell', transform: 'translate(0 -104)' },
      h('path', { d: rect(-18, -26, 36, 52), fill: NX.void, stroke: NX.steel, 'stroke-width': 1.6 }),
      h('path', { 'data-ref': 'egg-signBellGlow', d: circ(0, -8, 16), fill: 'url(#egg-glowA)' }),
      neon(bellD, NX.amber, NX.amberC, 0.8, { transform: 'translate(0 -9)' }),
      glow('按铃', 9, 0, 10, NX.acid, NX.acidC),
      mono('RING', 7, 0, 20, NX.acidC, 'middle')),
    // the sign box
    h('g', { transform: 'translate(0 -232)' },
      h('path', { d: 'M-4 34V46M4 34V46', stroke: NX.steelHi, 'stroke-width': 1.4 }),
      h('path', { d: rect(-100, -36, 200, 72), fill: NX.void, stroke: NX.steel, 'stroke-width': 2.4 }),
      h('path', { d: rect(-96, -32, 192, 64), fill: NX.night }),
      h('path', { d: 'M-100 -36l8 -6h184l8 6', fill: NX.steelLo, stroke: NX.ink, 'stroke-width': 1 }),
      mono('ORDINANCE 0719 · 霓虹区', 6, 0, -40.5, NX.steelHi, 'middle'),
      h('g', { 'data-ref': 'egg-signNo' },
        h('path', { d: circ(-62, 0, 34), fill: 'url(#egg-glowR)' }),
        h('g', { transform: 'translate(-64 0)' }, pelIcon(NX.red, null)),
        neon(circ(-62, 0, 24) + 'M-79 -17L-45 17', NX.red, NX.redC, 1.1),
        glow('禁止鹈鹕', 26, 26, 4, NX.red, NX.redC),
        mono('NO PELICANS', 11, 26, 22, NX.redC, 'middle'),
        neon(rect(-94, -30, 188, 60), NX.red, null, 0.45)),
      h('g', { 'data-ref': 'egg-signYes', visibility: 'hidden' },
        h('path', { d: circ(-62, 0, 34), fill: 'url(#egg-glowA)' }),
        neon(circ(-62, 0, 24), NX.acid, NX.acidC, 1.1),
        h('g', { transform: 'translate(-64 0)' }, pelIcon(NX.acid, null)),
        neon(heart(1.1), NX.mag, NX.magC, 0.8, { transform: 'translate(-48 -13)' }),
        glow('欢迎鹈鹕', 26, 26, 4, NX.acid, NX.acidC),
        mono('PELICANS WELCOME', 9.6, 26, 22, NX.acidC, 'middle'),
        neon(rect(-94, -30, 188, 60), NX.acid, null, 0.45)),
      h('g', { 'data-ref': 'egg-signHearts', visibility: 'hidden' }, [0, 1, 2, 3, 4].map(i => h('g', { 'data-ref': 'egg-sh' + i }, neon(heart(1.5 + 0.35 * (i % 3)), i % 2 ? NX.mag : NX.acid, NX.white, 0.9))))));

  // ---- puddles (L-road, depth 1): black water carrying the city's neon
  L.road += h('g', { 'data-ref': 'egg-puddle', visibility: 'hidden' },
    h('path', { d: 'M-150 2C-140 -12 -60 -16 0 -14C70 -16 150 -10 156 2C150 16 60 18 0 16C-70 18 -150 14 -150 2Z', fill: NX.void, 'fill-opacity': 0.92, stroke: NX.steel, 'stroke-width': 1.4 }),
    neon('M-110 -2H-40M-20 -6H60', NX.mag, NX.magC, 0.7),
    neon('M80 0H130M-70 7H10', NX.cy, NX.cyC, 0.7),
    neon('M40 5H110M-130 -8H-100', NX.amber, null, 0.6),
    h('path', { d: 'M-146 1C-136 -10 -60 -13 0 -12C68 -13 146 -8 152 1', fill: 'none', stroke: NX.cyC, 'stroke-width': 0.8, opacity: 0.5 }));
  // splash crowns + drops (L-fx-front)
  const crown = h('path', { d: 'M-40 0C-36 -16 -30 -26 -34 -40C-24 -28 -20 -22 -16 -34C-12 -22 -6 -18 0 -46C6 -18 12 -22 16 -34C20 -22 24 -28 34 -40C30 -26 36 -16 40 0Z', fill: NX.plume, 'fill-opacity': 0.85, stroke: NX.cy, 'stroke-width': 1.6, 'stroke-linejoin': 'round' })
    + h('path', { d: 'M-24 -6C-22 -14 -18 -20 -16 -26M8 -8C10 -18 12 -24 16 -30', stroke: NX.mag, 'stroke-width': 1.6, fill: 'none', 'stroke-linecap': 'round' });
  let drops = '';
  for (let i = 0; i < 10; i++) drops += h('path', { 'data-ref': 'egg-dr' + i, d: 'M0 -7C3 -3 4 0 4 2A4 4 0 0 1 -4 2C-4 0 -3 -3 0 -7Z', fill: i % 3 ? NX.cyC : NX.magC, stroke: i % 3 ? NX.cy : NX.mag, 'stroke-width': 1.2 });
  L.front += h('g', { 'data-ref': 'egg-splash', visibility: 'hidden' }, h('g', { 'data-ref': 'egg-crownR' }, crown), h('g', { 'data-ref': 'egg-crownF' }, crown), drops);
  L.front += gpop('popSplash', 'SPLASH!', '哗啦！', 'SYS//H2O.EXE', 'WET 100%', NX.cy, NX.cy);

  // ---- milestone holo-billboards + data-bit confetti (L-fx-front)
  const poster = (ref, big, l2, l3, bigC, bigCore) => {
    const w = 290, hh = 178;
    let ticks = '';
    for (let i = 0; i < 36; i++) { const a = i / 36 * TAU, r0 = i % 3 ? 52 : 47; ticks += `M${f(Math.cos(a) * r0)} ${f(8 + Math.sin(a) * r0)}L${f(Math.cos(a) * 56)} ${f(8 + Math.sin(a) * 56)}`; }
    let grid = '';
    for (let x = -w / 2 + 20; x < w / 2; x += 20) grid += `M${f(x)} ${f(-hh / 2 + 30)}V${f(hh / 2 - 26)}`;
    for (let y = -hh / 2 + 30; y < hh / 2 - 24; y += 20) grid += `M${f(-w / 2 + 6)} ${f(y)}H${f(w / 2 - 6)}`;
    return h('g', { 'data-ref': 'egg-' + ref, visibility: 'hidden' }, h('g', { 'data-ref': `egg-${ref}In` },
      h('path', { d: `M-26 ${hh / 2}H26L70 ${hh / 2 + 130}H-70Z`, fill: 'url(#egg-coneG)' }),
      h('path', { d: chamf(w, hh, 14), fill: 'url(#egg-holoG)' }),
      hud(w, hh, NX.cy, { alpha: 0.5, c: 14 }),
      h('path', { d: grid, stroke: NX.cy, 'stroke-width': 0.6, opacity: 0.18 }),
      h('path', { d: ticks, stroke: NX.cy, 'stroke-width': 1.2, opacity: 0.65 }),
      neon(circ(0, 8, 44), NX.mag, null, 0.5, { 'stroke-dasharray': '4 6' }),
      h('path', { d: rect(-w / 2 + 10, -hh / 2 + 8, w - 20, 18), fill: NX.cy, opacity: 0.85 }),
      mono(l2, 10, 0, -hh / 2 + 21, NX.void, 'middle'),
      h('g', { 'data-ref': `egg-${ref}Big` }, (() => { const d = text(big, 50, 0, 26).d; return [h('path', { d, fill: 'none', stroke: bigC, 'stroke-width': 11, opacity: 0.18, 'stroke-linejoin': 'round' }), h('path', { d, fill: NX.cy, transform: 'translate(-3 0)', opacity: 0.8 }), h('path', { d, fill: NX.mag, transform: 'translate(3 0)', opacity: 0.8 }), h('path', { d, fill: bigCore, stroke: bigC, 'stroke-width': 2, 'paint-order': 'stroke' })].join(''); })()),
      mono(l3, 9, 0, hh / 2 - 12, NX.acidC, 'middle'),
      eggIcon(w / 2 - 22, hh / 2 - 36, 0.6)));
  };
  L.front += poster('posterKm', '1 KM!', '一公里 · ONE KILOMETRE', 'PELICAN EXPRESS · ON TIME 准点', NX.acid, NX.acidC);
  L.front += poster('poster42', '42!', "别慌 · DON'T PANIC", 'THE ANSWER · 4.2 KM · 生命、宇宙以及一切', NX.amber, NX.amberC);
  let conf = '';
  const CI = [NX.mag, NX.cy, NX.acid, NX.amber, NX.violet, NX.cyC];
  const bit0 = text('0', 13, 0, 5, { font: 'mono' }).d, bit1 = text('1', 13, 0, 5, { font: 'mono' }).d;
  for (let i = 0; i < 28; i++) {
    const k = i % 4, c = CI[i % CI.length];
    const d = k === 0 ? 'M-5 -5H5V5H-5Z' : k === 1 ? 'M-6 -1.6H6V1.6H-6ZM-1.6 -6H1.6V6H-1.6Z' : k === 2 ? bit0 : k === 3 && i % 8 === 3 ? bit1 : 'M0 -6L6 5H-6Z';
    conf += h('path', { 'data-ref': 'egg-cf' + i, d, fill: c });
  }
  L.front += h('g', { 'data-ref': 'egg-confetti', visibility: 'hidden' }, conf);

  // ---- velocipedia chain (rider-attached, L-fx-front): chrome links, sparks at the jammed hub
  const ringC = BIKE.bb, hub = BIKE.frontHub, rr = 30, rh = 11;
  const dx = hub[0] - ringC[0], dy = hub[1] - ringC[1], dist = Math.hypot(dx, dy), a0 = Math.atan2(dy, dx), beta = Math.acos((rr - rh) / dist);
  const tp = (c, r, a) => [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r];
  const [p1, p2, p3, p4] = [tp(ringC, rr, a0 - beta), tp(hub, rh, a0 - beta), tp(hub, rh, a0 + beta), tp(ringC, rr, a0 + beta)];
  const chainD = `M${f(p1[0])} ${f(p1[1])}L${f(p2[0])} ${f(p2[1])}A${rh} ${rh} 0 0 1 ${f(p3[0])} ${f(p3[1])}L${f(p4[0])} ${f(p4[1])}A${rr} ${rr} 0 1 1 ${f(p1[0])} ${f(p1[1])}Z`;
  let cog = '';
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; cog += poly([tp(hub, 10, a - 0.16), tp(hub, 14, a - 0.1), tp(hub, 14, a + 0.1), tp(hub, 10, a + 0.16)]); }
  let links = '';
  for (let i = 0; i < 8; i++) links += h('path', { 'data-ref': 'egg-lk' + i, d: 'M-5 -2.5H5A2.5 2.5 0 0 1 5 2.5H-5A2.5 2.5 0 0 1 -5 -2.5Z', fill: NX.chrome, stroke: NX.ink, 'stroke-width': 1.2 });
  let sparks = '';
  for (let i = 0; i < 9; i++) { const a = (-150 + i * 26) * D2R, r0 = 16 + 4 * hash(i, 3), r1 = r0 + 10 + 14 * hash(i, 4); sparks += `M${f(hub[0] + Math.cos(a) * r0)} ${f(hub[1] + Math.sin(a) * r0)}L${f(hub[0] + Math.cos(a) * r1)} ${f(hub[1] + Math.sin(a) * r1)}`; }
  // mech suit (egg #1): rider-space HUD (lock-on reticle, protocol line, scan ring, joint sparks, hero rays)
  const protoD = text('MECH PROTOCOL 鹈鹕-01 · ENGAGE', 13, 0, 0, { align: 'start', track: 0, font: 'mono' });
  defs += h('clipPath', { id: 'egg-mkTypeClip' }, h('path', { 'data-ref': 'egg-mkType', d: rect(-6, -18, 1, 26) }));
  L.back = h('g', { 'data-ref': 'egg-riderB' }, MECH.back);
  L.front += h('g', { 'data-ref': 'egg-riderF' }, MECH.fx,
    h('g', { 'data-ref': 'egg-mkProto', display: 'none', transform: 'translate(-236 -632)' },
      h('path', { d: rect(-6, -18, protoD.w + 12, 26), fill: NX.void, 'fill-opacity': 0.72 }),
      h('path', { d: rect(-6, -18, 4, 26), fill: NX.acid }),
      h('g', { 'clip-path': 'url(#egg-mkTypeClip)' }, h('path', { d: protoD.d, fill: 'none', stroke: NX.cy, 'stroke-width': 3, opacity: 0.35 }), h('path', { d: protoD.d, fill: NX.cyC }))),
    h('g', { 'data-ref': 'egg-velo', visibility: 'hidden' },
      h('g', { 'data-ref': 'egg-veloChain' },
        h('path', { d: circ(hub[0], hub[1], 11) + cog, fill: NX.chrome, stroke: NX.ink, 'stroke-width': 1.2 }),
        h('path', { d: circ(hub[0], hub[1], 4), fill: NX.ink }), h('path', { d: circ(hub[0], hub[1], 1.6), fill: NX.mag }),
        h('path', { d: chainD, fill: 'none', stroke: NX.ink, 'stroke-width': 5.4, 'stroke-linejoin': 'round' }),
        h('path', { d: chainD, fill: 'none', stroke: NX.chrome, 'stroke-width': 2.4, 'stroke-dasharray': '3.4 2.2' }),
        h('path', { d: chainD, fill: 'none', stroke: NX.mag, 'stroke-width': 0.7, opacity: 0.8 }),
        h('g', { 'data-ref': 'egg-veloSpark' }, neon(sparks, NX.amber, NX.amberC, 0.7)),
        neon('M150 -120L160 -132M196 -120L186 -132M150 -80L160 -68M196 -80L186 -68', NX.red, NX.redC, 0.9)),
      h('g', { 'data-ref': 'egg-veloLinks' }, links),
      h('g', { 'data-ref': 'egg-veloQ', transform: 'translate(-30 -515)' }, chroma(text('?!', 60, 0, 0).d, 3.5), mono('ERR 0x6E', 9, 0, 16, NX.red, 'middle'))),
    // 888: glints running over the golden suit
    h('g', { 'data-ref': 'egg-goldGlint', visibility: 'hidden' }, [[-70, -372], [-6, -408], [44, -350], [-34, -318], [30, -300]].map(([x, y], i) =>
      h('path', { 'data-ref': 'egg-gg' + i, d: star4(9, 1.8), fill: '#FFF6D0', stroke: NX.amber, 'stroke-width': 0.8, transform: `translate(${x} ${y})` }))),
    // UFO's fish lives in rider space too
    h('g', { 'data-ref': 'egg-ufoFish', visibility: 'hidden' }, fish(32)),
    // HACK: the one real thing in the simulation gets a target box
    h('g', { 'data-ref': 'egg-hackBox', visibility: 'hidden' },
      h('path', { d: 'M-280 -330H280V330H-280Z', fill: 'none', stroke: NX.acid, 'stroke-width': 0.8, 'stroke-dasharray': '3 9', opacity: 0.7, transform: 'translate(20 -300)' }),
      h('g', { transform: 'translate(20 -300)' }, brackets(560, 620, NX.acid, 34, 0)),
      h('g', { transform: 'translate(-252 -578)' },
        h('path', { d: rect(0, -16, 318, 22), fill: NX.acid }),
        mono('USER 鹈鹕 #0719 · 真实 REAL · NOT A VECTOR', 11, 8, 0, NX.void))));
  L.front += gpop('popSnap', 'SNAP!', '断！', 'ERR//CHAIN.SYS', 'LINK LOST', NX.red, NX.red);

  // ---- UFO (L-fx-front, world): chrome saucer, chasing rim lights, a cyan tractor beam with scan rings
  let beam = '';
  const bw = [[70, 150], [52, 110], [30, 70]], bOp = [0.12, 0.16, 0.22];
  bw.forEach(([t0, b0], i) => { beam += h('path', { d: `M${-t0 / 2} 0L${t0 / 2} 0L${b0} 270L${-b0} 270Z`, fill: i === 2 ? NX.cyC : NX.cy, opacity: bOp[i] }); });
  L.front += h('g', { 'data-ref': 'egg-ufo', visibility: 'hidden' },
    h('g', { 'data-ref': 'egg-ufoBeam', transform: 'translate(0 12)' }, beam,
      h('path', { d: 'M-35 0L-150 270M35 0L150 270', stroke: NX.cy, 'stroke-width': 1.2, opacity: 0.7 }),
      [0, 1, 2].map(k => h('path', { 'data-ref': 'egg-ufoRing' + k, d: 'M-1 0a1 0.22 0 1 0 2 0a1 0.22 0 1 0 -2 0Z', fill: 'none', stroke: NX.cyC, 'stroke-width': 1.6, 'vector-effect': 'non-scaling-stroke' }))),
    h('g', { 'data-ref': 'egg-ufoBody' },
      h('path', { d: 'M0 -40V-54', stroke: NX.steelHi, 'stroke-width': 2 }), h('path', { 'data-ref': 'egg-ufoTip', d: circ(0, -56, 4), fill: NX.red, stroke: NX.ink, 'stroke-width': 1.2 }),
      h('path', { d: circ(0, -56, 10), fill: 'url(#egg-glowR)' }),
      h('path', { d: 'M-34 -12C-34 -34 -18 -42 0 -42C18 -42 34 -34 34 -12Z', fill: '#0E4A5A', 'fill-opacity': 0.8, stroke: NX.cy, 'stroke-width': 1.6 }),
      h('path', { d: 'M-22 -18C-22 -30 -12 -36 -2 -36', fill: 'none', stroke: NX.cyC, 'stroke-width': 2.6, 'stroke-linecap': 'round' }),
      // the pilot: acid-green, big eyes, a tiny cyan visor
      h('path', { d: 'M-9 -14C-10 -28 -5 -32 0 -32C5 -32 10 -28 9 -14Z', fill: '#8EE04A', stroke: NX.ink, 'stroke-width': 1.2 }),
      h('path', { d: 'M-6 -24C-6 -27 -2 -27 -1.5 -24C-2 -21.5 -5 -21.5 -6 -24ZM6 -24C6 -27 2 -27 1.5 -24C2 -21.5 5 -21.5 6 -24Z', fill: NX.void }),
      h('path', { d: 'M-8 -27.5H8', stroke: NX.cy, 'stroke-width': 1.4 }),
      h('path', { d: 'M-80 0C-60 -18 60 -18 80 0C60 16 -60 16 -80 0Z', fill: NX.steel, stroke: NX.ink, 'stroke-width': 2 }),
      h('path', { d: 'M-72 -4C-50 -14 50 -14 72 -4', fill: 'none', stroke: NX.chromeHi, 'stroke-width': 1.6, opacity: 0.7 }),
      neon('M-78 0C-58 8 58 8 78 0', NX.mag, NX.magC, 1.1),
      h('path', { d: 'M-60 6C-40 20 40 20 60 6C40 14 -40 14 -60 6Z', fill: NX.steelLo, stroke: NX.ink, 'stroke-width': 1.4 }),
      h('path', { d: 'M-40 14a40 5 0 1 0 80 0a40 5 0 1 0 -80 0Z', fill: 'url(#egg-glowC)' }),
      [0, 1, 2].map(k => h('path', { 'data-ref': 'egg-ufoL' + k, d: [-50, -25, 0, 25, 50].filter((_, j) => j % 3 === k || (k === 2 && j === 4)).map(x => circ(x, -6, 3.6)).join(''), fill: [NX.cyC, NX.acid, NX.magC][k], stroke: [NX.cy, NX.acid, NX.mag][k], 'stroke-width': 1.6 }))),
    h('g', { 'data-ref': 'egg-ufoLines', visibility: 'hidden' }, neon('M100 -10H170M110 4H200M96 18H150', NX.cy, NX.cyC, 1)));
  L.front += gpop('popBleep', 'BLEEP?', '哔哔？', 'UNKNOWN//SIGNAL', '?? ?? ??', NX.acid, NX.violet);

  // ---- gull chorus (L-fx-front)
  let ch = '';
  for (let i = 0; i < 5; i++) {
    const word = i % 2 ? '嘎！' : 'KAW!', ww = text(word, i % 2 ? 17 : 14, 0, 0).w + 16;
    ch += h('g', { 'data-ref': 'egg-g' + i }, gull('egg-g' + i),
      h('g', { 'data-ref': `egg-g${i}Kaw`, visibility: 'hidden', transform: 'translate(52 -34)' },
        h('path', { d: `M${f(-ww / 2)} -13H${f(ww / 2)}V11H-4L-12 18L-12 11H${f(-ww / 2)}Z`, fill: NX.void, 'fill-opacity': 0.85, stroke: i % 2 ? NX.mag : NX.cy, 'stroke-width': 1.3 }),
        h('path', { d: `M${f(-ww / 2)} -13H${f(ww / 2)}V11H-4L-12 18L-12 11H${f(-ww / 2)}Z`, fill: 'none', stroke: i % 2 ? NX.mag : NX.cy, 'stroke-width': 4, opacity: 0.2 }),
        glow(word, i % 2 ? 17 : 14, 0, 5, i % 2 ? NX.mag : NX.cy, NX.white)));
  }
  L.front += h('g', { 'data-ref': 'egg-chorus', visibility: 'hidden' }, ch,
    h('g', { 'data-ref': 'egg-chNotes' }, neon('M0 0A5.6 4 -20 1 1 -0.1 0.1ZM4.6 -2.4V-24C8 -21 12 -19 12.4 -13', NX.acid, NX.acidC, 0.9)));

  // ---- HACK overlay (L-fx-front, screen-anchored): breach banner with live scene statistics + a scanning bar
  const bw2 = 660, bh2 = 96;
  L.front += h('g', { 'data-ref': 'egg-hack', visibility: 'hidden' },
    h('g', { 'data-ref': 'egg-hackScan' },
      h('path', { d: rect(-1200, -70, 2400, 70), fill: 'url(#egg-scanG)' }),
      h('path', { d: rect(-1200, -1.5, 2400, 3), fill: NX.acid }),
      mono('SCANNING // 扫描中', 9, -1180 + 1200 - 780, -6, NX.acid)),
    h('g', { 'data-ref': 'egg-hackBanner' }, h('g', { 'data-ref': 'egg-hackIn' },
      hud(bw2, bh2, NX.acid, { alpha: 0.86 }),
      h('path', { d: rect(-bw2 / 2 + 10, -bh2 / 2 + 8, bw2 - 20, 20), fill: NX.acid }),
      h('path', { d: 'M0 -9L9 7H-9Z', fill: 'none', stroke: NX.void, 'stroke-width': 2, 'stroke-linejoin': 'round', transform: `translate(${-bw2 / 2 + 24} ${-bh2 / 2 + 19}) scale(0.9)` }),
      mono('SYSTEM BREACH // 系统骇入 · ROOT ACCESS GRANTED', 10.5, -bw2 / 2 + 40, -bh2 / 2 + 22, NX.void),
      mono('EGG ' + String(EGGS.findIndex(e => e.id === 'hack') + 1).padStart(2, '0') + '/' + EGGS.length, 10.5, bw2 / 2 - 18, -bh2 / 2 + 22, NX.void, 'end'),
      glow('城市只是矢量 · THE CITY IS ONLY VECTORS', 22, 0, 10, NX.cy, NX.cyC),
      h('path', { 'data-ref': 'egg-hackStats', d: '', fill: NX.acidC }))));

  return {
    defs,
    overlay: MECH.overlay,
    layers: {
      'L-fx-back': L.back,
      'L-gulls-far': L.gulls, 'L-stars': L.stars, 'L-clouds': L.clouds, 'L-sea': L.sea,
      'L-roadside': L.roadside, 'L-road': L.road, 'L-fx-front': L.front,
    },
  };
}

// ------------------------------------------------------------------------------------------------ schedules (pure)
const BENCH = { P: 34000, X0: 15600, d: 0.9 };       // roadside coords
const SIGN = { P: 34000, X0: 32600, d: 0.9 };        // roadside coords, half a period after the bench
const PUDDLE = { P: 21000, X0: 30000 };              // road coords
const BOTTLE = { P: 2700, X0: 2100, d: 0.1, y: 526 }; // sea coords
const nearest = (S, dd) => { const k = Math.max(0, Math.round((dd - S.X0 + 800) / S.P)); return [k, S.X0 + k * S.P - dd]; };
export const benchAt = distance => nearest(BENCH, distance * BENCH.d);
export const signAt = distance => nearest(SIGN, distance * SIGN.d);
export const puddleAt = distance => nearest(PUDDLE, distance);
export const bottleAt = (distance, t) => { const [k, x] = nearest(BOTTLE, distance * BOTTLE.d); return [k, x + 8 * Math.sin(t * 0.4 + k)]; };
// shooting stars: 20 s slots; ~85 % of the slots carry one 1.3 s meteor (night only), head moving down-left
const SHOOT = { P: 20, dur: 1.3, v: 520 };
export function shootAt(t) {
  const k = Math.floor(t / SHOOT.P), q = k * 7919 + 13;
  if (hash(q, 77) > 0.85) return null;
  const s0 = k * SHOOT.P + 2 + hash(q, 78) * 14, u = t - s0;
  if (u < 0 || u > SHOOT.dur) return null;
  const x0 = 560 + hash(q, 79) * 900, y0 = 60 + hash(q, 80) * 140;
  return { k, u, x: x0 - SHOOT.v * u, y: y0 + SHOOT.v * 0.32 * u, o: sstep(0, 0.15, u) * (1 - sstep(0.8, SHOOT.dur, u)) };
}
const KM_UNITS = 1000 / (0.34 / BIKE.R);
const STG0 = 0.32;                                   // the rewind is over once the suit is back to its seeds            // odometer: wheel R = 100 units ≈ 0.34 m (as ui.js)

// ------------------------------------------------------------------------------------------------ attach
let inst = null;
export function attach(svg, ctx) {
  const r = refs(svg, 'egg-');
  const st = new WeakMap();    // last written attribute values per element (write only on change)
  const set = (el, k, val) => { let m = st.get(el); if (!m) st.set(el, m = {}); if (m[k] !== val) { m[k] = val; el.setAttribute(k, val); } };
  const vis = (el, on) => set(el, 'visibility', on ? 'inherit' : 'hidden');   // 'inherit': a shown child never overrides a hidden egg group
  const cls = {};
  const klass = (name, on) => { if (cls[name] !== on) { cls[name] = on; svg.classList.toggle(name, on); } };
  const reduced = ctx.reduced;
  const E = {};                  // id -> { t0, ...params }
  const found = new Set();
  const welcomed = new Set();    // sign instances that have been rung
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
  let brown = false, gold = false, mech = false, onMech = () => {};
  const mk = attachMech(r, set, reduced);
  const riderEl = svg.querySelector('#rider');
  let pulsed = false;
  let hackSheets = null;         // sheets jittered during the HACK glitch (queried when it starts)
  const hackTr = new Map();

  // live detectors -------------------------------------------------------------
  const api = {
    start, E, found, welcomed, get brown() { return brown; }, get gold() { return gold; }, get mech() { return mech; },
    // the suit: on = assemble from now; off = rewind from wherever the assembly is (instant when stop = true)
    setMech(on, stop = false) {
      if (on === mech && !stop) return;
      mech = on;
      const now = lastFrame ? lastFrame.t : 0, pr = mechProgress(E.mech, now);
      if (on && pr && pr.rev && pr.a > 0) { E.mech = { t0: now - pr.a }; markFound('mech'); }   // re-armed mid-rewind: grow back from here
      else if (on) start('mech');
      else if (E.mech) { if (stop) delete E.mech; else E.mech.off = lastFrame ? lastFrame.t : 0; }
      onMech(on, stop, E.mech ? E.mech.t0 : undefined);
    },
    onMech(fn) { onMech = fn; },
    setBrown(on) { brown = on; klass('egg-brown', on); if (on) start('brown'); },
    setGold(on) { gold = on; klass('egg-gold', on); if (on) start('gold'); },
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
  // the visible part of the viewBox (the stage slices it on portrait phones): screen cards re-anchor and shrink to fit
  let aspect = 16 / 9;
  const measure = () => { const w = svg.clientWidth, hh = svg.clientHeight; if (w && hh) aspect = w / hh; };
  measure();
  try { svg.ownerDocument.defaultView.addEventListener('resize', measure); } catch (e) { /* no window (node) */ }
  const visW = () => (aspect < 16 / 9 ? 900 * aspect : 1600);
  // wide: the given screen point; narrow (portrait): centred, under the top HUD, stacked by (y - 190)
  const anchor = (w, x, y) => aspect >= 1.25 ? [x, y, 1] : [800, 345 + (y - 190) * 0.8, Math.min(1, (visW() - 20) / w)];
  const clampW = (fr, x, m) => { const c = fr.cam || { zoom: 1, fx: 800 }, hw = visW() / 2 / (c.zoom || 1); return clamp(x, c.fx - hw + m, Math.max(c.fx - hw + m, c.fx + hw - m)); };
  api.visW = visW; api.aspect = () => aspect;
  // screen-card entrance: overshoot scale-in, a stepped horizontal glitch jitter for the first 0.3 s, fade out
  const glitchX = (u, seed) => (reduced || u > 0.3 ? 0 : (hash(Math.floor(u * 30), seed) - 0.5) * 36 * (1 - u / 0.3));

  return {
    update(fr) {
      lastFrame = fr;
      const t = fr.t, D = fr.distance;
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
      // ---- mech suit (egg #1): progress is a pure function of (t − t0) and of the rewind start
      const ms = mechProgress(E.mech, t);
      if (ms && ms.rev && ms.a < STG0) { delete E.mech; }
      mk.update(fr, E.mech ? ms : null);
      // hero beat: a short push-in pulse of the whole rider (scaled about the road contact, so the tyres stay down)
      const pu = ms && !ms.rev && !reduced ? sstep(MK.power, MK.power + 0.16, ms.a) * (1 - sstep(MK.power + 0.3, MK.hero + 0.1, ms.a)) : 0;
      const [rcx, rcy] = BIKE.rearContact;
      const base = `translate(${RIDER_X} ${(GROUND_Y + fr.pose.riderY).toFixed(2)}) rotate(${fr.pose.bikePitch.toFixed(3)} ${rcx} ${rcy})`;
      const pulse = pu > 0.001 ? ` translate(24 0) scale(${(1 + 0.045 * pu).toFixed(4)}) translate(-24 0)` : '';
      if (riderEl && (pulse || pulsed)) set(riderEl, 'transform', base + pulse);
      pulsed = !!pulse;
      set(r.riderF, 'transform', riderXf(fr) + pulse);
      if (E.mech) set(r.riderB, 'transform', riderXf(fr) + pulse);   // (dormant: no write, so the back fx sheet never repaints for it)
      {
        const a = ms ? ms.a : -1, on = !!ms && !ms.rev && a >= 0.08 && a < 1.25;
        set(r.mkProto, 'display', on ? 'inline' : 'none');
        if (on) { set(r.mkType, 'd', rect(-6, -18, 12 + 330 * clamp((a - 0.08) / 0.3, 0, 1), 26)); set(r.mkProto, 'opacity', f2(1 - sstep(1.0, 1.25, a))); }
      }

      // ---- HUD cards (upper left): brown / velo / gold
      const capAnim = (el, k, x, y) => {
        const u = tau(k, t), on = u >= 0 && u < DUR[k];
        vis(el, on); if (!on) return;
        const s = reduced ? 1 : easeOutBack(clamp(u / 0.35, 0, 1)), o = 1 - sstep(DUR[k] - 0.4, DUR[k], u);
        const [ax, ay, as] = anchor(470, x, y), [wx, wy, iz] = scr(fr, ax, ay);
        set(el, 'transform', `translate(${f(wx + glitchX(u, 3) * iz)} ${f(wy)}) scale(${f2(iz * as)})`); set(el, 'opacity', f2(o));
        set(r[el.getAttribute('data-ref').slice(4) + 'In'], 'transform', `scale(${f2(Math.max(0.01, s))} ${f2(Math.max(0.01, Math.min(1, s * 1.4)))})`);
      };
      capAnim(r.capBrown, 'brown', 350, 190);
      {   // MECH ONLINE card: in at the hero beat (3.2 s), out ~3 s later
        const u = ms && !ms.rev ? ms.a - MK.power : -1, on = u >= 0 && u < 3.2, el = r.capMech;
        vis(el, on);
        if (on) {
          const sc = reduced ? 1 : easeOutBack(clamp(u / 0.35, 0, 1)), o = 1 - sstep(2.8, 3.2, u);
          const [ax, ay, as] = anchor(470, 350, 190), [wx, wy, iz] = scr(fr, ax, ay);
          set(el, 'transform', `translate(${f(wx + glitchX(u, 5) * iz)} ${f(wy)}) scale(${f2(iz * as)})`); set(el, 'opacity', f2(o));
          set(r.capMechIn, 'transform', `scale(${f2(Math.max(0.01, sc))} ${f2(Math.max(0.01, Math.min(1, sc * 1.4)))})`);
        }
      }
      capAnim(r.capVelo, 'velo', 350, 190);
      const ub = tau('brown', t);
      const um = ms && !ms.rev ? ms.a - MK.power : -1;
      capAnim(r.capGold, 'gold', 350, (ub >= 0 && ub < DUR.brown) || (um >= 0 && um < 3.2) ? 316 : 190);
      vis(r.goldGlint, gold && !reduced);
      if (gold && !reduced) for (let i = 0; i < 5; i++) {
        const p = wrap(t * 0.7 + i * 0.37, 1.6), s = p < 0.5 ? Math.sin(Math.PI * p / 0.5) : 0;
        vis(r['gg' + i], s > 0.05);
        if (s > 0.05) set(r['gg' + i], 'transform', `translate(${[-70, -6, 44, -34, 30][i]} ${[-372, -408, -350, -318, -300][i]}) rotate(${f(p * 90)}) scale(${f2(s)})`);
      }

      // ---- sun / moon wink
      const faceAnim = (el, k, pos, pfx) => {
        const u = tau(k, t), on = u >= 0 && u < DUR[k];
        vis(el, on); if (!on) return;
        const o = sstep(0, 0.25, u) * (1 - sstep(DUR[k] - 0.4, DUR[k], u));
        // depth 0 -> depth .15 (core/camera.js layerTransform: same zoom, x shifted by .15·(fx − 800))
        set(el, 'transform', `translate(${f(pos.x + 0.15 * (((fr.cam && fr.cam.fx) ?? 800) - 800))} ${f(pos.y)})`); set(el, 'opacity', f2(o));
        const shut = (u > 0.6 && u < 1.05) || (u > 1.35 && u < 1.55);
        vis(r[pfx + 'Open'], !shut); vis(r[pfx + 'Shut'], shut);
        const sp = sstep(0.62, 0.8, u) * (1 - sstep(1.1, 1.4, u));
        vis(r[pfx + 'Spark'], sp > 0.02);
        if (sp > 0.02) set(r[pfx + 'Spark'], 'transform', `translate(64 -40) rotate(${f(u * 90)}) scale(${f2(sp)})`);
        if (r[pfx + 'Shades']) {
          const drop = reduced ? 0 : (1 - easeOutBack(clamp((u - 0.05) / 0.35, 0, 1))) * -120;
          set(r[pfx + 'Shades'], 'transform', `translate(0 ${f(drop)})`);
          const lift = shut ? -16 : 0;   // the right lens tips up to show the wink
          set(r[pfx + 'Lift'], 'transform', `rotate(${lift} -46 -19)`);
        }
      };
      faceAnim(r.sunFace, 'sunwink', fr.sun, 'sunFace');
      faceAnim(r.moonFace, 'moonwink', fr.moon, 'moonFace');

      // ---- shooting star (night) + wish
      {
        const s = (fr.night > 0.5 && !reduced) ? shootAt(t) : null;
        vis(r.shoot, !!s);
        api.shoot = s ? { x: s.x, y: s.y, t } : api.shoot;
        if (s) { set(r.shoot, 'transform', `translate(${f(s.x)} ${f(s.y)})`); set(r.shoot, 'opacity', f2(s.o)); }
        const u = tau('wish', t), on = u >= 0 && u < DUR.wish;
        vis(r.wish, on);
        if (on) {
          const p = E.wish;
          const sc = reduced ? 1 : easeOutBack(clamp(u / 0.3, 0, 1));
          set(r.wish, 'transform', `translate(${f(p.x)} ${f(p.y)}) scale(${f2(Math.max(0.01, sc) * 1.35)})`);
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
          set(r.bottleLed, 'opacity', Math.floor(t * 1.5) % 2 ? '1' : '0.3');
          const gp = t % 22, gOn = !fr.reduced && gp < 0.9;
          vis(r.bottleGlint, gOn);
          if (gOn) set(r.bottleGlint, 'transform', `translate(-12 -11) scale(${f2(0.25 + Math.sin(Math.PI * gp / 0.9))}) translate(12 11)`);
        }
        const u = tau('bottle', t), on = u >= 0 && u < DUR.bottle;
        vis(r.note, on);
        if (on) {
          const p = E.bottle;
          set(r.note, 'transform', `translate(${f(p.nx + glitchX(u, 9))} ${f(p.ny)}) scale(${f2(p.ns || 1)})`);
          const sy = reduced ? 1 : easeOutBack(clamp(u / 0.45, 0, 1));
          set(r.noteIn, 'transform', `scale(${f2(clamp(u / 0.2, 0.1, 1))} ${f2(Math.max(0.02, sy))})`);
          const flick = !reduced && u < 0.5 && hash(Math.floor(u * 24), 4) < 0.35;
          set(r.note, 'opacity', f2((flick ? 0.35 : 1) * (1 - sstep(DUR.bottle - 0.5, DUR.bottle, u))));
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
          // idle: head tilts toward the rider as it approaches, tail swishes; now and then it eyes the bell
          const look = clamp((RIDER_X - bx) / 900, -1, 1);
          set(r.csHead, 'transform', `translate(14 -50) rotate(${f(look * 8 + 3 * Math.sin(t * 1.3))})`);
          set(r.csTail, 'transform', `rotate(${f(reduced ? 0 : 10 * Math.sin(t * 2.4))} -18 -8)`);
          vis(r.csEyes, wrap(t, 3.1) > 0.12);
          vis(r.benchClue, !gone && bx > 700 && bx < 1500 && wrap(t, 4) < 2.2);
        }
        vis(r.catJump, jumping);
        if (jumping) {
          const p = E.cat, basket = [RIDER_X + 172, GROUND_Y + fr.pose.riderY - 300];
          let x, y, pose = 'leap', flip = 1, rot = 0;
          const bench = [p.x0 + 40, 700];
          if (u < 0.5) { const s = sstep(0, 0.5, u); x = lerp(bench[0], basket[0], s); y = lerp(bench[1], basket[1], s) - 180 * Math.sin(Math.PI * s); flip = basket[0] >= bench[0] ? 1 : -1; rot = -20 + 40 * s; }
          else if (u < 0.85) { x = basket[0] - 6; y = basket[1] - 6; pose = 'perch'; }
          else if (u < 1.45) { const s = sstep(0.85, 1.45, u); x = lerp(basket[0], RIDER_X - 380, s); y = lerp(basket[1], GROUND_Y - 30, s) - 160 * Math.sin(Math.PI * s); flip = -1; rot = -10 + 40 * s; }
          else { const s = u - 1.45; x = RIDER_X - 380 - s * 900; y = GROUND_Y - 30 - Math.abs(Math.sin(s * 14)) * 10; flip = -1; rot = 0; }
          set(r.catJump, 'transform', `translate(${f(x)} ${f(y)}) scale(${flip} 1) rotate(${f(rot)})`);
          vis(r.catLeap, pose === 'leap'); vis(r.catPerch, pose === 'perch');
          vis(r.catFish, u > 0.7);
          set(r.catFish, 'transform', pose === 'perch' ? 'translate(30 -26) rotate(80)' : 'translate(50 -2) rotate(90) scale(0.9)');
        }
        popAnim('popMeow', u - 0.5, 1.1, RIDER_X + 380, GROUND_Y - 470, 6);
      }

      // ---- NO PELICANS -> PELICANS WELCOME
      {
        const [k, sx] = signAt(D);
        const show = sx > -300 && sx < 1900;
        vis(r.sign, show);
        api.sign = show ? { k, x: sx } : null;
        const u = tau('welcome', t), run = u >= 0 && u < DUR.welcome && E.welcome.k === k, FLK = 0.55;
        if (show) {
          set(r.sign, 'transform', `translate(${f(sx)} 752)`);
          let yes = welcomed.has(k), dark = false;
          // the flicker: a failing tube, stepped at 18 Hz, settling on WELCOME
          if (run && u < FLK) { yes = reduced ? u > FLK / 2 : hash(Math.floor(u * 18), 21) < 0.15 + u / FLK; dark = !reduced && hash(Math.floor(u * 18), 22) < 0.25; }
          vis(r.signNo, !yes && !dark); vis(r.signYes, yes && !dark);
          // the doorbell breathes while the sign is still hostile (the clue)
          set(r.signBellGlow, 'opacity', welcomed.has(k) ? '0.15' : f2(0.35 + 0.35 * Math.sin(t * 3)));
        }
        const hOn = show && run && u > FLK - 0.1;
        vis(r.signHearts, hOn);
        if (hOn) for (let i = 0; i < 5; i++) {
          const s = u - (FLK - 0.1) - i * 0.12, on = s > 0 && s < 1.4;
          vis(r['sh' + i], on);
          if (on) { set(r['sh' + i], 'transform', `translate(${f(-70 + i * 34 + 10 * Math.sin(s * 5 + i))} ${f(-50 - s * 90)}) scale(${f2(0.7 + 0.6 * sstep(0, 0.25, s))})`); set(r['sh' + i], 'opacity', f2(1 - sstep(0.9, 1.4, s))); }
        }
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
        popAnim('popSplash', u, 1.2, RIDER_X + 430, GROUND_Y - 150, -6);
      }

      // ---- milestones + data bits
      {
        const uk = tau('km', t), u42 = tau('fortytwo', t);
        const [qx, qy, qs] = anchor(290, 330, 330), [PX, PY, PZ0] = scr(fr, qx, aspect >= 1.25 ? qy : 380), PZ = PZ0 * qs;
        const posterAnim = (el, inner, u, dur) => {
          const on = u >= 0 && u < dur;
          vis(el, on); if (!on) return;
          const s = reduced ? 1 : easeOutBack(clamp(u / 0.4, 0, 1));
          set(el, 'transform', `translate(${f(PX + glitchX(u, 5) * PZ)} ${f(PY + (reduced ? 0 : 3 * Math.sin(u * 2.2)) * PZ)}) scale(${f2(PZ)})`);
          set(inner, 'transform', `scale(${f2(clamp(u / 0.18, 0.05, 1))} ${f2(Math.max(0.01, s))})`);
          const flick = !reduced && u < 0.45 && hash(Math.floor(u * 24), 7) < 0.3;
          set(el, 'opacity', f2((flick ? 0.4 : 1) * (1 - sstep(dur - 0.4, dur, u))));
        };
        posterAnim(r.posterKm, r.posterKmIn, uk, DUR.km);
        posterAnim(r.poster42, r.poster42In, u42, DUR.fortytwo);
        if (E.km && uk >= 0 && uk < DUR.km && E.km.n !== api.kmShown) {
          api.kmShown = E.km.n;
          const tt = text(`${E.km.n} KM!`, 50, 0, 26);
          for (const c of r.posterKmBig.children) c.setAttribute('d', tt.d);
        }
        const uc = Math.max(uk >= 0 && uk < DUR.km ? uk : -1, u42 >= 0 && u42 < DUR.fortytwo ? u42 : -1);
        const con = uc >= 0 && uc < 3.2 && !reduced;
        vis(r.confetti, con);
        if (con) for (let i = 0; i < 28; i++) {
          const a = (-90 + (hash(i, 1) - 0.5) * 220) * D2R, sp = 260 + 320 * hash(i, 2);
          const drag = 1 - Math.exp(-uc * 2.2);
          const x = PX + PZ * (Math.cos(a) * sp * drag / 2.2 + 14 * Math.sin(uc * (4 + 3 * hash(i, 4)) + i));
          const y = PY + PZ * (Math.sin(a) * sp * drag / 2.2 + 70 * uc * uc);
          // data bits spin in 90° steps (digital), not smoothly
          set(r['cf' + i], 'transform', `translate(${f(x)} ${f(y)}) rotate(${Math.floor(uc * (4 + 6 * hash(i, 6))) * 90}) scale(${f2(PZ)})`);
          set(r['cf' + i], 'opacity', f2((Math.floor(uc * 10 + i) % 5 ? 1 : 0.35) * (1 - sstep(2.4, 3.2, uc))));
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
          vis(r.veloSpark, !snap && u > 0.35 && Math.floor(u * 12) % 3 !== 0);
          if (!snap) set(r.veloSpark, 'transform', `rotate(${Math.floor(u * 12) * 23 % 60 - 30} ${BIKE.frontHub[0]} ${BIKE.frontHub[1]})`);
          vis(r.veloLinks, snap);
          if (snap) for (let i = 0; i < 8; i++) {
            const s = u - 2.3, a = (-160 + 140 * hash(i, 8)) * D2R, sp = 260 + 200 * hash(i, 9);
            set(r['lk' + i], 'transform', `translate(${f(90 + Math.cos(a) * sp * s)} ${f(-90 + Math.sin(a) * sp * s + 700 * s * s)}) rotate(${f(s * 720 * (hash(i, 10) - 0.5))})`);
          }
          const q = sstep(0.4, 0.6, u) * (1 - sstep(2.1, 2.3, u));
          vis(r.veloQ, q > 0.02);
          if (q > 0.02) set(r.veloQ, 'transform', `translate(-30 -515) rotate(${f(8 * Math.sin(u * 6))}) scale(${f2(q)})`);
        }
        popAnim('popSnap', u - 2.3, 0.9, RIDER_X + 330, GROUND_Y - 260, -8);
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
          if (bOn) {
            set(r.ufoBeam, 'transform', `translate(0 12) scale(1 ${f2(sstep(1.1, 1.3, u) * (1 - sstep(2.85, 3.0, u)))})`);
            for (let k = 0; k < 3; k++) {   // scan rings slide down the beam
              const p = wrap(u * 0.9 + k / 3, 1), yy = p * 260, rx = 30 + yy * 0.44;
              set(r['ufoRing' + k], 'transform', `translate(0 ${f(yy)}) scale(${f(rx)})`);
              set(r['ufoRing' + k], 'opacity', f2(Math.sin(Math.PI * p) * 0.9));
            }
          }
          vis(r.ufoLines, u > 3.6);
          const blink = Math.floor(u * 6) % 3;
          for (let k = 0; k < 3; k++) set(r['ufoL' + k], 'opacity', k === blink ? '1' : '0.35');
          set(r.ufoTip, 'opacity', Math.floor(u * 3) % 2 ? '1' : '0.3');
          if (fishOn) {
            const s = sstep(1.3, 2.8, u);
            const by = -300 - s * (GROUND_Y + fr.pose.riderY - 300 - hover[1] - 10);
            set(r.ufoFish, 'transform', `translate(${f(184 + 6 * Math.sin(u * 7))} ${f(by)}) rotate(${f(-30 + 70 * Math.sin(u * 5))}) scale(${f2(1 - 0.5 * s)})`);
          }
        }
        popAnim('popBleep', u - 3.0, 1.0, RIDER_X + 420, 330, 6);
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
            const beat = u - 0.9 - i * 0.28, sing = beat > 0 && wrap(beat, 1.4) < 0.45 && u < 2.9;
            vis(r[`g${i}Jaw`], sing); vis(r[`g${i}Kaw`], sing);
          }
          const nu = wrap(u, 1.2);
          set(r.chNotes, 'transform', `translate(${f(820 + 40 * nu)} ${f(210 - 60 * nu)})`);
          set(r.chNotes, 'opacity', f2(u < 2.9 ? Math.sin(Math.PI * nu / 1.2) : 0));
        }
      }

      // ---- HACK: the wireframe city
      {
        const u = tau('hack', t), on = u >= 0 && u < DUR.hack;
        // glitch windows at the edges
        const step = Math.floor(u * 15);
        const edge = on && (u < 0.35 || u > DUR.hack - 0.45);
        // one class flip in, one out (each is a single full repaint of the static sheets); the flicker is sold by the
        // compositor-only sheet jitter below and the banner, never by toggling the paint
        // one class flip in, one out (each is a single repaint of the static sheets); the flicker is sold by the
        // compositor-only sheet jitter below and by the banner, never by toggling the paint
        klass('egg-hack', on); klass('egg-wire', on && u > 0.16 && u < DUR.hack - 0.22);
        vis(r.hack, on); vis(r.hackBox, on && u > 0.3 && u < DUR.hack - 0.3);
        if (on && !hackSheets) {
          hackSheets = [...svg.querySelectorAll('svg.pb-sheet')].filter(s => !/^(defs|j-|L-rider$|L-fx-front$|L-letterbox$)/.test(s.getAttribute('data-sheet') || ''));
          const nP = svg.querySelectorAll('path').length, nN = svg.querySelectorAll('*').length;
          r.hackStats.setAttribute('d', text(`PATHS ${nP} · NODES ${nN} · SHEETS ${hackSheets.length} · FILTERS ON RIDER 0`, 10.5, 0, 34, { font: 'mono', track: 0 }).d);
        }
        if (hackSheets) {
          hackSheets.forEach((s, i) => {
            // compositor-only jitter: the CSS `translate` property on whole sheets (never touches their paint)
            const v = on && edge && !reduced && hash(step, i + 7) < 0.3 ? `${Math.round((hash(step, i + 99) - 0.5) * 70)}px 0px` : '';
            if (hackTr.get(s) !== v) { hackTr.set(s, v); s.style.translate = v; }
          });
          if (!on) hackSheets = null;
        }
        if (on) {
          const [, , hs] = anchor(660, 800, 118), [bx, by, bz0] = scr(fr, 800, aspect >= 1.25 ? 118 : 335), bz = bz0 * hs;
          set(r.hackBanner, 'transform', `translate(${f(bx + glitchX(u, 11) * bz)} ${f(by)}) scale(${f2(bz)})`);
          set(r.hackIn, 'transform', `scale(1 ${f2(reduced ? 1 : clamp(u / 0.12, 0.05, 1) * (1 - sstep(DUR.hack - 0.15, DUR.hack, u) * 0.95))})`);
          const [sx0, sy0, sz] = scr(fr, 800, -60 + (u / DUR.hack) * 1020);
          set(r.hackScan, 'transform', `translate(${f(sx0)} ${f(sy0)}) scale(${f2(sz)})`);
          vis(r.hackScan, !reduced);
        }
      }
    },
  };

  function popAnim(ref, u, dur, x, y, rot) {
    const el = r[ref], rays = r[ref + 'Rays'];
    const on = u >= 0 && u < dur;
    vis(el, on);
    if (!on) return;
    x = clampW(lastFrame, x, 150);
    const uin = clamp(u / 0.16, 0, 1), uout = sstep(dur - 0.24, dur, u);
    const s = reduced ? 1 : (uin < 1 ? easeOutBack(uin) : 1) * (1 - 0.35 * uout);
    const wob = reduced ? 0 : 3 * Math.exp(-u * 5) * Math.sin(u * 30);
    set(el, 'transform', `translate(${f(x)} ${f(y - 14 * uout)}) rotate(${f(rot + wob)}) scale(${f2(Math.max(0.01, s))})`);
    set(el, 'opacity', f2(1 - uout));
    const ur = clamp(u / 0.34, 0, 1);
    vis(rays, ur < 1);
    if (ur < 1) { set(rays, 'transform', `scale(${f2(0.75 + 0.5 * ur)})`); set(rays, 'opacity', f2(1 - ur * ur)); }
    // glitch: the three slices shear sideways in 1/20 s steps while it lands, bars flash
    const g = !reduced && (u < 0.3 || (u > dur - 0.2));
    const stp = Math.floor(u * 20);
    for (let i = 0; i < 3; i++) set(r[ref + 'S' + i], 'transform', g ? `translate(${Math.round((hash(stp, i + 40) - 0.5) * 18)} 0)` : 'translate(0 0)');
    vis(r[ref + 'G'], g && hash(stp, 44) < 0.5);
  }
}

// ------------------------------------------------------------------------------------------------ connect (runtime)
// Called once by main.js after attach: wires keys, clicks and bus events to the X-sheets; returns the test API.
export function connect({ bus, state, svg }) {
  const A = inst;
  if (!A) return null;
  const win = svg.ownerDocument.defaultView;
  const emitFound = id => {
    const e = EGGS.find(x => x.id === id);
    bus.emit('egg:found', { id, zh: e.zh, en: e.en, count: A.found.size, total: EGGS.length });
  };
  // the rider reacts to a discovery (live play only; screenshot mode stays deterministic)
  const REACT = { km: ['ui:bell', 250], fortytwo: ['ui:wave', 400], bottle: ['ui:wave', 900], wish: ['ui:bell', 300], sunwink: ['ui:wave', 300], welcome: ['ui:wave', 700], gold: ['ui:wave', 500] };
  const live = !new URLSearchParams(win.location.search).has('freeze');
  // the reaction beat is the rider's, not the viewer's: flag it so it cannot cascade into another egg (km -> bell -> cat)
  let reacting = false;
  const react = type => { reacting = true; try { bus.emit(type, {}); } finally { reacting = false; } };
  // the suit: the rig's hero-beat pose accent keys off state.mechT0; audio gets egg:mech (servos, whine, thoom, bleeps)
  A.onMech((on, stop, t0) => {
    if (on) state.mechT0 = t0; else if (stop) delete state.mechT0;
    bus.emit('egg:mech', { on, stop });
  });
  A.onFound(id => { emitFound(id); const rc = live && REACT[id]; if (rc) win.setTimeout(() => react(rc[0]), rc[1]); });
  if (A.found.size) queueMicrotask(() => bus.emit('egg:found', { id: null, count: A.found.size, total: EGGS.length }));
  // clue tier: after a minute of riding, show the empty tally so players know there is something to find
  else if (live) win.setTimeout(() => { if (!A.found.size) bus.emit('egg:found', { id: null, count: 0, total: EGGS.length }); }, 60000);

  // keys: Konami + typed words (never steals keys: the ride shortcuts still fire; side effects are undone on success)
  const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let seq = [], typed = '';
  let autoBeforeA = null, hackBefore = null;
  const restore = (before) => queueMicrotask(() => {
    if (!before) return;
    if (before.auto !== undefined && state.todAuto !== before.auto) bus.emit('ui:tod', { auto: before.auto });
    if (before.cam !== undefined && state.cam !== before.cam) bus.emit('ui:camera', { mode: before.cam });
  });
  win.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    const tg = e.target; if (tg && (tg.isContentEditable || (tg.tagName === 'INPUT' && !/range|checkbox|radio|button/.test(tg.type)) || tg.tagName === 'TEXTAREA')) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === 'b') autoBeforeA = state.todAuto;   // 'a' (auto day) fires next: remember the value to restore
    if (k === 'h') hackBefore = { auto: state.todAuto, cam: state.cam };   // h-a-c-k: A toggles the day cycle, C the camera
    seq.push(k); if (seq.length > KONAMI.length) seq.shift();
    if (seq.length === KONAMI.length && seq.every((x, i) => x === KONAMI[i])) {
      seq = [];
      restore({ auto: autoBeforeA ?? undefined });
      A.setMech(!A.mech);
    }
    if (e.key === 'Escape' && A.mech && !(tg && tg.closest && tg.closest('dialog,[role="dialog"]')) && !svg.ownerDocument.querySelector('dialog[open]')) A.setMech(false);
    if (k.length === 1) {
      typed = (typed + k).slice(-8);
      if (typed.endsWith('gimini')) {
        typed = '';
        // 'm' toggled the sound on the way: put it back
        queueMicrotask(() => bus.emit('ui:sound', { on: !state.toggles.sound }));
        velo();
      }
      if (typed.endsWith('bird')) { typed = ''; A.start('flight'); }
      if (typed.endsWith('hack')) { typed = ''; restore(hackBefore); A.start('hack'); }
      if (typed.endsWith('888')) { typed = ''; A.setGold(!A.gold); }
      if (typed.endsWith('brown')) { typed = ''; A.setBrown(!A.brown); }   // (the 'w' on the way waves: harmless, like HACK's hop)
    }
  });
  function velo() {
    A.start('velo');
    if (state.coasting) return;
    bus.emit('ui:coast', { on: true });                  // the drivetrain jams: the cranks lock, the bike rolls on
    setTimeout(() => bus.emit('ui:coast', { on: false }), 2300);   // SNAP! the chain flies off and we pedal again
  }

  // bus: bell (cat, chorus, sign), hop (puddle), gulp (UFO at night)
  const bells = [];
  bus.on('rig:event', ev => {
    // only the viewer unlocks eggs: beats fired by the director or the beat keeper (auto: true) never count
    if (!ev || ev.auto || reacting) return;
    const t = ev.t0;
    if (ev.type === 'bell') {
      bells.push(t); while (bells.length && t - bells[0] > 3.5) bells.shift();
      if (bells.length >= 7) { bells.length = 0; A.start('chorus'); }
      const b = A.bench;
      if (b && b.x > 60 && b.x < 1560 && b.k !== undefined && !(A.E.cat && t - A.E.cat.t0 < DUR.cat)) { A.catTake(b.k); A.start('cat', { x0: b.x }); }
      const s = A.sign;
      if (s && s.x > 40 && s.x < 1560 && !A.welcomed.has(s.k)) { A.welcomed.add(s.k); A.start('welcome', { k: s.k }); }
    }
    if (ev.type === 'hop') A.hopT0 = t;
    if (ev.type === 'gulp') { const fr = A.frame(); if (fr && fr.night > 0.6 && !(A.E.ufo && t - A.E.ufo.t0 < DUR.ufo + 4)) A.start('ufo'); }
  });

  // clicks on the sky and the sea, hit-tested in each layer's own coordinates. The layer <g> may sit inside a
  // composited sheet that is CSS-translated (core/sheets.js), so map through the scene root's CTM × the layer's own
  // camera transform rather than the layer's getScreenCTM.
  const layerPt = (id, e) => {
    const root = svg.querySelector('svg[data-sheet="defs"]') || svg.querySelector('svg');
    const el = svg.querySelector('#' + id); if (!root || !el) return null;
    const m = root.getScreenCTM(); if (!m) return null;
    const lm = el.transform && el.transform.baseVal.consolidate();
    const M = lm ? m.multiply(lm.matrix) : m;
    return new DOMPoint(e.clientX, e.clientY).matrixTransform(M.inverse());
  };
  svg.addEventListener('click', e => {
    const fr = A.frame(); if (!fr) return;
    const s = A.shoot;
    if (s && fr.t - s.t < 0.7) {
      const p = layerPt('L-stars', e);
      if (p && Math.hypot(p.x - s.x, p.y - s.y) < 80) { A.start('wish', { x: p.x, y: p.y }); return; }
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
    const vw = A.visW ? A.visW() : 1600;
    if (vw < 1100) { A.start('bottle', { nx: 800, ny: 370, ns: Math.min(1, (vw - 20) / 390) }); return; }   // portrait: centred, fitted
    let nx = clamp(b.x, 230, 1370);
    if (nx > 520 && nx < 1060) nx = nx < 790 ? 520 : 1060;
    A.start('bottle', { nx, ny: 360 });
  }

  // ---- test API
  const trig = {
    mech: () => A.setMech(true),
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
    hack: () => A.start('hack'),
    welcome: () => { const s = A.sign; const k = s ? s.k : -2; A.welcomed.add(k); A.start('welcome', { k }); },
    gold: () => A.setGold(true),
  };
  return {
    list: EGGS.map(e => ({ ...e })),
    trigger(id) { if (!trig[id]) throw new Error('unknown egg ' + id); trig[id](); return [...A.found]; },
    found: () => [...A.found],
    stopAll() { if (A.mech) A.setMech(false, true); for (const k in A.E) delete A.E[k]; if (A.brown) A.setBrown(false); if (A.gold) A.setGold(false); },   // end running eggs (keeps found)
    reset() { A.found.clear(); A.welcomed.clear(); try { localStorage.removeItem('pb-eggs'); } catch (e) { /* ignore */ } if (A.mech) A.setMech(false, true); for (const k in A.E) delete A.E[k]; if (A.brown) A.setBrown(false); if (A.gold) A.setGold(false); },
    setMech: (on, stop) => A.setMech(on, stop),
    mech: () => A.mech,
    setBrown: on => A.setBrown(on),
    setGold: on => A.setGold(on),
    signAt, benchAt, shootAt,
  };
}
